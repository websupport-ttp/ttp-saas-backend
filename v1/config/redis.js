// v1/config/redis.js
const { createClient } = require('redis');
const logger = require('../utils/logger');

/**
 * @constant redisClient
 * @description Initializes and exports a Redis client.
 * Connects to Redis using the provided URL from environment variables.
 */
const redisClient = createClient({
  url: process.env.REDIS_URL,
});

redisClient.on('error', (err) => logger.error('Redis Client Error', err));
redisClient.on('connect', () => logger.info('Redis Client Connected'));
redisClient.on('ready', () => logger.info('Redis Client Ready'));
redisClient.on('end', () => logger.info('Redis Client Disconnected'));

// Add helper property to check if client is open/connected
Object.defineProperty(redisClient, 'isOpen', {
  get: function() {
    return this.isReady;
  }
});

module.exports = redisClient;