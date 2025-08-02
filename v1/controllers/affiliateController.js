// v1/controllers/affiliateController.js
const { StatusCodes } = require('http-status-codes');
const { ApiError } = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../middleware/asyncHandler');
const affiliateService = require('../services/affiliateService');
const walletService = require('../services/walletService');
const commissionService = require('../services/commissionService');
const referralTrackingService = require('../services/referralTrackingService');
const withdrawalService = require('../services/withdrawalService');
const qrCodeService = require('../services/qrCodeService');
const logger = require('../utils/logger');
const { createAuditMiddleware } = require('../middleware/auditMiddleware');

/**
 * @description Register a new affiliate partner
 * @route POST /api/v1/affiliates/register
 * @access Private (authenticated users)
 */
const registerAffiliate = asyncHandler(async (req, res) => {
  const {
    businessName,
    businessEmail,
    businessPhone,
    businessAddress
  } = req.body;

  // Log registration attempt
  logger.info('Affiliate registration attempt', {
    userId: req.user.id,
    businessName,
    businessEmail,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  const userData = {
    userId: req.user.id
  };

  const businessData = {
    businessName,
    businessEmail,
    businessPhone,
    businessAddress
  };

  const affiliate = await affiliateService.registerAffiliate(userData, businessData);

  logger.info('Affiliate registered successfully', {
    affiliateId: affiliate.affiliateId,
    userId: req.user.id,
    businessName
  });

  return ApiResponse.created(
    res,
    'Affiliate registration submitted successfully. Your application is pending approval.',
    affiliate
  );
});

/**
 * @description Approve a pending affiliate account
 * @route PATCH /api/v1/affiliates/:affiliateId/approve
 * @access Private (admin only)
 */
const approveAffiliate = asyncHandler(async (req, res) => {
  const { affiliateId } = req.params;

  // Log approval attempt
  logger.info('Affiliate approval attempt', {
    affiliateId,
    adminId: req.user.id,
    ip: req.ip
  });

  const affiliate = await affiliateService.approveAffiliate(affiliateId, req.user.id);

  logger.info('Affiliate approved successfully', {
    affiliateId: affiliate.affiliateId,
    approvedBy: req.user.id,
    businessName: affiliate.businessName
  });

  return ApiResponse.success(
    res,
    StatusCodes.OK,
    'Affiliate approved successfully',
    affiliate
  );
});

/**
 * @description Suspend an affiliate account
 * @route PATCH /api/v1/affiliates/:affiliateId/suspend
 * @access Private (admin only)
 */
const suspendAffiliate = asyncHandler(async (req, res) => {
  const { affiliateId } = req.params;
  const { reason } = req.body;

  if (!reason) {
    throw new ApiError('Suspension reason is required', StatusCodes.BAD_REQUEST);
  }

  // Log suspension attempt
  logger.warn('Affiliate suspension attempt', {
    affiliateId,
    reason,
    adminId: req.user.id,
    ip: req.ip
  });

  const affiliate = await affiliateService.suspendAffiliate(affiliateId, reason, req.user.id);

  logger.warn('Affiliate suspended', {
    affiliateId: affiliate.affiliateId,
    reason,
    suspendedBy: req.user.id,
    businessName: affiliate.businessName
  });

  return ApiResponse.success(
    res,
    StatusCodes.OK,
    'Affiliate suspended successfully',
    affiliate
  );
});

/**
 * @description Reactivate a suspended affiliate account
 * @route PATCH /api/v1/affiliates/:affiliateId/reactivate
 * @access Private (admin only)
 */
const reactivateAffiliate = asyncHandler(async (req, res) => {
  const { affiliateId } = req.params;

  // Log reactivation attempt
  logger.info('Affiliate reactivation attempt', {
    affiliateId,
    adminId: req.user.id,
    ip: req.ip
  });

  const affiliate = await affiliateService.reactivateAffiliate(affiliateId, req.user.id);

  logger.info('Affiliate reactivated', {
    affiliateId: affiliate.affiliateId,
    reactivatedBy: req.user.id,
    businessName: affiliate.businessName
  });

  return ApiResponse.success(
    res,
    StatusCodes.OK,
    'Affiliate reactivated successfully',
    affiliate
  );
});

/**
 * @description Update commission rates for an affiliate
 * @route PATCH /api/v1/affiliates/:affiliateId/commission-rates
 * @access Private (admin only)
 */
const updateCommissionRates = asyncHandler(async (req, res) => {
  const { affiliateId } = req.params;
  const { rates } = req.body;

  if (!rates || typeof rates !== 'object') {
    throw new ApiError('Commission rates object is required', StatusCodes.BAD_REQUEST);
  }

  // Log rate update attempt
  logger.info('Commission rates update attempt', {
    affiliateId,
    rates,
    adminId: req.user.id,
    ip: req.ip
  });

  const affiliate = await affiliateService.updateCommissionRates(affiliateId, rates, req.user.id);

  logger.info('Commission rates updated', {
    affiliateId: affiliate.affiliateId,
    newRates: rates,
    updatedBy: req.user.id
  });

  return ApiResponse.success(
    res,
    StatusCodes.OK,
    'Commission rates updated successfully',
    affiliate
  );
});

/**
 * @description Get affiliate statistics and performance data
 * @route GET /api/v1/affiliates/:affiliateId/stats
 * @access Private (affiliate owner or admin)
 */
const getAffiliateStats = asyncHandler(async (req, res) => {
  const { affiliateId } = req.params;
  const { startDate, endDate } = req.query;

  // Build date range
  const dateRange = {};
  if (startDate) dateRange.startDate = startDate;
  if (endDate) dateRange.endDate = endDate;

  const stats = await affiliateService.getAffiliateStats(affiliateId, dateRange);

  // Check if user has permission to view these stats
  if (req.user.role !== 'admin' && stats.affiliate.userId !== req.user.id) {
    throw new ApiError('Access denied', StatusCodes.FORBIDDEN);
  }

  return ApiResponse.success(
    res,
    StatusCodes.OK,
    'Affiliate statistics retrieved successfully',
    stats
  );
});

/**
 * @description Generate referral link for an affiliate
 * @route GET /api/v1/affiliates/:affiliateId/referral-link
 * @access Private (affiliate owner or admin)
 */
const generateReferralLink = asyncHandler(async (req, res) => {
  const { affiliateId } = req.params;

  // First get affiliate to check ownership
  const affiliate = await affiliateService.getAffiliateByUserId(req.user.id);
  
  // Check if user has permission
  if (req.user.role !== 'admin' && affiliate.affiliateId !== affiliateId) {
    throw new ApiError('Access denied', StatusCodes.FORBIDDEN);
  }

  const referralData = await affiliateService.generateReferralLink(affiliateId);

  return ApiResponse.success(
    res,
    StatusCodes.OK,
    'Referral link generated successfully',
    referralData
  );
});

/**
 * @description Get all affiliates (admin only)
 * @route GET /api/v1/affiliates
 * @access Private (admin only)
 */
const getAllAffiliates = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    status,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    status,
    sortBy,
    sortOrder
  };

  const result = await affiliateService.getAllAffiliates(options);

  return ApiResponse.success(
    res,
    StatusCodes.OK,
    'Affiliates retrieved successfully',
    result
  );
});

