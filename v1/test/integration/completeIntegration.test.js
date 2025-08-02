// v1/test/integration/completeIntegration.test.js
// Comprehensive integration test suite covering all API endpoints

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
const VisaApplication = require('../../models/visaApplicationModel');

// Import test utilities
const testDbManager = require('../testDbManager');

describe('Complete Integration Test Suite', () => {
  let testUsers = {};
  let testTokens = {};
  let testData = {};

  beforeAll(async () => {
    // Ensure test database connection
    await testDbManager.ensureConnection();
    
    // Set test environment variables
    process.env.JWT_ACCESS_SECRET = 'test-jwt-secret-for-integration-tests';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-integration-tests';
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

  describe('Authentication Endpoints', () => {
    describe('POST /api/v1/auth/register', () => {
      it('should register a new user successfully', async () => {
        const userData = {
          firstName: 'New',
          lastName: 'User',
          email: 'newuser@test.com',
          phoneNumber: '+2348123456784',
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

    describe('POST /api/v1/auth/login', () => {
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
  });

  describe('Content Management Endpoints', () => {
    describe('Category Endpoints', () => {
      describe('GET /api/v1/categories', () => {
        it('should get all categories for public access', async () => {
          const response = await request(app)
            .get('/api/v1/categories')
            .expect(StatusCodes.OK);

          expect(response.body.success).toBe(true);
          expect(response.body.data.categories).toHaveLength(1);
          expect(response.body.data.categories[0].name).toBe('Test Category');
        });
      });

      describe('POST /api/v1/categories', () => {
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

          await request(app)
            .post('/api/v1/categories')
            .set('Authorization', `Bearer ${testTokens.regular}`)
            .send(categoryData)
            .expect(StatusCodes.FORBIDDEN);
        });

        it('should reject category creation without authentication', async () => {
          const categoryData = {
            name: 'Unauthenticated Category',
            description: 'Should not be created',
          };

          await request(app)
            .post('/api/v1/categories')
            .send(categoryData)
            .expect(StatusCodes.UNAUTHORIZED);
        });
      });
    });

    describe('Post Endpoints', () => {
      describe('GET /api/v1/posts', () => {
        it('should get only published posts for public access', async () => {
          const response = await request(app)
            .get('/api/v1/posts')
            .expect(StatusCodes.OK);

          expect(response.body.success).toBe(true);
          expect(response.body.data.posts).toHaveLength(2); // Published post and package
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
      });

      describe('POST /api/v1/posts', () => {
        it('should create an article with staff role', async () => {
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

        it('should create a package with required fields', async () => {
          const packageData = {
            title: 'New Package',
            content: 'New package content',
            postType: 'Packages',
            category: testData.category._id.toString(),
            price: 75000,
            metadata: {
              duration: '5 days',
              location: 'Abuja, Nigeria',
              includes: ['Hotel', 'Breakfast'],
              maxParticipants: 6,
              difficulty: 'Easy',
            },
            availability: {
              startDate: new Date('2024-08-01'),
              endDate: new Date('2024-12-31'),
            },
            tags: ['package', 'new'],
          };

          const response = await request(app)
            .post('/api/v1/posts')
            .set('Authorization', `Bearer ${testTokens.staff}`)
            .send(packageData)
            .expect(StatusCodes.CREATED);

          expect(response.body.success).toBe(true);
          expect(response.body.data.post.title).toBe('New Package');
          expect(response.body.data.post.price).toBe(75000);
        });

        it('should reject package creation without required fields', async () => {
          const invalidPackageData = {
            title: 'Invalid Package',
            content: 'Invalid package content',
            postType: 'Packages',
            category: testData.category._id.toString(),
            // Missing price and metadata
          };

          await request(app)
            .post('/api/v1/posts')
            .set('Authorization', `Bearer ${testTokens.staff}`)
            .send(invalidPackageData)
            .expect(StatusCodes.BAD_REQUEST);
        });

        it('should reject post creation for regular user', async () => {
          const postData = {
            title: 'Unauthorized Post',
            content: 'Should not be created',
            postType: 'Articles',
            category: testData.category._id.toString(),
          };

          await request(app)
            .post('/api/v1/posts')
            .set('Authorization', `Bearer ${testTokens.regular}`)
            .send(postData)
            .expect(StatusCodes.FORBIDDEN);
        });
      });

      describe('GET /api/v1/posts/featured', () => {
        it('should get featured posts', async () => {
          const response = await request(app)
            .get('/api/v1/posts/featured')
            .expect(StatusCodes.OK);

          expect(response.body.success).toBe(true);
          expect(response.body.data.posts).toHaveLength(1);
          expect(response.body.data.posts[0].isFeatured).toBe(true);
        });
      });
    });
  });

  describe('Analytics Endpoints', () => {
    describe('GET /api/v1/analytics/summary', () => {
      it('should get analytics summary for manager', async () => {
        const response = await request(app)
          .get('/api/v1/analytics/summary')
          .set('Authorization', `Bearer ${testTokens.manager}`)
          .expect(StatusCodes.OK);

        expect(response.body.success).toBe(true);
        expect(response.body.data.metrics).toBeDefined();
        expect(response.body.data.metrics.transactions).toBeDefined();
      });

      it('should reject analytics access for regular user', async () => {
        await request(app)
          .get('/api/v1/analytics/summary')
          .set('Authorization', `Bearer ${testTokens.regular}`)
          .expect(StatusCodes.FORBIDDEN);
      });
    });
  });

  describe('Visa Application Endpoints', () => {
    describe('POST /api/v1/products/visa/apply', () => {
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
    });

    describe('GET /api/v1/products/visa/:id', () => {
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
    });
  });

  describe('Product Endpoints', () => {
    describe('POST /api/v1/products/packages/:id/purchase', () => {
      it('should purchase a package successfully', async () => {
        const purchaseData = {
          customerDetails: {
            firstName: 'Test',
            lastName: 'Customer',
            email: 'customer@test.com',
            phoneNumber: '+2348123456785',
          },
          participants: 1,
          specialRequests: 'Test package purchase',
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
    });
  });

  describe('User Journey Integration Tests', () => {
    it('should complete full user registration to package purchase flow', async () => {
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

      // Step 2: User Login
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          emailOrPhone: userData.email,
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
        customerDetails: {
          firstName: userData.firstName,
          lastName: userData.lastName,
          email: userData.email,
          phoneNumber: userData.phoneNumber,
        },
        participants: 1,
        specialRequests: 'Test booking from complete integration',
      };

      const purchaseResponse = await request(app)
        .post(`/api/v1/products/packages/${selectedPackage._id}/purchase`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(purchaseData)
        .expect(StatusCodes.OK);

      expect(purchaseResponse.body.success).toBe(true);
      expect(purchaseResponse.body.data.authorizationUrl).toBeDefined();
      expect(purchaseResponse.body.data.reference).toBeDefined();

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
    });
  });

  describe('Error Handling Integration', () => {
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
  });
});