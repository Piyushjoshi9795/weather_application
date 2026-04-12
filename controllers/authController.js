// controllers/authController.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Helper: generate short-lived access token (15 min)
const generateAccessToken = (user) => {
  return jwt.sign(
    { userId: user._id, username: user.username },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: '15m' }
  );
};

// Helper: generate long-lived refresh token (7 days)
const generateRefreshToken = (user) => {
  return jwt.sign(
    { userId: user._id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: '7d' }
  );
};

// ─── REGISTER ─────────────────────────────────────────────
const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered.' });
    }

    // Create user — password gets hashed automatically by the pre-save hook
    const user = await User.create({ username, email, password });

    res.status(201).json({ message: 'Account created successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// ─── LOGIN ────────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      // Note: don't say "email not found" — that leaks info about which emails exist
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // Generate both tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Save refresh token in DB (so we can revoke it on logout)
    user.refreshTokens.push(refreshToken);
    await user.save();

    // Send refresh token in an HttpOnly cookie
    // JavaScript on the frontend CANNOT read this — XSS proof
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
    });

    // Send access token in response body — frontend stores in memory
    res.json({
      accessToken,
      user: { id: user._id, username: user.username, email: user.email }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// ─── REFRESH TOKEN ────────────────────────────────────────
// Called automatically when access token expires
const refreshToken = async (req, res) => {
  try {
    // Read refresh token from HttpOnly cookie
    const token = req.cookies.refreshToken;
    if (!token) {
      return res.status(401).json({ message: 'No refresh token found.' });
    }

    // Verify the refresh token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    } catch {
      return res.status(403).json({ message: 'Invalid refresh token.' });
    }

    // Check if this token exists in DB (it might have been revoked on logout)
    const user = await User.findById(decoded.userId);
    if (!user || !user.refreshTokens.includes(token)) {
      return res.status(403).json({ message: 'Refresh token revoked.' });
    }

    // ROTATION: Delete old refresh token, issue a new one
    // This means if a refresh token is stolen, using it once invalidates it
    user.refreshTokens = user.refreshTokens.filter(t => t !== token);
    const newRefreshToken = generateRefreshToken(user);
    user.refreshTokens.push(newRefreshToken);
    await user.save();

    // Issue new access token
    const newAccessToken = generateAccessToken(user);

    // Set new refresh token cookie
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ accessToken: newAccessToken });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// ─── LOGOUT ───────────────────────────────────────────────
const logout = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (token) {
      // Remove this specific refresh token from DB
      // User stays logged in on other devices
      const decoded = jwt.decode(token); // decode without verify (just to get userId)
      if (decoded) {
        await User.findByIdAndUpdate(decoded.userId, {
          $pull: { refreshTokens: token }
        });
      }
    }

    // Clear the cookie
    res.clearCookie('refreshToken');
    res.json({ message: 'Logged out successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = { register, login, refreshToken, logout };