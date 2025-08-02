// v1/services/referralTrackingService.js
const Referral = require('../models/referralModel');
const Affiliate = require('../models/affiliateModel');
const { ApiError } = require('../utils/apiError');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

/**
 * @description Service for managing customer referrals and attribution
 */
class ReferralTrackingService {
  /**
   * Track a new referral when customer uses referral code
   * @param {string} referralCode - The referral code used
   * @param {object} customerData - Customer information
   * @param {object} requestData - Request metadata (IP, user agent, etc.)
   * @returns {object} Referral tracking result
   */
  static async trackReferral(referralCode, customerData, requestData = {}) {
    try {
      const { customerId, customerEmail } = customerData;
      const { 
        ipAddress, 
        userAgent, 
        referrerUrl, 
        landingPage,
        deviceInfo = {},
        geolocation = {},
        utmParameters = {}
      } = requestData;

      // Validate referral code and get affiliate
      const validation = await this.validateReferralCode(referralCode, customerId);
      
      if (!validation.valid) {
        throw new ApiError(validation.error, 400, [], 'INVALID_REFERRAL_CODE');
      }

      // If referral already exists, return existing referral
      if (!validation.isNew) {
        logger.info(`Existing referral found for customer ${customerId} with code ${referralCode}`);
        return {
          success: true,
          referral: validation.referral,
          isNew: false,
          message: 'Existing referral relationship found'
        };
      }

      // Create new referral
      const referralData = {
        affiliateId: validation.affiliate._id,
        customerId,
        referralCode: referralCode.toUpperCase(),
        referralSource: this._determineReferralSource(requestData),
        ipAddress: ipAddress || '0.0.0.0',
        userAgent: userAgent || 'Unknown',
        referrerUrl,
        landingPage,
        deviceInfo: {
          type: deviceInfo.type || 'unknown',
          browser: deviceInfo.browser,
          os: deviceInfo.os
        },
        geolocation: {
          country: geolocation.country,
          region: geolocation.region,
          city: geolocation.city,
          coordinates: {
            latitude: geolocation.latitude,
            longitude: geolocation.longitude
          }
        },
        utmParameters: {
          source: utmParameters.utm_source,
          medium: utmParameters.utm_medium,
          campaign: utmParameters.utm_campaign,
          term: utmParameters.utm_term,
          content: utmParameters.utm_content
        }
      };

      const referral = new Referral(referralData);
      await referral.save();

      // Increment affiliate referral count
      await validation.affiliate.incrementReferrals();

      logger.info(`New referral tracked: ${referral._id} for affiliate ${validation.affiliate.affiliateId}`);

      return {
        success: true,
        referral,
        isNew: true,
        affiliate: {
          id: validation.affiliate._id,
          businessName: validation.affiliate.businessName,
          affiliateId: validation.affiliate.affiliateId
        },
        message: 'Referral successfully tracked'
      };

    } catch (error) {
      logger.error('Error tracking referral:', error);
      
      if (error instanceof ApiError) {
        throw error;
      }
      
      throw new ApiError('Failed to track referral', 500, [], 'REFERRAL_TRACKING_ERROR');
    }
  }

  /**
   * Validate referral code and check if it's valid for the customer
   * @param {string} code - Referral code to validate
   * @param {string} customerId - Customer ID (optional)
   * @returns {object} Validation result
   */
  static async validateReferralCode(code, customerId = null) {
    try {
      if (!code || typeof code !== 'string') {
        return { valid: false, error: 'Referral code is required' };
      }

      const upperCode = code.toUpperCase().trim();

      // If customer ID provided, check for existing referral
      if (customerId) {
        const existingReferral = await Referral.findOne({ 
          referralCode: upperCode,
          customerId 
        }).populate('affiliateId');
        
        if (existingReferral) {
          return { 
            valid: true, 
            referral: existingReferral, 
            isNew: false,
            affiliate: existingReferral.affiliateId
          };
        }
      }

      // Check if referral code exists and affiliate is active
      const affiliate = await Affiliate.findOne({ 
        referralCode: upperCode,
        status: 'active'
      });
      
      if (!affiliate) {
        return { valid: false, error: 'Invalid or inactive referral code' };
      }

      return { 
        valid: true, 
        affiliate, 
        isNew: true 
      };

    } catch (error) {
      logger.error('Error validating referral code:', error);
      return { valid: false, error: 'Failed to validate referral code' };
    }
  }

