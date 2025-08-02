// v1/utils/apiError.js
const { StatusCodes } = require('http-status-codes');

/**
 * @class ApiError
 * @extends Error
 * @description Enhanced custom error class for API errors with comprehensive error handling.
 * Supports multiple error messages, error codes, and contextual information.
 */
class ApiError extends Error {
  /**
   * Creates an instance of ApiError.
   * @param {string} message - The primary error message.
   * @param {number} statusCode - The HTTP status code for the error.
   * @param {Array<string>} errors - Array of specific error details (optional).
   * @param {string} code - Error code for programmatic handling (optional).
   * @param {object} context - Additional context information (optional).
   */
  constructor(
    message, 
    statusCode = StatusCodes.INTERNAL_SERVER_ERROR, 
    errors = [], 
    code = null, 
    context = {}
  ) {
    super(message);
    
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true; // Indicates if the error is operational (e.g., user input error)
    this.errors = Array.isArray(errors) ? errors : [errors].filter(Boolean);
    this.code = code;
    this.context = context;
    this.timestamp = new Date().toISOString();
    this.errorId = this.generateErrorId();

    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Generate unique error ID for tracking
   * @returns {string} Unique error ID
   */
  generateErrorId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `ERR_${timestamp}_${random}`.toUpperCase();
  }

  /**
   * Convert error to JSON representation
   * @returns {object} JSON representation of the error
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      status: this.status,
      errors: this.errors,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp,
      isOperational: this.isOperational,
    };
  }

  /**
   * Create a validation error
   * @param {string} message - Error message
   * @param {Array<string>} validationErrors - Array of validation error details
   * @param {object} context - Additional context
   * @returns {ApiError} Validation error instance
   */
  static validationError(message = 'Validation failed', validationErrors = [], context = {}) {
    return new ApiError(
      message,
      StatusCodes.BAD_REQUEST,
      validationErrors,
      'VALIDATION_ERROR',
      context
    );
  }

  /**
   * Create an authentication error
   * @param {string} message - Error message
   * @param {object} context - Additional context
   * @returns {ApiError} Authentication error instance
   */
  static authenticationError(message = 'Authentication failed', context = {}) {
    return new ApiError(
      message,
      StatusCodes.UNAUTHORIZED,
      [],
      'AUTHENTICATION_ERROR',
      context
    );
  }

  /**
   * Create an authorization error
   * @param {string} message - Error message
   * @param {object} context - Additional context
   * @returns {ApiError} Authorization error instance
   */
  static authorizationError(message = 'Access denied', context = {}) {
    return new ApiError(
      message,
      StatusCodes.FORBIDDEN,
      [],
      'AUTHORIZATION_ERROR',
      context
    );
  }

  /**
   * Create a not found error
   * @param {string} resource - Resource that was not found
   * @param {object} context - Additional context
   * @returns {ApiError} Not found error instance
   */
  static notFoundError(resource = 'Resource', context = {}) {
    return new ApiError(
      `${resource} not found`,
      StatusCodes.NOT_FOUND,
      [],
      'NOT_FOUND_ERROR',
      context
    );
  }

  /**
   * Create a conflict error
   * @param {string} message - Error message
   * @param {object} context - Additional context
   * @returns {ApiError} Conflict error instance
   */
  static conflictError(message = 'Resource conflict', context = {}) {
    return new ApiError(
      message,
      StatusCodes.CONFLICT,
      [],
      'CONFLICT_ERROR',
      context
    );
  }

  /**
   * Create a rate limit error
   * @param {string} message - Error message
   * @param {object} context - Additional context (e.g., retry after)
   * @returns {ApiError} Rate limit error instance
   */
  static rateLimitError(message = 'Too many requests', context = {}) {
    return new ApiError(
      message,
      StatusCodes.TOO_MANY_REQUESTS,
      [],
      'RATE_LIMIT_ERROR',
      context
    );
  }

  /**
   * Create a service unavailable error
   * @param {string} service - Service name
   * @param {object} context - Additional context
   * @returns {ApiError} Service unavailable error instance
   */
  static serviceUnavailableError(service = 'Service', context = {}) {
    return new ApiError(
      `${service} is temporarily unavailable`,
      StatusCodes.SERVICE_UNAVAILABLE,
      [],
      'SERVICE_UNAVAILABLE_ERROR',
      context
    );
  }

  /**
   * Create a bad gateway error for external service failures
   * @param {string} service - External service name
   * @param {object} context - Additional context
   * @returns {ApiError} Bad gateway error instance
   */
  static badGatewayError(service = 'External service', context = {}) {
    return new ApiError(
      `${service} error`,
      StatusCodes.BAD_GATEWAY,
      [],
      'BAD_GATEWAY_ERROR',
      context
    );
  }

