const express = require('express');
const router = express.Router();

// Simple health/status route for uploads (actual upload is in assessment routes)
router.get('/upload/health', (req, res) => {
  res.json({ success: true, message: 'Upload service ready' });
});

module.exports = router;
