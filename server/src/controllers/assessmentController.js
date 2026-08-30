const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');

const { extractQuestions } = require('../services/questionExtractor');
const { extractAnswers } = require('../services/answerExtractor');
const { mapAnswersToQuestions } = require('../services/mappingService');
const { gradeAnswer } = require('../services/ai/geminiService');
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

const processAssessmentAsync = async (assessmentId, questionPaperFile, answerSheetFile, prefix) => {
  try {
    console.log(`[${assessmentId}] Stage 1 & 2: Extracting questions & answers concurrently...`);
    const [questionResult, answerResult] = await Promise.all([
      extractQuestions(questionPaperFile.path, prefix),
      extractAnswers(answerSheetFile.path, prefix),
    ]);

    const { questions } = questionResult;
    const { answers, unmatchedRegions } = answerResult;

    // Stage 3: Map answers to questions
    console.log(`[${assessmentId}] Stage 3: Mapping...`);
    const { mappings, unmatchedAnswers, summary } = mapAnswersToQuestions(questions, answers, unmatchedRegions);

    const completed = {
      _id: assessmentId,
      id: assessmentId,
      status: 'complete',
      questions,
      answers,
      mappings,
      unmatchedAnswers,
      summary,
      updatedAt: new Date().toISOString(),
    };

    // Update stored assessment
    if (isMongoConnected()) {
      const Assessment = require('../models/Assessment');
      await Assessment.findOneAndUpdate({ _id: assessmentId }, completed);
    } else {
      const existing = inMemoryStore.get(assessmentId);
      inMemoryStore.set(assessmentId, { ...existing, ...completed });
    }

    console.log(`[${assessmentId}] ✅ Complete — ${summary.answered}/${summary.totalQuestions} answered`);
  } catch (err) {
    console.error(`[${assessmentId}] ❌ Pipeline error:`, err.message);
    const existing = inMemoryStore.get(assessmentId) || {};
    const errData = { ...existing, status: 'error', error: err.message, updatedAt: new Date().toISOString() };

    if (isMongoConnected()) {
      const Assessment = require('../models/Assessment');
      await Assessment.findOneAndUpdate({ _id: assessmentId }, errData).catch(() => {});
    } else {
      inMemoryStore.set(assessmentId, errData);
    }
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
