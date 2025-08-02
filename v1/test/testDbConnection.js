// v1/test/testDbConnection.js
// Centralized test database connection management

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

class TestDbConnection {
  constructor() {
    this.mongod = null;
    this.isConnected = false;
    this.connectionPromise = null;
  }

  async connect() {
    // Return existing connection promise if already connecting
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    // Return immediately if already connected
    if (this.isConnected && mongoose.connection.readyState === 1) {
      return mongoose.connection;
    }

    this.connectionPromise = this._doConnect();
    return this.connectionPromise;
  }

  async _doConnect() {
    try {
      console.log('Setting up test database connection...');
      
      // Create MongoDB Memory Server if not exists
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
      console.log('Test database URI:', uri);
      
      // Set the test database URI
      process.env.MONGO_URI = uri;
      
      // Configure mongoose for testing
      mongoose.set('bufferCommands', false);
      
      // Disconnect existing connection if any
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Connect mongoose with test-optimized settings
      await mongoose.connect(uri, {
        maxPoolSize: 5,
        minPoolSize: 1,
        maxIdleTimeMS: 30000,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 30000,
        connectTimeoutMS: 10000,
        family: 4,
        bufferCommands: false,
        autoIndex: false,
        autoCreate: false,
      });

      // Wait for connection to be ready
      await this._waitForConnection();

      this.isConnected = true;
      console.log('Test database connection established');
      
      // Create essential indexes
      await this._createIndexes();
      
      return mongoose.connection;
    } catch (error) {
      console.error('Error setting up test database connection:', error);
      this.connectionPromise = null;
      throw error;
    }
  }

  async _waitForConnection() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Test database connection timeout'));
      }, 10000);

      if (mongoose.connection.readyState === 1) {
        clearTimeout(timeout);
        resolve();
      } else {
        const onConnected = () => {
          clearTimeout(timeout);
          mongoose.connection.off('error', onError);
          resolve();
        };
        
        const onError = (error) => {
          clearTimeout(timeout);
          mongoose.connection.off('connected', onConnected);
          reject(error);
        };

        mongoose.connection.once('connected', onConnected);
        mongoose.connection.once('error', onError);
      }
    });
  }

  async _createIndexes() {
    try {
      if (mongoose.connection.readyState === 1) {
        const db = mongoose.connection.db;
        
        // Create essential indexes for testing
        await db.collection('users').createIndex({ email: 1 }, { unique: true });
        await db.collection('users').createIndex({ phoneNumber: 1 }, { unique: true });
        await db.collection('posts').createIndex({ slug: 1 }, { unique: true });
        
        console.log('Test database indexes created');
      }
    } catch (error) {
      console.error('Error creating test database indexes:', error);
      // Don't throw error, indexes are optional for tests
    }
  }

  async clean() {
    try {
      if (mongoose.connection.readyState === 1) {
        const collections = await mongoose.connection.db.listCollections().toArray();
        
        const dropPromises = collections.map(collection => 
          mongoose.connection.db.collection(collection.name).deleteMany({})
        );
        
        await Promise.all(dropPromises);
        console.log('Test database cleaned');
      }
    } catch (error) {
      console.error('Error cleaning test database:', error);
      // Don't throw error, just log it
    }
  }

  async disconnect() {
    try {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      if (this.mongod) {
        await this.mongod.stop();
        this.mongod = null;
      }
      
      this.isConnected = false;
      this.connectionPromise = null;
      console.log('Test database disconnected');
    } catch (error) {
      console.error('Error disconnecting test database:', error);
      // Don't throw error during cleanup
    }
  }

  getConnectionState() {
    return {
      mongoose: mongoose.connection.readyState,
      memoryServer: this.mongod ? 'running' : 'stopped',
      isConnected: this.isConnected
    };
  }

  // Helper method to ensure connection is ready
  async ensureConnection() {
    if (!this.isConnected || mongoose.connection.readyState !== 1) {
      await this.connect();
    }
  }
}

// Export singleton instance
const testDbConnection = new TestDbConnection();

module.exports = testDbConnection;