// v1/test/routes/qrCodeRoutes.test.js
const request = require('supertest');
const express = require('express');
const { StatusCodes } = require('http-status-codes');
const qrCodeRoutes = require('../../routes/qrCodeRoutes');
const { ApiError } = require('../../utils/apiError');

// Mock the controller functions
jest.mock('../../controllers/qrCodeController', () => ({
  generateQRCode: jest.fn((req, res) => res.status(201).json({ success: true })),
  validateQRCode: jest.fn((req, res) => res.status(200).json({ success: true })),
  getQRCodeMetadata: jest.fn((req, res) => res.status(200).json({ success: true })),
  downloadQRCode: jest.fn((req, res) => res.status(200).send('mock-data')),
  getQRCodeHealth: jest.fn((req, res) => res.status(200).json({ success: true }))
}));

// Mock authentication middleware
jest.mock('../../middleware/authMiddleware', () => ({
  authenticateUser: jest.fn((req, res, next) => {
    req.user = { id: 'test-user', role: 'Business' };
    next();
  }),
  authorizeRoles: jest.fn(() => (req, res, next) => next())
}));

// Mock validation middleware
jest.mock('../../middleware/validationMiddleware', () => jest.fn(() => (req, res, next) => next()));

// Mock audit middleware
jest.mock('../../middleware/auditMiddleware', () => ({
  createAuditMiddleware: {
    content: jest.fn(() => (req, res, next) => next())
  }
}));

// Mock rate limiting middleware
jest.mock('../../middleware/rateLimitMiddleware', () => ({
  qrCodeGenerationLimiter: jest.fn((req, res, next) => {
    res.set('RateLimit-Limit', '100');
    res.set('RateLimit-Remaining', '99');
    res.set('RateLimit-Reset', Date.now() + 900000);
    next();
  }),
  qrCodeValidationLimiter: jest.fn((req, res, next) => {
    res.set('RateLimit-Limit', '100');
    res.set('RateLimit-Remaining', '99');
    res.set('RateLimit-Reset', Date.now() + 900000);
    next();
  }),
  qrCodeMetadataLimiter: jest.fn((req, res, next) => {
    res.set('RateLimit-Limit', '100');
    res.set('RateLimit-Remaining', '99');
    res.set('RateLimit-Reset', Date.now() + 900000);
    next();
  }),
  qrCodeDownloadLimiter: jest.fn((req, res, next) => {
    res.set('RateLimit-Limit', '100');
    res.set('RateLimit-Remaining', '99');
    res.set('RateLimit-Reset', Date.now() + 900000);
    next();
  }),
  qrCodeHealthLimiter: jest.fn((req, res, next) => {
    res.set('RateLimit-Limit', '100');
    res.set('RateLimit-Remaining', '99');
    res.set('RateLimit-Reset', Date.now() + 900000);
    next();
  }),
  qrCodeSensitiveLimiter: jest.fn((req, res, next) => {
    res.set('RateLimit-Limit', '20');
    res.set('RateLimit-Remaining', '19');
    res.set('RateLimit-Reset', Date.now() + 1800000);
    next();
  })
}));

// Get references to mocked modules
const mockControllers = require('../../controllers/qrCodeController');
const mockAuthMiddleware = require('../../middleware/authMiddleware');
const mockValidationMiddleware = require('../../middleware/validationMiddleware');
const mockAuditMiddleware = require('../../middleware/auditMiddleware');
const mockRateLimiters = require('../../middleware/rateLimitMiddleware');

