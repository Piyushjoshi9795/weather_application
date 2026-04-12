// server.js
require('dotenv').config(); // must be first — loads .env variables
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');

// Import routes
const authRoutes = require('./routes/authRoutes');
const weatherRoutes = require('./routes/weatherRoutes');

const app = express();

// Connect to MongoDB
connectDB();

// ── Middleware (runs on every request) ───────────────────
app.use(cors({
  origin: 'http://localhost:3000', // only allow your React app
  credentials: true                // allow cookies to be sent/received
}));
app.use(express.json());       // parse JSON request bodies
app.use(cookieParser());       // parse cookies

// ── Routes ───────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/weather', weatherRoutes);

// ── Global error handler ─────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong on the server.' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));