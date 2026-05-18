// services/kafkaConsumer.js

let consumer;
let sendEmail;
let isKafkaAvailable = false;

try {
  const kafkaConfig = require('../config/kafka');
  consumer = kafkaConfig.consumer;
  isKafkaAvailable = kafkaConfig.isKafkaReady?.();
} catch (err) {
  console.warn('⚠️  Failed to load kafka consumer:', err.message);
  console.warn('⚠️  Kafka events will be skipped');
}

try {
  ({ sendEmail } = require('../config/mailer'));
} catch (err) {
  console.error('Failed to load mailer:', err.message);
  throw err;
}

// Topics this consumer cares about
const TOPICS = ['user.registered', 'user.loggedin', 'weather.digest'];

const startConsumer = async () => {
  // Skip if Kafka is not available
  if (!consumer || !isKafkaAvailable) {
    console.warn('⚠️  Kafka consumer not available - skipping consumer startup');
    console.warn('⚠️  Email notifications will not work. Set KAFKA_BROKER to enable.');
    return;
  }

  try {
    await consumer.connect();
    console.log('✅ Kafka consumer connected');

    // Subscribe to all our topics
    // fromBeginning: false = only process NEW messages (not old ones from before we started)
    await consumer.subscribe({ topics: TOPICS, fromBeginning: false });

    // eachMessage runs every time a new message arrives on any subscribed topic
    await consumer.run({
      eachMessage: async ({ topic, message }) => {
        try {
          // Kafka messages are Buffers — convert to string, then parse JSON
          const data = JSON.parse(message.value.toString());
          console.log(`✅ Kafka received on [${topic}]:`, data);

        // Route to the right email based on topic
        switch (topic) {

          case 'user.registered':
            // data = { email, username }
            await sendEmail(data.email, 'welcome', data.username);
            break;

          case 'user.loggedin':
            // data = { email, username, timestamp }
            await sendEmail(data.email, 'loginAlert', data.username, data.timestamp);
            break;

          case 'weather.digest':
            // data = { email, username, city, weatherData }
            await sendEmail(data.email, 'weatherDigest', data.username, data.city, data.weatherData);
            break;

          default:
            console.warn(`No handler for topic: ${topic}`);
        }
        } catch (processingErr) {
          console.error(`⚠️  Error processing Kafka message:`, processingErr.message);
          // Don't crash the consumer - just log and continue
        }
      }
    });
  } catch (err) {
    console.warn('⚠️  Kafka consumer error:', err.message);
    console.warn('⚠️  Continuing without Kafka consumer. Email notifications may not work.');
  }
};

module.exports = { startConsumer };

// Why a separate consumer service? 
// The auth controller doesn't care whether the email was sent — it just publishes the event and moves on. 
// The consumer handles it independently.
//  If your email service is slow or down, it doesn't slow down your login API. This is called decoupling.