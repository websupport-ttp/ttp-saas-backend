// v1/services/bookingIntegrationService.js
const ReferralTrackingService = require('./referralTrackingService');
const CommissionService = require('./commissionService');
const QRCodeService = require('./qrCodeService');
const Ledger = require('../models/ledgerModel');
const VisaApplication = require('../models/visaApplicationModel');
const logger = require('../utils/logger');
const { ApiError } = require('../utils/apiError');

/**
 * @description Service for integrating booking processes with affiliate marketing system
 * Handles referral tracking, commission processing, and QR code generation for bookings
 */
class BookingIntegrationService {
  /**
   * Process referral tracking for a booking
   * @param {Object} bookingData - Booking information
   * @param {Object} customerData - Customer information
   * @param {Object} requestData - Request metadata
   * @returns {Promise<Object>} Referral tracking result
   */
  static async processReferralTracking(bookingData, customerData, requestData = {}) {
    try {
      const { referralCode } = bookingData;
      
      if (!referralCode) {
        return {
          success: true,
          tracked: false,
          message: 'No referral code provided'
        };
      }

      // Track the referral
      const trackingResult = await ReferralTrackingService.trackReferral(
        referralCode,
        customerData,
        requestData
      );

      if (trackingResult.success) {
        logger.info(`Referral tracking successful for code ${referralCode}`);
        return {
          success: true,
          tracked: true,
          referral: trackingResult.referral,
          affiliate: trackingResult.affiliate,
          isNew: trackingResult.isNew,
          message: trackingResult.message
        };
      } else {
        logger.warn(`Referral tracking failed for code ${referralCode}: ${trackingResult.message}`);
        return {
          success: false,
          tracked: false,
          error: trackingResult.message
        };
      }

    } catch (error) {
      logger.error('Error in referral tracking:', error);
      return {
        success: false,
        tracked: false,
        error: error.message
      };
    }
  }

  /**
   * Process commission for a completed booking
   * @param {Object} bookingData - Booking information
   * @param {string} customerId - Customer ID
   * @returns {Promise<Object>} Commission processing result
   */
  static async processCommission(bookingData, customerId) {
    try {
      const {
        bookingReference,
        serviceType,
        bookingAmount,
        currency = 'NGN',
        referralCode
      } = bookingData;

      if (!referralCode) {
        return {
          success: true,
          processed: false,
          message: 'No referral code associated with booking'
        };
      }

      // Validate referral code and get affiliate
      const validation = await ReferralTrackingService.validateReferralCode(referralCode, customerId);
      
      if (!validation.valid) {
        logger.warn(`Invalid referral code ${referralCode} for commission processing`);
        return {
          success: false,
          processed: false,
          error: validation.error
        };
      }

      // Process commission
      const commissionResult = await CommissionService.processCommission(
        bookingReference,
        validation.affiliate._id,
        {
          serviceType,
          bookingAmount,
          currency,
          customerId
        },
        {
          autoApprove: true, // Auto-approve commissions for now
          notes: `Commission for ${serviceType} booking ${bookingReference}`
        }
      );

      if (commissionResult.success) {
        logger.info(`Commission processed for booking ${bookingReference}`);
        return {
          success: true,
          processed: true,
          commission: commissionResult.data.commission,
          affiliate: validation.affiliate,
          message: 'Commission processed successfully'
        };
      } else {
        logger.error(`Commission processing failed for booking ${bookingReference}`);
        return {
          success: false,
          processed: false,
          error: 'Commission processing failed'
        };
      }

    } catch (error) {
      logger.error('Error in commission processing:', error);
      return {
        success: false,
        processed: false,
        error: error.message
      };
    }
  }

