const {createClient}= require('redis');

let redisClient;
let isRedisReady = false;

// Only initialize Redis if URL is configured and not localhost
if (process.env.REDIS_URL && process.env.REDIS_URL !== 'redis://localhost:6379') {
    redisClient = createClient({ 
        url: process.env.REDIS_URL,
        socket: { reconnectStrategy: retries => Math.min(retries * 50, 500) }
    });

    redisClient.on('error', (err) => console.warn('⚠️  Redis error:', err.message)); 
    redisClient.on('connect', () => {
        console.log('✅ Redis connected');
        isRedisReady = true;
    });
    redisClient.on('ready', () => {
        console.log('✅ Redis ready');
        isRedisReady = true;
    });

    // Connect when this file is first imported
    redisClient.connect().catch(err => {
        console.warn('⚠️  Failed to connect to Redis:', err.message);
        console.warn('⚠️  Caching disabled - weather requests will fetch from API every time');
        isRedisReady = false;
    });
} else {
    // Fallback: create a dummy Redis client that always fails gracefully
    console.warn('⚠️  REDIS_URL not configured or using localhost. Caching disabled.');
    redisClient = {
        get: async () => null,
        set: async () => true,
        connect: async () => {},
        on: () => {}
    };
    isRedisReady = false;
}

module.exports = { redisClient, isRedisReady: () => isRedisReady };

// What is Redis? 
// Think of Redis as a super-fast in-memory dictionary. 
// set('key', 'value') stores data, get('key') retrieves it. 
// It's 10-100x faster than hitting a database because it lives in RAM, not on disk. 
// We use it to cache weather responses so we don't call OpenWeatherMap every single time someone searches "London".