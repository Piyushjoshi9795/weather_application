// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { register, login, refreshToken, logout } = require('../controllers/authController');
const { authLimiter } = require('../middleware/rateLimiter');

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/refresh', refreshToken); // how it calls automatically when access token expires? The frontend is set up to detect a 403 (forbidden) response from any API call, which indicates that the access token has expired. When this happens, it automatically sends a request to the /refresh endpoint to get a new access token using the refresh token stored in the HttpOnly cookie. This process is seamless to the user, allowing them to stay logged in without interruption as long as they have a valid refresh token.
router.post('/logout', logout);

module.exports = router;