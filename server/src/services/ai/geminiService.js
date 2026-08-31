const path = require('path');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../../config');

let genAI = null;
let model = null;
let activeModelName = null;

// Tried in order, newest first. The first that answers is cached for the process.
// Each model carries its own free-tier quota, so the lite variants act as
// headroom once the primary model's daily allowance is spent.
const MODEL_CANDIDATES = [
  ...new Set(
    [
      config.geminiModel,
      'gemini-3.6-flash',
      'gemini-flash-latest',
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-flash-lite-latest',
    ].filter(Boolean)
  ),
];

const GENERATION_CONFIG = {
  temperature: 0.1,
  maxOutputTokens: 8192,
  responseMimeType: 'application/json',
};

const initGemini = () => {
  if (!config.geminiApiKey) {
    console.warn('GEMINI_API_KEY not set. AI features disabled.');
    return false;
  }
  if (!genAI) {
    genAI = new GoogleGenerativeAI(config.geminiApiKey);
  }
  return true;
};

const buildModel = (name) =>
  genAI.getGenerativeModel({ model: name, generationConfig: GENERATION_CONFIG });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const isModelMissingError = (err) => {
  const msg = String(err?.message || '');
  return msg.includes('404') || /not found|not supported|unsupported model/i.test(msg);
};

// A bad key or a project without API access will never succeed, so don't retry
// or walk the model fallback chain — report it straight away.
const isAuthError = (err) => {
  const msg = String(err?.message || '');
  return /\[40[13]|API_KEY_INVALID|api key not valid|permission denied|denied access/i.test(msg);
};

const isTransientError = (err) => {
  const msg = String(err?.message || '');
  return /429|500|503|504|overloaded|rate limit|quota|deadline|timeout|ECONN|fetch failed/i.test(msg);
};

// A per-day allowance won't reset within the request, so waiting is pointless —
// move on to a model that still has quota left.
const isDailyQuotaError = (err) => /PerDay/i.test(String(err?.message || ''));

/**
 * Gemini reports exactly how long to wait when a quota is hit. Honour it — the
 * free tier allows only 5 requests/minute, so plain exponential backoff gives
 * up long before the window resets.
 */
const retryDelayFromError = (err) => {
  const msg = String(err?.message || '');
  const match =
    msg.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/) ||
    msg.match(/retry in (\d+(?:\.\d+)?)\s*s/i);
  if (!match) return 0;
  return Math.min(Math.ceil(parseFloat(match[1])) * 1000 + 500, 65000);
};

/**
 * Send a prompt to Gemini, transparently falling back to another model if the
 * configured one does not exist, and retrying transient failures.
 */
const generate = async (parts, { retries = 5 } = {}) => {
  if (!initGemini()) {
    throw new Error(
      'Gemini API key is not configured. Set GEMINI_API_KEY in server/.env to enable extraction.'
    );
  }

  let lastError = null;
  // Start from the model already proven to work, but keep the rest as fallbacks
  // so a mid-run quota exhaustion can still roll over.
  const candidates = activeModelName
    ? [activeModelName, ...MODEL_CANDIDATES.filter((name) => name !== activeModelName)]
    : MODEL_CANDIDATES;

  for (const name of candidates) {
    if (!model || activeModelName !== name) {
      model = buildModel(name);
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await model.generateContent(parts);
        if (activeModelName !== name) {
          activeModelName = name;
          console.log(`✅ Gemini model in use: ${name}`);
        }
        return result.response.text();
      } catch (err) {
        lastError = err;
        if (isAuthError(err)) {
          throw new Error(
            'Gemini rejected the API key (HTTP 403/401). Check GEMINI_API_KEY in server/.env, ' +
              'and note that a newly created API project can take a few minutes before it is ' +
              'granted access.'
          );
        }
        if (isModelMissingError(err)) break; // try the next candidate model
        if (isDailyQuotaError(err)) {
          console.warn(`⚠️ Daily free-tier quota spent on ${name}, trying the next model...`);
          break;
        }
        if (attempt < retries && isTransientError(err)) {
          const backoff = Math.max(1000 * 2 ** attempt, retryDelayFromError(err));
          await sleep(backoff);
          continue;
        }
        throw new Error(`Gemini request failed: ${err.message}`);
      }
    }

    // Only reached when this model is unavailable — reset and try the next one.
    model = null;
    activeModelName = null;
  }

  throw new Error(
    `Every Gemini model is unavailable or out of free-tier quota (tried: ${MODEL_CANDIDATES.join(', ')}). ` +
      `The free tier allows only 20 requests per day per model. Last error: ${lastError?.message || 'unknown'}`
  );
};

