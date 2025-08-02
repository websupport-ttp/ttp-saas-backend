// v1/test/integration/debugIntegration.test.js
// Debug integration test to understand response format

const request = require('supertest');
const { StatusCodes } = require('http-status-codes');

// Use test app with proper routes
const app = require('./testApp');

// Import models
const User = require('../../models/userModel');
const Post = require('../../models/postModel');
const Category = require('../../models/categoryModel');

// Import test utilities
const testDbManager = require('../testDbManager');

describe('Debug Integration Test Suite', () => {
  let testData = {};

  beforeAll(async () => {
    // Ensure test database connection
    await testDbManager.ensureConnection();
    
    // Set test environment variables
    process.env.JWT_ACCESS_SECRET = 'test-jwt-secret-debug';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-debug';
  });

  beforeEach(async () => {
    // Clean database before each test
    await testDbManager.cleanDatabase();
    
    // Create test data
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

    // Create test package with proper availability
    testData.package = await Post.create({
      title: 'Amazing Lagos Tour Package',
      content: 'Experience the best of Lagos with our comprehensive tour package',
      postType: 'Packages',
      status: 'Published',
      author: staffUser._id,
      category: testData.category._id,
      slug: 'amazing-lagos-tour-package',
      price: 75000,
      isActive: true,
      metadata: {
        duration: '5 days',
        location: 'Lagos, Nigeria',
        includes: ['Hotel', 'Meals', 'Transportation', 'Tour Guide'],
        maxParticipants: 12,
        difficulty: 'Easy',
      },
      availability: {
        isAvailable: true,
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-12-31'),
      },
      tags: ['lagos', 'tour', 'package'],
    });

    testData.staffUser = staffUser;
  });

  afterAll(async () => {
    await testDbManager.disconnect();
  });

  describe('Response Format Debug Tests', () => {
    it('should debug posts response format', async () => {
      const response = await request(app)
        .get('/api/v1/posts')
        .expect(StatusCodes.OK);

      console.log('Posts response body:', JSON.stringify(response.body, null, 2));
      console.log('Posts response keys:', Object.keys(response.body));
      
      // Just check that we get a response
      expect(response.body).toBeDefined();
      expect(response.body.data).toBeDefined();
      expect(response.body.data.posts).toBeDefined();
    });

    it('should debug categories response format', async () => {
      const response = await request(app)
        .get('/api/v1/categories')
        .expect(StatusCodes.OK);

      console.log('Categories response body:', JSON.stringify(response.body, null, 2));
      console.log('Categories response keys:', Object.keys(response.body));
      
      // Just check that we get a response
      expect(response.body).toBeDefined();
      expect(response.body.data).toBeDefined();
      expect(response.body.data.categories).toBeDefined();
    });

    it('should debug package purchase response format', async () => {
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

      const response = await request(app)
        .post(`/api/v1/products/packages/${testData.package._id}/purchase`)
        .send(purchaseData);

      console.log('Package purchase response status:', response.status);
      console.log('Package purchase response body:', JSON.stringify(response.body, null, 2));
      console.log('Package purchase response keys:', Object.keys(response.body));
      
      // Just check that we get a response
      expect(response.body).toBeDefined();
    });

    it('should debug visa application response format', async () => {
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
        .send(guestVisaData);

      console.log('Visa application response status:', response.status);
      console.log('Visa application response body:', JSON.stringify(response.body, null, 2));
      console.log('Visa application response keys:', Object.keys(response.body));
      
      // Just check that we get a response
      expect(response.body).toBeDefined();
    });
  });
});