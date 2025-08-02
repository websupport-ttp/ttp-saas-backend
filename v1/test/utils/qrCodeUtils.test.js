// v1/test/utils/qrCodeUtils.test.js
const {
  generateQRCodeHash,
  validateQRCodeMetadata,
  sanitizeQRCodeMetadata,
  enrichQRCodeMetadata,
  extractQRCodeInfo,
  generateQRCodeAnalytics,
  formatQRCodeForStorage,
  parseQRCodeUrl,
  generateQRCodeStats
} = require('../../utils/qrCodeUtils');

// Mock dependencies
jest.mock('../../utils/logger');

describe('QRCodeUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateQRCodeHash', () => {
    it('should generate consistent hash for same data', () => {
      const qrData = { qrId: 'test', type: 'affiliate', id: '123' };
      
      const hash1 = generateQRCodeHash(qrData);
      const hash2 = generateQRCodeHash(qrData);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex string
    });

    it('should generate different hashes for different data', () => {
      const qrData1 = { qrId: 'test1', type: 'affiliate', id: '123' };
      const qrData2 = { qrId: 'test2', type: 'affiliate', id: '123' };
      
      const hash1 = generateQRCodeHash(qrData1);
      const hash2 = generateQRCodeHash(qrData2);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should generate same hash regardless of property order', () => {
      const qrData1 = { qrId: 'test', type: 'affiliate', id: '123' };
      const qrData2 = { type: 'affiliate', id: '123', qrId: 'test' };
      
      const hash1 = generateQRCodeHash(qrData1);
      const hash2 = generateQRCodeHash(qrData2);
      
      expect(hash1).toBe(hash2);
    });

    it('should throw error for circular references', () => {
      const circularData = { qrId: 'test' };
      circularData.self = circularData;
      
      expect(() => generateQRCodeHash(circularData))
        .toThrow('Failed to generate QR code hash');
    });
  });

  describe('validateQRCodeMetadata', () => {
    it('should validate correct metadata', () => {
      const metadata = {
        version: '1.0',
        source: 'travel-place-api',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 1 day from now
      };
      
      const result = validateQRCodeMetadata(metadata);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject metadata without version', () => {
      const metadata = { source: 'travel-place-api' };
      
      const result = validateQRCodeMetadata(metadata);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Version is required in metadata');
    });

    it('should reject metadata without source', () => {
      const metadata = { version: '1.0' };
      
      const result = validateQRCodeMetadata(metadata);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Source is required in metadata');
    });

    it('should reject invalid version format', () => {
      const metadata = {
        version: 'invalid',
        source: 'travel-place-api'
      };
      
      const result = validateQRCodeMetadata(metadata);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Version must be in format "x.y"');
    });

    it('should reject invalid expiration date', () => {
      const metadata = {
        version: '1.0',
        source: 'travel-place-api',
        expiresAt: 'invalid-date'
      };
      
      const result = validateQRCodeMetadata(metadata);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid expiration date format');
    });

    it('should reject past expiration date', () => {
      const metadata = {
        version: '1.0',
        source: 'travel-place-api',
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
      };
      
      const result = validateQRCodeMetadata(metadata);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Expiration date must be in the future');
    });
  });

  describe('sanitizeQRCodeMetadata', () => {
    it('should remove sensitive bank details for withdrawal QR', () => {
      const metadata = {
        amount: 1000,
        bankDetails: {
          accountName: 'John Doe',
          accountNumber: '1234567890',
          bankCode: '123',
          bankName: 'Test Bank'
        }
      };
      
      const result = sanitizeQRCodeMetadata(metadata, 'withdrawal');
      
      expect(result.bankDetails.accountName).toBe('John Doe');
      expect(result.bankDetails.bankName).toBe('Test Bank');
      expect(result.bankDetails.accountNumber).toBeUndefined();
      expect(result.bankDetails.bankCode).toBeUndefined();
    });

    it('should remove internal processing details for commission QR', () => {
      const metadata = {
        amount: 500,
        internalProcessingId: 'internal-123',
        adminNotes: 'Admin review required'
      };
      
      const result = sanitizeQRCodeMetadata(metadata, 'commission');
      
      expect(result.amount).toBe(500);
      expect(result.internalProcessingId).toBeUndefined();
      expect(result.adminNotes).toBeUndefined();
    });

    it('should remove internal affiliate data for affiliate QR', () => {
      const metadata = {
        affiliateId: 'affiliate-123',
        internalAffiliateId: 'internal-456',
        approvalNotes: 'Approved by admin'
      };
      
      const result = sanitizeQRCodeMetadata(metadata, 'affiliate');
      
      expect(result.affiliateId).toBe('affiliate-123');
      expect(result.internalAffiliateId).toBeUndefined();
      expect(result.approvalNotes).toBeUndefined();
    });

    it('should remove tracking data for referral QR', () => {
      const metadata = {
        referralCode: 'REF123',
        trackingPixel: 'pixel-url',
        internalCampaignId: 'campaign-456'
      };
      
      const result = sanitizeQRCodeMetadata(metadata, 'referral');
      
      expect(result.referralCode).toBe('REF123');
      expect(result.trackingPixel).toBeUndefined();
      expect(result.internalCampaignId).toBeUndefined();
    });

    it('should not modify metadata for unknown QR type', () => {
      const metadata = {
        someField: 'value',
        sensitiveField: 'sensitive'
      };
      
      const result = sanitizeQRCodeMetadata(metadata, 'unknown');
      
      expect(result).toEqual(metadata);
    });
  });

  describe('enrichQRCodeMetadata', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should add timestamp if not present', () => {
      const metadata = { version: '1.0' };
      
      const result = enrichQRCodeMetadata(metadata);
      
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it('should not override existing timestamp', () => {
      const existingDate = new Date('2024-01-01');
      const metadata = { version: '1.0', createdAt: existingDate };
      
      const result = enrichQRCodeMetadata(metadata);
      
      expect(result.createdAt).toBe(existingDate);
    });

    it('should add environment information', () => {
      process.env.NODE_ENV = 'production';
      const metadata = { version: '1.0' };
      
      const result = enrichQRCodeMetadata(metadata);
      
      expect(result.environment).toBe('production');
    });

    it('should add API version', () => {
      process.env.API_VERSION = '2.0';
      const metadata = { version: '1.0' };
      
      const result = enrichQRCodeMetadata(metadata);
      
      expect(result.apiVersion).toBe('2.0');
    });

    it('should add generation context', () => {
      const metadata = { version: '1.0' };
      const context = {
        userAgent: 'Mozilla/5.0',
        ip: '192.168.1.100',
        campaign: 'summer-2024',
        source: 'mobile-app'
      };
      
      const result = enrichQRCodeMetadata(metadata, context);
      
      expect(result.generatedFrom.userAgent).toBe('Mozilla/5.0');
      expect(result.generatedFrom.ip).toBe('192.168.1.xxx'); // IP masked
      expect(result.campaign).toBe('summer-2024');
      expect(result.generationSource).toBe('mobile-app');
    });
  });

  describe('extractQRCodeInfo', () => {
    it('should extract key information from QR code data', () => {
      const qrData = {
        qrId: 'qr_test-123',
        type: 'affiliate',
        id: 'affiliate-456',
        timestamp: new Date('2024-01-01'),
        metadata: {
          version: '1.0',
          source: 'api',
          expiresAt: new Date('2024-12-31')
        }
      };
      
      const result = extractQRCodeInfo(qrData);
      
      expect(result).toEqual({
        qrId: 'qr_test-123',
        type: 'affiliate',
        relatedId: 'affiliate-456',
        createdAt: new Date('2024-01-01'),
        expiresAt: new Date('2024-12-31'),
        version: '1.0',
        source: 'api',
        hasExpiration: true,
        isExpired: true // 2024-12-31 is in the past relative to test execution
      });
    });

    it('should handle QR code without expiration', () => {
      const qrData = {
        qrId: 'qr_test-123',
        type: 'affiliate',
        id: 'affiliate-456',
        timestamp: new Date(),
        metadata: { version: '1.0', source: 'api' }
      };
      
      const result = extractQRCodeInfo(qrData);
      
      expect(result.hasExpiration).toBe(false);
      expect(result.isExpired).toBe(false);
      expect(result.expiresAt).toBeUndefined();
    });
  });

  describe('generateQRCodeAnalytics', () => {
    it('should generate analytics data for QR code event', () => {
      const qrData = {
        qrId: 'qr_test-123',
        type: 'affiliate',
        id: 'affiliate-456',
        timestamp: new Date('2024-01-01'),
        metadata: { version: '1.0', source: 'api' }
      };
      const context = {
        userAgent: 'Mozilla/5.0',
        ip: '192.168.1.1',
        source: 'mobile-app'
      };
      
      const result = generateQRCodeAnalytics(qrData, 'scanned', context);
      
      expect(result.event).toBe('qr_code_event');
      expect(result.action).toBe('scanned');
      expect(result.qrCodeType).toBe('affiliate');
      expect(result.qrId).toBe('qr_test-123');
      expect(result.relatedId).toBe('affiliate-456');
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.metadata.userAgent).toBe('Mozilla/5.0');
      expect(result.metadata.ip).toBe('192.168.1.1');
      expect(result.metadata.source).toBe('mobile-app');
    });
  });

  describe('formatQRCodeForStorage', () => {
    it('should format QR code data for database storage', () => {
      const qrData = {
        qrId: 'qr_test-123',
        type: 'affiliate',
        id: 'affiliate-456',
        timestamp: new Date('2024-01-01'),
        url: 'https://app.travelplace.com/qr/qr_test-123',
        metadata: {
          version: '1.0',
          source: 'api',
          expiresAt: new Date('2024-12-31')
        }
      };
      const imageData = 'base64-image-data';
      
      const result = formatQRCodeForStorage(qrData, imageData);
      
      expect(result).toEqual({
        qrId: 'qr_test-123',
        type: 'affiliate',
        relatedId: 'affiliate-456',
        imageData: 'base64-image-data',
        url: 'https://app.travelplace.com/qr/qr_test-123',
        metadata: qrData.metadata,
        hash: expect.any(String),
        createdAt: new Date('2024-01-01'),
        expiresAt: new Date('2024-12-31'),
        isActive: true
      });
      expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('parseQRCodeUrl', () => {
    it('should parse valid QR code URL', () => {
      const url = 'https://app.travelplace.com/qr/qr_test-123?source=mobile';
      
      const result = parseQRCodeUrl(url);
      
      expect(result).toEqual({
        qrId: 'qr_test-123',
        baseUrl: 'https://app.travelplace.com',
        fullPath: '/qr/qr_test-123',
        queryParams: { source: 'mobile' }
      });
    });

    it('should throw error for invalid URL format', () => {
      const invalidUrl = 'https://app.travelplace.com/invalid/path';
      
      expect(() => parseQRCodeUrl(invalidUrl))
        .toThrow('Invalid QR code URL format');
    });

    it('should throw error for malformed URL', () => {
      const malformedUrl = 'not-a-url';
      
      expect(() => parseQRCodeUrl(malformedUrl))
        .toThrow('Invalid QR code URL format');
    });
  });

  describe('generateQRCodeStats', () => {
    it('should generate statistics for QR code array', () => {
      const now = new Date();
      const qrCodes = [
        {
          type: 'affiliate',
          timestamp: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
          metadata: {}
        },
        {
          type: 'affiliate',
          timestamp: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
          metadata: { expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000) } // expires in 1 day
        },
        {
          type: 'commission',
          timestamp: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
          metadata: { expiresAt: new Date(now.getTime() - 1 * 60 * 60 * 1000) } // expired 1 hour ago
        },
        {
          type: 'referral',
          timestamp: new Date(now.getTime() - 12 * 60 * 60 * 1000), // 12 hours ago
          metadata: { expiresAt: new Date(now.getTime() + 12 * 60 * 60 * 1000) } // expires in 12 hours
        }
      ];
      
      const result = generateQRCodeStats(qrCodes);
      
      expect(result.total).toBe(4);
      expect(result.byType).toEqual({
        affiliate: 2,
        commission: 1,
        referral: 1
      });
      expect(result.active).toBe(3); // affiliate without expiration + affiliate expiring in 1 day + referral expiring in 12 hours
      expect(result.expired).toBe(1); // commission expired
      expect(result.expiringIn24Hours).toBe(2); // affiliate expiring in 1 day + referral expiring in 12 hours
      expect(result.averageAge).toBeGreaterThan(0);
    });

    it('should handle empty array', () => {
      const result = generateQRCodeStats([]);
      
      expect(result.total).toBe(0);
      expect(result.byType).toEqual({});
      expect(result.active).toBe(0);
      expect(result.expired).toBe(0);
      expect(result.expiringIn24Hours).toBe(0);
      expect(result.averageAge).toBe(0);
    });
  });
});