// v1/middleware/errorHandler.js
const { StatusCodes } = require('http-status-codes');
const { 
  ApiError, 
  ValidationError, 
  AuthenticationError, 
  AuthorizationError, 
  ThirdPartyServiceError, 
  DatabaseError 
} = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const logger = require('../utils/logger');
const ErrorLog = require('../models/errorLogModel');
const { circuitBreakerManager } = require('../utils/circuitBreaker');

/**
 * @function getErrorContext
 * @description Extract relevant context from request for error logging
 * @param {object} req - Express request object
 * @returns {object} Error context
 */
const getErrorContext = (req) => {
  return {
    method: req.method,
    url: req.originalUrl,
    endpoint: req.originalUrl, // Add endpoint field for compatibility
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: req.user?.userId || 'anonymous',
    timestamp: new Date().toISOString(),
    requestId: req.id || 'unknown',
    body: req.method !== 'GET' && req.body ? JSON.stringify(req.body) : undefined,
    query: req.query && Object.keys(req.query).length > 0 ? JSON.stringify(req.query) : undefined,
  };
};

/**
 * @function classifyError
 * @description Classify error type for better handling
 * @param {Error} err - The error object
 * @returns {object} Error classification
 */
const classifyError = (err) => {
  // Database errors
  if (err.name === 'MongoError' || err.name === 'MongooseError') {
    return { category: 'database', severity: 'high' };
  }

  // Validation errors
  if (err.name === 'ValidationError' || err.name === 'ZodError') {
    return { category: 'validation', severity: 'low' };
  }

  // Authentication/Authorization errors
  if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError' || err.statusCode === 401 || err.statusCode === 403) {
    return { category: 'auth', severity: 'medium' };
  }

  // Third-party service errors
  if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND') {
    return { category: 'external_service', severity: 'high' };
  }

  // Rate limiting errors
  if (err.statusCode === 429) {
    return { category: 'rate_limit', severity: 'medium' };
  }

  // File system errors
  if (err.code === 'ENOENT' || err.code === 'EACCES') {
    return { category: 'filesystem', severity: 'high' };
  }

  // Default classification
  return { category: 'unknown', severity: 'high' };
};

/**
 * @function logError
 * @description Enhanced error logging with context and classification
 * @param {Error} err - The error object
 * @param {object} req - Express request object
 * @param {object} classification - Error classification
 */
const logError = async (err, req, classification) => {
  const context = getErrorContext(req);
  const errorInfo = {
    message: err.message,
    stack: err.stack,
    name: err.name,
    code: err.code,
    statusCode: err.statusCode,
    classification,
    context,
  };

  // Log to Winston logger based on severity
  switch (classification.severity) {
    case 'low':
      logger.warn('Low severity error occurred', errorInfo);
      break;
    case 'medium':
      logger.error('Medium severity error occurred', errorInfo);
      break;
    case 'high':
    default:
      logger.error('High severity error occurred', errorInfo);
      break;
  }

  // Additional logging for specific error categories
  if (classification.category === 'external_service') {
    logger.logExternalService(
      err.service || 'unknown',
      err.operation || 'unknown',
      0, // duration not available in error context
      false, // failed
      { error: err.message, context }
    );
  }

  // Log to database for tracking and analysis
  try {
    await ErrorLog.logError(err, context, classification);
  } catch (dbError) {
    logger.error('Failed to log error to database', {
      originalError: err.message,
      dbError: dbError.message
    });
  }
};

/**
 * @function handleSpecificErrors
 * @description Handle specific error types with custom logic and recovery mechanisms
 * @param {Error} err - The error object
 * @param {object} req - Express request object
 * @returns {ApiError|null} Processed error or null if not handled
 */
