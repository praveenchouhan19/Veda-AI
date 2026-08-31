const mongoose = require('mongoose');

const regionSchema = new mongoose.Schema({
  pageNumber: { type: Number, required: true },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  imageUrl: { type: String },
}, { _id: false });

const pageSchema = new mongoose.Schema({
  pageNumber: { type: Number, required: true },
  imageUrl: { type: String },
  width: { type: Number },
  height: { type: Number },
}, { _id: false });

const mappingSchema = new mongoose.Schema({
  id: { type: String, required: true },
  questionId: { type: String },
  questionNumber: { type: String },
  questionDisplayLabel: { type: String },
  questionText: { type: String },
  questionPageNumber: { type: Number },
  questionBoundingBox: {
    x: Number, y: Number, width: Number, height: Number,
  },
  maxMarks: { type: Number },
  order: { type: Number },
  answerStatus: {
    type: String,
    enum: ['answered', 'unanswered', 'ambiguous', 'unmatched'],
    default: 'unanswered',
  },
  answerId: { type: String },
  answerText: { type: String },
  answerRegions: [regionSchema],
  confidence: { type: Number, default: 0 },
  isReadable: { type: Boolean, default: true },
  matchType: { type: String },
  notes: { type: String },
  grading: {
    marksAwarded: Number,
    maxMarks: Number,
    status: String,
    feedback: String,
  },
}, { _id: false });

const assessmentSchema = new mongoose.Schema({
  _id: { type: String }, // Use UUID strings instead of MongoDB ObjectId
  questionPaper: {
    originalName: String,
    path: String,
    size: Number,
    mimeType: String,
  },
  answerSheet: {
    originalName: String,
    path: String,
    size: Number,
    mimeType: String,
  },
  questions: [mongoose.Schema.Types.Mixed],
  answers: [mongoose.Schema.Types.Mixed],
  mappings: [mappingSchema],
  unmatchedAnswers: [mongoose.Schema.Types.Mixed],
  questionPaperPages: [pageSchema],
  answerSheetPages: [pageSchema],
  summary: {
    totalQuestions: Number,
    answered: Number,
    unanswered: Number,
    ambiguous: Number,
    unmatchedAnswers: Number,
    totalMarks: Number,
    marksAwarded: Number,
  },
  progress: {
    stage: String,
    percent: Number,
    message: String,
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'complete', 'error'],
    default: 'pending',
  },
  error: { type: String },
  isDemo: { type: Boolean, default: false },
}, {
  timestamps: true,
});

// Gracefully handle missing MongoDB
let Assessment;
try {
  Assessment = mongoose.model('Assessment', assessmentSchema);
} catch {
  Assessment = mongoose.model('Assessment');
}

module.exports = Assessment;
