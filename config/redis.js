const {createClient}= require('redis');

const redisClient= createClient({
    url: process.env.REDIS_URL
});

redisClient.on('error', (err) => console.error('Redis error:', err));
redisClient.on('connect', () => console.log('Redis connected'));

// Connect when this file is first imported
redisClient.connect();

module.exports = redisClient;

// What is Redis? 
// Think of Redis as a super-fast in-memory dictionary. 
// set('key', 'value') stores data, get('key') retrieves it. 
// It's 10-100x faster than hitting a database because it lives in RAM, not on disk. 
// We use it to cache weather responses so we don't call OpenWeatherMap every single time someone searches "London".