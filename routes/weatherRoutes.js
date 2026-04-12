// routes/weatherRoutes.js
const express = require('express');
const router = express.Router();
const { getWeather } = require('../controllers/weatherController');
const { protect } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

// protect runs first (checks JWT), then apiLimiter, then getWeather
router.get('/:city', protect, apiLimiter, getWeather);

module.exports = router;