// v1/routes/transactionDashboardRoutes.js
const express = require('express');
const {
  getAllTransactions,
  getTransactionAnalytics,
  exportTransactions,
} = require('../controllers/transactionDashboardController');
const { authenticateUser, requireStaffClearance } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * @swagger
 * /dashboard/transactions:
 *   get:
 *     summary: Get all transactions with filters (Staff Tier 2+)
 *     tags: [Transaction Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: paymentStatus
 *         schema:
 *           type: string
 *       - in: query
 *         name: currency
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Transactions fetched successfully
 */
router.get('/', authenticateUser, requireStaffClearance(2), getAllTransactions);

/**
 * @swagger
 * /dashboard/transactions/analytics:
 *   get:
 *     summary: Get transaction analytics (Staff Tier 2+)
 *     tags: [Transaction Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: currency
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Analytics fetched successfully
 */
router.get('/analytics', authenticateUser, requireStaffClearance(2), getTransactionAnalytics);

/**
 * @swagger
 * /dashboard/transactions/export:
 *   get:
 *     summary: Export transactions to CSV (Staff Tier 2+)
 *     tags: [Transaction Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: paymentStatus
 *         schema:
 *           type: string
 *       - in: query
 *         name: currency
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: CSV file
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 */
router.get('/export', authenticateUser, requireStaffClearance(2), exportTransactions);

module.exports = router;
