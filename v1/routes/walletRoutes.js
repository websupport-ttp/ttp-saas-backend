// v1/routes/walletRoutes.js
const express = require('express');
const walletController = require('../controllers/walletController');
const { authenticateUser, authorizeRoles } = require('../middleware/authMiddleware');
// Validation is handled at the service level for better centralization

const router = express.Router();

/**
 * @description Wallet routes - validation is handled at service level
 * All routes use comprehensive service-level validation for better centralization
 */

/**
 * @route POST /api/v1/wallets
 * @description Create a new wallet for an affiliate
 * @access Private (Admin only)
 */
router.post(
  '/',
  authenticateUser,
  authorizeRoles(['Admin']),
  walletController.createWallet
);

/**
 * @route GET /api/v1/wallets/:affiliateId/balance
 * @description Get wallet balance and summary
 * @access Private (Affiliate owner or Admin)
 */
router.get(
  '/:affiliateId/balance',
  authenticateUser,
  walletController.getBalance
);

/**
 * @route POST /api/v1/wallets/:affiliateId/credit
 * @description Credit amount to wallet
 * @access Private (Admin only)
 */
router.post(
  '/:affiliateId/credit',
  authenticateUser,
  authorizeRoles(['Admin']),
  walletController.creditWallet
);

/**
 * @route POST /api/v1/wallets/:affiliateId/debit
 * @description Debit amount from wallet
 * @access Private (Admin only)
 */
router.post(
  '/:affiliateId/debit',
  authenticateUser,
  authorizeRoles(['Admin']),
  walletController.debitWallet
);

/**
 * @route GET /api/v1/wallets/:affiliateId/transactions
 * @description Get wallet transaction history with pagination
 * @access Private (Affiliate owner or Admin)
 */
router.get(
  '/:affiliateId/transactions',
  authenticateUser,
  walletController.getTransactionHistory
);

/**
 * @route POST /api/v1/wallets/:affiliateId/freeze
 * @description Freeze wallet
 * @access Private (Admin only)
 */
router.post(
  '/:affiliateId/freeze',
  authenticateUser,
  authorizeRoles(['Admin']),
  walletController.freezeWallet
);

/**
 * @route POST /api/v1/wallets/:affiliateId/unfreeze
 * @description Unfreeze wallet
 * @access Private (Admin only)
 */
router.post(
  '/:affiliateId/unfreeze',
  authenticateUser,
  authorizeRoles(['Admin']),
  walletController.unfreezeWallet
);

/**
 * @route POST /api/v1/wallets/:affiliateId/suspend
 * @description Suspend wallet
 * @access Private (Admin only)
 */
router.post(
  '/:affiliateId/suspend',
  authenticateUser,
  authorizeRoles(['Admin']),
  walletController.suspendWallet
);

/**
 * @route GET /api/v1/wallets/:affiliateId/validate
 * @description Validate wallet for operations
 * @access Private (Affiliate owner or Admin)
 */
router.get(
  '/:affiliateId/validate',
  authenticateUser,
  walletController.validateWallet
);

/**
 * @route PUT /api/v1/wallets/:affiliateId/bank-details
 * @description Update wallet bank details
 * @access Private (Affiliate owner or Admin)
 */
router.put(
  '/:affiliateId/bank-details',
  authenticateUser,
  walletController.updateBankDetails
);

/**
 * @route GET /api/v1/wallets/:affiliateId/statistics
 * @description Get wallet statistics
 * @access Private (Affiliate owner or Admin)
 */
router.get(
  '/:affiliateId/statistics',
  authenticateUser,
  walletController.getWalletStatistics
);

/**
 * @route POST /api/v1/wallets/transactions/:transactionId/reverse
 * @description Reverse a wallet transaction
 * @access Private (Admin only)
 */
router.post(
  '/transactions/:transactionId/reverse',
  authenticateUser,
  authorizeRoles(['Admin']),
  walletController.reverseTransaction
);

/**
 * @route GET /api/v1/wallets/system/statistics
 * @description Get system-wide wallet statistics
 * @access Private (Admin only)
 */
router.get(
  '/system/statistics',
  authenticateUser,
  authorizeRoles(['Admin']),
  walletController.getSystemWalletStatistics
);

/**
 * @route POST /api/v1/wallets/bulk-operations
 * @description Perform bulk wallet operations
 * @access Private (Admin only)
 */
router.post(
  '/bulk-operations',
  authenticateUser,
  authorizeRoles(['Admin']),
  walletController.bulkWalletOperations
);

/**
 * @route GET /api/v1/wallets/:affiliateId/health
 * @description Check wallet health and integrity
 * @access Private (Admin only)
 */
router.get(
  '/:affiliateId/health',
  authenticateUser,
  authorizeRoles(['Admin']),
  walletController.checkWalletHealth
);

module.exports = router;