  /**
   * Create an internal server error
   * @param {string} message - Error message
   * @param {object} context - Additional context
   * @returns {ApiError} Internal server error instance
   */
  static internalServerError(message = 'Internal server error', context = {}) {
    return new ApiError(
      message,
      StatusCodes.INTERNAL_SERVER_ERROR,
      [],
      'INTERNAL_SERVER_ERROR',
      context
    );
  }

  /**
   * Create a third-party service error
   * @param {string} service - Service name
   * @param {string} operation - Operation that failed
   * @param {object} context - Additional context
   * @returns {ApiError} Third-party service error instance
   */
  static thirdPartyServiceError(service = 'External service', operation = 'operation', context = {}) {
    return new ApiError(
      `${service} ${operation} failed`,
      StatusCodes.BAD_GATEWAY,
      [],
      'THIRD_PARTY_SERVICE_ERROR',
      { service, operation, ...context }
    );
  }

  /**
   * Create a database error
   * @param {string} operation - Database operation that failed
   * @param {object} context - Additional context
   * @returns {ApiError} Database error instance
   */
  static databaseError(operation = 'Database operation', context = {}) {
    return new ApiError(
      `${operation} failed`,
      StatusCodes.INTERNAL_SERVER_ERROR,
      [],
      'DATABASE_ERROR',
      { operation, ...context }
    );
  }

  /**
   * Create a timeout error
   * @param {string} operation - Operation that timed out
   * @param {number} timeout - Timeout duration
   * @param {object} context - Additional context
   * @returns {ApiError} Timeout error instance
   */
  static timeoutError(operation = 'Operation', timeout = null, context = {}) {
    return new ApiError(
      `${operation} timed out${timeout ? ` after ${timeout}ms` : ''}`,
      StatusCodes.REQUEST_TIMEOUT,
      [],
      'TIMEOUT_ERROR',
      { operation, timeout, ...context }
    );
  }
}

/**
 * @class ValidationError
 * @extends ApiError
 * @description Specialized error class for validation errors
 */
class ValidationError extends ApiError {
  constructor(message = 'Validation failed', details = null, context = {}) {
    const errors = Array.isArray(details) ? details : (details ? [details] : []);
    super(message, StatusCodes.BAD_REQUEST, errors, 'VALIDATION_ERROR', context);
    this.name = 'ValidationError';
    this.isOperational = true; // Ensure it's marked as operational
  }
}

/**
 * @class AuthenticationError
 * @extends ApiError
 * @description Specialized error class for authentication errors
 */
class AuthenticationError extends ApiError {
  constructor(message = 'Authentication required', context = {}) {
    super(message, StatusCodes.UNAUTHORIZED, [], 'AUTHENTICATION_ERROR', context);
    this.name = 'AuthenticationError';
    this.isOperational = true;
  }
}

/**
 * @class AuthorizationError
 * @extends ApiError
 * @description Specialized error class for authorization errors
 */
class AuthorizationError extends ApiError {
  constructor(message = 'Insufficient permissions', context = {}) {
    super(message, StatusCodes.FORBIDDEN, [], 'AUTHORIZATION_ERROR', context);
    this.name = 'AuthorizationError';
    this.isOperational = true;
  }
}

/**
 * @class ThirdPartyServiceError
 * @extends ApiError
 * @description Specialized error class for third-party service errors
 */
class ThirdPartyServiceError extends ApiError {
  constructor(service, operation, originalError = null, context = {}) {
    const message = `${service} service error during ${operation}`;
    const errorContext = {
      service,
      operation,
      originalError: originalError?.message,
      ...context
    };
    
    super(message, StatusCodes.BAD_GATEWAY, [], 'THIRD_PARTY_SERVICE_ERROR', errorContext);
    this.name = 'ThirdPartyServiceError';
    this.service = service;
    this.operation = operation;
    this.originalError = originalError;
    this.isOperational = true;
  }
}

/**
 * @class DatabaseError
 * @extends ApiError
 * @description Specialized error class for database errors
 */
class DatabaseError extends ApiError {
  constructor(operation, originalError = null, context = {}) {
    const message = `Database error during ${operation}`;
    const errorContext = {
      operation,
      originalError: originalError?.message,
      ...context
    };
    
    super(message, StatusCodes.INTERNAL_SERVER_ERROR, [], 'DATABASE_ERROR', errorContext);
    this.name = 'DatabaseError';
    this.operation = operation;
    this.originalError = originalError;
    this.isOperational = false; // Database errors are typically not operational from user perspective
  }
}

module.exports = {
  ApiError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  ThirdPartyServiceError,
  DatabaseError
};