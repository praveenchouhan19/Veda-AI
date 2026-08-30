const path = require('path');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../../config');

let genAI = null;
let model = null;

const initGemini = () => {
  if (!config.geminiApiKey) {
    console.warn('GEMINI_API_KEY not set. AI features disabled.');
    return false;
  }
  if (!genAI) {
    genAI = new GoogleGenerativeAI(config.geminiApiKey);
    model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
    console.log('✅ Gemini 3.6 Flash initialized');
  }
  return true;
};

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
  if (!initGemini()) throw new Error('Gemini API not configured');

  const filePart = fileToGenerativePart(imagePath);

  const prompt = `You are an expert at reading academic question papers.
Analyze this question paper page and extract ALL questions.

CRITICAL RULES:
1. Preserve the original question numbering EXACTLY (e.g., "1", "2", "11(a)", "11(b)")
2. Treat each sub-part as a SEPARATE question item (e.g., Q11(a) and Q11(b) are two separate items)
3. Question text that spans multiple lines = ONE question, not multiple
4. Include the full question text

Return ONLY valid JSON matching this exact schema (no markdown, no extra text):
{
  "questions": [
    {
      "number": "1",
      "text": "Full question text here",
      "subPart": null,
      "boundingBox": { "x": 0.05, "y": 0.1, "width": 0.9, "height": 0.08 }
    },
    {
      "number": "11(a)",
      "text": "Sub-question text",
      "subPart": "a",
      "boundingBox": { "x": 0.05, "y": 0.35, "width": 0.9, "height": 0.06 }
    }
  ]
}

Bounding box coordinates are normalized (0.0 to 1.0) relative to page dimensions.
x, y = top-left corner. width, height = dimensions.
Page number being analyzed: ${pageNumber}`;

  const result = await model.generateContent([prompt, filePart]);
  const text = result.response.text().trim();

  // Strip markdown code fences if present
  const jsonText = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();

  try {
    const parsed = JSON.parse(jsonText);
    return (parsed.questions || []).map((q) => ({ ...q, pageNumber }));
  } catch (e) {
    throw new Error(`Failed to parse Gemini question response: ${e.message}\nRaw: ${text.slice(0, 300)}`);
  }
};

/**
 * Extract structured answers from a handwritten answer sheet page (image or PDF).
 */
const extractAnswersFromPage = async (imagePath, pageNumber) => {
  if (!initGemini()) throw new Error('Gemini API not configured');

  const filePart = fileToGenerativePart(imagePath);

  const prompt = `You are an expert at reading handwritten student answer sheets.
Analyze this answer sheet page and identify ALL handwritten answers.

CRITICAL RULES:
1. Identify which question number each answer corresponds to (look for written "Q1", "1.", "Ans 1", etc.)
2. An answer may start with a question number written by the student
3. Answers may be OUT OF ORDER — don't assume sequential order
4. Extract the handwritten text as accurately as possible
5. If handwriting is unclear, still identify the region and note low confidence
6. Each identified answer block should have its own bounding box

Return ONLY valid JSON (no markdown):
{
  "answers": [
    {
      "questionNumber": "1",
      "text": "The extracted handwritten text as best as possible",
      "confidence": 0.92,
      "region": { "x": 0.05, "y": 0.08, "width": 0.9, "height": 0.25 },
      "isReadable": true,
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
}

Confidence is 0.0-1.0. Below 0.6 = low confidence.
Bounding boxes normalized 0.0-1.0.
Page number being analyzed: ${pageNumber}`;

  const result = await model.generateContent([prompt, filePart]);
  const text = result.response.text().trim();

  const jsonText = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();

  try {
    const parsed = JSON.parse(jsonText);
    const answers = (parsed.answers || []).map((a) => ({
      questionNumber: a.questionNumber,
      text: a.text || '',
      confidence: typeof a.confidence === 'number' ? a.confidence : 0.7,
      regions: [{ pageNumber, ...(a.region || { x: 0.05, y: 0.05, width: 0.9, height: 0.2 }) }],
      isReadable: a.isReadable !== false,
      notes: a.notes || '',
    }));

    const unmatched = (parsed.unmatchedRegions || []).map((u) => ({
      text: u.text || '',
      regions: [{ pageNumber, ...(u.region || { x: 0.05, y: 0.05, width: 0.9, height: 0.1 }) }],
      confidence: u.confidence || 0.5,
    }));

    return { answers, unmatched };
  } catch (e) {
    throw new Error(`Failed to parse Gemini answer response: ${e.message}\nRaw: ${text.slice(0, 300)}`);
  }
};

/**
 * Optional: Grade an answer using Gemini.
 */
const gradeAnswer = async (questionText, answerText, maxMarks = 5) => {
  if (!initGemini()) return null;

  const prompt = `You are an academic examiner grading a student's answer.

Question: ${questionText}
Student's Answer: ${answerText}
Maximum Marks: ${maxMarks}

Grade this answer and return ONLY valid JSON:
{
  "marksAwarded": 3,
  "status": "partial",
  "feedback": "Short constructive feedback in 1-2 sentences"
}

status must be one of: "correct", "partial", "incorrect"`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const jsonText = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
};

module.exports = {
  extractQuestionsFromPage,
  extractAnswersFromPage,
  gradeAnswer,
  initGemini,
};
