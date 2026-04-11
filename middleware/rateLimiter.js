// middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 100,                  // max 100 requests per window per IP
  standardHeaders: true,     // returns rate limit info in response headers
  //Sends rate limit info in modern HTTP headers 
  legacyHeaders: false,// Disables old headers like: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
  message: {
    status: 429,
    message: 'Too many requests. Please wait 15 minutes before trying again.'
  }
});

// Stricter limiter for auth routes (prevent brute force login)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // only 10 login attempts per 15 min
  message: {
    status: 429,
    message: 'Too many login attempts. Please wait before trying again.'
  }
});

module.exports = { apiLimiter, authLimiter };