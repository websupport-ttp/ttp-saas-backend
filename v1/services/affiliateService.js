// v1/services/affiliateService.js
const Affiliate = require('../models/affiliateModel');
const Wallet = require('../models/walletModel');
const User = require('../models/userModel');
const { ApiError } = require('../utils/apiError');
const { AffiliateError } = require('../utils/affiliateErrors');
const ServiceWrapper = require('../utils/serviceWrapper');
const { StatusCodes } = require('http-status-codes');
const logger = require('../utils/logger');
const errorRecovery = require('../utils/errorRecovery');
const errorMonitor = require('../utils/errorMonitoring');
const qrCodeService = require('./qrCodeService');
const AffiliateNotificationService = require('./affiliateNotificationService');

// Create service wrapper with fallback strategies
const affiliateWrapper = new ServiceWrapper('Affiliate', {
  failureThreshold: 3,
  recoveryTimeout: 30000, // 30 seconds
  maxRetries: 2,
  initialDelay: 500,
  fallbackStrategies: {
    registerAffiliate: {
      type: 'degraded_response'
    },
    getAffiliateStats: {
      type: 'cache'
    }
  }
});

/**
 * @function registerAffiliate
 * @description Register a new affiliate partner
 * @param {object} userData - User data for the affiliate
 * @param {object} businessData - Business data for the affiliate
 * @returns {object} Created affiliate with QR code
 * @throws {ApiError} If registration fails
 */
const registerAffiliate = async (userData, businessData) => {
  return await affiliateWrapper.execute(
    async () => {
      // Validate required fields
      if (!userData.userId) {
        throw new ApiError('User ID is required for affiliate registration', StatusCodes.BAD_REQUEST);
      }

      if (!businessData.businessName || !businessData.businessEmail || !businessData.businessPhone) {
        throw new ApiError('Business name, email, and phone are required', StatusCodes.BAD_REQUEST);
      }

      // Check if user exists
      const user = await User.findById(userData.userId);
      if (!user) {
        throw AffiliateError.notFound(userData.userId, { operation: 'user_lookup' });
      }

      // Check if user is already an affiliate
      const existingAffiliate = await Affiliate.findOne({ userId: userData.userId });
      if (existingAffiliate) {
        throw AffiliateError.alreadyExists(`user ${userData.userId}`, { 
          operation: 'duplicate_check',
          existingAffiliateId: existingAffiliate.affiliateId 
        });
      }

      // Check if business email is already registered
      const existingBusinessEmail = await Affiliate.findOne({ businessEmail: businessData.businessEmail });
      if (existingBusinessEmail) {
        throw AffiliateError.alreadyExists(`business email ${businessData.businessEmail}`, {
          operation: 'duplicate_check',
          existingAffiliateId: existingBusinessEmail.affiliateId
        });
      }

      // Create affiliate account
      const affiliateData = {
        userId: userData.userId,
        ...businessData,
        status: 'pending'
      };

      const affiliate = new Affiliate(affiliateData);
      await affiliate.save();

      // Generate QR code for the affiliate
      try {
        const qrCodeData = await qrCodeService.generateAffiliateQR({
          affiliateId: affiliate.affiliateId,
          referralCode: affiliate.referralCode,
          businessName: affiliate.businessName,
          userId: affiliate.userId
        });

        affiliate.qrCode = qrCodeData;
        await affiliate.save();
      } catch (qrError) {
        logger.error('Failed to generate QR code for affiliate', {
          affiliateId: affiliate.affiliateId,
          error: qrError.message
        });
        // Continue without QR code - it can be generated later
      }

      // Create wallet for the affiliate
      try {
        const wallet = new Wallet({
          affiliateId: affiliate._id,
          balance: 0,
          totalEarned: 0,
          totalWithdrawn: 0,
          currency: 'NGN',
          status: 'active'
        });
        await wallet.save();
      } catch (walletError) {
        logger.error('Failed to create wallet for affiliate', {
          affiliateId: affiliate.affiliateId,
          error: walletError.message
        });
        // Rollback affiliate creation if wallet creation fails
        await Affiliate.findByIdAndDelete(affiliate._id);
        throw new ApiError('Failed to create affiliate wallet', StatusCodes.INTERNAL_SERVER_ERROR);
      }

      logger.info('Affiliate registered successfully', {
        affiliateId: affiliate.affiliateId,
        userId: userData.userId,
        businessName: businessData.businessName
      });

      return affiliate.populate('userId', 'firstName lastName email');
    },
    'registerAffiliate',
    { userData, businessData }
  );
};

/**
 * @function approveAffiliate
 * @description Approve a pending affiliate account
 * @param {string} affiliateId - Affiliate ID to approve
 * @param {string} adminId - Admin user ID performing the approval
 * @returns {object} Approved affiliate
 * @throws {ApiError} If approval fails
 */
