/**
 * Question number normalization utilities.
 * Ensures "Q1", "1", "Question 1", "Ans 1" all resolve to the same key.
 */

/**
 * Normalize a question number string to a canonical form.
 * Examples:
 *   "Q1" → "1"
 *   "Question 1" → "1"
 *   "11(a)" → "11a"
 *   "11 (a)" → "11a"
 *   "11-a" → "11a"
 *   "Ans 2" → "2"
 *   "2." → "2"
 */
const normalizeQuestionNumber = (raw) => {
  if (!raw) return '';

  let s = String(raw).trim().toLowerCase();

  // Remove common prefixes (order matters — longer first to avoid partial match)
  s = s.replace(/^(question|answer|ans|no\.?|num\.?|q)\s*/i, '');

  // Remove trailing dot
  s = s.replace(/\.$/, '');

  // Normalize sub-part separators: "11 (a)" → "11(a)", "11-a" → "11(a)"
  s = s.replace(/\s*\(\s*([a-z])\s*\)/g, '$1'); // "11 (a)" → "11a"
  s = s.replace(/\s*-\s*([a-z])$/g, '$1');        // "11-a" → "11a"
  s = s.replace(/\s+/g, '');                        // remove remaining spaces

  return s;
};

/**
 * Parse a question string into { base, subPart }.
 * e.g. "11a" → { base: "11", subPart: "a" }
 *      "5"   → { base: "5",  subPart: null }
 */
const parseQuestionNumber = (normalized) => {
  const match = normalized.match(/^(\d+)([a-z]?)$/);
  if (match) {
    return {
      base: match[1],
      subPart: match[2] || null,
    };
  }
  return { base: normalized, subPart: null };
};

/**
 * Check if two normalized question numbers match.
 */
const questionNumbersMatch = (a, b) => {
  return normalizeQuestionNumber(a) === normalizeQuestionNumber(b);
};

/**
 * Build a display label from a normalized number.
 * "11a" → "Q11(a)"
 * "5"   → "Q5"
 */
const buildDisplayLabel = (normalized) => {
  const { base, subPart } = parseQuestionNumber(normalized);
  if (subPart) return `Q${base}(${subPart.toUpperCase()})`;
  return `Q${base}`;
};

module.exports = {
  normalizeQuestionNumber,
  parseQuestionNumber,
  questionNumbersMatch,
  buildDisplayLabel,
};
