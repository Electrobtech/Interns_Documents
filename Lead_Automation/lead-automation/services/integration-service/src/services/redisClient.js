/**
 * src/services/redisClient.js
 *
 * Shared Redis client for integration-service.
 * Currently used for OAuth CSRF `state` storage (see routes/auth.js),
 * but written generically so other short-lived-key needs can reuse it.
 */

const { createClient } = require('redis');

const client = createClient({
  url: process.env.REDIS_URL || 'redis://redis:6379',
});

client.on('error', (err) => console.error('Redis Client Error:', err));

let isConnected = false;

async function getRedisClient() {
  if (!isConnected) {
    await client.connect();
    isConnected = true;
    console.log('Connected to Redis');
  }
  return client;
}

module.exports = { getRedisClient };