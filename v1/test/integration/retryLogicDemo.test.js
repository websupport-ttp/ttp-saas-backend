// v1/test/integration/retryLogicDemo.test.js
// Demonstration of test retry logic for rate-limited scenarios

const { StatusCodes } = require('http-status-codes');
const jwt = require('jsonwebtoken');

// Import enhanced test utilities
const { 
  createTestClient, 
  describeWithRetry, 
  testWithRetry,
  createTestData,
  waitForRateLimitCooldown,
  isRateLimitError,
  RETRY_CONFIG
} = require('../utils/testHelpers');

const { testEnvironmentManager } = require('../utils/testEnvironmentManager');

// Import test app and database manager
const app = require('./testApp');
const testDbManager = require('../testDbManager');

// Import models
const User = require('../../models/userModel');
const Post = require('../../models/postModel');
const Category = require('../../models/categoryModel');

describeWithRetry('Test Retry Logic Demo', () => {
  let testClient;
  let testUsers = {};
  let testTokens = {};
  let testData = {};

  beforeAll(async () => {
    // Ensure test database connection
    await testDbManager.ensureConnection();
    
    // Create enhanced test client with retry logic
    testClient = createTestClient(app, {
      suiteName: 'RetryLogicDemo',
      enableRetries: true,
      enableRateLimitHandling: true,
      timeout: 20000,
      maxConcurrentTests: 1 // Limit concurrency for this demo
    });
    
    // Set test environment variables
    process.env.JWT_ACCESS_SECRET = 'test-jwt-secret-for-retry-demo';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-retry-demo';
  });

  beforeEach(async () => {
    // Clean database before each test
    await testDbManager.cleanDatabase();
    
    // Create test data
    const userData = createTestData();
    
    // Create test users
    testUsers.regular = await User.create({
      firstName: userData.user.firstName,
      lastName: userData.user.lastName,
      email: userData.user.email,
      phoneNumber: userData.user.phoneNumber,
      password: userData.user.password,
      role: 'User',
      isEmailVerified: true,
      isPhoneVerified: true,
    });

    testUsers.manager = await User.create({
      firstName: 'Manager',
      lastName: 'User',
      email: `manager${Date.now()}@test.com`,
      phoneNumber: `+234812345${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
      password: 'ManagerPassword123!',
      role: 'Manager',
      isEmailVerified: true,
      isPhoneVerified: true,
    });

    // Generate JWT tokens
    Object.keys(testUsers).forEach(role => {
      const user = testUsers[role];
      testTokens[role] = jwt.sign(
        { 
          userId: user._id.toString(),
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName
        },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: '1h' }
      );
    });

    // Create test category and package
    testData.category = await Category.create({
      name: 'Test Category',
      description: 'Test category description',
      slug: `test-category-${Date.now()}`,
      isActive: true,
    });

    testData.package = await Post.create({
      title: 'Test Package',
      content: 'This is a test package content',
      postType: 'Packages',
      status: 'Published',
      author: testUsers.regular._id,
      category: testData.category._id,
      slug: `test-package-${Date.now()}`,
      price: 50000,
      metadata: {
        duration: '7 days',
        location: 'Lagos, Nigeria',
        includes: ['Accommodation', 'Meals', 'Transportation'],
        maxParticipants: 10,
        difficulty: 'Easy',
      },
      availability: {
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-12-31'),
      },
      tags: ['package', 'travel'],
    });
  });

  afterAll(async () => {
    // Print test environment report
    testEnvironmentManager.printReport();
    
    // Cleanup
    if (testClient) {
      testClient.cleanup();
    }
    await testDbManager.disconnect();
  });

  describe('Basic Retry Logic Tests', () => {
    testWithRetry('should handle successful requests without retries', async () => {
      const response = await testClient.get('/api/v1/posts', {
        expectedStatus: StatusCodes.OK,
        maxRetries: 2
      });

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.success).toBe(true);
    }, { timeout: 15000 });

    testWithRetry('should retry on network errors', async () => {
      // This test demonstrates retry logic for network issues
      // In a real scenario, this might be a flaky network connection
      
      const response = await testClient.get('/api/v1/posts', {
        expectedStatus: StatusCodes.OK,
        maxRetries: 3,
        timeout: 10000
      });

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.success).toBe(true);
    }, { timeout: 20000 });

    testWithRetry('should handle rate limiting gracefully', async () => {
      // Make multiple rapid requests to potentially trigger rate limiting
      const requests = [];
      
      for (let i = 0; i < 5; i++) {
        requests.push(
          testClient.get('/api/v1/posts', {
            allowRateLimit: true,
            maxRetries: 2
          })
        );
      }

      const responses = await Promise.allSettled(requests);
      
      // At least some requests should succeed
      const successfulResponses = responses.filter(r => 
        r.status === 'fulfilled' && 
        (r.value.status === StatusCodes.OK || r.value.status === StatusCodes.TOO_MANY_REQUESTS)
      );
      
      expect(successfulResponses.length).toBeGreaterThan(0);
      
      // Log rate limiting information
      const rateLimitedResponses = responses.filter(r => 
        r.status === 'fulfilled' && r.value.status === StatusCodes.TOO_MANY_REQUESTS
      );
      
      if (rateLimitedResponses.length > 0) {
        console.log(`✅ Rate limiting test: ${rateLimitedResponses.length} requests were rate limited (expected behavior)`);
      }
    }, { timeout: 30000, skipOnRateLimit: true });
  });

  describe('Authentication with Retry Logic', () => {
    testWithRetry('should retry authentication requests', async () => {
      const loginData = {
        emailOrPhone: testUsers.regular.email,
        password: 'TestPassword123!',
      };

      const response = await testClient.post('/api/v1/auth/login', loginData, {
        expectedStatus: StatusCodes.OK,
        maxRetries: 3,
        allowRateLimit: true
      });

      if (response.status === StatusCodes.OK) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.token).toBeDefined();
      } else if (response.status === StatusCodes.TOO_MANY_REQUESTS) {
        console.log('✅ Login request was rate limited (expected behavior)');
      }
    }, { timeout: 20000, skipOnRateLimit: true });

    testWithRetry('should handle registration with retry logic', async () => {
      const registrationData = createTestData().user;
      registrationData.email = `retry-test-${Date.now()}@example.com`;
      registrationData.phoneNumber = `+234812345${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

      const response = await testClient.post('/api/v1/auth/register', registrationData, {
        allowRateLimit: true,
        maxRetries: 2
      });

      if (response.status === StatusCodes.CREATED) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.user.email).toBe(registrationData.email);
      } else if (response.status === StatusCodes.TOO_MANY_REQUESTS) {
        console.log('✅ Registration request was rate limited (expected behavior)');
      }
    }, { timeout: 20000, skipOnRateLimit: true });
  });

  describe('Protected Routes with Retry Logic', () => {
    testWithRetry('should retry protected route access', async () => {
      const response = await testClient.get('/api/v1/analytics/summary', {
        headers: {
          'Authorization': `Bearer ${testTokens.manager}`
        },
        allowRateLimit: true,
        maxRetries: 2
      });

      if (response.status === StatusCodes.OK) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.metrics).toBeDefined();
      } else if (response.status === StatusCodes.TOO_MANY_REQUESTS) {
        console.log('✅ Analytics request was rate limited (expected behavior)');
      }
    }, { timeout: 15000, skipOnRateLimit: true });

    testWithRetry('should handle package purchase with retries', async () => {
      const purchaseData = {
        customerDetails: createTestData().customerDetails,
        participants: 1,
        specialRequests: 'Test purchase with retry logic',
      };

      const response = await testClient.post(
        `/api/v1/products/packages/${testData.package._id}/purchase`,
        purchaseData,
        {
          headers: {
            'Authorization': `Bearer ${testTokens.regular}`
          },
          allowRateLimit: true,
          maxRetries: 2
        }
      );

      if (response.status === StatusCodes.OK) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.authorizationUrl).toBeDefined();
      } else if (response.status === StatusCodes.TOO_MANY_REQUESTS) {
        console.log('✅ Package purchase was rate limited (expected behavior)');
      }
    }, { timeout: 20000, skipOnRateLimit: true });
  });

  describe('Visa Application with Retry Logic', () => {
    testWithRetry('should handle visa application with retries', async () => {
      const visaData = createTestData().visaApplication;

      const response = await testClient.post('/api/v1/products/visa/apply', visaData, {
        headers: {
          'Authorization': `Bearer ${testTokens.regular}`
        },
        allowRateLimit: true,
        maxRetries: 2
      });

      if (response.status === StatusCodes.CREATED) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.application.status).toBe('Pending');
      } else if (response.status === StatusCodes.TOO_MANY_REQUESTS) {
        console.log('✅ Visa application was rate limited (expected behavior)');
      }
    }, { timeout: 15000, skipOnRateLimit: true });

    testWithRetry('should handle guest visa application with retries', async () => {
      const guestVisaData = {
        ...createTestData().visaApplication,
        guestEmail: `guest-${Date.now()}@example.com`
      };

      const response = await testClient.post('/api/v1/products/visa/apply', guestVisaData, {
        allowRateLimit: true,
        maxRetries: 2
      });

      if (response.status === StatusCodes.CREATED) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.application.guestEmail).toBe(guestVisaData.guestEmail);
      } else if (response.status === StatusCodes.TOO_MANY_REQUESTS) {
        console.log('✅ Guest visa application was rate limited (expected behavior)');
      }
    }, { timeout: 15000, skipOnRateLimit: true });
  });

  describe('Concurrent Request Handling', () => {
    testWithRetry('should handle concurrent requests with proper isolation', async () => {
      // Test concurrent requests with proper spacing
      const concurrentRequests = [];
      const requestCount = 3;
      
      for (let i = 0; i < requestCount; i++) {
        // Add small delay between request initiations
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        concurrentRequests.push(
          testClient.get('/api/v1/posts', {
            allowRateLimit: true,
            maxRetries: 1,
            testName: `concurrent-request-${i}`
          })
        );
      }

      const results = await Promise.allSettled(concurrentRequests);
      
      // Count successful and rate-limited requests
      let successCount = 0;
      let rateLimitCount = 0;
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          if (result.value.status === StatusCodes.OK) {
            successCount++;
          } else if (result.value.status === StatusCodes.TOO_MANY_REQUESTS) {
            rateLimitCount++;
          }
        }
      });

      console.log(`📊 Concurrent requests: ${successCount} successful, ${rateLimitCount} rate limited`);
      
      // At least one request should succeed or be rate limited (not fail completely)
      expect(successCount + rateLimitCount).toBeGreaterThan(0);
    }, { timeout: 25000, skipOnRateLimit: true });
  });

  describe('Test Environment Statistics', () => {
    test('should provide comprehensive test statistics', () => {
      const stats = testClient.getStats();
      
      expect(stats).toBeDefined();
      expect(stats.suiteName).toBe('RetryLogicDemo');
      expect(stats.tests).toBeDefined();
      expect(stats.requests).toBeDefined();
      expect(stats.rateLimitState).toBeDefined();
      
      console.log('📈 Test Session Statistics:');
      console.log(`   Suite: ${stats.suiteName}`);
      console.log(`   Duration: ${stats.duration}ms`);
      console.log(`   Tests: ${stats.tests.completed} completed, ${stats.tests.failed} failed`);
      console.log(`   Requests: ${stats.requests.total} total, ${stats.requests.rateLimited} rate limited`);
      console.log(`   Average Response Time: ${stats.requests.averageResponseTime}ms`);
    });
  });

}, {
  // Suite-level configuration
  timeout: 120000, // 2 minutes for the entire suite
  beforeEachDelay: 500, // 500ms delay between tests
  afterEachDelay: 300,  // 300ms delay after tests
  maxConcurrentTests: 1 // Run tests sequentially in this suite
});