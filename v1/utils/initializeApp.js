// v1/utils/initializeApp.js
const mongoose = require('mongoose');
const logger = require('./logger');
const { createAllAnalyticsIndexes } = require('./analyticsIndexes');
const redisClient = require('../config/redis');

/**
 * @function initializeApplication
 * @description Initialize application components on startup
 */
async function initializeApplication() {
  try {
    logger.info('Starting application initialization...');

    // Wait for MongoDB connection to be ready
    if (mongoose.connection.readyState !== 1) {
      logger.info('Waiting for MongoDB connection...');
      await new Promise((resolve, reject) => {
        mongoose.connection.once('connected', resolve);
        mongoose.connection.once('error', reject);
        setTimeout(() => reject(new Error('MongoDB connection timeout')), 30000);
      });
    }

    // Load analytics models to ensure they're registered
    logger.info('Loading analytics models...');
    require('../models/analyticsCacheModel');
    require('../models/analyticsSummaryModel');
    require('../models/ledgerModel');
    logger.info('Analytics models loaded successfully');

    // Initialize analytics indexes
    logger.info('Creating analytics indexes...');
    await createAllAnalyticsIndexes();
    logger.info('Analytics indexes created successfully');

    // Warm up critical cache data
    await warmUpCache();

    logger.info('Application initialization completed successfully');
  } catch (error) {
    logger.error('Application initialization failed:', error.message);
    // Don't exit the process, just log the error
    // The application can still function without indexes
  }
}

/**
 * @function warmUpCache
 * @description Warm up critical cache data
 */
async function warmUpCache() {
  try {
    if (!redisClient.isReady) {
      logger.warn('Redis not available, skipping cache warm-up');
      return;
    }

    logger.info('Warming up cache...');

    // Warm up service charges cache
    const { serviceChargeEnum } = require('./constants');
    for (const [key, value] of Object.entries(serviceChargeEnum)) {
      const field = key.replace(/([A-Z])/g, '_$1').toUpperCase();
      await redisClient.hSet('serviceCharges', field, value);
    }

    // Pre-cache popular content (if any)
    // This could be expanded to cache frequently accessed posts, categories, etc.
    
    logger.info('Cache warm-up completed');
  } catch (error) {
    logger.error('Cache warm-up failed:', error.message);
  }
}

module.exports = {
  initializeApplication,
  warmUpCache
};