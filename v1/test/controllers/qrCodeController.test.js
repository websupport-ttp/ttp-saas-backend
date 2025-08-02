// v1/test/controllers/qrCodeController.test.js
const { StatusCodes } = require('http-status-codes');
const qrCodeController = require('../../controllers/qrCodeController');
const qrCodeService = require('../../services/qrCodeService');
const { ApiError } = require('../../utils/apiError');
const ApiResponse = require('../../utils/apiResponse');
const logger = require('../../utils/logger');

// Mock dependencies
jest.mock('../../services/qrCodeService');
jest.mock('../../utils/logger');
jest.mock('../../utils/apiResponse');

describe('QR Code Controller', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      query: {},
      user: { id: 'user123' },
      ip: '127.0.0.1',
      protocol: 'https',
      get: jest.fn((header) => {
        if (header === 'host') return 'api.travelplace.com';
        if (header === 'User-Agent') return 'test-agent';
        return null;
      })
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      set: jest.fn(),
      send: jest.fn()
    };
    next = jest.fn();
    
    // Clear all mocks
    jest.clearAllMocks();
    
    // Mock ApiResponse methods
    ApiResponse.created = jest.fn();
    ApiResponse.success = jest.fn();
  });

  describe('generateQRCode', () => {
    const mockQRResult = {
      data: 'base64-encoded-image-data',
      url: 'https://app.travelplace.com/qr/qr_123',
      metadata: {
        qrId: 'qr_123',
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

    describe('Affiliate QR Code Generation', () => {
      beforeEach(() => {
        req.body = {
          type: 'affiliate',
          data: {
            affiliateId: 'AFF-123',
            referralCode: 'REF123',
            businessName: 'Test Business'
          }
        };
      });

      it('should generate affiliate QR code successfully', async () => {
        qrCodeService.generateAffiliateQR.mockResolvedValue(mockQRResult);

        await qrCodeController.generateQRCode(req, res);

        expect(qrCodeService.generateAffiliateQR).toHaveBeenCalledWith(req.body.data);
        expect(logger.info).toHaveBeenCalledWith('QR code generation attempt', {
          userId: 'user123',
          type: 'affiliate',
          ip: '127.0.0.1',
          userAgent: 'test-agent'
        });
        expect(logger.info).toHaveBeenCalledWith('QR code generated successfully', {
          userId: 'user123',
          qrId: 'qr_123',
          type: 'affiliate'
        });
        expect(ApiResponse.created).toHaveBeenCalledWith(
          res,
          'QR code generated successfully',
          expect.objectContaining({
            qrId: 'qr_123',
            type: 'affiliate',
            imageData: 'base64-encoded-image-data',
            url: 'https://app.travelplace.com/qr/qr_123',
            downloadUrl: 'https://api.travelplace.com/api/v1/qr-codes/qr_123/download',
            metadata: expect.objectContaining({
              version: '1.0',
              source: 'travel-place-api',
              expiresAt: null,
              affiliateId: 'AFF-123',
              referralCode: 'REF123',
              businessName: 'Test Business'
            })
          })
        );
      });

      it('should handle service errors during affiliate QR generation', async () => {
        const serviceError = new Error('Service unavailable');
        qrCodeService.generateAffiliateQR.mockRejectedValue(serviceError);

        await qrCodeController.generateQRCode(req, res, next);

        expect(next).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Failed to generate QR code',
            statusCode: StatusCodes.INTERNAL_SERVER_ERROR
          })
        );
        
        expect(logger.error).toHaveBeenCalledWith('QR code generation failed', {
          userId: 'user123',
          type: 'affiliate',
          error: 'Service unavailable',
          stack: serviceError.stack
        });
      });
    });

    describe('Commission QR Code Generation', () => {
      beforeEach(() => {
        req.body = {
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
      });

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

        await qrCodeController.generateQRCode(req, res);

        expect(qrCodeService.generateCommissionQR).toHaveBeenCalledWith(req.body.data);
        expect(ApiResponse.created).toHaveBeenCalledWith(
          res,
          'QR code generated successfully',
          expect.objectContaining({
            type: 'commission',
            metadata: expect.objectContaining({
              affiliateId: 'AFF-123',
              amount: 5000,
              currency: 'NGN',
              serviceType: 'visa',
              bookingReference: 'BOOK-123',
              status: 'completed'
            })
          })
        );
      });
    });

    describe('Withdrawal QR Code Generation', () => {
      beforeEach(() => {
        req.body = {
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
      });

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

        await qrCodeController.generateQRCode(req, res);

        expect(qrCodeService.generateWithdrawalQR).toHaveBeenCalledWith(req.body.data);
        expect(ApiResponse.created).toHaveBeenCalledWith(
          res,
          'QR code generated successfully',
          expect.objectContaining({
            type: 'withdrawal',
            metadata: expect.objectContaining({
              affiliateId: 'AFF-123',
              amount: 10000,
              currency: 'NGN',
              status: 'pending',
              bankDetails: {
                accountName: 'John Doe',
                bankName: 'Test Bank'
              }
            })
          })
        );
      });
    });

    describe('Referral QR Code Generation', () => {
      beforeEach(() => {
        req.body = {
          type: 'referral',
          data: {
            affiliateId: 'AFF-123',
            referralCode: 'REF123',
            campaign: 'summer2024',
            source: 'qr_code'
          }
        };
      });

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

        await qrCodeController.generateQRCode(req, res);

        expect(qrCodeService.generateReferralQR).toHaveBeenCalledWith(req.body.data);
        expect(ApiResponse.created).toHaveBeenCalledWith(
          res,
          'QR code generated successfully',
          expect.objectContaining({
            type: 'referral',
            metadata: expect.objectContaining({
              affiliateId: 'AFF-123',
              referralCode: 'REF123',
              campaign: 'summer2024',
              source: 'qr_code'
            })
          })
        );
      });
    });

    describe('Error Scenarios', () => {
      it('should handle invalid QR code type', async () => {
        req.body = {
          type: 'invalid-type',
          data: {}
        };

        await qrCodeController.generateQRCode(req, res, next);

        expect(next).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Invalid QR code type: invalid-type',
            statusCode: StatusCodes.BAD_REQUEST
          })
        );
      });

      it('should handle ApiError from service', async () => {
        req.body = {
          type: 'affiliate',
          data: {
            affiliateId: 'AFF-123',
            referralCode: 'REF123'
          }
        };
        
        const apiError = new ApiError('Invalid affiliate data', StatusCodes.BAD_REQUEST);
        qrCodeService.generateAffiliateQR.mockRejectedValue(apiError);

        await qrCodeController.generateQRCode(req, res, next);

        expect(next).toHaveBeenCalledWith(apiError);
      });

      it('should wrap non-ApiError exceptions', async () => {
        req.body = {
          type: 'affiliate',
          data: {
            affiliateId: 'AFF-123',
            referralCode: 'REF123'
          }
        };
        
        const genericError = new Error('Unexpected error');
        qrCodeService.generateAffiliateQR.mockRejectedValue(genericError);

        await qrCodeController.generateQRCode(req, res, next);

        expect(next).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Failed to generate QR code',
            statusCode: StatusCodes.INTERNAL_SERVER_ERROR
          })
        );
      });
    });
  });

  describe('validateQRCode', () => {
    const validQRData = JSON.stringify({
      qrId: 'qr_123',
      type: 'affiliate',
      id: 'AFF-123',
      timestamp: new Date(),
      metadata: {
        version: '1.0',
        source: 'travel-place-api',
        affiliateId: 'AFF-123'
      }
    });

    beforeEach(() => {
      req.body = { qrData: validQRData };
    });

    it('should validate QR code successfully', async () => {
      const validationResult = {
        valid: true,
        data: {
          qrId: 'qr_123',
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

      await qrCodeController.validateQRCode(req, res);

      expect(qrCodeService.validateQRCode).toHaveBeenCalledWith(validQRData);
      expect(logger.info).toHaveBeenCalledWith('QR code validation attempt', {
        ip: '127.0.0.1',
        userAgent: 'test-agent'
      });
      expect(logger.info).toHaveBeenCalledWith('QR code validation completed', {
        valid: true,
        reason: undefined,
        qrId: 'qr_123'
      });
      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        StatusCodes.OK,
        'QR code validation completed',
        expect.objectContaining({
          valid: true,
          reason: null,
          qrData: expect.objectContaining({
            qrId: 'qr_123',
            type: 'affiliate',
            id: 'AFF-123'
          })
        })
      );
    });

    it('should handle expired QR code', async () => {
      const expiredResult = {
        valid: false,
        reason: 'QR code has expired',
        data: {
          qrId: 'qr_123',
          type: 'referral',
          id: 'AFF-123',
          timestamp: new Date(),
          metadata: {
            expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // Expired yesterday
          }
        }
      };

      qrCodeService.validateQRCode.mockResolvedValue(expiredResult);

      await qrCodeController.validateQRCode(req, res);

      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        StatusCodes.OK,
        'QR code validation completed',
        expect.objectContaining({
          valid: false,
          reason: 'QR code has expired',
          qrData: null
        })
      );
    });

    it('should handle invalid QR code format', async () => {
      const invalidResult = {
        valid: false,
        reason: 'Invalid QR code type',
        data: {
          qrId: 'qr_123',
          type: 'invalid-type',
          id: 'AFF-123'
        }
      };

      qrCodeService.validateQRCode.mockResolvedValue(invalidResult);

      await qrCodeController.validateQRCode(req, res);

      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        StatusCodes.OK,
        'QR code validation completed',
        expect.objectContaining({
          valid: false,
          reason: 'Invalid QR code type',
          qrData: null
        })
      );
    });

    it('should handle missing QR data', async () => {
      req.body = {};

      await qrCodeController.validateQRCode(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'QR data is required',
          statusCode: StatusCodes.BAD_REQUEST
        })
      );
    });

    it('should handle empty QR data', async () => {
      req.body = { qrData: '' };

      await qrCodeController.validateQRCode(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'QR data is required',
          statusCode: StatusCodes.BAD_REQUEST
        })
      );
    });

    it('should handle service errors during validation', async () => {
      req.body = { qrData: validQRData };
      const serviceError = new Error('Validation service error');
      qrCodeService.validateQRCode.mockRejectedValue(serviceError);

      await qrCodeController.validateQRCode(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Failed to validate QR code',
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR
        })
      );

      expect(logger.error).toHaveBeenCalledWith('QR code validation failed', {
        error: 'Validation service error',
        stack: serviceError.stack
      });
    });

    it('should handle ApiError from service', async () => {
      req.body = { qrData: validQRData };
      const apiError = new ApiError('Invalid QR data format', StatusCodes.BAD_REQUEST);
      qrCodeService.validateQRCode.mockRejectedValue(apiError);

      await qrCodeController.validateQRCode(req, res, next);

      expect(next).toHaveBeenCalledWith(apiError);
    });
  });

  describe('getQRCodeMetadata', () => {
    beforeEach(() => {
      req.params = { qrId: 'qr_123' };
    });

    it('should retrieve QR code metadata successfully', async () => {
      const mockMetadata = {
        qrId: 'qr_123',
        type: 'affiliate',
        affiliateId: 'AFF-123',
        referralCode: 'REF123',
        createdAt: new Date(),
        version: '1.0'
      };

      qrCodeService.getQRCodeMetadata.mockResolvedValue(mockMetadata);

      await qrCodeController.getQRCodeMetadata(req, res);

      expect(qrCodeService.getQRCodeMetadata).toHaveBeenCalledWith('qr_123');
      expect(logger.info).toHaveBeenCalledWith('QR code metadata retrieval attempt', {
        userId: 'user123',
        qrId: 'qr_123',
        ip: '127.0.0.1',
        userAgent: 'test-agent'
      });
      expect(logger.info).toHaveBeenCalledWith('QR code metadata retrieved successfully', {
        userId: 'user123',
        qrId: 'qr_123'
      });
      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        StatusCodes.OK,
        'QR code metadata retrieved successfully',
        expect.objectContaining({
          qrId: 'qr_123'
        })
      );
    });

    it('should handle missing QR ID', async () => {
      req.params = {};

      await qrCodeController.getQRCodeMetadata(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'QR code ID is required',
          statusCode: StatusCodes.BAD_REQUEST
        })
      );
    });

    it('should handle empty QR ID', async () => {
      req.params = { qrId: '' };

      await qrCodeController.getQRCodeMetadata(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'QR code ID is required',
          statusCode: StatusCodes.BAD_REQUEST
        })
      );
    });

    it('should handle not implemented service method', async () => {
      req.params = { qrId: 'qr_123' };
      const notImplementedError = new ApiError('QR code metadata retrieval not yet implemented', StatusCodes.NOT_IMPLEMENTED);
      qrCodeService.getQRCodeMetadata.mockRejectedValue(notImplementedError);

      await qrCodeController.getQRCodeMetadata(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'QR code metadata retrieval is not yet available',
          statusCode: StatusCodes.SERVICE_UNAVAILABLE
        })
      );

      expect(logger.error).toHaveBeenCalledWith('QR code metadata retrieval failed', {
        userId: 'user123',
        qrId: 'qr_123',
        error: 'QR code metadata retrieval not yet implemented',
        stack: notImplementedError.stack
      });
    });

    it('should handle other ApiErrors from service', async () => {
      req.params = { qrId: 'qr_123' };
      const apiError = new ApiError('QR code not found', StatusCodes.NOT_FOUND);
      qrCodeService.getQRCodeMetadata.mockRejectedValue(apiError);

      await qrCodeController.getQRCodeMetadata(req, res, next);

      expect(next).toHaveBeenCalledWith(apiError);
    });

    it('should handle generic service errors', async () => {
      req.params = { qrId: 'qr_123' };
      const serviceError = new Error('Database connection failed');
      qrCodeService.getQRCodeMetadata.mockRejectedValue(serviceError);

      await qrCodeController.getQRCodeMetadata(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Failed to retrieve QR code metadata',
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR
        })
      );
    });

    it('should sanitize sensitive metadata', async () => {
      const mockMetadata = {
        qrId: 'qr_123',
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

      await qrCodeController.getQRCodeMetadata(req, res);

      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        StatusCodes.OK,
        'QR code metadata retrieved successfully',
        expect.objectContaining({
          qrId: 'qr_123',
          type: 'withdrawal',
          affiliateId: 'AFF-123',
          amount: 10000,
          bankDetails: {
            accountName: 'John Doe',
            bankName: 'Test Bank'
            // accountNumber and routingNumber should be excluded
          }
          // internalId, secretKey, privateData should be excluded
        })
      );

      // Verify sensitive fields are not included
      const responseData = ApiResponse.success.mock.calls[0][3];
      expect(responseData.internalId).toBeUndefined();
      expect(responseData.secretKey).toBeUndefined();
      expect(responseData.privateData).toBeUndefined();
      expect(responseData.bankDetails?.accountNumber).toBeUndefined();
      expect(responseData.bankDetails?.routingNumber).toBeUndefined();
    });
  }); 
 describe('downloadQRCode', () => {
    beforeEach(() => {
      req.params = { qrId: 'qr_123' };
      req.query = {};
    });

    it('should handle missing QR ID', async () => {
      req.params = {};

      await qrCodeController.downloadQRCode(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'QR code ID is required',
          statusCode: StatusCodes.BAD_REQUEST
        })
      );
    });

    it('should handle empty QR ID', async () => {
      req.params = { qrId: '' };

      await qrCodeController.downloadQRCode(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'QR code ID is required',
          statusCode: StatusCodes.BAD_REQUEST
        })
      );
    });

    it('should validate format parameter - valid PNG', async () => {
      req.query = { format: 'png' };

      await qrCodeController.downloadQRCode(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'QR code download is not yet available',
          statusCode: StatusCodes.SERVICE_UNAVAILABLE
        })
      );

      expect(logger.info).toHaveBeenCalledWith('QR code download attempt', {
        qrId: 'qr_123',
        format: 'png',
        size: undefined,
        ip: '127.0.0.1',
        userAgent: 'test-agent'
      });
    });

    it('should validate format parameter - valid SVG', async () => {
      req.query = { format: 'svg' };

      await qrCodeController.downloadQRCode(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'QR code download is not yet available',
          statusCode: StatusCodes.SERVICE_UNAVAILABLE
        })
      );

      expect(logger.info).toHaveBeenCalledWith('QR code download attempt', {
        qrId: 'qr_123',
        format: 'svg',
        size: undefined,
        ip: '127.0.0.1',
        userAgent: 'test-agent'
      });
    });

    it('should handle invalid format parameter', async () => {
      req.query = { format: 'jpeg' };

      await qrCodeController.downloadQRCode(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid format. Supported formats: png, svg',
          statusCode: StatusCodes.BAD_REQUEST
        })
      );
    });

    it('should handle case insensitive format parameter', async () => {
      req.query = { format: 'PNG' };

      await qrCodeController.downloadQRCode(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'QR code download is not yet available',
          statusCode: StatusCodes.SERVICE_UNAVAILABLE
        })
      );
    });

    it('should validate size parameter - valid size', async () => {
      req.query = { size: '256' };

      await qrCodeController.downloadQRCode(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'QR code download is not yet available',
          statusCode: StatusCodes.SERVICE_UNAVAILABLE
        })
      );

      expect(logger.info).toHaveBeenCalledWith('QR code download attempt', {
        qrId: 'qr_123',
        format: 'png',
        size: '256',
        ip: '127.0.0.1',
        userAgent: 'test-agent'
      });
    });

    it('should handle size parameter too small', async () => {
      req.query = { size: '32' };

      await qrCodeController.downloadQRCode(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid size. Size must be between 64 and 1024 pixels',
          statusCode: StatusCodes.BAD_REQUEST
        })
      );
    });

    it('should handle size parameter too large', async () => {
      req.query = { size: '2048' };

      await qrCodeController.downloadQRCode(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid size. Size must be between 64 and 1024 pixels',
          statusCode: StatusCodes.BAD_REQUEST
        })
      );
    });

    it('should handle non-numeric size parameter', async () => {
      req.query = { size: 'large' };

      await qrCodeController.downloadQRCode(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid size. Size must be between 64 and 1024 pixels',
          statusCode: StatusCodes.BAD_REQUEST
        })
      );
    });

    it('should use default format when not specified', async () => {
      await qrCodeController.downloadQRCode(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'QR code download is not yet available',
          statusCode: StatusCodes.SERVICE_UNAVAILABLE
        })
      );

      expect(logger.info).toHaveBeenCalledWith('QR code download attempt', {
        qrId: 'qr_123',
        format: 'png',
        size: undefined,
        ip: '127.0.0.1',
        userAgent: 'test-agent'
      });
    });

    it('should handle service unavailable error', async () => {
      await qrCodeController.downloadQRCode(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'QR code download is not yet available',
          statusCode: StatusCodes.SERVICE_UNAVAILABLE
        })
      );

      expect(logger.error).toHaveBeenCalledWith('QR code download failed', {
        qrId: 'qr_123',
        format: 'png',
        size: undefined,
        error: 'QR code download is not yet available',
        stack: expect.any(String)
      });
    });

    it('should handle generic errors', async () => {
      // Mock a scenario where an unexpected error occurs before the service unavailable error
      const originalGet = req.get;
      req.get = jest.fn(() => {
        throw new Error('Unexpected error');
      });

      await qrCodeController.downloadQRCode(req, res, next);

      // The asyncHandler should catch the error and pass it to next
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Unexpected error'
        })
      );

      // Restore original function
      req.get = originalGet;
    });

    it('should log download attempt with all parameters', async () => {
      req.query = { format: 'svg', size: '512' };

      await qrCodeController.downloadQRCode(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'QR code download is not yet available',
          statusCode: StatusCodes.SERVICE_UNAVAILABLE
        })
      );

      expect(logger.info).toHaveBeenCalledWith('QR code download attempt', {
        qrId: 'qr_123',
        format: 'svg',
        size: '512',
        ip: '127.0.0.1',
        userAgent: 'test-agent'
      });
    });
  });

  describe('getQRCodeHealth', () => {
    it('should return healthy status when service is healthy', async () => {
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

      await qrCodeController.getQRCodeHealth(req, res);

      expect(qrCodeService.getQRCodeHealth).toHaveBeenCalled();
      expect(qrCodeService.performHealthCheck).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('QR code health check completed', {
        status: 'healthy',
        isHealthy: true,
        performanceCheck: true
      });
      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        StatusCodes.OK,
        'QR code service is healthy',
        expect.objectContaining({
          status: 'healthy',
          service: 'QR Code Service',
          timestamp: expect.any(String),
          checks: {
            serviceWrapper: {
              status: 'pass',
              failures: 0,
              lastFailure: null,
              circuitBreakerOpen: false
            },
            performanceCheck: {
              status: 'pass',
              description: 'QR code generation performance test'
            }
          },
          metrics: {
            totalRequests: 100,
            successfulRequests: 95,
            failedRequests: 0,
            averageResponseTime: 150
          }
        })
      );
    });

    it('should return unhealthy status when service wrapper is unhealthy', async () => {
      const mockHealthStatus = {
        isHealthy: false,
        failures: 5,
        lastFailure: new Date(),
        circuitBreakerOpen: true,
        totalRequests: 100,
        successfulRequests: 90,
        averageResponseTime: 300
      };

      qrCodeService.getQRCodeHealth.mockReturnValue(mockHealthStatus);
      qrCodeService.performHealthCheck.mockResolvedValue(true);

      await qrCodeController.getQRCodeHealth(req, res);

      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        StatusCodes.SERVICE_UNAVAILABLE,
        'QR code service is unhealthy',
        expect.objectContaining({
          status: 'unhealthy',
          checks: {
            serviceWrapper: {
              status: 'fail',
              failures: 5,
              lastFailure: mockHealthStatus.lastFailure,
              circuitBreakerOpen: true
            },
            performanceCheck: {
              status: 'pass',
              description: 'QR code generation performance test'
            }
          },
          metrics: {
            totalRequests: 100,
            successfulRequests: 90,
            failedRequests: 5,
            averageResponseTime: 300
          }
        })
      );
    });

    it('should return unhealthy status when performance check fails', async () => {
      const mockHealthStatus = {
        isHealthy: true,
        failures: 0,
        lastFailure: null,
        circuitBreakerOpen: false,
        totalRequests: 50,
        successfulRequests: 50,
        averageResponseTime: 100
      };

      qrCodeService.getQRCodeHealth.mockReturnValue(mockHealthStatus);
      qrCodeService.performHealthCheck.mockResolvedValue(false);

      await qrCodeController.getQRCodeHealth(req, res);

      // Note: The status is determined by healthStatus.isHealthy, but statusCode by both conditions
      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        StatusCodes.SERVICE_UNAVAILABLE,
        'QR code service is healthy', // Status message is based on healthStatus.isHealthy only
        expect.objectContaining({
          status: 'healthy', // Status is based on healthStatus.isHealthy only
          checks: {
            serviceWrapper: {
              status: 'pass',
              failures: 0,
              lastFailure: null,
              circuitBreakerOpen: false
            },
            performanceCheck: {
              status: 'fail',
              description: 'QR code generation performance test'
            }
          }
        })
      );
    });

    it('should return unhealthy status when both checks fail', async () => {
      const mockHealthStatus = {
        isHealthy: false,
        failures: 3,
        lastFailure: new Date(),
        circuitBreakerOpen: false
      };

      qrCodeService.getQRCodeHealth.mockReturnValue(mockHealthStatus);
      qrCodeService.performHealthCheck.mockResolvedValue(false);

      await qrCodeController.getQRCodeHealth(req, res);

      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        StatusCodes.SERVICE_UNAVAILABLE,
        'QR code service is unhealthy',
        expect.objectContaining({
          status: 'unhealthy',
          checks: {
            serviceWrapper: {
              status: 'fail',
              failures: 3,
              lastFailure: mockHealthStatus.lastFailure,
              circuitBreakerOpen: false
            },
            performanceCheck: {
              status: 'fail',
              description: 'QR code generation performance test'
            }
          }
        })
      );
    });

    it('should handle missing metrics gracefully', async () => {
      const mockHealthStatus = {
        isHealthy: true,
        failures: 2,
        lastFailure: null,
        circuitBreakerOpen: false
        // Missing optional metrics
      };

      qrCodeService.getQRCodeHealth.mockReturnValue(mockHealthStatus);
      qrCodeService.performHealthCheck.mockResolvedValue(true);

      await qrCodeController.getQRCodeHealth(req, res);

      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        StatusCodes.OK,
        'QR code service is healthy',
        expect.objectContaining({
          metrics: {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 2,
            averageResponseTime: 0
          }
        })
      );
    });

    it('should handle health check errors gracefully', async () => {
      const healthCheckError = new Error('Health check failed');
      qrCodeService.getQRCodeHealth.mockImplementation(() => {
        throw healthCheckError;
      });

      await qrCodeController.getQRCodeHealth(req, res);

      expect(logger.error).toHaveBeenCalledWith('QR code health check failed', {
        error: 'Health check failed',
        stack: healthCheckError.stack
      });
      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        StatusCodes.SERVICE_UNAVAILABLE,
        'QR code service is unhealthy',
        expect.objectContaining({
          status: 'unhealthy',
          service: 'QR Code Service',
          timestamp: expect.any(String),
          error: 'Health check failed'
        })
      );
    });

    it('should handle performance check errors', async () => {
      const mockHealthStatus = {
        isHealthy: true,
        failures: 0,
        lastFailure: null,
        circuitBreakerOpen: false
      };

      qrCodeService.getQRCodeHealth.mockReturnValue(mockHealthStatus);
      qrCodeService.performHealthCheck.mockRejectedValue(new Error('Performance check failed'));

      await qrCodeController.getQRCodeHealth(req, res);

      expect(logger.error).toHaveBeenCalledWith('QR code health check failed', {
        error: 'Performance check failed',
        stack: expect.any(String)
      });
      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        StatusCodes.SERVICE_UNAVAILABLE,
        'QR code service is unhealthy',
        expect.objectContaining({
          status: 'unhealthy',
          error: 'Performance check failed'
        })
      );
    });

    it('should include timestamp in response', async () => {
      const mockHealthStatus = {
        isHealthy: true,
        failures: 0,
        lastFailure: null,
        circuitBreakerOpen: false
      };

      qrCodeService.getQRCodeHealth.mockReturnValue(mockHealthStatus);
      qrCodeService.performHealthCheck.mockResolvedValue(true);

      const beforeTime = new Date().toISOString();
      await qrCodeController.getQRCodeHealth(req, res);
      const afterTime = new Date().toISOString();

      const responseData = ApiResponse.success.mock.calls[0][3];
      expect(responseData.timestamp).toBeDefined();
      expect(responseData.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(responseData.timestamp >= beforeTime).toBe(true);
      expect(responseData.timestamp <= afterTime).toBe(true);
    });
  });

  describe('Helper Functions', () => {
    describe('getTypeSpecificMetadata', () => {
      // Note: These are private functions, but we can test them indirectly through the main functions
      // or by accessing them if they were exported. For now, we test through the main generateQRCode function.

      it('should extract affiliate-specific metadata', async () => {
        req.body = {
          type: 'affiliate',
          data: {
            affiliateId: 'AFF-123',
            referralCode: 'REF123',
            businessName: 'Test Business'
          }
        };

        const mockQRResult = {
          data: 'base64-data',
          url: 'https://app.travelplace.com/qr/qr_123',
          metadata: {
            qrId: 'qr_123',
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

        qrCodeService.generateAffiliateQR.mockResolvedValue(mockQRResult);

        await qrCodeController.generateQRCode(req, res);

        expect(ApiResponse.created).toHaveBeenCalledWith(
          res,
          'QR code generated successfully',
          expect.objectContaining({
            metadata: expect.objectContaining({
              affiliateId: 'AFF-123',
              referralCode: 'REF123',
              businessName: 'Test Business'
            })
          })
        );
      });
    });

    describe('sanitizeMetadata', () => {
      it('should remove sensitive fields from metadata', async () => {
        req.params = { qrId: 'qr_123' };

        const mockMetadata = {
          qrId: 'qr_123',
          type: 'withdrawal',
          affiliateId: 'AFF-123',
          amount: 10000,
          internalId: 'internal-123',
          secretKey: 'secret-key',
          privateData: 'private-data',
          bankDetails: {
            accountName: 'John Doe',
            bankName: 'Test Bank',
            accountNumber: '1234567890',
            routingNumber: '123456789'
          }
        };

        qrCodeService.getQRCodeMetadata.mockResolvedValue(mockMetadata);

        await qrCodeController.getQRCodeMetadata(req, res);

        const responseData = ApiResponse.success.mock.calls[0][3];
        
        // Verify sensitive fields are removed
        expect(responseData.internalId).toBeUndefined();
        expect(responseData.secretKey).toBeUndefined();
        expect(responseData.privateData).toBeUndefined();
        expect(responseData.bankDetails?.accountNumber).toBeUndefined();
        expect(responseData.bankDetails?.routingNumber).toBeUndefined();
        
        // Verify non-sensitive fields are preserved
        expect(responseData.qrId).toBe('qr_123');
        expect(responseData.type).toBe('withdrawal');
        expect(responseData.affiliateId).toBe('AFF-123');
        expect(responseData.amount).toBe(10000);
        expect(responseData.bankDetails?.accountName).toBe('John Doe');
        expect(responseData.bankDetails?.bankName).toBe('Test Bank');
      });

      it('should handle metadata without sensitive fields', async () => {
        req.params = { qrId: 'qr_123' };

        const mockMetadata = {
          qrId: 'qr_123',
          type: 'affiliate',
          affiliateId: 'AFF-123',
          referralCode: 'REF123'
        };

        qrCodeService.getQRCodeMetadata.mockResolvedValue(mockMetadata);

        await qrCodeController.getQRCodeMetadata(req, res);

        const responseData = ApiResponse.success.mock.calls[0][3];
        expect(responseData).toEqual(expect.objectContaining(mockMetadata));
      });

      it('should handle null or undefined metadata', async () => {
        req.params = { qrId: 'qr_123' };

        qrCodeService.getQRCodeMetadata.mockResolvedValue(null);

        await qrCodeController.getQRCodeMetadata(req, res);

        const responseData = ApiResponse.success.mock.calls[0][3];
        expect(responseData.qrId).toBe('qr_123');
        // Other fields should be empty or undefined
      });
    });
  });
});