const approveAffiliate = async (affiliateId, adminId) => {
  return await affiliateWrapper.execute(
    async () => {
      const affiliate = await Affiliate.findOne({ affiliateId });
      if (!affiliate) {
        throw new ApiError('Affiliate not found', StatusCodes.NOT_FOUND);
      }

      if (affiliate.status !== 'pending') {
        throw new ApiError('Only pending affiliates can be approved', StatusCodes.BAD_REQUEST);
      }

      // Verify admin exists
      const admin = await User.findById(adminId);
      if (!admin || admin.role !== 'Admin') {
        throw new ApiError('Invalid admin user', StatusCodes.FORBIDDEN);
      }

      const previousStatus = affiliate.status;
      await affiliate.approve(adminId);

      logger.info('Affiliate approved successfully', {
        affiliateId: affiliate.affiliateId,
        approvedBy: adminId,
        businessName: affiliate.businessName
      });

      // Send notification after approval
      try {
        await AffiliateNotificationService.sendAccountStatusChangeNotification(affiliate, previousStatus, 'active');
      } catch (notificationError) {
        logger.warn('Failed to send affiliate approval notification:', notificationError.message);
      }

      return affiliate.populate(['userId', 'approvedBy']);
    },
    'approveAffiliate',
    { affiliateId, adminId }
  );
};

/**
 * @function suspendAffiliate
 * @description Suspend an active affiliate account
 * @param {string} affiliateId - Affiliate ID to suspend
 * @param {string} reason - Reason for suspension
 * @param {string} adminId - Admin user ID performing the suspension
 * @returns {object} Suspended affiliate
 * @throws {ApiError} If suspension fails
 */
const suspendAffiliate = async (affiliateId, reason, adminId) => {
  return await affiliateWrapper.execute(
    async () => {
      const affiliate = await Affiliate.findOne({ affiliateId });
      if (!affiliate) {
        throw new ApiError('Affiliate not found', StatusCodes.NOT_FOUND);
      }

      if (affiliate.status === 'suspended') {
        throw new ApiError('Affiliate is already suspended', StatusCodes.BAD_REQUEST);
      }

      // Verify admin exists
      const admin = await User.findById(adminId);
      if (!admin || admin.role !== 'Admin') {
        throw new ApiError('Invalid admin user', StatusCodes.FORBIDDEN);
      }

      await affiliate.suspend(reason);

      // Also freeze the associated wallet
      const wallet = await Wallet.findOne({ affiliateId: affiliate._id });
      if (wallet) {
        wallet.status = 'frozen';
        await wallet.save();
      }

      logger.warn('Affiliate suspended', {
        affiliateId: affiliate.affiliateId,
        reason,
        suspendedBy: adminId,
        businessName: affiliate.businessName
      });

      // Send notification after suspension
      try {
        await AffiliateNotificationService.sendAccountStatusChangeNotification(affiliate, 'active', 'suspended');
      } catch (notificationError) {
        logger.warn('Failed to send affiliate suspension notification:', notificationError.message);
      }

      return affiliate;
    },
    'suspendAffiliate',
    { affiliateId, reason, adminId }
  );
};

/**
 * @function reactivateAffiliate
 * @description Reactivate a suspended affiliate account
 * @param {string} affiliateId - Affiliate ID to reactivate
 * @param {string} adminId - Admin user ID performing the reactivation
 * @returns {object} Reactivated affiliate
 * @throws {ApiError} If reactivation fails
 */
const reactivateAffiliate = async (affiliateId, adminId) => {
  return await affiliateWrapper.execute(
    async () => {
      const affiliate = await Affiliate.findOne({ affiliateId });
      if (!affiliate) {
        throw new ApiError('Affiliate not found', StatusCodes.NOT_FOUND);
      }

      if (affiliate.status !== 'suspended') {
        throw new ApiError('Only suspended affiliates can be reactivated', StatusCodes.BAD_REQUEST);
      }

      // Verify admin exists
      const admin = await User.findById(adminId);
      if (!admin || admin.role !== 'Admin') {
        throw new ApiError('Invalid admin user', StatusCodes.FORBIDDEN);
      }

      await affiliate.reactivate();

      // Also unfreeze the associated wallet
      const wallet = await Wallet.findOne({ affiliateId: affiliate._id });
      if (wallet) {
        wallet.status = 'active';
        await wallet.save();
      }

      logger.info('Affiliate reactivated successfully', {
        affiliateId: affiliate.affiliateId,
        reactivatedBy: adminId,
        businessName: affiliate.businessName
      });

      return affiliate;
    },
    'reactivateAffiliate',
    { affiliateId, adminId }
  );
};

