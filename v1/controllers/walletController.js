// v1/controllers/walletController.js
const WalletService = require('../services/walletService');
const { ApiError } = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');

/**
 * @description Controller for wallet operations
 * Handles HTTP requests for wallet management, balance operations, and transaction history
 */
class WalletController {
  /**
   * Create a new wallet for an affiliate
   * @route POST /api/v1/wallets
   */
  async createWallet(req, res, next) {
    try {
      const { affiliateId } = req.body;
      const options = {
        currency: req.body.currency,
        bankDetails: req.body.bankDetails,
      };

      const result = await WalletService.createWallet(affiliateId, options);
      return ApiResponse.created(res, result.message, result.data);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get wallet balance and summary
   * @route GET /api/v1/wallets/:affiliateId/balance
   */
  async getBalance(req, res, next) {
    try {
      const { affiliateId } = req.params;
      
      const result = await WalletService.getBalance(affiliateId);
      return ApiResponse.success(res, 200, result.message, result.data);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Credit amount to wallet
   * @route POST /api/v1/wallets/:affiliateId/credit
   */
  async creditWallet(req, res, next) {
    try {
      const { affiliateId } = req.params;
      const { amount, transactionRef, description, type, relatedId, relatedModel, metadata } = req.body;
      
      const options = {
        description,
        type,
        relatedId,
        relatedModel,
        metadata,
        processedBy: req.user?.id,
      };

      const result = await WalletService.creditWallet(affiliateId, amount, transactionRef, options);
      return ApiResponse.success(res, 200, result.message, result.data);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Debit amount from wallet
   * @route POST /api/v1/wallets/:affiliateId/debit
   */
  async debitWallet(req, res, next) {
    try {
      const { affiliateId } = req.params;
      const { amount, transactionRef, description, type, relatedId, relatedModel, metadata } = req.body;
      
      const options = {
        description,
        type,
        relatedId,
        relatedModel,
        metadata,
        processedBy: req.user?.id,
      };

      const result = await WalletService.debitWallet(affiliateId, amount, transactionRef, options);
      return ApiResponse.success(res, 200, result.message, result.data);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get wallet transaction history with pagination
   * @route GET /api/v1/wallets/:affiliateId/transactions
   */
  async getTransactionHistory(req, res, next) {
    try {
      const { affiliateId } = req.params;
      const pagination = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20,
        type: req.query.type,
        status: req.query.status,
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo,
        sortBy: req.query.sortBy,
        sortOrder: req.query.sortOrder,
      };

      const result = await WalletService.getTransactionHistory(affiliateId, pagination);
      return ApiResponse.paginated(res, result.message, result.data.transactions, result.data.pagination);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Freeze wallet
   * @route POST /api/v1/wallets/:affiliateId/freeze
   */
  async freezeWallet(req, res, next) {
    try {
      const { affiliateId } = req.params;
      const { reason } = req.body;
      const processedBy = req.user?.id;

      const result = await WalletService.freezeWallet(affiliateId, reason, processedBy);
      return ApiResponse.success(res, 200, result.message, result.data);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Unfreeze wallet
   * @route POST /api/v1/wallets/:affiliateId/unfreeze
   */
  async unfreezeWallet(req, res, next) {
    try {
      const { affiliateId } = req.params;
      const processedBy = req.user?.id;

      const result = await WalletService.unfreezeWallet(affiliateId, processedBy);
      return ApiResponse.success(res, 200, result.message, result.data);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Suspend wallet
   * @route POST /api/v1/wallets/:affiliateId/suspend
   */
  async suspendWallet(req, res, next) {
    try {
      const { affiliateId } = req.params;
      const { reason } = req.body;
      const processedBy = req.user?.id;

      const result = await WalletService.suspendWallet(affiliateId, reason, processedBy);
      return ApiResponse.success(res, 200, result.message, result.data);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Validate wallet for operations
   * @route GET /api/v1/wallets/:affiliateId/validate
   */
  async validateWallet(req, res, next) {
    try {
      const { affiliateId } = req.params;
      const { operation, amount } = req.query;

      const result = await WalletService.validateWallet(affiliateId, operation, parseFloat(amount) || 0);
      return ApiResponse.success(res, 200, 'Wallet validation completed', result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update wallet bank details
   * @route PUT /api/v1/wallets/:affiliateId/bank-details
   */
  async updateBankDetails(req, res, next) {
    try {
      const { affiliateId } = req.params;
      const bankDetails = req.body;

      const result = await WalletService.updateBankDetails(affiliateId, bankDetails);
      return ApiResponse.success(res, 200, result.message, result.data);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get wallet statistics
   * @route GET /api/v1/wallets/:affiliateId/statistics
   */
  async getWalletStatistics(req, res, next) {
    try {
      const { affiliateId } = req.params;
      const dateRange = {
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo,
      };

      const result = await WalletService.getWalletStatistics(affiliateId, dateRange);
      return ApiResponse.success(res, 200, result.message, result.data);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Reverse a wallet transaction
   * @route POST /api/v1/wallets/transactions/:transactionId/reverse
   */
  async reverseTransaction(req, res, next) {
    try {
      const { transactionId } = req.params;
      const { reason } = req.body;
      const processedBy = req.user?.id;

      const result = await WalletService.reverseTransaction(transactionId, reason, processedBy);
      return ApiResponse.success(res, 200, result.message, result.data);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get system-wide wallet statistics
   * @route GET /api/v1/wallets/system/statistics
   */
  async getSystemWalletStatistics(req, res, next) {
    try {
      const result = await WalletService.getSystemWalletStatistics();
      return ApiResponse.success(res, 200, result.message, result.data);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Perform bulk wallet operations
   * @route POST /api/v1/wallets/bulk-operations
   */
  async bulkWalletOperations(req, res, next) {
    try {
      const { operations } = req.body;

      if (!Array.isArray(operations) || operations.length === 0) {
        throw new ApiError('Operations array is required and must not be empty', 400);
      }

      const result = await WalletService.bulkWalletOperations(operations);
      return ApiResponse.success(res, 200, result.message, result.data);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Check wallet health and integrity
   * @route GET /api/v1/wallets/:affiliateId/health
   */
  async checkWalletHealth(req, res, next) {
    try {
      const { affiliateId } = req.params;

      const result = await WalletService.checkWalletHealth(affiliateId);
      return ApiResponse.success(res, 200, result.message, result.data);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new WalletController();