/**
 * Parse a model response into JSON. Tolerates markdown fences and stray prose
 * by falling back to the outermost balanced object in the text.
 */
const parseJsonResponse = (raw, context) => {
  const text = String(raw || '').trim();
  const stripped = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  const candidates = [stripped];
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start !== -1 && end > start) candidates.push(stripped.slice(start, end + 1));

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      /* try the next candidate */
    }
  }

  throw new Error(`Failed to parse ${context} response as JSON. Raw: ${text.slice(0, 300)}`);
};

const toNumber = (value, fallback) => {
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
};

// A highlight thinner than this is useless to a teacher, so treat it as a bad
// detection rather than drawing a sliver.
const MIN_REGION_SIZE = 0.03;

/**
 * Gemini is asked for {x, y, width, height} in 0-1, but it frequently answers in
 * its native detection format instead: box_2d as [ymin, xmin, ymax, xmax] scaled
 * 0-1000. Accept both, plus corner pairs, and infer the scale from the values.
 * Returns null when the box is unusable.
 */
const normalizeRegion = (region) => {
  if (!region) return null;

  const pick = (...names) => {
    for (const name of names) {
      const value = toNumber(region[name], null);
      if (value !== null) return value;
    }
    return null;
  };

  let corners = null; // [yMin, xMin, yMax, xMax]

  if (Array.isArray(region) && region.length === 4) {
    corners = region.map((v) => toNumber(v, 0));
  } else if (Array.isArray(region.box_2d) && region.box_2d.length === 4) {
    corners = region.box_2d.map((v) => toNumber(v, 0));
  } else {
    const yMin = pick('ymin', 'yMin', 'top', 'y1');
    const xMin = pick('xmin', 'xMin', 'left', 'x1');
    const yMax = pick('ymax', 'yMax', 'bottom', 'y2');
    const xMax = pick('xmax', 'xMax', 'right', 'x2');
    if ([yMin, xMin, yMax, xMax].every((v) => v !== null)) corners = [yMin, xMin, yMax, xMax];
  }

  let box;
  if (corners) {
    const [yMin, xMin, yMax, xMax] = corners;
    box = { x: xMin, y: yMin, width: xMax - xMin, height: yMax - yMin };
  } else {
    const x = pick('x');
    const y = pick('y');
    const width = pick('width', 'w');
    const height = pick('height', 'h');
    if ([x, y, width, height].some((v) => v === null)) return null;
    box = { x, y, width, height };
  }

  // Infer the coordinate scale from the largest magnitude present.
  const magnitude = Math.max(
    Math.abs(box.x + box.width),
    Math.abs(box.y + box.height),
    Math.abs(box.x),
    Math.abs(box.y)
  );
  const divisor = magnitude <= 1.5 ? 1 : magnitude <= 100 ? 100 : 1000;

  const scaled = {
    x: box.x / divisor,
    y: box.y / divisor,
    width: box.width / divisor,
    height: box.height / divisor,
  };

  if (Object.values(scaled).some((v) => !Number.isFinite(v))) return null;
  if (scaled.width <= 0 || scaled.height <= 0) return null;
  if (scaled.x >= 1 || scaled.y >= 1) return null;

  return {
    x: Math.max(0, Math.min(0.99, scaled.x)),
    y: Math.max(0, Math.min(0.99, scaled.y)),
    width: Math.max(MIN_REGION_SIZE, Math.min(1 - Math.max(0, scaled.x), scaled.width)),
    height: Math.max(MIN_REGION_SIZE, Math.min(1 - Math.max(0, scaled.y), scaled.height)),
  };
};

// Used when the model gives no usable box, so the answer is still reviewable.
const FALLBACK_REGION = { x: 0.05, y: 0.05, width: 0.9, height: 0.12 };

/**
 * Convert a file to a Gemini-compatible inlineData part.
 * Auto-detects mime type from extension — supports PDF, PNG, JPG.
 */
