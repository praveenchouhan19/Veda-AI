const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const config = require('./config');
const uploadRoutes = require('./routes/upload');
const assessmentRoutes = require('./routes/assessment');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();

// Security & logging
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));

// CORS — only the configured client origins may call the API.
const allowedOrigins = config.clientUrl
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Same-origin/server-to-server requests send no Origin header.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files (images rendered from PDFs)
app.use('/uploads', express.static(path.join(__dirname, '..', config.uploadDir)));

// Demo page images ship with the repo rather than living in the uploads dir
app.use('/uploads/demo', express.static(path.join(__dirname, 'data', 'demo')));

// Analysis is slow and costs money per call, so cap it per client.
app.use('/api/analyze', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many uploads. Please try again later.' } },
}));

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
