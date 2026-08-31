const { v4: uuidv4 } = require('uuid');
const geminiService = require('./ai/geminiService');
const { processFileToPages, getPublicUrl } = require('./pdfService');
const { normalizeQuestionNumber, buildDisplayLabel, compareQuestionNumbers } = require('../utils/normalizer');
const { isValidBoundingBox, clampBoundingBox } = require('../utils/boundingBox');
const { mapWithConcurrency } = require('../utils/concurrency');
const config = require('../config');

/**
 * Extract all questions from a question paper file.
 * Handles multi-page PDFs by processing each page independently.
 */
const extractQuestions = async (filePath, prefix, onProgress) => {
  const pages = await processFileToPages(filePath, `${prefix}_qp`);
  const pageErrors = [];
  let done = 0;

  const results = await mapWithConcurrency(pages, config.pageConcurrency, async (page) => {
    try {
      const pageQuestions = await geminiService.extractQuestionsFromPage(page.imagePath, page.pageNumber);
      return pageQuestions.map((q) => ({ ...q, imagePath: page.imagePath }));
    } catch (err) {
      console.error(`Error extracting questions from page ${page.pageNumber}:`, err.message);
      pageErrors.push(`page ${page.pageNumber}: ${err.message}`);
      return [];
    } finally {
      done += 1;
      if (onProgress) onProgress(done, pages.length);
    }
  });

  const allQuestions = results.flat();

  // Every page failed — surface the reason instead of silently returning nothing.
  if (allQuestions.length === 0 && pageErrors.length > 0) {
    throw new Error(`Could not read the question paper. ${pageErrors[0]}`);
  }

  const questions = allQuestions.map((q) => {
    const normalized = normalizeQuestionNumber(q.number);
    const bbox = isValidBoundingBox(q.boundingBox) ? clampBoundingBox(q.boundingBox) : null;

    return {
      id: uuidv4(),
      originalNumber: q.number,
      number: normalized,
      displayLabel: buildDisplayLabel(normalized),
      text: (q.text || '').trim(),
      subPart: q.subPart || null,
      maxMarks: q.maxMarks ?? null,
      pageNumber: q.pageNumber,
      boundingBox: bbox,
      imageUrl: q.imagePath ? getPublicUrl(q.imagePath) : null,
      order: 0,
    };
  });

  // Drop entries with no usable number or text, then de-duplicate across the
  // whole paper (a question repeated on two pages is one question).
  const seen = new Set();
  const deduped = questions.filter((q) => {
    if (!q.number || !q.text) return false;
    if (seen.has(q.number)) return false;
    seen.add(q.number);
    return true;
  });

  // Present questions in paper order (page first, then question number).
  deduped.sort((a, b) =>
    a.pageNumber !== b.pageNumber
      ? a.pageNumber - b.pageNumber
      : compareQuestionNumbers(a.number, b.number)
  );
  deduped.forEach((q, index) => {
    q.order = index;
  });

  return { questions: deduped, pages };
};

module.exports = { extractQuestions };
