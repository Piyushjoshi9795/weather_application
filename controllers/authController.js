// controllers/authController.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { publishEvent } = require('../config/kafka');

// Helper: generate short-lived access token (15 min)
const generateAccessToken = (user) => {
  return jwt.sign(
    { userId: user._id, username: user.username },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: '15m' }
  );
};

// Helper: generate long-lived refresh token (7 days)
const generateRefreshToken = (user) => { // how new refresh tokens are generated. This function takes a user object and creates a JWT that contains the user's ID. The token is signed with a secret key and set to expire in 7 days. This refresh token is stored in the database and sent to the client in an HttpOnly cookie. When the client needs a new access token, it sends this refresh token back to the server for verification. If valid, the server issues a new access token and a new refresh token (rotation), and the old refresh token is deleted from the database to prevent reuse.
  // if it is using userid then how everytime new token is generated? because the payload is the same, so the signature will be the same, so how does it generate a new token? The token will be different every time because of the "iat" (issued at) timestamp that JWT automatically adds to the payload. Even if the userId is the same, the iat will be different for each token generated, resulting in a different signature. So every time you call generateRefreshToken, it creates a new token with a new iat, making it unique.
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
    const user = await User.create({ username, email, password }); // why we don't save after this? because .create() does both "new User()" and "save()" in one step
    // Publish event to Kafka — consumer will send welcome email
    // We do NOT await this — fire and forget, don't block the response
    publishEvent('user.registered', {
      email: user.email,
       username: user.username
    }).catch(err => console.error('Kafka publish failed:', err));

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

    const isMatch = await user.comparePassword(password); // this calls the method we defined in User model to compare hashed password
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // Generate both tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Publish login alert event
    publishEvent('user.loggedin', {
      email: user.email,
      username: user.username,
      timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    }).catch(err => console.error('Kafka publish failed:', err));

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
const refreshToken = async (req, res) => { // explain this function in detail. This is the heart of the refresh token flow. When the frontend gets a 403 (forbidden) response, it calls this endpoint to get a new access token. The refresh token is sent automatically in the HttpOnly cookie. The server verifies it, checks if it's still valid (not revoked), and if everything checks out, it issues a new access token and a new refresh token (rotation). The old refresh token is deleted from the database, so if someone stole it, they can only use it once before it becomes useless.
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
    user.refreshTokens = user.refreshTokens.filter(t => t !== token); // remove the old token
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