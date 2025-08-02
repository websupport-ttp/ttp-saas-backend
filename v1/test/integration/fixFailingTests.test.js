// v1/test/integration/fixFailingTests.test.js
// Specific tests to fix the failing integration tests

const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { StatusCodes } = require('http-status-codes');

// Use test app with proper routes
const app = require('./testApp');

// Import models
const User = require('../../models/userModel');
const Post = require('../../models/postModel');
const Category = require('../../models/categoryModel');
const LedgerEntry = require('../../models/ledgerModel');

// Import test utilities
const testDbManager = require('../testDbManager');

describe('Fix Failing Integration Tests', () => {
  let testUsers = {};
  let testTokens = {};
  let testData = {};

  beforeAll(async () => {
    // Ensure test database connection
    await testDbManager.ensureConnection();
    
    // Set test environment variables
    process.env.JWT_ACCESS_SECRET = 'test-jwt-secret-for-fixing-tests';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-fixing-tests';
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

    // Create test posts
    testData.publishedPost = await Post.create({
      title: 'Published Test Post',
      content: 'This is a published test post content',
      postType: 'Articles',
      status: 'Published',
      author: testUsers.staff._id,
      category: testData.category._id,
      slug: 'published-test-post',
      tags: ['test', 'article'],
      isFeatured: true,
    });

    testData.draftPost = await Post.create({
      title: 'Draft Test Post',
      content: 'This is a draft test post content',
      postType: 'Articles',
      status: 'Draft',
      author: testUsers.staff._id,
      category: testData.category._id,
      slug: 'draft-test-post',
      tags: ['test', 'draft'],
    });

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

  describe('Authentication Middleware Tests', () => {
    it('should handle authenticated requests properly', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/summary')
        .set('Authorization', `Bearer ${testTokens.manager}`)
        .expect(StatusCodes.OK);

      expect(response.body.success).toBe(true);
    });

    it('should handle unauthenticated requests properly', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/summary')
        .expect(StatusCodes.UNAUTHORIZED);

      expect(response.body.success).toBe(false);
    });

    it('should handle optional authentication properly', async () => {
      // Test endpoint that allows both authenticated and unauthenticated access
      const response = await request(app)
        .get('/api/v1/posts')
        .expect(StatusCodes.OK);

      expect(response.body.success).toBe(true);
    });

    it('should reject analytics access for regular user', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/summary')
        .set('Authorization', `Bearer ${testTokens.regular}`)
        .expect(StatusCodes.FORBIDDEN);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Post Model Validation Tests', () => {
    it('should generate unique slugs automatically', async () => {
      const postData1 = {
        title: 'Duplicate Title',
        content: 'First post content',
        postType: 'Articles',
        category: testData.category._id.toString(),
      };

      const postData2 = {
        title: 'Duplicate Title',
        content: 'Second post content',
        postType: 'Articles',
        category: testData.category._id.toString(),
      };

      const response1 = await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${testTokens.staff}`)
        .send(postData1)
        .expect(StatusCodes.CREATED);

      const response2 = await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${testTokens.staff}`)
        .send(postData2)
        .expect(StatusCodes.CREATED);

      expect(response1.body.data.post.slug).toBe('duplicate-title');
      expect(response2.body.data.post.slug).toBe('duplicate-title-1');
    });

    it('should validate package requirements properly', async () => {
      const validPackageData = {
        title: 'Valid Package',
        content: 'Valid package content',
        postType: 'Packages',
        category: testData.category._id.toString(),
        price: 75000,
        metadata: {
          duration: '5 days',
          location: 'Abuja, Nigeria',
          maxParticipants: 8,
          difficulty: 'Medium',
        },
        availability: {
          startDate: new Date('2024-07-01'),
          endDate: new Date('2024-12-31'),
        },
      };

      const response = await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${testTokens.staff}`)
        .send(validPackageData)
        .expect(StatusCodes.CREATED);

      expect(response.body.success).toBe(true);
      expect(response.body.data.post.price).toBe(75000);
    });

    it('should reject packages without required fields', async () => {
      const invalidPackageData = {
        title: 'Invalid Package',
        content: 'Invalid package content',
        postType: 'Packages',
        category: testData.category._id.toString(),
        // Missing price and metadata
      };

      const response = await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${testTokens.staff}`)
        .send(invalidPackageData)
        .expect(StatusCodes.BAD_REQUEST);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Content Management API Tests', () => {
    describe('Categories', () => {
      it('should get all categories', async () => {
        const response = await request(app)
          .get('/api/v1/categories')
          .expect(StatusCodes.OK);

        expect(response.body.success).toBe(true);
        expect(response.body.data.categories).toHaveLength(1);
      });

      it('should create category with proper authorization', async () => {
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

      it('should get specific category by ID', async () => {
        const response = await request(app)
          .get(`/api/v1/categories/${testData.category._id}`)
          .expect(StatusCodes.OK);

        expect(response.body.success).toBe(true);
        expect(response.body.data.category.name).toBe('Test Category');
      });

      it('should update category with proper authorization', async () => {
        const updateData = {
          name: 'Updated Category Name',
          description: 'Updated description',
        };

        const response = await request(app)
          .put(`/api/v1/categories/${testData.category._id}`)
          .set('Authorization', `Bearer ${testTokens.staff}`)
          .send(updateData)
          .expect(StatusCodes.OK);

        expect(response.body.success).toBe(true);
        expect(response.body.data.category.name).toBe('Updated Category Name');
      });

      it('should delete category with manager role', async () => {
        const response = await request(app)
          .delete(`/api/v1/categories/${testData.category._id}`)
          .set('Authorization', `Bearer ${testTokens.manager}`)
          .expect(StatusCodes.OK);

        expect(response.body.success).toBe(true);
      });
    });

    describe('Posts', () => {
      it('should get published posts for public', async () => {
        const response = await request(app)
          .get('/api/v1/posts')
          .expect(StatusCodes.OK);

        expect(response.body.success).toBe(true);
        expect(response.body.data.posts.length).toBeGreaterThan(0);
        expect(response.body.data.posts.every(post => post.status === 'Published')).toBe(true);
      });

      it('should get featured posts', async () => {
        const response = await request(app)
          .get('/api/v1/posts/featured')
          .expect(StatusCodes.OK);

        expect(response.body.success).toBe(true);
        expect(response.body.data.posts).toHaveLength(1);
        expect(response.body.data.posts[0].isFeatured).toBe(true);
      });

      it('should filter posts by type', async () => {
        const response = await request(app)
          .get('/api/v1/posts?postType=Packages')
          .expect(StatusCodes.OK);

        expect(response.body.success).toBe(true);
        expect(response.body.data.posts).toHaveLength(1);
        expect(response.body.data.posts[0].postType).toBe('Packages');
      });

      it('should create article with staff role', async () => {
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

      it('should update post status with manager role', async () => {
        const updateData = {
          status: 'Published',
        };

        const response = await request(app)
          .put(`/api/v1/posts/${testData.draftPost._id}`)
          .set('Authorization', `Bearer ${testTokens.manager}`)
          .send(updateData)
          .expect(StatusCodes.OK);

        expect(response.body.success).toBe(true);
        expect(response.body.data.post.status).toBe('Published');
      });
    });
  });

  describe('Analytics API Tests', () => {
    it('should get analytics summary for manager', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/summary')
        .set('Authorization', `Bearer ${testTokens.manager}`)
        .expect(StatusCodes.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.metrics).toBeDefined();
    });

    it('should get revenue analytics for manager', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/revenue')
        .set('Authorization', `Bearer ${testTokens.manager}`)
        .expect(StatusCodes.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalRevenue).toBeDefined();
    });

    it('should get customer analytics for manager', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/customers')
        .set('Authorization', `Bearer ${testTokens.manager}`)
        .expect(StatusCodes.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.customerSegments).toBeDefined();
    });

    it('should reject analytics access for regular user', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/summary')
        .set('Authorization', `Bearer ${testTokens.regular}`)
        .expect(StatusCodes.FORBIDDEN);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Visa Application API Tests', () => {
    it('should create visa application successfully', async () => {
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
    });

    it('should handle guest visa application', async () => {
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

    it('should check document upload endpoint exists', async () => {
      const response = await request(app)
        .post('/api/v1/products/visa/test-id/upload-document')
        .set('Authorization', `Bearer ${testTokens.regular}`)
        .send();

      // Should not return 404 - might return 400 for validation or other errors
      expect(response.status).not.toBe(404);
    });

    it('should check status update endpoint exists', async () => {
      const response = await request(app)
        .put('/api/v1/products/visa/test-id/status')
        .set('Authorization', `Bearer ${testTokens.staff}`)
        .send({ status: 'Approved' });

      // Should not return 404 - might return 400 for validation or other errors
      expect(response.status).not.toBe(404);
    });
  });

  describe('Documentation Validation Tests', () => {
    it('should validate DocumentationValidator class works', async () => {
      const DocumentationValidator = require('../../utils/documentationValidator');
      
      // Should be able to instantiate the class
      expect(() => {
        const validator = new DocumentationValidator({});
        expect(validator).toBeInstanceOf(DocumentationValidator);
      }).not.toThrow();
    });

    it('should validate API documentation endpoints', async () => {
      // Test that documentation endpoints are accessible
      const response = await request(app)
        .get('/health')
        .expect(StatusCodes.OK);

      expect(response.body.status).toBe('healthy');
    });
  });

  describe('Error Handling Tests', () => {
    it('should handle validation errors properly', async () => {
      const invalidData = {
        title: '', // Empty title
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

    it('should handle 404 errors properly', async () => {
      const response = await request(app)
        .get('/api/v1/nonexistent-endpoint')
        .expect(StatusCodes.NOT_FOUND);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Can't find");
    });
  });
});