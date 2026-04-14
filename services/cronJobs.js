// services/cronJobs.js
const cron = require('node-cron');
const User = require('../models/User');
const axios = require('axios');
const { publishEvent } = require('../config/kafka');
const redisClient = require('../config/redis');

// ── Cron syntax quick guide ───────────────────────────────
// ┌─── second (optional)
// │ ┌─── minute
// │ │ ┌─── hour
// │ │ │ ┌─── day of month
// │ │ │ │ ┌─── month
// │ │ │ │ │ ┌─── day of week (0=Sunday)
// │ │ │ │ │ │
// * * * * * *

const startCronJobs = () => {

  // ── JOB 1: Daily weather digest ────────────────────────
  // Runs every day at 8:00 AM IST
  // '0 8 * * *' = at minute 0, hour 8, every day
  cron.schedule('0 8 * * *', async () => {
    console.log('⏰ Cron: Running daily weather digest...');
    try {
      // Find all users who have a saved city and opted into digest
      const users = await User.find({
        savedCity: { $ne: null },
        digestEnabled: true
      });

      console.log(`Sending digest to ${users.length} users`);

      for (const user of users) {
        try {
          // Fetch fresh weather for this user's city
          const response = await axios.get(
            'https://api.openweathermap.org/data/2.5/weather',
            {
              params: {
                q: user.savedCity,
                appid: process.env.WEATHER_API_KEY,
                units: 'metric'
              }
            }
          );

          const weatherData = {
            temperature: response.data.main.temp,
            feelsLike: response.data.main.feels_like,
            humidity: response.data.main.humidity,
            description: response.data.weather[0].description,
            windSpeed: response.data.wind.speed
          };

          // Publish to Kafka — consumer sends the email
          await publishEvent('weather.digest', {
            email: user.email,
            username: user.username,
            city: user.savedCity,
            weatherData
          });

        } catch (err) {
          // If one user fails, don't stop the rest
          console.error(`Digest failed for ${user.email}:`, err.message);
        }
      }
    } catch (err) {
      console.error('Digest cron error:', err.message);
    }
  }, {
    timezone: 'Asia/Kolkata'   // runs at 8 AM IST specifically
  });


  // ── JOB 2: Clean expired refresh tokens ────────────────
  // Runs every day at midnight
  // Why: users accumulate refresh tokens (one per device/login)
  // Expired ones waste space in MongoDB — clean them up nightly
  cron.schedule('0 0 * * *', async () => {
    console.log('⏰ Cron: Cleaning expired refresh tokens...');
    try {
      const users = await User.find({ refreshTokens: { $not: { $size: 0 } } });
      const jwt = require('jsonwebtoken');
      let cleaned = 0;

      for (const user of users) {
        const validTokens = user.refreshTokens.filter(token => {
          try {
            jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
            return true;  // token still valid — keep it
          } catch {
            cleaned++;
            return false; // token expired — remove it
          }
        });

        if (validTokens.length !== user.refreshTokens.length) {
          user.refreshTokens = validTokens;
          await user.save();
        }
      }

      console.log(`Cleaned ${cleaned} expired refresh tokens`);
    } catch (err) {
      console.error('Token cleanup cron error:', err.message);
    }
  });


  // ── JOB 3: Cache warming for popular cities ─────────────
  // Runs every 9 minutes (just before 10 min cache expires)
  // Pre-fetches weather for top cities so users always get cache hits
  cron.schedule('*/9 * * * *', async () => { // explain what this cron job does. This cron job runs every 9 minutes and is responsible for warming the Redis cache with fresh weather data for a list of popular cities. Since our weather data in Redis expires after 10 minutes, running this job every 9 minutes ensures that the cache is always populated with up-to-date weather information for these cities. This way, when users request weather data for these popular cities, they get a cache hit and receive the data much faster without having to wait for an API call to OpenWeatherMap. 
    const popularCities = ['Delhi', 'Mumbai', 'London', 'New York', 'Tokyo', 'Paris'];
    console.log('⏰ Cron: Warming cache for popular cities...');

    for (const city of popularCities) {
      try {
        const response = await axios.get(
          'https://api.openweathermap.org/data/2.5/weather',
          {
            params: { q: city, appid: process.env.WEATHER_API_KEY, units: 'metric' }
          }
        );

        const weatherData = {
          city: response.data.name,
          country: response.data.sys.country,
          temperature: response.data.main.temp,
          feelsLike: response.data.main.feels_like,
          humidity: response.data.main.humidity,
          description: response.data.weather[0].description,
          icon: response.data.weather[0].icon,
          windSpeed: response.data.wind.speed,
          fetchedAt: new Date().toISOString()
        };

        await redisClient.set(
          `weather:${city.toLowerCase()}`,
          JSON.stringify(weatherData),
          { EX: 600 }
        );

        console.log(`Cache warmed: ${city}`);
      } catch (err) {
        console.error(`Cache warm failed for ${city}:`, err.message);
      }
    }
  });

  console.log('✅ All cron jobs scheduled');
};

module.exports = { startCronJobs };