// v1/config/db.js
const mongoose = require('mongoose');

// Safe logger import with fallback
let logger;
try {
  logger = require('../utils/logger');
} catch (error) {
  // Fallback logger for test environments
  logger = {
    info: (msg) => process.env.NODE_ENV !== 'test' && console.log(msg),
    error: (msg) => process.env.NODE_ENV !== 'test' && console.error(msg),
    warn: (msg) => process.env.NODE_ENV !== 'test' && console.warn(msg),
  };
}

/**
 * @function connectDB
 * @description Connects to the MongoDB database using Mongoose.
 * Logs success or error messages.
 */
const connectDB = async () => {
  try {
    // Skip actual connection during tests - test setup handles this
    if (process.env.NODE_ENV === 'test') {
      logger.info('Skipping MongoDB connection during tests - handled by test setup');
      return;
    }

    // Ensure MONGO_URI is available
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI environment variable is not defined');
    }

    const conn = await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 10,
      minPoolSize: 2,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      family: 4,
    });
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    logger.error(`MongoDB Connection Error: ${error.message}`);
    
    // Don't exit process during tests
    if (process.env.NODE_ENV === 'test') {
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