/**
 * @description Get current user's affiliate account
 * @route GET /api/v1/affiliates/me
 * @access Private (authenticated users)
 */
const getMyAffiliate = asyncHandler(async (req, res) => {
  const affiliate = await affiliateService.getAffiliateByUserId(req.user.id);

  return ApiResponse.success(
    res,
    StatusCodes.OK,
    'Affiliate account retrieved successfully',
    affiliate
  );
});

/**
 * @description Validate a referral code
 * @route GET /api/v1/affiliates/validate-referral/:referralCode
 * @access Public
 */
const validateReferralCode = asyncHandler(async (req, res) => {
  const { referralCode } = req.params;

  const result = await affiliateService.validateReferralCode(referralCode);

  return ApiResponse.success(
    res,
    StatusCodes.OK,
    'Referral code validated successfully',
    result
  );
});

/**
 * @description Get affiliate service health status
 * @route GET /api/v1/affiliates/health
 * @access Private (admin only)
 */
const getAffiliateHealth = asyncHandler(async (req, res) => {
  const health = affiliateService.getAffiliateHealth();

  return ApiResponse.success(
    res,
    StatusCodes.OK,
    'Affiliate service health status retrieved',
    health
  );
});

/**
 * @description Perform affiliate service health check
 * @route POST /api/v1/affiliates/health-check
 * @access Private (admin only)
 */
