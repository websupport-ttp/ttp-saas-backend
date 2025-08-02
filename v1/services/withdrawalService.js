// v1/services/withdrawalService.js
const Withdrawal = require('../models/withdrawalModel');
const Wallet = require('../models/walletModel');
const Affiliate = require('../models/affiliateModel');
const WalletService = require('./walletService');
const QRCodeService = require('./qrCodeService');
const paystackService = require('./paystackService');
const AffiliateNotificationService = require('./affiliateNotificationService');
const logger = require('../utils/logger');
const { ApiError } = require('../utils/apiError');
const { WithdrawalError, AffiliateError, WalletError } = require('../utils/affiliateErrors');
const errorRecovery = require('../utils/errorRecovery');
const errorMonitor = require('../utils/errorMonitoring');
const { StatusCodes } = require('http-status-codes');

/**
 * @class WithdrawalService
 * @description Service for handling affiliate withdrawal requests and processing
 */
class WithdrawalService {
  /**
   * @method requestWithdrawal
   * @description Create a new withdrawal request
   * @param {string} affiliateId - Affiliate ID
   * @param {number} amount - Withdrawal amount
   * @param {object} bankDetails - Bank account details
   * @param {object} options - Additional options
   * @returns {Promise<object>} Created withdrawal request
   */
  static async requestWithdrawal(affiliateId, amount, bankDetails, options = {}) {
    try {
      // Validate input parameters
      if (!affiliateId || !amount || !bankDetails) {
        throw new WithdrawalError('Missing required parameters: affiliateId, amount, and bankDetails are required', StatusCodes.BAD_REQUEST);
      }

      // Validate amount
      if (amount <= 0) {
        throw new WithdrawalError('Withdrawal amount must be greater than 0', StatusCodes.BAD_REQUEST, [], {
          amount,
          operation: 'amount_validation'
        });
      }

      // Validate bank details
      const validationResult = await this.validateBankDetails(bankDetails);
      if (!validationResult.valid) {
        throw WithdrawalError.bankDetailsValidation(validationResult.errors, {
          bankDetails: this.sanitizeBankDetails(bankDetails)
        });
      }

      // Check affiliate exists and is active
      const affiliate = await Affiliate.findById(affiliateId);
      if (!affiliate) {
        throw AffiliateError.notFound(affiliateId, { operation: 'withdrawal_request' });
      }

      if (affiliate.status !== 'active') {
        throw new ApiError('Affiliate account is not active', StatusCodes.FORBIDDEN);
      }

      // Get affiliate's wallet
      const wallet = await Wallet.findOne({ affiliateId });
      if (!wallet) {
        throw new ApiError('Wallet not found for affiliate', StatusCodes.NOT_FOUND);
      }

      // Check wallet status
      if (wallet.status !== 'active') {
        throw new ApiError('Wallet is not active', StatusCodes.FORBIDDEN);
      }

      // Validate withdrawal eligibility
      const withdrawalCheck = wallet.canWithdraw(amount);
      if (!withdrawalCheck.allowed) {
        throw new ApiError(`Withdrawal not allowed: ${withdrawalCheck.reason}`, StatusCodes.BAD_REQUEST);
      }

      // Check for pending withdrawals
      const pendingWithdrawals = await Withdrawal.find({
        affiliateId,
        status: { $in: ['pending', 'processing'] }
      });

      if (pendingWithdrawals.length > 0) {
        throw new ApiError('You have pending withdrawal requests. Please wait for them to complete before requesting a new withdrawal.', StatusCodes.CONFLICT);
      }

      // Calculate processing fee
      const processingFeeRate = options.processingFeeRate || 0.015; // 1.5%
      const minFee = options.minFee || 50;
      const maxFee = options.maxFee || 2000;

      let processingFee = amount * processingFeeRate;
      processingFee = Math.max(processingFee, minFee);
      processingFee = Math.min(processingFee, maxFee);
      processingFee = Math.round(processingFee * 100) / 100;

      const netAmount = amount - processingFee;

      if (netAmount <= 0) {
        throw new ApiError('Net withdrawal amount after fees must be greater than 0', StatusCodes.BAD_REQUEST);
      }

      // Create withdrawal record
      const withdrawal = new Withdrawal({
        affiliateId,
        walletId: wallet._id,
        amount,
        processingFee,
        netAmount,
        currency: options.currency || 'NGN',
        bankDetails: {
          accountName: bankDetails.accountName.trim(),
          accountNumber: bankDetails.accountNumber.trim(),
          bankCode: bankDetails.bankCode.trim(),
          bankName: bankDetails.bankName.trim()
        },
        notes: options.notes || null
      });

      await withdrawal.save();

      // Generate QR code for withdrawal
      try {
        const qrCodeData = await QRCodeService.generateWithdrawalQR({
          withdrawalId: withdrawal._id,
          affiliateId,
          amount,
          netAmount,
          currency: withdrawal.currency,
          requestedAt: withdrawal.requestedAt
        });

        withdrawal.qrCode = qrCodeData;
        await withdrawal.save();
      } catch (qrError) {
        logger.warn('Failed to generate QR code for withdrawal', {
          withdrawalId: withdrawal._id,
          error: qrError.message
        });
      }

      // Debit wallet (reserve funds)
      await WalletService.debitWallet(affiliateId, amount, `withdrawal_${withdrawal._id}`, {
        type: 'withdrawal_reserve',
        description: 'Funds reserved for withdrawal request',
        metadata: { withdrawalId: withdrawal._id }
      });

      logger.info('Withdrawal request created successfully', {
        withdrawalId: withdrawal._id,
        affiliateId,
        amount,
        netAmount,
        processingFee
      });

      return {
        success: true,
        withdrawal: withdrawal.getSummary(),
        message: 'Withdrawal request created successfully'
      };

    } catch (error) {
      logger.error('Error creating withdrawal request', {
        affiliateId,
        amount,
        error: error.message,
        stack: error.stack
      });

      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError('Failed to create withdrawal request', StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * @method processWithdrawal
   * @description Process a pending withdrawal request
   * @param {string} withdrawalId - Withdrawal ID
   * @param {string} processedBy - User ID of processor (optional)
   * @returns {Promise<object>} Processing result
   */
  static async processWithdrawal(withdrawalId, processedBy = null) {
    try {
      // Find withdrawal
      const withdrawal = await Withdrawal.findById(withdrawalId)
        .populate('affiliateId', 'businessName affiliateId status')
        .populate('walletId', 'balance status');

      if (!withdrawal) {
        throw new ApiError('Withdrawal not found', StatusCodes.NOT_FOUND);
      }

      // Check if withdrawal can be processed
      if (withdrawal.status !== 'pending') {
        throw new ApiError(`Withdrawal cannot be processed. Current status: ${withdrawal.status}`, StatusCodes.BAD_REQUEST);
      }

      // Check affiliate status
      if (withdrawal.affiliateId.status !== 'active') {
        throw new ApiError('Affiliate account is not active', StatusCodes.FORBIDDEN);
      }

      // Check wallet status
      if (withdrawal.walletId.status !== 'active') {
        throw new ApiError('Wallet is not active', StatusCodes.FORBIDDEN);
      }

      // Prepare transfer data for Paystack
      const transferData = {
        source: 'balance',
        amount: Math.round(withdrawal.netAmount * 100), // Convert to kobo
        recipient: await this.createOrGetPaystackRecipient(withdrawal.bankDetails),
        reason: `Affiliate withdrawal - ${withdrawal.affiliateId.businessName}`,
        reference: `WTH_${withdrawal._id}_${Date.now()}`
      };

      // Initiate transfer with Paystack
      const transferResponse = await this.initiatePaystackTransfer(transferData);

      // Update withdrawal status
      await withdrawal.markAsProcessing(
        transferResponse.reference,
        transferResponse.transfer_code,
        processedBy
      );

      logger.info('Withdrawal processing initiated', {
        withdrawalId: withdrawal._id,
        paystackReference: transferResponse.reference,
        transferCode: transferResponse.transfer_code,
        amount: withdrawal.netAmount
      });

      return {
        success: true,
        withdrawal: withdrawal.getSummary(),
        paystackReference: transferResponse.reference,
        message: 'Withdrawal processing initiated successfully'
      };

    } catch (error) {
      logger.error('Error processing withdrawal', {
        withdrawalId,
        error: error.message,
        stack: error.stack
      });

      // If withdrawal exists, mark as failed
      try {
        const withdrawal = await Withdrawal.findById(withdrawalId);
        if (withdrawal && withdrawal.status === 'pending') {
          await withdrawal.markAsFailed(error.message);
          
          // Reverse wallet debit
          await this.reverseWithdrawal(withdrawalId, 'Processing failed');
        }
      } catch (reverseError) {
        logger.error('Failed to reverse withdrawal after processing error', {
          withdrawalId,
          error: reverseError.message
        });
      }

      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError('Failed to process withdrawal', StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * @method cancelWithdrawal
   * @description Cancel a pending withdrawal request
   * @param {string} withdrawalId - Withdrawal ID
   * @param {string} reason - Cancellation reason
   * @param {string} cancelledBy - User ID of canceller (optional)
   * @returns {Promise<object>} Cancellation result
   */
  static async cancelWithdrawal(withdrawalId, reason, cancelledBy = null) {
    try {
      const withdrawal = await Withdrawal.findById(withdrawalId);

      if (!withdrawal) {
        throw new ApiError('Withdrawal not found', StatusCodes.NOT_FOUND);
      }

      if (!withdrawal.canBeCancelled()) {
        throw new ApiError(`Withdrawal cannot be cancelled. Current status: ${withdrawal.status}`, StatusCodes.BAD_REQUEST);
      }

      // Cancel withdrawal
      await withdrawal.cancel(reason, cancelledBy);

      // Reverse wallet debit
      await this.reverseWithdrawal(withdrawalId, reason);

      logger.info('Withdrawal cancelled successfully', {
        withdrawalId: withdrawal._id,
        reason,
        cancelledBy
      });

      return {
        success: true,
        withdrawal: withdrawal.getSummary(),
        message: 'Withdrawal cancelled successfully'
      };

    } catch (error) {
      logger.error('Error cancelling withdrawal', {
        withdrawalId,
        reason,
        error: error.message
      });

      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError('Failed to cancel withdrawal', StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * @method reverseWithdrawal
   * @description Reverse a withdrawal and credit back to wallet
   * @param {string} withdrawalId - Withdrawal ID
   * @param {string} reason - Reversal reason
   * @param {string} reversedBy - User ID of reverser (optional)
   * @returns {Promise<object>} Reversal result
   */
  static async reverseWithdrawal(withdrawalId, reason, reversedBy = null) {
    try {
      const withdrawal = await Withdrawal.findById(withdrawalId);

      if (!withdrawal) {
        throw new ApiError('Withdrawal not found', StatusCodes.NOT_FOUND);
      }

      // Credit back to wallet
      await WalletService.creditWallet(
        withdrawal.affiliateId,
        withdrawal.amount,
        `withdrawal_reversal_${withdrawal._id}`,
        {
          type: 'withdrawal_reversal',
          description: `Withdrawal reversal: ${reason}`,
          metadata: { 
            withdrawalId: withdrawal._id,
            originalAmount: withdrawal.amount,
            reason 
          }
        }
      );

      // Update withdrawal status if not already reversed
      if (withdrawal.status !== 'reversed') {
        await withdrawal.reverse(reason, reversedBy);
      }

      logger.info('Withdrawal reversed successfully', {
        withdrawalId: withdrawal._id,
        amount: withdrawal.amount,
        reason,
        reversedBy
      });

      return {
        success: true,
        withdrawal: withdrawal.getSummary(),
        message: 'Withdrawal reversed successfully'
      };

    } catch (error) {
      logger.error('Error reversing withdrawal', {
        withdrawalId,
        reason,
        error: error.message
      });

      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError('Failed to reverse withdrawal', StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * @method retryWithdrawal
   * @description Retry a failed withdrawal
   * @param {string} withdrawalId - Withdrawal ID
   * @returns {Promise<object>} Retry result
   */
  static async retryWithdrawal(withdrawalId) {
    try {
      const withdrawal = await Withdrawal.findById(withdrawalId);

      if (!withdrawal) {
        throw new ApiError('Withdrawal not found', StatusCodes.NOT_FOUND);
      }

      if (!withdrawal.canBeRetried()) {
        throw new ApiError(`Withdrawal cannot be retried. Status: ${withdrawal.status}, Retry count: ${withdrawal.retryCount}`, StatusCodes.BAD_REQUEST);
      }

      // Reset withdrawal to pending
      await withdrawal.retry();

      // Process the withdrawal again
      const result = await this.processWithdrawal(withdrawalId);

      logger.info('Withdrawal retry initiated', {
        withdrawalId: withdrawal._id,
        retryCount: withdrawal.retryCount
      });

      return result;

    } catch (error) {
      logger.error('Error retrying withdrawal', {
        withdrawalId,
        error: error.message
      });

      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError('Failed to retry withdrawal', StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * @method getWithdrawalHistory
   * @description Get withdrawal history for an affiliate
   * @param {string} affiliateId - Affiliate ID
   * @param {object} options - Query options
   * @returns {Promise<object>} Withdrawal history
   */
  static async getWithdrawalHistory(affiliateId, options = {}) {
    try {
      const {
        status,
        startDate,
        endDate,
        limit = 50,
        skip = 0,
        sortBy = 'requestedAt',
        sortOrder = 'desc'
      } = options;

      const withdrawals = await Withdrawal.findByAffiliate(affiliateId, {
        status,
        startDate,
        endDate,
        limit: parseInt(limit),
        skip: parseInt(skip)
      });

      // Get total count for pagination
      const query = { affiliateId };
      if (status) query.status = status;
      if (startDate || endDate) {
        query.requestedAt = {};
        if (startDate) query.requestedAt.$gte = new Date(startDate);
        if (endDate) query.requestedAt.$lte = new Date(endDate);
      }

      const totalCount = await Withdrawal.countDocuments(query);

      // Get withdrawal statistics
      const stats = await Withdrawal.getWithdrawalStats(affiliateId, {
        startDate,
        endDate
      });

      return {
        success: true,
        withdrawals,
        pagination: {
          total: totalCount,
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: totalCount > (parseInt(skip) + parseInt(limit))
        },
        statistics: stats[0] || {
          totalWithdrawals: 0,
          totalProcessingFees: 0,
          totalNetAmount: 0,
          totalRequests: 0,
          completedWithdrawals: 0,
          pendingWithdrawals: 0,
          failedWithdrawals: 0,
          averageWithdrawalAmount: 0
        }
      };

    } catch (error) {
      logger.error('Error getting withdrawal history', {
        affiliateId,
        options,
        error: error.message
      });

      throw new ApiError('Failed to get withdrawal history', StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * @method validateBankDetails
   * @description Validate bank account details
   * @param {object} bankDetails - Bank details to validate
   * @returns {Promise<object>} Validation result
   */
  static async validateBankDetails(bankDetails) {
    const errors = [];

    // Required fields validation
    if (!bankDetails.accountName || bankDetails.accountName.trim().length === 0) {
      errors.push('Account name is required');
    } else if (bankDetails.accountName.trim().length > 100) {
      errors.push('Account name cannot exceed 100 characters');
    }

    if (!bankDetails.accountNumber || bankDetails.accountNumber.trim().length === 0) {
      errors.push('Account number is required');
    } else if (!/^\d{10}$/.test(bankDetails.accountNumber.trim())) {
      errors.push('Account number must be exactly 10 digits');
    }

    if (!bankDetails.bankCode || bankDetails.bankCode.trim().length === 0) {
      errors.push('Bank code is required');
    } else if (!/^\d{3}$/.test(bankDetails.bankCode.trim())) {
      errors.push('Bank code must be exactly 3 digits');
    }

    if (!bankDetails.bankName || bankDetails.bankName.trim().length === 0) {
      errors.push('Bank name is required');
    } else if (bankDetails.bankName.trim().length > 100) {
      errors.push('Bank name cannot exceed 100 characters');
    }

    // Additional validation with Paystack (if needed)
    if (errors.length === 0) {
      try {
        const verificationResult = await this.verifyBankAccount(
          bankDetails.accountNumber.trim(),
          bankDetails.bankCode.trim()
        );

        if (!verificationResult.valid) {
          errors.push('Bank account verification failed');
        } else if (verificationResult.accountName) {
          // Check if provided name matches verified name (optional strict validation)
          const providedName = bankDetails.accountName.trim().toLowerCase();
          const verifiedName = verificationResult.accountName.toLowerCase();
          
          // Simple name matching (can be made more sophisticated)
          if (!providedName.includes(verifiedName.split(' ')[0]) && 
              !verifiedName.includes(providedName.split(' ')[0])) {
            logger.warn('Account name mismatch detected', {
              provided: providedName,
              verified: verifiedName
            });
            // Note: Not adding to errors as this might be too strict
          }
        }
      } catch (verificationError) {
        logger.warn('Bank account verification failed', {
          error: verificationError.message,
          bankDetails: {
            accountNumber: bankDetails.accountNumber,
            bankCode: bankDetails.bankCode
          }
        });
        // Don't fail validation if verification service is down
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * @method verifyBankAccount
   * @description Verify bank account with Paystack
   * @param {string} accountNumber - Account number
   * @param {string} bankCode - Bank code
   * @returns {Promise<object>} Verification result
   */
  static async verifyBankAccount(accountNumber, bankCode) {
    try {
      const response = await paystackService.verifyBankAccount(accountNumber, bankCode);
      
      if (response.status && response.data) {
        return {
          valid: true,
          accountName: response.data.account_name,
          accountNumber: response.data.account_number,
          bankCode: bankCode
        };
      } else {
        return {
          valid: false,
          error: response.message || 'Account verification failed'
        };
      }

    } catch (error) {
      logger.error('Bank account verification error', {
        accountNumber,
        bankCode,
        error: error.message
      });

      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * @method createOrGetPaystackRecipient
   * @description Create or get Paystack transfer recipient
   * @param {object} bankDetails - Bank details
   * @returns {Promise<string>} Recipient code
   */
  static async createOrGetPaystackRecipient(bankDetails) {
    try {
      const recipientData = {
        type: 'nuban',
        name: bankDetails.accountName,
        account_number: bankDetails.accountNumber,
        bank_code: bankDetails.bankCode,
        currency: 'NGN'
      };
      
      const response = await paystackService.createTransferRecipient(recipientData);
      
      if (response.status && response.data) {
        return response.data.recipient_code;
      } else {
        throw new ApiError(response.message || 'Failed to create recipient', StatusCodes.BAD_GATEWAY);
      }

    } catch (error) {
      logger.error('Error creating Paystack recipient', {
        bankDetails,
        error: error.message
      });

      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError('Failed to create payment recipient', StatusCodes.BAD_GATEWAY);
    }
  }

  /**
   * @method initiatePaystackTransfer
   * @description Initiate transfer with Paystack
   * @param {object} transferData - Transfer data
   * @returns {Promise<object>} Transfer response
   */
  static async initiatePaystackTransfer(transferData) {
    try {
      const response = await paystackService.initiateTransfer(transferData);
      
      if (response.status && response.data) {
        return {
          reference: response.data.reference,
          transfer_code: response.data.transfer_code,
          status: response.data.status,
          amount: response.data.amount,
          recipient: response.data.recipient
        };
      } else {
        throw new ApiError(response.message || 'Transfer initiation failed', StatusCodes.BAD_GATEWAY);
      }

    } catch (error) {
      logger.error('Error initiating Paystack transfer', {
        transferData,
        error: error.message
      });

      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError('Failed to initiate bank transfer', StatusCodes.BAD_GATEWAY);
    }
  }

  /**
   * @method handleWebhook
   * @description Handle Paystack webhook for transfer status updates
   * @param {object} webhookData - Webhook payload
   * @returns {Promise<object>} Processing result
   */
  static async handleWebhook(webhookData) {
    try {
      const { event, data } = webhookData;

      if (!event || !data || !data.reference) {
        throw new ApiError('Invalid webhook data', StatusCodes.BAD_REQUEST);
      }

      // Find withdrawal by Paystack reference
      const withdrawal = await Withdrawal.findOne({
        paystackReference: data.reference
      });

      if (!withdrawal) {
        logger.warn('Webhook received for unknown withdrawal', {
          reference: data.reference,
          event
        });
        return { success: true, message: 'Withdrawal not found' };
      }

      // Process webhook based on event type
      switch (event) {
        case 'transfer.success':
          await withdrawal.markAsCompleted(webhookData);
          logger.info('Withdrawal completed via webhook', {
            withdrawalId: withdrawal._id,
            reference: data.reference
          });
          
          // Send notification after successful withdrawal
          try {
            const affiliate = await Affiliate.findById(withdrawal.affiliateId);
            if (affiliate) {
              await AffiliateNotificationService.sendWithdrawalProcessedNotification(withdrawal, affiliate);
            }
          } catch (notificationError) {
            logger.warn('Failed to send withdrawal completion notification:', notificationError.message);
          }
          break;

        case 'transfer.failed':
          await withdrawal.markAsFailed(data.failure_reason || 'Transfer failed', webhookData);
          
          // Reverse the withdrawal
          await this.reverseWithdrawal(withdrawal._id, 'Transfer failed');
          
          logger.info('Withdrawal failed via webhook', {
            withdrawalId: withdrawal._id,
            reference: data.reference,
            reason: data.failure_reason
          });
          
          // Send notification after failed withdrawal
          try {
            const affiliate = await Affiliate.findById(withdrawal.affiliateId);
            if (affiliate) {
              await AffiliateNotificationService.sendWithdrawalProcessedNotification(withdrawal, affiliate);
            }
          } catch (notificationError) {
            logger.warn('Failed to send withdrawal failure notification:', notificationError.message);
          }
          break;

        case 'transfer.reversed':
          await withdrawal.reverse('Transfer reversed by bank', null);
          
          // Reverse the withdrawal
          await this.reverseWithdrawal(withdrawal._id, 'Transfer reversed by bank');
          
          logger.info('Withdrawal reversed via webhook', {
            withdrawalId: withdrawal._id,
            reference: data.reference
          });
          break;

        default:
          logger.info('Unhandled webhook event', {
            event,
            reference: data.reference
          });
      }

      return {
        success: true,
        message: 'Webhook processed successfully'
      };

    } catch (error) {
      logger.error('Error processing withdrawal webhook', {
        webhookData,
        error: error.message
      });

      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError('Failed to process webhook', StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * @method getWithdrawalById
   * @description Get withdrawal by ID
   * @param {string} withdrawalId - Withdrawal ID
   * @param {string} affiliateId - Affiliate ID (for authorization)
   * @returns {Promise<object>} Withdrawal details
   */
  static async getWithdrawalById(withdrawalId, affiliateId = null) {
    try {
      const query = { _id: withdrawalId };
      if (affiliateId) {
        query.affiliateId = affiliateId;
      }

      const withdrawal = await Withdrawal.findOne(query)
        .populate('affiliateId', 'businessName affiliateId')
        .populate('processedBy', 'firstName lastName')
        .populate('cancelledBy', 'firstName lastName')
        .populate('reversedBy', 'firstName lastName');

      if (!withdrawal) {
        throw new ApiError('Withdrawal not found', StatusCodes.NOT_FOUND);
      }

      return {
        success: true,
        withdrawal
      };

    } catch (error) {
      logger.error('Error getting withdrawal by ID', {
        withdrawalId,
        affiliateId,
        error: error.message
      });

      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError('Failed to get withdrawal', StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * @method getPendingWithdrawals
   * @description Get pending withdrawals for processing
   * @param {number} limit - Maximum number of withdrawals to return
   * @returns {Promise<object>} Pending withdrawals
   */
  static async getPendingWithdrawals(limit = 10) {
    try {
      const withdrawals = await Withdrawal.findPendingForProcessing(limit);

      return {
        success: true,
        withdrawals,
        count: withdrawals.length
      };

    } catch (error) {
      logger.error('Error getting pending withdrawals', {
        limit,
        error: error.message
      });

      throw new ApiError('Failed to get pending withdrawals', StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * @method getFailedWithdrawalsForRetry
   * @description Get failed withdrawals that can be retried
   * @param {number} retryAfterHours - Hours to wait before retry
   * @returns {Promise<object>} Failed withdrawals for retry
   */
  static async getFailedWithdrawalsForRetry(retryAfterHours = 24) {
    try {
      const withdrawals = await Withdrawal.findFailedForRetry(retryAfterHours);

      return {
        success: true,
        withdrawals,
        count: withdrawals.length
      };

    } catch (error) {
      logger.error('Error getting failed withdrawals for retry', {
        retryAfterHours,
        error: error.message
      });

      throw new ApiError('Failed to get failed withdrawals', StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * @method getSystemWithdrawalStats
   * @description Get system-wide withdrawal statistics
   * @param {object} dateRange - Date range for statistics
   * @returns {Promise<object>} System withdrawal statistics
   */
  static async getSystemWithdrawalStats(dateRange = {}) {
    try {
      const stats = await Withdrawal.getSystemStats(dateRange);

      return {
        success: true,
        statistics: stats[0] || {
          totalWithdrawals: 0,
          totalProcessingFees: 0,
          totalNetAmount: 0,
          totalRequests: 0,
          averageProcessingTime: 0
        }
      };

    } catch (error) {
      logger.error('Error getting system withdrawal stats', {
        dateRange,
        error: error.message
      });

      throw new ApiError('Failed to get withdrawal statistics', StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }
}

module.exports = WithdrawalService;