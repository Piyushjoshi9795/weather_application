// config/kafka.js
const { Kafka } = require('kafkajs');

// Create a Kafka instance — points to your broker
const kafka = new Kafka({
  clientId: 'weather-app',       // just a name to identify this app in Kafka logs
  brokers: [process.env.KAFKA_BROKER],
  retry: {
    initialRetryTime: 300,
    retries: 5                   // retry connecting 5 times before giving up
  }
});

// Producer = the thing that SENDS messages to Kafka topics
const producer = kafka.producer();

// Consumer = the thing that READS messages from Kafka topics
// groupId means: all consumers with the same groupId share the work
// If you had 3 consumer instances, Kafka splits messages between them
const consumer = kafka.consumer({ groupId: 'email-service' });

// Connect producer once when app starts
const connectProducer = async () => {
  await producer.connect();
  console.log('Kafka producer connected');
};

// Send a message to a topic
// topic = category/channel (like "user.registered")
// message = the actual data (as a string — we'll JSON.stringify objects)
const publishEvent = async (topic, message) => {
  await producer.send({
    topic,
    messages: [{ value: JSON.stringify(message) }]
  });
  console.log(`Event published to topic: ${topic}`, message);
};

module.exports = { kafka, producer, consumer, connectProducer, publishEvent };