const performHealthCheck = asyncHandler(async (req, res) => {
  const isHealthy = await affiliateService.performHealthCheck();

  return ApiResponse.success(
    res,
    StatusCodes.OK,
    `Affiliate service is ${isHealthy ? 'healthy' : 'unhealthy'}`,
    { isHealthy }
  );
});

/**
 * @description Reset affiliate service (admin only)
 * @route POST /api/v1/affiliates/reset-service
 * @access Private (admin only)
 */
const resetAffiliateService = asyncHandler(async (req, res) => {
  affiliateService.resetAffiliateService();

  logger.info('Affiliate service reset', {
    resetBy: req.user.id,
    ip: req.ip
  });

  return ApiResponse.success(
    res,
    StatusCodes.OK,
    'Affiliate service reset successfully',
    null
  );
});

// Dashboard endpoints

/**
 * @description Get affiliate dashboard wallet information
 * @route GET /api/v1/affiliates/:affiliateId/dashboard/wallet
 * @access Private (affiliate owner or admin)
 */
const getDashboardWallet = asyncHandler(async (req, res) => {
  const { affiliateId } = req.params;

  // Check if user has permission to view this wallet
  const affiliate = await affiliateService.getAffiliateById(affiliateId);
  if (req.user.role !== 'admin' && affiliate.userId !== req.user.id) {
    throw new ApiError('Access denied', StatusCodes.FORBIDDEN);
  }

  const walletData = await walletService.getBalance(affiliateId);

  return ApiResponse.success(
    res,
    StatusCodes.OK,
    'Wallet information retrieved successfully',
    walletData.data
  );
});

/**
 * @description Get affiliate dashboard wallet transaction history
 * @route GET /api/v1/affiliates/:affiliateId/dashboard/wallet/transactions
 * @access Private (affiliate owner or admin)
 */
const getDashboardWalletTransactions = asyncHandler(async (req, res) => {
  const { affiliateId } = req.params;
  const { page = 1, limit = 10, type, startDate, endDate } = req.query;

  // Check if user has permission to view these transactions
  const affiliate = await affiliateService.getAffiliateById(affiliateId);
  if (req.user.role !== 'admin' && affiliate.userId !== req.user.id) {
    throw new ApiError('Access denied', StatusCodes.FORBIDDEN);
  }

  const pagination = {
    page: parseInt(page),
    limit: parseInt(limit),
    type,
    startDate,
    endDate
  };

  const transactions = await walletService.getTransactionHistory(affiliateId, pagination);

  return ApiResponse.success(
    res,
    StatusCodes.OK,
    'Wallet transaction history retrieved successfully',
    transactions.data
  );
});

/**
 * @description Get affiliate dashboard commission history
 * @route GET /api/v1/affiliates/:affiliateId/dashboard/commissions
 * @access Private (affiliate owner or admin)
 */
const getDashboardCommissions = asyncHandler(async (req, res) => {
  const { affiliateId } = req.params;
  const { page = 1, limit = 10, status, serviceType, startDate, endDate } = req.query;

  // Check if user has permission to view these commissions
  const affiliate = await affiliateService.getAffiliateById(affiliateId);
  if (req.user.role !== 'admin' && affiliate.userId !== req.user.id) {
    throw new ApiError('Access denied', StatusCodes.FORBIDDEN);
  }

  const filters = {
    page: parseInt(page),
    limit: parseInt(limit),
    status,
    serviceType,
    startDate,
    endDate
  };

  const commissions = await commissionService.getCommissionHistory(affiliateId, filters);

  return ApiResponse.success(
    res,
    StatusCodes.OK,
    'Commission history retrieved successfully',
    commissions.data
  );
});

/**
 * @description Get affiliate dashboard referral tracking data
 * @route GET /api/v1/affiliates/:affiliateId/dashboard/referrals
 * @access Private (affiliate owner or admin)
 */