  /**
   * Attribute a booking to a referral and update statistics
   * @param {object} bookingData - Booking information
   * @param {string} customerId - Customer ID
   * @returns {object} Attribution result
   */
  static async attributeBooking(bookingData, customerId) {
    try {
      const {
        bookingReference,
        serviceType,
        bookingAmount,
        commissionGenerated,
        currency = 'NGN'
      } = bookingData;

      // Find active referral for this customer
      const referral = await Referral.findOne({
        customerId,
        status: { $in: ['active', 'converted'] }
      }).populate('affiliateId');

      if (!referral) {
        logger.info(`No active referral found for customer ${customerId}`);
        return {
          success: false,
          message: 'No active referral found for customer',
          attributed: false
        };
      }

      // Check if booking already attributed
      const existingBooking = referral.bookingHistory.find(
        booking => booking.bookingReference === bookingReference
      );

      if (existingBooking) {
        logger.warn(`Booking ${bookingReference} already attributed to referral ${referral._id}`);
        return {
          success: true,
          message: 'Booking already attributed',
          attributed: false,
          referral
        };
      }

      // Add booking to referral
      await referral.addBooking({
        bookingReference,
        serviceType,
        bookingAmount,
        commissionGenerated
      });

      // Update affiliate commission earnings
      if (referral.affiliateId && commissionGenerated > 0) {
        await referral.affiliateId.addCommissionEarnings(commissionGenerated);
      }

      logger.info(`Booking ${bookingReference} attributed to referral ${referral._id}`);

      return {
        success: true,
        message: 'Booking successfully attributed',
        attributed: true,
        referral,
        affiliate: referral.affiliateId,
        bookingData: {
          bookingReference,
          serviceType,
          bookingAmount,
          commissionGenerated
        }
      };

    } catch (error) {
      logger.error('Error attributing booking:', error);
      throw new ApiError('Failed to attribute booking to referral', 500, [], 'BOOKING_ATTRIBUTION_ERROR');
    }
  }

