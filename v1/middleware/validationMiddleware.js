// v1/middleware/validationMiddleware.js
const asyncHandler = require('./asyncHandler');
const { ApiError } = require('../utils/apiError');
const { StatusCodes } = require('http-status-codes');

/**
 * @function validate
 * @description Middleware to validate request body, params, or query using Zod schemas.
 * @param {object} schema - The Zod schema to use for validation.
 * @returns {Function} An Express middleware function.
 */
const validate = (schema) =>
  asyncHandler(async (req, res, next) => {
    try {
      // Validate request body, params, and query based on the schema
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error.name === 'ZodError') {
        const messages = error.errors.map((err) => `${err.path.join('.')} - ${err.message}`);
        throw new ApiError(`Validation failed: ${messages.join(', ')}`, StatusCodes.BAD_REQUEST);
      }
      next(error); // Pass other errors to the global error handler
    }
  });

/**
 * @function validateQueryParams
 * @description Middleware to validate and sanitize query parameters.
 * @param {Array} allowedParams - Array of allowed query parameter names.
 * @returns {Function} An Express middleware function.
 */
const validateQueryParams = (allowedParams = []) =>
  asyncHandler(async (req, res, next) => {
    const queryKeys = Object.keys(req.query);
    
    // Check for unexpected parameters
    const unexpectedParams = queryKeys.filter(key => !allowedParams.includes(key));
    if (unexpectedParams.length > 0) {
      throw new ApiError(
        `Unexpected query parameters: ${unexpectedParams.join(', ')}. Allowed parameters: ${allowedParams.join(', ')}`,
        StatusCodes.BAD_REQUEST
      );
    }

    // Validate specific parameter types
    if (req.query.limit) {
      const limit = parseInt(req.query.limit);
      if (isNaN(limit) || limit < 1 || limit > 100) {
        throw new ApiError('Limit must be a number between 1 and 100', StatusCodes.BAD_REQUEST);
      }
      req.query.limit = limit;
    }

    if (req.query.offset) {
      const offset = parseInt(req.query.offset);
      if (isNaN(offset) || offset < 0) {
        throw new ApiError('Offset must be a non-negative number', StatusCodes.BAD_REQUEST);
      }
      req.query.offset = offset;
    }

    next();
  });

/**
 * @function validateIATACode
 * @description Middleware to validate IATA airport codes.
 * @returns {Function} An Express middleware function.
 */
const validateIATACode = asyncHandler(async (req, res, next) => {
  const { iataCode } = req.params;
  
  if (!iataCode) {
    throw new ApiError('IATA code is required', StatusCodes.BAD_REQUEST);
  }

  // IATA codes are exactly 3 letters
  const iataRegex = /^[A-Z]{3}$/;
  const upperIataCode = iataCode.toUpperCase();
  
  if (!iataRegex.test(upperIataCode)) {
    throw new ApiError('IATA code must be exactly 3 letters (e.g., JFK, LHR, DXB)', StatusCodes.BAD_REQUEST);
  }

  // Update the parameter to uppercase for consistency
  req.params.iataCode = upperIataCode;
  next();
});

/**
 * @function sanitizeSearchQuery
 * @description Middleware to sanitize search query parameters.
 * @returns {Function} An Express middleware function.
 */
const sanitizeSearchQuery = asyncHandler(async (req, res, next) => {
  if (req.query.q) {
    // Remove potentially harmful characters and trim whitespace
    req.query.q = req.query.q
      .replace(/[<>\"'%;()&+]/g, '') // Remove potentially harmful characters
      .trim()
      .substring(0, 100); // Limit length to prevent abuse
    
    if (req.query.q.length < 2) {
      throw new ApiError('Search query must be at least 2 characters long', StatusCodes.BAD_REQUEST);
    }
  }

  if (req.query.keyword) {
    // Same sanitization for keyword parameter
    req.query.keyword = req.query.keyword
      .replace(/[<>\"'%;()&+]/g, '')
      .trim()
      .substring(0, 100);
    
    if (req.query.keyword.length < 2) {
      throw new ApiError('Keyword must be at least 2 characters long', StatusCodes.BAD_REQUEST);
    }
  }

  next();
});

module.exports = {
  validate,
  validateQueryParams,
  validateIATACode,
  sanitizeSearchQuery
};