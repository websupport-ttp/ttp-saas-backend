// v1/config/database.js
const mongoose = require('mongoose');
const testDatabase = require('../test/testDatabase');

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
 * Connect to database
 * Uses test database in test environment, regular MongoDB otherwise
 */
const connectDB = async () => {
  try {
    if (process.env.NODE_ENV === 'test') {
      // Use test database for testing
      await testDatabase.connect();
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
    logger.info('Retrying MongoDB connection in 5 seconds...');
    setTimeout(() => {
      connectDB();
    }, 5000);
  }
};

/**
 * Disconnect from database
 * Handles both test and regular database connections
 */
const disconnectDB = async () => {
  try {
    if (process.env.NODE_ENV === 'test') {
      // Use test database disconnect for testing
      await testDatabase.disconnect();
      return;
    }

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      logger.info('MongoDB Disconnected');
    }
  } catch (error) {
    logger.error(`MongoDB Disconnection Error: ${error.message}`);
  }
};

/**
 * Clean database (primarily for testing)
 */
const cleanDB = async () => {
  try {
    if (process.env.NODE_ENV === 'test') {
      await testDatabase.clean();
      return;
    }

    // In non-test environments, only clean if explicitly allowed
    if (process.env.ALLOW_DB_CLEAN === 'true') {
      const collections = await mongoose.connection.db.listCollections().toArray();
      const dropPromises = collections.map(collection => 
        mongoose.connection.db.collection(collection.name).deleteMany({})
      );
      await Promise.all(dropPromises);
      logger.info('Database cleaned');
    } else {
      logger.warn('Database cleaning not allowed in this environment');
    }
  } catch (error) {
    logger.error(`Database Clean Error: ${error.message}`);
  }
};

/**
 * Get database connection status
 */
const getConnectionStatus = () => {
  if (process.env.NODE_ENV === 'test') {
    return testDatabase.getConnectionState();
  }

  return {
    mongoose: mongoose.connection.readyState,
    isConnected: mongoose.connection.readyState === 1,
    host: mongoose.connection.host,
    name: mongoose.connection.name
  };
};

module.exports = {
  connectDB,
  disconnectDB,
  cleanDB,
  getConnectionStatus
};