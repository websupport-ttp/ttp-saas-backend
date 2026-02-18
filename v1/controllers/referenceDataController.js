// v1/controllers/referenceDataController.js
const { StatusCodes } = require('http-status-codes');
const referenceDataService = require('../services/referenceDataService');
const logger = require('../utils/logger');
const { ApiError } = require('../utils/apiError');

/**
 * @function getAirports
 * @description Get list of airports for flight search
 * @route GET /api/v1/reference/airports
 * @access Public
 */
const getAirports = async (req, res, next) => {
  try {
    const { keyword, limit, offset } = req.query;
    
    logger.info('Fetching airports list', { 
      keyword, 
      limit: limit || 'default',
      offset: offset || 0,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    const options = {};
    if (keyword) options.keyword = keyword;
    if (limit) options.limit = parseInt(limit);
    if (offset) options.offset = parseInt(offset);

    const result = await referenceDataService.getAirports(options);

    // Add metadata for API response
    const response = {
      success: true,
      message: keyword ? `Found ${result.data.length} airports matching "${keyword}"` : 'Airports retrieved successfully',
      data: result.data,
      meta: {
        count: result.data.length,
        cached: result.cached || false,
        ...(result.cacheAge && { cacheAge: result.cacheAge }),
        ...(result.expired && { expired: result.expired }),
        ...(result.error && { cacheError: result.error }),
        ...(result.meta && result.meta) // Include Amadeus API meta if available
      }
    };

    // Set appropriate cache headers
    if (result.cached && !result.expired) {
      res.set('Cache-Control', 'public, max-age=3600'); // 1 hour for cached data
    } else {
      res.set('Cache-Control', 'public, max-age=300'); // 5 minutes for fresh data
    }

    res.status(StatusCodes.OK).json(response);

  } catch (error) {
    logger.error('Error fetching airports:', {
      error: error.message,
      stack: error.stack,
      keyword: req.query.keyword,
      ip: req.ip
    });
    next(error);
  }
};

/**
 * @function getCountries
 * @description Get list of countries for travel destinations
 * @route GET /api/v1/reference/countries
 * @access Public
 */
const getCountries = async (req, res, next) => {
  try {
    logger.info('Fetching countries list', { 
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    const result = await referenceDataService.getCountries();

    const response = {
      success: true,
      message: 'Countries retrieved successfully',
      data: result.data,
      meta: {
        count: result.data.length,
        cached: result.cached || false,
        ...(result.cacheAge && { cacheAge: result.cacheAge }),
        ...(result.expired && { expired: result.expired }),
        ...(result.error && { cacheError: result.error })
      }
    };

    // Set cache headers - countries change very rarely
    if (result.cached && !result.expired) {
      res.set('Cache-Control', 'public, max-age=86400'); // 24 hours for cached data
    } else {
      res.set('Cache-Control', 'public, max-age=3600'); // 1 hour for fresh data
    }

    res.status(StatusCodes.OK).json(response);

  } catch (error) {
    logger.error('Error fetching countries:', {
      error: error.message,
      stack: error.stack,
      ip: req.ip
    });
    next(error);
  }
};

/**
 * @function searchAirports
 * @description Search airports by keyword
 * @route GET /api/v1/reference/airports/search
 * @access Public
 */
const searchAirports = async (req, res, next) => {
  try {
    const { q: query, limit, offset } = req.query;

    if (!query) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Search query parameter "q" is required',
        error: 'MISSING_QUERY_PARAMETER'
      });
    }

    if (query.trim().length < 2) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Search query must be at least 2 characters long',
        error: 'QUERY_TOO_SHORT'
      });
    }

    logger.info('Searching airports', { 
      query,
      limit: limit || 'default',
      offset: offset || 0,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    const options = {};
    if (limit) options.limit = parseInt(limit);
    if (offset) options.offset = parseInt(offset);

    const result = await referenceDataService.searchAirports(query, options);

    const response = {
      success: true,
      message: `Found ${result.data.length} airports matching "${query}"`,
      data: result.data,
      meta: {
        query: result.query,
        count: result.data.length,
        ...(result.meta && result.meta) // Include Amadeus API meta if available
      }
    };

    // Set cache headers for search results (shorter cache time)
    res.set('Cache-Control', 'public, max-age=300'); // 5 minutes

    res.status(StatusCodes.OK).json(response);

  } catch (error) {
    logger.error('Error searching airports:', {
      error: error.message,
      stack: error.stack,
      query: req.query.q,
      ip: req.ip
    });
    next(error);
  }
};

/**
 * @function getCacheStatus
 * @description Get cache status for reference data (admin endpoint)
 * @route GET /api/v1/reference/cache/status
 * @access Private (Admin)
 */
const getCacheStatus = async (req, res, next) => {
  try {
    logger.info('Fetching cache status', { 
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    const status = referenceDataService.getCacheStatus();

    const response = {
      success: true,
      message: 'Cache status retrieved successfully',
      data: status
    };

    res.status(StatusCodes.OK).json(response);

  } catch (error) {
    logger.error('Error fetching cache status:', {
      error: error.message,
      stack: error.stack,
      ip: req.ip
    });
    next(error);
  }
};

/**
 * @function clearCache
 * @description Clear reference data cache (admin endpoint)
 * @route POST /api/v1/reference/cache/clear
 * @access Private (Admin)
 */
const clearCache = async (req, res, next) => {
  try {
    logger.info('Clearing reference data cache', { 
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: req.user?.id
    });

    const result = referenceDataService.clearCache();

    const response = {
      success: true,
      message: 'Cache cleared successfully',
      data: result
    };

    res.status(StatusCodes.OK).json(response);

  } catch (error) {
    logger.error('Error clearing cache:', {
      error: error.message,
      stack: error.stack,
      ip: req.ip,
      userId: req.user?.id
    });
    next(error);
  }
};

/**
 * @function getAirportDetails
 * @description Get detailed information about a specific airport
 * @route GET /api/v1/reference/airports/:iataCode
 * @access Public
 */
const getAirportDetails = async (req, res, next) => {
  try {
    const { iataCode } = req.params;

    if (!iataCode || iataCode.length !== 3) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Valid IATA code (3 characters) is required',
        error: 'INVALID_IATA_CODE'
      });
    }

    logger.info('Fetching airport details', { 
      iataCode: iataCode.toUpperCase(),
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    // Search for the specific airport
    const result = await referenceDataService.searchAirports(iataCode.toUpperCase());
    
    // Find exact match by IATA code
    const airport = result.data.find(a => a.iataCode === iataCode.toUpperCase());

    if (!airport) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: `Airport with IATA code "${iataCode.toUpperCase()}" not found`,
        error: 'AIRPORT_NOT_FOUND'
      });
    }

    const response = {
      success: true,
      message: `Airport details retrieved for ${iataCode.toUpperCase()}`,
      data: airport
    };

    // Set cache headers
    res.set('Cache-Control', 'public, max-age=3600'); // 1 hour

    res.status(StatusCodes.OK).json(response);

  } catch (error) {
    logger.error('Error fetching airport details:', {
      error: error.message,
      stack: error.stack,
      iataCode: req.params.iataCode,
      ip: req.ip
    });
    next(error);
  }
};

module.exports = {
  getAirports,
  getCountries,
  searchAirports,
  getCacheStatus,
  clearCache,
  getAirportDetails
};