const handleSpecificErrors = (err, req) => {
  // If error is already one of our custom error types, don't process it further
  if (err instanceof ApiError || err instanceof ValidationError || 
      err instanceof AuthenticationError || err instanceof AuthorizationError ||
      err instanceof ThirdPartyServiceError || err instanceof DatabaseError) {
    return null; // Let the main handler use the original error
  }
  
  // Also skip if it's already an ApiError with a specific error code (from our system)
  if (err.code && ['VALIDATION_ERROR', 'AUTHENTICATION_ERROR', 'AUTHORIZATION_ERROR', 
                   'THIRD_PARTY_SERVICE_ERROR', 'DATABASE_ERROR', 'RATE_LIMIT_ERROR'].includes(err.code)) {
    return null;
  }
  // Mongoose Bad ObjectId
  if (err.name === 'CastError') {
    const message = `Invalid ${err.path}: ${err.value}`;
    return new ValidationError(message, [`Invalid ${err.path} format`], {
      field: err.path,
      value: err.value,
      expectedType: err.kind
    });
  }

  // Mongoose Duplicate Key (e.g., unique email)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    const message = `${field} '${value}' already exists. Please use a different ${field}.`;
    return new ValidationError(message, [`Duplicate ${field}`], {
      field,
      value,
      constraint: 'unique'
    });
  }

  // Mongoose Validation Error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((val) => val.message);
    const fieldErrors = Object.keys(err.errors).map(field => ({
      field,
      message: err.errors[field].message,
      value: err.errors[field].value
    }));
    return new ValidationError('Validation failed', messages, { fieldErrors });
  }

  // Zod Validation Error
  if (err.name === 'ZodError') {
    const messages = err.errors.map((e) => {
      const path = e.path.join('.');
      return `${path}: ${e.message}`;
    });
    const fieldErrors = err.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message,
      code: e.code
    }));
    return new ValidationError('Validation failed', messages, { fieldErrors });
  }

  // JWT Token Expired Error
  if (err.name === 'TokenExpiredError') {
    return new AuthenticationError('Your session has expired. Please log in again.', {
      tokenExpired: true,
      expiredAt: err.expiredAt
    });
  }

  // JWT Invalid Token Error
  if (err.name === 'JsonWebTokenError') {
    return new AuthenticationError('Invalid authentication token. Please log in again.', {
      tokenInvalid: true,
      reason: err.message
    });
  }

  // Multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return new ValidationError('File size too large. Please upload a smaller file.', 
      ['File exceeds maximum size limit'], {
        maxSize: err.limit,
        receivedSize: err.received || 'unknown'
      });
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    return new ValidationError('Too many files uploaded. Please reduce the number of files.',
      ['File count exceeds limit'], {
        maxFiles: err.limit,
        receivedFiles: err.received || 'unknown'
      });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return new ValidationError('Unexpected file field. Please check your file upload configuration.',
      ['Unexpected file field'], {
        fieldName: err.field
      });
  }

  // Rate limiting errors
  if (err.statusCode === 429) {
    return new ApiError('Too many requests. Please try again later.', StatusCodes.TOO_MANY_REQUESTS, 
      [], 'RATE_LIMIT_ERROR', {
        retryAfter: err.retryAfter || 60,
        limit: err.limit,
        remaining: err.remaining
      });
  }

  // Database connection errors with recovery suggestions
  if (err.name === 'MongoNetworkError' || err.name === 'MongoTimeoutError') {
    return new DatabaseError('Database connection', err, {
      recovery: 'Please try again in a few moments',
      retryable: true
    });
  }

  // Third-party service errors with circuit breaker logic
  if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND') {
    const serviceName = err.hostname || err.address || 'External service';
    return new ThirdPartyServiceError(serviceName, 'connection', err, {
      recovery: 'Service temporarily unavailable. Please try again later.',
      retryable: true,
      circuitBreakerTriggered: shouldTriggerCircuitBreaker(serviceName, err)
    });
  }

  // File system errors
  if (err.code === 'ENOENT') {
    return new ApiError('Requested file not found.', StatusCodes.NOT_FOUND, 
      [], 'FILE_NOT_FOUND', {
        path: err.path,
        syscall: err.syscall
      });
  }

  if (err.code === 'EACCES') {
    return new ApiError('File access denied.', StatusCodes.FORBIDDEN,
      [], 'FILE_ACCESS_DENIED', {
        path: err.path,
        syscall: err.syscall
      });
  }

  // Axios/HTTP errors with detailed context
  if (err.response) {
    const status = err.response.status;
    const message = err.response.data?.message || 'External service error';
    const serviceName = err.config?.baseURL || err.config?.url || 'External service';
    
    if (status >= 400 && status < 500) {
      return new ThirdPartyServiceError(serviceName, 'request', err, {
        statusCode: status,
        responseData: err.response.data,
        retryable: false
      });
    } else if (status >= 500) {
      return new ThirdPartyServiceError(serviceName, 'server_error', err, {
        statusCode: status,
        retryable: true,
        recovery: 'External service temporarily unavailable. Please try again later.'
      });
    }
  }

  // Axios request errors (network issues)
  if (err.request && !err.response) {
    const serviceName = err.config?.baseURL || err.config?.url || 'External service';
    return new ThirdPartyServiceError(serviceName, 'network', err, {
      retryable: true,
      recovery: 'Network error occurred. Please check your connection and try again.'
    });
  }

  return null; // Not handled by specific error handlers
};

/**
 * @function shouldTriggerCircuitBreaker
 * @description Determine if circuit breaker should be triggered for a service
 * @param {string} serviceName - Name of the service
 * @param {Error} error - The error that occurred
 * @returns {boolean} Whether to trigger circuit breaker
 */
