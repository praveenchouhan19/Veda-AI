const { v4: uuidv4 } = require('uuid');
const { normalizeQuestionNumber } = require('../utils/normalizer');

/**
 * HYBRID MAPPING ALGORITHM
 *
 * Strategy:
 * 1. Normalize all question numbers from both question paper and answer sheet
 * 2. Exact string match (high confidence)
 * 3. Partial match (e.g., base number without subpart)
 * 4. Mark unmatched questions as "unanswered"
 * 5. Mark unmatched answers as "unmatched"
 *
 * Status values:
 * - "answered"   : Answer found with high confidence (>= 0.7)
 * - "ambiguous"  : Answer found but low confidence (< 0.7) → needs review
 * - "unanswered" : No answer found for this question
 * - "unmatched"  : Answer found but couldn't map to a question
 */
const mapAnswersToQuestions = (questions, answers, unmatchedRegions = []) => {
  const mappings = [];
  const usedAnswerIds = new Set();

  for (const question of questions) {
    const normalizedQ = question.number; // already normalized

    // Step 1: Exact match
    let matchedAnswer = answers.find(
      (a) => !usedAnswerIds.has(a.id) && a.normalizedQuestionNumber === normalizedQ
    );

    // Step 2: Try without subpart (e.g., "11a" question, student wrote "11")
    if (!matchedAnswer && question.subPart) {
      const baseNumber = normalizedQ.replace(/[a-z]$/, '');
      matchedAnswer = answers.find(
        (a) => !usedAnswerIds.has(a.id) && a.normalizedQuestionNumber === baseNumber
      );
    }

    if (matchedAnswer) {
      usedAnswerIds.add(matchedAnswer.id);
      const confidence = matchedAnswer.confidence;
      const status = confidence >= 0.7 ? 'answered' : 'ambiguous';

      mappings.push({
        id: uuidv4(),
        questionId: question.id,
        questionNumber: question.number,
        questionDisplayLabel: question.displayLabel,
        questionText: question.text,
        questionPageNumber: question.pageNumber,
        questionBoundingBox: question.boundingBox,
        answerStatus: status,
        answerText: matchedAnswer.text,
        answerRegions: matchedAnswer.regions,
        confidence: matchedAnswer.confidence,
        isReadable: matchedAnswer.isReadable,
        notes: matchedAnswer.notes || '',
        grading: null, // populated later if AI grading is enabled
      });
    } else {
      // No answer found
      mappings.push({
        id: uuidv4(),
        questionId: question.id,
        questionNumber: question.number,
        questionDisplayLabel: question.displayLabel,
        questionText: question.text,
        questionPageNumber: question.pageNumber,
        questionBoundingBox: question.boundingBox,
        answerStatus: 'unanswered',
        answerText: null,
        answerRegions: [],
        confidence: 0,
        isReadable: false,
        notes: '',
        grading: null,
      });
    }
  }

  // Build unmatched answer list (answers that weren't claimed by any question)
  const unmatchedAnswers = answers
    .filter((a) => !usedAnswerIds.has(a.id))
    .map((a) => ({
      id: uuidv4(),
      questionNumber: a.originalQuestionNumber || a.normalizedQuestionNumber,
      text: a.text,
      regions: a.regions,
      confidence: a.confidence,
      reason: 'No matching question found in question paper',
    }));

  // Add explicitly unmatched regions from AI
  const allUnmatched = [
    ...unmatchedAnswers,
    ...unmatchedRegions.map((u) => ({
      id: uuidv4(),
      questionNumber: null,
      text: u.text,
      regions: u.regions,
      confidence: u.confidence,
      reason: 'Could not attribute to any question',
    })),
  ];

  // Summary statistics
  const summary = {
    totalQuestions: questions.length,
    answered: mappings.filter((m) => m.answerStatus === 'answered').length,
    unanswered: mappings.filter((m) => m.answerStatus === 'unanswered').length,
    ambiguous: mappings.filter((m) => m.answerStatus === 'ambiguous').length,
    unmatchedAnswers: allUnmatched.length,
  };

  return { mappings, unmatchedAnswers: allUnmatched, summary };
};

module.exports = { mapAnswersToQuestions };