const fileToGenerativePart = (filePath) => {
  const data = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();

  const mimeMap = {
    '.pdf':  'application/pdf',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
  };
  const mimeType = mimeMap[ext] || 'image/png';

  return {
    inlineData: {
      data: data.toString('base64'),
      mimeType,
    },
  };
};

/**
 * Extract structured questions from a question paper page (image or PDF).
 * Returns an array of question objects.
 */
const extractQuestionsFromPage = async (imagePath, pageNumber) => {
  const filePart = fileToGenerativePart(imagePath);

  const prompt = `You are an expert at reading academic question papers.
Analyze page ${pageNumber} of this question paper and extract EVERY question on it.

RULES:
1. Preserve the printed question numbering EXACTLY as shown (e.g. "1", "2", "11(a)", "11(b)", "Q5").
2. Treat every sub-part as its OWN item. Q11(a) and Q11(b) are two separate entries.
3. A question whose text wraps over several lines is still ONE question.
4. Capture the complete question text, including any values, formulae or units.
5. IGNORE page headers, footers, instructions, section titles, marks tables and blank space.
6. If the marks for a question are printed (e.g. "[5]", "(2 marks)"), report them in "maxMarks". Use null when absent.
7. If the page contains NO questions, return an empty array.

BOUNDING BOXES:
- Normalized to the page: 0.0 = left/top edge, 1.0 = right/bottom edge.
- x, y = top-left corner of the box; width, height = its size.
- The box must tightly enclose the full question text block including its number.

Return ONLY valid JSON with this exact shape:
{
  "questions": [
    {
      "number": "1",
      "text": "Full question text here",
      "subPart": null,
      "maxMarks": 2,
      "boundingBox": { "x": 0.05, "y": 0.1, "width": 0.9, "height": 0.08 }
    },
    {
      "number": "11(a)",
      "text": "Sub-question text",
      "subPart": "a",
      "maxMarks": 3,
      "boundingBox": { "x": 0.05, "y": 0.35, "width": 0.9, "height": 0.06 }
    }
  ]
}`;

  const text = await generate([prompt, filePart]);
  const parsed = parseJsonResponse(text, 'question extraction');
  const questions = Array.isArray(parsed.questions) ? parsed.questions : [];

  return questions
    .filter((q) => q && (q.number !== undefined && q.number !== null))
    .map((q) => ({
      number: String(q.number),
      text: String(q.text || '').trim(),
      subPart: q.subPart || null,
      maxMarks: toNumber(q.maxMarks, null),
      boundingBox: normalizeRegion(q.boundingBox) || FALLBACK_REGION,
      pageNumber,
    }));
};

/**
 * Extract structured answers from a handwritten answer sheet page (image or PDF).
 */
