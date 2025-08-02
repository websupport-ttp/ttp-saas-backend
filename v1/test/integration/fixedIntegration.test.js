// v1/test/integration/fixedIntegration.test.js
// Fixed comprehensive integration test suite

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { StatusCodes } = require('http-status-codes');

// Use test app with proper routes
const app = require('./testApp');

// Import models
const User = require('../../models/userModel');
const Post = require('../../models/postModel');
const Category = require('../../models/categoryModel');
const LedgerEntry = require('../../models/ledgerModel');
const VisaApplication = require('../../models/visaApplicationModel');

// Import test utilities
const testDbManager = require('../testDbManager');

describe('Fixed Integration Test Suite', () => {
  let testUsers = {};
  let testTokens = {};
  let testData = {};

  beforeAll(async () => {
    // Ensure test database connection
    await testDbManager.ensureConnection();
    
    // Set test environment variables
    process.env.JWT_ACCESS_SECRET = 'test-jwt-secret-for-fixed-integration';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-fixed-integration';
  });

  beforeEach(async () => {
    // Clean database before each test
    await testDbManager.cleanDatabase();
    
    // Create test users with different roles
    const userPassword = 'TestPassword123!';
    
    testUsers.admin = await User.create({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@test.com',
      phoneNumber: '+1234567890',
      password: userPassword,
      role: 'Admin',
      isEmailVerified: true,
      isPhoneVerified: true,
    });

    testUsers.manager = await User.create({
      firstName: 'Manager',
      lastName: 'User',
      email: 'manager@test.com',
      phoneNumber: '+1234567891',
      password: userPassword,
      role: 'Manager',
      isEmailVerified: true,
      isPhoneVerified: true,
    });

    testUsers.staff = await User.create({
      firstName: 'Staff',
      lastName: 'User',
      email: 'staff@test.com',
      phoneNumber: '+1234567892',
      password: userPassword,
      role: 'Staff',
      isEmailVerified: true,
      isPhoneVerified: true,
    });

    testUsers.regular = await User.create({
      firstName: 'Regular',
      lastName: 'User',
      email: 'user@test.com',
      phoneNumber: '+1234567893',
      password: userPassword,
      role: 'User',
      isEmailVerified: true,
      isPhoneVerified: true,
    });

    // Generate JWT tokens for each user
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

    // Create test category
    testData.category = await Category.create({
      name: 'Test Category',
      description: 'Test category description',
      slug: 'test-category',
      isActive: true,
    });

    // Create test package
    testData.package = await Post.create({
      title: 'Test Package',
      content: 'This is a test package content',
      postType: 'Packages',
      status: 'Published',
      author: testUsers.staff._id,
      category: testData.category._id,
      slug: 'test-package',
      price: 50000,
      metadata: {
        duration: '7 days',
        location: 'Lagos, Nigeria',
        includes: ['Accommodation', 'Meals', 'Transportation'],
        maxParticipants: 10,
        difficulty: 'Easy',
      },
      availability: {
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-12-31'),
      },
      tags: ['package', 'travel'],
    });

    // Create test article
    testData.article = await Post.create({
      title: 'Test Article',
      content: 'This is a test article content',
      postType: 'Articles',
      status: 'Published',
      author: testUsers.staff._id,
      category: testData.category._id,
      slug: 'test-article',
      tags: ['article', 'test'],
      isFeatured: true,
    });

    // Create test ledger entries for analytics
    await LedgerEntry.create({
      transactionReference: 'TXN_TEST_001',
      amount: 50000,
      currency: 'NGN',
      status: 'Completed',
      paymentGateway: 'Paystack',
      productType: 'Package',
      itemType: 'Package',
      packageId: testData.package._id,
      profitMargin: 5000,
      totalAmountPaid: 55000,
      serviceCharge: 2500,
      customerSegment: 'Individual',
      bookingChannel: 'Web',
      seasonality: 'Peak',
      userId: testUsers.regular._id,
    });
  });

  afterAll(async () => {
    await testDbManager.disconnect();
  });

  describe('Route Configuration Tests', () => {
    it('should have all main routes properly mounted', async () => {
      // Test that main route groups are accessible
      const routes = [
        { path: '/api/v1/posts', method: 'get', expectedStatus: 200 },
        { path: '/api/v1/categories', method: 'get', expectedStatus: 200 },
        { path: '/api/v1/posts/featured', method: 'get', expectedStatus: 200 },
        { path: '/health/system', method: 'get', expectedStatus: 200 },
        { path: '/health/liveness', method: 'get', expectedStatus: 200 },
      ];

      for (const route of routes) {
        const response = await request(app)[route.method](route.path);
        expect(response.status).toBe(route.expectedStatus);
      }
    });

    it('should handle 404 errors properly', async () => {
      const response = await request(app)
        .get('/api/v1/nonexistent-endpoint')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Can't find");
    });
  });

  describe('Authentication Integration Tests', () => {
    describe('User Registration', () => {
      it('should register a new user successfully', async () => {
        const userData = {
          firstName: 'New',
          lastName: 'User',
          email: 'newuser@test.com',
          phoneNumber: '+1234567894',
          password: 'NewPassword123!',
          confirmPassword: 'NewPassword123!',
        };

        const response = await request(app)
          .post('/api/v1/auth/register')
          .send(userData)
          .expect(StatusCodes.CREATED);

        expect(response.body.success).toBe(true);
        expect(response.body.data.user.email).toBe(userData.email);
        expect(response.body.data.user.password).toBeUndefined();
      });

      it('should reject registration with invalid data', async () => {
        const invalidData = {
          firstName: 'New',
          email: 'invalid-email',
          password: '123',
        };

        const response = await request(app)
          .post('/api/v1/auth/register')
          .send(invalidData)
          .expect(StatusCodes.BAD_REQUEST);

        expect(response.body.success).toBe(false);
      });
    });

    describe('User Login', () => {
      it('should login with valid credentials', async () => {
        const loginData = {
          email: testUsers.regular.email,
          password: 'TestPassword123!',
        };

        const response = await request(app)
          .post('/api/v1/auth/login')
          .send(loginData)
          .expect(StatusCodes.OK);

        expect(response.body.success).toBe(true);
        expect(response.body.data.token).toBeDefined();
        expect(response.body.data.user.email).toBe(loginData.email);
      });

      it('should reject login with invalid credentials', async () => {
        const invalidData = {
          email: testUsers.regular.email,
          password: 'WrongPassword',
        };

        const response = await request(app)
          .post('/api/v1/auth/login')
          .send(invalidData)
          .expect(StatusCodes.UNAUTHORIZED);

        expect(response.body.success).toBe(false);
      });
    });

    describe('Authentication Middleware', () => {
      it('should handle missing authentication token', async () => {
        const response = await request(app)
          .get('/api/v1/users/me')
          .expect(StatusCodes.UNAUTHORIZED);

        expect(response.body.success).toBe(false);
      });

      it('should handle invalid authentication token', async () => {
        const response = await request(app)
          .get('/api/v1/users/me')
          .set('Authorization', 'Bearer invalid-token')
          .expect(StatusCodes.UNAUTHORIZED);

        expect(response.body.success).toBe(false);
      });

      it('should allow access with valid token', async () => {
        const response = await request(app)
          .get('/api/v1/users/me')
          .set('Authorization', `Bearer ${testTokens.regular}`)
          .expect(StatusCodes.OK);

        expect(response.body.success).toBe(true);
        expect(response.body.data.user.email).toBe(testUsers.regular.email);
      });
    });
  });

  describe('Content Management Integration Tests', () => {
    describe('Posts Endpoints', () => {
      it('should get all published posts for public access', async () => {
        const response = await request(app)
          .get('/api/v1/posts')
          .expect(StatusCodes.OK);

        expect(response.body.success).toBe(true);
        expect(response.body.data.posts).toHaveLength(2); // Package and article
        expect(response.body.data.posts.every(post => post.status === 'Published')).toBe(true);
      });

      it('should filter posts by type', async () => {
        const response = await request(app)
          .get('/api/v1/posts?postType=Packages')
          .expect(StatusCodes.OK);

        expect(response.body.success).toBe(true);
        expect(response.body.data.posts).toHaveLength(1);
        expect(response.body.data.posts[0].postType).toBe('Packages');
      });

      it('should get featured posts', async () => {
        const response = await request(app)
          .get('/api/v1/posts/featured')
          .expect(StatusCodes.OK);

        expect(response.body.success).toBe(true);
        expect(response.body.data.posts).toHaveLength(1);
        expect(response.body.data.posts[0].isFeatured).toBe(true);
      });

      it('should create a post with staff role', async () => {
        const postData = {
          title: 'New Article',
          content: 'New article content',
          postType: 'Articles',
          category: testData.category._id.toString(),
          tags: ['new', 'article'],
        };

        const response = await request(app)
          .post('/api/v1/posts')
          .set('Authorization', `Bearer ${testTokens.staff}`)
          .send(postData)
          .expect(StatusCodes.CREATED);

        expect(response.body.success).toBe(true);
        expect(response.body.data.post.title).toBe('New Article');
        expect(response.body.data.post.slug).toBe('new-article');
      });

      it('should reject post creation for regular user', async () => {
        const postData = {
          title: 'Unauthorized Post',
          content: 'Should not be created',
          postType: 'Articles',
          category: testData.category._id.toString(),
        };

        const response = await request(app)
          .post('/api/v1/posts')
          .set('Authorization', `Bearer ${testTokens.regular}`)
          .send(postData)
          .expect(StatusCodes.FORBIDDEN);

        expect(response.body.success).toBe(false);
      });
    });

    describe('Categories Endpoints', () => {
      it('should get all categories for public access', async () => {
        const response = await request(app)
          .get('/api/v1/categories')
          .expect(StatusCodes.OK);

        expect(response.body.success).toBe(true);
        expect(response.body.data.categories).toHaveLength(1);
        expect(response.body.data.categories[0].name).toBe('Test Category');
      });

      it('should create a category with staff role', async () => {
        const categoryData = {
          name: 'New Category',
          description: 'New category description',
        };

        const response = await request(app)
          .post('/api/v1/categories')
          .set('Authorization', `Bearer ${testTokens.staff}`)
          .send(categoryData)
          .expect(StatusCodes.CREATED);

        expect(response.body.success).toBe(true);
        expect(response.body.data.category.name).toBe('New Category');
      });

      it('should reject category creation for regular user', async () => {
        const categoryData = {
          name: 'Unauthorized Category',
          description: 'Should not be created',
        };

        const response = await request(app)
          .post('/api/v1/categories')
          .set('Authorization', `Bearer ${testTokens.regular}`)
          .send(categoryData)
          .expect(StatusCodes.FORBIDDEN);

        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('Analytics Integration Tests', () => {
    it('should provide analytics access for managers', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/summary')
        .set('Authorization', `Bearer ${testTokens.manager}`)
        .expect(StatusCodes.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.metrics).toBeDefined();
    });

    it('should deny analytics access for regular users', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/summary')
        .set('Authorization', `Bearer ${testTokens.regular}`)
        .expect(StatusCodes.FORBIDDEN);

      expect(response.body.success).toBe(false);
    });

    it('should require authentication for analytics', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/summary')
        .expect(StatusCodes.UNAUTHORIZED);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Package Checkout Integration Tests', () => {
    it('should handle package purchase with authentication', async () => {
      const purchaseData = {
        paymentMethod: 'card',
        customerInfo: {
          firstName: 'Test',
          lastName: 'Customer',
          email: 'customer@test.com',
          phoneNumber: '+1234567895',
        },
      };

      const response = await request(app)
        .post(`/api/v1/products/packages/${testData.package._id}/purchase`)
        .set('Authorization', `Bearer ${testTokens.regular}`)
        .send(purchaseData)
        .expect(StatusCodes.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transaction).toBeDefined();
    });

    it('should reject package purchase without authentication', async () => {
      const purchaseData = {
        paymentMethod: 'card',
        customerInfo: {
          firstName: 'Test',
          lastName: 'Customer',
          email: 'customer@test.com',
          phoneNumber: '+1234567895',
        },
      };

      const response = await request(app)
        .post(`/api/v1/products/packages/${testData.package._id}/purchase`)
        .send(purchaseData)
        .expect(StatusCodes.UNAUTHORIZED);

      expect(response.body.success).toBe(false);
    });

    it('should handle invalid package ID', async () => {
      const purchaseData = {
        paymentMethod: 'card',
        customerInfo: {
          firstName: 'Test',
          lastName: 'Customer',
          email: 'customer@test.com',
          phoneNumber: '+1234567895',
        },
      };

      const response = await request(app)
        .post('/api/v1/products/packages/invalid-id/purchase')
        .set('Authorization', `Bearer ${testTokens.regular}`)
        .send(purchaseData)
        .expect(StatusCodes.BAD_REQUEST);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Visa Application Integration Tests', () => {
    it('should create visa application for authenticated user', async () => {
      const visaData = {
        destinationCountry: 'United States',
        visaType: 'Tourist',
        travelPurpose: 'Vacation',
        urgency: 'Standard',
      };

      const response = await request(app)
        .post('/api/v1/products/visa/apply')
        .set('Authorization', `Bearer ${testTokens.regular}`)
        .send(visaData)
        .expect(StatusCodes.CREATED);

      expect(response.body.success).toBe(true);
      expect(response.body.data.application.destinationCountry).toBe('United States');
      expect(response.body.data.application.status).toBe('Pending');
    });

    it('should create visa application for guest user', async () => {
      const visaData = {
        destinationCountry: 'Canada',
        visaType: 'Business',
        travelPurpose: 'Conference',
        urgency: 'Express',
        guestEmail: 'guest@test.com',
      };

      const response = await request(app)
        .post('/api/v1/products/visa/apply')
        .send(visaData)
        .expect(StatusCodes.CREATED);

      expect(response.body.success).toBe(true);
      expect(response.body.data.application.guestEmail).toBe('guest@test.com');
    });

    it('should get visa application details for owner', async () => {
      // Create a visa application first
      const visaApplication = await VisaApplication.create({
        userId: testUsers.regular._id,
        applicationReference: 'VISA_TEST_001',
        destinationCountry: 'United Kingdom',
        visaType: 'Tourist',
        travelPurpose: 'Tourism',
        urgency: 'Standard',
        status: 'Pending',
      });

      const response = await request(app)
        .get(`/api/v1/products/visa/${visaApplication._id}`)
        .set('Authorization', `Bearer ${testTokens.regular}`)
        .expect(StatusCodes.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.application.destinationCountry).toBe('United Kingdom');
    });

    it('should update visa application status by staff', async () => {
      // Create a visa application first
      const visaApplication = await VisaApplication.create({
        userId: testUsers.regular._id,
        applicationReference: 'VISA_TEST_002',
        destinationCountry: 'Germany',
        visaType: 'Business',
        travelPurpose: 'Conference',
        urgency: 'Express',
        status: 'Pending',
      });

      const updateData = {
        status: 'Under Review',
        notes: 'Application is being reviewed by our team',
      };

      const response = await request(app)
        .put(`/api/v1/products/visa/${visaApplication._id}/status`)
        .set('Authorization', `Bearer ${testTokens.staff}`)
        .send(updateData)
        .expect(StatusCodes.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.application.status).toBe('Under Review');
    });
  });

  describe('Complete User Journey Tests', () => {
    it('should complete full user registration to package purchase flow', async () => {
      // Step 1: User Registration
      const userData = {
        firstName: 'Journey',
        lastName: 'User',
        email: 'journey@test.com',
        phoneNumber: '+1234567896',
        password: 'JourneyPassword123!',
        confirmPassword: 'JourneyPassword123!',
      };

      const registrationResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(StatusCodes.CREATED);

      expect(registrationResponse.body.success).toBe(true);

      // Step 2: User Login
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: userData.email,
          password: userData.password,
        })
        .expect(StatusCodes.OK);

      const userToken = loginResponse.body.data.token;

      // Step 3: Browse Packages
      const packagesResponse = await request(app)
        .get('/api/v1/posts?postType=Packages')
        .expect(StatusCodes.OK);

      expect(packagesResponse.body.data.posts).toHaveLength(1);
      const selectedPackage = packagesResponse.body.data.posts[0];

      // Step 4: Purchase Package
      const purchaseData = {
        paymentMethod: 'card',
        customerInfo: {
          firstName: userData.firstName,
          lastName: userData.lastName,
          email: userData.email,
          phoneNumber: userData.phoneNumber,
        },
      };

      const purchaseResponse = await request(app)
        .post(`/api/v1/products/packages/${selectedPackage._id}/purchase`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(purchaseData)
        .expect(StatusCodes.OK);

      expect(purchaseResponse.body.success).toBe(true);
      expect(purchaseResponse.body.data.transaction).toBeDefined();

      // Step 5: Verify Analytics Update (for manager)
      const analyticsResponse = await request(app)
        .get('/api/v1/analytics/summary')
        .set('Authorization', `Bearer ${testTokens.manager}`)
        .expect(StatusCodes.OK);

      expect(analyticsResponse.body.success).toBe(true);
      expect(analyticsResponse.body.data.metrics.transactions.total).toBeGreaterThan(0);
    });

    it('should complete visa application workflow', async () => {
      // Step 1: Submit visa application
      const visaData = {
        destinationCountry: 'Germany',
        visaType: 'Business',
        travelPurpose: 'Business Meeting',
        urgency: 'Express',
      };

      const applicationResponse = await request(app)
        .post('/api/v1/products/visa/apply')
        .set('Authorization', `Bearer ${testTokens.regular}`)
        .send(visaData)
        .expect(StatusCodes.CREATED);

      const applicationId = applicationResponse.body.data.application._id;

      // Step 2: Check application status
      const statusResponse = await request(app)
        .get(`/api/v1/products/visa/${applicationId}`)
        .set('Authorization', `Bearer ${testTokens.regular}`)
        .expect(StatusCodes.OK);

      expect(statusResponse.body.data.application.status).toBe('Pending');

      // Step 3: Staff updates application status
      const updateData = {
        status: 'Under Review',
        notes: 'Application is being reviewed',
      };

      const updateResponse = await request(app)
        .put(`/api/v1/products/visa/${applicationId}/status`)
        .set('Authorization', `Bearer ${testTokens.staff}`)
        .send(updateData)
        .expect(StatusCodes.OK);

      expect(updateResponse.body.success).toBe(true);
      expect(updateResponse.body.data.application.status).toBe('Under Review');

      // Step 4: Manager approves application
      const approvalData = {
        status: 'Approved',
        notes: 'Application approved - visa processing will begin',
      };

      const approvalResponse = await request(app)
        .put(`/api/v1/products/visa/${applicationId}/status`)
        .set('Authorization', `Bearer ${testTokens.manager}`)
        .send(approvalData)
        .expect(StatusCodes.OK);

      expect(approvalResponse.body.success).toBe(true);
      expect(approvalResponse.body.data.application.status).toBe('Approved');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle validation errors properly', async () => {
      const invalidData = {
        title: '', // Empty title should fail validation
        content: 'Some content',
        postType: 'Articles',
      };

      const response = await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${testTokens.staff}`)
        .send(invalidData)
        .expect(StatusCodes.BAD_REQUEST);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBeDefined();
    });

    it('should handle authorization errors properly', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/summary')
        .set('Authorization', `Bearer ${testTokens.regular}`)
        .expect(StatusCodes.FORBIDDEN);

      expect(response.body.success).toBe(false);
    });
  });
});