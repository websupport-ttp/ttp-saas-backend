// v1/config/db.js
const mongoose = require('mongoose');

// Safe logger import with fallback
let logger;
try {
  logger = require('../utils/logger');
} catch (error) {
  // Fallback logger for test environments
  logger = {
    info: (msg) => process.env.JEST_WORKER_ID ? undefined : console.log(msg),
    error: (msg) => process.env.JEST_WORKER_ID ? undefined : console.error(msg),
    warn: (msg) => process.env.JEST_WORKER_ID ? undefined : console.warn(msg),
  };
}

/**
 * @function connectDB
 * @description Connects to the MongoDB database using Mongoose.
 * Logs success or error messages.
 */
const connectDB = async () => {
  try {
    // Skip actual connection only during Jest unit tests (not deployment environments)
    if (process.env.NODE_ENV === 'test' && process.env.JEST_WORKER_ID) {
      logger.info('Skipping MongoDB connection during Jest tests - handled by test setup');
      return;
    }

    // Ensure MONGO_URI is available
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI environment variable is not defined');
    }

    // Log masked URI so we can confirm the database name in deployment logs
    const maskedUri = process.env.MONGO_URI.replace(/:([^@]+)@/, ':***@');
    logger.info(`Connecting to MongoDB: ${maskedUri}`);

    const conn = await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 10,
      minPoolSize: 1,  // Reduced from 2 — saves idle connection overhead on Railway
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      family: 4,
    });
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    logger.error(`MongoDB Connection Error: ${error.message}`);
    
    // Don't exit process during Jest unit tests
    if (process.env.NODE_ENV === 'test' && process.env.JEST_WORKER_ID) {
      logger.warn('MongoDB connection failed during tests, continuing...');
      return;
    }
    
    // In production/development, retry connection after delay
    if (process.env.NODE_ENV !== 'test') {
      logger.info('Retrying MongoDB connection in 5 seconds...');
      setTimeout(() => {
        connectDB();
      }, 5000);
    }
  }
};

module.exports = connectDB;