  /**
   * Get referral statistics for an affiliate
   * @param {string} affiliateId - Affiliate ID
   * @param {object} dateRange - Date range filter
   * @returns {object} Referral statistics
   */
  static async getReferralStats(affiliateId, dateRange = {}) {
    try {
      const { startDate, endDate } = dateRange;

      // Get basic stats using model static method
      const basicStats = await Referral.getAffiliateStats(affiliateId, dateRange);
      
      // Get additional detailed statistics
      const matchStage = { 
        affiliateId: new mongoose.Types.ObjectId(affiliateId) 
      };
      
      if (startDate || endDate) {
        matchStage.createdAt = {};
        if (startDate) matchStage.createdAt.$gte = new Date(startDate);
        if (endDate) matchStage.createdAt.$lte = new Date(endDate);
      }

      // Get referral source breakdown
      const sourceBreakdown = await Referral.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$referralSource',
            count: { $sum: 1 },
            totalValue: { $sum: '$totalValue' },
            convertedCount: {
              $sum: { $cond: [{ $gt: ['$totalBookings', 0] }, 1, 0] }
            }
          }
        },
        {
          $addFields: {
            conversionRate: {
              $multiply: [
                { $divide: ['$convertedCount', '$count'] },
                100
              ]
            }
          }
        },
        { $sort: { count: -1 } }
      ]);

      // Get monthly performance
      const monthlyPerformance = await Referral.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            referrals: { $sum: 1 },
            conversions: {
              $sum: { $cond: [{ $gt: ['$totalBookings', 0] }, 1, 0] }
            },
            totalValue: { $sum: '$totalValue' },
            totalBookings: { $sum: '$totalBookings' }
          }
        },
        {
          $addFields: {
            conversionRate: {
              $multiply: [
                { $divide: ['$conversions', '$referrals'] },
                100
              ]
            }
          }
        },
        { $sort: { '_id.year': -1, '_id.month': -1 } }
      ]);

      // Get top performing referrals
      const topPerformers = await Referral.getTopPerformers(affiliateId, 10);

      return {
        success: true,
        stats: {
          overview: basicStats[0] || {
            totalReferrals: 0,
            convertedReferrals: 0,
            totalBookings: 0,
            totalValue: 0,
            conversionRate: 0
          },
          sourceBreakdown,
          monthlyPerformance,
          topPerformers
        }
      };

    } catch (error) {
      logger.error('Error getting referral stats:', error);
      throw new ApiError('Failed to get referral statistics', 500, [], 'REFERRAL_STATS_ERROR');
    }
  }

  /**
   * Get customer referral history
   * @param {string} customerId - Customer ID
   * @returns {object} Customer referral history
   */
  static async getCustomerReferralHistory(customerId) {
    try {
      const referrals = await Referral.findByCustomer(customerId);
      
      const summary = {
        totalReferrals: referrals.length,
        totalBookings: referrals.reduce((sum, ref) => sum + ref.totalBookings, 0),
        totalValue: referrals.reduce((sum, ref) => sum + ref.totalValue, 0),
        activeReferrals: referrals.filter(ref => ref.status === 'active').length,
        convertedReferrals: referrals.filter(ref => ref.status === 'converted').length
      };

      return {
        success: true,
        referrals,
        summary
      };

    } catch (error) {
      logger.error('Error getting customer referral history:', error);
      throw new ApiError('Failed to get customer referral history', 500, [], 'CUSTOMER_REFERRAL_ERROR');
    }
  }

  /**
   * Get referrals by affiliate with pagination and filters
   * @param {string} affiliateId - Affiliate ID
   * @param {object} options - Query options
   * @returns {object} Paginated referrals
   */
  static async getReferralsByAffiliate(affiliateId, options = {}) {
    try {
      const {
        status,
        startDate,
        endDate,
        referralSource,
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = options;

      const skip = (page - 1) * limit;
      const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

      const query = { affiliateId: new mongoose.Types.ObjectId(affiliateId) };
      
      if (status) query.status = status;
      if (referralSource) query.referralSource = referralSource;
      
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }

      const [referrals, totalCount] = await Promise.all([
        Referral.find(query)
          .populate('customerId', 'firstName lastName email phoneNumber')
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        Referral.countDocuments(query)
      ]);

      const totalPages = Math.ceil(totalCount / limit);

      return {
        success: true,
        referrals,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      };

    } catch (error) {
      logger.error('Error getting referrals by affiliate:', error);
      throw new ApiError('Failed to get referrals', 500, [], 'GET_REFERRALS_ERROR');
    }
  }

  /**
   * Block a referral (for fraud prevention)
   * @param {string} referralId - Referral ID
   * @param {string} reason - Reason for blocking
   * @returns {object} Block result
   */
  static async blockReferral(referralId, reason) {
    try {
      const referral = await Referral.findById(referralId);
      
      if (!referral) {
        throw new ApiError('Referral not found', 404, [], 'REFERRAL_NOT_FOUND');
      }

      await referral.block(reason);

      logger.info(`Referral ${referralId} blocked: ${reason}`);

      return {
        success: true,
        message: 'Referral blocked successfully',
        referral
      };

    } catch (error) {
      logger.error('Error blocking referral:', error);
      
      if (error instanceof ApiError) {
        throw error;
      }
      
      throw new ApiError('Failed to block referral', 500, [], 'BLOCK_REFERRAL_ERROR');
    }
  }

  /**
   * Reactivate a blocked referral
   * @param {string} referralId - Referral ID
   * @returns {object} Reactivation result
   */
  static async reactivateReferral(referralId) {
    try {
      const referral = await Referral.findById(referralId);
      
      if (!referral) {
        throw new ApiError('Referral not found', 404, [], 'REFERRAL_NOT_FOUND');
      }

      await referral.reactivate();

      logger.info(`Referral ${referralId} reactivated`);

      return {
        success: true,
        message: 'Referral reactivated successfully',
        referral
      };

    } catch (error) {
      logger.error('Error reactivating referral:', error);
      
      if (error instanceof ApiError) {
        throw error;
      }
      
      throw new ApiError('Failed to reactivate referral', 500, [], 'REACTIVATE_REFERRAL_ERROR');
    }
  }

  /**
   * Determine referral source from request data
   * @private
   * @param {object} requestData - Request metadata
   * @returns {string} Referral source
   */
  static _determineReferralSource(requestData) {
    const { referrerUrl, utmParameters = {}, userAgent = '' } = requestData;
    
    // Check UTM parameters first
    if (utmParameters.utm_medium) {
      const medium = utmParameters.utm_medium.toLowerCase();
      if (medium.includes('qr')) return 'qr_code';
      if (medium.includes('email')) return 'email';
      if (medium.includes('social')) return 'social_media';
    }
    
    // Check referrer URL
    if (referrerUrl) {
      const url = referrerUrl.toLowerCase();
      if (url.includes('facebook') || url.includes('twitter') || url.includes('instagram')) {
        return 'social_media';
      }
      if (url.includes('gmail') || url.includes('yahoo') || url.includes('outlook')) {
        return 'email';
      }
    }
    
    // Check user agent for mobile apps (QR code scanning)
    if (userAgent.toLowerCase().includes('mobile')) {
      return 'qr_code';
    }
    
    return 'link';
  }
}

module.exports = ReferralTrackingService;