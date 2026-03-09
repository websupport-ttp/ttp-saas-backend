// v1/routes/currencyRoutes.js
const express = require('express');
const {
  getAllCurrencies,
  getAllCurrenciesAdmin,
  createCurrency,
  updateCurrency,
  deleteCurrency,
  updateRates,
  convert,
} = require('../controllers/currencyController');
const { authenticateUser, requireStaffClearance } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * @swagger
 * /currencies:
 *   get:
 *     summary: Get all active currencies
 *     tags: [Currency]
 *     responses:
 *       200:
 *         description: List of active currencies
 */
router.get('/', getAllCurrencies);

/**
 * @swagger
 * /currencies/convert:
 *   post:
 *     summary: Convert amount between currencies
 *     tags: [Currency]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - from
 *               - to
 *             properties:
 *               amount:
 *                 type: number
 *               from:
 *                 type: string
 *               to:
 *                 type: string
 *     responses:
 *       200:
 *         description: Conversion successful
 */
router.post('/convert', convert);

// Staff Tier 3+ routes (requires authentication and clearance level 3)
/**
 * @swagger
 * /currencies/all:
 *   get:
 *     summary: Get all currencies including inactive (Admin/Staff Tier 3+)
 *     tags: [Currency]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all currencies
 */
router.get('/all', authenticateUser, requireStaffClearance(3), getAllCurrenciesAdmin);

/**
 * @swagger
 * /currencies:
 *   post:
 *     summary: Create new currency (Staff Tier 3+)
 *     tags: [Currency]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *               - name
 *               - symbol
 *             properties:
 *               code:
 *                 type: string
 *               name:
 *                 type: string
 *               symbol:
 *                 type: string
 *               markup:
 *                 type: number
 *               fallbackRate:
 *                 type: number
 *               isActive:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Currency created successfully
 */
router.post('/', authenticateUser, requireStaffClearance(3), createCurrency);

/**
 * @swagger
 * /currencies/update-rates:
 *   post:
 *     summary: Update exchange rates from API (Staff Tier 3+)
 *     tags: [Currency]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Rates updated successfully
 */
router.post('/update-rates', authenticateUser, requireStaffClearance(3), updateRates);

/**
 * @swagger
 * /currencies/{code}:
 *   put:
 *     summary: Update currency (Staff Tier 3+)
 *     tags: [Currency]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               symbol:
 *                 type: string
 *               markup:
 *                 type: number
 *               fallbackRate:
 *                 type: number
 *               isActive:
 *                 type: boolean
 *               exchangeRate:
 *                 type: number
 *     responses:
 *       200:
 *         description: Currency updated successfully
 */
router.put('/:code', authenticateUser, requireStaffClearance(3), updateCurrency);

/**
 * @swagger
 * /currencies/{code}:
 *   delete:
 *     summary: Delete currency (Staff Tier 3+)
 *     tags: [Currency]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Currency deleted successfully
 */
router.delete('/:code', authenticateUser, requireStaffClearance(3), deleteCurrency);

module.exports = router;