const shouldTriggerCircuitBreaker = (serviceName, error) => {
  const criticalErrors = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET'];
  const shouldTrigger = criticalErrors.includes(error.code) || 
                       (error.statusCode >= 500) ||
                       error.name === 'MongoNetworkError' ||
                       error.name === 'MongoTimeoutError';
  
  if (shouldTrigger) {
    // Get or create circuit breaker for this service
    const circuitBreaker = circuitBreakerManager.getCircuitBreaker(serviceName, {
      failureThreshold: 3,
      recoveryTimeout: 30000, // 30 seconds
      expectedErrors: [400, 401, 403, 404] // Don't trigger on client errors
    });
    
    // The circuit breaker will handle the failure internally
    logger.warn(`Circuit breaker triggered for service: ${serviceName}`, {
      error: error.message,
      errorCode: error.code,
      statusCode: error.statusCode
    });
  }
  
  return shouldTrigger;
};

/**
 * @function sanitizeErrorForProduction
 * @description Sanitize error details for production environment
 * @param {ApiError} error - The processed error
 * @param {Error} originalError - The original error
 * @returns {object} Sanitized error response
 */
const sanitizeErrorForProduction = (error, originalError) => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (!isProduction) {
    return {
      message: error.message,
      errors: error.errors || [],
      stack: originalError.stack,
      details: {
        name: originalError.name,
        code: originalError.code,
      }
    };
  }

  // In production, only return safe error information
  if (error.isOperational) {
    return {
      message: error.message,
      errors: error.errors || []
    };
  }

  // For non-operational errors, return generic message
  return {
    message: 'An unexpected error occurred. Please try again later.',
    errors: []
  };
};

/**
 * @function errorHandler
 * @description Enhanced global error handling middleware for Express.
 * Catches errors, logs them with context, and sends standardized error responses.
 * @param {Error} err - The error object.
 * @param {object} req - The Express request object.
 * @param {object} res - The Express response object.
 * @param {function} next - The next middleware function (not used here as it's a terminal handler).
 */
const errorHandler = async (err, req, res, next) => {
  try {
    // Classify and log the error
    const classification = classifyError(err);
    await logError(err, req, classification);

    // Handle specific error types with recovery mechanisms
    let processedError = handleSpecificErrors(err, req);

    // If not handled by specific handlers, create a generic ApiError
    if (!processedError) {
      if (err instanceof ApiError || err instanceof ValidationError || 
          err instanceof AuthenticationError || err instanceof AuthorizationError ||
          err instanceof ThirdPartyServiceError || err instanceof DatabaseError) {
        processedError = err;
      } else {
        processedError = new ApiError(
          err.message || 'An unexpected error occurred',
          err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR,
          [],
          'UNKNOWN_ERROR',
          { originalErrorName: err.name }
        );
        // Mark unknown errors as non-operational for production safety
        processedError.isOperational = false;
      }
    }

    // Add recovery suggestions for retryable errors
    const errorResponse = sanitizeErrorForProduction(processedError, err);
    
    // Add recovery information if available
    if (processedError.context?.recovery) {
      errorResponse.recovery = processedError.context.recovery;
    }
    
    if (processedError.context?.retryable) {
      errorResponse.retryable = true;
      errorResponse.retryAfter = processedError.context.retryAfter || 60;
    }

    // Set appropriate headers for specific error types
    if (processedError.statusCode === StatusCodes.TOO_MANY_REQUESTS) {
      res.set('Retry-After', processedError.context?.retryAfter || 60);
    }

    if (processedError.context?.circuitBreakerTriggered || err.circuitBreakerOpen) {
      res.set('X-Circuit-Breaker', 'OPEN');
    }

    // Send standardized error response with enhanced information
    ApiResponse.error(
      res,
      processedError.statusCode || StatusCodes.INTERNAL_SERVER_ERROR,
      errorResponse.message,
      errorResponse.errors,
      {
        errorId: processedError.errorId,
        errorCode: processedError.code,
        timestamp: processedError.timestamp,
        ...(errorResponse.stack && { stack: errorResponse.stack, details: errorResponse.details })
      },
      {
        recovery: errorResponse.recovery,
        retryable: errorResponse.retryable,
        retryAfter: errorResponse.retryAfter
      }
    );
  } catch (handlerError) {
    // Fallback error handling if the error handler itself fails
    logger.error('Error handler failed', {
      originalError: err.message,
      handlerError: handlerError.message,
      stack: handlerError.stack
    });

    // Send minimal error response
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'An unexpected error occurred',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * @function notFoundHandler
 * @description Handle 404 errors for undefined routes
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Next middleware function
 */
const notFoundHandler = (req, res, next) => {
  const error = new ApiError(
    `Route ${req.originalUrl} not found`,
    StatusCodes.NOT_FOUND
  );
  next(error);
};

module.exports = { errorHandler, notFoundHandler };