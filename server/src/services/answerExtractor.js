const { v4: uuidv4 } = require('uuid');
const geminiService = require('./ai/geminiService');
const { processFileToPages, getPublicUrl } = require('./pdfService');
const { normalizeQuestionNumber } = require('../utils/normalizer');
const { isValidBoundingBox, clampBoundingBox } = require('../utils/boundingBox');

/**
 * Extract all answers from a student answer sheet file.
 * Returns arrays of detected answers and unmatched regions.
 */
const extractAnswers = async (filePath, prefix) => {
  const pages = await processFileToPages(filePath, `${prefix}_as`);
  const allAnswers = [];
  const allUnmatched = [];

  const pagePromises = pages.map(async ({ imagePath, pageNumber }) => {
    try {
      const { answers, unmatched } = await geminiService.extractAnswersFromPage(imagePath, pageNumber);

      const answersWithUrls = answers.map((a) => ({
        ...a,
        regions: a.regions.map((r) => ({
          ...r,
          imageUrl: getPublicUrl(imagePath),
          x: isValidBoundingBox(r) ? clampBoundingBox(r).x : (r.x || 0),
          y: isValidBoundingBox(r) ? clampBoundingBox(r).y : (r.y || 0),
          width: isValidBoundingBox(r) ? clampBoundingBox(r).width : (r.width || 0.9),
          height: isValidBoundingBox(r) ? clampBoundingBox(r).height : (r.height || 0.1),
        })),
      }));

      const unmatchedWithUrls = unmatched.map((u) => ({
        ...u,
        regions: u.regions.map((r) => ({
          ...r,
          imageUrl: getPublicUrl(imagePath),
        })),
      }));

      return { answers: answersWithUrls, unmatched: unmatchedWithUrls };
    } catch (err) {
      console.error(`Error extracting answers from page ${pageNumber}:`, err.message);
      return { answers: [], unmatched: [] };
    }
  });

  const pageResults = await Promise.all(pagePromises);
  pageResults.forEach(({ answers, unmatched }) => {
    allAnswers.push(...answers);
    allUnmatched.push(...unmatched);
  });

  // Normalize question numbers and merge multi-page answers for same question
  const answerMap = new Map();

  for (const answer of allAnswers) {
    const normalized = normalizeQuestionNumber(answer.questionNumber);
    if (!normalized) continue;

    if (answerMap.has(normalized)) {
      // Merge regions (multi-page answer)
      const existing = answerMap.get(normalized);
      existing.regions = [...existing.regions, ...answer.regions];
      existing.text = existing.text + '\n[Continued]\n' + answer.text;
      // Keep the higher confidence
      existing.confidence = Math.max(existing.confidence, answer.confidence);
    } else {
      answerMap.set(normalized, {
        id: uuidv4(),
        normalizedQuestionNumber: normalized,
        originalQuestionNumber: answer.questionNumber,
        text: answer.text,
        confidence: answer.confidence,
        regions: answer.regions,
        isReadable: answer.isReadable,
        notes: answer.notes,
      });
    }
  }

  return {
    answers: Array.from(answerMap.values()),
    unmatchedRegions: allUnmatched,
    pages,
  };
};

module.exports = { extractAnswers };
