const { mapAnswersToQuestions } = require('../src/services/mappingService');

// Helper to build a question
const q = (id, number, displayLabel, text) => ({
  id, number, displayLabel, text, pageNumber: 1, boundingBox: null, subPart: null,
});

// Helper to build an answer
const a = (id, normalizedQNum, originalQNum, text, confidence = 0.9) => ({
  id, normalizedQuestionNumber: normalizedQNum, originalQuestionNumber: originalQNum,
  text, confidence, regions: [{ pageNumber: 1, x: 0.1, y: 0.1, width: 0.8, height: 0.2 }],
  isReadable: true, notes: '',
});

describe('mapAnswersToQuestions', () => {
  test('basic in-order mapping', () => {
    const questions = [q('q1', '1', 'Q1', 'Q1 text'), q('q2', '2', 'Q2', 'Q2 text')];
    const answers = [a('a1', '1', '1', 'Answer 1'), a('a2', '2', '2', 'Answer 2')];
    const { mappings, summary } = mapAnswersToQuestions(questions, answers);
    expect(mappings[0].answerStatus).toBe('answered');
    expect(mappings[1].answerStatus).toBe('answered');
    expect(summary.answered).toBe(2);
    expect(summary.unanswered).toBe(0);
  });

  test('out-of-order answers are correctly mapped', () => {
    const questions = [
      q('q1', '1', 'Q1', 'What is React?'),
      q('q2', '2', 'Q2', 'What is Node?'),
      q('q3', '3', 'Q3', 'What is MongoDB?'),
    ];
    // Student answered Q3, Q1, Q2 in that order
    const answers = [
      a('a3', '3', 'Q3', 'MongoDB answer'),
      a('a1', '1', 'Q1', 'React answer'),
      a('a2', '2', 'Q2', 'Node answer'),
    ];
    const { mappings } = mapAnswersToQuestions(questions, answers);
    expect(mappings[0].questionNumber).toBe('1');
    expect(mappings[0].answerText).toBe('React answer');
    expect(mappings[1].questionNumber).toBe('2');
    expect(mappings[1].answerText).toBe('Node answer');
    expect(mappings[2].questionNumber).toBe('3');
    expect(mappings[2].answerText).toBe('MongoDB answer');
  });

  test('unanswered question marked correctly', () => {
    const questions = [
      q('q1', '1', 'Q1', 'Q1'),
      q('q2', '2', 'Q2', 'Q2'),
      q('q3', '3', 'Q3', 'Q3'),
    ];
    const answers = [a('a1', '1', '1', 'Answer 1'), a('a3', '3', '3', 'Answer 3')];
    const { mappings, summary } = mapAnswersToQuestions(questions, answers);
    const q2Mapping = mappings.find((m) => m.questionNumber === '2');
    expect(q2Mapping.answerStatus).toBe('unanswered');
    expect(q2Mapping.answerText).toBeNull();
    expect(summary.unanswered).toBe(1);
    expect(summary.answered).toBe(2);
  });

  test('unmatched answers captured', () => {
    const questions = [q('q1', '1', 'Q1', 'Q1')];
    const answers = [
      a('a1', '1', '1', 'Answer 1'),
      a('a99', '99', '99', 'Extra answer no question'),
    ];
    const { unmatchedAnswers, summary } = mapAnswersToQuestions(questions, answers);
    expect(unmatchedAnswers.length).toBe(1);
    expect(unmatchedAnswers[0].questionNumber).toBe('99');
    expect(summary.unmatchedAnswers).toBe(1);
  });

  test('low confidence answer marked ambiguous', () => {
    const questions = [q('q1', '1', 'Q1', 'Q1')];
    const answers = [a('a1', '1', '1', 'Unclear answer', 0.5)];
    const { mappings } = mapAnswersToQuestions(questions, answers);
    expect(mappings[0].answerStatus).toBe('ambiguous');
    expect(mappings[0].confidence).toBe(0.5);
  });

  test('multi-page answer regions preserved', () => {
    const questions = [q('q4', '4', 'Q4', 'Long answer question')];
    const answers = [{
      id: 'a4',
      normalizedQuestionNumber: '4',
      originalQuestionNumber: '4',
      text: 'Page 1 content\n[Continued]\nPage 2 content',
      confidence: 0.88,
      regions: [
        { pageNumber: 1, x: 0.1, y: 0.1, width: 0.8, height: 0.3 },
        { pageNumber: 2, x: 0.1, y: 0.1, width: 0.8, height: 0.2 },
      ],
      isReadable: true,
      notes: '',
    }];
    const { mappings } = mapAnswersToQuestions(questions, answers);
    expect(mappings[0].answerRegions.length).toBe(2);
    expect(mappings[0].answerRegions[0].pageNumber).toBe(1);
    expect(mappings[0].answerRegions[1].pageNumber).toBe(2);
  });

  test('subpart question matches subpart answer', () => {
    const questions = [q('q11a', '11a', 'Q11(A)', 'Sub-part A question')];
    const answers = [a('a11a', '11a', '11(a)', 'Sub-part A answer')];
    const { mappings } = mapAnswersToQuestions(questions, answers);
    expect(mappings[0].answerStatus).toBe('answered');
  });

  test('empty inputs produce empty results', () => {
    const { mappings, unmatchedAnswers, summary } = mapAnswersToQuestions([], []);
    expect(mappings).toHaveLength(0);
    expect(unmatchedAnswers).toHaveLength(0);
    expect(summary.totalQuestions).toBe(0);
  });
});
