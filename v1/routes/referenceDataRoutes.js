// v1/routes/referenceDataRoutes.js
const express = require('express');
const referenceDataController = require('../controllers/referenceDataController');
const { authenticateUser, authorizeRoles } = require('../middleware/authMiddleware');
const { 
  validateQueryParams, 
  validateIATACode,
  sanitizeSearchQuery 
} = require('../middleware/validationMiddleware');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Airport:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Amadeus location ID
 *         type:
 *           type: string
 *           enum: [location]
 *         subType:
 *           type: string
 *           enum: [AIRPORT, CITY]
 *         name:
 *           type: string
 *           description: Airport or city name
 *         detailedName:
 *           type: string
 *           description: Detailed name with city and country
 *         iataCode:
 *           type: string
 *           description: 3-letter IATA code
 *         address:
 *           type: object
 *           properties:
 *             cityName:
 *               type: string
 *             cityCode:
 *               type: string
 *             countryName:
 *               type: string
 *             countryCode:
 *               type: string
 *             regionCode:
 *               type: string
 *         geoCode:
 *           type: object
 *           properties:
 *             latitude:
 *               type: number
 *             longitude:
 *               type: number
 *         timeZoneOffset:
 *           type: string
 *           description: UTC offset
 *         analytics:
 *           type: object
 *           properties:
 *             travelers:
 *               type: object
 *               properties:
 *                 score:
 *                   type: number
 *                   description: Popularity score
 *     
 *     Country:
 *       type: object
 *       properties:
 *         code:
 *           type: string
 *           description: 2-letter ISO country code
 *         name:
 *           type: string
 *           description: Country name
 *         continent:
 *           type: string
 *           description: Continent name
 *     
 *     ApiResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         data:
 *           type: array
 *         meta:
 *           type: object
 *           properties:
 *             count:
 *               type: number
 *             cached:
 *               type: boolean
 *             cacheAge:
 *               type: number
 */

/**
 * @swagger
 * /api/v1/reference/airports:
 *   get:
 *     summary: Get list of airports
 *     description: Retrieve a list of popular airports for flight search. Results are cached for performance.
 *     tags: [Reference Data]
 *     parameters:
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *         description: Search keyword for specific airports/cities
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Maximum number of results to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of results to skip for pagination
 *     responses:
 *       200:
 *         description: Airports retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Airport'
 *       400:
 *         description: Invalid query parameters
 *       500:
 *         description: Internal server error
 */
router.get('/airports', 
  validateQueryParams(['keyword', 'limit', 'offset']),
  sanitizeSearchQuery,
  referenceDataController.getAirports
);

/**
 * @swagger
 * /api/v1/reference/airports/search:
 *   get:
 *     summary: Search airports by keyword
 *     description: Search for airports and cities by name, IATA code, or location
 *     tags: [Reference Data]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 2
 *         description: Search query (minimum 2 characters)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *         description: Maximum number of results to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of results to skip for pagination
 *     responses:
 *       200:
 *         description: Search results retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Airport'
 *                     meta:
 *                       type: object
 *                       properties:
 *                         query:
 *                           type: string
 *                         count:
 *                           type: number
 *       400:
 *         description: Missing or invalid search query
 *       500:
 *         description: Internal server error
 */
router.get('/airports/search', 
  validateQueryParams(['q', 'limit', 'offset']),
  sanitizeSearchQuery,
  referenceDataController.searchAirports
);

/**
 * @swagger
 * /api/v1/reference/airports/{iataCode}:
 *   get:
 *     summary: Get airport details by IATA code
 *     description: Retrieve detailed information about a specific airport using its IATA code
 *     tags: [Reference Data]
 *     parameters:
 *       - in: path
 *         name: iataCode
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[A-Z]{3}$'
 *         description: 3-letter IATA airport code (e.g., JFK, LHR, DXB)
 *     responses:
 *       200:
 *         description: Airport details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Airport'
 *       400:
 *         description: Invalid IATA code format
 *       404:
 *         description: Airport not found
 *       500:
 *         description: Internal server error
 */
router.get('/airports/:iataCode', 
  validateIATACode,
  referenceDataController.getAirportDetails
);

/**
 * @swagger
 * /api/v1/reference/countries:
 *   get:
 *     summary: Get list of countries
 *     description: Retrieve a list of countries commonly used for travel destinations
 *     tags: [Reference Data]
 *     responses:
 *       200:
 *         description: Countries retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Country'
 *       500:
 *         description: Internal server error
 */
router.get('/countries', referenceDataController.getCountries);

// Admin routes (require authentication and admin role)
/**
 * @swagger
 * /api/v1/reference/cache/status:
 *   get:
 *     summary: Get cache status (Admin only)
 *     description: Retrieve information about the reference data cache status
 *     tags: [Reference Data, Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cache status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     airports:
 *                       type: object
 *                       properties:
 *                         cached:
 *                           type: boolean
 *                         count:
 *                           type: number
 *                         valid:
 *                           type: boolean
 *                     countries:
 *                       type: object
 *                       properties:
 *                         cached:
 *                           type: boolean
 *                         count:
 *                           type: number
 *                         valid:
 *                           type: boolean
 *                     cacheTimestamp:
 *                       type: number
 *                     cacheAge:
 *                       type: number
 *                     cacheDuration:
 *                       type: number
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin role required
 *       500:
 *         description: Internal server error
 */
router.get('/cache/status', 
  authenticateUser, 
  authorizeRoles('admin'), 
  referenceDataController.getCacheStatus
);

/**
 * @swagger
 * /api/v1/reference/cache/clear:
 *   post:
 *     summary: Clear reference data cache (Admin only)
 *     description: Clear the cached airports and countries data to force fresh data retrieval
 *     tags: [Reference Data, Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cache cleared successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                     message:
 *                       type: string
 *                     timestamp:
 *                       type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin role required
 *       500:
 *         description: Internal server error
 */
router.post('/cache/clear', 
  authenticateUser, 
  authorizeRoles('admin'), 
  referenceDataController.clearCache
);

module.exports = router;