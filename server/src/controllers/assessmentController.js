const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');

const { extractQuestions } = require('../services/questionExtractor');
const { extractAnswers } = require('../services/answerExtractor');
const { mapAnswersToQuestions } = require('../services/mappingService');
const { gradeAnswers } = require('../services/ai/geminiService');
const { getPublicUrl } = require('../services/pdfService');
const demoData = require('../data/demo.json');
const config = require('../config');

// In-memory store when MongoDB is unavailable
const inMemoryStore = new Map();

const isMongoConnected = () => mongoose.connection.readyState === 1;

const saveAssessment = async (data) => {
  if (isMongoConnected()) {
    const Assessment = require('../models/Assessment');
    const doc = new Assessment(data);
    await doc.save();
    return doc;
  } else {
    inMemoryStore.set(data._id || data.id, data);
    return data;
  }
};

const updateAssessment = async (id, patch) => {
  const existing = inMemoryStore.get(id) || {};
  inMemoryStore.set(id, { ...existing, ...patch, updatedAt: new Date().toISOString() });

  if (isMongoConnected()) {
    const Assessment = require('../models/Assessment');
    await Assessment.findOneAndUpdate({ _id: id }, patch).catch(() => {});
  }
};

const findAssessment = async (id) => {
  if (isMongoConnected()) {
    const Assessment = require('../models/Assessment');
    return await Assessment.findOne({ _id: id }).lean();
  } else {
    return inMemoryStore.get(id) || null;
  }
};

const deleteAssessmentById = async (id) => {
  if (isMongoConnected()) {
    const Assessment = require('../models/Assessment');
    return await Assessment.findOneAndDelete({ _id: id });
  } else {
    return inMemoryStore.delete(id);
  }
};

/**
 * POST /api/analyze
 * Main pipeline: upload → extract questions → extract answers → map → return assessment
 */
const analyzeDocuments = async (req, res, next) => {
  const questionPaperFile = req.files?.questionPaper?.[0];
  const answerSheetFile = req.files?.answerSheet?.[0];

  if (!questionPaperFile || !answerSheetFile) {
    return res.status(400).json({
      success: false,
      error: { message: 'Both question paper and answer sheet are required.' },
    });
  }

  const assessmentId = uuidv4();
  const prefix = assessmentId.slice(0, 8);

  // Initial response with assessmentId (client can poll)
  const assessmentData = {
    _id: assessmentId,
    id: assessmentId,
    status: 'processing',
    questionPaper: {
      originalName: questionPaperFile.originalname,
      path: questionPaperFile.path,
      size: questionPaperFile.size,
      mimeType: questionPaperFile.mimetype,
    },
    answerSheet: {
      originalName: answerSheetFile.originalname,
      path: answerSheetFile.path,
      size: answerSheetFile.size,
      mimeType: answerSheetFile.mimetype,
    },
    createdAt: new Date().toISOString(),
    progress: { stage: 'reading', percent: 5, message: 'Reading your documents' },
  };

  await saveAssessment(assessmentData);

  // Run the pipeline asynchronously so we can send back the ID immediately
  processAssessmentAsync(assessmentId, questionPaperFile, answerSheetFile, prefix);

  res.status(202).json({
    success: true,
    assessmentId,
    message: 'Assessment started. Poll /api/assessment/:id for results.',
  });
};

const toPageManifest = (pages) =>
  (pages || []).map((p) => ({
    pageNumber: p.pageNumber,
    imageUrl: getPublicUrl(p.imagePath),
    width: p.width || null,
    height: p.height || null,
  }));

