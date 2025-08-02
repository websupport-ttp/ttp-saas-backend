// v1/services/walletService.js
const Wallet = require('../models/walletModel');
const WalletTransaction = require('../models/walletTransactionModel');
const Affiliate = require('../models/affiliateModel');
const mongoose = require('mongoose');
const { ApiError } = require('../utils/apiError');
const { WalletError } = require('../utils/affiliateErrors');
const errorRecovery = require('../utils/errorRecovery');
const errorMonitor = require('../utils/errorMonitoring');
const logger = require('../utils/logger');

/**
 * @description Service class for managing wallet operations
 * Handles wallet creation, balance management, transactions, and security features
 */
class WalletService {
  /**
   * Create a new wallet for an affiliate
   * @param {string} affiliateId - The affiliate ID
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Created wallet
   */
  async createWallet(affiliateId, options = {}) {
    try {
      // Validate affiliate exists
      const affiliate = await Affiliate.findById(affiliateId);
      if (!affiliate) {
        throw WalletError.notFound(affiliateId, { operation: 'affiliate_validation' });
      }

      // Check if wallet already exists
      const existingWallet = await Wallet.findOne({ affiliateId });
      if (existingWallet) {
        throw new WalletError('Wallet already exists for this affiliate', 400, [], {
          affiliateId,
          existingWalletId: existingWallet._id,
          operation: 'duplicate_check'
        });
      }

      // Create wallet
      const walletData = {
        affiliateId,
        balance: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
        currency: options.currency || 'NGN',
        status: 'active',
        ...options,
      };

      const wallet = new Wallet(walletData);
      await wallet.save();

      return {
        success: true,
        data: wallet.getSummary(),
        message: 'Wallet created successfully',
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(`Failed to create wallet: ${error.message}`, 500);
    }
  }

  /**
   * Credit amount to wallet and create transaction record
   * @param {string} affiliateId - The affiliate ID
   * @param {number} amount - Amount to credit
   * @param {string} transactionRef - Transaction reference
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Transaction result
   */
  async creditWallet(affiliateId, amount, transactionRef, options = {}) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Validate inputs
      if (!affiliateId || !amount || !transactionRef) {
        throw new ApiError('Affiliate ID, amount, and transaction reference are required', 400);
      }

      if (amount <= 0) {
        throw new ApiError('Credit amount must be positive', 400);
      }

      // Find wallet
      const wallet = await Wallet.findOne({ affiliateId }).session(session);
      if (!wallet) {
        throw new ApiError('Wallet not found', 404);
      }

      // Check wallet status
      if (wallet.status !== 'active') {
        throw new ApiError(`Cannot credit ${wallet.status} wallet`, 400);
      }

      // Check for duplicate transaction reference
      const existingTransaction = await WalletTransaction.findOne({ 
        reference: transactionRef 
      }).session(session);
      
      if (existingTransaction) {
        throw new ApiError('Transaction reference already exists', 400);
      }

      const balanceBefore = wallet.balance;
      
      // Credit wallet using model method
      await wallet.credit(amount, options.description || 'Commission earned');

      // Create transaction record
      const transactionData = {
        walletId: wallet._id,
        affiliateId,
        type: options.type || 'commission_credit',
        amount,
        balanceBefore,
        balanceAfter: wallet.balance,
        currency: wallet.currency,
        description: options.description || 'Commission earned',
        reference: transactionRef,
        relatedId: options.relatedId,
        relatedModel: options.relatedModel,
        metadata: options.metadata || {},
        processedBy: options.processedBy,
      };

      const transaction = new WalletTransaction(transactionData);
      await transaction.save({ session });

      await session.commitTransaction();

      return {
        success: true,
        data: {
          wallet: wallet.getSummary(),
          transaction: transaction.getSummary(),
        },
        message: 'Wallet credited successfully',
      };
    } catch (error) {
      await session.abortTransaction();
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(`Failed to credit wallet: ${error.message}`, 500);
    } finally {
      session.endSession();
    }
  }

  /**
   * Debit amount from wallet and create transaction record
   * @param {string} affiliateId - The affiliate ID
   * @param {number} amount - Amount to debit
   * @param {string} transactionRef - Transaction reference
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Transaction result
   */
  async debitWallet(affiliateId, amount, transactionRef, options = {}) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Validate inputs
      if (!affiliateId || !amount || !transactionRef) {
        throw new ApiError('Affiliate ID, amount, and transaction reference are required', 400);
      }

      if (amount <= 0) {
        throw new ApiError('Debit amount must be positive', 400);
      }

      // Find wallet
      const wallet = await Wallet.findOne({ affiliateId }).session(session);
      if (!wallet) {
        throw new ApiError('Wallet not found', 404);
      }

      // Check wallet status
      if (wallet.status !== 'active') {
        throw new ApiError(`Cannot debit ${wallet.status} wallet`, 400);
      }

      // Check sufficient balance
      if (wallet.balance < amount) {
        throw new ApiError('Insufficient wallet balance', 400);
      }

      // Check for duplicate transaction reference
      const existingTransaction = await WalletTransaction.findOne({ 
        reference: transactionRef 
      }).session(session);
      
      if (existingTransaction) {
        throw new ApiError('Transaction reference already exists', 400);
      }

      const balanceBefore = wallet.balance;
      
      // Debit wallet using model method
      await wallet.debit(amount, options.description || 'Withdrawal processed');

      // Create transaction record
      const transactionData = {
        walletId: wallet._id,
        affiliateId,
        type: options.type || 'withdrawal_debit',
        amount,
        balanceBefore,
        balanceAfter: wallet.balance,
        currency: wallet.currency,
        description: options.description || 'Withdrawal processed',
        reference: transactionRef,
        relatedId: options.relatedId,
        relatedModel: options.relatedModel,
        metadata: options.metadata || {},
        processedBy: options.processedBy,
      };

      const transaction = new WalletTransaction(transactionData);
      await transaction.save({ session });

      await session.commitTransaction();

      return {
        success: true,
        data: {
          wallet: wallet.getSummary(),
          transaction: transaction.getSummary(),
        },
        message: 'Wallet debited successfully',
      };
    } catch (error) {
      await session.abortTransaction();
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(`Failed to debit wallet: ${error.message}`, 500);
    } finally {
      session.endSession();
    }
  }

  /**
   * Get wallet balance and summary
   * @param {string} affiliateId - The affiliate ID
   * @returns {Promise<Object>} Wallet balance and summary
   */
  async getBalance(affiliateId) {
    try {
      if (!affiliateId) {
        throw new ApiError('Affiliate ID is required', 400);
      }

      const wallet = await Wallet.findOne({ affiliateId }).populate('affiliateId', 'businessName affiliateId');
      if (!wallet) {
        throw new ApiError('Wallet not found', 404);
      }

      return {
        success: true,
        data: {
          ...wallet.getSummary(),
          affiliate: wallet.affiliateId,
        },
        message: 'Wallet balance retrieved successfully',
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(`Failed to get wallet balance: ${error.message}`, 500);
    }
  }

  /**
   * Get wallet transaction history with pagination
   * @param {string} affiliateId - The affiliate ID
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Transaction history
   */
  async getTransactionHistory(affiliateId, pagination = {}) {
    try {
      if (!affiliateId) {
        throw new ApiError('Affiliate ID is required', 400);
      }

      // Validate wallet exists
      const wallet = await Wallet.findOne({ affiliateId });
      if (!wallet) {
        throw new ApiError('Wallet not found', 404);
      }

      const {
        page = 1,
        limit = 20,
        type,
        status,
        dateFrom,
        dateTo,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = pagination;

      const skip = (page - 1) * limit;
      const sortDirection = sortOrder === 'desc' ? -1 : 1;

      // Build query options
      const queryOptions = {
        type,
        status,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
        limit: parseInt(limit),
        skip: parseInt(skip),
      };

      // Get transactions
      const transactions = await WalletTransaction.findByAffiliate(affiliateId, queryOptions);

      // Get total count for pagination
      const countQuery = WalletTransaction.find({ affiliateId });
      if (type) countQuery.where('type', type);
      if (status) countQuery.where('status', status);
      if (dateFrom) countQuery.where('createdAt').gte(new Date(dateFrom));
      if (dateTo) countQuery.where('createdAt').lte(new Date(dateTo));
      
      const totalCount = await countQuery.countDocuments();
      const totalPages = Math.ceil(totalCount / limit);

      return {
        success: true,
        data: {
          transactions: transactions.map(t => t.getSummary()),
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalCount,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            limit: parseInt(limit),
          },
        },
        message: 'Transaction history retrieved successfully',
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(`Failed to get transaction history: ${error.message}`, 500);
    }
  }

  /**
   * Freeze wallet with reason
   * @param {string} affiliateId - The affiliate ID
   * @param {string} reason - Reason for freezing
   * @param {string} processedBy - ID of user who froze the wallet
   * @returns {Promise<Object>} Freeze result
   */
  async freezeWallet(affiliateId, reason, processedBy) {
    try {
      if (!affiliateId || !reason) {
        throw new ApiError('Affiliate ID and reason are required', 400);
      }

      const wallet = await Wallet.findOne({ affiliateId });
      if (!wallet) {
        throw new ApiError('Wallet not found', 404);
      }

      if (wallet.status === 'frozen') {
        throw new ApiError('Wallet is already frozen', 400);
      }

      await wallet.freeze(reason);

      return {
        success: true,
        data: wallet.getSummary(),
        message: 'Wallet frozen successfully',
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(`Failed to freeze wallet: ${error.message}`, 500);
    }
  }

  /**
   * Unfreeze wallet
   * @param {string} affiliateId - The affiliate ID
   * @param {string} processedBy - ID of user who unfroze the wallet
   * @returns {Promise<Object>} Unfreeze result
   */
  async unfreezeWallet(affiliateId, processedBy) {
    try {
      if (!affiliateId) {
        throw new ApiError('Affiliate ID is required', 400);
      }

      const wallet = await Wallet.findOne({ affiliateId });
      if (!wallet) {
        throw new ApiError('Wallet not found', 404);
      }

      if (wallet.status !== 'frozen') {
        throw new ApiError('Wallet is not frozen', 400);
      }

      await wallet.unfreeze();

      return {
        success: true,
        data: wallet.getSummary(),
        message: 'Wallet unfrozen successfully',
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(`Failed to unfreeze wallet: ${error.message}`, 500);
    }
  }

  /**
   * Suspend wallet with reason
   * @param {string} affiliateId - The affiliate ID
   * @param {string} reason - Reason for suspension
   * @param {string} processedBy - ID of user who suspended the wallet
   * @returns {Promise<Object>} Suspension result
   */
  async suspendWallet(affiliateId, reason, processedBy) {
    try {
      if (!affiliateId || !reason) {
        throw new ApiError('Affiliate ID and reason are required', 400);
      }

      const wallet = await Wallet.findOne({ affiliateId });
      if (!wallet) {
        throw new ApiError('Wallet not found', 404);
      }

      if (wallet.status === 'suspended') {
        throw new ApiError('Wallet is already suspended', 400);
      }

      await wallet.suspend(reason);

      return {
        success: true,
        data: wallet.getSummary(),
        message: 'Wallet suspended successfully',
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(`Failed to suspend wallet: ${error.message}`, 500);
    }
  }

  /**
   * Validate wallet for operations
   * @param {string} affiliateId - The affiliate ID
   * @param {string} operation - Operation to validate ('credit', 'debit', 'withdraw')
   * @param {number} amount - Amount for the operation (optional)
   * @returns {Promise<Object>} Validation result
   */
  async validateWallet(affiliateId, operation, amount = 0) {
    try {
      if (!affiliateId || !operation) {
        throw new ApiError('Affiliate ID and operation are required', 400);
      }

      const wallet = await Wallet.findOne({ affiliateId });
      if (!wallet) {
        return {
          success: false,
          valid: false,
          reason: 'Wallet not found',
        };
      }

      const validations = {
        credit: () => {
          if (wallet.status !== 'active') {
            return { valid: false, reason: `Cannot credit ${wallet.status} wallet` };
          }
          return { valid: true };
        },
        debit: () => {
          if (wallet.status !== 'active') {
            return { valid: false, reason: `Cannot debit ${wallet.status} wallet` };
          }
          if (amount > 0 && wallet.balance < amount) {
            return { valid: false, reason: 'Insufficient balance' };
          }
          return { valid: true };
        },
        withdraw: () => {
          const withdrawCheck = wallet.canWithdraw(amount);
          return withdrawCheck;
        },
      };

      const validator = validations[operation];
      if (!validator) {
        throw new ApiError('Invalid operation type', 400);
      }

      const result = validator();

      return {
        success: true,
        valid: result.valid !== undefined ? result.valid : result.allowed,
        reason: result.reason,
        data: wallet.getSummary(),
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(`Failed to validate wallet: ${error.message}`, 500);
    }
  }

  /**
   * Update wallet bank details
   * @param {string} affiliateId - The affiliate ID
   * @param {Object} bankDetails - Bank details to update
   * @returns {Promise<Object>} Update result
   */
  async updateBankDetails(affiliateId, bankDetails) {
    try {
      if (!affiliateId || !bankDetails) {
        throw new ApiError('Affiliate ID and bank details are required', 400);
      }

      const wallet = await Wallet.findOne({ affiliateId });
      if (!wallet) {
        throw new ApiError('Wallet not found', 404);
      }

      await wallet.updateBankDetails(bankDetails);

      return {
        success: true,
        data: wallet.getSummary(),
        message: 'Bank details updated successfully',
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(`Failed to update bank details: ${error.message}`, 500);
    }
  }

  /**
   * Get wallet statistics
   * @param {string} affiliateId - The affiliate ID
   * @param {Object} dateRange - Date range for statistics
   * @returns {Promise<Object>} Wallet statistics
   */
  async getWalletStatistics(affiliateId, dateRange = {}) {
    try {
      if (!affiliateId) {
        throw new ApiError('Affiliate ID is required', 400);
      }

      const wallet = await Wallet.findOne({ affiliateId });
      if (!wallet) {
        throw new ApiError('Wallet not found', 404);
      }

      const { dateFrom, dateTo } = dateRange;
      
      // Get transaction statistics
      const transactionStats = await WalletTransaction.getStatistics(
        affiliateId,
        dateFrom ? new Date(dateFrom) : undefined,
        dateTo ? new Date(dateTo) : undefined
      );

      return {
        success: true,
        data: {
          wallet: wallet.getSummary(),
          transactions: transactionStats[0] || {
            totalTransactions: 0,
            totalAmount: 0,
            byType: [],
          },
        },
        message: 'Wallet statistics retrieved successfully',
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(`Failed to get wallet statistics: ${error.message}`, 500);
    }
  }

  /**
   * Get system-wide wallet statistics (Admin only)
   * @returns {Promise<Object>} System wallet statistics
   */
  async getSystemWalletStatistics() {
    try {
      const systemStats = await Wallet.getTotalSystemBalance();
      
      return {
        success: true,
        data: systemStats[0] || {
          totalBalance: 0,
          totalEarned: 0,
          totalWithdrawn: 0,
          activeWallets: 0,
          frozenWallets: 0,
          suspendedWallets: 0,
        },
        message: 'System wallet statistics retrieved successfully',
      };
    } catch (error) {
      throw new ApiError(`Failed to get system wallet statistics: ${error.message}`, 500);
    }
  }

  /**
   * Bulk wallet operations for administrative purposes
   * @param {Array} operations - Array of wallet operations
   * @returns {Promise<Object>} Bulk operation results
   */
  async bulkWalletOperations(operations) {
    const results = [];
    const errors = [];

    for (const operation of operations) {
      try {
        let result;
        switch (operation.type) {
          case 'credit':
            result = await this.creditWallet(
              operation.affiliateId,
              operation.amount,
              operation.transactionRef,
              operation.options || {}
            );
            break;
          case 'debit':
            result = await this.debitWallet(
              operation.affiliateId,
              operation.amount,
              operation.transactionRef,
              operation.options || {}
            );
            break;
          case 'freeze':
            result = await this.freezeWallet(
              operation.affiliateId,
              operation.reason,
              operation.processedBy
            );
            break;
          case 'unfreeze':
            result = await this.unfreezeWallet(
              operation.affiliateId,
              operation.processedBy
            );
            break;
          default:
            throw new Error(`Unsupported operation type: ${operation.type}`);
        }
        results.push({ operation, result, success: true });
      } catch (error) {
        errors.push({ operation, error: error.message, success: false });
      }
    }

    return {
      success: errors.length === 0,
      data: {
        successful: results,
        failed: errors,
        totalOperations: operations.length,
        successCount: results.length,
        errorCount: errors.length,
      },
      message: `Bulk operations completed: ${results.length} successful, ${errors.length} failed`,
    };
  }

  /**
   * Check wallet health and integrity
   * @param {string} affiliateId - The affiliate ID
   * @returns {Promise<Object>} Wallet health check results
   */
  async checkWalletHealth(affiliateId) {
    try {
      if (!affiliateId) {
        throw new ApiError('Affiliate ID is required', 400);
      }

      const wallet = await Wallet.findOne({ affiliateId });
      if (!wallet) {
        throw new ApiError('Wallet not found', 404);
      }

      // Get all transactions for this wallet
      const transactions = await WalletTransaction.find({ affiliateId }).sort({ createdAt: 1 });
      
      // Calculate expected balance from transactions
      let calculatedBalance = 0;
      let calculatedEarned = 0;
      let calculatedWithdrawn = 0;

      for (const transaction of transactions) {
        if (transaction.type.includes('credit') || transaction.type.includes('refund')) {
          calculatedBalance += transaction.amount;
          if (transaction.type === 'commission_credit') {
            calculatedEarned += transaction.amount;
          }
        } else if (transaction.type.includes('debit') || transaction.type.includes('penalty')) {
          calculatedBalance -= transaction.amount;
          if (transaction.type === 'withdrawal_debit') {
            calculatedWithdrawn += transaction.amount;
          }
        }
      }

      // Round to 2 decimal places for comparison
      calculatedBalance = Math.round(calculatedBalance * 100) / 100;
      calculatedEarned = Math.round(calculatedEarned * 100) / 100;
      calculatedWithdrawn = Math.round(calculatedWithdrawn * 100) / 100;

      const balanceMatch = wallet.balance === calculatedBalance;
      const earnedMatch = wallet.totalEarned === calculatedEarned;
      const withdrawnMatch = wallet.totalWithdrawn === calculatedWithdrawn;

      const healthIssues = [];
      if (!balanceMatch) {
        healthIssues.push(`Balance mismatch: wallet shows ${wallet.balance}, calculated ${calculatedBalance}`);
      }
      if (!earnedMatch) {
        healthIssues.push(`Total earned mismatch: wallet shows ${wallet.totalEarned}, calculated ${calculatedEarned}`);
      }
      if (!withdrawnMatch) {
        healthIssues.push(`Total withdrawn mismatch: wallet shows ${wallet.totalWithdrawn}, calculated ${calculatedWithdrawn}`);
      }

      return {
        success: true,
        data: {
          walletId: wallet._id,
          affiliateId,
          healthy: healthIssues.length === 0,
          issues: healthIssues,
          walletData: {
            balance: wallet.balance,
            totalEarned: wallet.totalEarned,
            totalWithdrawn: wallet.totalWithdrawn,
          },
          calculatedData: {
            balance: calculatedBalance,
            totalEarned: calculatedEarned,
            totalWithdrawn: calculatedWithdrawn,
          },
          transactionCount: transactions.length,
        },
        message: healthIssues.length === 0 ? 'Wallet is healthy' : 'Wallet has integrity issues',
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(`Failed to check wallet health: ${error.message}`, 500);
    }
  }

  /**
   * Reverse a wallet transaction
   * @param {string} transactionId - The transaction ID to reverse
   * @param {string} reason - Reason for reversal
   * @param {string} processedBy - ID of user who processed the reversal
   * @returns {Promise<Object>} Reversal result
   */
  async reverseTransaction(transactionId, reason, processedBy) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      if (!transactionId || !reason) {
        throw new ApiError('Transaction ID and reason are required', 400);
      }

      // Find the transaction
      const transaction = await WalletTransaction.findById(transactionId).session(session);
      if (!transaction) {
        throw new ApiError('Transaction not found', 404);
      }

      if (transaction.status === 'reversed') {
        throw new ApiError('Transaction is already reversed', 400);
      }

      // Find the wallet
      const wallet = await Wallet.findById(transaction.walletId).session(session);
      if (!wallet) {
        throw new ApiError('Wallet not found', 404);
      }

      // Reverse the transaction effect on wallet
      const reversalAmount = transaction.amount;
      let reversalType;
      
      if (transaction.type.includes('credit')) {
        // Reverse credit by debiting
        await wallet.debit(reversalAmount, `Reversal: ${reason}`);
        reversalType = 'reversal_debit';
      } else if (transaction.type.includes('debit')) {
        // Reverse debit by crediting
        await wallet.credit(reversalAmount, `Reversal: ${reason}`);
        reversalType = 'reversal_credit';
      }

      // Mark original transaction as reversed
      await transaction.reverse(reason, processedBy);

      // Create reversal transaction record
      const reversalTransaction = new WalletTransaction({
        walletId: wallet._id,
        affiliateId: transaction.affiliateId,
        type: reversalType,
        amount: reversalAmount,
        balanceBefore: transaction.balanceAfter,
        balanceAfter: wallet.balance,
        currency: wallet.currency,
        description: `Reversal of transaction ${transaction.reference}: ${reason}`,
        reference: `REV_${transaction.reference}`,
        relatedId: transaction._id,
        relatedModel: 'WalletTransaction',
        metadata: { originalTransactionId: transaction._id, reversalReason: reason },
        processedBy,
      });

      await reversalTransaction.save({ session });

      await session.commitTransaction();

      return {
        success: true,
        data: {
          originalTransaction: transaction.getSummary(),
          reversalTransaction: reversalTransaction.getSummary(),
          wallet: wallet.getSummary(),
        },
        message: 'Transaction reversed successfully',
      };
    } catch (error) {
      await session.abortTransaction();
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(`Failed to reverse transaction: ${error.message}`, 500);
    } finally {
      session.endSession();
    }
  }
}

module.exports = new WalletService();