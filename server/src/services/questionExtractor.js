const { v4: uuidv4 } = require('uuid');
const geminiService = require('./ai/geminiService');
const { processFileToPages, getPublicUrl } = require('./pdfService');
const { normalizeQuestionNumber, buildDisplayLabel } = require('../utils/normalizer');
const { isValidBoundingBox, clampBoundingBox } = require('../utils/boundingBox');

/**
 * Extract all questions from a question paper file.
 * Handles multi-page PDFs by processing each page independently.
 */
const extractQuestions = async (filePath, prefix) => {
  const pages = await processFileToPages(filePath, `${prefix}_qp`);
  const allQuestions = [];

  const pagePromises = pages.map(async ({ imagePath, pageNumber }) => {
    try {
      const pageQuestions = await geminiService.extractQuestionsFromPage(imagePath, pageNumber);
      return pageQuestions.map((q) => ({ ...q, imagePath }));
    } catch (err) {
      console.error(`Error extracting questions from page ${pageNumber}:`, err.message);
      return [];
    }
  });

  const results = await Promise.all(pagePromises);
  results.forEach((pageQuestions) => allQuestions.push(...pageQuestions));

  // Build structured question objects with IDs and normalized numbers
  const questions = allQuestions.map((q, index) => {
    const normalized = normalizeQuestionNumber(q.number);
    const bbox = isValidBoundingBox(q.boundingBox) ? clampBoundingBox(q.boundingBox) : null;

    return {
      id: uuidv4(),
      originalNumber: q.number,
      number: normalized,
      displayLabel: buildDisplayLabel(normalized),
      text: (q.text || '').trim(),
      subPart: q.subPart || null,
      pageNumber: q.pageNumber,
      boundingBox: bbox,
      imageUrl: q.imagePath ? getPublicUrl(q.imagePath) : null,
      order: index,
    };
  });

  // Deduplicate (same normalized number shouldn't appear twice from same page)
  const seen = new Set();
  const deduped = questions.filter((q) => {
    const key = `${q.number}_p${q.pageNumber}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { questions: deduped, pages };
};

module.exports = { extractQuestions };
