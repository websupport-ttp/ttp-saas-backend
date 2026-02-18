// v1/utils/logger.js
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, colorize, align, json, errors } = format;
const path = require('path');

/**
 * @constant logLevels
 * @description Custom log levels with priorities
 */
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

/**
 * @constant logColors
 * @description Colors for different log levels
 */
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

/**
 * @function developmentFormat
 * @description Format for development environment with colors and readable structure
 */
const developmentFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    
    // Add stack trace for errors
    if (stack) {
      log += `\n${stack}`;
    }
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      log += `\nMetadata: ${JSON.stringify(meta, null, 2)}`;
    }
    
    return log;
  })
);

/**
 * @function productionFormat
 * @description Format for production environment with structured JSON logging
 */
const productionFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

/**
 * @function createFileTransport
 * @description Create file transport with rotation
 * @param {string} filename - Log filename
 * @param {string} level - Log level
 * @returns {object} Winston file transport
 */
const createFileTransport = (filename, level = 'info') => {
  const fs = require('fs');
  
  // Use /tmp directory for serverless environments, logs directory for local development
  const logsDir = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME ? '/tmp' : 'logs';
  
  // Create logs directory if it doesn't exist (except in test environment)
  if (process.env.NODE_ENV !== 'test') {
    try {
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
    } catch (error) {
      console.warn(`Could not create logs directory: ${error.message}`);
      // In serverless environments, if we can't create the directory, return null to skip file logging
      if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
        return null;
      }
    }
  }
  
  return new transports.File({
    filename: path.join(logsDir, filename),
    level,
    maxsize: 10485760, // 10MB
    maxFiles: 5,
    format: productionFormat,
  });
};

/**
 * @function getLogLevel
 * @description Determine log level based on environment
 * @returns {string} Log level
 */
const getLogLevel = () => {
  const env = process.env.NODE_ENV || 'development';
  const logLevel = process.env.LOG_LEVEL;
  
  if (logLevel) {
    return logLevel;
  }
  
  switch (env) {
    case 'production':
      return 'warn';
    case 'test':
      return 'error';
    case 'development':
    default:
      return 'debug';
  }
};

/**
 * @function createTransports
 * @description Create appropriate transports based on environment
 * @returns {Array} Array of Winston transports
 */
const createTransports = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';
  const isVercel = process.env.VERCEL || process.env.VERCEL_ENV;
  const transportsArray = [];

  // Console transport (always present, but silent in test)
  transportsArray.push(
    new transports.Console({
      format: isProduction ? productionFormat : developmentFormat,
      silent: isTest, // Don't log to console during tests
    })
  );

  // File transports for production only (not for test, development, or Vercel)
  if (isProduction && !isVercel) {
    try {
      const fileTransports = [
        createFileTransport('error.log', 'error'),
        createFileTransport('combined.log', 'info'),
        createFileTransport('http.log', 'http')
      ].filter(transport => transport !== null);
      
      transportsArray.push(...fileTransports);
    } catch (error) {
      console.warn('Could not create file transports:', error.message);
    }
  }

  return transportsArray;
};

/**
 * @constant logger
 * @description Enhanced Winston logger instance with comprehensive configuration
 */
let logger;

try {
  const isProduction = process.env.NODE_ENV === 'production';
  const isVercel = process.env.VERCEL || process.env.VERCEL_ENV;
  
  logger = createLogger({
    level: getLogLevel(),
    levels: logLevels,
    format: isProduction ? productionFormat : developmentFormat,
    transports: createTransports(),
    exceptionHandlers: [
      new transports.Console({
        format: isProduction ? productionFormat : developmentFormat,
        silent: process.env.NODE_ENV === 'test',
      }),
      ...(isProduction && !isVercel ? [createFileTransport('exceptions.log')].filter(t => t !== null) : [])
    ],
    rejectionHandlers: [
      new transports.Console({
        format: isProduction ? productionFormat : developmentFormat,
        silent: process.env.NODE_ENV === 'test',
      }),
      ...(isProduction && !isVercel ? [createFileTransport('rejections.log')].filter(t => t !== null) : [])
    ],
    exitOnError: false,
  });

  // Add colors to winston
  require('winston').addColors(logColors);
} catch (error) {
  // Fallback to console if Winston fails
  console.error('Failed to initialize Winston logger:', error.message);
  logger = {
    error: (...args) => console.error('[ERROR]', ...args),
    warn: (...args) => console.warn('[WARN]', ...args),
    info: (...args) => console.info('[INFO]', ...args),
    http: (...args) => console.log('[HTTP]', ...args),
    debug: (...args) => console.debug('[DEBUG]', ...args),
  };
}

