// v1/test/integration/packageCheckout.test.js
const request = require('supertest');
const { StatusCodes } = require('http-status-codes');
const mongoose = require('mongoose');
const app = require('../../../app');
const User = require('../../models/userModel');
const Post = require('../../models/postModel');
const Ledger = require('../../models/ledgerModel');
const redisClient = require('../../config/redis');
const paystackService = require('../../services/paystackService');

// Mock external services
jest.mock('../../services/paystackService');
jest.mock('../../config/redis');

describe('Package Checkout Integration Tests', () => {
  let testUser;
  let testPackage;
  let server;

  beforeAll(async () => {
    // Setup test environment
    process.env.NODE_ENV = 'test';
    process.env.MONGO_URI = process.env.MONGO_TEST_URI || 'mongodb://localhost:27017/ttp_test_db';
    process.env.JWT_ACCESS_SECRET = 'test_access_secret_key_for_testing_purposes_only';
    process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_key_for_testing_purposes_only';
    process.env.JWT_ACCESS_LIFETIME = '15m';
    process.env.JWT_REFRESH_LIFETIME = '30d';
    process.env.COOKIE_SECRET = 'test-cookie-secret-for-testing';

    // Mock Redis
    redisClient.isReady = false;
    redisClient.get = jest.fn().mockResolvedValue(null);
    redisClient.set = jest.fn().mockResolvedValue('OK');
    redisClient.del = jest.fn().mockResolvedValue(1);
    redisClient.flushDb = jest.fn().mockResolvedValue('OK');
    redisClient.hGet = jest.fn().mockImplementation((key, field) => {
      if (key === 'serviceCharges' && field === 'PACKAGE_CHARGES') {
        return Promise.resolve('2000');
      }
      return Promise.resolve(null);
    });

    // Connect to MongoDB
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
    
    server = app.listen(0);
  });

  beforeEach(async () => {
    // Clear database
    await User.deleteMany({});
    await Post.deleteMany({});
    await Ledger.deleteMany({});

    // Create test user
    testUser = await User.create({
      firstName: 'Test',
      lastName: 'User',
      email: 'testuser@example.com',
      phoneNumber: '+2348012345678',
      password: 'password123',
      role: 'User',
      isEmailVerified: true,
      isPhoneVerified: true,
    });

    // Create test package
    testPackage = await Post.create({
      title: 'Bali Adventure Package',
      slug: 'bali-adventure-package',
      content: 'Amazing 7-day adventure package in Bali with exciting activities and beautiful scenery.',
      excerpt: 'Experience the best of Bali in this comprehensive adventure package.',
      postType: 'Packages',
      price: 50000,
      currency: 'NGN',
      categories: [],
      tags: ['adventure', 'bali', 'travel'],
      author: testUser._id,
      status: 'Published',
      featuredImage: 'https://example.com/bali-image.jpg',
      metadata: {
        seoTitle: 'Bali Adventure Package - 7 Days',
        seoDescription: 'Book your amazing Bali adventure package today',
        duration: '7 days',
        location: 'Bali, Indonesia',
        inclusions: ['Accommodation', 'Meals', 'Transportation', 'Activities'],
        exclusions: ['International flights', 'Personal expenses'],
        maxParticipants: 10,
        difficulty: 'Moderate',
      },
      publishedAt: new Date(),
      isActive: true,
      isFeatured: true,
      availability: {
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        isAvailable: true,
      },
    });

    // Mock Paystack service
    paystackService.initializePayment = jest.fn();
    paystackService.verifyPayment = jest.fn();
  });

  afterEach(async () => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  describe('Complete Package Purchase Flow', () => {
    it('should complete full package purchase flow for guest user', async () => {
      // Mock Paystack initialization
      paystackService.initializePayment.mockResolvedValue({
        status: true,
        data: {
          authorization_url: 'https://checkout.paystack.com/mock-url',
          access_code: 'mock-access-code',
          reference: 'TTP-PKG-123456789-abc123'
        }
      });

      // Step 1: Initiate package purchase (guest checkout)
      const purchaseData = {
        customerDetails: {
          email: 'guest@example.com',
          phoneNumber: '+2349012345678',
          firstName: 'Jane',
          lastName: 'Smith',
        },
        participants: 2,
        specialRequests: 'Vegetarian meals required',
      };

      const purchaseResponse = await request(app)
        .post(`/api/v1/products/packages/${testPackage._id}/purchase`)
        .send(purchaseData)
        .expect(StatusCodes.OK);

      // Verify purchase initiation response
      expect(purchaseResponse.body).toHaveProperty('status', 'success');
      expect(purchaseResponse.body.data).toHaveProperty('authorizationUrl');
      expect(purchaseResponse.body.data).toHaveProperty('reference');
      expect(purchaseResponse.body.data).toHaveProperty('amount');
      expect(purchaseResponse.body.data).toHaveProperty('packageDetails');

      // Verify package details in response
      const { packageDetails } = purchaseResponse.body.data;
      expect(packageDetails.title).toBe(testPackage.title);
      expect(packageDetails.price).toBe(testPackage.price * 2); // 2 participants
      expect(packageDetails.serviceCharge).toBe(2000);
      expect(packageDetails.totalAmount).toBe(testPackage.price * 2 + 2000);
      expect(packageDetails.participants).toBe(2);

      // Verify Paystack was called correctly
      expect(paystackService.initializePayment).toHaveBeenCalledWith({
        email: 'guest@example.com',
        amount: testPackage.price * 2 + 2000,
        reference: expect.stringMatching(/^TTP-PKG-\d+-[a-z0-9]+$/),
        metadata: {
          productType: 'Package',
          packageId: testPackage._id.toString(),
          packageTitle: testPackage.title,
          participants: 2,
          userId: null,
          guestEmail: 'guest@example.com',
          guestPhoneNumber: '+2349012345678',
          specialRequests: 'Vegetarian meals required',
        },
      });

      // Verify ledger entry was created
      const ledgerEntry = await Ledger.findOne({
        guestEmail: 'guest@example.com',
        packageId: testPackage._id,
        status: 'Pending',
      });

      expect(ledgerEntry).toBeTruthy();
      expect(ledgerEntry.userId).toBeNull();
      expect(ledgerEntry.guestEmail).toBe('guest@example.com');
      expect(ledgerEntry.guestPhoneNumber).toBe('+2349012345678');
      expect(ledgerEntry.amount).toBe(testPackage.price * 2);
      expect(ledgerEntry.serviceCharge).toBe(2000);
      expect(ledgerEntry.totalAmountPaid).toBe(testPackage.price * 2 + 2000);
      expect(ledgerEntry.productType).toBe('Package');
      expect(ledgerEntry.itemType).toBe('Package');
      expect(ledgerEntry.customerSegment).toBe('Group');
      expect(ledgerEntry.productDetails.participants).toBe(2);
      expect(ledgerEntry.productDetails.specialRequests).toBe('Vegetarian meals required');

      // Step 2: Verify payment and complete purchase
      const paymentReference = ledgerEntry.transactionReference;

      // Mock successful payment verification
      paystackService.verifyPayment.mockResolvedValue({
        data: {
          status: 'success',
          reference: paymentReference,
          amount: (testPackage.price * 2 + 2000) * 100, // Amount in kobo
          gateway_response: 'Successful',
          paid_at: new Date().toISOString(),
          channel: 'card',
          customer: {
            email: 'guest@example.com',
          },
        },
      });

      const verificationResponse = await request(app)
        .post('/api/v1/products/packages/verify-payment')
        .send({ reference: paymentReference })
        .expect(StatusCodes.OK);

      // Verify payment verification response
      expect(verificationResponse.body).toHaveProperty('status', 'success');
      expect(verificationResponse.body.data.transactionReference).toBe(paymentReference);
      expect(verificationResponse.body.data.status).toBe('Completed');
      expect(verificationResponse.body.data.packageDetails.title).toBe(testPackage.title);
      expect(verificationResponse.body.data.packageDetails.participants).toBe(2);
      expect(verificationResponse.body.data.amount).toBe(testPackage.price * 2 + 2000);

      // Verify ledger entry was updated
      const updatedLedger = await Ledger.findById(ledgerEntry._id);
      expect(updatedLedger.status).toBe('Completed');
      expect(updatedLedger.paymentGatewayResponse.status).toBe('success');

      // Verify Paystack verification was called
      expect(paystackService.verifyPayment).toHaveBeenCalledWith(paymentReference);
    });

    it('should handle authenticated user package purchase', async () => {
      // Note: Since the current implementation doesn't have authentication middleware
      // on the package purchase endpoint, this test demonstrates the guest checkout flow
      // but with user details that would typically come from authentication
      
      paystackService.initializePayment.mockResolvedValue({
        status: true,
        data: {
          authorization_url: 'https://checkout.paystack.com/mock-url',
          access_code: 'mock-access-code',
          reference: 'TTP-PKG-123456789-auth123'
        }
      });

      const purchaseData = {
        customerDetails: {
          email: testUser.email,
          phoneNumber: testUser.phoneNumber,
          firstName: testUser.firstName,
          lastName: testUser.lastName,
        },
        participants: 1,
      };

      const response = await request(app)
        .post(`/api/v1/products/packages/${testPackage._id}/purchase`)
        .send(purchaseData)
        .expect(StatusCodes.OK);

      expect(response.body).toHaveProperty('status', 'success');

      // Verify single participant pricing
      const { packageDetails } = response.body.data;
      expect(packageDetails.price).toBe(testPackage.price);
      expect(packageDetails.participants).toBe(1);

      // Verify ledger entry for authenticated-style checkout
      const ledgerEntry = await Ledger.findOne({
        guestEmail: testUser.email,
        packageId: testPackage._id,
      });
      expect(ledgerEntry.customerSegment).toBe('Individual');
    });
  });

  describe('Package Purchase Validation', () => {
    it('should reject purchase when package exceeds max participants', async () => {
      const purchaseData = {
        customerDetails: {
          email: 'guest@example.com',
          phoneNumber: '+2349012345678',
        },
        participants: 15, // Exceeds maxParticipants (10)
      };

      const response = await request(app)
        .post(`/api/v1/products/packages/${testPackage._id}/purchase`)
        .send(purchaseData)
        .expect(StatusCodes.BAD_REQUEST);

      expect(response.body).toHaveProperty('status', 'fail');
      expect(response.body.message).toContain('Maximum 10 participants allowed');
    });

    it('should reject guest checkout without required contact details', async () => {
      const purchaseData = {
        customerDetails: {
          firstName: 'Jane',
          lastName: 'Smith',
          // Missing email and phoneNumber
        },
        participants: 1,
      };

      const response = await request(app)
        .post(`/api/v1/products/packages/${testPackage._id}/purchase`)
        .send(purchaseData)
        .expect(StatusCodes.BAD_REQUEST);

      expect(response.body).toHaveProperty('status', 'fail');
      expect(response.body.message).toContain('email and phone number are required');
    });

    it('should validate participants count', async () => {
      const purchaseData = {
        customerDetails: {
          email: 'guest@example.com',
          phoneNumber: '+2349012345678',
        },
        participants: 0, // Invalid: must be at least 1
      };

      const response = await request(app)
        .post(`/api/v1/products/packages/${testPackage._id}/purchase`)
        .send(purchaseData)
        .expect(StatusCodes.BAD_REQUEST);

      expect(response.body).toHaveProperty('status', 'fail');
    });

    it('should handle special requests length validation', async () => {
      const purchaseData = {
        customerDetails: {
          email: 'guest@example.com',
          phoneNumber: '+2349012345678',
        },
        participants: 1,
        specialRequests: 'x'.repeat(1001), // Exceeds 1000 character limit
      };

      const response = await request(app)
        .post(`/api/v1/products/packages/${testPackage._id}/purchase`)
        .send(purchaseData)
        .expect(StatusCodes.BAD_REQUEST);

      expect(response.body).toHaveProperty('status', 'fail');
    });
  });

  describe('Payment Verification', () => {
    let testLedgerEntry;
    let paymentReference;

    beforeEach(async () => {
      // Create a pending ledger entry
      paymentReference = `TTP-PKG-${Date.now()}-test123`;
      testLedgerEntry = await Ledger.create({
        guestEmail: 'guest@example.com',
        guestPhoneNumber: '+2349012345678',
        packageId: testPackage._id,
        transactionReference: paymentReference,
        amount: testPackage.price,
        currency: 'NGN',
        status: 'Pending',
        paymentGateway: 'Paystack',
        productType: 'Package',
        itemType: 'Package',
        serviceCharge: 2000,
        profitMargin: 2000,
        totalAmountPaid: testPackage.price + 2000,
        customerSegment: 'Individual',
        bookingChannel: 'Web',
        productDetails: {
          packageTitle: testPackage.title,
          packageSlug: testPackage.slug,
          participants: 1,
          duration: testPackage.metadata.duration,
          location: testPackage.metadata.location,
          difficulty: testPackage.metadata.difficulty,
          customerDetails: {
            firstName: 'Jane',
            lastName: 'Smith',
          },
        },
      });
    });

    it('should handle failed payment verification', async () => {
      // Mock failed payment verification
      paystackService.verifyPayment.mockResolvedValue({
        data: {
          status: 'failed',
          reference: paymentReference,
          gateway_response: 'Declined',
        },
      });

      const response = await request(app)
        .post('/api/v1/products/packages/verify-payment')
        .send({ reference: paymentReference })
        .expect(StatusCodes.BAD_REQUEST);

      expect(response.body).toHaveProperty('status', 'fail');

      // Verify ledger entry was updated to failed
      const updatedLedger = await Ledger.findById(testLedgerEntry._id);
      expect(updatedLedger.status).toBe('Failed');
    });

    it('should reject verification with invalid reference', async () => {
      const response = await request(app)
        .post('/api/v1/products/packages/verify-payment')
        .send({ reference: 'invalid-reference' })
        .expect(StatusCodes.NOT_FOUND);

      expect(response.body).toHaveProperty('status', 'fail');
      expect(response.body.message).toContain('Transaction not found');
    });

    it('should reject verification without reference', async () => {
      const response = await request(app)
        .post('/api/v1/products/packages/verify-payment')
        .send({})
        .expect(StatusCodes.BAD_REQUEST);

      expect(response.body).toHaveProperty('status', 'fail');
      expect(response.body.message).toContain('Required');
    });
  });

  describe('Receipt Generation and Notifications', () => {
    it('should generate receipt data for completed package purchase', async () => {
      const paymentReference = `TTP-PKG-${Date.now()}-receipt123`;
      
      // Create a completed ledger entry
      await Ledger.create({
        guestEmail: 'guest@example.com',
        guestPhoneNumber: '+2349012345678',
        packageId: testPackage._id,
        transactionReference: paymentReference,
        amount: testPackage.price * 2,
        currency: 'NGN',
        status: 'Pending',
        paymentGateway: 'Paystack',
        productType: 'Package',
        itemType: 'Package',
        serviceCharge: 2000,
        profitMargin: 2000,
        totalAmountPaid: testPackage.price * 2 + 2000,
        customerSegment: 'Group',
        bookingChannel: 'Web',
        productDetails: {
          packageTitle: testPackage.title,
          packageSlug: testPackage.slug,
          participants: 2,
          duration: testPackage.metadata.duration,
          location: testPackage.metadata.location,
          difficulty: testPackage.metadata.difficulty,
          specialRequests: 'Vegetarian meals',
          customerDetails: {
            firstName: 'John',
            lastName: 'Doe',
          },
        },
      });

      // Mock successful payment verification to trigger receipt generation
      paystackService.verifyPayment.mockResolvedValue({
        data: {
          status: 'success',
          reference: paymentReference,
          amount: (testPackage.price * 2 + 2000) * 100,
          gateway_response: 'Successful',
          paid_at: new Date().toISOString(),
          channel: 'card',
        },
      });

      const response = await request(app)
        .post('/api/v1/products/packages/verify-payment')
        .send({ reference: paymentReference })
        .expect(StatusCodes.OK);

      expect(response.body).toHaveProperty('status', 'success');

      // Verify receipt-like data in response
      expect(response.body.data).toHaveProperty('transactionReference', paymentReference);
      expect(response.body.data).toHaveProperty('status', 'Completed');
      expect(response.body.data).toHaveProperty('amount', testPackage.price * 2 + 2000);
      expect(response.body.data.packageDetails).toEqual({
        title: testPackage.title,
        location: testPackage.metadata.location,
        duration: testPackage.metadata.duration,
        participants: 2,
      });

      // Verify the ledger contains all necessary data for notifications
      const updatedLedger = await Ledger.findOne({ transactionReference: paymentReference });
      expect(updatedLedger.productDetails).toHaveProperty('packageTitle');
      expect(updatedLedger.productDetails).toHaveProperty('participants');
      expect(updatedLedger.productDetails).toHaveProperty('specialRequests');
      expect(updatedLedger).toHaveProperty('totalAmountPaid');
      expect(updatedLedger).toHaveProperty('transactionReference');
      expect(updatedLedger.guestEmail).toBe('guest@example.com');
      expect(updatedLedger.guestPhoneNumber).toBe('+2349012345678');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid package ID', async () => {
      const invalidPackageId = new mongoose.Types.ObjectId();

      const purchaseData = {
        customerDetails: {
          email: 'guest@example.com',
          phoneNumber: '+2349012345678',
        },
        participants: 1,
      };

      const response = await request(app)
        .post(`/api/v1/products/packages/${invalidPackageId}/purchase`)
        .send(purchaseData)
        .expect(StatusCodes.NOT_FOUND);

      expect(response.body).toHaveProperty('status', 'fail');
      expect(response.body.message).toContain('not found');
    });

    it('should handle package availability validation', async () => {
      // Update package to be outside availability window
      await Post.findByIdAndUpdate(testPackage._id, {
        'availability.endDate': new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
      });

      const purchaseData = {
        customerDetails: {
          email: 'guest@example.com',
          phoneNumber: '+2349012345678',
        },
        participants: 1,
      };

      const response = await request(app)
        .post(`/api/v1/products/packages/${testPackage._id}/purchase`)
        .send(purchaseData)
        .expect(StatusCodes.BAD_REQUEST);

      expect(response.body).toHaveProperty('status', 'fail');
      expect(response.body.message).toContain('not available for booking');
    });
  });

  describe('Package Listing and Details', () => {
    it('should list available packages for purchase', async () => {
      const response = await request(app)
        .get('/api/v1/products/packages')
        .expect(StatusCodes.OK);

      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body.data.packages).toHaveLength(1);
      expect(response.body.data.packages[0]).toHaveProperty('title', testPackage.title);
      expect(response.body.data.packages[0]).toHaveProperty('price', testPackage.price);
      expect(response.body.data.packages[0]).toHaveProperty('currency', testPackage.currency);
      expect(response.body.data.pagination).toHaveProperty('totalPackages', 1);
    });

    it('should get package details by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/products/packages/${testPackage._id}`)
        .expect(StatusCodes.OK);

      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body.data.package).toHaveProperty('title', testPackage.title);
      expect(response.body.data.package).toHaveProperty('content', testPackage.content);
      expect(response.body.data.package).toHaveProperty('price', testPackage.price);
      expect(response.body.data.package.metadata).toHaveProperty('duration', testPackage.metadata.duration);
      expect(response.body.data.package.metadata).toHaveProperty('location', testPackage.metadata.location);
      expect(response.body.data.package.metadata).toHaveProperty('maxParticipants', testPackage.metadata.maxParticipants);
    });

    it('should get package details by slug', async () => {
      const response = await request(app)
        .get(`/api/v1/products/packages/${testPackage.slug}`)
        .expect(StatusCodes.OK);

      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body.data.package).toHaveProperty('title', testPackage.title);
      expect(response.body.data.package).toHaveProperty('slug', testPackage.slug);
    });

    it('should increment view count when getting package details', async () => {
      const initialViewCount = testPackage.viewCount;

      await request(app)
        .get(`/api/v1/products/packages/${testPackage._id}`)
        .expect(StatusCodes.OK);

      // Verify view count was incremented
      const updatedPackage = await Post.findById(testPackage._id);
      expect(updatedPackage.viewCount).toBe(initialViewCount + 1);
    });

    it('should filter featured packages', async () => {
      const response = await request(app)
        .get('/api/v1/products/packages?featured=true')
        .expect(StatusCodes.OK);

      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body.data.packages).toHaveLength(1);
      expect(response.body.data.packages[0].isFeatured).toBe(true);
    });
  });
});