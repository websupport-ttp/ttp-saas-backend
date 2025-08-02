// v1/test/helpers/testHelper.js
// Simplified test helper for authentication and basic utilities

const { generateToken } = require('../../utils/jwt');

/**
 * Create a test JWT token with proper signing
 */
const createTestToken = (payload, secret = null, expiresIn = '1h') => {
  const tokenSecret = secret || process.env.JWT_ACCESS_SECRET || 'test_access_secret_key_for_testing_purposes_only';
  return generateToken(payload, tokenSecret, expiresIn);
};

/**
 * Create signed cookies for supertest
 */
const createSignedCookies = (accessToken, refreshToken = 'dummy_refresh_token') => {
  try {
    const cookieSignature = require('cookie-signature');
    const secret = process.env.COOKIE_SECRET || 'test-cookie-secret-for-testing';
    
    const signedAccessToken = cookieSignature.sign(accessToken, secret);
    const signedRefreshToken = cookieSignature.sign(refreshToken, secret);
    
    return `accessToken=s%3A${signedAccessToken}; refreshToken=s%3A${signedRefreshToken}`;
  } catch (error) {
    // Fallback to unsigned cookies if cookie-signature fails
    return `accessToken=${accessToken}; refreshToken=${refreshToken}`;
  }
};

/**
 * Create a test user with proper authentication tokens
 */
const createTestUserWithAuth = (userData = {}) => {
  const user = {
    _id: `mock-user-${Date.now()}`,
    firstName: 'Test',
    lastName: 'User',
    email: `test${Date.now()}@example.com`,
    phoneNumber: `+123456789${Math.floor(Math.random() * 10)}`,
    password: 'password123',
    role: 'User',
    isEmailVerified: true,
    isPhoneVerified: true,
    ...userData,
  };

  const accessToken = createTestToken(
    { userId: user._id, role: user.role },
    process.env.JWT_ACCESS_SECRET,
    '15m'
  );

  const refreshToken = createTestToken(
    { userId: user._id, role: user.role },
    process.env.JWT_REFRESH_SECRET,
    '30d'
  );

  return {
    user,
    accessToken,
    refreshToken,
    cookieString: createSignedCookies(accessToken, refreshToken),
  };
};

/**
 * Mock the authentication for a specific user in tests
 */
const mockAuthenticatedUser = (User, userData = {}) => {
  const { user, accessToken, refreshToken, cookieString } = createTestUserWithAuth(userData);
  
  // Mock User.findOne to return the user for authentication
  User.findOne.mockImplementation((query) => {
    if (query.email === user.email || query.phoneNumber === user.phoneNumber) {
      return Promise.resolve({
        ...user,
        matchPassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(user),
      });
    }
    return Promise.resolve(null);
  });

  // Mock User.findById to return the user
  User.findById.mockImplementation((id) => {
    if (id === user._id) {
      return Promise.resolve(user);
    }
    return Promise.resolve(null);
  });

  return {
    user,
    accessToken,
    refreshToken,
    cookieString,
  };
};

/**
 * Helper to create mock responses for test assertions
 */
const createMockResponse = (data = {}, status = 200, success = true) => ({
  status,
  body: {
    status: success ? 'success' : 'error',
    ...data,
  },
});

/**
 * Helper to setup basic test environment
 */
const setupTestEnvironment = () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'test_access_secret_key_for_testing_purposes_only';
  process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_key_for_testing_purposes_only';
  process.env.JWT_ACCESS_LIFETIME = '15m';
  process.env.JWT_REFRESH_LIFETIME = '30d';
  process.env.COOKIE_SECRET = 'test-cookie-secret-for-testing';
  process.env.LOG_LEVEL = 'error';
};

module.exports = {
  createTestToken,
  createSignedCookies,
  createTestUserWithAuth,
  mockAuthenticatedUser,
  createMockResponse,
  setupTestEnvironment,
};
