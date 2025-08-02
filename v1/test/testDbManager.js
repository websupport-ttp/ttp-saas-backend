// v1/test/testDbManager.js
// Robust test database manager with improved MongoDB Memory Server handling

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const { TEST_DB_CONFIG } = require('../config/testEnv');

class TestDbManager {
  constructor() {
    this.mongod = null;
    this.isConnected = false;
    this.connectionPromise = null;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.retryDelay = 1000; // Reduced delay for faster tests
    this.connectionTimeout = 15000; // 15 second timeout
    this.shutdownPromise = null;
    this.isShuttingDown = false;
    this._indexesCreated = false;
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

    this.connectionPromise = this._establishConnection();
    return this.connectionPromise;
  }

  async _establishConnection() {
    try {
      console.log('Initializing test database connection...');
      
      // Prevent multiple simultaneous connection attempts
      if (this.isShuttingDown) {
        throw new Error('Cannot establish connection while shutting down');
      }
      
      // Stop any existing MongoDB Memory Server with timeout
      if (this.mongod) {
        try {
          await Promise.race([
            this.mongod.stop(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('MongoDB stop timeout')), 10000)
            )
          ]);
        } catch (error) {
          console.warn('Error stopping existing MongoDB Memory Server:', error.message);
        }
        this.mongod = null;
      }

      // Disconnect existing mongoose connection with timeout
      if (mongoose.connection.readyState !== 0) {
        await Promise.race([
          mongoose.disconnect(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Mongoose disconnect timeout')), 5000)
          )
        ]);
        await this._waitForDisconnection();
      }

      let uri;
      
