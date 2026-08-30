const app = require('./app');
const mongoose = require('mongoose');
const config = require('./config');

const startServer = async () => {
  // Try MongoDB connection (non-blocking — app works without it)
  if (config.mongodbUri) {
    try {
      await mongoose.connect(config.mongodbUri, { serverSelectionTimeoutMS: 3000 });
      console.log('✅ MongoDB connected');
    } catch (err) {
      console.warn('⚠️  MongoDB not available, running in memory-only mode');
    }
  }

  app.listen(config.port, () => {
    console.log(`🚀 VedaAI Server running on port ${config.port}`);
    console.log(`   Environment: ${config.nodeEnv}`);
    console.log(`   Client URL:  ${config.clientUrl}`);
    if (!config.geminiApiKey) {
      console.warn('⚠️  GEMINI_API_KEY not set — AI features will use demo mode');
    }
  });
};

startServer();
