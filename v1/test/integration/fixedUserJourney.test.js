// v1/test/integration/fixedUserJourney.test.js
// Fixed end-to-end user journey tests with proper authentication

const request = require('supertest');
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

describe('Fixed User Journey Integration Tests', () => {
  let testData = {};

  beforeAll(async () => {
    // Ensure test database connection
    await testDbManager.ensureConnection();
    
    // Set test environment variables
    process.env.JWT_ACCESS_SECRET = 'test-jwt-secret-for-fixed-journey';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-fixed-journey';
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

  describe('Basic Route Accessibility Tests', () => {
    it('should access public routes without authentication', async () => {
      // Test public posts endpoint
      const postsResponse = await request(app)
        .get('/api/v1/posts')
        .expect(StatusCodes.OK);

      expect(postsResponse.body.success).toBe(true);
      expect(postsResponse.body.data.posts).toHaveLength(1);

      // Test public categories endpoint
      const categoriesResponse = await request(app)
        .get('/api/v1/categories')
        .expect(StatusCodes.OK);

      expect(categoriesResponse.body.success).toBe(true);
      expect(categoriesResponse.body.data.categories).toHaveLength(1);
    });

    it('should access package details without authentication', async () => {
      const packageDetailsResponse = await request(app)
        .get(`/api/v1/posts/${testData.package._id}`)
        .expect(StatusCodes.OK);

      expect(packageDetailsResponse.body.success).toBe(true);
      expect(packageDetailsResponse.body.data.post.postType).toBe('Packages');
      expect(packageDetailsResponse.body.data.post.price).toBe(75000);
    });
  });

  describe('User Registration and Authentication Flow', () => {
    it('should register a new user successfully', async () => {
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
      expect(registrationResponse.body.data.user.password).toBeUndefined();
    });

    it('should login with valid credentials', async () => {
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          emailOrPhone: testData.regularUser.email,
          password: 'RegularPassword123!',
        })
        .expect(StatusCodes.OK);

      expect(loginResponse.body.success).toBe(true);
      expect(loginResponse.body.data.token).toBeDefined();
      expect(loginResponse.body.data.user.email).toBe(testData.regularUser.email);
    });

    it('should reject login with invalid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          emailOrPhone: testData.regularUser.email,
          password: 'WrongPassword',
        })
        .expect(StatusCodes.UNAUTHORIZED);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Package Purchase Flow', () => {
    it('should handle guest package purchase', async () => {
      const purchaseData = {
        customerDetails: {
          firstName: 'Guest',
          lastName: 'Customer',
          email: 'guest@test.com',
          phoneNumber: '+2348123456788',
        },
        participants: 1,
        specialRequests: 'Test guest booking',
      };

      const purchaseResponse = await request(app)
        .post(`/api/v1/products/packages/${testData.package._id}/purchase`)
        .send(purchaseData)
        .expect(StatusCodes.OK);

      expect(purchaseResponse.body.success).toBe(true);
      expect(purchaseResponse.body.data.authorizationUrl).toBeDefined();
      expect(purchaseResponse.body.data.reference).toBeDefined();
    });

    it('should handle authenticated user package purchase', async () => {
      // First login to get a valid token
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          emailOrPhone: testData.regularUser.email,
          password: 'RegularPassword123!',
        })
        .expect(StatusCodes.OK);

      const userToken = loginResponse.body.data.token;

      const purchaseData = {
        customerDetails: {
          firstName: testData.regularUser.firstName,
          lastName: testData.regularUser.lastName,
          email: testData.regularUser.email,
          phoneNumber: testData.regularUser.phoneNumber,
        },
        participants: 1,
        specialRequests: 'Test authenticated booking',
      };

      const purchaseResponse = await request(app)
        .post(`/api/v1/products/packages/${testData.package._id}/purchase`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(purchaseData)
        .expect(StatusCodes.OK);

      expect(purchaseResponse.body.success).toBe(true);
      expect(purchaseResponse.body.data.authorizationUrl).toBeDefined();
      expect(purchaseResponse.body.data.reference).toBeDefined();
    });

    it('should reject package purchase with missing customer details', async () => {
      const invalidPurchaseData = {
        participants: 1,
        specialRequests: 'Missing customer details',
      };

      const response = await request(app)
        .post(`/api/v1/products/packages/${testData.package._id}/purchase`)
        .send(invalidPurchaseData)
        .expect(StatusCodes.BAD_REQUEST);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Visa Application Flow', () => {
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

    it('should handle authenticated user visa application', async () => {
      // First login to get a valid token
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          emailOrPhone: testData.regularUser.email,
          password: 'RegularPassword123!',
        })
        .expect(StatusCodes.OK);

      const userToken = loginResponse.body.data.token;

      const visaData = {
        destinationCountry: 'United States',
        visaType: 'Tourist',
        travelPurpose: 'Vacation',
        urgency: 'Standard',
      };

      const applicationResponse = await request(app)
        .post('/api/v1/products/visa/apply')
        .set('Authorization', `Bearer ${userToken}`)
        .send(visaData)
        .expect(StatusCodes.CREATED);

      expect(applicationResponse.body.success).toBe(true);
      expect(applicationResponse.body.data.application.status).toBe('Pending');
      expect(applicationResponse.body.data.application.destinationCountry).toBe('United States');
    });

    it('should reject visa application with missing required fields', async () => {
      const invalidVisaData = {
        destinationCountry: 'Germany',
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/v1/products/visa/apply')
        .send(invalidVisaData)
        .expect(StatusCodes.BAD_REQUEST);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Complete User Journey', () => {
    it('should complete registration to package purchase flow', async () => {
      // Step 1: User Registration
      const userData = {
        firstName: 'Complete',
        lastName: 'Journey',
        email: 'complete@test.com',
        phoneNumber: '+2348123456799',
        password: 'CompletePassword123!',
        confirmPassword: 'CompletePassword123!',
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
        specialRequests: 'Complete journey test booking',
      };

      const purchaseResponse = await request(app)
        .post(`/api/v1/products/packages/${selectedPackage._id}/purchase`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(purchaseData)
        .expect(StatusCodes.OK);

      expect(purchaseResponse.body.success).toBe(true);
      expect(purchaseResponse.body.data.authorizationUrl).toBeDefined();
      expect(purchaseResponse.body.data.reference).toBeDefined();

      // Step 6: Verify User Profile Access
      const profileResponse = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(StatusCodes.OK);

      expect(profileResponse.body.success).toBe(true);
      expect(profileResponse.body.data.user.email).toBe(userData.email);
    });
  });

  describe('Error Handling Tests', () => {
    it('should handle 404 errors properly', async () => {
      const response = await request(app)
        .get('/api/v1/nonexistent-endpoint')
        .expect(StatusCodes.NOT_FOUND);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Can't find");
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

    it('should handle authentication errors gracefully', async () => {
      const response = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(StatusCodes.UNAUTHORIZED);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Authentication');
    });
  });

  describe('Analytics Access Tests', () => {
    it('should require authentication for analytics', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/summary')
        .expect(StatusCodes.UNAUTHORIZED);

      expect(response.body.success).toBe(false);
    });

    it('should allow manager access to analytics', async () => {
      // Login as manager
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          emailOrPhone: testData.managerUser.email,
          password: 'ManagerPassword123!',
        })
        .expect(StatusCodes.OK);

      const managerToken = loginResponse.body.data.token;

      const analyticsResponse = await request(app)
        .get('/api/v1/analytics/summary')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(StatusCodes.OK);

      expect(analyticsResponse.body.success).toBe(true);
      expect(analyticsResponse.body.data.metrics).toBeDefined();
    });

    it('should deny regular user access to analytics', async () => {
      // Login as regular user
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          emailOrPhone: testData.regularUser.email,
          password: 'RegularPassword123!',
        })
        .expect(StatusCodes.OK);

      const userToken = loginResponse.body.data.token;

      const response = await request(app)
        .get('/api/v1/analytics/summary')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(StatusCodes.FORBIDDEN);

      expect(response.body.success).toBe(false);
    });
  });
});