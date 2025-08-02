// v1/utils/middlewareLoader.js
const logger = require('./logger');

/**
 * @function safeMiddleware
 * @description Creates a defensive wrapper around middleware functions to prevent crashes
 * when middleware is not available or not properly loaded.
 * @param {string} middlewareName - Name of the middleware for logging purposes
 * @param {Function} middleware - The middleware function to wrap
 * @param {Object} options - Configuration options
 * @param {boolean} options.required - Whether the middleware is required (default: true)
 * @param {Function} options.fallback - Fallback function if middleware is not available
 * @returns {Function} A safe middleware wrapper
 */
const safeMiddleware = (middlewareName, middleware, options = {}) => {
  const { required = true, fallback = null } = options;
  
  return (req, res, next) => {
    if (typeof middleware === 'function') {
      try {
        return middleware(req, res, next);
      } catch (error) {
        logger.error(`${middlewareName} middleware execution failed:`, {
          error: error.message,
          stack: error.stack,
          endpoint: req.originalUrl,
          method: req.method,
          ip: req.ip
        });
        
        if (required) {
          return res.status(500).json({
            success: false,
            message: 'Internal server error - middleware execution failed',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
          });
        } else {
          // Non-required middleware, continue without it
          return next();
        }
      }
    } else {
      logger.error(`${middlewareName} middleware not available:`, {
        type: typeof middleware,
        endpoint: req.originalUrl,
        method: req.method,
        ip: req.ip
      });
      
      if (fallback && typeof fallback === 'function') {
        logger.info(`Using fallback for ${middlewareName} middleware`);
        return fallback(req, res, next);
      }
      
      if (required) {
        return res.status(500).json({
          success: false,
          message: 'Internal server error - required middleware not available',
          error: process.env.NODE_ENV === 'development' ? `${middlewareName} not loaded` : undefined
        });
      } else {
        // Non-required middleware, continue without it
        logger.warn(`Skipping non-required middleware: ${middlewareName}`);
        return next();
      }
    }
  };
};

/**
 * @function safeAuthMiddleware
 * @description Creates a safe wrapper specifically for authentication middleware
 * with appropriate fallbacks for optional authentication.
 * @param {Function} authMiddleware - The authentication middleware function
 * @param {Object} options - Configuration options
 * @param {boolean} options.optional - Whether authentication is optional (default: false)
 * @returns {Function} A safe authentication middleware wrapper
 */
const safeAuthMiddleware = (authMiddleware, options = {}) => {
  const { optional = false } = options;
  
  const fallback = optional ? (req, res, next) => {
    // For optional auth, continue without user
    req.user = null;
    next();
  } : null;
  
  return safeMiddleware(
    optional ? 'optionalAuthenticateUser' : 'authenticateUser',
    authMiddleware,
    {
      required: !optional,
      fallback
    }
  );
};

/**
 * @function safeValidationMiddleware
 * @description Creates a safe wrapper for validation middleware with schema checking.
 * @param {Function} validateFunction - The validation function
 * @param {Object} schema - The validation schema
 * @param {string} schemaName - Name of the schema for logging
 * @returns {Function} A safe validation middleware wrapper
 */
const safeValidationMiddleware = (validateFunction, schema, schemaName) => {
  return (req, res, next) => {
    if (typeof validateFunction !== 'function') {
      logger.error('Validation function not available:', {
        type: typeof validateFunction,
        schemaName,
        endpoint: req.originalUrl
      });
      
      return res.status(500).json({
        success: false,
        message: 'Internal server error - validation not available',
        error: process.env.NODE_ENV === 'development' ? 'Validation middleware not loaded' : undefined
      });
    }
    
    if (!schema) {
      logger.error('Validation schema not available:', {
        schemaName,
        endpoint: req.originalUrl
      });
      
      return res.status(500).json({
        success: false,
        message: 'Internal server error - validation schema not available',
        error: process.env.NODE_ENV === 'development' ? `${schemaName} schema not loaded` : undefined
      });
    }
    
    try {
      return validateFunction(schema)(req, res, next);
    } catch (error) {
      logger.error('Validation middleware execution failed:', {
        error: error.message,
        schemaName,
        endpoint: req.originalUrl
      });
      
      return res.status(500).json({
        success: false,
        message: 'Internal server error - validation failed',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
};

/**
 * @function loadMiddlewareSafely
 * @description Safely loads middleware from a module with error handling.
 * @param {string} modulePath - Path to the middleware module
 * @param {string} middlewareName - Name of the middleware to extract
 * @returns {Function|null} The middleware function or null if loading failed
 */
const loadMiddlewareSafely = (modulePath, middlewareName) => {
  try {
    const middlewareModule = require(modulePath);
    const middleware = middlewareModule[middlewareName];
    
    if (typeof middleware === 'function') {
      return middleware;
    } else {
      logger.error(`Middleware ${middlewareName} is not a function:`, {
        type: typeof middleware,
        modulePath
      });
      return null;
    }
  } catch (error) {
    logger.error(`Failed to load middleware ${middlewareName} from ${modulePath}:`, {
      error: error.message,
      stack: error.stack
    });
    return null;
  }
};

module.exports = {
  safeMiddleware,
  safeAuthMiddleware,
  safeValidationMiddleware,
  loadMiddlewareSafely
};