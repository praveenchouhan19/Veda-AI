const {
  normalizeQuestionNumber,
  parseQuestionNumber,
  questionNumbersMatch,
  buildDisplayLabel,
} = require('../src/utils/normalizer');

describe('normalizeQuestionNumber', () => {
  test('plain number', () => {
    expect(normalizeQuestionNumber('1')).toBe('1');
  });

  test('Q prefix', () => {
    expect(normalizeQuestionNumber('Q1')).toBe('1');
  });

  test('Question prefix', () => {
    expect(normalizeQuestionNumber('Question 1')).toBe('1');
  });

  test('Ans prefix', () => {
    expect(normalizeQuestionNumber('Ans 2')).toBe('2');
  });

  test('Answer prefix', () => {
    expect(normalizeQuestionNumber('Answer 3')).toBe('3');
  });

  test('trailing dot', () => {
    expect(normalizeQuestionNumber('2.')).toBe('2');
  });

  test('subpart with space and parens', () => {
    expect(normalizeQuestionNumber('11 (a)')).toBe('11a');
  });

  test('subpart without space', () => {
    expect(normalizeQuestionNumber('11(a)')).toBe('11a');
  });

  test('Q prefix with subpart', () => {
    expect(normalizeQuestionNumber('Q11(a)')).toBe('11a');
  });

  test('subpart with dash', () => {
    expect(normalizeQuestionNumber('11-a')).toBe('11a');
  });

  test('Question with subpart', () => {
    expect(normalizeQuestionNumber('Question 11(a)')).toBe('11a');
  });

  test('empty string', () => {
    expect(normalizeQuestionNumber('')).toBe('');
  });

  test('null/undefined', () => {
    expect(normalizeQuestionNumber(null)).toBe('');
  });
});

describe('parseQuestionNumber', () => {
  test('plain number', () => {
    expect(parseQuestionNumber('5')).toEqual({ base: '5', subPart: null });
  });

  test('with subpart', () => {
    expect(parseQuestionNumber('11a')).toEqual({ base: '11', subPart: 'a' });
  });

  test('multi-digit with subpart', () => {
    expect(parseQuestionNumber('23b')).toEqual({ base: '23', subPart: 'b' });
  });
});

describe('questionNumbersMatch', () => {
  test('exact match', () => {
    expect(questionNumbersMatch('1', '1')).toBe(true);
  });

  test('Q prefix vs plain', () => {
    expect(questionNumbersMatch('Q1', '1')).toBe(true);
  });

  test('different formats', () => {
    expect(questionNumbersMatch('11 (a)', '11(a)')).toBe(true);
  });

  test('no match', () => {
    expect(questionNumbersMatch('1', '2')).toBe(false);
  });

  test('subpart vs base', () => {
    expect(questionNumbersMatch('11a', '11b')).toBe(false);
  });
});

describe('buildDisplayLabel', () => {
  test('plain number', () => {
    expect(buildDisplayLabel('5')).toBe('Q5');
  });

  test('with subpart', () => {
    expect(buildDisplayLabel('11a')).toBe('Q11(A)');
  });
});
