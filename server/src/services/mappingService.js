const { v4: uuidv4 } = require('uuid');
const { parseQuestionNumber } = require('../utils/normalizer');

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'is', 'are', 'was', 'were', 'be', 'been',
  'for', 'on', 'with', 'as', 'by', 'that', 'this', 'it', 'its', 'from', 'at', 'which', 'what',
  'why', 'how', 'when', 'where', 'who', 'explain', 'describe', 'define', 'state', 'write',
  'draw', 'give', 'name', 'list', 'following', 'briefly', 'your', 'you', 'answer', 'question',
]);

const tokenize = (text) =>
  new Set(
    String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOP_WORDS.has(t))
  );

/**
 * Fraction of the question's meaningful words that also appear in the answer.
 * Used only as a last resort when no question number could be matched.
 */
const contentSimilarity = (questionText, answerText) => {
  const qTokens = tokenize(questionText);
  const aTokens = tokenize(answerText);
  if (qTokens.size === 0 || aTokens.size === 0) return 0;

  let shared = 0;
  for (const token of qTokens) if (aTokens.has(token)) shared += 1;
  return shared / qTokens.size;
};

const SIMILARITY_THRESHOLD = 0.34;
const ANSWERED_CONFIDENCE = 0.7;

const buildMapping = (question, answer, extra = {}) => ({
  id: uuidv4(),
  questionId: question.id,
  questionNumber: question.number,
  questionDisplayLabel: question.displayLabel,
  questionText: question.text,
  questionPageNumber: question.pageNumber,
  questionBoundingBox: question.boundingBox,
  maxMarks: question.maxMarks ?? null,
  order: question.order ?? 0,
  answerStatus: 'unanswered',
  answerText: null,
  answerRegions: [],
  confidence: 0,
  isReadable: false,
  matchType: 'none',
  notes: '',
  grading: null, // populated later if AI grading is enabled
  ...(answer
    ? {
        answerId: answer.id,
        answerText: answer.text,
        answerRegions: answer.regions,
        confidence: answer.confidence,
        isReadable: answer.isReadable,
        notes: answer.notes || '',
      }
    : {}),
  ...extra,
});

/**
 * HYBRID MAPPING ALGORITHM
 *
 * Tier 1 — exact match on the normalized question number.
 * Tier 2 — sub-part reconciliation:
 *           question "11a" answered under a single block written as "11", or
 *           question "11" answered as separate "11a"/"11b" blocks.
 * Tier 3 — content similarity between the question text and leftover answers,
 *           for answers whose written number is wrong or unreadable.
 * Anything left over becomes "unanswered" (question) or "unmatched" (answer).
 *
 * Status values:
 * - "answered"   : Answer found with high confidence (>= 0.7)
 * - "ambiguous"  : Answer found but low confidence or an inferred match → needs review
 * - "unanswered" : No answer found for this question
 * - "unmatched"  : Answer found but couldn't map to a question
 */
