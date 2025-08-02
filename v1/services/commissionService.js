// v1/services/commissionService.js
const CommissionTransaction = require('../models/commissionTransactionModel');
const Affiliate = require('../models/affiliateModel');
const Referral = require('../models/referralModel');
const WalletService = require('./walletService');
const QRCodeService = require('./qrCodeService');
const AffiliateNotificationService = require('./affiliateNotificationService');
const mongoose = require('mongoose');
const { ApiError } = require('../utils/apiError');
const { CommissionError, AffiliateError } = require('../utils/affiliateErrors');
const errorRecovery = require('../utils/errorRecovery');
const errorMonitor = require('../utils/errorMonitoring');
const logger = require('../utils/logger');

/**
 * @description Service class for managing commission calculations and processing
 * Handles commission calculation, transaction recording, approval workflows, and dispute handling
 */
class CommissionService {
  /**
   * Calculate commission based on booking data and affiliate rates
   * @param {Object} bookingData - Booking information
   * @param {string} affiliateId - The affiliate ID
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Commission calculation result
   */
  async calculateCommission(bookingData, affiliateId, options = {}) {
    try {
      // Validate inputs
      if (!bookingData || !affiliateId) {
        throw CommissionError.calculationFailed('N/A', 'Booking data and affiliate ID are required');
      }

      const { serviceType, bookingAmount, currency = 'NGN' } = bookingData;

      if (!serviceType || bookingAmount === undefined || bookingAmount === null) {
        throw CommissionError.calculationFailed('N/A', 'Service type and booking amount are required');
      }

      if (bookingAmount <= 0) {
        throw CommissionError.calculationFailed('N/A', 'Booking amount must be positive');
      }

      // Validate service type
      const validServiceTypes = ['flight', 'hotel', 'insurance', 'visa'];
      if (!validServiceTypes.includes(serviceType)) {
        throw CommissionError.calculationFailed('N/A', `Invalid service type. Must be one of: ${validServiceTypes.join(', ')}`);
      }

      // Find affiliate and validate status
      const affiliate = await Affiliate.findById(affiliateId);
      if (!affiliate) {
        throw AffiliateError.notFound(affiliateId, { operation: 'commission_calculation' });
      }

      if (affiliate.status !== 'active') {
        throw new ApiError(`Cannot calculate commission for ${affiliate.status} affiliate`, 400);
      }

      // Get commission rate for service type (map service types to affiliate rate keys)
      const serviceTypeMapping = {
        flight: 'flights',
        hotel: 'hotels',
        insurance: 'insurance',
        visa: 'visa',
      };
      
      const rateKey = serviceTypeMapping[serviceType];
      const commissionRate = affiliate.commissionRates[rateKey] || 0;
      
      if (commissionRate <= 0) {
        throw new ApiError(`No commission rate configured for ${serviceType}`, 400);
      }

      // Calculate commission amount
      const commissionAmount = Math.round((bookingAmount * commissionRate / 100) * 100) / 100;

      const calculationResult = {
        affiliateId,
        serviceType,
        bookingAmount,
        commissionRate,
        commissionAmount,
        currency,
        affiliate: {
          id: affiliate._id,
          businessName: affiliate.businessName,
          affiliateId: affiliate.affiliateId,
        },
      };

      return {
        success: true,
        data: calculationResult,
        message: 'Commission calculated successfully',
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(`Failed to calculate commission: ${error.message}`, 500);
    }
  }

  /**
   * Process commission for a booking and create transaction record
   * @param {string} bookingReference - Booking reference
   * @param {string} affiliateId - The affiliate ID
   * @param {Object} bookingData - Booking information
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Commission processing result
   */
  async processCommission(bookingReference, affiliateId, bookingData, options = {}) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Validate inputs
      if (!bookingReference || !affiliateId || !bookingData) {
        throw new ApiError('Booking reference, affiliate ID, and booking data are required', 400);
      }

      // Check for duplicate commission processing
      const existingCommission = await CommissionTransaction.findOne({ 
        bookingReference 
      }).session(session);
      
      if (existingCommission) {
        throw new ApiError('Commission already processed for this booking', 400);
      }

      // Find referral record
      const referral = await Referral.findOne({ 
        affiliateId,
        customerId: bookingData.customerId 
      }).session(session);
      
      if (!referral) {
        throw new ApiError('Referral record not found', 404);
      }

      // Calculate commission
      const calculationResult = await this.calculateCommission(bookingData, affiliateId);
      const commissionData = calculationResult.data;

      // Create commission transaction
      const transactionData = {
        affiliateId,
        referralId: referral._id,
        bookingReference,
        serviceType: commissionData.serviceType,
        bookingAmount: commissionData.bookingAmount,
        commissionRate: commissionData.commissionRate,
        commissionAmount: commissionData.commissionAmount,
        currency: commissionData.currency,
        status: options.autoApprove ? 'approved' : 'pending',
        notes: options.notes,
      };

      const commission = new CommissionTransaction(transactionData);
      await commission.save({ session });

      // Generate QR code for commission transaction
      try {
        const qrCodeResult = await QRCodeService.generateCommissionQR({
          commissionId: commission._id,
          affiliateId,
          bookingReference,
          commissionAmount: commissionData.commissionAmount,
          serviceType: commissionData.serviceType,
        });

        if (qrCodeResult.success) {
          commission.qrCode = qrCodeResult.data.qrCode;
          await commission.save({ session });
        }
      } catch (qrError) {
        // QR code generation failure shouldn't fail the entire process
        console.warn('QR code generation failed:', qrError.message);
      }

      // If auto-approved, credit wallet immediately
      if (options.autoApprove) {
        try {
          await WalletService.creditWallet(
            affiliateId,
            commissionData.commissionAmount,
            `COMM_${commission._id}`,
            {
              type: 'commission_credit',
              description: `Commission for ${commissionData.serviceType} booking ${bookingReference}`,
              relatedId: commission._id,
              relatedModel: 'CommissionTransaction',
              processedBy: options.processedBy,
            }
          );

          commission.status = 'paid';
          commission.processedAt = new Date();
          await commission.save({ session });
        } catch (walletError) {
          // If wallet credit fails, keep commission as approved but not paid
          console.warn('Wallet credit failed:', walletError.message);
        }
      }

      // Update affiliate statistics
      const affiliate = await Affiliate.findById(affiliateId).session(session);
      await affiliate.addCommissionEarnings(commissionData.commissionAmount);

      // Update referral statistics
      referral.totalValue = (referral.totalValue || 0) + commissionData.bookingAmount;
      referral.totalBookings = (referral.totalBookings || 0) + 1;
      if (!referral.firstBookingAt) {
        referral.firstBookingAt = new Date();
        referral.status = 'converted';
      }
      await referral.save({ session });

      await session.commitTransaction();

      return {
        success: true,
        data: {
          commission: commission.getSummary(),
          calculation: commissionData,
          referral: {
            id: referral._id,
            totalBookings: referral.totalBookings,
            totalValue: referral.totalValue,
          },
        },
        message: 'Commission processed successfully',
      };
    } catch (error) {
      await session.abortTransaction();
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(`Failed to process commission: ${error.message}`, 500);
    } finally {
      session.endSession();
    }
  }

  /**
   * Get commission history for an affiliate with filtering and pagination
   * @param {string} affiliateId - The affiliate ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Commission history
   */
  async getCommissionHistory(affiliateId, filters = {}) {
    try {
      if (!affiliateId) {
        throw new ApiError('Affiliate ID is required', 400);
      }

      // Validate affiliate exists
      const affiliate = await Affiliate.findById(affiliateId);
      if (!affiliate) {
        throw new ApiError('Affiliate not found', 404);
      }

      const {
        status,
        serviceType,
        startDate,
        endDate,
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = filters;

      const options = {
        status,
        serviceType,
        startDate,
        endDate,
        limit: parseInt(limit),
        skip: (parseInt(page) - 1) * parseInt(limit),
      };

      // Get commission transactions
      const commissions = await CommissionTransaction.findByAffiliate(affiliateId, options);

      // Get total count for pagination
      const countQuery = CommissionTransaction.find({ affiliateId });
      if (status) countQuery.where('status', status);
      if (serviceType) countQuery.where('serviceType', serviceType);
      if (startDate) countQuery.where('createdAt').gte(new Date(startDate));
      if (endDate) countQuery.where('createdAt').lte(new Date(endDate));
      
      const totalCount = await countQuery.countDocuments();
      const totalPages = Math.ceil(totalCount / parseInt(limit));

      return {
        success: true,
        data: {
          commissions: commissions.map(c => ({
            ...c,
            affiliate: c.affiliateId,
          })),
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalCount,
            hasNextPage: parseInt(page) < totalPages,
            hasPrevPage: parseInt(page) > 1,
            limit: parseInt(limit),
          },
          summary: {
            totalCommissions: commissions.length,
            totalAmount: commissions.reduce((sum, c) => sum + c.commissionAmount, 0),
          },
        },
        message: 'Commission history retrieved successfully',
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(`Failed to get commission history: ${error.message}`, 500);
    }
  }

  /**
   * Approve a commission transaction
   * @param {string} commissionId - The commission transaction ID
   * @param {string} adminId - ID of admin approving the commission
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Approval result
   */
  async approveCommission(commissionId, adminId, options = {}) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      if (!commissionId || !adminId) {
        throw new ApiError('Commission ID and admin ID are required', 400);
      }

      // Find commission transaction
      const commission = await CommissionTransaction.findById(commissionId).session(session);
      if (!commission) {
        throw new ApiError('Commission transaction not found', 404);
      }

      if (commission.status !== 'pending') {
        throw new ApiError(`Cannot approve ${commission.status} commission`, 400);
      }

      // Approve commission
      await commission.approve(adminId, options.notes);

      // Credit affiliate wallet if auto-pay is enabled
      if (options.autoPay !== false) {
        try {
          await WalletService.creditWallet(
            commission.affiliateId,
            commission.commissionAmount,
            `COMM_${commission._id}`,
            {
              type: 'commission_credit',
              description: `Commission for ${commission.serviceType} booking ${commission.bookingReference}`,
              relatedId: commission._id,
              relatedModel: 'CommissionTransaction',
              processedBy: adminId,
            }
          );

          commission.status = 'paid';
          commission.processedAt = new Date();
          await commission.save({ session });
        } catch (walletError) {
          // If wallet credit fails, keep commission as approved but not paid
          console.warn('Wallet credit failed during approval:', walletError.message);
        }
      }

      await session.commitTransaction();

      // Send notification after successful approval
      try {
        const affiliate = await Affiliate.findById(commission.affiliateId);
        if (affiliate) {
          await AffiliateNotificationService.sendCommissionEarnedNotification(commission, affiliate);
        }
      } catch (notificationError) {
        // Log notification error but don't fail the commission approval
        console.warn('Failed to send commission notification:', notificationError.message);
      }

      return {
        success: true,
        data: commission.getSummary(),
        message: 'Commission approved successfully',
      };
    } catch (error) {
      await session.abortTransaction();
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(`Failed to approve commission: ${error.message}`, 500);
    } finally {
      session.endSession();
    }
  }

  /**
   * Dispute a commission transaction
   * @param {string} commissionId - The commission transaction ID
   * @param {string} reason - Reason for dispute
   * @param {string} disputedBy - ID of user disputing the commission
   * @returns {Promise<Object>} Dispute result
   */
  async disputeCommission(commissionId, reason, disputedBy) {
    try {
      if (!commissionId || !reason || !disputedBy) {
        throw new ApiError('Commission ID, reason, and disputed by are required', 400);
      }

      // Find commission transaction
      const commission = await CommissionTransaction.findById(commissionId);
      if (!commission) {
        throw new ApiError('Commission transaction not found', 404);
      }

      if (commission.status === 'disputed') {
        throw new ApiError('Commission is already disputed', 400);
      }

      if (commission.status === 'cancelled') {
        throw new ApiError('Cannot dispute cancelled commission', 400);
      }

      // If commission was already paid, we need to reverse the wallet credit
      if (commission.status === 'paid') {
        try {
          await WalletService.debitWallet(
            commission.affiliateId,
            commission.commissionAmount,
            `DISP_${commission._id}`,
            {
              type: 'dispute_debit',
              description: `Dispute reversal for ${commission.serviceType} booking ${commission.bookingReference}`,
              relatedId: commission._id,
              relatedModel: 'CommissionTransaction',
              processedBy: disputedBy,
            }
          );
        } catch (walletError) {
          throw new ApiError(`Failed to reverse wallet credit: ${walletError.message}`, 500);
        }
      }

      // Dispute commission
      await commission.dispute(reason, disputedBy);

      return {
        success: true,
        data: commission.getSummary(),
        message: 'Commission disputed successfully',
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(`Failed to dispute commission: ${error.message}`, 500);
    }
  }

  /**
   * Cancel a commission transaction
   * @param {string} commissionId - The commission transaction ID
   * @param {string} reason - Reason for cancellation
   * @param {string} cancelledBy - ID of user cancelling the commission
   * @returns {Promise<Object>} Cancellation result
   */
  async cancelCommission(commissionId, reason, cancelledBy) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      if (!commissionId || !reason || !cancelledBy) {
        throw new ApiError('Commission ID, reason, and cancelled by are required', 400);
      }

      // Find commission transaction
      const commission = await CommissionTransaction.findById(commissionId).session(session);
      if (!commission) {
        throw new ApiError('Commission transaction not found', 404);
      }

      if (commission.status === 'cancelled') {
        throw new ApiError('Commission is already cancelled', 400);
      }

      // If commission was already paid, we need to reverse the wallet credit
      if (commission.status === 'paid') {
        try {
          await WalletService.debitWallet(
            commission.affiliateId,
            commission.commissionAmount,
            `CANC_${commission._id}`,
            {
              type: 'cancellation_debit',
              description: `Cancellation reversal for ${commission.serviceType} booking ${commission.bookingReference}`,
              relatedId: commission._id,
              relatedModel: 'CommissionTransaction',
              processedBy: cancelledBy,
            }
          );
        } catch (walletError) {
          throw new ApiError(`Failed to reverse wallet credit: ${walletError.message}`, 500);
        }
      }

      // Cancel commission
      await commission.cancel(reason, cancelledBy);

      // Update affiliate statistics (subtract the commission)
      const affiliate = await Affiliate.findById(commission.affiliateId).session(session);
      affiliate.totalCommissionsEarned = Math.max(0, affiliate.totalCommissionsEarned - commission.commissionAmount);
      await affiliate.save({ session });

      await session.commitTransaction();

      return {
        success: true,
        data: commission.getSummary(),
        message: 'Commission cancelled successfully',
      };
    } catch (error) {
      await session.abortTransaction();
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(`Failed to cancel commission: ${error.message}`, 500);
    } finally {
      session.endSession();
    }
  }

  /**
   * Resolve a disputed commission
   * @param {string} commissionId - The commission transaction ID
   * @param {string} resolution - Resolution action ('approve', 'cancel')
   * @param {string} resolvedBy - ID of user resolving the dispute
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Resolution result
   */
  async resolveDispute(commissionId, resolution, resolvedBy, options = {}) {
    try {
      if (!commissionId || !resolution || !resolvedBy) {
        throw new ApiError('Commission ID, resolution, and resolved by are required', 400);
      }

      if (!['approve', 'cancel'].includes(resolution)) {
        throw new ApiError('Resolution must be either "approve" or "cancel"', 400);
      }

      // Find commission transaction
      const commission = await CommissionTransaction.findById(commissionId);
      if (!commission) {
        throw new ApiError('Commission transaction not found', 404);
      }

      if (commission.status !== 'disputed') {
        throw new ApiError('Commission is not disputed', 400);
      }

      let result;
      if (resolution === 'approve') {
        result = await this.approveCommission(commissionId, resolvedBy, {
          notes: `Dispute resolved - approved. ${options.notes || ''}`,
          autoPay: options.autoPay,
        });
      } else {
        result = await this.cancelCommission(commissionId, `Dispute resolved - cancelled. ${options.notes || ''}`, resolvedBy);
      }

      return {
        success: true,
        data: result.data,
        message: `Dispute resolved - commission ${resolution}d successfully`,
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(`Failed to resolve dispute: ${error.message}`, 500);
    }
  }

  /**
   * Get commission statistics for an affiliate
   * @param {string} affiliateId - The affiliate ID
   * @param {Object} dateRange - Date range for statistics
   * @returns {Promise<Object>} Commission statistics
   */
  async getCommissionStatistics(affiliateId, dateRange = {}) {
    try {
      if (!affiliateId) {
        throw new ApiError('Affiliate ID is required', 400);
      }

      // Validate affiliate exists
      const affiliate = await Affiliate.findById(affiliateId);
      if (!affiliate) {
        throw new ApiError('Affiliate not found', 404);
      }

      const stats = await CommissionTransaction.getCommissionStats(affiliateId, dateRange);
      const systemStats = await CommissionTransaction.getSystemStats(dateRange);

      const affiliateStats = stats[0] || {
        totalCommissions: 0,
        totalTransactions: 0,
        pendingCommissions: 0,
        approvedCommissions: 0,
        paidCommissions: 0,
        averageCommission: 0,
        serviceTypeBreakdown: [],
      };

      // Process service type breakdown
      const serviceBreakdown = {};
      affiliateStats.serviceTypeBreakdown.forEach(item => {
        if (!serviceBreakdown[item.serviceType]) {
          serviceBreakdown[item.serviceType] = {
            totalAmount: 0,
            totalCount: 0,
            pending: 0,
            approved: 0,
            paid: 0,
            disputed: 0,
            cancelled: 0,
          };
        }
        serviceBreakdown[item.serviceType].totalAmount += item.commissionAmount;
        serviceBreakdown[item.serviceType].totalCount += 1;
        serviceBreakdown[item.serviceType][item.status] += item.commissionAmount;
      });

      return {
        success: true,
        data: {
          affiliate: {
            id: affiliate._id,
            businessName: affiliate.businessName,
            affiliateId: affiliate.affiliateId,
          },
          statistics: {
            ...affiliateStats,
            serviceTypeBreakdown: serviceBreakdown,
            conversionRate: affiliate.totalReferrals > 0 
              ? ((affiliateStats.totalTransactions / affiliate.totalReferrals) * 100).toFixed(2)
              : 0,
          },
          systemComparison: systemStats[0] || {},
        },
        message: 'Commission statistics retrieved successfully',
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(`Failed to get commission statistics: ${error.message}`, 500);
    }
  }

  /**
   * Update commission rates for an affiliate
   * @param {string} affiliateId - The affiliate ID
   * @param {Object} rates - New commission rates
   * @param {string} updatedBy - ID of user updating the rates
   * @returns {Promise<Object>} Update result
   */
  async updateCommissionRates(affiliateId, rates, updatedBy) {
    try {
      if (!affiliateId || !rates || !updatedBy) {
        throw new ApiError('Affiliate ID, rates, and updated by are required', 400);
      }

      // Validate rates
      const validServiceTypes = ['flights', 'hotels', 'insurance', 'visa'];
      const invalidTypes = Object.keys(rates).filter(type => !validServiceTypes.includes(type));
      
      if (invalidTypes.length > 0) {
        throw new ApiError(`Invalid service types: ${invalidTypes.join(', ')}`, 400);
      }

      // Validate rate values
      Object.entries(rates).forEach(([type, rate]) => {
        if (typeof rate !== 'number' || rate < 0 || rate > 100) {
          throw new ApiError(`Invalid rate for ${type}: must be between 0 and 100`, 400);
        }
      });

      // Find affiliate
      const affiliate = await Affiliate.findById(affiliateId);
      if (!affiliate) {
        throw new ApiError('Affiliate not found', 404);
      }

      // Store old rates for audit
      const oldRates = { ...affiliate.commissionRates };

      // Update rates
      await affiliate.updateCommissionRates(rates);

      return {
        success: true,
        data: {
          affiliate: {
            id: affiliate._id,
            businessName: affiliate.businessName,
            affiliateId: affiliate.affiliateId,
          },
          oldRates,
          newRates: affiliate.commissionRates,
          updatedBy,
          updatedAt: new Date(),
        },
        message: 'Commission rates updated successfully',
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(`Failed to update commission rates: ${error.message}`, 500);
    }
  }

  /**
   * Get pending commissions for admin review
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Pending commissions
   */
  async getPendingCommissions(filters = {}) {
    try {
      const {
        serviceType,
        affiliateId,
        startDate,
        endDate,
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = filters;

      const options = {
        serviceType,
        startDate,
        endDate,
        limit: parseInt(limit),
        skip: (parseInt(page) - 1) * parseInt(limit),
      };

      // Get pending commissions
      const commissions = await CommissionTransaction.findByStatus('pending', options);

      // Filter by affiliate if specified
      let filteredCommissions = commissions;
      if (affiliateId) {
        filteredCommissions = commissions.filter(c => 
          c.affiliateId.toString() === affiliateId
        );
      }

      // Get total count
      const countQuery = CommissionTransaction.find({ status: 'pending' });
      if (serviceType) countQuery.where('serviceType', serviceType);
      if (affiliateId) countQuery.where('affiliateId', affiliateId);
      if (startDate) countQuery.where('createdAt').gte(new Date(startDate));
      if (endDate) countQuery.where('createdAt').lte(new Date(endDate));
      
      const totalCount = await countQuery.countDocuments();
      const totalPages = Math.ceil(totalCount / parseInt(limit));

      return {
        success: true,
        data: {
          commissions: filteredCommissions,
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalCount,
            hasNextPage: parseInt(page) < totalPages,
            hasPrevPage: parseInt(page) > 1,
            limit: parseInt(limit),
          },
          summary: {
            totalPending: filteredCommissions.length,
            totalAmount: filteredCommissions.reduce((sum, c) => sum + c.commissionAmount, 0),
          },
        },
        message: 'Pending commissions retrieved successfully',
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(`Failed to get pending commissions: ${error.message}`, 500);
    }
  }

  /**
   * Bulk approve commissions
   * @param {Array} commissionIds - Array of commission IDs to approve
   * @param {string} adminId - ID of admin approving the commissions
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Bulk approval result
   */
  async bulkApproveCommissions(commissionIds, adminId, options = {}) {
    try {
      if (!commissionIds || !Array.isArray(commissionIds) || commissionIds.length === 0) {
        throw new ApiError('Commission IDs array is required', 400);
      }

      if (!adminId) {
        throw new ApiError('Admin ID is required', 400);
      }

      const results = {
        successful: [],
        failed: [],
      };

      // Process each commission
      for (const commissionId of commissionIds) {
        try {
          const result = await this.approveCommission(commissionId, adminId, {
            notes: options.notes,
            autoPay: options.autoPay,
          });
          results.successful.push({
            commissionId,
            data: result.data,
          });
        } catch (error) {
          results.failed.push({
            commissionId,
            error: error.message,
          });
        }
      }

      return {
        success: true,
        data: results,
        message: `Bulk approval completed. ${results.successful.length} successful, ${results.failed.length} failed`,
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(`Failed to bulk approve commissions: ${error.message}`, 500);
    }
  }

  /**
   * Get system-wide commission statistics
   * @param {Object} dateRange - Date range for statistics
   * @returns {Promise<Object>} System commission statistics
   */
  async getSystemCommissionStatistics(dateRange = {}) {
    try {
      const stats = await CommissionTransaction.getSystemStats(dateRange);
      const systemStats = stats[0] || {
        totalCommissions: 0,
        totalTransactions: 0,
        totalBookingValue: 0,
        averageCommissionRate: 0,
        statusBreakdown: [],
        serviceTypeBreakdown: [],
      };

      // Process status breakdown
      const statusBreakdown = {};
      systemStats.statusBreakdown.forEach(item => {
        if (!statusBreakdown[item.status]) {
          statusBreakdown[item.status] = { count: 0, amount: 0 };
        }
        statusBreakdown[item.status].count += item.count;
        statusBreakdown[item.status].amount += item.amount;
      });

      // Process service type breakdown
      const serviceBreakdown = {};
      systemStats.serviceTypeBreakdown.forEach(item => {
        if (!serviceBreakdown[item.serviceType]) {
          serviceBreakdown[item.serviceType] = { count: 0, amount: 0 };
        }
        serviceBreakdown[item.serviceType].count += item.count;
        serviceBreakdown[item.serviceType].amount += item.amount;
      });

      return {
        success: true,
        data: {
          ...systemStats,
          statusBreakdown,
          serviceTypeBreakdown: serviceBreakdown,
          averageTransactionValue: systemStats.totalTransactions > 0 
            ? (systemStats.totalBookingValue / systemStats.totalTransactions).toFixed(2)
            : 0,
          commissionPercentage: systemStats.totalBookingValue > 0
            ? ((systemStats.totalCommissions / systemStats.totalBookingValue) * 100).toFixed(2)
            : 0,
        },
        message: 'System commission statistics retrieved successfully',
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(`Failed to get system commission statistics: ${error.message}`, 500);
    }
  }
}

module.exports = new CommissionService();