  /**
   * Generate QR code for booking transaction with referral
   * @param {Object} bookingData - Booking information
   * @param {Object} referralInfo - Referral information
   * @returns {Promise<Object>} QR code generation result
   */
  static async generateBookingQRCode(bookingData, referralInfo) {
    try {
      const {
        bookingReference,
        serviceType,
        bookingAmount,
        currency = 'NGN'
      } = bookingData;

      if (!referralInfo || !referralInfo.tracked) {
        return {
          success: true,
          generated: false,
          message: 'No referral information for QR code generation'
        };
      }

      const qrCodeData = {
        bookingReference,
        serviceType,
        bookingAmount,
        currency,
        affiliateId: referralInfo.affiliate?.id,
        businessName: referralInfo.affiliate?.businessName,
        referralCode: bookingData.referralCode,
        timestamp: new Date()
      };

      const qrResult = await QRCodeService.generateReferralQR(qrCodeData);

      if (qrResult.success) {
        logger.info(`QR code generated for booking ${bookingReference}`);
        return {
          success: true,
          generated: true,
          qrCode: qrResult.data.qrCode,
          message: 'QR code generated successfully'
        };
      } else {
        logger.warn(`QR code generation failed for booking ${bookingReference}`);
        return {
          success: false,
          generated: false,
          error: qrResult.error
        };
      }

    } catch (error) {
      logger.error('Error in QR code generation:', error);
      return {
        success: false,
        generated: false,
        error: error.message
      };
    }
  }

  /**
   * Complete booking integration process
   * @param {Object} bookingData - Booking information
   * @param {Object} customerData - Customer information
   * @param {Object} requestData - Request metadata
   * @returns {Promise<Object>} Complete integration result
   */
  static async completeBookingIntegration(bookingData, customerData, requestData = {}) {
    try {
      const results = {
        referralTracking: null,
        commissionProcessing: null,
        qrCodeGeneration: null
      };

      // Step 1: Process referral tracking
      results.referralTracking = await this.processReferralTracking(
        bookingData,
        customerData,
        requestData
      );

      // Step 2: Process commission if referral was tracked
      if (results.referralTracking.tracked && customerData.customerId) {
        results.commissionProcessing = await this.processCommission(
          bookingData,
          customerData.customerId
        );
      }

      // Step 3: Generate QR code if referral was tracked
      if (results.referralTracking.tracked) {
        results.qrCodeGeneration = await this.generateBookingQRCode(
          bookingData,
          results.referralTracking
        );
      }

      return {
        success: true,
        results,
        message: 'Booking integration completed'
      };

    } catch (error) {
      logger.error('Error in complete booking integration:', error);
      throw new ApiError(`Booking integration failed: ${error.message}`, 500);
    }
  }

  /**
   * Process booking completion for payment verification
   * @param {string} transactionReference - Transaction reference
   * @returns {Promise<Object>} Booking completion result
   */
  static async processBookingCompletion(transactionReference) {
    try {
      // Find the ledger entry
      const ledgerEntry = await Ledger.findOne({ transactionReference });
      
      if (!ledgerEntry) {
        throw new ApiError('Transaction not found', 404);
      }

      // Skip if no referral code
      if (!ledgerEntry.referralCode) {
        return {
          success: true,
          processed: false,
          message: 'No referral code associated with transaction'
        };
      }

      // Determine customer ID
      let customerId = ledgerEntry.userId;
      
      // For guest bookings, we need to find or create a customer record
      if (!customerId && ledgerEntry.guestEmail) {
        // For now, we'll use the guest email as identifier
        // In a real implementation, you might want to create a customer record
        customerId = ledgerEntry.guestEmail;
      }

      if (!customerId) {
        throw new ApiError('Customer identification failed', 400);
      }

      // Map product type to service type
      const serviceTypeMapping = {
        'Flight Booking': 'flight',
        'Hotel Reservation': 'hotel',
        'Travel Insurance': 'insurance',
        'Visa Processing': 'visa',
        'Package': 'package'
      };

      const serviceType = serviceTypeMapping[ledgerEntry.productType] || 'unknown';

      const bookingData = {
        bookingReference: transactionReference,
        serviceType,
        bookingAmount: ledgerEntry.amount,
        currency: ledgerEntry.currency,
        referralCode: ledgerEntry.referralCode
      };

      const customerData = {
        customerId,
        customerEmail: ledgerEntry.guestEmail || null
      };

      // Process commission
      const commissionResult = await this.processCommission(bookingData, customerId);

      // Generate QR code for the transaction
      let qrCodeResult = null;
      if (commissionResult.processed) {
        qrCodeResult = await this.generateBookingQRCode(bookingData, {
          tracked: true,
          affiliate: commissionResult.affiliate
        });
      }

      return {
        success: true,
        processed: commissionResult.processed,
        commission: commissionResult.commission,
        qrCode: qrCodeResult?.qrCode,
        message: 'Booking completion processed successfully'
      };

    } catch (error) {
      logger.error('Error in booking completion processing:', error);
      throw new ApiError(`Booking completion failed: ${error.message}`, 500);
    }
  }

