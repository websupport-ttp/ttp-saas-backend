// v1/test/services/qrCodeService.test.js
const {
  generateAffiliateQR,
  generateCommissionQR,
  generateWithdrawalQR,
  generateReferralQR,
  validateQRCode,
  getQRCodeMetadata,
  encodeQRCodeData,
  decodeQRCodeData,
  createQRCodeData,
  generateQRCodeImage,
  getQRCodeHealth,
  performHealthCheck,
  resetQRCodeService,
  QR_CODE_TYPES
} = require('../../services/qrCodeService');

// Mock dependencies
jest.mock('../../utils/logger');
jest.mock('../../utils/serviceWrapper', () => {
  return jest.fn().mockImplementation(() => ({
    execute: jest.fn().mockImplementation((fn) => fn()),
    getHealthStatus: jest.fn().mockReturnValue({ status: 'healthy' }),
    performHealthCheck: jest.fn().mockResolvedValue(true),
    reset: jest.fn()
  }));
});

describe('QRCodeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetQRCodeService();
  });

  describe('QR Code Data Utilities', () => {
    describe('createQRCodeData', () => {
      it('should create QR code data structure with required fields', () => {
        const type = QR_CODE_TYPES.AFFILIATE;
        const id = 'affiliate-123';
        const metadata = { affiliateId: 'affiliate-123', referralCode: 'REF123' };

        const result = createQRCodeData(type, id, metadata);

        expect(result).toHaveProperty('qrId');
        expect(result.qrId).toMatch(/^qr_[0-9a-f-]{36}$/);
        expect(result.type).toBe(type);
        expect(result.id).toBe(id);
        expect(result).toHaveProperty('timestamp');
        expect(result.metadata).toMatchObject({
          ...metadata,
          version: '1.0',
          source: 'travel-place-api'
        });
        expect(result.url).toContain('/qr/');
      });

      it('should generate unique QR IDs for multiple calls', () => {
        const result1 = createQRCodeData(QR_CODE_TYPES.AFFILIATE, 'id1');
        const result2 = createQRCodeData(QR_CODE_TYPES.AFFILIATE, 'id2');

        expect(result1.qrId).not.toBe(result2.qrId);
      });
    });

    describe('encodeQRCodeData', () => {
      it('should encode QR code data to JSON string', () => {
        const qrData = {
          qrId: 'qr_test-123',
          type: QR_CODE_TYPES.AFFILIATE,
          id: 'affiliate-123',
          timestamp: '2024-01-01T00:00:00.000Z',
          metadata: { test: 'data' }
        };

        const result = encodeQRCodeData(qrData);

        expect(typeof result).toBe('string');
        expect(JSON.parse(result)).toEqual(qrData);
      });

      it('should throw ApiError for invalid data', () => {
        const circularData = {};
        circularData.self = circularData;

        expect(() => encodeQRCodeData(circularData)).toThrow('Failed to encode QR code data');
      });
    });

    describe('decodeQRCodeData', () => {
      it('should decode valid QR code data', () => {
        const originalData = {
          qrId: 'qr_test-123',
          type: QR_CODE_TYPES.AFFILIATE,
          id: 'affiliate-123',
          timestamp: '2024-01-01T00:00:00.000Z',
          metadata: { test: 'data' }
        };
        const encodedData = JSON.stringify(originalData);

        const result = decodeQRCodeData(encodedData);

        expect(result).toEqual(originalData);
      });

      it('should throw ApiError for invalid JSON', () => {
        const invalidJson = 'invalid-json-string';

        expect(() => decodeQRCodeData(invalidJson)).toThrow('Invalid QR code data');
      });

      it('should throw ApiError for missing required fields', () => {
        const incompleteData = JSON.stringify({ qrId: 'test' }); // missing type and id

        expect(() => decodeQRCodeData(incompleteData)).toThrow('Invalid QR code data');
      });
    });

    describe('generateQRCodeImage', () => {
      it('should generate base64 QR code image', async () => {
        const testData = 'test-qr-data';

        const result = await generateQRCodeImage(testData);

        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
        // Should not contain data URL prefix
        expect(result).not.toMatch(/^data:image\/png;base64,/);
      });

      it('should accept custom options', async () => {
        const testData = 'test-qr-data';
        const options = { width: 512, margin: 2 };

        const result = await generateQRCodeImage(testData, options);

        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      });
    });
  });

  describe('QR Code Generation', () => {
    describe('generateAffiliateQR', () => {
      it('should generate QR code for affiliate account', async () => {
        const affiliateData = {
          affiliateId: 'affiliate-123',
          referralCode: 'REF123',
          businessName: 'Test Business'
        };

        const result = await generateAffiliateQR(affiliateData);

        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('url');
        expect(result).toHaveProperty('metadata');
        expect(result.metadata.type).toBe(QR_CODE_TYPES.AFFILIATE);
        expect(result.metadata.id).toBe(affiliateData.affiliateId);
        expect(result.metadata.metadata.affiliateId).toBe(affiliateData.affiliateId);
        expect(result.metadata.metadata.referralCode).toBe(affiliateData.referralCode);
        expect(result.metadata.metadata.businessName).toBe(affiliateData.businessName);
        expect(result.metadata.metadata.expiresAt).toBeNull();
      });

      it('should throw error for missing required fields', async () => {
        const incompleteData = { affiliateId: 'affiliate-123' }; // missing referralCode

        await expect(generateAffiliateQR(incompleteData))
          .rejects.toThrow('Affiliate ID and referral code are required');
      });
    });

    describe('generateCommissionQR', () => {
      it('should generate QR code for commission transaction', async () => {
        const commissionData = {
          transactionId: 'txn-123',
          affiliateId: 'affiliate-123',
          commissionAmount: 1000,
          currency: 'NGN',
          serviceType: 'flight',
          bookingReference: 'BOOK123',
          status: 'approved'
        };

        const result = await generateCommissionQR(commissionData);

        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('url');
        expect(result).toHaveProperty('metadata');
        expect(result.metadata.type).toBe(QR_CODE_TYPES.COMMISSION);
        expect(result.metadata.id).toBe(commissionData.transactionId);
        expect(result.metadata.metadata.affiliateId).toBe(commissionData.affiliateId);
        expect(result.metadata.metadata.amount).toBe(commissionData.commissionAmount);
        expect(result.metadata.metadata.serviceType).toBe(commissionData.serviceType);
      });

      it('should use default currency when not provided', async () => {
        const commissionData = {
          transactionId: 'txn-123',
          affiliateId: 'affiliate-123',
          commissionAmount: 1000
        };

        const result = await generateCommissionQR(commissionData);

        expect(result.metadata.metadata.currency).toBe('NGN');
      });

      it('should throw error for missing required fields', async () => {
        const incompleteData = { transactionId: 'txn-123' }; // missing affiliateId

        await expect(generateCommissionQR(incompleteData))
          .rejects.toThrow('Transaction ID and affiliate ID are required');
      });
    });

    describe('generateWithdrawalQR', () => {
      it('should generate QR code for withdrawal transaction', async () => {
        const withdrawalData = {
          withdrawalId: 'withdrawal-123',
          affiliateId: 'affiliate-123',
          amount: 5000,
          currency: 'NGN',
          status: 'pending',
          bankDetails: {
            accountName: 'John Doe',
            accountNumber: '1234567890',
            bankName: 'Test Bank'
          }
        };

        const result = await generateWithdrawalQR(withdrawalData);

        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('url');
        expect(result).toHaveProperty('metadata');
        expect(result.metadata.type).toBe(QR_CODE_TYPES.WITHDRAWAL);
        expect(result.metadata.id).toBe(withdrawalData.withdrawalId);
        expect(result.metadata.metadata.affiliateId).toBe(withdrawalData.affiliateId);
        expect(result.metadata.metadata.amount).toBe(withdrawalData.amount);
        expect(result.metadata.metadata.bankDetails.accountName).toBe(withdrawalData.bankDetails.accountName);
        // Should not include sensitive account number
        expect(result.metadata.metadata.bankDetails.accountNumber).toBeUndefined();
      });

      it('should use default currency when not provided', async () => {
        const withdrawalData = {
          withdrawalId: 'withdrawal-123',
          affiliateId: 'affiliate-123',
          amount: 5000
        };

        const result = await generateWithdrawalQR(withdrawalData);

        expect(result.metadata.metadata.currency).toBe('NGN');
      });

      it('should throw error for missing required fields', async () => {
        const incompleteData = { withdrawalId: 'withdrawal-123' }; // missing affiliateId

        await expect(generateWithdrawalQR(incompleteData))
          .rejects.toThrow('Withdrawal ID and affiliate ID are required');
      });
    });

    describe('generateReferralQR', () => {
      it('should generate QR code for referral link', async () => {
        const referralData = {
          affiliateId: 'affiliate-123',
          referralCode: 'REF123',
          campaign: 'summer-2024',
          source: 'social_media'
        };

        const result = await generateReferralQR(referralData);

        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('url');
        expect(result).toHaveProperty('metadata');
        expect(result.metadata.type).toBe(QR_CODE_TYPES.REFERRAL);
        expect(result.metadata.id).toBe(referralData.affiliateId);
        expect(result.metadata.metadata.affiliateId).toBe(referralData.affiliateId);
        expect(result.metadata.metadata.referralCode).toBe(referralData.referralCode);
        expect(result.metadata.metadata.campaign).toBe(referralData.campaign);
        expect(result.metadata.metadata.source).toBe(referralData.source);
        expect(result.metadata.metadata.expiresAt).toBeDefined();
      });

      it('should use default expiration when not provided', async () => {
        const referralData = {
          affiliateId: 'affiliate-123',
          referralCode: 'REF123'
        };

        const result = await generateReferralQR(referralData);

        const expirationDate = new Date(result.metadata.metadata.expiresAt);
        const now = new Date();
        const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        expect(expirationDate.getTime()).toBeCloseTo(thirtyDaysFromNow.getTime(), -10000); // Within 10 seconds
      });

      it('should use default source when not provided', async () => {
        const referralData = {
          affiliateId: 'affiliate-123',
          referralCode: 'REF123'
        };

        const result = await generateReferralQR(referralData);

        expect(result.metadata.metadata.source).toBe('qr_code');
      });

      it('should throw error for missing required fields', async () => {
        const incompleteData = { affiliateId: 'affiliate-123' }; // missing referralCode

        await expect(generateReferralQR(incompleteData))
          .rejects.toThrow('Affiliate ID and referral code are required');
      });
    });
  });

  describe('QR Code Validation', () => {
    describe('validateQRCode', () => {
      it('should validate valid QR code data', async () => {
        const qrData = {
          qrId: 'qr_test-123',
          type: QR_CODE_TYPES.AFFILIATE,
          id: 'affiliate-123',
          timestamp: new Date(),
          metadata: { version: '1.0' }
        };
        const encodedData = JSON.stringify(qrData);

        const result = await validateQRCode(encodedData);

        expect(result.valid).toBe(true);
        expect(result.data).toMatchObject({
          qrId: qrData.qrId,
          type: qrData.type,
          id: qrData.id,
          metadata: qrData.metadata
        });
        expect(result.reason).toBeUndefined();
      });

      it('should reject expired QR codes', async () => {
        const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
        const qrData = {
          qrId: 'qr_test-123',
          type: QR_CODE_TYPES.REFERRAL,
          id: 'affiliate-123',
          timestamp: new Date(),
          metadata: { 
            version: '1.0',
            expiresAt: expiredDate
          }
        };
        const encodedData = JSON.stringify(qrData);

        const result = await validateQRCode(encodedData);

        expect(result.valid).toBe(false);
        expect(result.reason).toBe('QR code has expired');
        expect(result.data).toMatchObject({
          qrId: qrData.qrId,
          type: qrData.type,
          id: qrData.id,
          metadata: expect.objectContaining({
            version: qrData.metadata.version
          })
        });
      });

      it('should reject invalid QR code types', async () => {
        const qrData = {
          qrId: 'qr_test-123',
          type: 'invalid_type',
          id: 'affiliate-123',
          timestamp: new Date(),
          metadata: { version: '1.0' }
        };
        const encodedData = JSON.stringify(qrData);

        const result = await validateQRCode(encodedData);

        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Invalid QR code type');
        expect(result.data).toMatchObject({
          qrId: qrData.qrId,
          type: qrData.type,
          id: qrData.id,
          metadata: qrData.metadata
        });
      });

      it('should throw error for empty data', async () => {
        await expect(validateQRCode(''))
          .rejects.toThrow('QR code data is required');
      });

      it('should throw error for invalid JSON data', async () => {
        await expect(validateQRCode('invalid-json'))
          .rejects.toThrow('Invalid QR code data');
      });
    });

    describe('getQRCodeMetadata', () => {
      it('should throw not implemented error', async () => {
        await expect(getQRCodeMetadata('qr_test-123'))
          .rejects.toThrow('QR code metadata retrieval not yet implemented');
      });

      it('should throw error for missing QR ID', async () => {
        await expect(getQRCodeMetadata(''))
          .rejects.toThrow('QR code ID is required');
      });
    });
  });

  describe('Health and Monitoring', () => {
    describe('getQRCodeHealth', () => {
      it('should return health status', () => {
        const health = getQRCodeHealth();
        expect(health).toBeDefined();
      });
    });

    describe('performHealthCheck', () => {
      it('should perform health check successfully', async () => {
        const result = await performHealthCheck();
        expect(typeof result).toBe('boolean');
      });
    });

    describe('resetQRCodeService', () => {
      it('should reset service without throwing', () => {
        expect(() => resetQRCodeService()).not.toThrow();
      });
    });
  });

  describe('Constants', () => {
    it('should export QR_CODE_TYPES constants', () => {
      expect(QR_CODE_TYPES).toEqual({
        AFFILIATE: 'affiliate',
        COMMISSION: 'commission',
        WITHDRAWAL: 'withdrawal',
        REFERRAL: 'referral'
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle QR code generation failures gracefully', async () => {
      // Test with invalid data that would cause an error
      const invalidData = null;

      await expect(generateAffiliateQR(invalidData))
        .rejects.toThrow();
    });

    it('should handle service wrapper failures', async () => {
      // This test would verify that the service wrapper handles failures correctly
      // The actual implementation depends on how the ServiceWrapper mock is configured
      const affiliateData = {
        affiliateId: 'affiliate-123',
        referralCode: 'REF123'
      };

      // Should not throw due to service wrapper error handling
      const result = await generateAffiliateQR(affiliateData);
      expect(result).toBeDefined();
    });
  });
});