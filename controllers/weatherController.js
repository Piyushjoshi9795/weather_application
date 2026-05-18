// controllers/weatherController.js
const axios = require('axios');
const { redisClient, isRedisReady } = require('../config/redis');

const getWeather = async (req, res) => {
  const { city } = req.params;

  if (!city || city.trim() === '') {
    return res.status(400).json({ message: 'City name is required.' });
  }

  const cacheKey = `weather:${city.toLowerCase()}`; 

  try {
    // ── Step 1: Try to check Redis cache first (if available) ──
    let cachedData = null;
    if (isRedisReady?.()) {
      try {
        cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
          console.log(`✅ Cache HIT for: ${city}`);
          return res.json({ source: 'cache', data: JSON.parse(cachedData) }); 
        }
        console.log(`⚠️  Cache MISS for: ${city} — fetching from API`);
      } catch (cacheErr) {
        console.warn(`⚠️  Redis get failed (continuing anyway): ${cacheErr.message}`);
        // Continue to fetch from API
      }
    } else {
      console.log(`⚠️  Redis not ready — fetching from API for: ${city}`);
    }

    // ── Step 2: Cache miss or Redis unavailable — call OpenWeatherMap ──
    if (!process.env.WEATHER_API_KEY) {
      return res.status(500).json({ message: 'Weather API key not configured on server.' });
    }

    const response = await axios.get(
      'https://api.openweathermap.org/data/2.5/weather',
      {
        params: {
          q: city,
          appid: process.env.WEATHER_API_KEY,
          units: 'metric' // Celsius
        },
        timeout: 5000 // fail after 5 seconds if API is slow
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

    // ── Step 3: Try to store in Redis for 10 minutes (if available) ─
    if (isRedisReady?.()) {
      try {
        await redisClient.set(cacheKey, JSON.stringify(weatherData), { EX: 600 });
        console.log(`✅ Cached: ${city}`);
      } catch (cacheErr) {
        console.warn(`⚠️  Redis set failed (continuing anyway): ${cacheErr.message}`);
        // Continue anyway - cache is optional
      }
    }

    return res.json({ source: 'api', data: weatherData });

  } catch (error) {
    // OpenWeatherMap returns 404 for invalid cities
    if (error.response?.status === 404) {
      return res.status(404).json({ message: `City "${city}" not found.` });
    }
    // API is down or timeout
    if (error.code === 'ECONNABORTED') {
      return res.status(503).json({ message: 'Weather service timed out. Try again.' });
    }
    console.error('Weather fetch error:', error.message);
    return res.status(500).json({ message: 'Failed to fetch weather.', error: error.message });
  }
};

module.exports = { getWeather };

// The cache flow explained:
//  First request for "London" → Redis has nothing → call OpenWeatherMap → store result in Redis for 10 min → return data. 
// Second request for "London" within 10 min → Redis returns instantly → no API call → faster response + fewer API credits used.