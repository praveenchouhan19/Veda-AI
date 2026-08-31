const { v4: uuidv4 } = require('uuid');
const geminiService = require('./ai/geminiService');
const { processFileToPages, getPublicUrl } = require('./pdfService');
const { normalizeQuestionNumber } = require('../utils/normalizer');
const { clampBoundingBox } = require('../utils/boundingBox');
const { mapWithConcurrency } = require('../utils/concurrency');
const config = require('../config');

/**
 * Attach the page image URL and clamp the box into the unit square.
 */
const buildRegion = (region, imagePath) => ({
  pageNumber: region.pageNumber,
  ...clampBoundingBox(region),
  imageUrl: getPublicUrl(imagePath),
});

/**
 * Extract all answers from a student answer sheet file.
 * Returns arrays of detected answers and unmatched regions.
 */
const extractAnswers = async (filePath, prefix, onProgress) => {
  const pages = await processFileToPages(filePath, `${prefix}_as`);
  const pageErrors = [];
  let done = 0;

  const pageResults = await mapWithConcurrency(pages, config.pageConcurrency, async (page) => {
    try {
      const { answers, unmatched } = await geminiService.extractAnswersFromPage(
        page.imagePath,
        page.pageNumber
      );

      return {
        answers: answers.map((a) => ({
          ...a,
          regions: a.regions.map((r) => buildRegion(r, page.imagePath)),
        })),
        unmatched: unmatched.map((u) => ({
          ...u,
          regions: u.regions.map((r) => buildRegion(r, page.imagePath)),
        })),
      };
    } catch (err) {
      console.error(`Error extracting answers from page ${page.pageNumber}:`, err.message);
      pageErrors.push(`page ${page.pageNumber}: ${err.message}`);
      return { answers: [], unmatched: [] };
    } finally {
      done += 1;
      if (onProgress) onProgress(done, pages.length);
    }
  });

  const allAnswers = pageResults.flatMap((r) => r.answers);
  const allUnmatched = pageResults.flatMap((r) => r.unmatched);

  if (allAnswers.length === 0 && allUnmatched.length === 0 && pageErrors.length > 0) {
    throw new Error(`Could not read the answer sheet. ${pageErrors[0]}`);
  }

  // Merge in page order so continuations concatenate in the right sequence.
  const ordered = [...allAnswers].sort((a, b) => a.pageNumber - b.pageNumber);
  const answerMap = new Map();

  for (const answer of ordered) {
    const normalized = normalizeQuestionNumber(answer.questionNumber);
    if (!normalized) continue;

    const existing = answerMap.get(normalized);
    if (existing) {
      existing.regions = [...existing.regions, ...answer.regions];
      existing.text = `${existing.text}\n${answer.text}`.trim();
      // A continuation of an already-confident answer shouldn't drag it down.
      existing.confidence = Math.max(existing.confidence, answer.confidence);
      existing.isReadable = existing.isReadable || answer.isReadable;
      existing.pageCount = new Set(existing.regions.map((r) => r.pageNumber)).size;
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
        pageCount: 1,
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