const extractAnswersFromPage = async (imagePath, pageNumber) => {
  const filePart = fileToGenerativePart(imagePath);

  const prompt = `You are an expert at reading handwritten student answer sheets.
Analyze page ${pageNumber} of this answer sheet and identify EVERY handwritten answer block.

RULES:
1. Work out which question number each answer belongs to. Students write it as "Q1", "1.", "1)", "Ans 1", "Sol. 1", "11(a)" etc.
2. Answers may appear OUT OF ORDER. Never assume the order on the page matches the question paper.
3. Transcribe the handwriting as accurately as you can. Keep line breaks between distinct steps.
4. Group everything belonging to one question — text, working, equations, labelled diagrams — into ONE answer entry with ONE bounding box covering the whole block.
5. Describe diagrams in words inside the text, e.g. "[Diagram: labelled cross-section of a leaf]".
6. If a block has no identifiable question number, put it in "unmatchedRegions" instead. Never guess a number.
7. Set "continuesFromPreviousPage": true when the block at the top of the page is clearly a continuation.
8. Blank pages, margins, rough work and page numbers are NOT answers.

BOUNDING BOXES:
- Normalized to the page: 0.0 = left/top edge, 1.0 = right/bottom edge.
- x, y = top-left corner; width, height = size of the box.
- The box must tightly enclose the whole answer block, with no more than a small margin.

CONFIDENCE (0.0-1.0) reflects how sure you are of the transcription AND of the question number:
- 0.9+ very clear   - 0.7-0.89 clear   - 0.6-0.69 some ambiguity   - below 0.6 unclear handwriting

Return ONLY valid JSON:
{
  "answers": [
    {
      "questionNumber": "1",
      "text": "The extracted handwritten text",
      "confidence": 0.92,
      "region": { "x": 0.05, "y": 0.08, "width": 0.9, "height": 0.25 },
      "isReadable": true,
      "continuesFromPreviousPage": false,
      "notes": ""
    }
  ],
  "unmatchedRegions": [
    {
      "text": "Text that could not be attributed to a question",
      "region": { "x": 0.1, "y": 0.7, "width": 0.8, "height": 0.1 },
      "confidence": 0.5
    }
  ]
}`;

  const text = await generate([prompt, filePart]);
  const parsed = parseJsonResponse(text, 'answer extraction');

  const rawAnswers = Array.isArray(parsed.answers) ? parsed.answers : [];
  const rawUnmatched = Array.isArray(parsed.unmatchedRegions) ? parsed.unmatchedRegions : [];

  const answers = rawAnswers
    .filter((a) => a && String(a.text || '').trim().length > 0)
    .map((a) => ({
      questionNumber: a.questionNumber == null ? null : String(a.questionNumber),
      text: String(a.text || '').trim(),
      confidence: Math.max(0, Math.min(1, toNumber(a.confidence, 0.7))),
      regions: [{ pageNumber, ...(normalizeRegion(a.region) || FALLBACK_REGION) }],
      isReadable: a.isReadable !== false,
      continuesFromPreviousPage: a.continuesFromPreviousPage === true,
      notes: String(a.notes || ''),
      pageNumber,
    }));

  // An answer without a usable question number is really an unmatched region.
  const identified = answers.filter((a) => a.questionNumber && a.questionNumber.trim());
  const unidentified = answers
    .filter((a) => !a.questionNumber || !a.questionNumber.trim())
    .map((a) => ({ text: a.text, regions: a.regions, confidence: a.confidence }));

  const unmatched = [
    ...unidentified,
    ...rawUnmatched
      .filter((u) => u && String(u.text || '').trim().length > 0)
      .map((u) => ({
        text: String(u.text).trim(),
        regions: [{ pageNumber, ...(normalizeRegion(u.region) || FALLBACK_REGION) }],
        confidence: Math.max(0, Math.min(1, toNumber(u.confidence, 0.5))),
      })),
  ];

  return { answers: identified, unmatched };
};

/**
 * Grade a batch of question/answer pairs in a single request.
 * Returns a map of { [id]: { marksAwarded, maxMarks, status, feedback } }.
 */
const gradeAnswers = async (items) => {
  if (!items || items.length === 0) return {};
  if (!config.geminiApiKey) return {};

  const payload = items.map((item) => ({
    id: item.id,
    question: item.questionText,
    maxMarks: item.maxMarks || 5,
    studentAnswer: item.answerText,
  }));

  const prompt = `You are an experienced school examiner grading a student's answer sheet.
Grade each answer below. Award partial credit for partially correct work.

For every item return:
- "marksAwarded": integer between 0 and that item's maxMarks
- "status": "correct" | "partial" | "incorrect"
- "feedback": one or two encouraging, specific sentences addressed to the student

Items:
${JSON.stringify(payload, null, 2)}

Return ONLY valid JSON:
{ "results": [ { "id": "...", "marksAwarded": 3, "status": "partial", "feedback": "..." } ] }`;

  try {
    const text = await generate([prompt], { retries: 1 });
    const parsed = parseJsonResponse(text, 'grading');
    const results = Array.isArray(parsed.results) ? parsed.results : [];

    const byId = {};
    for (const result of results) {
      const item = items.find((i) => i.id === result.id);
      if (!item) continue;
      const maxMarks = item.maxMarks || 5;
      byId[result.id] = {
        marksAwarded: Math.max(0, Math.min(maxMarks, Math.round(toNumber(result.marksAwarded, 0)))),
        maxMarks,
        status: ['correct', 'partial', 'incorrect'].includes(result.status) ? result.status : 'partial',
        feedback: String(result.feedback || '').trim(),
      };
    }
    return byId;
  } catch (err) {
    console.warn('⚠️ Grading skipped:', err.message);
    return {};
  }
};

module.exports = {
  extractQuestionsFromPage,
  extractAnswersFromPage,
  gradeAnswers,
  initGemini,
  normalizeRegion,
};
