// v1/routes/affiliateRoutes.js
const express = require('express');
const {
  registerAffiliate,
  approveAffiliate,
  suspendAffiliate,
  reactivateAffiliate,
  updateCommissionRates,
  getAffiliateStats,
  generateReferralLink,
  getAllAffiliates,
  getMyAffiliate,
  validateReferralCode,
  getAffiliateHealth,
  performHealthCheck,
  resetAffiliateService,
  // Dashboard endpoints
  getDashboardWallet,
  getDashboardWalletTransactions,
  getDashboardCommissions,
  getDashboardReferrals,
  requestWithdrawal,
  getDashboardWithdrawals,
  getDashboardQRCodes
} = require('../controllers/affiliateController');

const { authenticateUser, authorizeRoles } = require('../middleware/authMiddleware');
const validate = require('../middleware/validationMiddleware');
const { createAuditMiddleware } = require('../middleware/auditMiddleware');
const { 
  affiliateLimiter, 
  affiliateRegistrationLimiter, 
  affiliateWithdrawalLimiter,
  affiliateAdminLimiter 
} = require('../middleware/rateLimitMiddleware');
const { z } = require('zod');

const router = express.Router();

// Validation schemas
const registerAffiliateSchema = z.object({
  body: z.object({
    businessName: z.string()
      .min(2, 'Business name must be at least 2 characters')
      .max(100, 'Business name cannot exceed 100 characters')
      .trim(),
    businessEmail: z.string()
      .email('Please provide a valid business email address')
      .toLowerCase()
      .trim(),
    businessPhone: z.string()
      .regex(/^\+?[1-9]\d{1,14}$/, 'Please provide a valid business phone number')
      .trim(),
    businessAddress: z.object({
      street: z.string()
        .min(5, 'Street address must be at least 5 characters')
        .trim(),
      city: z.string()
        .min(2, 'City must be at least 2 characters')
        .trim(),
      state: z.string()
        .min(2, 'State must be at least 2 characters')
        .trim(),
      country: z.string()
        .min(2, 'Country must be at least 2 characters')
        .trim()
        .default('Nigeria'),
      postalCode: z.string()
        .optional()
        .transform(val => val?.trim())
    })
  })
});

const suspendAffiliateSchema = z.object({
  body: z.object({
    reason: z.string()
      .min(10, 'Suspension reason must be at least 10 characters')
      .max(500, 'Suspension reason cannot exceed 500 characters')
      .trim()
  })
});

const updateCommissionRatesSchema = z.object({
  body: z.object({
    rates: z.object({
      flights: z.number()
        .min(0, 'Flight commission rate cannot be negative')
        .max(100, 'Flight commission rate cannot exceed 100%')
        .optional(),
      hotels: z.number()
        .min(0, 'Hotel commission rate cannot be negative')
        .max(100, 'Hotel commission rate cannot exceed 100%')
        .optional(),
      insurance: z.number()
        .min(0, 'Insurance commission rate cannot be negative')
        .max(100, 'Insurance commission rate cannot exceed 100%')
        .optional(),
      visa: z.number()
        .min(0, 'Visa commission rate cannot be negative')
        .max(100, 'Visa commission rate cannot exceed 100%')
        .optional()
    }).refine(
      (rates) => Object.keys(rates).length > 0,
      'At least one commission rate must be provided'
    )
  })
});

const affiliateStatsQuerySchema = z.object({
  query: z.object({
    startDate: z.string()
      .datetime('Invalid start date format')
      .optional(),
    endDate: z.string()
      .datetime('Invalid end date format')
      .optional()
  }).refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.startDate) <= new Date(data.endDate);
      }
      return true;
    },
    'Start date must be before or equal to end date'
  )
});

const getAllAffiliatesQuerySchema = z.object({
  query: z.object({
    page: z.string()
      .regex(/^\d+$/, 'Page must be a positive integer')
      .transform(val => parseInt(val))
      .refine(val => val > 0, 'Page must be greater than 0')
      .optional(),
    limit: z.string()
      .regex(/^\d+$/, 'Limit must be a positive integer')
      .transform(val => parseInt(val))
      .refine(val => val > 0 && val <= 100, 'Limit must be between 1 and 100')
      .optional(),
    status: z.enum(['pending', 'active', 'suspended', 'inactive'])
      .optional(),
    sortBy: z.enum(['createdAt', 'approvedAt', 'businessName', 'totalReferrals', 'totalCommissionsEarned'])
      .optional(),
    sortOrder: z.enum(['asc', 'desc'])
      .optional()
  })
});