const processAssessmentAsync = async (assessmentId, questionPaperFile, answerSheetFile, prefix) => {
  try {
    // Progress is derived from real page counts so the UI reflects actual work.
    const counters = { qpDone: 0, qpTotal: 0, asDone: 0, asTotal: 0 };
    const reportProgress = async () => {
      const total = counters.qpTotal + counters.asTotal;
      const done = counters.qpDone + counters.asDone;
      const percent = total > 0 ? 10 + Math.round((done / total) * 70) : 10;
      await updateAssessment(assessmentId, {
        progress: {
          stage: 'extracting',
          percent,
          message: total > 0 ? `Extracting page ${Math.min(done + 1, total)} of ${total}` : 'Extracting',
        },
      });
    };

    console.log(`[${assessmentId}] Stage 1 & 2: Extracting questions & answers concurrently...`);
    const [questionResult, answerResult] = await Promise.all([
      extractQuestions(questionPaperFile.path, prefix, (done, total) => {
        counters.qpDone = done;
        counters.qpTotal = total;
        reportProgress();
      }),
      extractAnswers(answerSheetFile.path, prefix, (done, total) => {
        counters.asDone = done;
        counters.asTotal = total;
        reportProgress();
      }),
    ]);

    const { questions, pages: questionPages } = questionResult;
    const { answers, unmatchedRegions, pages: answerPages } = answerResult;

    if (questions.length === 0) {
      throw new Error(
        'No questions could be read from the question paper. Please check the file is a readable question paper.'
      );
    }

    // Stage 3: Map answers to questions
    console.log(`[${assessmentId}] Stage 3: Mapping...`);
    await updateAssessment(assessmentId, {
      progress: { stage: 'mapping', percent: 85, message: 'Mapping answers to questions' },
    });
    const { mappings, unmatchedAnswers, summary } = mapAnswersToQuestions(questions, answers, unmatchedRegions);

    // Stage 4: Grade the answers we found
    if (config.enableGrading) {
      console.log(`[${assessmentId}] Stage 4: Grading...`);
      await updateAssessment(assessmentId, {
        progress: { stage: 'grading', percent: 92, message: 'Evaluating answers' },
      });

      const gradable = mappings.filter((m) => m.answerText && m.answerStatus !== 'unanswered');
      const grades = await gradeAnswers(
        gradable.map((m) => ({
          id: m.id,
          questionText: m.questionText,
          answerText: m.answerText,
          maxMarks: m.maxMarks,
        }))
      );

      for (const mapping of mappings) {
        const grade = grades[mapping.id];
        if (grade) {
          mapping.grading = grade;
          mapping.maxMarks = grade.maxMarks;
        } else if (mapping.answerStatus === 'unanswered') {
          mapping.grading = {
            marksAwarded: 0,
            maxMarks: mapping.maxMarks || 5,
            status: 'incorrect',
            feedback: 'No answer was found for this question on the answer sheet.',
          };
        }
      }

      summary.totalMarks = mappings.reduce((sum, m) => sum + (m.grading?.maxMarks || 0), 0);
      summary.marksAwarded = mappings.reduce((sum, m) => sum + (m.grading?.marksAwarded || 0), 0);
    }

    const completed = {
      _id: assessmentId,
      id: assessmentId,
      status: 'complete',
      questions,
      answers,
      mappings,
      unmatchedAnswers,
      summary,
      questionPaperPages: toPageManifest(questionPages),
      answerSheetPages: toPageManifest(answerPages),
      progress: { stage: 'complete', percent: 100, message: 'Done' },
      updatedAt: new Date().toISOString(),
    };

    await updateAssessment(assessmentId, completed);

    console.log(`[${assessmentId}] ✅ Complete — ${summary.answered}/${summary.totalQuestions} answered`);
  } catch (err) {
    console.error(`[${assessmentId}] ❌ Pipeline error:`, err.message);
    await updateAssessment(assessmentId, {
      status: 'error',
      error: err.message,
      progress: { stage: 'error', percent: 100, message: err.message },
    });
  }
};

/**
 * GET /api/assessment/:id
 */
const getAssessment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const assessment = await findAssessment(id);

    if (!assessment) {
      return res.status(404).json({
        success: false,
        error: { message: 'Assessment not found' },
      });
    }

    res.json({ success: true, assessment });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/assessment/:id
 */
const deleteAssessment = async (req, res, next) => {
  try {
    const { id } = req.params;
    await deleteAssessmentById(id);
    res.json({ success: true, message: 'Assessment deleted' });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/demo
 * Returns the built-in demo assessment data
 */
const getDemoAssessment = (req, res) => {
  res.json({ success: true, assessment: demoData, isDemo: true });
};

module.exports = {
  analyzeDocuments,
  getAssessment,
  deleteAssessment,
  getDemoAssessment,
};
