// middleware/auth.js
const jwt = require('jsonwebtoken');

// This function runs BEFORE your route handler
// It checks: "Does this request have a valid JWT?"
const protect = (req, res, next) => {
  // JWT is sent in the Authorization header like:
  // Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // get just the token part

  if (!token) {
    return res.status(401).json({ message: 'No token provided. Access denied.' });
  }

  try {
    // jwt.verify() does two things:
    // 1. Checks the signature (was this token really made by us?)
    // 2. Checks expiry (has it expired?)
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    // Attach user info to the request so route handlers can use it
    req.user = decoded; // { userId, username, iat, exp }
    next(); // pass control to the next middleware/route handler
  } catch (error) {
    // jwt.verify throws if token is invalid or expired
    return res.status(403).json({ message: 'Invalid or expired token.' });
  }
};

module.exports = { protect };