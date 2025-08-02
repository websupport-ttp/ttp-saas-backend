// v1/routes/qrCodeRoutes.js
const express = require('express');
const {
  generateQRCode,
  validateQRCode,
  getQRCodeMetadata,
  downloadQRCode,
  getQRCodeHealth
} = require('../controllers/qrCodeController');

const { authenticateUser, authorizeRoles } = require('../middleware/authMiddleware');
const validate = require('../middleware/validationMiddleware');
const { createAuditMiddleware } = require('../middleware/auditMiddleware');
const { 
  qrCodeGenerationLimiter,
  qrCodeValidationLimiter,
  qrCodeMetadataLimiter,
  qrCodeDownloadLimiter,
  qrCodeHealthLimiter,
  qrCodeSensitiveLimiter,
  apiLimiter 
} = require('../middleware/rateLimitMiddleware');
const { z } = require('zod');

const router = express.Router();

// QR code specific rate limiters are now imported from rateLimitMiddleware.js

// Validation schemas
const generateQRCodeSchema = z.object({
  body: z.object({
    type: z.enum(['affiliate', 'commission', 'withdrawal', 'referral'], {
      errorMap: () => ({ message: 'QR code type must be one of: affiliate, commission, withdrawal, referral' })
    }),
    data: z.object({
      // Affiliate QR data
      affiliateId: z.string()
        .min(1, 'Affiliate ID is required')
        .optional(),
      referralCode: z.string()
        .min(1, 'Referral code is required')
        .optional(),
      businessName: z.string()
        .max(100, 'Business name cannot exceed 100 characters')
        .optional(),
      
      // Commission QR data
      transactionId: z.string()
        .min(1, 'Transaction ID is required')
        .optional(),
      commissionAmount: z.number()
        .positive('Commission amount must be positive')
        .optional(),
      currency: z.string()
        .length(3, 'Currency must be a 3-letter code')
        .default('NGN')
        .optional(),
      serviceType: z.string()
        .min(1, 'Service type is required')
        .optional(),
      bookingReference: z.string()
        .optional(),
      status: z.string()
        .min(1, 'Status is required')
        .optional(),
      
      // Withdrawal QR data
      withdrawalId: z.string()
        .min(1, 'Withdrawal ID is required')
        .optional(),
      amount: z.number()
        .positive('Amount must be positive')
        .optional(),
      bankDetails: z.object({
        accountName: z.string()
          .min(2, 'Account name must be at least 2 characters')
          .max(100, 'Account name cannot exceed 100 characters'),
        bankName: z.string()
          .min(2, 'Bank name must be at least 2 characters')
          .max(100, 'Bank name cannot exceed 100 characters')
      }).optional(),
      
      // Referral QR data
      expiresAt: z.string()
        .datetime('Invalid expiration date format')
        .optional(),
      campaign: z.string()
        .max(100, 'Campaign name cannot exceed 100 characters')
        .optional(),
      source: z.string()
        .max(50, 'Source cannot exceed 50 characters')
        .optional()
    }).passthrough(), // Allow additional fields for type-specific validation
    options: z.object({
      size: z.number()
        .int('Size must be an integer')
        .min(64, 'Minimum QR code size is 64px')
        .max(1024, 'Maximum QR code size is 1024px')
        .optional(),
      format: z.enum(['png', 'svg'], {
        errorMap: () => ({ message: 'Format must be either png or svg' })
      }).optional(),
      errorCorrectionLevel: z.enum(['L', 'M', 'Q', 'H'], {
        errorMap: () => ({ message: 'Error correction level must be one of: L, M, Q, H' })
      }).optional()
    }).optional()
  })
}).refine((data) => {
  const { type, data: qrData } = data.body;
  
  // Type-specific validation
  switch (type) {
    case 'affiliate':
      return qrData.affiliateId && qrData.referralCode;
    case 'commission':
      return qrData.transactionId && qrData.affiliateId && qrData.commissionAmount && qrData.serviceType && qrData.status;
    case 'withdrawal':
      return qrData.withdrawalId && qrData.affiliateId && qrData.amount && qrData.status;
    case 'referral':
      return qrData.affiliateId && qrData.referralCode;
    default:
      return false;
  }
}, {
  message: 'Required fields missing for the specified QR code type',
  path: ['body', 'data']
});

const validateQRCodeSchema = z.object({
  body: z.object({
    qrData: z.string()
      .min(1, 'QR data is required')
      .max(10000, 'QR data is too large')
  })
});

const qrCodeParamsSchema = z.object({
  params: z.object({
    qrId: z.string()
      .regex(/^qr_[a-f0-9-]{36}$/, 'Invalid QR code ID format')
  })
});

const downloadQRCodeSchema = z.object({
  params: z.object({
    qrId: z.string()
      .regex(/^qr_[a-f0-9-]{36}$/, 'Invalid QR code ID format')
  }),
  query: z.object({
    size: z.string()
      .regex(/^\d+$/, 'Size must be a positive integer')
      .transform(val => parseInt(val))
      .refine(val => val >= 64 && val <= 1024, 'Size must be between 64 and 1024 pixels')
      .optional(),
    format: z.enum(['png', 'svg'], {
      errorMap: () => ({ message: 'Format must be either png or svg' })
    }).optional(),
    quality: z.string()
      .regex(/^0\.\d+$|^1\.0$/, 'Quality must be a decimal between 0.1 and 1.0')
      .transform(val => parseFloat(val))
      .optional()
  }).optional()
});

// Public routes (no authentication required)

// Health check endpoint
router.get('/health', 
  qrCodeHealthLimiter,
  getQRCodeHealth
);

// Protected routes (authentication required)
router.use(authenticateUser);

// Middleware to apply sensitive rate limiting for withdrawal and commission QR codes
const applySensitiveRateLimit = (req, res, next) => {
  const qrType = req.body?.type;
  if (qrType === 'withdrawal' || qrType === 'commission') {
    return qrCodeSensitiveLimiter(req, res, next);
  }
  next();
};

// Generate QR code endpoint
router.post('/generate',
  qrCodeGenerationLimiter,
  applySensitiveRateLimit,
  validate(generateQRCodeSchema),
  createAuditMiddleware.content('QR_CODE_GENERATION'),
  generateQRCode
);

// Validate QR code endpoint
router.post('/validate',
  qrCodeValidationLimiter,
  validate(validateQRCodeSchema),
  validateQRCode
);

// Get QR code metadata endpoint
router.get('/:qrId',
  qrCodeMetadataLimiter,
  validate(qrCodeParamsSchema),
  getQRCodeMetadata
);

// Download QR code image endpoint
router.get('/:qrId/download',
  qrCodeDownloadLimiter,
  validate(downloadQRCodeSchema),
  downloadQRCode
);

module.exports = router;