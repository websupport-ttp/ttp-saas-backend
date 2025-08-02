// v1/test/testDatabase.js
// Improved test database setup with MongoDB Memory Server and proper connection management

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

class TestDatabase {
  constructor() {
    this.mongod = null;
    this.isConnected = false;
    this.connectionRetries = 0;
    this.maxRetries = 3;
    this.retryDelay = 2000;
  }

  async connect() {
    try {
      console.log('Setting up MongoDB Memory Server for tests...');
      
      // Create MongoDB Memory Server with optimized settings
      if (!this.mongod) {
        this.mongod = await MongoMemoryServer.create({
          instance: {
            dbName: 'ttp_api_test',
            storageEngine: 'wiredTiger',
          },
          binary: {
            version: '6.0.0',
            downloadDir: './node_modules/.cache/mongodb-memory-server',
          },
        });
      }

      const uri = this.mongod.getUri();
      console.log('MongoDB Memory Server URI:', uri);
      
      // Set the test database URI
      process.env.MONGO_URI = uri;
      
      // Disconnect existing connection if any
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
        // Wait a bit for cleanup
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Connect mongoose with optimized settings for testing
      await mongoose.connect(uri, {
        maxPoolSize: 5,
        minPoolSize: 1,
        maxIdleTimeMS: 30000,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 30000,
        connectTimeoutMS: 10000,
        family: 4,
        bufferMaxEntries: 0, // Disable mongoose buffering
        bufferCommands: false, // Disable mongoose buffering
        autoIndex: false, // Don't build indexes in test
        autoCreate: false, // Don't auto-create collections
      });

      // Wait for connection to be ready
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('MongoDB connection timeout'));
        }, 10000);

        if (mongoose.connection.readyState === 1) {
          clearTimeout(timeout);
          resolve();
        } else {
          mongoose.connection.once('connected', () => {
            clearTimeout(timeout);
            resolve();
          });
          mongoose.connection.once('error', (error) => {
            clearTimeout(timeout);
            reject(error);
          });
        }
      });

      this.isConnected = true;
      this.connectionRetries = 0;
      console.log('Connected to MongoDB Memory Server for tests');
      
      return this.mongod;
    } catch (error) {
      console.error('Error connecting to test database:', error);
      
      // Retry logic
      if (this.connectionRetries < this.maxRetries) {
        this.connectionRetries++;
        console.log(`Retrying connection (${this.connectionRetries}/${this.maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.connect();
      }
      
      throw error;
    }
  }

  async clean() {
    try {
      if (mongoose.connection.readyState === 1) {
        // Get all collection names
        const collections = await mongoose.connection.db.listCollections().toArray();
        
        // Drop all collections efficiently
        const dropPromises = collections.map(collection => 
          mongoose.connection.db.collection(collection.name).deleteMany({})
        );
        
        await Promise.all(dropPromises);
        console.log('Test database cleaned successfully');
      }
    } catch (error) {
      console.error('Error cleaning test database:', error);
      // Don't throw error, just log it to prevent test failures
    }
  }

  async disconnect() {
    try {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
        // Wait for cleanup
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      if (this.mongod) {
        await this.mongod.stop();
        this.mongod = null;
      }
      
      this.isConnected = false;
      this.connectionRetries = 0;
      console.log('Disconnected from test database');
    } catch (error) {
      console.error('Error disconnecting from test database:', error);
      // Don't throw error during cleanup
    }
  }

  getConnectionState() {
    return {
      mongoose: mongoose.connection.readyState,
      memoryServer: this.mongod ? 'running' : 'stopped',
      isConnected: this.isConnected,
      retries: this.connectionRetries
    };
  }

  // Helper method to ensure connection is ready
  async ensureConnection() {
    if (!this.isConnected || mongoose.connection.readyState !== 1) {
      await this.connect();
    }
  }

  // Helper method to create indexes for testing
  async createIndexes() {
    try {
      if (mongoose.connection.readyState === 1) {
        // Create essential indexes for testing
        const db = mongoose.connection.db;
        
        // User indexes
        await db.collection('users').createIndex({ email: 1 }, { unique: true });
        await db.collection('users').createIndex({ phoneNumber: 1 }, { unique: true });
        
        // Post indexes
        await db.collection('posts').createIndex({ slug: 1 }, { unique: true });
        
        console.log('Test database indexes created');
      }
    } catch (error) {
      console.error('Error creating test database indexes:', error);
      // Don't throw error, indexes are optional for tests
    }
  }
}

// Export singleton instance
const testDatabase = new TestDatabase();

module.exports = testDatabase;