const mapAnswersToQuestions = (questions, answers, unmatchedRegions = []) => {
  const available = answers.filter((a) => a && a.normalizedQuestionNumber);
  const byNumber = new Map(available.map((a) => [a.normalizedQuestionNumber, a]));
  const usedAnswerIds = new Set();
  const mappings = [];

  // How many questions share each base number, e.g. 11a + 11b → base "11" has 2.
  const subPartsByBase = new Map();
  for (const question of questions) {
    const { base, subPart } = parseQuestionNumber(question.number);
    if (!subPart) continue;
    if (!subPartsByBase.has(base)) subPartsByBase.set(base, []);
    subPartsByBase.get(base).push(question.number);
  }

  const pending = [];

  for (const question of questions) {
    const { base, subPart } = parseQuestionNumber(question.number);

    // Tier 1: exact number match
    const exact = byNumber.get(question.number);
    if (exact && !usedAnswerIds.has(exact.id)) {
      usedAnswerIds.add(exact.id);
      mappings.push(
        buildMapping(question, exact, {
          answerStatus: exact.confidence >= ANSWERED_CONFIDENCE ? 'answered' : 'ambiguous',
          matchType: 'exact',
        })
      );
      continue;
    }

    // Tier 2a: sub-part question answered under its base number.
    // The block covers every sub-part, so it is shared rather than consumed.
    if (subPart) {
      const baseAnswer = byNumber.get(base);
      if (baseAnswer) {
        const sharedWith = subPartsByBase.get(base) || [];
        const isShared = sharedWith.length > 1;
        usedAnswerIds.add(baseAnswer.id);
        mappings.push(
          buildMapping(question, baseAnswer, {
            answerStatus:
              !isShared && baseAnswer.confidence >= ANSWERED_CONFIDENCE ? 'answered' : 'ambiguous',
            matchType: 'base-number',
            notes: isShared
              ? `Student answered Q${base} as one block covering all sub-parts — verify the part for (${subPart}).`
              : baseAnswer.notes || '',
          })
        );
        continue;
      }
    }

    // Tier 2b: whole question answered as separate sub-part blocks.
    if (!subPart) {
      const parts = available.filter((a) => {
        const parsed = parseQuestionNumber(a.normalizedQuestionNumber);
        return parsed.base === base && parsed.subPart && !usedAnswerIds.has(a.id);
      });

      if (parts.length > 0) {
        parts.forEach((p) => usedAnswerIds.add(p.id));
        const merged = {
          id: parts[0].id,
          text: parts
            .map((p) => `(${parseQuestionNumber(p.normalizedQuestionNumber).subPart}) ${p.text}`)
            .join('\n\n'),
          regions: parts.flatMap((p) => p.regions),
          confidence: Math.min(...parts.map((p) => p.confidence)),
          isReadable: parts.every((p) => p.isReadable),
          notes: '',
        };
        mappings.push(
          buildMapping(question, merged, {
            answerStatus: merged.confidence >= ANSWERED_CONFIDENCE ? 'answered' : 'ambiguous',
            matchType: 'sub-parts-merged',
            notes: `Combined from ${parts.length} sub-part answer blocks.`,
          })
        );
        continue;
      }
    }

    pending.push(question);
  }

  // Tier 3: content similarity for questions still without an answer.
  const leftovers = () => available.filter((a) => !usedAnswerIds.has(a.id));

  for (const question of pending) {
    let best = null;
    let bestScore = 0;

    for (const answer of leftovers()) {
      const score = contentSimilarity(question.text, answer.text);
      if (score > bestScore) {
        bestScore = score;
        best = answer;
      }
    }

    if (best && bestScore >= SIMILARITY_THRESHOLD) {
      usedAnswerIds.add(best.id);
      mappings.push(
        buildMapping(question, best, {
          answerStatus: 'ambiguous',
          matchType: 'content-similarity',
          confidence: Math.min(best.confidence, bestScore),
          notes: `Matched by content — the student wrote "${best.originalQuestionNumber}" above this answer. Please verify.`,
        })
      );
    } else {
      mappings.push(buildMapping(question, null));
    }
  }

  mappings.sort((a, b) => a.order - b.order);

  // Answers that were never claimed by a question
  const unmatchedAnswers = [
    ...leftovers().map((a) => ({
      id: uuidv4(),
      questionNumber: a.originalQuestionNumber || a.normalizedQuestionNumber,
      text: a.text,
      regions: a.regions,
      confidence: a.confidence,
      reason: `The student labelled this "${
        a.originalQuestionNumber || a.normalizedQuestionNumber
      }", but no such question exists in the question paper.`,
    })),
    ...unmatchedRegions.map((u) => ({
      id: uuidv4(),
      questionNumber: null,
      text: u.text,
      regions: u.regions,
      confidence: u.confidence,
      reason: 'No question number was written near this block.',
    })),
  ];

  const summary = {
    totalQuestions: questions.length,
    answered: mappings.filter((m) => m.answerStatus === 'answered').length,
    unanswered: mappings.filter((m) => m.answerStatus === 'unanswered').length,
    ambiguous: mappings.filter((m) => m.answerStatus === 'ambiguous').length,
    unmatchedAnswers: unmatchedAnswers.length,
    totalMarks: 0,
    marksAwarded: 0,
  };

  return { mappings, unmatchedAnswers, summary };
};

module.exports = { mapAnswersToQuestions, contentSimilarity };
