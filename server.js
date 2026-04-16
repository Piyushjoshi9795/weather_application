// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const { connectProducer } = require('./config/kafka');
const { startConsumer } = require('./services/kafkaConsumer');
const { startCronJobs } = require('./services/cronJobs');

const authRoutes = require('./routes/authRoutes');
const weatherRoutes = require('./routes/weatherRoutes');

const app = express();

// Connect everything
connectDB();

// Start Kafka producer, consumer, and cron jobs
// These are async but we don't await them at top level —
// they run in the background while the server starts
// If Kafka is unavailable, app continues running but won't process async events
connectProducer()
  .catch(err => console.warn('⚠️  Kafka producer unavailable:', err.message));

startConsumer()
  .catch(err => console.warn('⚠️  Kafka consumer unavailable:', err.message));

startCronJobs();

app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/weather', weatherRoutes);

// New route — save user's city for daily digest
app.post('/api/user/city', require('./middleware/auth').protect, async (req, res) => {
  try {
    const { city } = req.body;
    await require('./models/User').findByIdAndUpdate(
      req.user.userId,
      { savedCity: city },
      { new: true }
    );
    res.json({ message: `Daily digest set for ${city}` });
  } catch (err) {
    res.status(500).json({ message: 'Failed to save city' });
  }
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong.' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));