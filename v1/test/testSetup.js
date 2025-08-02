// v1/test/testSetup.js
// Test-specific setup utilities

const mongoose = require('mongoose');
const { generateToken } = require('../utils/jwt');

/**
 * Test database utilities
 */
const testDb = {
  /**
   * Clear all collections in the test database
   */
  async clearDatabase() {
    if (mongoose.connection.readyState === 1) {
      const collections = mongoose.connection.collections;
      for (const key in collections) {
        const collection = collections[key];
        await collection.deleteMany({});
      }
    }
  },

  /**
   * Ensure database connection is ready for tests
   */
  async ensureConnection() {
    // Wait for connection to be ready
    if (mongoose.connection.readyState !== 1) {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Database connection timeout'));
        }, 10000);

        if (mongoose.connection.readyState === 1) {
          clearTimeout(timeout);
          resolve();
        } else {
          mongoose.connection.once('connected', () => {
            clearTimeout(timeout);
            resolve();
          });
          mongoose.connection.once('error', (error) => {
            clearTimeout(timeout);
            reject(error);
          });
        }
      });
    }
  },

  /**
   * Close database connection
   */
  async closeDatabase() {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  },

  /**
   * Check if database is connected
   */
  isConnected() {
    return mongoose.connection.readyState === 1;
  }
};

/**
 * Authentication utilities for tests
 */
const testAuth = {
  /**
   * Generate test JWT token
   */
  generateTestToken(payload, expiresIn = '1h') {
    return generateToken(
      payload,
      process.env.JWT_ACCESS_SECRET || 'test-secret',
      expiresIn
    );
  },

  /**
   * Create authentication cookies for supertest
   */
  createAuthCookies(token) {
    return [
      `accessToken=${token}; Path=/; HttpOnly`,
      `refreshToken=dummy_refresh_token; Path=/; HttpOnly`
    ];
  },

  /**
   * Create signed cookies for supertest using cookie-signature
   */
  createSignedAuthCookies(token, refreshToken = 'dummy_refresh_token') {
    try {
      const cookieSignature = require('cookie-signature');
      const secret = process.env.COOKIE_SECRET || 'test-cookie-secret-for-testing';
      
      const signedAccessToken = cookieSignature.sign(token, secret);
      const signedRefreshToken = cookieSignature.sign(refreshToken, secret);
      
      return [
        `accessToken=s%3A${signedAccessToken}; Path=/; HttpOnly`,
        `refreshToken=s%3A${signedRefreshToken}; Path=/; HttpOnly`
      ];
    } catch (error) {
      // Fallback to unsigned cookies if cookie-signature fails
      return [
        `accessToken=${token}; Path=/; HttpOnly`,
        `refreshToken=${refreshToken}; Path=/; HttpOnly`
      ];
    }
  },

  /**
   * Create a properly signed cookie string for supertest
   */
  createSignedCookieString(token, refreshToken = 'dummy_refresh_token') {
    try {
      const cookieSignature = require('cookie-signature');
      const secret = process.env.COOKIE_SECRET || 'test-cookie-secret-for-testing';
      
      const signedAccessToken = cookieSignature.sign(token, secret);
      const signedRefreshToken = cookieSignature.sign(refreshToken, secret);
      
      return `accessToken=s%3A${signedAccessToken}; refreshToken=s%3A${signedRefreshToken}`;
    } catch (error) {
      // Fallback to unsigned cookies if cookie-signature fails
      return `accessToken=${token}; refreshToken=${refreshToken}`;
    }
  },

  /**
   * Create simple cookie string for supertest (for tests that don't need signing)
   */
  createSimpleCookieString(token, refreshToken = 'dummy_refresh_token') {
    return `accessToken=${token}; refreshToken=${refreshToken}`;
  }
};

/**
 * Mock data factories
 */
