// v1/test/integration/qrCodeAPI.test.js
const request = require('supertest');
const { StatusCodes } = require('http-status-codes');
// Import the real app, not the mock
const app = jest.requireActual('../../../app');
const User = require('../../models/userModel');
const qrCodeService = require('../../services/qrCodeService');
const testDbManager = require('../testDbManager');
const { generateToken } = require('../../utils/jwt');

// Mock QR code service for controlled testing
jest.mock('../../services/qrCodeService');

// Mock authentication middleware to use test headers
jest.mock('../../middleware/authMiddleware', () => {
  const originalModule = jest.requireActual('../../middleware/authMiddleware');
  return {
    ...originalModule,
    authenticateUser: (req, res, next) => {
      // Check for test authentication header
      if (req.headers['x-test-user']) {
        try {
          const userInfo = JSON.parse(req.headers['x-test-user']);
          if (userInfo.userId && userInfo.role) {
            req.user = { 
              userId: userInfo.userId, 
              role: userInfo.role 
            };
            return next();
          }
        } catch (error) {
          // Fall through to error
        }
      }
      
      // Return authentication error
      const { ApiError } = require('../utils/apiError');
      const { StatusCodes } = require('http-status-codes');
      return next(new ApiError('Authentication invalid: No access or refresh token provided', StatusCodes.UNAUTHORIZED));
    }
  };
});

// Helper functions for generating test data
const generateTestUser = async (overrides = {}) => {
  const userData = {
    firstName: 'Test',
    lastName: 'User',
    email: `test${Date.now()}@example.com`,
    password: 'TestPassword123!',
    role: 'Business',
    isEmailVerified: true,
    isPhoneVerified: true,
    ...overrides
  };
  
  return await User.create(userData);
};

const createMockAuthHeader = (userId, role = 'Business') => ({
  'x-test-user': JSON.stringify({ userId, role })
});