  /**
   * Enhance booking confirmation with referral information
   * @param {Object} bookingConfirmation - Original booking confirmation
   * @param {Object} integrationResults - Integration results
   * @returns {Object} Enhanced booking confirmation
   */
  static enhanceBookingConfirmation(bookingConfirmation, integrationResults) {
    try {
      const enhanced = { ...bookingConfirmation };

      if (integrationResults.results?.referralTracking?.tracked) {
        const referralInfo = integrationResults.results.referralTracking;
        
        enhanced.referralInfo = {
          tracked: true,
          affiliateBusinessName: referralInfo.affiliate?.businessName,
          referralCode: bookingConfirmation.referralCode,
          isNewReferral: referralInfo.isNew
        };

        // Add commission information if processed
        if (integrationResults.results?.commissionProcessing?.processed) {
          const commission = integrationResults.results.commissionProcessing.commission;
          enhanced.referralInfo.commissionGenerated = {
            amount: commission.commissionAmount,
            rate: commission.commissionRate,
            status: commission.status
          };
        }

        // Add QR code if generated
        if (integrationResults.results?.qrCodeGeneration?.generated) {
          enhanced.referralInfo.qrCode = integrationResults.results.qrCodeGeneration.qrCode;
        }
      }

      return enhanced;

    } catch (error) {
      logger.error('Error enhancing booking confirmation:', error);
      return bookingConfirmation; // Return original if enhancement fails
    }
  }

  /**
   * Get booking referral statistics
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Booking referral statistics
   */
  static async getBookingReferralStats(filters = {}) {
    try {
      const {
        startDate,
        endDate,
        serviceType,
        affiliateId
      } = filters;

      const matchStage = {
        referralCode: { $exists: true, $ne: null },
        status: 'Completed'
      };

      if (startDate) matchStage.createdAt = { $gte: new Date(startDate) };
      if (endDate) matchStage.createdAt = { ...matchStage.createdAt, $lte: new Date(endDate) };
      if (serviceType) {
        const productTypeMapping = {
          'flight': 'Flight Booking',
          'hotel': 'Hotel Reservation',
          'insurance': 'Travel Insurance',
          'visa': 'Visa Processing',
          'package': 'Package'
        };
        matchStage.productType = productTypeMapping[serviceType];
      }

      const stats = await Ledger.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalBookings: { $sum: 1 },
            totalValue: { $sum: '$amount' },
            totalCommissionValue: { $sum: '$markupApplied' },
            serviceTypeBreakdown: {
              $push: {
                productType: '$productType',
                amount: '$amount',
                referralCode: '$referralCode'
              }
            }
          }
        }
      ]);

      const serviceBreakdown = await Ledger.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$productType',
            count: { $sum: 1 },
            totalValue: { $sum: '$amount' }
          }
        },
        { $sort: { totalValue: -1 } }
      ]);

      return {
        success: true,
        data: {
          overview: stats[0] || {
            totalBookings: 0,
            totalValue: 0,
            totalCommissionValue: 0
          },
          serviceBreakdown
        },
        message: 'Booking referral statistics retrieved successfully'
      };

    } catch (error) {
      logger.error('Error getting booking referral stats:', error);
      throw new ApiError(`Failed to get booking referral statistics: ${error.message}`, 500);
    }
  }
}

module.exports = BookingIntegrationService;