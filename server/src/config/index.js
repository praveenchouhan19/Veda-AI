require('dotenv').config();

const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/vedaai',
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
  enableGrading: process.env.ENABLE_GRADING !== 'false',
  // The free Gemini tier allows only 5 requests/minute, so keep this low.
  pageConcurrency: parseInt(process.env.PAGE_CONCURRENCY) || 2,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 20 * 1024 * 1024,
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
};

module.exports = config;
