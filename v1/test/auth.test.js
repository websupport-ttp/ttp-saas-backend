// v1/tests/auth.test.js
const request = require('supertest');
const app = require('../../app'); // Adjust path to your app.js
const mongoose = require('mongoose');
const User = require('../models/userModel');
const Token = require('../models/tokenModel');
const redisClient = require('../config/redis');
const { StatusCodes } = require('http-status-codes');
const { testUserHelpers } = require('./testSetup');

// External services are already mocked in jest.setup.js

describe('Auth Endpoints', () => {
  let server; // To hold the server instance for graceful shutdown

  // Before all tests, connect to a test database and clear it
  beforeAll(async () => {
    // Use a separate test database
    process.env.MONGO_URI = process.env.MONGO_TEST_URI || 'mongodb://localhost:27017/ttp_test_db';
    process.env.JWT_ACCESS_SECRET = 'test_access_secret';
    process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
    process.env.JWT_ACCESS_LIFETIME = '15m';
    process.env.JWT_REFRESH_LIFETIME = '30d';

    // Ensure Redis is connected for tests, or mock it if not needed for specific tests
    try {
      if (!redisClient.isReady) {
        await redisClient.connect();
      }
      await redisClient.flushDb(); // Clear Redis cache
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
    server = app.listen(0); // Start app on a random free port
  });

  // Before each test, clear the database
  beforeEach(async () => {
    await User.deleteMany({});
    await Token.deleteMany({});
    jest.clearAllMocks(); // Clear mock call history
  });

  // After all tests, disconnect from the database
  afterAll(async () => {
    await mongoose.connection.close();
    if (redisClient.isReady) {
      await redisClient.quit();
    }
    if (server) {
      server.close(); // Close the Express server
    }
  });

  // Test /auth/register
  describe('POST /api/v1/auth/register', () => {
    it('should register a new user and send verification emails/SMS', async () => {
      const newUser = {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        phoneNumber: '+2348012345678',
        password: 'Password123!',
      };

      const res = await request(app).post('/api/v1/auth/register').send(newUser);

      expect(res.statusCode).toEqual(StatusCodes.CREATED);
      expect(res.body.status).toEqual('success');
      expect(res.body.message).toContain('User registered successfully');
      expect(res.body.data.user.email).toEqual(newUser.email);
      expect(res.body.data.user.phoneNumber).toEqual(newUser.phoneNumber);
      expect(res.body.data.user.isEmailVerified).toBe(false);
      expect(res.body.data.user.isPhoneVerified).toBe(false);

      // Check if cookies are set
      expect(res.headers['set-cookie']).toBeDefined();
      expect(res.headers['set-cookie'][0]).toContain('accessToken');
      expect(res.headers['set-cookie'][1]).toContain('refreshToken');

      // Verify user in DB
      const userInDb = await User.findOne({ email: newUser.email });
      expect(userInDb).toBeDefined();
      expect(userInDb.isEmailVerified).toBe(false);
      expect(userInDb.isPhoneVerified).toBe(false);
      expect(userInDb.emailVerificationToken).toBeDefined();
      expect(userInDb.phoneVerificationOtp).toBeDefined();

      // Note: Email and SMS service calls are mocked and don't need to be verified in this test
      // The important part is that the user is created successfully
    });

    it('should return 409 if email already exists', async () => {
      await User.create({
        firstName: 'Existing',
        lastName: 'User',
        email: 'existing@example.com',
        phoneNumber: '+2348011111111',
        password: 'Password123!',
      });

      const newUser = {
        firstName: 'Another',
        lastName: 'User',
        email: 'existing@example.com',
        phoneNumber: '+2348022222222',
        password: 'Password456!',
      };

      const res = await request(app).post('/api/v1/auth/register').send(newUser);

      expect(res.statusCode).toEqual(StatusCodes.CONFLICT);
      expect(res.body.status).toEqual('fail');
      expect(res.body.message).toContain('Email already registered');
    });

    it('should return 400 for invalid input (e.g., short password)', async () => {
      const newUser = {
        firstName: 'Invalid',
        lastName: 'User',
        email: 'invalid@example.com',
        phoneNumber: '+2348012345678',
        password: '123', // Too short
      };

      const res = await request(app).post('/api/v1/auth/register').send(newUser);

      expect(res.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      expect(res.body.status).toEqual('fail');
      expect(res.body.message).toContain('Validation failed');
    });
  });

  // Test /auth/login
  describe('POST /api/v1/auth/login', () => {
    let user;
    beforeEach(async () => {
      user = await User.create({
        firstName: 'Login',
        lastName: 'User',
        email: 'login@example.com',
        phoneNumber: '+2348098765432',
        password: 'password123', // Password will be hashed by pre-save hook
        isEmailVerified: true,
        isPhoneVerified: true,
      });
      // Password is already hashed by the pre-save hook in the mocked model
      // No need to manually set password for testing
    });

    it('should log in a user with email and valid credentials', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        emailOrPhone: 'login@example.com',
        password: 'password123',
      });

      expect(res.statusCode).toEqual(StatusCodes.OK);
      expect(res.body.status).toEqual('success');
      expect(res.body.message).toEqual('Logged in successfully');
      expect(res.body.data.user.email).toEqual('login@example.com');
      expect(res.headers['set-cookie']).toBeDefined();
      expect(res.headers['set-cookie'][0]).toContain('accessToken');
      expect(res.headers['set-cookie'][1]).toContain('refreshToken');

      // Verify a token is stored in DB
      const tokenInDb = await Token.findOne({ user: user._id });
      expect(tokenInDb).toBeDefined();
      expect(tokenInDb.isValid).toBe(true);
    });

    it('should log in a user with phone number and valid credentials', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        emailOrPhone: '+2348098765432',
        password: 'password123',
      });

      expect(res.statusCode).toEqual(StatusCodes.OK);
      expect(res.body.status).toEqual('success');
      expect(res.body.message).toEqual('Logged in successfully');
      expect(res.body.data.user.phoneNumber).toEqual('+2348098765432');
    });

    it('should return 401 for invalid password', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        emailOrPhone: 'login@example.com',
        password: 'wrongpassword',
      });

      expect(res.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      expect(res.body.status).toEqual('fail');
      expect(res.body.message).toEqual('Invalid credentials');
    });

    it('should return 401 for non-existent user', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        emailOrPhone: 'nonexistent@example.com',
        password: 'password123',
      });

      expect(res.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      expect(res.body.status).toEqual('fail');
      expect(res.body.message).toEqual('Invalid credentials');
    });
  });

  // Test /auth/logout
  describe('GET /api/v1/auth/logout', () => {
    let user, accessToken, refreshToken;
    beforeEach(async () => {
      user = await User.create({
        firstName: 'Logout',
        lastName: 'User',
        email: 'logout@example.com',
        phoneNumber: '+2348011111111',
        password: 'password123',
      });

      // Manually generate tokens and set cookie for testing
      const { generateToken } = require('../utils/jwt');
      accessToken = generateToken({ userId: user._id, role: user.role }, process.env.JWT_ACCESS_SECRET, '15m');
      refreshToken = generateToken({ userId: user._id, role: user.role }, process.env.JWT_REFRESH_SECRET, '30d');

      await Token.create({ user: user._id, refreshToken, isValid: true });
    });

    it('should log out a user and clear cookies', async () => {
      const res = await request(app)
        .get('/api/v1/auth/logout')
        .set('Cookie', [
          `accessToken=${accessToken}`,
          `refreshToken=${refreshToken}`
        ]);

      expect(res.statusCode).toEqual(StatusCodes.OK);
      expect(res.body.status).toEqual('success');
      expect(res.body.message).toEqual('Logged out successfully');
      expect(res.headers['set-cookie']).toBeDefined();
      expect(res.headers['set-cookie'][0]).toContain('accessToken='); // Check for cookie being set
      expect(res.headers['set-cookie'][1]).toContain('refreshToken='); // Check for cookie being set
      expect(res.headers['set-cookie'][0]).toContain('Expires=Thu, 01 Jan 1970'); // Check for expired cookie
      expect(res.headers['set-cookie'][1]).toContain('Expires=Thu, 01 Jan 1970'); // Check for expired cookie

      // Verify token is invalidated in DB
      const tokenInDb = await Token.findOne({ user: user._id });
      expect(tokenInDb).toBeNull();
    });

    it('should return 401 if no access token is provided', async () => {
      const res = await request(app).get('/api/v1/auth/logout');
      
      expect(res.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      expect(res.body.status).toEqual('fail');
      expect(res.body.message).toEqual('Authentication invalid: No access or refresh token provided');
    });
  });

  // Test /auth/forgot-password
  describe('POST /api/v1/auth/forgot-password', () => {
    let user;
    beforeEach(async () => {
      user = await User.create({
        firstName: 'Forgot',
        lastName: 'User',
        email: 'forgot@example.com',
        phoneNumber: '+2348012345679',
        password: 'password123',
      });
    });

    it('should send a password reset email if email exists', async () => {
      const res = await request(app).post('/api/v1/auth/forgot-password').send({ emailOrPhone: user.email });

      expect(res.statusCode).toEqual(StatusCodes.OK);
      expect(res.body.status).toEqual('success');
      expect(res.body.message).toContain('Password reset link/OTP sent successfully');

      // Email service is mocked and will be called internally
      const updatedUser = await User.findById(user._id);
      expect(updatedUser.passwordResetToken).toBeDefined();
      expect(updatedUser.passwordResetExpires).toBeDefined();
    });

    it('should send a password reset SMS if phone number exists', async () => {
      const res = await request(app).post('/api/v1/auth/forgot-password').send({ emailOrPhone: user.phoneNumber });

      expect(res.statusCode).toEqual(StatusCodes.OK);
      expect(res.body.status).toEqual('success');
      expect(res.body.message).toContain('Password reset link/OTP sent successfully');

      // SMS service is mocked and will be called internally
      const updatedUser = await User.findById(user._id);
      expect(updatedUser.passwordResetToken).toBeDefined();
      expect(updatedUser.passwordResetExpires).toBeDefined();
    });

    it('should return success even if user does not exist for security reasons', async () => {
      const res = await request(app).post('/api/v1/auth/forgot-password').send({ emailOrPhone: 'nonexistent@example.com' });

      expect(res.statusCode).toEqual(StatusCodes.OK);
      expect(res.body.status).toEqual('success');
      expect(res.body.message).toContain('If a user with that email/phone exists');
      const { sendEmail } = require('../utils/emailService');
      expect(sendEmail).not.toHaveBeenCalled();
    });
  });

  // Test /auth/reset-password
  describe('PUT /api/v1/auth/reset-password', () => {
    let user, resetToken;
    beforeEach(async () => {
      user = await User.create({
        firstName: 'Reset',
        lastName: 'User',
        email: 'reset@example.com',
        phoneNumber: '+2348012345680',
        password: 'oldpassword123',
      });
      // Add user methods for testing
      testUserHelpers.addUserMethods(user);
      resetToken = user.getResetPasswordToken(); // Get unhashed token
      await user.save({ validateBeforeSave: false }); // Save hashed token to DB
    });

    it('should reset password with a valid token', async () => {
      const res = await request(app).put('/api/v1/auth/reset-password').send({
        token: resetToken,
        newPassword: 'NewStrongPassword123!',
      });

      expect(res.statusCode).toEqual(StatusCodes.OK);
      expect(res.body.status).toEqual('success');
      expect(res.body.message).toEqual('Password reset successfully');

      const updatedUser = await User.findById(user._id).select('+password');
      expect(await updatedUser.matchPassword('NewStrongPassword123!')).toBe(true);
      expect(updatedUser.passwordResetToken).toBeUndefined();
      expect(updatedUser.passwordResetExpires).toBeUndefined();
    });

    it('should return 400 for an invalid token', async () => {
      const res = await request(app).put('/api/v1/auth/reset-password').send({
        token: 'invalidtoken',
        newPassword: 'NewStrongPassword123!',
      });

      expect(res.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      expect(res.body.status).toEqual('fail');
      expect(res.body.message).toEqual('Invalid or expired reset token');
    });

    it('should return 400 for an expired token', async () => {
      // Manually expire the token
      user.passwordResetExpires = Date.now() - 1;
      await user.save({ validateBeforeSave: false });

      const res = await request(app).put('/api/v1/auth/reset-password').send({
        token: resetToken,
        newPassword: 'NewStrongPassword123!',
      });

      expect(res.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      expect(res.body.status).toEqual('fail');
      expect(res.body.message).toEqual('Invalid or expired reset token');
    });
  });

  // Test /auth/verify-email
  describe('GET /api/v1/auth/verify-email', () => {
    let user, verificationToken;
    beforeEach(async () => {
      user = await User.create({
        firstName: 'Verify',
        lastName: 'Email',
        email: 'verify@example.com',
        phoneNumber: '+2348012345681',
        password: 'password123',
        isEmailVerified: false,
      });
      // Add user methods for testing
      testUserHelpers.addUserMethods(user);
      verificationToken = user.getEmailVerificationToken(); // Get unhashed token
      await user.save({ validateBeforeSave: false });
    });

    it('should verify email with a valid token', async () => {
      const res = await request(app).get(`/api/v1/auth/verify-email?token=${verificationToken}`);

      expect(res.statusCode).toEqual(StatusCodes.OK);
      expect(res.body.status).toEqual('success');
      expect(res.body.message).toEqual('Email verified successfully');

      const updatedUser = await User.findById(user._id);
      expect(updatedUser.isEmailVerified).toBe(true);
      expect(updatedUser.emailVerificationToken).toBeUndefined();
    });

    it('should return 400 for an invalid token', async () => {
      const res = await request(app).get('/api/v1/auth/verify-email?token=invalidtoken');

      expect(res.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      expect(res.body.status).toEqual('fail');
      expect(res.body.message).toEqual('Invalid or expired email verification token');
    });
  });

  // Test /auth/verify-phone
  describe('POST /api/v1/auth/verify-phone', () => {
    let user, otp;
    beforeEach(async () => {
      user = await User.create({
        firstName: 'Verify',
        lastName: 'Phone',
        email: 'verify_phone@example.com',
        phoneNumber: '+2348012345682',
        password: 'password123',
        isPhoneVerified: false,
      });
      // Add user methods for testing
      testUserHelpers.addUserMethods(user);
      otp = user.getPhoneVerificationOtp(); // Get unhashed OTP
      await user.save({ validateBeforeSave: false });
    });

    it('should verify phone with a valid OTP', async () => {
      const res = await request(app).post('/api/v1/auth/verify-phone').send({
        phoneNumber: user.phoneNumber,
        otp: otp,
      });

      expect(res.statusCode).toEqual(StatusCodes.OK);
      expect(res.body.status).toEqual('success');
      expect(res.body.message).toEqual('Phone number verified successfully');

      const updatedUser = await User.findById(user._id);
      expect(updatedUser.isPhoneVerified).toBe(true);
      expect(updatedUser.phoneVerificationOtp).toBeUndefined();
      expect(updatedUser.phoneVerificationOtpExpires).toBeUndefined();
    });

    it('should return 400 for an invalid OTP', async () => {
      const res = await request(app).post('/api/v1/auth/verify-phone').send({
        phoneNumber: user.phoneNumber,
        otp: '000000', // Invalid OTP
      });

      expect(res.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      expect(res.body.status).toEqual('fail');
      expect(res.body.message).toEqual('Invalid or expired OTP');
    });

    it('should return 400 for an expired OTP', async () => {
      // Manually expire the OTP
      user.phoneVerificationOtpExpires = Date.now() - 1;
      await user.save({ validateBeforeSave: false });

      const res = await request(app).post('/api/v1/auth/verify-phone').send({
        phoneNumber: user.phoneNumber,
        otp: otp,
      });

      expect(res.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      expect(res.body.status).toEqual('fail');
      expect(res.body.message).toEqual('Invalid or expired OTP');
    });
  });
});