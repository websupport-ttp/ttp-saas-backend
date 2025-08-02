// v1/tests/user.test.js
const request = require('supertest');
const app = require('../../app'); // Adjust path to your app.js
const mongoose = require('mongoose');
const User = require('../models/userModel');
const { StatusCodes } = require('http-status-codes');
const { generateToken } = require('../utils/jwt');

describe('User Endpoints', () => {
  let server;
  let adminUser, regularUser;
  let adminAccessToken, regularAccessToken;

  beforeAll(async () => {
    process.env.MONGO_URI = process.env.MONGO_TEST_URI || 'mongodb://localhost:27017/ttp_test_db';
    process.env.JWT_ACCESS_SECRET = 'test_access_secret';
    process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
    process.env.JWT_ACCESS_LIFETIME = '15m';
    process.env.JWT_REFRESH_LIFETIME = '30d';

    // Handle Redis connection for tests
    const redisClient = require('../config/redis');
    try {
      if (!redisClient.isReady) {
        await redisClient.connect();
      }
      await redisClient.flushdb();
    } catch (error) {
      console.warn('Redis connection failed in tests, continuing without Redis:', error.message);
      // Mock Redis client for tests if connection fails
      redisClient.isReady = false;
      redisClient.get = jest.fn().mockResolvedValue(null);
      redisClient.set = jest.fn().mockResolvedValue('OK');
      redisClient.del = jest.fn().mockResolvedValue(1);
      redisClient.flushdb = jest.fn().mockResolvedValue('OK');
    }

    // Connect to MongoDB only if not already connected
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
    server = app.listen(0);
  });

  beforeEach(async () => {
    await User.deleteMany({});

    adminUser = await User.create({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@example.com',
      phoneNumber: '+2347010000000',
      password: 'AdminPassword123!',
      role: 'Admin',
      isEmailVerified: true,
      isPhoneVerified: true,
    });

    regularUser = await User.create({
      firstName: 'Regular',
      lastName: 'User',
      email: 'regular@example.com',
      phoneNumber: '+2347010000001',
      password: 'RegularPassword123!',
      role: 'User',
      isEmailVerified: true,
      isPhoneVerified: true,
    });

    adminAccessToken = generateToken({ userId: adminUser._id, role: adminUser.role }, process.env.JWT_ACCESS_SECRET, '1h');
    regularAccessToken = generateToken({ userId: regularUser._id, role: regularUser.role }, process.env.JWT_ACCESS_SECRET, '1h');
  });

  afterAll(async () => {
    await mongoose.connection.close();
    if (server) {
      server.close();
    }
  });

  // Helper to set cookies for supertest
  const setAuthCookies = (token) => {
    const cookieSignature = require('cookie-signature');
    const secret = process.env.COOKIE_SECRET || 'test-cookie-secret-for-testing';
    
    const signedAccessToken = cookieSignature.sign(token, secret);
    const signedRefreshToken = cookieSignature.sign('dummy_refresh_token', secret);
    
    return [
      `accessToken=s%3A${signedAccessToken}; Path=/; HttpOnly`,
      `refreshToken=s%3A${signedRefreshToken}; Path=/; HttpOnly`
    ];
  };


  // Test /users/me
  describe('GET /api/v1/users/me', () => {
    it('should get authenticated user profile', async () => {
      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Cookie', setAuthCookies(regularAccessToken));

      expect(res.statusCode).toEqual(StatusCodes.OK);
      expect(res.body.status).toEqual('success');
      expect(res.body.data.user._id).toEqual(regularUser._id.toString());
      expect(res.body.data.user.email).toEqual(regularUser.email);
      expect(res.body.data.user.password).toBeUndefined(); // Password should not be returned
    });

    it('should return 401 if not authenticated', async () => {
      const res = await request(app).get('/api/v1/users/me');
      expect(res.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
    });
  });

  // Test PUT /users/me
  describe('PUT /api/v1/users/me', () => {
    it('should update authenticated user profile', async () => {
      const updates = { firstName: 'UpdatedRegular', email: 'updated.regular@example.com' };
      const res = await request(app)
        .put('/api/v1/users/me')
        .set('Cookie', setAuthCookies(regularAccessToken))
        .send(updates);

      expect(res.statusCode).toEqual(StatusCodes.OK);
      expect(res.body.status).toEqual('success');
      expect(res.body.data.user.firstName).toEqual(updates.firstName);
      expect(res.body.data.user.email).toEqual(updates.email);
      expect(res.body.data.user.isEmailVerified).toBe(false); // Should be false after email change

      const updatedUserInDb = await User.findById(regularUser._id);
      expect(updatedUserInDb.firstName).toEqual(updates.firstName);
      expect(updatedUserInDb.email).toEqual(updates.email);
      expect(updatedUserInDb.isEmailVerified).toBe(false);
    });

    it('should return 400 if email is already in use', async () => {
      const updates = { email: adminUser.email }; // Try to use admin's email
      const res = await request(app)
        .put('/api/v1/users/me')
        .set('Cookie', setAuthCookies(regularAccessToken))
        .send(updates);

      expect(res.statusCode).toEqual(StatusCodes.CONFLICT);
      expect(res.body.status).toEqual('fail');
      expect(res.body.message).toContain('Email already in use by another account');
    });

    it('should return 401 if not authenticated', async () => {
      const updates = { firstName: 'Unauthorized' };
      const res = await request(app).put('/api/v1/users/me').send(updates);
      expect(res.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
    });
  });

  // Test GET /users (Admin only)
  describe('GET /api/v1/users', () => {
    it('should allow admin to get all users', async () => {
      const res = await request(app)
        .get('/api/v1/users')
        .set('Cookie', setAuthCookies(adminAccessToken));

      expect(res.statusCode).toEqual(StatusCodes.OK);
      expect(res.body.status).toEqual('success');
      expect(res.body.data.count).toEqual(2); // Admin and regular user
      expect(res.body.data.users.length).toEqual(2);
      expect(res.body.data.users[0].password).toBeUndefined();
    });

    it('should return 403 for regular user trying to get all users', async () => {
      const res = await request(app)
        .get('/api/v1/users')
        .set('Cookie', setAuthCookies(regularAccessToken));

      expect(res.statusCode).toEqual(StatusCodes.FORBIDDEN);
      expect(res.body.status).toEqual('fail');
      expect(res.body.message).toContain('Unauthorized: User role (User) is not authorized');
    });
  });

  // Test GET /users/:id (Admin only)
  describe('GET /api/v1/users/:id', () => {
    it('should allow admin to get a single user by ID', async () => {
      const res = await request(app)
        .get(`/api/v1/users/${regularUser._id}`)
        .set('Cookie', setAuthCookies(adminAccessToken));

      expect(res.statusCode).toEqual(StatusCodes.OK);
      expect(res.body.status).toEqual('success');
      expect(res.body.data.user._id).toEqual(regularUser._id.toString());
      expect(res.body.data.user.email).toEqual(regularUser.email);
    });

    it('should return 404 if user not found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId(); // Generate a valid but non-existent ID
      const res = await request(app)
        .get(`/api/v1/users/${nonExistentId}`)
        .set('Cookie', setAuthCookies(adminAccessToken));

      expect(res.statusCode).toEqual(StatusCodes.NOT_FOUND);
      expect(res.body.status).toEqual('fail');
      expect(res.body.message).toContain(`No user with id of ${nonExistentId}`);
    });
  });

  // Test PUT /users/:id/role (Admin only)
  describe('PUT /api/v1/users/:id/role', () => {
    it('should allow admin to update user role', async () => {
      const res = await request(app)
        .put(`/api/v1/users/${regularUser._id}/role`)
        .set('Cookie', setAuthCookies(adminAccessToken))
        .send({ role: 'Manager' });

      expect(res.statusCode).toEqual(StatusCodes.OK);
      expect(res.body.status).toEqual('success');
      expect(res.body.data.user.role).toEqual('Manager');

      const updatedUserInDb = await User.findById(regularUser._id);
      expect(updatedUserInDb.role).toEqual('Manager');
    });

    it('should return 400 for invalid role', async () => {
      const res = await request(app)
        .put(`/api/v1/users/${regularUser._id}/role`)
        .set('Cookie', setAuthCookies(adminAccessToken))
        .send({ role: 'InvalidRole' });

      expect(res.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      expect(res.body.status).toEqual('fail');
      expect(res.body.message).toContain('Invalid role provided');
    });
  });

  // Test DELETE /users/:id (Admin only)
  describe('DELETE /api/v1/users/:id', () => {
    it('should allow admin to delete a user', async () => {
      const res = await request(app)
        .delete(`/api/v1/users/${regularUser._id}`)
        .set('Cookie', setAuthCookies(adminAccessToken));

      expect(res.statusCode).toEqual(StatusCodes.OK);
      expect(res.body.status).toEqual('success');
      expect(res.body.message).toEqual('User deleted successfully');

      const deletedUser = await User.findById(regularUser._id);
      expect(deletedUser).toBeNull();
    });

    it('should return 404 if user to delete not found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .delete(`/api/v1/users/${nonExistentId}`)
        .set('Cookie', setAuthCookies(adminAccessToken));

      expect(res.statusCode).toEqual(StatusCodes.NOT_FOUND);
      expect(res.body.status).toEqual('fail');
      expect(res.body.message).toContain(`No user with id of ${nonExistentId}`);
    });
  });
});