/**
 * @function updateCommissionRates
 * @description Update commission rates for an affiliate
 * @param {string} affiliateId - Affiliate ID
 * @param {object} rates - New commission rates
 * @param {string} adminId - Admin user ID performing the update
 * @returns {object} Updated affiliate
 * @throws {ApiError} If update fails
 */
const updateCommissionRates = async (affiliateId, rates, adminId) => {
  return await affiliateWrapper.execute(
    async () => {
      const affiliate = await Affiliate.findOne({ affiliateId });
      if (!affiliate) {
        throw new ApiError('Affiliate not found', StatusCodes.NOT_FOUND);
      }

      // Verify admin exists
      const admin = await User.findById(adminId);
      if (!admin || admin.role !== 'Admin') {
        throw new ApiError('Invalid admin user', StatusCodes.FORBIDDEN);
      }

      // Validate rates
      const validServices = ['flights', 'hotels', 'insurance', 'visa'];
      const invalidServices = Object.keys(rates).filter(service => !validServices.includes(service));
      if (invalidServices.length > 0) {
        throw new ApiError(`Invalid service types: ${invalidServices.join(', ')}`, StatusCodes.BAD_REQUEST);
      }

      // Validate rate values
      for (const [service, rate] of Object.entries(rates)) {
        if (typeof rate !== 'number' || rate < 0 || rate > 100) {
          throw new ApiError(`Invalid rate for ${service}: must be between 0 and 100`, StatusCodes.BAD_REQUEST);
        }
      }

      await affiliate.updateCommissionRates(rates);

      logger.info('Commission rates updated', {
        affiliateId: affiliate.affiliateId,
        updatedBy: adminId,
        newRates: rates
      });

      return affiliate;
    },
    'updateCommissionRates',
    { affiliateId, rates, adminId }
  );
};

/**
 * @function getAffiliateStats
 * @description Get affiliate statistics and performance data
 * @param {string} affiliateId - Affiliate ID
 * @param {object} dateRange - Date range for statistics
 * @returns {object} Affiliate statistics
 * @throws {ApiError} If retrieval fails
 */
const getAffiliateStats = async (affiliateId, dateRange = {}) => {
  return await affiliateWrapper.execute(
    async () => {
      const affiliate = await Affiliate.findOne({ affiliateId }).populate('userId', 'firstName lastName email');
      if (!affiliate) {
        throw new ApiError('Affiliate not found', StatusCodes.NOT_FOUND);
      }

      // Get wallet information
      const wallet = await Wallet.findOne({ affiliateId: affiliate._id });

      // Build date filter
      const dateFilter = {};
      if (dateRange.startDate) {
        dateFilter.createdAt = { $gte: new Date(dateRange.startDate) };
      }
      if (dateRange.endDate) {
        dateFilter.createdAt = { ...dateFilter.createdAt, $lte: new Date(dateRange.endDate) };
      }

      // Get referral statistics (would need Referral model)
      // For now, return basic affiliate info
      const stats = {
        affiliate: {
          affiliateId: affiliate.affiliateId,
          referralCode: affiliate.referralCode,
          businessName: affiliate.businessName,
          status: affiliate.status,
          totalReferrals: affiliate.totalReferrals,
          totalCommissionsEarned: affiliate.totalCommissionsEarned,
          commissionRates: affiliate.commissionRates,
          createdAt: affiliate.createdAt,
          approvedAt: affiliate.approvedAt
        },
        wallet: wallet ? {
          balance: wallet.balance,
          totalEarned: wallet.totalEarned,
          totalWithdrawn: wallet.totalWithdrawn,
          currency: wallet.currency,
          status: wallet.status
        } : null,
        performance: {
          // These would be calculated from actual referral and commission data
          totalReferrals: affiliate.totalReferrals,
          totalEarnings: affiliate.totalCommissionsEarned,
          averageCommissionPerReferral: affiliate.totalReferrals > 0 
            ? affiliate.totalCommissionsEarned / affiliate.totalReferrals 
            : 0
        }
      };

      return stats;
    },
    'getAffiliateStats',
    { affiliateId, dateRange, cacheKey: `affiliate_stats_${affiliateId}` }
  );
};

/**
 * @function generateReferralLink
 * @description Generate referral link for an affiliate
 * @param {string} affiliateId - Affiliate ID
 * @returns {object} Referral link information
 * @throws {ApiError} If generation fails
 */
