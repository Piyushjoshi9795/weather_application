// controllers/weatherController.js
const axios = require('axios');
const redisClient = require('../config/redis');

const getWeather = async (req, res) => {
  const { city } = req.params;

  if (!city || city.trim() === '') {
    return res.status(400).json({ message: 'City name is required.' });
  }

  const cacheKey = `weather:${city.toLowerCase()}`;

  try {
    // ── Step 1: Check Redis cache first ──────────────────
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      console.log(`Cache HIT for: ${city}`);
      // Return cached data immediately — no API call needed
      return res.json({ source: 'cache', data: JSON.parse(cachedData) });
    }

    console.log(`Cache MISS for: ${city} — fetching from API`);

    // ── Step 2: Cache miss — call OpenWeatherMap ──────────
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

    // ── Step 3: Store in Redis for 10 minutes ─────────────
    // 'EX 600' means: expire this key after 600 seconds
    await redisClient.set(cacheKey, JSON.stringify(weatherData), { EX: 600 });

    res.json({ source: 'api', data: weatherData });

  } catch (error) {
    // OpenWeatherMap returns 404 for invalid cities
    if (error.response?.status === 404) {
      return res.status(404).json({ message: `City "${city}" not found.` });
    }
    // API is down or timeout
    if (error.code === 'ECONNABORTED') {
      return res.status(503).json({ message: 'Weather service timed out. Try again.' });
    }
    res.status(500).json({ message: 'Failed to fetch weather.', error: error.message });
  }
};

module.exports = { getWeather };