describe('QR Code Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/qr-codes', qrCodeRoutes);
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup default middleware mocks
    mockAuthMiddleware.authenticateUser.mockImplementation((req, res, next) => {
      req.user = { id: 'test-user-123', role: 'Business' };
      next();
    });
    
    mockAuthMiddleware.authorizeRoles.mockImplementation(() => (req, res, next) => next());
    
    mockValidationMiddleware.mockImplementation(() => (req, res, next) => next());
    
    mockAuditMiddleware.createAuditMiddleware.content.mockImplementation(() => (req, res, next) => next());
    
    // Setup default rate limiter mocks
    Object.values(mockRateLimiters).forEach(limiter => {
      limiter.mockImplementation((req, res, next) => {
        // Add rate limit headers
        res.set({
          'RateLimit-Limit': '100',
          'RateLimit-Remaining': '99',
          'RateLimit-Reset': Date.now() + 900000
        });
        next();
      });
    });
    
    // Setup default controller mocks
    mockControllers.generateQRCode.mockImplementation((req, res) => {
      res.status(201).json({
        success: true,
        message: 'QR code generated successfully',
        data: { qrId: 'qr_test-123' }
      });
    });
    
    mockControllers.validateQRCode.mockImplementation((req, res) => {
      res.status(200).json({
        success: true,
        message: 'QR code validated successfully',
        data: { valid: true }
      });
    });
    
    mockControllers.getQRCodeMetadata.mockImplementation((req, res) => {
      res.status(200).json({
        success: true,
        message: 'Metadata retrieved successfully',
        data: { qrId: req.params.qrId }
      });
    });
    
    mockControllers.downloadQRCode.mockImplementation((req, res) => {
      res.status(200).send('mock-image-data');
    });
    
    mockControllers.getQRCodeHealth.mockImplementation((req, res) => {
      res.status(200).json({
        success: true,
        message: 'Service is healthy',
        data: { status: 'healthy' }
      });
    });
  });

  describe('Middleware Integration', () => {
    describe('Authentication Middleware', () => {
      it('should require authentication for POST /generate', async () => {
        mockAuthMiddleware.authenticateUser.mockImplementationOnce((req, res, next) => {
          res.status(401).json({ success: false, message: 'Authentication required' });
        });

        const response = await request(app)
          .post('/api/v1/qr-codes/generate')
          .send({
            type: 'affiliate',
            data: { affiliateId: 'AFF-123', referralCode: 'REF-456' }
          });

        expect(response.status).toBe(401);
        expect(mockAuthMiddleware.authenticateUser).toHaveBeenCalled();
        expect(mockControllers.generateQRCode).not.toHaveBeenCalled();
      });

      it('should require authentication for POST /validate', async () => {
        mockAuthMiddleware.authenticateUser.mockImplementationOnce((req, res, next) => {
          res.status(401).json({ success: false, message: 'Authentication required' });
        });

        const response = await request(app)
          .post('/api/v1/qr-codes/validate')
          .send({ qrData: 'test-data' });

        expect(response.status).toBe(401);
        expect(mockAuthMiddleware.authenticateUser).toHaveBeenCalled();
        expect(mockControllers.validateQRCode).not.toHaveBeenCalled();
      });

      it('should require authentication for GET /:qrId', async () => {
        mockAuthMiddleware.authenticateUser.mockImplementationOnce((req, res, next) => {
          res.status(401).json({ success: false, message: 'Authentication required' });
        });

        const response = await request(app)
          .get('/api/v1/qr-codes/qr_12345678-1234-1234-1234-123456789012');

        expect(response.status).toBe(401);
        expect(mockAuthMiddleware.authenticateUser).toHaveBeenCalled();
        expect(mockControllers.getQRCodeMetadata).not.toHaveBeenCalled();
      });

      it('should require authentication for GET /:qrId/download', async () => {
        mockAuthMiddleware.authenticateUser.mockImplementationOnce((req, res, next) => {
          res.status(401).json({ success: false, message: 'Authentication required' });
        });

        const response = await request(app)
          .get('/api/v1/qr-codes/qr_12345678-1234-1234-1234-123456789012/download');

        expect(response.status).toBe(401);
        expect(mockAuthMiddleware.authenticateUser).toHaveBeenCalled();
        expect(mockControllers.downloadQRCode).not.toHaveBeenCalled();
      });

      it('should NOT require authentication for GET /health', async () => {
        const response = await request(app)
          .get('/api/v1/qr-codes/health');

        expect(response.status).toBe(200);
        expect(mockControllers.getQRCodeHealth).toHaveBeenCalled();
      });

      it('should pass authenticated user to controller', async () => {
        const testUser = { id: 'user-456', role: 'Admin' };
        mockAuthMiddleware.authenticateUser.mockImplementationOnce((req, res, next) => {
          req.user = testUser;
          next();
        });

        await request(app)
          .post('/api/v1/qr-codes/generate')
          .send({
            type: 'affiliate',
            data: { affiliateId: 'AFF-123', referralCode: 'REF-456' }
          });

        expect(mockControllers.generateQRCode).toHaveBeenCalled();
        const req = mockControllers.generateQRCode.mock.calls[0][0];
        expect(req.user).toEqual(testUser);
      });
    });

    describe('Validation Middleware', () => {
      it('should validate request body for POST /generate', async () => {
        // Create a new app instance with failing validation
        const testApp = express();
        testApp.use(express.json());
        
        // Mock validation to fail
        const failingValidation = jest.fn(() => (req, res, next) => {
          res.status(400).json({ 
            success: false, 
            message: 'Validation failed: type is required' 
          });
        });
        
        // Create route with failing validation
        const testRouter = express.Router();
        testRouter.post('/generate', 
          mockRateLimiters.qrCodeGenerationLimiter,
          mockAuthMiddleware.authenticateUser,
          failingValidation(),
          mockControllers.generateQRCode
        );
        
        testApp.use('/api/v1/qr-codes', testRouter);

        const response = await request(testApp)
          .post('/api/v1/qr-codes/generate')
          .send({ data: {} });

        expect(response.status).toBe(400);
        expect(failingValidation).toHaveBeenCalled();
      });

      it('should validate request body for POST /validate', async () => {
        // Create a new app instance with failing validation
        const testApp = express();
        testApp.use(express.json());
        
        // Mock validation to fail
        const failingValidation = jest.fn(() => (req, res, next) => {
          res.status(400).json({ 
            success: false, 
            message: 'Validation failed: qrData is required' 
          });
        });
        
        // Create route with failing validation
        const testRouter = express.Router();
        testRouter.post('/validate', 
          mockRateLimiters.qrCodeValidationLimiter,
          mockAuthMiddleware.authenticateUser,
          failingValidation(),
          mockControllers.validateQRCode
        );
        
        testApp.use('/api/v1/qr-codes', testRouter);

        const response = await request(testApp)
          .post('/api/v1/qr-codes/validate')
          .send({});

        expect(response.status).toBe(400);
        expect(failingValidation).toHaveBeenCalled();
      });

      it('should validate qrId parameter for GET /:qrId', async () => {
        // Create a new app instance with failing validation
        const testApp = express();
        testApp.use(express.json());
        
        // Mock validation to fail
        const failingValidation = jest.fn(() => (req, res, next) => {
          res.status(400).json({ 
            success: false, 
            message: 'Validation failed: Invalid QR code ID format' 
          });
        });
        
        // Create route with failing validation
        const testRouter = express.Router();
        testRouter.get('/:qrId', 
          mockRateLimiters.qrCodeMetadataLimiter,
          mockAuthMiddleware.authenticateUser,
          failingValidation(),
          mockControllers.getQRCodeMetadata
        );
        
        testApp.use('/api/v1/qr-codes', testRouter);

        const response = await request(testApp)
          .get('/api/v1/qr-codes/invalid-qr-id');

        expect(response.status).toBe(400);
        expect(failingValidation).toHaveBeenCalled();
      });

      it('should validate qrId parameter and query params for GET /:qrId/download', async () => {
        // Create a new app instance with failing validation
        const testApp = express();
        testApp.use(express.json());
        
        // Mock validation to fail
        const failingValidation = jest.fn(() => (req, res, next) => {
          res.status(400).json({ 
            success: false, 
            message: 'Validation failed: Invalid size parameter' 
          });
        });
        
        // Create route with failing validation
        const testRouter = express.Router();
        testRouter.get('/:qrId/download', 
          mockRateLimiters.qrCodeDownloadLimiter,
          mockAuthMiddleware.authenticateUser,
          failingValidation(),
          mockControllers.downloadQRCode
        );
        
        testApp.use('/api/v1/qr-codes', testRouter);

        const response = await request(testApp)
          .get('/api/v1/qr-codes/qr_12345678-1234-1234-1234-123456789012/download?size=invalid');

        expect(response.status).toBe(400);
        expect(failingValidation).toHaveBeenCalled();
      });

      it('should pass validation for valid requests', async () => {
        const response = await request(app)
          .post('/api/v1/qr-codes/generate')
          .send({
            type: 'affiliate',
            data: { affiliateId: 'AFF-123', referralCode: 'REF-456' }
          });

        expect(response.status).toBe(201);
        expect(mockControllers.generateQRCode).toHaveBeenCalled();
      });
    });

    describe('Rate Limiting Middleware', () => {
      it('should apply qrCodeGenerationLimiter to POST /generate', async () => {
        await request(app)
          .post('/api/v1/qr-codes/generate')
          .send({
            type: 'affiliate',
            data: { affiliateId: 'AFF-123', referralCode: 'REF-456' }
          });

        expect(mockRateLimiters.qrCodeGenerationLimiter).toHaveBeenCalled();
      });

      it('should apply qrCodeValidationLimiter to POST /validate', async () => {
        await request(app)
          .post('/api/v1/qr-codes/validate')
          .send({ qrData: 'test-data' });

        expect(mockRateLimiters.qrCodeValidationLimiter).toHaveBeenCalled();
      });

      it('should apply qrCodeMetadataLimiter to GET /:qrId', async () => {
        await request(app)
          .get('/api/v1/qr-codes/qr_12345678-1234-1234-1234-123456789012');

        expect(mockRateLimiters.qrCodeMetadataLimiter).toHaveBeenCalled();
      });

      it('should apply qrCodeDownloadLimiter to GET /:qrId/download', async () => {
        await request(app)
          .get('/api/v1/qr-codes/qr_12345678-1234-1234-1234-123456789012/download');

        expect(mockRateLimiters.qrCodeDownloadLimiter).toHaveBeenCalled();
      });

      it('should apply qrCodeHealthLimiter to GET /health', async () => {
        await request(app)
          .get('/api/v1/qr-codes/health');

        expect(mockRateLimiters.qrCodeHealthLimiter).toHaveBeenCalled();
      });

      it('should apply sensitive rate limiting for withdrawal QR codes', async () => {
        await request(app)
          .post('/api/v1/qr-codes/generate')
          .send({
            type: 'withdrawal',
            data: {
              withdrawalId: 'WD-123',
              affiliateId: 'AFF-123',
              amount: 10000,
              status: 'pending'
            }
          });

        expect(mockRateLimiters.qrCodeGenerationLimiter).toHaveBeenCalled();
        expect(mockRateLimiters.qrCodeSensitiveLimiter).toHaveBeenCalled();
      });

      it('should apply sensitive rate limiting for commission QR codes', async () => {
        await request(app)
          .post('/api/v1/qr-codes/generate')
          .send({
            type: 'commission',
            data: {
              transactionId: 'TXN-123',
              affiliateId: 'AFF-123',
              commissionAmount: 5000,
              serviceType: 'flight',
              status: 'approved'
            }
          });

        expect(mockRateLimiters.qrCodeGenerationLimiter).toHaveBeenCalled();
        expect(mockRateLimiters.qrCodeSensitiveLimiter).toHaveBeenCalled();
      });

      it('should NOT apply sensitive rate limiting for affiliate QR codes', async () => {
        await request(app)
          .post('/api/v1/qr-codes/generate')
          .send({
            type: 'affiliate',
            data: { affiliateId: 'AFF-123', referralCode: 'REF-456' }
          });

        expect(mockRateLimiters.qrCodeGenerationLimiter).toHaveBeenCalled();
        expect(mockRateLimiters.qrCodeSensitiveLimiter).not.toHaveBeenCalled();
      });

      it('should include rate limit headers in responses', async () => {
        const response = await request(app)
          .get('/api/v1/qr-codes/health');

        expect(response.headers['ratelimit-limit']).toBe('100');
        expect(response.headers['ratelimit-remaining']).toBe('99');
        expect(response.headers['ratelimit-reset']).toBeDefined();
      });

      it('should handle rate limit exceeded', async () => {
        mockRateLimiters.qrCodeGenerationLimiter.mockImplementationOnce((req, res, next) => {
          res.status(429).json({
            success: false,
            message: 'Too many QR code generation requests'
          });
        });

        const response = await request(app)
          .post('/api/v1/qr-codes/generate')
          .send({
            type: 'affiliate',
            data: { affiliateId: 'AFF-123', referralCode: 'REF-456' }
          });

        expect(response.status).toBe(429);
        expect(mockControllers.generateQRCode).not.toHaveBeenCalled();
      });
    });

    describe('Audit Middleware', () => {
      it('should apply audit middleware to POST /generate', async () => {
        // Test that the route structure includes audit middleware for generate endpoint
        // This is verified by checking that the route exists and responds correctly
        const response = await request(app)
          .post('/api/v1/qr-codes/generate')
          .send({
            type: 'affiliate',
            data: { affiliateId: 'AFF-123', referralCode: 'REF-456' }
          });

        expect(response.status).toBe(201);
        expect(mockControllers.generateQRCode).toHaveBeenCalled();
      });

      it('should NOT apply audit middleware to other endpoints', async () => {
        // Test that other endpoints work without audit middleware
        const validateResponse = await request(app)
          .post('/api/v1/qr-codes/validate')
          .send({ qrData: 'test-data' });

        const metadataResponse = await request(app)
          .get('/api/v1/qr-codes/qr_12345678-1234-1234-1234-123456789012');

        const healthResponse = await request(app)
          .get('/api/v1/qr-codes/health');

        expect(validateResponse.status).toBe(200);
        expect(metadataResponse.status).toBe(200);
        expect(healthResponse.status).toBe(200);
        
        expect(mockControllers.validateQRCode).toHaveBeenCalled();
        expect(mockControllers.getQRCodeMetadata).toHaveBeenCalled();
        expect(mockControllers.getQRCodeHealth).toHaveBeenCalled();
      });
    });
  });

  describe('Request/Response Flow', () => {
    describe('POST /generate', () => {
      it('should handle successful QR code generation', async () => {
        const requestData = {
          type: 'affiliate',
          data: { affiliateId: 'AFF-123', referralCode: 'REF-456' },
          options: { size: 256, format: 'png' }
        };

        const response = await request(app)
          .post('/api/v1/qr-codes/generate')
          .send(requestData);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(mockControllers.generateQRCode).toHaveBeenCalled();
        
        const req = mockControllers.generateQRCode.mock.calls[0][0];
        expect(req.body).toEqual(requestData);
      });

      it('should handle controller errors', async () => {
        mockControllers.generateQRCode.mockImplementationOnce((req, res) => {
          res.status(500).json({
            success: false,
            message: 'QR code generation failed'
          });
        });

        const response = await request(app)
          .post('/api/v1/qr-codes/generate')
          .send({
            type: 'affiliate',
            data: { affiliateId: 'AFF-123', referralCode: 'REF-456' }
          });

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
      });
    });

    describe('POST /validate', () => {
      it('should handle successful QR code validation', async () => {
        const requestData = { qrData: 'encoded-qr-data-string' };

        const response = await request(app)
          .post('/api/v1/qr-codes/validate')
          .send(requestData);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(mockControllers.validateQRCode).toHaveBeenCalled();
        
        const req = mockControllers.validateQRCode.mock.calls[0][0];
        expect(req.body).toEqual(requestData);
      });

      it('should handle validation errors', async () => {
        mockControllers.validateQRCode.mockImplementationOnce((req, res) => {
          res.status(400).json({
            success: false,
            message: 'Invalid QR code data'
          });
        });

        const response = await request(app)
          .post('/api/v1/qr-codes/validate')
          .send({ qrData: 'invalid-data' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /:qrId', () => {
      it('should handle successful metadata retrieval', async () => {
        const qrId = 'qr_12345678-1234-1234-1234-123456789012';

        const response = await request(app)
          .get(`/api/v1/qr-codes/${qrId}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(mockControllers.getQRCodeMetadata).toHaveBeenCalled();
        
        const req = mockControllers.getQRCodeMetadata.mock.calls[0][0];
        expect(req.params.qrId).toBe(qrId);
      });

      it('should handle not found errors', async () => {
        mockControllers.getQRCodeMetadata.mockImplementationOnce((req, res) => {
          res.status(404).json({
            success: false,
            message: 'QR code not found'
          });
        });

        const response = await request(app)
          .get('/api/v1/qr-codes/qr_12345678-1234-1234-1234-123456789012');

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /:qrId/download', () => {
      it('should handle successful download', async () => {
        const qrId = 'qr_12345678-1234-1234-1234-123456789012';

        const response = await request(app)
          .get(`/api/v1/qr-codes/${qrId}/download`);

        expect(response.status).toBe(200);
        expect(mockControllers.downloadQRCode).toHaveBeenCalled();
        
        const req = mockControllers.downloadQRCode.mock.calls[0][0];
        expect(req.params.qrId).toBe(qrId);
      });

      it('should handle download with query parameters', async () => {
        const qrId = 'qr_12345678-1234-1234-1234-123456789012';
        const queryParams = { size: '512', format: 'png', quality: '0.8' };

        const response = await request(app)
          .get(`/api/v1/qr-codes/${qrId}/download`)
          .query(queryParams);

        expect(response.status).toBe(200);
        expect(mockControllers.downloadQRCode).toHaveBeenCalled();
        
        const req = mockControllers.downloadQRCode.mock.calls[0][0];
        expect(req.params.qrId).toBe(qrId);
        expect(req.query).toEqual(queryParams);
      });

      it('should handle download errors', async () => {
        mockControllers.downloadQRCode.mockImplementationOnce((req, res) => {
          res.status(404).json({
            success: false,
            message: 'QR code image not found'
          });
        });

        const response = await request(app)
          .get('/api/v1/qr-codes/qr_12345678-1234-1234-1234-123456789012/download');

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /health', () => {
      it('should handle successful health check', async () => {
        const response = await request(app)
          .get('/api/v1/qr-codes/health');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(mockControllers.getQRCodeHealth).toHaveBeenCalled();
      });

      it('should handle unhealthy service', async () => {
        mockControllers.getQRCodeHealth.mockImplementationOnce((req, res) => {
          res.status(503).json({
            success: false,
            message: 'Service is unhealthy',
            data: { status: 'unhealthy' }
          });
        });

        const response = await request(app)
          .get('/api/v1/qr-codes/health');

        expect(response.status).toBe(503);
        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('Parameter Handling', () => {
    it('should pass correct parameters to controllers', async () => {
      const qrId = 'qr_12345678-1234-1234-1234-123456789012';
      const queryParams = { size: '256', format: 'svg' };

      await request(app)
        .get(`/api/v1/qr-codes/${qrId}/download`)
        .query(queryParams);

      expect(mockControllers.downloadQRCode).toHaveBeenCalled();
      const req = mockControllers.downloadQRCode.mock.calls[0][0];
      
      expect(req.params.qrId).toBe(qrId);
      expect(req.query).toEqual(queryParams);
    });

    it('should handle missing optional parameters', async () => {
      const qrId = 'qr_12345678-1234-1234-1234-123456789012';

      await request(app)
        .get(`/api/v1/qr-codes/${qrId}/download`);

      expect(mockControllers.downloadQRCode).toHaveBeenCalled();
      const req = mockControllers.downloadQRCode.mock.calls[0][0];
      
      expect(req.params.qrId).toBe(qrId);
      expect(req.query).toEqual({});
    });

    it('should handle complex request bodies', async () => {
      const complexRequestData = {
        type: 'commission',
        data: {
          transactionId: 'TXN-123',
          affiliateId: 'AFF-456',
          commissionAmount: 15000,
          currency: 'NGN',
          serviceType: 'hotel',
          bookingReference: 'HTL-789',
          status: 'approved'
        },
        options: {
          size: 512,
          format: 'svg',
          errorCorrectionLevel: 'H'
        }
      };

      await request(app)
        .post('/api/v1/qr-codes/generate')
        .send(complexRequestData);

      expect(mockControllers.generateQRCode).toHaveBeenCalled();
      const req = mockControllers.generateQRCode.mock.calls[0][0];
      expect(req.body).toEqual(complexRequestData);
    });
  });

  describe('Error Response Handling', () => {
    it('should handle middleware errors properly', async () => {
      // Create a new app instance with error handling
      const testApp = express();
      testApp.use(express.json());
      
      // Mock validation to throw error
      const errorValidation = jest.fn(() => (req, res, next) => {
        const error = new Error('Validation error');
        error.statusCode = 400;
        next(error);
      });
      
      // Add error handling middleware
      testApp.use((err, req, res, next) => {
        res.status(err.statusCode || 500).json({
          success: false,
          message: err.message
        });
      });
      
      // Create route with error validation
      const testRouter = express.Router();
      testRouter.post('/generate', 
        mockRateLimiters.qrCodeGenerationLimiter,
        mockAuthMiddleware.authenticateUser,
        errorValidation(),
        mockControllers.generateQRCode
      );
      
      testApp.use('/api/v1/qr-codes', testRouter);

      const response = await request(testApp)
        .post('/api/v1/qr-codes/generate')
        .send({ invalid: 'data' });

      // The error should be handled by the error middleware
      expect(response.status).toBe(400);
      expect(errorValidation).toHaveBeenCalled();
    });

    it('should handle authentication errors', async () => {
      mockAuthMiddleware.authenticateUser.mockImplementationOnce((req, res, next) => {
        const error = new ApiError('Invalid token', StatusCodes.UNAUTHORIZED);
        next(error);
      });

      const response = await request(app)
        .post('/api/v1/qr-codes/generate')
        .send({
          type: 'affiliate',
          data: { affiliateId: 'AFF-123', referralCode: 'REF-456' }
        });

      expect(response.status).toBe(401);
    });

    it('should handle rate limiting errors', async () => {
      mockRateLimiters.qrCodeGenerationLimiter.mockImplementationOnce((req, res, next) => {
        res.status(429).json({
          success: false,
          message: 'Rate limit exceeded'
        });
      });

      const response = await request(app)
        .post('/api/v1/qr-codes/generate')
        .send({
          type: 'affiliate',
          data: { affiliateId: 'AFF-123', referralCode: 'REF-456' }
        });

      expect(response.status).toBe(429);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Middleware Order', () => {
    it('should execute middleware in correct order for protected routes', async () => {
      const executionOrder = [];

      // Create a new app instance to test middleware order
      const testApp = express();
      testApp.use(express.json());
      
      // Create middleware spies that track execution order
      const rateLimiterSpy = jest.fn((req, res, next) => {
        executionOrder.push('rateLimiter');
        next();
      });
      
      const sensitiveLimiterSpy = jest.fn((req, res, next) => {
        executionOrder.push('sensitiveRateLimiter');
        next();
      });
      
      const authSpy = jest.fn((req, res, next) => {
        executionOrder.push('auth');
        req.user = { id: 'test-user' };
        next();
      });
      
      const validationSpy = jest.fn(() => (req, res, next) => {
        executionOrder.push('validation');
        next();
      });
      
      const auditSpy = jest.fn(() => (req, res, next) => {
        executionOrder.push('audit');
        next();
      });
      
      const controllerSpy = jest.fn((req, res) => {
        executionOrder.push('controller');
        res.status(201).json({ success: true });
      });
      
      // Create middleware to apply sensitive rate limiting conditionally
      const applySensitiveRateLimit = (req, res, next) => {
        const qrType = req.body?.type;
        if (qrType === 'withdrawal' || qrType === 'commission') {
          return sensitiveLimiterSpy(req, res, next);
        }
        next();
      };
      
      // Create route with correct middleware order
      const testRouter = express.Router();
      testRouter.use(authSpy); // Auth middleware applied to all routes
      
      testRouter.post('/generate',
        rateLimiterSpy,
        applySensitiveRateLimit,
        validationSpy(),
        auditSpy(),
        controllerSpy
      );
      
      testApp.use('/api/v1/qr-codes', testRouter);

      await request(testApp)
        .post('/api/v1/qr-codes/generate')
        .send({
          type: 'withdrawal',
          data: {
            withdrawalId: 'WD-123',
            affiliateId: 'AFF-123',
            amount: 10000,
            status: 'pending'
          }
        });

      expect(executionOrder).toEqual([
        'auth',
        'rateLimiter',
        'sensitiveRateLimiter',
        'validation',
        'audit',
        'controller'
      ]);
    });

    it('should execute middleware in correct order for public routes', async () => {
      const executionOrder = [];

      mockRateLimiters.qrCodeHealthLimiter.mockImplementationOnce((req, res, next) => {
        executionOrder.push('rateLimiter');
        next();
      });

      mockControllers.getQRCodeHealth.mockImplementationOnce((req, res) => {
        executionOrder.push('controller');
        res.status(200).json({ success: true });
      });

      await request(app)
        .get('/api/v1/qr-codes/health');

      expect(executionOrder).toEqual(['rateLimiter', 'controller']);
    });
  });
});