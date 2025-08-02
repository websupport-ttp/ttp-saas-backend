// v1/utils/apiResponse.js
const { StatusCodes } = require('http-status-codes');

/**
 * @class ApiResponse
 * @description Enhanced utility class for consistent API response structure.
 * Provides methods for success and error responses with comprehensive metadata.
 */
class ApiResponse {
  /**
   * Creates a standardized success response.
   * @param {object} res - The Express response object.
   * @param {number} statusCode - The HTTP status code (default: 200 OK).
   * @param {string} message - A descriptive success message.
   * @param {object} data - The data payload to send in the response.
   * @param {object} meta - Additional metadata (pagination, etc.).
   * @returns {object} The JSON response.
   */
  static success(res, statusCode = StatusCodes.OK, message, data = {}, meta = {}) {
    const response = {
      status: 'success',
      message,
      data,
      timestamp: new Date().toISOString(),
    };

    // Add metadata if provided
    if (Object.keys(meta).length > 0) {
      response.meta = meta;
    }

    // Add request ID if available
    if (res.req && res.req.id) {
      response.requestId = res.req.id;
    }

    return res.status(statusCode).json(response);
  }

  /**
   * Creates a standardized error response.
   * @param {object} res - The Express response object.
   * @param {number} statusCode - The HTTP status code (default: 500 Internal Server Error).
   * @param {string} message - A descriptive error message.
   * @param {Array<string>} errors - An array of specific error details (optional).
   * @param {object} debug - Debug information (only in development).
   * @param {object} recovery - Recovery information (retryable, recovery suggestions, etc.).
   * @returns {object} The JSON response.
   */
  static error(res, statusCode = StatusCodes.INTERNAL_SERVER_ERROR, message, errors = [], debug = null, recovery = null) {
    const response = {
      status: statusCode >= 400 && statusCode < 500 ? 'fail' : 'error',
      message,
      timestamp: new Date().toISOString(),
    };

    // Add errors array if provided
    if (errors && errors.length > 0) {
      response.errors = errors;
    }

    // Add recovery information at root level
    if (recovery) {
      if (recovery.retryable !== undefined) {
        response.retryable = recovery.retryable;
      }
      if (recovery.retryAfter !== undefined) {
        response.retryAfter = recovery.retryAfter;
      }
      if (recovery.recovery) {
        response.recovery = recovery.recovery;
      }
    }

    // Add request ID if available
    if (res.req && res.req.id) {
      response.requestId = res.req.id;
    }

    // Add debug information in development
    if (debug && process.env.NODE_ENV !== 'production') {
      response.debug = debug;
    }

    return res.status(statusCode).json(response);
  }

  /**
   * Creates a paginated success response.
   * @param {object} res - The Express response object.
   * @param {string} message - A descriptive success message.
   * @param {Array} data - The data array to paginate.
   * @param {object} pagination - Pagination information.
   * @param {number} statusCode - The HTTP status code (default: 200 OK).
   * @returns {object} The JSON response.
   */
  static paginated(res, message, data = [], pagination = {}, statusCode = StatusCodes.OK) {
    const meta = {
      pagination: {
        page: pagination.page || 1,
        limit: pagination.limit || 10,
        total: pagination.total || data.length,
        pages: pagination.pages || Math.ceil((pagination.total || data.length) / (pagination.limit || 10)),
        hasNext: pagination.hasNext || false,
        hasPrev: pagination.hasPrev || false,
      }
    };

    return this.success(res, statusCode, message, data, meta);
  }

  /**
   * Creates a response for created resources.
   * @param {object} res - The Express response object.
   * @param {string} message - A descriptive success message.
   * @param {object} data - The created resource data.
   * @param {string} location - Location header for the created resource (optional).
   * @returns {object} The JSON response.
   */
  static created(res, message, data = {}, location = null) {
    if (location) {
      res.set('Location', location);
    }
    return this.success(res, StatusCodes.CREATED, message, data);
  }

  /**
   * Creates a response for accepted requests (async operations).
   * @param {object} res - The Express response object.
   * @param {string} message - A descriptive message.
   * @param {object} data - Any relevant data (e.g., job ID, status URL).
   * @returns {object} The JSON response.
   */
  static accepted(res, message, data = {}) {
    return this.success(res, StatusCodes.ACCEPTED, message, data);
  }

  /**
   * Creates a no content response.
   * @param {object} res - The Express response object.
   * @returns {object} The response with no content.
   */
  static noContent(res) {
    return res.status(StatusCodes.NO_CONTENT).send();
  }

  /**
   * Creates a validation error response.
   * @param {object} res - The Express response object.
   * @param {string} message - Error message.
   * @param {Array<string>} validationErrors - Array of validation errors.
   * @returns {object} The JSON response.
   */
  static validationError(res, message = 'Validation failed', validationErrors = []) {
    return this.error(res, StatusCodes.BAD_REQUEST, message, validationErrors);
  }

  /**
   * Creates an unauthorized error response.
   * @param {object} res - The Express response object.
   * @param {string} message - Error message.
   * @returns {object} The JSON response.
   */
  static unauthorized(res, message = 'Authentication required') {
    return this.error(res, StatusCodes.UNAUTHORIZED, message);
  }

  /**
   * Creates a forbidden error response.
   * @param {object} res - The Express response object.
   * @param {string} message - Error message.
   * @returns {object} The JSON response.
   */
  static forbidden(res, message = 'Access denied') {
    return this.error(res, StatusCodes.FORBIDDEN, message);
  }

  /**
   * Creates a not found error response.
   * @param {object} res - The Express response object.
   * @param {string} message - Error message.
   * @returns {object} The JSON response.
   */
  static notFound(res, message = 'Resource not found') {
    return this.error(res, StatusCodes.NOT_FOUND, message);
  }

  /**
   * Creates a conflict error response.
   * @param {object} res - The Express response object.
   * @param {string} message - Error message.
   * @returns {object} The JSON response.
   */
  static conflict(res, message = 'Resource conflict') {
    return this.error(res, StatusCodes.CONFLICT, message);
  }

  /**
   * Creates a rate limit error response.
   * @param {object} res - The Express response object.
   * @param {string} message - Error message.
   * @param {number} retryAfter - Seconds to wait before retrying.
   * @returns {object} The JSON response.
   */
  static rateLimited(res, message = 'Too many requests', retryAfter = null) {
    if (retryAfter) {
      res.set('Retry-After', retryAfter);
    }
    return this.error(res, StatusCodes.TOO_MANY_REQUESTS, message);
  }

  /**
   * Creates a service unavailable error response.
   * @param {object} res - The Express response object.
   * @param {string} message - Error message.
   * @param {number} retryAfter - Seconds to wait before retrying.
   * @returns {object} The JSON response.
   */
  static serviceUnavailable(res, message = 'Service temporarily unavailable', retryAfter = null) {
    if (retryAfter) {
      res.set('Retry-After', retryAfter);
    }
    return this.error(res, StatusCodes.SERVICE_UNAVAILABLE, message);
  }
}

module.exports = ApiResponse;