      // Try to use existing MongoDB instance first, fallback to Memory Server
      try {
        console.log('Attempting to use existing MongoDB instance...');
        const testDbName = `ttp_test_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        uri = `mongodb://127.0.0.1:27017/${testDbName}`;
        
        // Test connection to existing MongoDB with very short timeout
        const testConnection = mongoose.createConnection();
        await Promise.race([
          testConnection.openUri(uri, {
            maxPoolSize: 1,
            serverSelectionTimeoutMS: 2000,
            socketTimeoutMS: 3000,
            connectTimeoutMS: 2000,
            family: 4,
            bufferCommands: false,
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Existing MongoDB connection timeout')), 3000)
          )
        ]);
        
        // Test if we can actually use the connection
        await testConnection.db.admin().ping();
        await testConnection.close();
        
        // Now connect with the main mongoose connection
        await mongoose.connect(uri, {
          maxPoolSize: 2,
          minPoolSize: 1,
          maxIdleTimeMS: 10000,
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 30000,
          connectTimeoutMS: 10000,
          family: 4,
          bufferCommands: false,
          autoIndex: false,
          autoCreate: false,
          retryWrites: false,
          w: 1,
          journal: false,
        });
        
        console.log('Using existing MongoDB instance:', uri);
        this.mongod = null; // No memory server needed
        
      } catch (existingDbError) {
        console.log('Existing MongoDB not available, creating Memory Server...');
        console.log('Error details:', existingDbError.message);
        
        // Disconnect any partial connections
        if (mongoose.connection.readyState !== 0) {
          await mongoose.disconnect();
          await this._waitForDisconnection();
        }
        
        // Fallback to MongoDB Memory Server with reduced timeout
        this.mongod = await Promise.race([
          MongoMemoryServer.create({
            instance: {
              dbName: `ttp_test_${Date.now()}`,
              port: undefined, // Let system choose available port
            },
            binary: {
              version: '4.4.18', // Use stable version
              downloadDir: './node_modules/.cache/mongodb-memory-server',
              skipMD5: true,
            },
            auth: {
              disable: true,
            },
            autoStart: true,
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('MongoDB Memory Server creation timeout')), 20000)
          )
        ]);

        uri = this.mongod.getUri();
        console.log('Created MongoDB Memory Server:', uri);
        
        // Connect to Memory Server
        await Promise.race([
          mongoose.connect(uri, {
            maxPoolSize: 2,
            minPoolSize: 1,
            maxIdleTimeMS: 10000,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 30000,
            connectTimeoutMS: 10000,
            heartbeatFrequencyMS: 10000,
            family: 4,
            bufferCommands: false,
            autoIndex: false,
            autoCreate: false,
            retryWrites: false,
            w: 1,
            journal: false,
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Memory Server connection timeout')), this.connectionTimeout)
          )
        ]);
      }
      
      // Set environment variable for other parts of the application
      process.env.MONGO_URI = uri;
      
      // Configure mongoose for testing with enhanced settings
      mongoose.set('strictQuery', false);
      mongoose.set('bufferCommands', false);

      // Wait for connection to be ready with timeout
      await this._waitForConnection();

      this.isConnected = true;
      this.retryCount = 0;
      this.connectionPromise = null;
      
      console.log('Test database connection established successfully');
      
      // Create essential indexes for testing
      await this._createTestIndexes();
      
      return mongoose.connection;
    } catch (error) {
      console.error('Error establishing test database connection:', error);
      this.connectionPromise = null;
      
      // Clean up on failure
      await this._cleanupFailedConnection();
      
      // Retry logic with exponential backoff
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        const delay = this.retryDelay * Math.pow(2, this.retryCount - 1); // Exponential backoff
        console.log(`Retrying database connection (${this.retryCount}/${this.maxRetries}) in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this._establishConnection();
      }
      
      throw new Error(`Failed to establish test database connection after ${this.maxRetries} attempts: ${error.message}`);
    }
  }

  async _cleanupFailedConnection() {
    try {
      if (this.mongod) {
        await this.mongod.stop();
        this.mongod = null;
      }
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
    } catch (error) {
      console.warn('Error during failed connection cleanup:', error.message);
    }
  }

  async _waitForConnection() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        mongoose.connection.off('connected', onConnected);
        mongoose.connection.off('error', onError);
        reject(new Error(`Test database connection timeout after ${this.connectionTimeout / 1000} seconds`));
      }, this.connectionTimeout);

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

  async _waitForDisconnection() {
    return new Promise((resolve) => {
      if (mongoose.connection.readyState === 0) {
        resolve();
      } else {
        const timeout = setTimeout(() => {
          mongoose.connection.off('disconnected', onDisconnected);
          console.warn('Disconnect timeout, forcing resolution');
          resolve();
        }, 5000);

        const onDisconnected = () => {
          clearTimeout(timeout);
          mongoose.connection.off('disconnected', onDisconnected);
          resolve();
        };
        
        mongoose.connection.once('disconnected', onDisconnected);
      }
    });
  }

  async _createTestIndexes() {
    // Skip index creation if already created for this connection
    if (this._indexesCreated) {
      return;
    }
    
    try {
      if (mongoose.connection.readyState === 1) {
        const db = mongoose.connection.db;
        
        // Create essential indexes for testing with timeout
        const indexOperations = [
          { collection: 'users', index: { email: 1 }, options: { unique: true, sparse: true, background: true } },
          { collection: 'users', index: { phoneNumber: 1 }, options: { unique: true, sparse: true, background: true } },
          { collection: 'posts', index: { slug: 1 }, options: { unique: true, sparse: true, background: true } },
          { collection: 'categories', index: { slug: 1 }, options: { unique: true, sparse: true, background: true } },
        ];

        const indexPromises = indexOperations.map(async ({ collection, index, options }) => {
          try {
            await Promise.race([
              db.collection(collection).createIndex(index, options),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Index creation timeout')), 3000)
              )
            ]);
          } catch (error) {
            // Ignore index creation errors (they might already exist or timeout)
            console.debug(`Index creation skipped for ${collection}:`, error.message);
          }
        });

        await Promise.all(indexPromises);
        this._indexesCreated = true;
        console.log('Test database indexes created');
      }
    } catch (error) {
      console.warn('Error creating test database indexes:', error.message);
      // Don't throw error, indexes are optional for tests
    }
  }

  async cleanDatabase() {
    try {
      if (mongoose.connection.readyState === 1) {
        // Use collection-by-collection cleanup (faster than dropping database)
        const collections = await mongoose.connection.db.listCollections().toArray();
        
        if (collections.length === 0) {
          console.log('Test database cleaned successfully (no collections)');
          return;
        }
        
        const cleanPromises = collections.map(async (collection) => {
          try {
            await Promise.race([
              mongoose.connection.db.collection(collection.name).deleteMany({}),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Collection clean timeout')), 2000)
              )
            ]);
          } catch (error) {
            console.debug(`Error cleaning collection ${collection.name}:`, error.message);
          }
        });
        
        await Promise.all(cleanPromises);
        console.log('Test database cleaned successfully');
      }
    } catch (error) {
      console.warn('Error cleaning test database:', error.message);
    }
  }

  async disconnect() {
    // Prevent multiple simultaneous disconnections
    if (this.shutdownPromise) {
      return this.shutdownPromise;
    }

    this.shutdownPromise = this._performDisconnect();
    return this.shutdownPromise;
  }

  async _performDisconnect() {
    try {
      this.isShuttingDown = true;
      this.isConnected = false;
      this.connectionPromise = null;
      
      // Disconnect mongoose with timeout
      if (mongoose.connection.readyState !== 0) {
        await Promise.race([
          mongoose.disconnect(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Mongoose disconnect timeout')), 5000)
          )
        ]);
        await this._waitForDisconnection();
      }
      
      // Stop MongoDB Memory Server with timeout (only if we created one)
      if (this.mongod) {
        try {
          console.log('Stopping MongoDB Memory Server...');
          await Promise.race([
            this.mongod.stop(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('MongoDB stop timeout')), 10000)
            )
          ]);
          console.log('MongoDB Memory Server stopped');
        } catch (error) {
          console.warn('Error stopping MongoDB Memory Server:', error.message);
          // Force cleanup
          this.mongod = null;
        }
        this.mongod = null;
      }
      
      console.log('Test database disconnected successfully');
    } catch (error) {
      console.warn('Error disconnecting test database:', error.message);
      // Force cleanup on error
      this.mongod = null;
      this.isConnected = false;
    } finally {
      this.isShuttingDown = false;
      this.shutdownPromise = null;
    }
  }

  getConnectionState() {
    return {
      mongoose: mongoose.connection.readyState,
      memoryServer: this.mongod ? 'running' : 'stopped',
      isConnected: this.isConnected,
      retryCount: this.retryCount
    };
  }

  async ensureConnection() {
    if (this.isShuttingDown) {
      throw new Error('Cannot ensure connection while shutting down');
    }
    
    if (!this.isConnected || mongoose.connection.readyState !== 1) {
      await this.connect();
    }
    
    // Double-check connection is actually working
    try {
      await mongoose.connection.db.admin().ping();
    } catch (error) {
      console.warn('Connection ping failed, reconnecting...', error.message);
      this.isConnected = false;
      await this.connect();
    }
  }

  // Enhanced health check method
  async healthCheck() {
    try {
      if (mongoose.connection.readyState === 1) {
        const start = Date.now();
        await Promise.race([
          mongoose.connection.db.admin().ping(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Health check timeout')), 3000)
          )
        ]);
        const responseTime = Date.now() - start;
        
        return { 
          status: 'healthy', 
          connection: 'active',
          responseTime,
          memoryServerRunning: !!this.mongod,
          connectionState: mongoose.connection.readyState
        };
      } else {
        return { 
          status: 'unhealthy', 
          connection: 'inactive',
          connectionState: mongoose.connection.readyState,
          memoryServerRunning: !!this.mongod
        };
      }
    } catch (error) {
      return { 
        status: 'unhealthy', 
        error: error.message,
        connectionState: mongoose.connection.readyState,
        memoryServerRunning: !!this.mongod
      };
    }
  }

  // Force cleanup method for emergency situations
  async forceCleanup() {
    try {
      this.isShuttingDown = true;
      this.isConnected = false;
      this.connectionPromise = null;
      this.shutdownPromise = null;
      
      // Force close mongoose connection
      if (mongoose.connection.readyState !== 0) {
        mongoose.connection.close(true); // Force close
      }
      
      // Force stop MongoDB Memory Server
      if (this.mongod) {
        try {
          await this.mongod.stop();
        } catch (error) {
          console.warn('Force cleanup MongoDB stop error:', error.message);
        }
        this.mongod = null;
      }
      
      console.log('Test database force cleanup completed');
    } catch (error) {
      console.warn('Error during force cleanup:', error.message);
    } finally {
      this.isShuttingDown = false;
    }
  }
}

// Export singleton instance
const testDbManager = new TestDbManager();

module.exports = testDbManager;