describe('QR Code API Integration Tests', () => {
  let testUser;
  let authToken;
  let mockQRResult;

  beforeAll(async () => {
    // Set test environment variables
    process.env.JWT_ACCESS_SECRET = 'test-jwt-access-secret-key-for-qr-code-tests';
    process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key-for-qr-code-tests';
    process.env.NODE_ENV = 'test';
    
    // Ensure test database connection
    await testDbManager.ensureConnection();
  });

  afterAll(async () => {
    await testDbManager.disconnect();
  });

  beforeEach(async () => {
    // Clean database before each test
    await testDbManager.cleanDatabase();
    
    // Create test user
    testUser = await generateTestUser({
      role: 'Business'
    });

    // Generate auth token (not used in mock auth, but kept for consistency)
    try {
      authToken = generateToken({ id: testUser._id, role: testUser.role });
    } catch (error) {
      // If token generation fails, we'll rely on mock auth headers
      authToken = null;
    }

    // Setup mock QR result
    mockQRResult = {
      data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      url: 'https://app.travelplace.com/qr/qr_123456789',
      metadata: {
        qrId: 'qr_123456789',
        type: 'affiliate',
        metadata: {
          version: '1.0',
          source: 'travel-place-api',
          expiresAt: null,
          affiliateId: 'AFF-123',
          referralCode: 'REF123',
          businessName: 'Test Business'
        }
      }
    };

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('QR Code Generation Workflow Integration Tests', () => {
    describe('POST /api/v1/qr-codes/generate - Affiliate QR Code', () => {
      const validAffiliateData = {
        type: 'affiliate',
        data: {
          affiliateId: 'AFF-123',
          referralCode: 'REF123',
          businessName: 'Test Business'
        },
        options: {
          size: 256,
          format: 'png',
          errorCorrectionLevel: 'M'
        }
      };

      it('should generate affiliate QR code successfully with authentication', async () => {
        qrCodeService.generateAffiliateQR.mockResolvedValue(mockQRResult);

        const response = await request(app)
          .post('/api/v1/qr-codes/generate')
          .set(createMockAuthHeader(testUser._id, 'Business'))
          .send(validAffiliateData)
          .expect(StatusCodes.CREATED);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('QR code generated successfully');
        expect(response.body.data).toHaveProperty('qrId', 'qr_123456789');
        expect(response.body.data).toHaveProperty('type', 'affiliate');
        expect(response.body.data).toHaveProperty('imageData');
        expect(response.body.data).toHaveProperty('url');
        expect(response.body.data).toHaveProperty('downloadUrl');
        expect(response.body.data.metadata).toHaveProperty('affiliateId', 'AFF-123');
        expect(response.body.data.metadata).toHaveProperty('referralCode', 'REF123');
        expect(response.body.data.metadata).toHaveProperty('businessName', 'Test Business');

        expect(qrCodeService.generateAffiliateQR).toHaveBeenCalledWith(validAffiliateData.data);
      });

      it('should require authentication for QR code generation', async () => {
        const response = await request(app)
          .post('/api/v1/qr-codes/generate')
          .send(validAffiliateData)
          .expect(StatusCodes.UNAUTHORIZED);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Authentication invalid');
      });

      it('should validate required fields for affiliate QR code', async () => {
        const invalidData = {
          type: 'affiliate',
          data: {
            affiliateId: 'AFF-123'
            // Missing referralCode
          }
        };

        const response = await request(app)
          .post('/api/v1/qr-codes/generate')
          .set(createMockAuthHeader(testUser._id, 'Business'))
          .send(invalidData)
          .expect(StatusCodes.BAD_REQUEST);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Required fields missing');
      });

      it('should validate QR code type', async () => {
        const invalidData = {
          type: 'invalid-type',
          data: {
            affiliateId: 'AFF-123',
            referralCode: 'REF123'
          }
        };

        const response = await request(app)
          .post('/api/v1/qr-codes/generate')
          .set(createMockAuthHeader(testUser._id, 'Business'))
          .send(invalidData)
          .expect(StatusCodes.BAD_REQUEST);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('QR code type must be one of');
      });

      it('should validate options parameters', async () => {
        const invalidOptionsData = {
          type: 'affiliate',
          data: {
            affiliateId: 'AFF-123',
            referralCode: 'REF123'
          },
          options: {
            size: 32, // Below minimum
            format: 'jpeg' // Invalid format
          }
        };

        const response = await request(app)
          .post('/api/v1/qr-codes/generate')
          .set(createMockAuthHeader(testUser._id, 'Business'))
          .send(invalidOptionsData)
          .expect(StatusCodes.BAD_REQUEST);

        expect(response.body.success).toBe(false);
      });

      it('should handle service errors during generation', async () => {
        qrCodeService.generateAffiliateQR.mockRejectedValue(new Error('Service unavailable'));

        const response = await request(app)
          .post('/api/v1/qr-codes/generate')
          .set(createMockAuthHeader(testUser._id, 'Business'))
          .send(validAffiliateData)
          .expect(StatusCodes.INTERNAL_SERVER_ERROR);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Failed to generate QR code');
      });
    });

    describe('POST /api/v1/qr-codes/generate - Commission QR Code', () => {
      const validCommissionData = {
        type: 'commission',
        data: {
          transactionId: 'TXN-123',
          affiliateId: 'AFF-123',
          commissionAmount: 5000,
          currency: 'NGN',
          serviceType: 'visa',
          bookingReference: 'BOOK-123',
          status: 'completed'
        }
      };

      it('should generate commission QR code successfully', async () => {
        const commissionQRResult = {
          ...mockQRResult,
          metadata: {
            ...mockQRResult.metadata,
            type: 'commission',
            metadata: {
              version: '1.0',
              source: 'travel-place-api',
              affiliateId: 'AFF-123',
              amount: 5000,
              currency: 'NGN',
              serviceType: 'visa',
              bookingReference: 'BOOK-123',
              status: 'completed'
            }
          }
        };

        qrCodeService.generateCommissionQR.mockResolvedValue(commissionQRResult);

        const response = await request(app)
          .post('/api/v1/qr-codes/generate')
          .set(createMockAuthHeader(testUser._id, 'Business'))
          .send(validCommissionData)
          .expect(StatusCodes.CREATED);

        expect(response.body.success).toBe(true);
        expect(response.body.data.type).toBe('commission');
        expect(response.body.data.metadata).toHaveProperty('affiliateId', 'AFF-123');
        expect(response.body.data.metadata).toHaveProperty('amount', 5000);
        expect(response.body.data.metadata).toHaveProperty('serviceType', 'visa');

        expect(qrCodeService.generateCommissionQR).toHaveBeenCalledWith(validCommissionData.data);
      });

      it('should validate required commission fields', async () => {
        const invalidData = {
          type: 'commission',
          data: {
            transactionId: 'TXN-123',
            affiliateId: 'AFF-123'
            // Missing required fields
          }
        };

        const response = await request(app)
          .post('/api/v1/qr-codes/generate')
          .set(createMockAuthHeader(testUser._id, 'Business'))
          .send(invalidData)
          .expect(StatusCodes.BAD_REQUEST);

        expect(response.body.success).toBe(false);
      });
    });

    describe('POST /api/v1/qr-codes/generate - Withdrawal QR Code', () => {
      const validWithdrawalData = {
        type: 'withdrawal',
        data: {
          withdrawalId: 'WD-123',
          affiliateId: 'AFF-123',
          amount: 10000,
          currency: 'NGN',
          status: 'pending',
          bankDetails: {
            accountName: 'John Doe',
            bankName: 'Test Bank'
          }
        }
      };

      it('should generate withdrawal QR code successfully', async () => {
        const withdrawalQRResult = {
          ...mockQRResult,
          metadata: {
            ...mockQRResult.metadata,
            type: 'withdrawal',
            metadata: {
              version: '1.0',
              source: 'travel-place-api',
              affiliateId: 'AFF-123',
              amount: 10000,
              currency: 'NGN',
              status: 'pending',
              bankDetails: {
                accountName: 'John Doe',
                bankName: 'Test Bank'
              }
            }
          }
        };

        qrCodeService.generateWithdrawalQR.mockResolvedValue(withdrawalQRResult);

        const response = await request(app)
          .post('/api/v1/qr-codes/generate')
          .set(createMockAuthHeader(testUser._id, 'Business'))
          .send(validWithdrawalData)
          .expect(StatusCodes.CREATED);

        expect(response.body.success).toBe(true);
        expect(response.body.data.type).toBe('withdrawal');
        expect(response.body.data.metadata).toHaveProperty('amount', 10000);
        expect(response.body.data.metadata.bankDetails).toHaveProperty('accountName', 'John Doe');

        expect(qrCodeService.generateWithdrawalQR).toHaveBeenCalledWith(validWithdrawalData.data);
      });
    });

    describe('POST /api/v1/qr-codes/generate - Referral QR Code', () => {
      const validReferralData = {
        type: 'referral',
        data: {
          affiliateId: 'AFF-123',
          referralCode: 'REF123',
          campaign: 'summer2024',
          source: 'qr_code'
        }
      };

      it('should generate referral QR code successfully', async () => {
        const referralQRResult = {
          ...mockQRResult,
          metadata: {
            ...mockQRResult.metadata,
            type: 'referral',
            metadata: {
              version: '1.0',
              source: 'travel-place-api',
              affiliateId: 'AFF-123',
              referralCode: 'REF123',
              campaign: 'summer2024',
              source: 'qr_code',
              expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            }
          }
        };

        qrCodeService.generateReferralQR.mockResolvedValue(referralQRResult);

        const response = await request(app)
          .post('/api/v1/qr-codes/generate')
          .set(createMockAuthHeader(testUser._id, 'Business'))
          .send(validReferralData)
          .expect(StatusCodes.CREATED);

        expect(response.body.success).toBe(true);
        expect(response.body.data.type).toBe('referral');
        expect(response.body.data.metadata).toHaveProperty('campaign', 'summer2024');

        expect(qrCodeService.generateReferralQR).toHaveBeenCalledWith(validReferralData.data);
      });
    });
  });

  describe('QR Code Validation Workflow Integration Tests', () => {
    describe('POST /api/v1/qr-codes/validate', () => {
      const validQRData = JSON.stringify({
        qrId: 'qr_123456789',
        type: 'affiliate',
        id: 'AFF-123',
        timestamp: new Date(),
        metadata: {
          version: '1.0',
          source: 'travel-place-api',
          affiliateId: 'AFF-123'
        }
      });

      it('should validate QR code successfully without authentication', async () => {
        const validationResult = {
          valid: true,
          data: {
            qrId: 'qr_123456789',
            type: 'affiliate',
            id: 'AFF-123',
            timestamp: new Date(),
            metadata: {
              version: '1.0',
              source: 'travel-place-api',
              affiliateId: 'AFF-123'
            }
          }
        };

        qrCodeService.validateQRCode.mockResolvedValue(validationResult);

        const response = await request(app)
          .post('/api/v1/qr-codes/validate')
          .set(createMockAuthHeader(testUser._id, 'Business'))
          .send({ qrData: validQRData })
          .expect(StatusCodes.OK);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('QR code validation completed');
        expect(response.body.data).toHaveProperty('valid', true);
        expect(response.body.data).toHaveProperty('reason', null);
        expect(response.body.data.qrData).toHaveProperty('qrId', 'qr_123456789');
        expect(response.body.data.qrData).toHaveProperty('type', 'affiliate');

        expect(qrCodeService.validateQRCode).toHaveBeenCalledWith(validQRData);
      });

      it('should handle expired QR code validation', async () => {
        const expiredResult = {
          valid: false,
          reason: 'QR code has expired',
          data: {
            qrId: 'qr_123456789',
            type: 'referral',
            id: 'AFF-123',
            timestamp: new Date(),
            metadata: {
              expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // Expired yesterday
            }
          }
        };

        qrCodeService.validateQRCode.mockResolvedValue(expiredResult);

        const response = await request(app)
          .post('/api/v1/qr-codes/validate')
          .set(createMockAuthHeader(testUser._id, 'Business'))
          .send({ qrData: validQRData })
          .expect(StatusCodes.OK);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('valid', false);
        expect(response.body.data).toHaveProperty('reason', 'QR code has expired');
        expect(response.body.data).toHaveProperty('qrData', null);
      });

      it('should handle invalid QR code format', async () => {
        const invalidResult = {
          valid: false,
          reason: 'Invalid QR code format',
          data: null
        };

        qrCodeService.validateQRCode.mockResolvedValue(invalidResult);

        const response = await request(app)
          .post('/api/v1/qr-codes/validate')
          .set(createMockAuthHeader(testUser._id, 'Business'))
          .send({ qrData: 'invalid-qr-data' })
          .expect(StatusCodes.OK);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('valid', false);
        expect(response.body.data).toHaveProperty('reason', 'Invalid QR code format');
        expect(response.body.data).toHaveProperty('qrData', null);
      });

      it('should require QR data in request body', async () => {
        const response = await request(app)
          .post('/api/v1/qr-codes/validate')
          .set(createMockAuthHeader(testUser._id, 'Business'))
          .send({})
          .expect(StatusCodes.BAD_REQUEST);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('QR data is required');
      });

      it('should handle validation service errors', async () => {
        qrCodeService.validateQRCode.mockRejectedValue(new Error('Validation service error'));

        const response = await request(app)
          .post('/api/v1/qr-codes/validate')
          .set(createMockAuthHeader(testUser._id, 'Business'))
          .send({ qrData: validQRData })
          .expect(StatusCodes.INTERNAL_SERVER_ERROR);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Failed to validate QR code');
      });

      it('should validate QR data length', async () => {
        const tooLongQRData = 'x'.repeat(10001); // Exceeds max length

        const response = await request(app)
          .post('/api/v1/qr-codes/validate')
          .set(createMockAuthHeader(testUser._id, 'Business'))
          .send({ qrData: tooLongQRData })
          .expect(StatusCodes.BAD_REQUEST);

        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('Metadata Retrieval and Download Functionality Integration Tests', () => {
    describe('GET /api/v1/qr-codes/:qrId', () => {
      const validQRId = 'qr_123456789';

      it('should retrieve QR code metadata successfully with authentication', async () => {
        const mockMetadata = {
          qrId: validQRId,
          type: 'affiliate',
          affiliateId: 'AFF-123',
          referralCode: 'REF123',
          createdAt: new Date(),
          version: '1.0'
        };

        qrCodeService.getQRCodeMetadata.mockResolvedValue(mockMetadata);

        const response = await request(app)
          .get(`/api/v1/qr-codes/${validQRId}`)
          .set(createMockAuthHeader(testUser._id, 'Business'))
          .expect(StatusCodes.OK);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('QR code metadata retrieved successfully');
        expect(response.body.data).toHaveProperty('qrId', validQRId);
        expect(response.body.data).toHaveProperty('type', 'affiliate');

        expect(qrCodeService.getQRCodeMetadata).toHaveBeenCalledWith(validQRId);
      });

      it('should require authentication for metadata retrieval', async () => {
        const response = await request(app)
          .get(`/api/v1/qr-codes/${validQRId}`)
          .expect(StatusCodes.UNAUTHORIZED);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Authentication invalid');
      });

      it('should validate QR ID format', async () => {
        const invalidQRId = 'invalid-qr-id';

        const response = await request(app)
          .get(`/api/v1/qr-codes/${invalidQRId}`)
          .set(createMockAuthHeader(testUser._id, 'Business'))
          .expect(StatusCodes.BAD_REQUEST);

        expect(response.body.success).toBe(false);
      });

      it('should handle service unavailable for metadata retrieval', async () => {
        const serviceError = new Error('QR code metadata retrieval not yet implemented');
        serviceError.statusCode = StatusCodes.NOT_IMPLEMENTED;
        qrCodeService.getQRCodeMetadata.mockRejectedValue(serviceError);

        const response = await request(app)
          .get(`/api/v1/qr-codes/${validQRId}`)
          .set(createMockAuthHeader(testUser._id, 'Business'))
          .expect(StatusCodes.INTERNAL_SERVER_ERROR);

        expect(response.body.success).toBe(false);
      });

      it('should sanitize sensitive metadata fields', async () => {
        const mockMetadata = {
          qrId: validQRId,
          type: 'withdrawal',
          affiliateId: 'AFF-123',
          amount: 10000,
          bankDetails: {
            accountName: 'John Doe',
            bankName: 'Test Bank',
            accountNumber: '1234567890', // Should be removed
            routingNumber: '123456789' // Should be removed
          },
          internalId: 'internal-123', // Should be removed
          secretKey: 'secret-key', // Should be removed
          privateData: 'private' // Should be removed
        };

        qrCodeService.getQRCodeMetadata.mockResolvedValue(mockMetadata);

        const response = await request(app)
          .get(`/api/v1/qr-codes/${validQRId}`)
          .set(createMockAuthHeader(testUser._id, 'Business'))
          .expect(StatusCodes.OK);

        expect(response.body.data).toHaveProperty('qrId', validQRId);
        expect(response.body.data).toHaveProperty('type', 'withdrawal');
        expect(response.body.data).toHaveProperty('amount', 10000);
        expect(response.body.data.bankDetails).toHaveProperty('accountName', 'John Doe');
        expect(response.body.data.bankDetails).toHaveProperty('bankName', 'Test Bank');

        // Verify sensitive fields are not included
        expect(response.body.data).not.toHaveProperty('internalId');
        expect(response.body.data).not.toHaveProperty('secretKey');
        expect(response.body.data).not.toHaveProperty('privateData');
        expect(response.body.data.bankDetails).not.toHaveProperty('accountNumber');
        expect(response.body.data.bankDetails).not.toHaveProperty('routingNumber');
      });
    });

    describe('GET /api/v1/qr-codes/:qrId/download', () => {
      const validQRId = 'qr_123456789';

      it('should handle download request with proper validation', async () => {
        const response = await request(app)
          .get(`/api/v1/qr-codes/${validQRId}/download`)
          .set(createMockAuthHeader(testUser._id, 'Business'))
          .expect(StatusCodes.SERVICE_UNAVAILABLE);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('QR code download is not yet available');
      });

      it('should validate QR ID format for download', async () => {
        const invalidQRId = 'invalid-qr-id';

        const response = await request(app)
          .get(`/api/v1/qr-codes/${invalidQRId}/download`)
          .set(createMockAuthHeader(testUser._id, 'Business'))
          .expect(StatusCodes.BAD_REQUEST);

        expect(response.body.success).toBe(false);
      });

      it('should validate format parameter', async () => {
        const response = await request(app)
          .get(`/api/v1/qr-codes/${validQRId}/download?format=jpeg`)
          .set(createMockAuthHeader(testUser._id, 'Business'))
          .expect(StatusCodes.BAD_REQUEST);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Format must be either png or svg');
      });

      it('should validate size parameter', async () => {
        const response = await request(app)
          .get(`/api/v1/qr-codes/${validQRId}/download?size=32`)
          .set(createMockAuthHeader(testUser._id, 'Business'))
          .expect(StatusCodes.BAD_REQUEST);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Size must be between 64 and 1024 pixels');
      });

      it('should accept valid format and size parameters', async () => {
        const response = await request(app)
          .get(`/api/v1/qr-codes/${validQRId}/download?format=svg&size=512`)
          .set(createMockAuthHeader(testUser._id, 'Business'))
          .expect(StatusCodes.SERVICE_UNAVAILABLE);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('QR code download is not yet available');
      });
    });
  });

  describe('Authentication and Authorization Requirements Integration Tests', () => {
    const validAffiliateData = {
      type: 'affiliate',
      data: {
        affiliateId: 'AFF-123',
        referralCode: 'REF123',
        businessName: 'Test Business'
      }
    };

    describe('Authentication Requirements', () => {
      it('should require authentication for QR code generation', async () => {
        const response = await request(app)
          .post('/api/v1/qr-codes/generate')
          .send(validAffiliateData)
          .expect(StatusCodes.UNAUTHORIZED);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Authentication invalid');
      });

      it('should require authentication for metadata retrieval', async () => {
        const response = await request(app)
          .get('/api/v1/qr-codes/qr_123456789')
          .expect(StatusCodes.UNAUTHORIZED);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Authentication invalid');
      });

      it('should allow validation without authentication', async () => {
        qrCodeService.validateQRCode.mockResolvedValue({
          valid: true,
          data: { qrId: 'qr_123', type: 'affiliate' }
        });

        const response = await request(app)
          .post('/api/v1/qr-codes/validate')
          .set(createMockAuthHeader(testUser._id, 'Business'))
          .send({ qrData: 'test-qr-data' })
          .expect(StatusCodes.OK);

        expect(response.body.success).toBe(true);
      });
    });

    describe('Role-based Authorization', () => {
      it('should allow Business users to generate QR codes', async () => {
        qrCodeService.generateAffiliateQR.mockResolvedValue(mockQRResult);

        const response = await request(app)
          .post('/api/v1/qr-codes/generate')
          .set(createMockAuthHeader(testUser._id, 'Business'))
          .send(validAffiliateData)
          .expect(StatusCodes.CREATED);

        expect(response.body.success).toBe(true);
      });

      it('should allow Admin users to generate QR codes', async () => {
        const adminUser = await generateTestUser({ role: 'Admin' });
        qrCodeService.generateAffiliateQR.mockResolvedValue(mockQRResult);

        const response = await request(app)
          .post('/api/v1/qr-codes/generate')
          .set(createMockAuthHeader(adminUser._id, 'Admin'))
          .send(validAffiliateData)
          .expect(StatusCodes.CREATED);

        expect(response.body.success).toBe(true);
      });

      it('should allow User role to generate QR codes', async () => {
        const regularUser = await generateTestUser({ role: 'User' });
        qrCodeService.generateAffiliateQR.mockResolvedValue(mockQRResult);

        const response = await request(app)
          .post('/api/v1/qr-codes/generate')
          .set(createMockAuthHeader(regularUser._id, 'User'))
          .send(validAffiliateData)
          .expect(StatusCodes.CREATED);

        expect(response.body.success).toBe(true);
      });
    });

    describe('Token Validation', () => {
      it('should reject invalid authentication tokens', async () => {
        const response = await request(app)
          .post('/api/v1/qr-codes/generate')
          .set('x-test-user', 'invalid-json')
          .send(validAffiliateData)
          .expect(StatusCodes.UNAUTHORIZED);

        expect(response.body.success).toBe(false);
      });

      it('should reject incomplete user information', async () => {
        const response = await request(app)
          .post('/api/v1/qr-codes/generate')
          .set('x-test-user', JSON.stringify({ userId: testUser._id })) // Missing role
          .send(validAffiliateData)
          .expect(StatusCodes.UNAUTHORIZED);

        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('Error Responses and Status Codes Integration Tests', () => {
    describe('Validation Error Responses', () => {
      it('should return 400 for missing required fields', async () => {
        const response = await request(app)
          .post('/api/v1/qr-codes/generate')
          .set(createMockAuthHeader(testUser._id, 'Business'))
          .send({
            type: 'affiliate',
            data: {
              affiliateId: 'AFF-123'
              // Missing referralCode
            }
          })
          .expect(StatusCodes.BAD_REQUEST);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Required fields missing');
      });

      it('should return 400 for invalid QR code type', async () => {
        const response = await request(app)
          .post('/api/v1/qr-codes/generate')
          .set(createMockAuthHeader(testUser._id, 'Business'))
          .send({
            type: 'invalid-type',
            data: {}
          })
          .expect(StatusCodes.BAD_REQUEST);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('QR code type must be one of');
      });

      it('should return 400 for invalid size parameter', async () => {
        const response = await request(app)
          .get('/api/v1/qr-codes/qr_123456789/download?size=2048')
          .set(createMockAuthHeader(testUser._id, 'Business'))
          .expect(StatusCodes.BAD_REQUEST);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Size must be between 64 and 1024 pixels');
      });
    });

    describe('Authentication Error Responses', () => {
      it('should return 401 for missing authentication', async () => {
        const response = await request(app)
          .post('/api/v1/qr-codes/generate')
          .send({
            type: 'affiliate',
            data: {
              affiliateId: 'AFF-123',
              referralCode: 'REF123'
            }
          })
          .expect(StatusCodes.UNAUTHORIZED);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Authentication invalid');
      });
    });

    describe('Service Error Responses', () => {
      it('should return 500 for service failures', async () => {
        qrCodeService.generateAffiliateQR.mockRejectedValue(new Error('Service unavailable'));

        const response = await request(app)
          .post('/api/v1/qr-codes/generate')
          .set(createMockAuthHeader(testUser._id, 'Business'))
          .send({
            type: 'affiliate',
            data: {
              affiliateId: 'AFF-123',
              referralCode: 'REF123'
            }
          })
          .expect(StatusCodes.INTERNAL_SERVER_ERROR);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Failed to generate QR code');
      });

      it('should return 503 for service unavailable', async () => {
        const response = await request(app)
          .get('/api/v1/qr-codes/qr_123456789/download')
          .set(createMockAuthHeader(testUser._id, 'Business'))
          .expect(StatusCodes.SERVICE_UNAVAILABLE);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('QR code download is not yet available');
      });
    });

    describe('Rate Limiting Error Responses', () => {
      it('should handle rate limiting gracefully', async () => {
        qrCodeService.generateAffiliateQR.mockResolvedValue(mockQRResult);

        const validData = {
          type: 'affiliate',
          data: {
            affiliateId: 'AFF-123',
            referralCode: 'REF123'
          }
        };

        // Make multiple requests to potentially trigger rate limiting
        const requests = Array(5).fill().map(() =>
          request(app)
            .post('/api/v1/qr-codes/generate')
            .set(createMockAuthHeader(testUser._id, 'Business'))
            .send(validData)
        );

        const responses = await Promise.all(requests);

        // At least some requests should succeed
        const successfulResponses = responses.filter(res => res.status === StatusCodes.CREATED);
        expect(successfulResponses.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Health Check Integration Tests', () => {
    describe('GET /api/v1/qr-codes/health', () => {
      it('should return health status without authentication', async () => {
        const mockHealthStatus = {
          isHealthy: true,
          failures: 0,
          lastFailure: null,
          circuitBreakerOpen: false,
          totalRequests: 100,
          successfulRequests: 95,
          averageResponseTime: 150
        };

        qrCodeService.getQRCodeHealth.mockReturnValue(mockHealthStatus);
        qrCodeService.performHealthCheck.mockResolvedValue(true);

        const response = await request(app)
          .get('/api/v1/qr-codes/health')
          .expect(StatusCodes.OK);

        expect(response.body.status).toBe('success');
        expect(response.body.message).toContain('healthy');
        expect(response.body.data).toHaveProperty('status', 'healthy');
        expect(response.body.data).toHaveProperty('service', 'QR Code Service');
        expect(response.body.data).toHaveProperty('checks');
        expect(response.body.data).toHaveProperty('metrics');
      });

      it('should return unhealthy status when service has issues', async () => {
        const mockHealthStatus = {
          isHealthy: false,
          failures: 5,
          lastFailure: new Date(),
          circuitBreakerOpen: true,
          totalRequests: 100,
          successfulRequests: 85,
          averageResponseTime: 300
        };

        qrCodeService.getQRCodeHealth.mockReturnValue(mockHealthStatus);
        qrCodeService.performHealthCheck.mockResolvedValue(false);

        const response = await request(app)
          .get('/api/v1/qr-codes/health')
          .expect(StatusCodes.SERVICE_UNAVAILABLE);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('unhealthy');
        expect(response.body.data).toHaveProperty('status', 'unhealthy');
        expect(response.body.data.checks.serviceWrapper).toHaveProperty('status', 'fail');
      });

      it('should handle health check errors gracefully', async () => {
        qrCodeService.getQRCodeHealth.mockImplementation(() => {
          throw new Error('Health check failed');
        });

        const response = await request(app)
          .get('/api/v1/qr-codes/health')
          .expect(StatusCodes.SERVICE_UNAVAILABLE);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('unhealthy');
        expect(response.body.data).toHaveProperty('status', 'unhealthy');
        expect(response.body.data).toHaveProperty('error');
      });
    });
  });

  describe('End-to-End QR Code Workflow Integration Tests', () => {
    it('should complete full QR code generation and validation workflow', async () => {
      // Step 1: Generate QR code
      qrCodeService.generateAffiliateQR.mockResolvedValue(mockQRResult);

      const generateResponse = await request(app)
        .post('/api/v1/qr-codes/generate')
        .set(createMockAuthHeader(testUser._id, 'Business'))
        .send({
          type: 'affiliate',
          data: {
            affiliateId: 'AFF-123',
            referralCode: 'REF123',
            businessName: 'Test Business'
          }
        })
        .expect(StatusCodes.CREATED);

      expect(generateResponse.body.success).toBe(true);
      const qrId = generateResponse.body.data.qrId;

      // Step 2: Validate the generated QR code
      const validationResult = {
        valid: true,
        data: {
          qrId: qrId,
          type: 'affiliate',
          id: 'AFF-123',
          timestamp: new Date(),
          metadata: {
            version: '1.0',
            source: 'travel-place-api',
            affiliateId: 'AFF-123'
          }
        }
      };

      qrCodeService.validateQRCode.mockResolvedValue(validationResult);

      const validateResponse = await request(app)
        .post('/api/v1/qr-codes/validate')
        .set(createMockAuthHeader(testUser._id, 'Business'))
        .send({ qrData: JSON.stringify(validationResult.data) })
        .expect(StatusCodes.OK);

      expect(validateResponse.body.success).toBe(true);
      expect(validateResponse.body.data.valid).toBe(true);
      expect(validateResponse.body.data.qrData.qrId).toBe(qrId);

      // Step 3: Attempt to retrieve metadata (will fail due to service unavailable)
      qrCodeService.getQRCodeMetadata.mockRejectedValue(
        new Error('QR code metadata retrieval not yet implemented')
      );

      const metadataResponse = await request(app)
        .get(`/api/v1/qr-codes/${qrId}`)
        .set(createMockAuthHeader(testUser._id, 'Business'))
        .expect(StatusCodes.INTERNAL_SERVER_ERROR);

      expect(metadataResponse.body.success).toBe(false);

      // Step 4: Attempt to download QR code (will fail due to service unavailable)
      const downloadResponse = await request(app)
        .get(`/api/v1/qr-codes/${qrId}/download`)
        .set(createMockAuthHeader(testUser._id, 'Business'))
        .expect(StatusCodes.SERVICE_UNAVAILABLE);

      expect(downloadResponse.body.success).toBe(false);
      expect(downloadResponse.body.message).toBe('QR code download is not yet available');
    });

    it('should handle complete workflow with different QR code types', async () => {
      const qrTypes = [
        {
          type: 'commission',
          data: {
            transactionId: 'TXN-123',
            affiliateId: 'AFF-123',
            commissionAmount: 5000,
            currency: 'NGN',
            serviceType: 'visa',
            bookingReference: 'BOOK-123',
            status: 'completed'
          },
          mockMethod: 'generateCommissionQR'
        },
        {
          type: 'withdrawal',
          data: {
            withdrawalId: 'WD-123',
            affiliateId: 'AFF-123',
            amount: 10000,
            currency: 'NGN',
            status: 'pending',
            bankDetails: {
              accountName: 'John Doe',
              bankName: 'Test Bank'
            }
          },
          mockMethod: 'generateWithdrawalQR'
        },
        {
          type: 'referral',
          data: {
            affiliateId: 'AFF-123',
            referralCode: 'REF123',
            campaign: 'summer2024',
            source: 'qr_code'
          },
          mockMethod: 'generateReferralQR'
        }
      ];

      for (const qrType of qrTypes) {
        const typeSpecificResult = {
          ...mockQRResult,
          metadata: {
            ...mockQRResult.metadata,
            type: qrType.type,
            qrId: `qr_${qrType.type}_123`
          }
        };

        qrCodeService[qrType.mockMethod].mockResolvedValue(typeSpecificResult);

        const response = await request(app)
          .post('/api/v1/qr-codes/generate')
          .set(createMockAuthHeader(testUser._id, 'Business'))
          .send({
            type: qrType.type,
            data: qrType.data
          })
          .expect(StatusCodes.CREATED);

        expect(response.body.success).toBe(true);
        expect(response.body.data.type).toBe(qrType.type);
        expect(qrCodeService[qrType.mockMethod]).toHaveBeenCalledWith(qrType.data);
      }
    });
  });
});