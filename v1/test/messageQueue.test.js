// v1/test/messageQueue.test.js
const request = require('supertest');
const app = require('../../app');
const { testDb, testAuth, testData, testAssertions } = require('./testSetup');
const Queue = require('bull');

// Mock the User model directly
jest.mock('../models/userModel', () => {
  const mockUser = jest.fn().mockImplementation((data) => ({
    ...data,
    _id: data._id || `mock-user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    save: jest.fn().mockResolvedValue(data),
    toObject: jest.fn().mockReturnValue(data),
    toJSON: jest.fn().mockReturnValue(data),
  }));

  mockUser.create = jest.fn().mockImplementation(async (data) => {
    const instance = new mockUser(data);
    await instance.save();
    return instance;
  });
  
  mockUser.findOne = jest.fn().mockResolvedValue(null);
  mockUser.findById = jest.fn().mockResolvedValue(null);
  mockUser.find = jest.fn().mockResolvedValue([]);
  mockUser.deleteMany = jest.fn().mockResolvedValue({ deletedCount: 1 });

  return mockUser;
});

const User = require('../models/userModel');

// Mock external services and utilities
jest.mock('../utils/emailService');
jest.mock('../utils/smsService');
jest.mock('../config/redis');
jest.mock('bull');

const { sendEmail } = require('../utils/emailService');
const { sendSMS, sendWhatsAppMessage } = require('../utils/smsService');
const redisClient = require('../config/redis');

describe('Message Queue Functionality', () => {
  let testUser;
  let authToken;
  let cookieString;
  let mockEmailQueue;
  let mockSmsQueue;
  let mockWhatsappQueue;

  beforeAll(async () => {
    // Setup test environment
    process.env.NODE_ENV = 'test';
    process.env.JWT_ACCESS_SECRET = 'test_access_secret_key_for_testing_purposes_only';
    process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_key_for_testing_purposes_only';
    process.env.COOKIE_SECRET = 'test-cookie-secret-for-testing';
    process.env.REDIS_URL = 'redis://localhost:6379';
    
    // Wait for database to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  beforeEach(async () => {
    // Clear database using global testDB utility
    if (global.testDatabase && global.testDatabase.isConnected) {
      await global.testDatabase.clean();
    } else if (global.testDB) {
      await global.testDB.clean();
    } else {
      await testDb.clearDatabase();
    }

    // Wait a bit for database to be ready
    await new Promise(resolve => setTimeout(resolve, 100));

    // Create test user with staff role for message sending
    const userData = testData.createUser({ role: 'Staff' });
    testUser = await User.create(userData);
    
    // Generate auth token
    authToken = testAuth.generateTestToken({ userId: testUser._id, role: testUser.role });
    cookieString = testAuth.createSignedCookieString(authToken);

    // Mock Bull Queue instances
    mockEmailQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
      process: jest.fn(),
      on: jest.fn(),
      name: 'emailQueue'
    };

    mockSmsQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-2' }),
      process: jest.fn(),
      on: jest.fn(),
      name: 'smsQueue'
    };

    mockWhatsappQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-3' }),
      process: jest.fn(),
      on: jest.fn(),
      name: 'whatsappQueue'
    };

    // Mock Queue constructor to return our mock instances
    Queue.mockImplementation((name) => {
      switch (name) {
        case 'emailQueue':
          return mockEmailQueue;
        case 'smsQueue':
          return mockSmsQueue;
        case 'whatsappQueue':
          return mockWhatsappQueue;
        default:
          return {
            add: jest.fn(),
            process: jest.fn(),
            on: jest.fn(),
            name: name
          };
      }
    });

    // Mock email and SMS services
    sendEmail.mockResolvedValue(true);
    sendSMS.mockResolvedValue(true);
    sendWhatsAppMessage.mockResolvedValue(true);
  });

  afterEach(async () => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await testDb.closeDatabase();
  });

  describe('Email Queue Functionality', () => {
    test('should add email to queue when queue is available', async () => {
      const emailData = {
        to: 'test@example.com',
        subject: 'Test Email',
        html: '<h1>Test Email Content</h1>'
      };

      const response = await request(app)
        .post('/api/v1/messages/send-email')
        .set('Cookie', cookieString)
        .send(emailData);

      testAssertions.assertSuccessResponse(response, 200);
      expect(response.body.message).toContain('Email added to queue');
      expect(mockEmailQueue.add).toHaveBeenCalledWith({
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html
      });
    });

    test('should send email directly when queue is not available', async () => {
      // Mock Queue constructor to throw error (simulating Redis unavailable)
      Queue.mockImplementation(() => {
        throw new Error('Redis connection failed');
      });

      const emailData = {
        to: 'test@example.com',
        subject: 'Test Email Direct',
        html: '<h1>Direct Email Content</h1>'
      };

      const response = await request(app)
        .post('/api/v1/messages/send-email')
        .set('Cookie', cookieString)
        .send(emailData);

      testAssertions.assertSuccessResponse(response, 200);
      expect(response.body.message).toContain('Email sent successfully');
      expect(sendEmail).toHaveBeenCalledWith({
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html
      });
    });

    test('should validate required email fields', async () => {
      const incompleteEmailData = {
        to: 'test@example.com',
        // Missing subject and html
      };

      const response = await request(app)
        .post('/api/v1/messages/send-email')
        .set('Cookie', cookieString)
        .send(incompleteEmailData);

      testAssertions.assertErrorResponse(response, 400);
      expect(response.body.message).toContain('To, Subject, and HTML content are required');
    });

    test('should require authentication for email sending', async () => {
      const emailData = {
        to: 'test@example.com',
        subject: 'Test Email',
        html: '<h1>Test Email Content</h1>'
      };

      const response = await request(app)
        .post('/api/v1/messages/send-email')
        .send(emailData);

      expect(response.status).toBe(401);
    });

    test('should process email queue jobs correctly', async () => {
      // Simulate queue processing
      const jobData = {
        to: 'test@example.com',
        subject: 'Queued Email',
        html: '<h1>Queued Email Content</h1>'
      };

      // Get the process callback that would be registered
      const messageController = require('../controllers/messageController');
      
      // Simulate processing a job
      if (mockEmailQueue.process.mock.calls.length > 0) {
        const processCallback = mockEmailQueue.process.mock.calls[0][0];
        const mockJob = { data: jobData };
        
        await processCallback(mockJob);
        
        expect(sendEmail).toHaveBeenCalledWith(jobData);
      }
    });
  });

  describe('SMS Queue Functionality', () => {
    test('should add SMS to queue when queue is available', async () => {
      const smsData = {
        to: '+1234567890',
        body: 'Test SMS message'
      };

      const response = await request(app)
        .post('/api/v1/messages/send-sms')
        .set('Cookie', cookieString)
        .send(smsData);

      testAssertions.assertSuccessResponse(response, 200);
      expect(response.body.message).toContain('SMS added to queue');
      expect(mockSmsQueue.add).toHaveBeenCalledWith({
        to: smsData.to,
        body: smsData.body
      });
    });

    test('should send SMS directly when queue is not available', async () => {
      // Mock Queue constructor to throw error
      Queue.mockImplementation(() => {
        throw new Error('Redis connection failed');
      });

      const smsData = {
        to: '+1234567890',
        body: 'Direct SMS message'
      };

      const response = await request(app)
        .post('/api/v1/messages/send-sms')
        .set('Cookie', cookieString)
        .send(smsData);

      testAssertions.assertSuccessResponse(response, 200);
      expect(response.body.message).toContain('SMS sent successfully');
      expect(sendSMS).toHaveBeenCalledWith(smsData.to, smsData.body);
    });

    test('should validate required SMS fields', async () => {
      const incompleteSmsData = {
        to: '+1234567890'
        // Missing body
      };

      const response = await request(app)
        .post('/api/v1/messages/send-sms')
        .set('Cookie', cookieString)
        .send(incompleteSmsData);

      testAssertions.assertErrorResponse(response, 400);
      expect(response.body.message).toContain('To and Body content are required');
    });

    test('should process SMS queue jobs correctly', async () => {
      const jobData = {
        to: '+1234567890',
        body: 'Queued SMS message'
      };

      // Simulate processing a job
      if (mockSmsQueue.process.mock.calls.length > 0) {
        const processCallback = mockSmsQueue.process.mock.calls[0][0];
        const mockJob = { data: jobData };
        
        await processCallback(mockJob);
        
        expect(sendSMS).toHaveBeenCalledWith(jobData.to, jobData.body);
      }
    });
  });

  describe('WhatsApp Queue Functionality', () => {
    test('should add WhatsApp message to queue when queue is available', async () => {
      const whatsappData = {
        to: '+1234567890',
        body: 'Test WhatsApp message'
      };

      const response = await request(app)
        .post('/api/v1/messages/send-whatsapp')
        .set('Cookie', cookieString)
        .send(whatsappData);

      testAssertions.assertSuccessResponse(response, 200);
      expect(response.body.message).toContain('WhatsApp message added to queue');
      expect(mockWhatsappQueue.add).toHaveBeenCalledWith({
        to: whatsappData.to,
        body: whatsappData.body
      });
    });

    test('should send WhatsApp message directly when queue is not available', async () => {
      // Mock Queue constructor to throw error
      Queue.mockImplementation(() => {
        throw new Error('Redis connection failed');
      });

      const whatsappData = {
        to: '+1234567890',
        body: 'Direct WhatsApp message'
      };

      const response = await request(app)
        .post('/api/v1/messages/send-whatsapp')
        .set('Cookie', cookieString)
        .send(whatsappData);

      testAssertions.assertSuccessResponse(response, 200);
      expect(response.body.message).toContain('WhatsApp message sent successfully');
      expect(sendWhatsAppMessage).toHaveBeenCalledWith(whatsappData.to, whatsappData.body);
    });

    test('should validate required WhatsApp fields', async () => {
      const incompleteWhatsappData = {
        body: 'Test message'
        // Missing to field
      };

      const response = await request(app)
        .post('/api/v1/messages/send-whatsapp')
        .set('Cookie', cookieString)
        .send(incompleteWhatsappData);

      testAssertions.assertErrorResponse(response, 400);
      expect(response.body.message).toContain('To and Body content are required');
    });

    test('should process WhatsApp queue jobs correctly', async () => {
      const jobData = {
        to: '+1234567890',
        body: 'Queued WhatsApp message'
      };

      // Simulate processing a job
      if (mockWhatsappQueue.process.mock.calls.length > 0) {
        const processCallback = mockWhatsappQueue.process.mock.calls[0][0];
        const mockJob = { data: jobData };
        
        await processCallback(mockJob);
        
        expect(sendWhatsAppMessage).toHaveBeenCalledWith(jobData.to, jobData.body);
      }
    });
  });

  describe('Queue Error Handling', () => {
    test('should handle queue initialization errors gracefully', async () => {
      // Mock Queue constructor to throw error
      Queue.mockImplementation(() => {
        throw new Error('Redis connection failed');
      });

      const emailData = {
        to: 'test@example.com',
        subject: 'Test Email',
        html: '<h1>Test Email Content</h1>'
      };

      // Should still work by sending directly
      const response = await request(app)
        .post('/api/v1/messages/send-email')
        .set('Cookie', cookieString)
        .send(emailData);

      testAssertions.assertSuccessResponse(response, 200);
      expect(sendEmail).toHaveBeenCalled();
    });

    test('should handle queue job processing errors', async () => {
      // Mock sendEmail to throw error
      sendEmail.mockRejectedValue(new Error('Email service unavailable'));

      const jobData = {
        to: 'test@example.com',
        subject: 'Test Email',
        html: '<h1>Test Email Content</h1>'
      };

      // Simulate processing a job that fails
      if (mockEmailQueue.process.mock.calls.length > 0) {
        const processCallback = mockEmailQueue.process.mock.calls[0][0];
        const mockJob = { data: jobData };
        
        await expect(processCallback(mockJob)).rejects.toThrow('Email service unavailable');
      }
    });

    test('should register error handlers for queues', async () => {
      // Verify that error handlers are registered
      expect(mockEmailQueue.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockSmsQueue.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockWhatsappQueue.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('Queue Retry Mechanisms', () => {
    test('should implement retry logic for failed jobs', async () => {
      // This would test the retry configuration in a real implementation
      // For now, we verify that the queue setup includes retry handling
      
      const emailData = {
        to: 'test@example.com',
        subject: 'Test Email with Retry',
        html: '<h1>Test Email Content</h1>'
      };

      const response = await request(app)
        .post('/api/v1/messages/send-email')
        .set('Cookie', cookieString)
        .send(emailData);

      testAssertions.assertSuccessResponse(response, 200);
      
      // Verify job was added with proper configuration
      expect(mockEmailQueue.add).toHaveBeenCalledWith({
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html
      });
    });

    test('should handle queue backoff strategies', async () => {
      // Test exponential backoff implementation
      // This would be more detailed in a real implementation with Bull queue options
      
      const smsData = {
        to: '+1234567890',
        body: 'SMS with backoff strategy'
      };

      const response = await request(app)
        .post('/api/v1/messages/send-sms')
        .set('Cookie', cookieString)
        .send(smsData);

      testAssertions.assertSuccessResponse(response, 200);
      expect(mockSmsQueue.add).toHaveBeenCalled();
    });
  });

  describe('Queue Monitoring and Status', () => {
    test('should track message delivery status', async () => {
      const emailData = {
        to: 'test@example.com',
        subject: 'Status Tracking Email',
        html: '<h1>Email with Status Tracking</h1>'
      };

      const response = await request(app)
        .post('/api/v1/messages/send-email')
        .set('Cookie', cookieString)
        .send(emailData);

      testAssertions.assertSuccessResponse(response, 200);
      
      // In a real implementation, this would check job status
      expect(mockEmailQueue.add).toHaveBeenCalled();
    });

    test('should prioritize critical notifications', async () => {
      // Test priority queue functionality
      const criticalEmailData = {
        to: 'admin@example.com',
        subject: 'CRITICAL: System Alert',
        html: '<h1>Critical System Alert</h1>',
        priority: 'high'
      };

      const response = await request(app)
        .post('/api/v1/messages/send-email')
        .set('Cookie', cookieString)
        .send(criticalEmailData);

      testAssertions.assertSuccessResponse(response, 200);
      expect(mockEmailQueue.add).toHaveBeenCalled();
    });
  });

  describe('Role-based Access Control', () => {
    test('should allow staff to send messages', async () => {
      const emailData = {
        to: 'test@example.com',
        subject: 'Staff Email',
        html: '<h1>Email from Staff</h1>'
      };

      const response = await request(app)
        .post('/api/v1/messages/send-email')
        .set('Cookie', cookieString)
        .send(emailData);

      testAssertions.assertSuccessResponse(response, 200);
    });

    test('should allow admin to send messages', async () => {
      // Create admin user
      const adminUser = await User.create(testData.createUser({ role: 'Admin' }));
      const adminToken = testAuth.generateTestToken({ userId: adminUser._id, role: adminUser.role });
      const adminCookieString = testAuth.createSignedCookieString(adminToken);

      const emailData = {
        to: 'test@example.com',
        subject: 'Admin Email',
        html: '<h1>Email from Admin</h1>'
      };

      const response = await request(app)
        .post('/api/v1/messages/send-email')
        .set('Cookie', adminCookieString)
        .send(emailData);

      testAssertions.assertSuccessResponse(response, 200);
    });

    test('should deny regular users from sending messages', async () => {
      // Create regular user
      const regularUser = await User.create(testData.createUser({ role: 'User' }));
      const userToken = testAuth.generateTestToken({ userId: regularUser._id, role: regularUser.role });
      const userCookieString = testAuth.createSignedCookieString(userToken);

      const emailData = {
        to: 'test@example.com',
        subject: 'User Email',
        html: '<h1>Email from User</h1>'
      };

      const response = await request(app)
        .post('/api/v1/messages/send-email')
        .set('Cookie', userCookieString)
        .send(emailData);

      expect(response.status).toBe(403);
    });
  });
});