/**
 * @function createContextualLogger
 * @description Create a logger with predefined context
 * @param {string} context - Context identifier (e.g., service name, module name)
 * @returns {object} Contextual logger
 */
const createContextualLogger = (context) => {
  return {
    error: (message, meta = {}) => logger.error(message, { context, ...meta }),
    warn: (message, meta = {}) => logger.warn(message, { context, ...meta }),
    info: (message, meta = {}) => logger.info(message, { context, ...meta }),
    http: (message, meta = {}) => logger.http(message, { context, ...meta }),
    debug: (message, meta = {}) => logger.debug(message, { context, ...meta }),
  };
};

/**
 * @function logPerformance
 * @description Log performance metrics
 * @param {string} operation - Operation name
 * @param {number} duration - Duration in milliseconds
 * @param {object} metadata - Additional metadata
 */
const logPerformance = (operation, duration, metadata = {}) => {
  const level = duration > 5000 ? 'warn' : duration > 1000 ? 'info' : 'debug';
  logger[level](`Performance: ${operation} completed in ${duration}ms`, {
    operation,
    duration,
    performance: true,
    ...metadata
  });
};

/**
 * @function logApiRequest
 * @description Log API request details
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {number} duration - Request duration in milliseconds
 */
const logApiRequest = (req, res, duration) => {
  const { method, originalUrl, ip } = req;
  const { statusCode } = res;
  const userAgent = req.get('User-Agent');
  const userId = req.user?.userId || 'anonymous';
  
  const level = statusCode >= 400 ? 'warn' : 'http';
  
  logger[level](`${method} ${originalUrl} ${statusCode}`, {
    method,
    url: originalUrl,
    statusCode,
    duration,
    ip,
    userAgent,
    userId,
    requestId: req.id,
    apiRequest: true
  });
};

/**
 * @function logSecurityEvent
 * @description Log security-related events
 * @param {string} event - Security event type
 * @param {object} details - Event details
 * @param {string} severity - Event severity (low, medium, high, critical)
 */
const logSecurityEvent = (event, details = {}, severity = 'medium') => {
  const level = severity === 'critical' || severity === 'high' ? 'error' : 'warn';
  
  logger[level](`Security Event: ${event}`, {
    securityEvent: event,
    severity,
    timestamp: new Date().toISOString(),
    ...details
  });
};

/**
 * @function logDatabaseOperation
 * @description Log database operations
 * @param {string} operation - Database operation type
 * @param {string} collection - Collection/table name
 * @param {number} duration - Operation duration
 * @param {object} metadata - Additional metadata
 */
const logDatabaseOperation = (operation, collection, duration, metadata = {}) => {
  const level = duration > 1000 ? 'warn' : 'debug';
  
  logger[level](`DB Operation: ${operation} on ${collection} (${duration}ms)`, {
    dbOperation: operation,
    collection,
    duration,
    database: true,
    ...metadata
  });
};

/**
 * @function logExternalService
 * @description Log external service calls
 * @param {string} service - Service name
 * @param {string} operation - Operation type
 * @param {number} duration - Call duration
 * @param {boolean} success - Whether the call was successful
 * @param {object} metadata - Additional metadata
 */
const logExternalService = (service, operation, duration, success, metadata = {}) => {
  const level = !success ? 'error' : duration > 5000 ? 'warn' : 'info';
  const status = success ? 'SUCCESS' : 'FAILED';
  
  logger[level](`External Service: ${service}.${operation} ${status} (${duration}ms)`, {
    externalService: service,
    operation,
    duration,
    success,
    ...metadata
  });
};

// Enhanced logger with additional methods
const enhancedLogger = {
  // Core Winston methods
  error: logger.error.bind(logger),
  warn: logger.warn.bind(logger),
  info: logger.info.bind(logger),
  http: logger.http.bind(logger),
  debug: logger.debug.bind(logger),
  
  // Enhanced methods
  createContextualLogger,
  logPerformance,
  logApiRequest,
  logSecurityEvent,
  logDatabaseOperation,
  logExternalService,
};

module.exports = enhancedLogger;