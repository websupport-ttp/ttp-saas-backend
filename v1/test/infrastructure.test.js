// v1/test/infrastructure.test.js
// Test to verify the new test infrastructure is working correctly

const mongoose = require('mongoose');
const testDbManager = require('./testDbManager');

describe('Test Infrastructure Verification', () => {
  beforeAll(async () => {
    // Ensure database connection is ready
    await testDbManager.ensureConnection();
  });

  beforeEach(async () => {
    // Clean database before each test
    await testDbManager.cleanDatabase();
  });

  afterAll(async () => {
    // Clean up after all tests
    await testDbManager.cleanDatabase();
  });

  describe('Database Connection', () => {
    test('should have active MongoDB connection', async () => {
      expect(mongoose.connection.readyState).toBe(1);
    });

    test('should pass health check', async () => {
      const health = await testDbManager.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.connection).toBe('active');
    });

    test('should have test database URI set', () => {
      expect(process.env.MONGO_URI).toBeDefined();
      // In-memory MongoDB server doesn't use the ttp_test_db name pattern
      expect(process.env.MONGO_URI).toMatch(/mongodb:\/\/127\.0\.0\.1:\d+\//);
    });
  });

  describe('Database Operations', () => {
    test('should be able to create and query collections', async () => {
      const db = mongoose.connection.db;
      
      // Insert a test document
      await db.collection('test_collection').insertOne({ 
        name: 'test', 
        value: 123,
        createdAt: new Date()
      });
      
      // Query the document
      const doc = await db.collection('test_collection').findOne({ name: 'test' });
      expect(doc).toBeTruthy();
      expect(doc.name).toBe('test');
      expect(doc.value).toBe(123);
    });

    test('should clean database between tests', async () => {
      const db = mongoose.connection.db;
      
      // Insert a document
      await db.collection('cleanup_test').insertOne({ test: 'data' });
      
      // Verify it exists
      let count = await db.collection('cleanup_test').countDocuments();
      expect(count).toBe(1);
      
      // Clean database
      await testDbManager.cleanDatabase();
      
      // Verify it's gone
      count = await db.collection('cleanup_test').countDocuments();
      expect(count).toBe(0);
    });
  });

  describe('Environment Configuration', () => {
    test('should have NODE_ENV set to test', () => {
      expect(process.env.NODE_ENV).toBe('test');
    });

    test('should have required test environment variables', () => {
      expect(process.env.JWT_ACCESS_SECRET).toBeDefined();
      expect(process.env.JWT_REFRESH_SECRET).toBeDefined();
      expect(process.env.COOKIE_SECRET).toBeDefined();
    });
  });

  describe('Connection State', () => {
    test('should report correct connection state', () => {
      const state = testDbManager.getConnectionState();
      expect(state.mongoose).toBe(1); // Connected
      expect(state.memoryServer).toBe('running');
      expect(state.isConnected).toBe(true);
    });
  });
});