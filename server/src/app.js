const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const config = require('./config');
const uploadRoutes = require('./routes/upload');
const assessmentRoutes = require('./routes/assessment');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();

// Security & logging
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));

// CORS — allow requests from any client origin (localhost, Render, Vercel)
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files (images rendered from PDFs)
app.use('/uploads', express.static(path.join(__dirname, '..', config.uploadDir)));

// Routes
app.use('/api', uploadRoutes);
app.use('/api', assessmentRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 + error handler
app.use(notFound);
app.use(errorHandler);

module.exports = app;