const testData = {
  /**
   * Create test user data
   */
  createUser(overrides = {}) {
    return {
      firstName: 'Test',
      lastName: 'User',
      email: `test${Date.now()}@example.com`,
      phoneNumber: `+123456789${Math.floor(Math.random() * 10)}`,
      password: 'password123',
      role: 'User',
      isEmailVerified: true,
      isPhoneVerified: true,
      ...overrides,
    };
  },

  /**
   * Create test ledger entry data
   */
  createLedgerEntry(overrides = {}) {
    return {
      transactionReference: `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      amount: 10000,
      currency: 'NGN',
      status: 'Completed',
      paymentGateway: 'Paystack',
      productType: 'Flight Booking',
      itemType: 'Flight',
      profitMargin: 1000,
      totalAmountPaid: 11000,
      serviceCharge: 500,
      customerSegment: 'Individual',
      bookingChannel: 'Web',
      seasonality: 'Off-Peak',
      ...overrides,
    };
  },

  /**
   * Create test post data
   */
  createPost(overrides = {}) {
    return {
      title: `Test Post ${Date.now()}`,
      slug: `test-post-${Date.now()}`,
      content: 'Test content for the post',
      postType: 'Articles',
      status: 'Published',
      ...overrides,
    };
  },

  /**
   * Create test category data
   */
  createCategory(overrides = {}) {
    return {
      name: `Test Category ${Date.now()}`,
      slug: `test-category-${Date.now()}`,
      description: 'Test category description',
      isActive: true,
      ...overrides,
    };
  }
};

/**
 * Test environment utilities
 */
const testEnv = {
  /**
   * Set required environment variables for tests
   */
  setupTestEnv() {
    process.env.NODE_ENV = 'test';
    process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test_access_secret_key_for_testing_purposes_only';
    process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test_refresh_secret_key_for_testing_purposes_only';
    process.env.JWT_ACCESS_LIFETIME = '15m';
    process.env.JWT_REFRESH_LIFETIME = '30d';
    process.env.LOG_LEVEL = 'error';
    process.env.COOKIE_SECRET = 'test-cookie-secret-for-testing';
  },

  /**
   * Check if running in test environment
   */
  isTestEnv() {
    return process.env.NODE_ENV === 'test';
  }
};

/**
 * User model test helpers
 */
const testUserHelpers = {
  /**
   * Add missing methods to user instance for testing
   */
  addUserMethods(user) {
    const crypto = require('crypto');
    
    // Add getResetPasswordToken method
    user.getResetPasswordToken = function() {
      const resetToken = crypto.randomBytes(20).toString('hex');
      this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
      this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
      return resetToken;
    };

    // Add getEmailVerificationToken method
    user.getEmailVerificationToken = function() {
      const verificationToken = crypto.randomBytes(32).toString('hex');
      this.emailVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
      return verificationToken;
    };

    // Add getPhoneVerificationOtp method
    user.getPhoneVerificationOtp = function() {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      this.phoneVerificationOtp = crypto.createHash('sha256').update(otp).digest('hex');
      this.phoneVerificationOtpExpires = Date.now() + 5 * 60 * 1000; // 5 minutes
      return otp;
    };

    return user;
  }
};

/**
 * Mock service responses
 */
const mockResponses = {
  paystack: {
    initializePayment: {
      status: true,
      data: {
        authorization_url: 'https://checkout.paystack.com/mock-url',
        access_code: 'mock-access-code',
        reference: 'mock-reference'
      }
    },
    verifyPayment: {
      status: true,
      data: {
        status: 'success',
        reference: 'mock-reference',
        amount: 1000000, // Amount in kobo
        gateway_response: 'Successful',
        paid_at: new Date().toISOString(),
        channel: 'card'
      }
    }
  },

  amadeus: {
    searchFlights: {
      data: [
        {
          id: 'mock-flight-1',
          price: { total: '500.00', currency: 'USD' },
          itineraries: []
        }
      ]
    },
    bookFlight: {
      success: true,
      data: {
        bookingId: 'mock-booking-123',
        confirmationNumber: 'ABC123'
      }
    }
  },

  allianz: {
    getQuote: {
      success: true,
      data: {
        premium: 5000,
        policyId: 'mock-policy-123',
        coverage: 'Comprehensive'
      }
    },
    purchasePolicy: {
      success: true,
      data: {
        policyNumber: 'POL-123456',
        certificateUrl: 'https://mock-cert-url.com'
      }
    }
  },

  ratehawk: {
    searchHotels: {
      data: [
        {
          id: 'mock-hotel-1',
          name: 'Mock Hotel',
          price: { amount: 100, currency: 'USD' }
        }
      ]
    },
    bookHotel: {
      success: true,
      data: {
        bookingId: 'mock-hotel-booking-123',
        confirmationNumber: 'HTL123'
      }
    }
  }
};

/**
 * Test assertion helpers
 */
const testAssertions = {
  /**
   * Assert response structure for API endpoints
   */
  assertApiResponse(response, expectedStatus = 200) {
    expect(response.status).toBe(expectedStatus);
    expect(response.body).toHaveProperty('status');
    if (response.status >= 200 && response.status < 300) {
      expect(response.body.status).toBe('success');
    } else if (response.status >= 400 && response.status < 500) {
      expect(response.body.status).toBe('fail');
    } else {
      expect(response.body.status).toBe('error');
    }
  },

  /**
   * Assert error response structure (4xx errors return 'fail', 5xx return 'error')
   */
  assertErrorResponse(response, expectedStatus = 400) {
    expect(response.status).toBe(expectedStatus);
    const expectedStatusText = expectedStatus >= 400 && expectedStatus < 500 ? 'fail' : 'error';
    expect(response.body).toHaveProperty('status', expectedStatusText);
    expect(response.body).toHaveProperty('message');
  },

  /**
   * Assert success response structure
   */
  assertSuccessResponse(response, expectedStatus = 200) {
    expect(response.status).toBe(expectedStatus);
    expect(response.body).toHaveProperty('status', 'success');
    expect(response.body).toHaveProperty('data');
  }
};

module.exports = {
  testDb,
  testAuth,
  testData,
  testEnv,
  testUserHelpers,
  mockResponses,
  testAssertions
};