const getDashboardReferrals = asyncHandler(async (req, res) => {
  const { affiliateId } = req.params;
  const { page = 1, limit = 10, status, startDate, endDate } = req.query;

  // Check if user has permission to view these referrals
  const affiliate = await affiliateService.getAffiliateById(affiliateId);
  if (req.user.role !== 'admin' && affiliate.userId !== req.user.id) {
    throw new ApiError('Access denied', StatusCodes.FORBIDDEN);
  }

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    status,
    startDate,
    endDate
  };

  const referrals = await referralTrackingService.getReferralsByAffiliate(affiliateId, options);

  return ApiResponse.success(
    res,
    StatusCodes.OK,
    'Referral tracking data retrieved successfully',
    referrals.data
  );
});

/**
 * @description Request withdrawal from affiliate wallet
 * @route POST /api/v1/affiliates/:affiliateId/dashboard/withdrawals
 * @access Private (affiliate owner or admin)
 */
const requestWithdrawal = asyncHandler(async (req, res) => {
  const { affiliateId } = req.params;
  const { amount, bankDetails } = req.body;

  // Check if user has permission to request withdrawal
  const affiliate = await affiliateService.getAffiliateById(affiliateId);
  if (req.user.role !== 'admin' && affiliate.userId !== req.user.id) {
    throw new ApiError('Access denied', StatusCodes.FORBIDDEN);
  }

  logger.info('Withdrawal request initiated', {
    affiliateId,
    amount,
    userId: req.user.id,
    ip: req.ip
  });

  const withdrawal = await withdrawalService.requestWithdrawal(affiliateId, amount, bankDetails);

  logger.info('Withdrawal request created', {
    withdrawalId: withdrawal.data._id,
    affiliateId,
    amount
  });

  return ApiResponse.created(
    res,
    'Withdrawal request submitted successfully',
    withdrawal.data
  );
});

/**
 * @description Get affiliate dashboard withdrawal history
 * @route GET /api/v1/affiliates/:affiliateId/dashboard/withdrawals
 * @access Private (affiliate owner or admin)
 */
const getDashboardWithdrawals = asyncHandler(async (req, res) => {
  const { affiliateId } = req.params;
  const { page = 1, limit = 10, status, startDate, endDate } = req.query;

  // Check if user has permission to view these withdrawals
  const affiliate = await affiliateService.getAffiliateById(affiliateId);
  if (req.user.role !== 'admin' && affiliate.userId !== req.user.id) {
    throw new ApiError('Access denied', StatusCodes.FORBIDDEN);
  }

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    status,
    startDate,
    endDate
  };

  const withdrawals = await withdrawalService.getWithdrawalHistory(affiliateId, options);

  return ApiResponse.success(
    res,
    StatusCodes.OK,
    'Withdrawal history retrieved successfully',
    withdrawals.data
  );
});

/**
 * @description Get affiliate dashboard QR codes
 * @route GET /api/v1/affiliates/:affiliateId/dashboard/qr-codes
 * @access Private (affiliate owner or admin)
 */
const getDashboardQRCodes = asyncHandler(async (req, res) => {
  const { affiliateId } = req.params;

  // Check if user has permission to view these QR codes
  const affiliate = await affiliateService.getAffiliateById(affiliateId);
  if (req.user.role !== 'admin' && affiliate.userId !== req.user.id) {
    throw new ApiError('Access denied', StatusCodes.FORBIDDEN);
  }

  // Generate/retrieve QR codes for the affiliate
  const qrCodes = {
    affiliate: null,
    referral: null
  };

  try {
    // Generate affiliate QR code
    qrCodes.affiliate = await qrCodeService.generateAffiliateQR({
      affiliateId: affiliate._id,
      referralCode: affiliate.referralCode,
      businessName: affiliate.businessName
    });

    // Generate referral QR code
    qrCodes.referral = await qrCodeService.generateReferralQR({
      affiliateId: affiliate._id,
      referralCode: affiliate.referralCode,
      businessName: affiliate.businessName
    });

  } catch (error) {
    logger.error('Error generating QR codes for affiliate', {
      affiliateId,
      error: error.message
    });
    
    // Return partial data if some QR codes failed
    qrCodes.error = 'Some QR codes could not be generated';
  }

  return ApiResponse.success(
    res,
    StatusCodes.OK,
    'QR codes retrieved successfully',
    qrCodes
  );
});

module.exports = {
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
};