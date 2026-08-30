const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const {
  analyzeDocuments,
  getAssessment,
  deleteAssessment,
  getDemoAssessment,
} = require('../controllers/assessmentController');

// Analyze: accepts questionPaper + answerSheet multipart fields
router.post(
  '/analyze',
  upload.fields([
    { name: 'questionPaper', maxCount: 1 },
    { name: 'answerSheet', maxCount: 1 },
  ]),
  analyzeDocuments
);

// Get assessment by ID
router.get('/assessment/:id', getAssessment);

// Delete assessment
router.delete('/assessment/:id', deleteAssessment);

// Demo data
router.get('/demo', getDemoAssessment);

module.exports = router;
