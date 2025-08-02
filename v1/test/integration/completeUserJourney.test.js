// v1/test/integration/completeUserJourney.test.js
// Complete end-to-end user journey integration tests

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

describe('Complete User Journey Integration Tests', () => {
  let testUsers = {};
  let testTokens = {};
  let testData = {};

  beforeAll(async () => {
    // Ensure test database connection
    await testDbManager.ensureConnection();
    
    // Set test environment variables
    process.env.JWT_ACCESS_SECRET = 'test-jwt-secret-for-complete-journey';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-complete-journey';
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
      phoneNumber: '+2348123456780',
      password: userPassword,
      role: 'Admin',
      isEmailVerified: true,
      isPhoneVerified: true,
    });

    testUsers.manager = await User.create({
      firstName: 'Manager',
      lastName: 'User',
      email: 'manager@test.com',
      phoneNumber: '+2348123456781',
      password: userPassword,
      role: 'Manager',
      isEmailVerified: true,
      isPhoneVerified: true,
    });

    testUsers.staff = await User.create({
      firstName: 'Staff',
      lastName: 'User',
      email: 'staff@test.com',
      phoneNumber: '+2348123456782',
      password: userPassword,
      role: 'Staff',
      isEmailVerified: true,
      isPhoneVerified: true,
    });

    testUsers.regular = await User.create({
      firstName: 'Regular',
      lastName: 'User',
      email: 'user@test.com',
      phoneNumber: '+2348123456783',
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

  describe('Complete Registration to Package Purchase Flow', () => {
    it('should complete full user journey from registration to package purchase', async () => {
      // Step 1: User Registration
      const userData = {
        firstName: 'Journey',
        lastName: 'User',
        email: 'journey@test.com',
        phoneNumber: '+2348123456786',
        password: 'JourneyPassword123!',
        confirmPassword: 'JourneyPassword123!',
      };

      const registrationResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(StatusCodes.CREATED);

      expect(registrationResponse.body.success).toBe(true);
      expect(registrationResponse.body.data.user.email).toBe(userData.email);

      // Step 2: User Login
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          emailOrPhone: userData.email,
          password: userData.password,
        })
        .expect(StatusCodes.OK);

      const userToken = loginResponse.body.data.token;
      expect(userToken).toBeDefined();

      // Step 3: Browse Available Packages
      const packagesResponse = await request(app)
        .get('/api/v1/posts?postType=Packages')
        .expect(StatusCodes.OK);

      expect(packagesResponse.body.success).toBe(true);
      expect(packagesResponse.body.data.posts).toHaveLength(1);
      const selectedPackage = packagesResponse.body.data.posts[0];

      // Step 4: Get Package Details
      const packageDetailsResponse = await request(app)
        .get(`/api/v1/posts/${selectedPackage._id}`)
        .expect(StatusCodes.OK);

      expect(packageDetailsResponse.body.success).toBe(true);
      expect(packageDetailsResponse.body.data.post.price).toBe(50000);

      // Step 5: Purchase Package
      const purchaseData = {
        customerDetails: {
          firstName: userData.firstName,
          lastName: userData.lastName,
          email: userData.email,
          phoneNumber: userData.phoneNumber,
        },
        participants: 1,
        specialRequests: 'Test booking from complete user journey',
      };

      const purchaseResponse = await request(app)
        .post(`/api/v1/products/packages/${selectedPackage._id}/purchase`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(purchaseData)
        .expect(StatusCodes.OK);

      expect(purchaseResponse.body.success).toBe(true);
      expect(purchaseResponse.body.data.authorizationUrl).toBeDefined();
      expect(purchaseResponse.body.data.reference).toBeDefined();

      // Step 6: Verify Analytics Update (for manager)
      const analyticsResponse = await request(app)
        .get('/api/v1/analytics/summary')
        .set('Authorization', `Bearer ${testTokens.manager}`)
        .expect(StatusCodes.OK);

      expect(analyticsResponse.body.success).toBe(true);
      expect(analyticsResponse.body.data.metrics).toBeDefined();
    });

    it('should handle guest user package browsing', async () => {
      // Guest users should be able to browse packages without authentication
      const packagesResponse = await request(app)
        .get('/api/v1/posts?postType=Packages')
        .expect(StatusCodes.OK);

      expect(packagesResponse.body.success).toBe(true);
      expect(packagesResponse.body.data.posts).toHaveLength(1);

      // Guest users should be able to view package details
      const packageId = packagesResponse.body.data.posts[0]._id;
      const packageDetailsResponse = await request(app)
        .get(`/api/v1/posts/${packageId}`)
        .expect(StatusCodes.OK);

      expect(packageDetailsResponse.body.success).toBe(true);
      expect(packageDetailsResponse.body.data.post.postType).toBe('Packages');
    });
  });

  describe('Complete Visa Application Workflow', () => {
    it('should complete visa application from submission to approval', async () => {
      // Step 1: User submits visa application
      const visaData = {
        destinationCountry: 'United States',
        visaType: 'Tourist',
        travelPurpose: 'Vacation',
        urgency: 'Standard',
      };

      const applicationResponse = await request(app)
        .post('/api/v1/products/visa/apply')
        .set('Authorization', `Bearer ${testTokens.regular}`)
        .send(visaData)
        .expect(StatusCodes.CREATED);

      expect(applicationResponse.body.success).toBe(true);
      expect(applicationResponse.body.data.application.status).toBe('Pending');
      
      const applicationId = applicationResponse.body.data.application._id;

      // Step 2: User checks application status
      const statusResponse = await request(app)
        .get(`/api/v1/products/visa/${applicationId}`)
        .set('Authorization', `Bearer ${testTokens.regular}`)
        .expect(StatusCodes.OK);

      expect(statusResponse.body.success).toBe(true);
      expect(statusResponse.body.data.application.status).toBe('Pending');

      // Step 3: Staff reviews and updates application status
      const updateData = {
        status: 'Under Review',
        notes: 'Application is being reviewed by our team',
      };

      const updateResponse = await request(app)
        .put(`/api/v1/products/visa/${applicationId}/status`)
        .set('Authorization', `Bearer ${testTokens.staff}`)
        .send(updateData)
        .expect(StatusCodes.OK);

      expect(updateResponse.body.success).toBe(true);
      expect(updateResponse.body.data.application.status).toBe('Under Review');

      // Step 4: Final approval by manager
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

    it('should handle guest visa application', async () => {
      const guestVisaData = {
        destinationCountry: 'Canada',
        visaType: 'Business',
        travelPurpose: 'Conference',
        urgency: 'Express',
        guestEmail: 'guest@test.com',
      };

      const response = await request(app)
        .post('/api/v1/products/visa/apply')
        .send(guestVisaData)
        .expect(StatusCodes.CREATED);

      expect(response.body.success).toBe(true);
      expect(response.body.data.application.guestEmail).toBe('guest@test.com');
      expect(response.body.data.application.status).toBe('Pending');
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
        customerDetails: {
          firstName: 'Test',
          lastName: 'Customer',
          email: 'customer@test.com',
          phoneNumber: '+2348123456785',
        },
        participants: 1,
        specialRequests: 'Test purchase with authentication',
      };

      const response = await request(app)
        .post(`/api/v1/products/packages/${testData.package._id}/purchase`)
        .set('Authorization', `Bearer ${testTokens.regular}`)
        .send(purchaseData)
        .expect(StatusCodes.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.authorizationUrl).toBeDefined();
      expect(response.body.data.reference).toBeDefined();
    });

    it('should reject package purchase without authentication', async () => {
      const purchaseData = {
        customerDetails: {
          firstName: 'Test',
          lastName: 'Customer',
          email: 'customer@test.com',
          phoneNumber: '+2348123456785',
        },
        participants: 1,
        specialRequests: 'Test purchase without authentication',
      };

      const response = await request(app)
        .post(`/api/v1/products/packages/${testData.package._id}/purchase`)
        .send(purchaseData)
        .expect(StatusCodes.UNAUTHORIZED);

      expect(response.body.success).toBe(false);
    });

    it('should handle invalid package ID', async () => {
      const purchaseData = {
        customerDetails: {
          firstName: 'Test',
          lastName: 'Customer',
          email: 'customer@test.com',
          phoneNumber: '+2348123456785',
        },
        participants: 1,
        specialRequests: 'Test purchase with invalid ID',
      };

      const response = await request(app)
        .post('/api/v1/products/packages/invalid-id/purchase')
        .set('Authorization', `Bearer ${testTokens.regular}`)
        .send(purchaseData)
        .expect(StatusCodes.BAD_REQUEST);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Error Handling Integration Tests', () => {
    it('should handle 404 errors properly', async () => {
      const response = await request(app)
        .get('/api/v1/nonexistent-endpoint')
        .expect(StatusCodes.NOT_FOUND);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Can't find");
    });

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

    it('should handle authentication errors properly', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/summary')
        .set('Authorization', 'Bearer invalid-token')
        .expect(StatusCodes.UNAUTHORIZED);

      expect(response.body.success).toBe(false);
    });

    it('should handle authorization errors properly', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/summary')
        .set('Authorization', `Bearer ${testTokens.regular}`)
        .expect(StatusCodes.FORBIDDEN);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Content Management Integration Tests', () => {
    it('should allow public access to published posts', async () => {
      const response = await request(app)
        .get('/api/v1/posts')
        .expect(StatusCodes.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.posts).toHaveLength(1);
      expect(response.body.data.posts[0].status).toBe('Published');
    });

    it('should allow staff to create posts', async () => {
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
    });

    it('should reject post creation for regular users', async () => {
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
});