const withdrawalRequestSchema = z.object({
  body: z.object({
    amount: z.number()
      .positive('Withdrawal amount must be positive')
      .min(100, 'Minimum withdrawal amount is 100')
      .max(1000000, 'Maximum withdrawal amount is 1,000,000'),
    bankDetails: z.object({
      accountName: z.string()
        .min(2, 'Account name must be at least 2 characters')
        .max(100, 'Account name cannot exceed 100 characters')
        .trim(),
      accountNumber: z.string()
        .regex(/^\d{10}$/, 'Account number must be exactly 10 digits')
        .trim(),
      bankCode: z.string()
        .regex(/^\d{3}$/, 'Bank code must be exactly 3 digits')
        .trim(),
      bankName: z.string()
        .min(2, 'Bank name must be at least 2 characters')
        .max(100, 'Bank name cannot exceed 100 characters')
        .trim()
    })
  })
});

// Public routes
router.get('/validate-referral/:referralCode', affiliateLimiter, validateReferralCode);

// Protected routes (authenticated users)
router.use(authenticateUser);
router.use(affiliateLimiter); // Apply general affiliate rate limiting

// Affiliate registration
router.post('/register', 
  affiliateRegistrationLimiter, // Strict rate limiting for registration
  validate(registerAffiliateSchema),
  createAuditMiddleware.admin('AFFILIATE_REGISTRATION'),
  registerAffiliate
);

// Get current user's affiliate account
router.get('/me', getMyAffiliate);

// Generate referral link for current user's affiliate account
router.get('/:affiliateId/referral-link', generateReferralLink);

// Get affiliate statistics
router.get('/:affiliateId/stats', 
  validate(affiliateStatsQuerySchema),
  getAffiliateStats
);

// Dashboard endpoints
router.get('/:affiliateId/dashboard/wallet', getDashboardWallet);
router.get('/:affiliateId/dashboard/wallet/transactions', getDashboardWalletTransactions);
router.get('/:affiliateId/dashboard/commissions', getDashboardCommissions);
router.get('/:affiliateId/dashboard/referrals', getDashboardReferrals);
router.post('/:affiliateId/dashboard/withdrawals', 
  affiliateWithdrawalLimiter, // Strict rate limiting for withdrawals
  validate(withdrawalRequestSchema),
  requestWithdrawal
);
router.get('/:affiliateId/dashboard/withdrawals', getDashboardWithdrawals);
router.get('/:affiliateId/dashboard/qr-codes', getDashboardQRCodes);

// Admin only routes
router.use(authorizeRoles('Admin'));
router.use(affiliateAdminLimiter); // Higher rate limits for admin operations

// Get all affiliates
router.get('/', 
  validate(getAllAffiliatesQuerySchema),
  getAllAffiliates
);

// Approve affiliate
router.patch('/:affiliateId/approve', 
  createAuditMiddleware.admin('AFFILIATE_APPROVAL'),
  approveAffiliate
);

// Suspend affiliate
router.patch('/:affiliateId/suspend', 
  validate(suspendAffiliateSchema),
  createAuditMiddleware.admin('AFFILIATE_SUSPENSION'),
  suspendAffiliate
);

// Reactivate affiliate
router.patch('/:affiliateId/reactivate', 
  createAuditMiddleware.admin('AFFILIATE_REACTIVATION'),
  reactivateAffiliate
);

// Update commission rates
router.patch('/:affiliateId/commission-rates', 
  validate(updateCommissionRatesSchema),
  createAuditMiddleware.admin('AFFILIATE_COMMISSION_RATE_UPDATE'),
  updateCommissionRates
);

// Health and monitoring routes
router.get('/health', getAffiliateHealth);
router.post('/health-check', performHealthCheck);
router.post('/reset-service', 
  createAuditMiddleware.admin('AFFILIATE_SERVICE_RESET'),
  resetAffiliateService
);

module.exports = router;