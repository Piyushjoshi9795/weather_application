// config/kafka.js
const { Kafka } = require('kafkajs');

let producer;
let consumer;
let isKafkaReady = false;

// Only initialize Kafka if broker is configured and not localhost
if (process.env.KAFKA_BROKER && process.env.KAFKA_BROKER !== 'localhost:9092') {
  try {
    const kafka = new Kafka({
      clientId: 'weather-app',
      brokers: [process.env.KAFKA_BROKER],
      retry: {
        initialRetryTime: 300,
        retries: 5
      }
    });

    producer = kafka.producer();
    consumer = kafka.consumer({ groupId: 'email-service' });

    // Producer connect with timeout
    const connectProducer = async () => {
      try {
        await producer.connect();
        isKafkaReady = true;
        console.log('✅ Kafka producer connected');
      } catch (err) {
        console.warn('⚠️  Kafka producer connection failed:', err.message);
        console.warn('⚠️  Async events (emails) disabled - Kafka not available');
        isKafkaReady = false;
      }
    };

    // Send a message to a topic
    const publishEvent = async (topic, message) => {
      if (!isKafkaReady) {
        console.warn(`⚠️  Kafka not ready - skipping event: ${topic}`);
        return;
      }
      try {
        await producer.send({
          topic,
          messages: [{ value: JSON.stringify(message) }]
        });
        console.log(`✅ Event published to topic: ${topic}`, message);
      } catch (err) {
        console.warn(`⚠️  Failed to publish event: ${err.message}`);
      }
    };

    module.exports = { producer, consumer, connectProducer, publishEvent, isKafkaReady: () => isKafkaReady };
  } catch (err) {
    console.warn('⚠️  Kafka initialization failed:', err.message);
    throw err;
  }
} else {
  console.warn('⚠️  KAFKA_BROKER not configured or using localhost. Async events disabled.');
  
  // Dummy implementations that do nothing
  producer = null;
  consumer = null;
  isKafkaReady = false;
  
  const connectProducer = async () => {
    console.warn('⚠️  Kafka not configured - skipping producer connection');
  };
  
  const publishEvent = async (topic, message) => {
    console.warn(`⚠️  Kafka not configured - skipping event: ${topic}`);
  };

  module.exports = { producer, consumer, connectProducer, publishEvent, isKafkaReady: () => false };
}

// What is a Kafka topic?
//  Think of it like a YouTube channel. 
// Producers publish videos (messages) to a channel (topic). 
// Multiple subscribers (consumers) can watch (consume) those videos independently. 
// Topics are persistent — messages stay for 7 days by default even after being consumed.