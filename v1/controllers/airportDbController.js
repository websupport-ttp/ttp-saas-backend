// v1/controllers/airportDbController.js
const { StatusCodes } = require('http-status-codes');
const logger = require('../utils/logger');
const { ApiError } = require('../utils/apiError');
const airportDbService = require('../services/airportDbService');

/**
 * @function searchAirports
 * @description Search airports for autocomplete functionality
 * @route GET /api/v1/airportdb/search
 * @access Public
 */
const searchAirports = async (req, res, next) => {
  try {
    const { q: query, limit = 10 } = req.query;

    if (!query) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Search query parameter "q" is required',
        data: []
      });
    }

    if (query.length < 1) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Search query must be at least 1 character long',
        data: []
      });
    }

    const limitNum = Math.min(parseInt(limit) || 10, 50); // Max 50 results

    logger.info(`Airport search request: query="${query}", limit=${limitNum}`, {
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      query,
      limit: limitNum
    });

    const results = await airportDbService.searchAirportsForAutocomplete(query, {
      limit: limitNum
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: `Found ${results.length} airports matching "${query}"`,
      data: results.map(airport => ({
        iataCode: airport.iataCode,
        icaoCode: airport.icaoCode,
        name: airport.name,
        city: airport.city,
        country: airport.country,
        countryCode: airport.countryCode,
        displayName: airport.displayName,
        fullDisplayName: airport.fullDisplayName,
        coordinates: airport.latitude && airport.longitude ? {
          latitude: airport.latitude,
          longitude: airport.longitude
        } : null
      })),
      meta: {
        query,
        count: results.length,
        limit: limitNum,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Airport search failed:', error.message, {
      query: req.query.q,
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
};

/**
 * @function getAirportDetails
 * @description Get detailed airport information by IATA/ICAO code
 * @route GET /api/v1/airportdb/airport/:code
 * @access Public
 */
const getAirportDetails = async (req, res, next) => {
  try {
    const { code } = req.params;

    if (!code) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Airport code is required'
      });
    }

    logger.info(`Airport details request for code: ${code}`, {
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      code
    });

    const airport = await airportDbService.getAirportByCode(code);

    res.status(StatusCodes.OK).json({
      success: true,
      message: `Airport details for ${code}`,
      data: {
        iataCode: airport.iataCode,
        icaoCode: airport.icaoCode,
        name: airport.name,
        city: airport.city,
        country: airport.country,
        countryCode: airport.countryCode,
        coordinates: airport.latitude && airport.longitude ? {
          latitude: airport.latitude,
          longitude: airport.longitude
        } : null,
        elevation: airport.elevation,
        timezone: airport.timezone,
        type: airport.type,
        displayName: airport.displayName,
        fullDisplayName: airport.fullDisplayName
      },
      meta: {
        code,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error(`Airport details failed for code ${req.params.code}:`, error.message, {
      code: req.params.code,
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
};

/**
 * @function getPopularAirports
 * @description Get list of popular airports
 * @route GET /api/v1/airportdb/popular
 * @access Public
 */
const getPopularAirports = async (req, res, next) => {
  try {
    const { limit = 50, country } = req.query;
    const limitNum = Math.min(parseInt(limit) || 50, 100); // Max 100 results

    logger.info(`Popular airports request: limit=${limitNum}, country=${country || 'all'}`, {
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      limit: limitNum,
      country
    });

    const airports = await airportDbService.getPopularAirports({
      limit: limitNum,
      country
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: `Retrieved ${airports.length} popular airports`,
      data: airports.map(airport => ({
        iataCode: airport.iataCode,
        icaoCode: airport.icaoCode,
        name: airport.name,
        city: airport.city,
        country: airport.country,
        countryCode: airport.countryCode,
        displayName: airport.displayName,
        coordinates: airport.latitude && airport.longitude ? {
          latitude: airport.latitude,
          longitude: airport.longitude
        } : null
      })),
      meta: {
        count: airports.length,
        limit: limitNum,
        country: country || null,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Popular airports request failed:', error.message, {
      limit: req.query.limit,
      country: req.query.country,
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
};

/**
 * @function getCountries
 * @description Get list of countries with airports
 * @route GET /api/v1/airportdb/countries
 * @access Public
 */
const getCountries = async (req, res, next) => {
  try {
    logger.info('Countries request', {
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    const countries = await airportDbService.getCountries();

    res.status(StatusCodes.OK).json({
      success: true,
      message: `Retrieved ${countries.length} countries`,
      data: countries,
      meta: {
        count: countries.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Countries request failed:', error.message, {
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
};

/**
 * @function getCacheStatus
 * @description Get cache status information (Admin only)
 * @route GET /api/v1/airportdb/cache/status
 * @access Private (Admin)
 */
const getCacheStatus = async (req, res, next) => {
  try {
    logger.info('Cache status request', {
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: req.user?.id
    });

    const status = airportDbService.getCacheStatus();

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Cache status retrieved',
      data: status,
      meta: {
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Cache status request failed:', error.message, {
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
};

/**
 * @function clearCache
 * @description Clear all caches (Admin only)
 * @route POST /api/v1/airportdb/cache/clear
 * @access Private (Admin)
 */
const clearCache = async (req, res, next) => {
  try {
    logger.info('Cache clear request', {
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: req.user?.id
    });

    const result = airportDbService.clearCache();

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Cache cleared successfully',
      data: result,
      meta: {
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Cache clear request failed:', error.message, {
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
};

/**
 * @function initializeCache
 * @description Initialize airport cache by fetching all airports
 * @route POST /api/v1/airportdb/cache/init
 * @access Private (Admin)
 */
const initializeCache = async (req, res, next) => {
  try {
    logger.info('Cache initialization request', {
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: req.user?.id
    });

    const airports = await airportDbService.getAllAirports();

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Cache initialized successfully',
      data: {
        airportsLoaded: airports.length,
        timestamp: new Date().toISOString()
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Cache initialization failed:', error.message, {
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
};

module.exports = {
  searchAirports,
  getAirportDetails,
  getPopularAirports,
  getCountries,
  getCacheStatus,
  clearCache,
  initializeCache
};