const generateReferralLink = async (affiliateId) => {
  return await affiliateWrapper.execute(
    async () => {
      const affiliate = await Affiliate.findOne({ affiliateId });
      if (!affiliate) {
        throw new ApiError('Affiliate not found', StatusCodes.NOT_FOUND);
      }

      if (affiliate.status !== 'active') {
        throw new ApiError('Only active affiliates can generate referral links', StatusCodes.BAD_REQUEST);
      }

      const baseUrl = process.env.FRONTEND_URL || 'https://thetravelplace.com';
      const referralLink = `${baseUrl}/book?ref=${affiliate.referralCode}`;

      return {
        affiliateId: affiliate.affiliateId,
        referralCode: affiliate.referralCode,
        referralLink,
        qrCode: affiliate.qrCode
      };
    },
    'generateReferralLink',
    { affiliateId }
  );
};

/**
 * @function getAllAffiliates
 * @description Get all affiliates with pagination and filtering
 * @param {object} options - Query options (page, limit, status, etc.)
 * @returns {object} Paginated affiliates list
 */
const getAllAffiliates = async (options = {}) => {
  return await affiliateWrapper.execute(
    async () => {
      const {
        page = 1,
        limit = 10,
        status,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = options;

      const filter = {};
      if (status) {
        filter.status = status;
      }

      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const skip = (page - 1) * limit;

      const [affiliates, total] = await Promise.all([
        Affiliate.find(filter)
          .populate('userId', 'firstName lastName email')
          .populate('approvedBy', 'firstName lastName email')
          .sort(sort)
          .skip(skip)
          .limit(limit),
        Affiliate.countDocuments(filter)
      ]);

      return {
        affiliates,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit
        }
      };
    },
    'getAllAffiliates',
    { options }
  );
};

/**
 * @function getAffiliateById
 * @description Get affiliate by affiliate ID
 * @param {string} affiliateId - Affiliate ID
 * @returns {object} Affiliate data
 * @throws {ApiError} If not found
 */
const getAffiliateById = async (affiliateId) => {
  return await affiliateWrapper.execute(
    async () => {
      const affiliate = await Affiliate.findOne({ affiliateId }).populate('userId', 'firstName lastName email');
      if (!affiliate) {
        throw new ApiError('Affiliate not found', StatusCodes.NOT_FOUND);
      }

      return affiliate;
    },
    'getAffiliateById',
    { affiliateId }
  );
};

/**
 * @function getAffiliateByUserId
 * @description Get affiliate by user ID
 * @param {string} userId - User ID
 * @returns {object} Affiliate data
 * @throws {ApiError} If not found
 */
const getAffiliateByUserId = async (userId) => {
  return await affiliateWrapper.execute(
    async () => {
      const affiliate = await Affiliate.findOne({ userId }).populate('userId', 'firstName lastName email');
      if (!affiliate) {
        throw new ApiError('Affiliate not found for this user', StatusCodes.NOT_FOUND);
      }

      return affiliate;
    },
    'getAffiliateByUserId',
    { userId }
  );
};

/**
 * @function validateReferralCode
 * @description Validate a referral code
 * @param {string} referralCode - Referral code to validate
 * @returns {object} Affiliate information if valid
 * @throws {ApiError} If invalid
 */
const validateReferralCode = async (referralCode) => {
  return await affiliateWrapper.execute(
    async () => {
      const affiliate = await Affiliate.validateReferralCode(referralCode);
      if (!affiliate) {
        throw new ApiError('Invalid or inactive referral code', StatusCodes.BAD_REQUEST);
      }

      return {
        affiliateId: affiliate.affiliateId,
        referralCode: affiliate.referralCode,
        businessName: affiliate.businessName,
        isValid: true
      };
    },
    'validateReferralCode',
    { referralCode }
  );
};

/**
 * @function getAffiliateHealth
 * @description Get affiliate service health status
 * @returns {object} Health status
 */
const getAffiliateHealth = () => {
  return affiliateWrapper.getHealthStatus();
};

/**
 * @function performHealthCheck
 * @description Perform health check on affiliate service
 * @returns {Promise<boolean>} Health check result
 */
const performHealthCheck = async () => {
  return await affiliateWrapper.performHealthCheck(async () => {
    // Simple health check - verify we can query affiliates
    await Affiliate.findOne().limit(1);
  });
};

/**
 * @function resetAffiliateService
 * @description Reset affiliate service wrapper (for admin use)
 */
const resetAffiliateService = () => {
  affiliateWrapper.reset();
  logger.info('Affiliate service wrapper has been reset');
};

module.exports = {
  registerAffiliate,
  approveAffiliate,
  suspendAffiliate,
  reactivateAffiliate,
  updateCommissionRates,
  getAffiliateStats,
  generateReferralLink,
  getAllAffiliates,
  getAffiliateById,
  getAffiliateByUserId,
  validateReferralCode,
  getAffiliateHealth,
  performHealthCheck,
  resetAffiliateService
};