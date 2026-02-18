// v1/routes/airportDbRoutes.js
const express = require('express');
const rateLimit = require('express-rate-limit');
const { authenticateUser, authorizeRoles } = require('../middleware/authMiddleware');
const airportDbController = require('../controllers/airportDbController');

const router = express.Router();

// Rate limiting for airport search (more generous for autocomplete)
const searchRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute for search
  message: {
    success: false,
    message: 'Too many search requests. Please try again later.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for general endpoints
const generalRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute for other endpoints
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for admin endpoints
const adminRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 requests per 5 minutes for admin endpoints
  message: {
    success: false,
    message: 'Too many admin requests. Please try again later.',
    retryAfter: 300
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * @swagger
 * components:
 *   schemas:
 *     Airport:
 *       type: object
 *       properties:
 *         iataCode:
 *           type: string
 *           description: IATA airport code
 *           example: "JFK"
 *         icaoCode:
 *           type: string
 *           description: ICAO airport code
 *           example: "KJFK"
 *         name:
 *           type: string
 *           description: Airport name
 *           example: "John F Kennedy International Airport"
 *         city:
 *           type: string
 *           description: City name
 *           example: "New York"
 *         country:
 *           type: string
 *           description: Country name
 *           example: "United States"
 *         countryCode:
 *           type: string
 *           description: ISO country code
 *           example: "US"
 *         displayName:
 *           type: string
 *           description: Short display name for autocomplete
 *           example: "John F Kennedy International Airport (JFK)"
 *         fullDisplayName:
 *           type: string
 *           description: Full display name with location
 *           example: "John F Kennedy International Airport, New York, United States (JFK)"
 *         coordinates:
 *           type: object
 *           properties:
 *             latitude:
 *               type: number
 *               example: 40.6413
 *             longitude:
 *               type: number
 *               example: -73.7781
 *     
 *     Country:
 *       type: object
 *       properties:
 *         code:
 *           type: string
 *           description: ISO country code
 *           example: "US"
 *         name:
 *           type: string
 *           description: Country name
 *           example: "United States"
 *         airportCount:
 *           type: number
 *           description: Number of airports in this country
 *           example: 150
 *
 *   responses:
 *     AirportSearchResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Found 5 airports matching \"new york\""
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Airport'
 *         meta:
 *           type: object
 *           properties:
 *             query:
 *               type: string
 *               example: "new york"
 *             count:
 *               type: number
 *               example: 5
 *             limit:
 *               type: number
 *               example: 10
 *             timestamp:
 *               type: string
 *               format: date-time
 */

/**
 * @swagger
 * /api/v1/airportdb/search:
 *   get:
 *     summary: Search airports for autocomplete
 *     description: Search airports by name, city, country, or IATA/ICAO code. Optimized for autocomplete functionality with intelligent ranking.
 *     tags: [AirportDB]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 1
 *         description: Search query (airport name, city, country, or airport code)
 *         example: "new york"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Maximum number of results to return
 *         example: 10
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/responses/AirportSearchResponse'
 *       400:
 *         description: Invalid search parameters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Search query parameter 'q' is required"
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: Internal server error
 */
router.get('/search', searchRateLimit, airportDbController.searchAirports);

/**
 * @swagger
 * /api/v1/airportdb/airport/{code}:
 *   get:
 *     summary: Get airport details by code
 *     description: Retrieve detailed information about a specific airport using its IATA or ICAO code
 *     tags: [AirportDB]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 3
 *           maxLength: 4
 *         description: Airport IATA or ICAO code
 *         example: "JFK"
 *     responses:
 *       200:
 *         description: Airport details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Airport details for JFK"
 *                 data:
 *                   $ref: '#/components/schemas/Airport'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "JFK"
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid airport code
 *       404:
 *         description: Airport not found
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: Internal server error
 */
router.get('/airport/:code', generalRateLimit, airportDbController.getAirportDetails);

/**
 * @swagger
 * /api/v1/airportdb/popular:
 *   get:
 *     summary: Get popular airports
 *     description: Retrieve a list of popular airports (major international hubs). Can be filtered by country.
 *     tags: [AirportDB]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Maximum number of airports to return
 *         example: 50
 *       - in: query
 *         name: country
 *         schema:
 *           type: string
 *           minLength: 2
 *           maxLength: 2
 *         description: ISO country code to filter by
 *         example: "US"
 *     responses:
 *       200:
 *         description: List of popular airports
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Retrieved 50 popular airports"
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Airport'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     count:
 *                       type: number
 *                       example: 50
 *                     limit:
 *                       type: number
 *                       example: 50
 *                     country:
 *                       type: string
 *                       nullable: true
 *                       example: "US"
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: Internal server error
 */
router.get('/popular', generalRateLimit, airportDbController.getPopularAirports);

/**
 * @swagger
 * /api/v1/airportdb/countries:
 *   get:
 *     summary: Get countries with airports
 *     description: Retrieve a list of all countries that have airports in the database
 *     tags: [AirportDB]
 *     responses:
 *       200:
 *         description: List of countries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Retrieved 195 countries"
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Country'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     count:
 *                       type: number
 *                       example: 195
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: Internal server error
 */
router.get('/countries', generalRateLimit, airportDbController.getCountries);

/**
 * @swagger
 * /api/v1/airportdb/cache/status:
 *   get:
 *     summary: Get cache status (Admin only)
 *     description: Retrieve information about the current cache status including size and validity
 *     tags: [AirportDB, Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cache status information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Cache status retrieved"
 *                 data:
 *                   type: object
 *                   properties:
 *                     airports:
 *                       type: object
 *                       properties:
 *                         count:
 *                           type: number
 *                           example: 5000
 *                         valid:
 *                           type: boolean
 *                           example: true
 *                     autocomplete:
 *                       type: object
 *                       properties:
 *                         count:
 *                           type: number
 *                           example: 25
 *                         entries:
 *                           type: array
 *                           items:
 *                             type: string
 *                           example: ["new york_10", "london_10"]
 *                     countries:
 *                       type: object
 *                       properties:
 *                         count:
 *                           type: number
 *                           example: 195
 *                         valid:
 *                           type: boolean
 *                           example: true
 *                     cacheTimestamp:
 *                       type: number
 *                       nullable: true
 *                       example: 1640995200000
 *                     cacheAge:
 *                       type: number
 *                       nullable: true
 *                       example: 3600000
 *                     cacheDuration:
 *                       type: number
 *                       example: 86400000
 *                     autocompleteCacheDuration:
 *                       type: number
 *                       example: 3600000
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Admin access required
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: Internal server error
 */
router.get('/cache/status', adminRateLimit, authenticateUser, authorizeRoles(['Admin']), airportDbController.getCacheStatus);

/**
 * @swagger
 * /api/v1/airportdb/cache/clear:
 *   post:
 *     summary: Clear all caches (Admin only)
 *     description: Clear all cached data to force fresh data retrieval on next request
 *     tags: [AirportDB, Admin]
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
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Cache cleared successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       example: true
 *                     message:
 *                       type: string
 *                       example: "All caches cleared successfully"
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Admin access required
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: Internal server error
 */
router.post('/cache/clear', adminRateLimit, authenticateUser, authorizeRoles(['Admin']), airportDbController.clearCache);

/**
 * @swagger
 * /api/v1/airportdb/cache/init:
 *   post:
 *     summary: Initialize cache (Admin only)
 *     description: Manually initialize the airport cache by fetching all airports from AirportDB
 *     tags: [AirportDB, Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cache initialized successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Cache initialized successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     airportsLoaded:
 *                       type: number
 *                       example: 5000
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Admin access required
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: Internal server error
 */
router.post('/cache/init', adminRateLimit, authenticateUser, authorizeRoles(['Admin']), airportDbController.initializeCache);

module.exports = router;