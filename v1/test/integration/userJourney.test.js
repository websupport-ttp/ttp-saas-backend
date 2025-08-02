// v1/test/integration/userJourney.test.js
// End-to-end user journey tests from registration to package purchase

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

describe('End-to-End User Journey Tests', () => {
  let testData = {};

  beforeAll(async () => {
    // Ensure test database connection
    await testDbManager.ensureConnection();
    
    // Set test environment variables
    process.env.JWT_ACCESS_SECRET = 'test-jwt-secret-for-user-journey';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-user-journey';
  });

  beforeEach(async () => {
    // Clean database before each test
    await testDbManager.cleanDatabase();
    
    // Create test data for user journeys
    const staffUser = await User.create({
      firstName: 'Staff',
      lastName: 'User',
      email: 'staff@test.com',
      phoneNumber: '+2348123456780',
      password: 'StaffPassword123!',
      role: 'Staff',
      isEmailVerified: true,
      isPhoneVerified: true,
    });

    // Create test category
    testData.category = await Category.create({
      name: 'Travel Packages',
      description: 'Amazing travel packages',
      slug: 'travel-packages',
      isActive: true,
    });

    // Create test package
    testData.package = await Post.create({
      title: 'Amazing Lagos Tour Package',
      content: 'Experience the best of Lagos with our comprehensive tour package',
      postType: 'Packages',
      status: 'Published',
      author: staffUser._id,
      category: testData.category._id,
      slug: 'amazing-lagos-tour-package',
      price: 75000,
      metadata: {
        duration: '5 days',
        location: 'Lagos, Nigeria',
        includes: ['Hotel', 'Meals', 'Transportation', 'Tour Guide'],
        maxParticipants: 12,
        difficulty: 'Easy',
      },
      availability: {
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-12-31'),
      },
      tags: ['lagos', 'tour', 'package'],
    });

    // Create additional test users for visa workflow
    testData.regularUser = await User.create({
      firstName: 'Regular',
      lastName: 'User',
      email: 'regular@test.com',
      phoneNumber: '+2348123456781',
      password: 'RegularPassword123!',
      role: 'User',
      isEmailVerified: true,
      isPhoneVerified: true,
    });

    testData.staffUser = staffUser;

    testData.managerUser = await User.create({
      firstName: 'Manager',
      lastName: 'User',
      email: 'manager@test.com',
      phoneNumber: '+2348123456782',
      password: 'ManagerPassword123!',
      role: 'Manager',
      isEmailVerified: true,
      isPhoneVerified: true,
    });
  });

  afterAll(async () => {
    await testDbManager.disconnect();
  });

  describe('Complete User Registration to Package Purchase Flow', () => {
    it('should complete full user journey from registration to package purchase', async () => {
      // Step 1: User Registration
      const userData = {
        firstName: 'Journey',
        lastName: 'User',
        email: 'journey@test.com',
        phoneNumber: '+2348123456789',
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
      expect(packageDetailsResponse.body.data.post.price).toBe(75000);

      // Step 5: Purchase Package
      const purchaseData = {
        customerDetails: {
          firstName: userData.firstName,
          lastName: userData.lastName,
          email: userData.email,
          phoneNumber: userData.phoneNumber,
        },
        participants: 1,
        specialRequests: 'Test booking from integration test',
      };

      const purchaseResponse = await request(app)
        .post(`/api/v1/products/packages/${selectedPackage._id}/purchase`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(purchaseData)
        .expect(StatusCodes.OK);

      expect(purchaseResponse.body.success).toBe(true);
      expect(purchaseResponse.body.data.authorizationUrl).toBeDefined();
      expect(purchaseResponse.body.data.reference).toBeDefined();

      // Step 6: Verify User Profile Updated
      const profileResponse = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(StatusCodes.OK);

      expect(profileResponse.body.success).toBe(true);
      expect(profileResponse.body.data.user.email).toBe(userData.email);
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

      // Create a regular user token for testing
      const regularUserToken = jwt.sign(
        { 
          userId: testData.regularUser._id.toString(),
          email: testData.regularUser.email,
          role: testData.regularUser.role,
          firstName: testData.regularUser.firstName,
          lastName: testData.regularUser.lastName
        },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: '1h' }
      );

      const applicationResponse = await request(app)
        .post('/api/v1/products/visa/apply')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send(visaData)
        .expect(StatusCodes.CREATED);

      expect(applicationResponse.body.success).toBe(true);
      expect(applicationResponse.body.data.application.status).toBe('Pending');
      
      const applicationId = applicationResponse.body.data.application._id;

      // Step 2: User checks application status
      const statusResponse = await request(app)
        .get(`/api/v1/products/visa/${applicationId}`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(StatusCodes.OK);

      expect(statusResponse.body.success).toBe(true);
      expect(statusResponse.body.data.application.status).toBe('Pending');

      // Step 3: Staff reviews and updates application status
      const staffToken = jwt.sign(
        { 
          userId: testData.staffUser._id.toString(),
          email: testData.staffUser.email,
          role: testData.staffUser.role,
          firstName: testData.staffUser.firstName,
          lastName: testData.staffUser.lastName
        },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: '1h' }
      );

      const updateData = {
        status: 'Under Review',
        notes: 'Application is being reviewed by our team',
      };

      const updateResponse = await request(app)
        .put(`/api/v1/products/visa/${applicationId}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send(updateData)
        .expect(StatusCodes.OK);

      expect(updateResponse.body.success).toBe(true);
      expect(updateResponse.body.data.application.status).toBe('Under Review');

      // Step 4: Final approval by manager
      const managerToken = jwt.sign(
        { 
          userId: testData.managerUser._id.toString(),
          email: testData.managerUser.email,
          role: testData.managerUser.role,
          firstName: testData.managerUser.firstName,
          lastName: testData.managerUser.lastName
        },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: '1h' }
      );

      const approvalData = {
        status: 'Approved',
        notes: 'Application approved - visa processing will begin',
      };

      const approvalResponse = await request(app)
        .put(`/api/v1/products/visa/${applicationId}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
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
        guestPhoneNumber: '+2348123456798',
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

  describe('Analytics Integration for User Journeys', () => {
    it('should update analytics after successful package purchase', async () => {
      // Create manager token for analytics access
      const managerToken = jwt.sign(
        { 
          userId: testData.managerUser._id.toString(),
          email: testData.managerUser.email,
          role: testData.managerUser.role,
          firstName: testData.managerUser.firstName,
          lastName: testData.managerUser.lastName
        },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: '1h' }
      );

      // Get initial analytics
      const initialAnalyticsResponse = await request(app)
        .get('/api/v1/analytics/summary')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(StatusCodes.OK);

      const initialTransactionCount = initialAnalyticsResponse.body.data.metrics.transactions.total;

      // Create a user and make a purchase
      const userData = {
        firstName: 'Analytics',
        lastName: 'User',
        email: 'analytics@test.com',
        phoneNumber: '+2348123456797',
        password: 'AnalyticsPassword123!',
        confirmPassword: 'AnalyticsPassword123!',
      };

      const registrationResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(StatusCodes.CREATED);

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          emailOrPhone: userData.email,
          password: userData.password,
        })
        .expect(StatusCodes.OK);

      const userToken = loginResponse.body.data.token;

      // Purchase a package
      const purchaseData = {
        customerDetails: {
          firstName: userData.firstName,
          lastName: userData.lastName,
          email: userData.email,
          phoneNumber: userData.phoneNumber,
        },
        participants: 1,
        specialRequests: 'Test booking for analytics',
      };

      await request(app)
        .post(`/api/v1/products/packages/${testData.package._id}/purchase`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(purchaseData)
        .expect(StatusCodes.OK);

      // Check updated analytics
      const updatedAnalyticsResponse = await request(app)
        .get('/api/v1/analytics/summary')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(StatusCodes.OK);

      const updatedTransactionCount = updatedAnalyticsResponse.body.data.metrics.transactions.total;
      expect(updatedTransactionCount).toBeGreaterThan(initialTransactionCount);
    });
  });

  describe('Error Handling in User Journeys', () => {
    it('should handle authentication errors gracefully', async () => {
      const response = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(StatusCodes.UNAUTHORIZED);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('token');
    });

    it('should handle validation errors in registration', async () => {
      const invalidUserData = {
        firstName: 'Test',
        email: 'invalid-email',
        password: '123', // Too short
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(invalidUserData)
        .expect(StatusCodes.BAD_REQUEST);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBeDefined();
    });

    it('should handle package purchase errors', async () => {
      const regularUserToken = jwt.sign(
        { 
          userId: testData.regularUser._id.toString(),
          email: testData.regularUser.email,
          role: testData.regularUser.role,
          firstName: testData.regularUser.firstName,
          lastName: testData.regularUser.lastName
        },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: '1h' }
      );

      const invalidPurchaseData = {
        // Missing customerDetails which is required
        participants: 1,
      };

      const response = await request(app)
        .post(`/api/v1/products/packages/${testData.package._id}/purchase`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send(invalidPurchaseData)
        .expect(StatusCodes.BAD_REQUEST);

      expect(response.body.success).toBe(false);
    });
  });
});