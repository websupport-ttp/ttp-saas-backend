// v1/middleware/affiliateErrorHandler.js
const { StatusCodes } = require('http-status-codes');
const logger = require('../utils/logger');
const errorMonitor = require('../utils/errorMonitoring');
const { 
  AffiliateError, 
  WalletError, 
  CommissionError, 
  WithdrawalError,
  QRCodeError 
} = require('../utils/affiliateErrors');
const { ApiError } = require('../utils/apiError');

/**
 * Comprehensive error handler middleware for affiliate system
 * @param {Error} err - Error object
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {Function} next - Express next function
 */
const affiliateErrorHandler = (err, req, res, next) => {
  // Create error context from request
  const errorContext = {
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: req.user?.id,
    affiliateId: req.affiliate?.affiliateId || req.body?.affiliateId || req.params?.affiliateId,
    requestId: req.requestId || req.headers['x-request-id'],
    timestamp: new Date().toISOString()
  };

  // Extract operation name from route
  const operation = extractOperationName(req);

  // Log and monitor the error
  errorMonitor.logError(err, errorContext, operation, {
    body: sanitizeRequestBody(req.body),
    params: req.params,
    query: req.query
  });

  // Handle different error types
  let errorResponse;

  if (err instanceof AffiliateError) {
    errorResponse = handleAffiliateError(err, errorContext);
  } else if (err instanceof WalletError) {
    errorResponse = handleWalletError(err, errorContext);
  } else if (err instanceof CommissionError) {
    errorResponse = handleCommissionError(err, errorContext);
  } else if (err instanceof WithdrawalError) {
    errorResponse = handleWithdrawalError(err, errorContext);
  } else if (err instanceof QRCodeError) {
    errorResponse = handleQRCodeError(err, errorContext);
  } else if (err instanceof ApiError) {
    errorResponse = handleApiError(err, errorContext);
  } else {
    errorResponse = handleGenericError(err, errorContext);
  }

  // Add correlation ID for tracking
  errorResponse.correlationId = errorContext.requestId;
  errorResponse.timestamp = errorContext.timestamp;

  // Send error response
  res.status(errorResponse.statusCode).json(errorResponse);
};

/**
 * Handle affiliate-specific errors
 * @param {AffiliateError} err - Affiliate error
 * @param {object} context - Error context
 * @returns {object} Error response
 */
function handleAffiliateError(err, context) {
  const baseResponse = {
    success: false,
    error: 'Affiliate Error',
    message: err.message,
    statusCode: err.statusCode,
    code: err.code
  };

  // Add specific handling based on error type
  if (err.statusCode === StatusCodes.NOT_FOUND) {
    return {
      ...baseResponse,
      error: 'Affiliate Not Found',
      suggestions: [
        'Verify the affiliate ID is correct',
        'Check if the affiliate account exists',
        'Contact support if the issue persists'
      ]
    };
  }

  if (err.statusCode === StatusCodes.FORBIDDEN) {
    return {
      ...baseResponse,
      error: 'Affiliate Access Denied',
      suggestions: [
        'Ensure affiliate account is approved and active',
        'Check account status with administrator',
        'Review terms and conditions compliance'
      ]
    };
  }

  if (err.statusCode === StatusCodes.CONFLICT) {
    return {
      ...baseResponse,
      error: 'Affiliate Conflict',
      suggestions: [
        'Check for duplicate registration attempts',
        'Verify business information is unique',
        'Contact support for account recovery'
      ]
    };
  }

  if (err.errors && err.errors.length > 0) {
    baseResponse.validationErrors = err.errors;
    baseResponse.suggestions = [
      'Review and correct the validation errors',
      'Ensure all required fields are provided',
      'Check data format requirements'
    ];
  }

  return baseResponse;
}

/**
 * Handle wallet-specific errors
 * @param {WalletError} err - Wallet error
 * @param {object} context - Error context
 * @returns {object} Error response
 */
function handleWalletError(err, context) {
  const baseResponse = {
    success: false,
    error: 'Wallet Error',
    message: err.message,
    statusCode: err.statusCode,
    code: err.code
  };

  // Add wallet-specific context
  if (err.context?.requestedAmount && err.context?.availableBalance) {
    baseResponse.walletInfo = {
      requestedAmount: err.context.requestedAmount,
      availableBalance: err.context.availableBalance,
      currency: err.context.currency || 'NGN'
    };
  }

  // Add specific suggestions based on error type
  if (err.statusCode === StatusCodes.BAD_REQUEST) {
    baseResponse.suggestions = [
      'Check wallet balance before making transactions',
      'Ensure transaction amounts are positive',
      'Verify wallet is not frozen or suspended'
    ];
  }

  if (err.statusCode === StatusCodes.CONFLICT) {
    baseResponse.suggestions = [
      'Avoid concurrent wallet operations',
      'Retry the operation after a short delay',
      'Contact support if the issue persists'
    ];
  }

  return baseResponse;
}

/**
 * Handle commission-specific errors
 * @param {CommissionError} err - Commission error
 * @param {object} context - Error context
 * @returns {object} Error response
 */
function handleCommissionError(err, context) {
  const baseResponse = {
    success: false,
    error: 'Commission Error',
    message: err.message,
    statusCode: err.statusCode,
    code: err.code
  };

  // Add commission-specific context
  if (err.context?.bookingReference) {
    baseResponse.bookingReference = err.context.bookingReference;
  }

  if (err.context?.commissionId) {
    baseResponse.commissionId = err.context.commissionId;
  }

  // Add specific suggestions
  if (err.statusCode === StatusCodes.CONFLICT) {
    baseResponse.suggestions = [
      'Check if commission already exists for this booking',
      'Verify booking reference is correct',
      'Contact support for commission disputes'
    ];
  }

  if (err.statusCode === StatusCodes.INTERNAL_SERVER_ERROR) {
    baseResponse.suggestions = [
      'Commission calculation will be retried automatically',
      'Check booking details are complete',
      'Contact support if the issue persists'
    ];
  }

  return baseResponse;
}

/**
 * Handle withdrawal-specific errors
 * @param {WithdrawalError} err - Withdrawal error
 * @param {object} context - Error context
 * @returns {object} Error response
 */
function handleWithdrawalError(err, context) {
  const baseResponse = {
    success: false,
    error: 'Withdrawal Error',
    message: err.message,
    statusCode: err.statusCode,
    code: err.code
  };

  // Add withdrawal-specific context
  if (err.context?.withdrawalId) {
    baseResponse.withdrawalId = err.context.withdrawalId;
  }

  if (err.context?.amount) {
    baseResponse.amount = err.context.amount;
    baseResponse.currency = err.context.currency || 'NGN';
  }

  // Add specific suggestions
  if (err.statusCode === StatusCodes.BAD_REQUEST) {
    baseResponse.suggestions = [
      'Ensure withdrawal amount meets minimum requirements',
      'Verify bank details are correct and complete',
      'Check wallet has sufficient balance'
    ];
  }

  if (err.statusCode === StatusCodes.CONFLICT) {
    baseResponse.suggestions = [
      'Complete or cancel existing withdrawal request',
      'Wait for current withdrawal to process',
      'Contact support for withdrawal status'
    ];
  }

  if (err.errors && err.errors.length > 0) {
    baseResponse.validationErrors = err.errors;
  }

  return baseResponse;
}

/**
 * Handle QR code-specific errors
 * @param {QRCodeError} err - QR code error
 * @param {object} context - Error context
 * @returns {object} Error response
 */
function handleQRCodeError(err, context) {
  const baseResponse = {
    success: false,
    error: 'QR Code Error',
    message: err.message,
    statusCode: err.statusCode,
    code: err.code
  };

  // Add QR code-specific context
  if (err.context?.type) {
    baseResponse.qrType = err.context.type;
  }

  // Add specific suggestions
  if (err.statusCode === StatusCodes.GONE) {
    baseResponse.suggestions = [
      'Generate a new QR code',
      'Check QR code expiration settings',
      'Use the latest QR code provided'
    ];
  }

  if (err.statusCode === StatusCodes.BAD_REQUEST) {
    baseResponse.suggestions = [
      'Ensure QR code data is not corrupted',
      'Scan QR code with proper lighting',
      'Generate a new QR code if needed'
    ];
  }

  return baseResponse;
}

/**
 * Handle generic API errors
 * @param {ApiError} err - API error
 * @param {object} context - Error context
 * @returns {object} Error response
 */
function handleApiError(err, context) {
  return {
    success: false,
    error: err.name || 'API Error',
    message: err.message,
    statusCode: err.statusCode,
    code: err.code,
    errors: err.errors || [],
    suggestions: generateGenericSuggestions(err.statusCode)
  };
}

/**
 * Handle generic/unknown errors
 * @param {Error} err - Generic error
 * @param {object} context - Error context
 * @returns {object} Error response
 */
function handleGenericError(err, context) {
  // Log unexpected errors for investigation
  logger.error('Unexpected error in affiliate system', {
    error: err.message,
    stack: err.stack,
    context
  });

  return {
    success: false,
    error: 'Internal Server Error',
    message: 'An unexpected error occurred. Please try again later.',
    statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
    code: 'INTERNAL_SERVER_ERROR',
    suggestions: [
      'Try the operation again after a short delay',
      'Check if the service is temporarily unavailable',
      'Contact support if the issue persists'
    ]
  };
}

/**
 * Extract operation name from request
 * @param {object} req - Express request object
 * @returns {string} Operation name
 */
function extractOperationName(req) {
  const path = req.route?.path || req.path;
  const method = req.method.toLowerCase();
  
  // Map common patterns to operation names
  if (path.includes('/affiliate')) {
    if (method === 'post' && path.includes('/register')) return 'affiliate_registration';
    if (method === 'post' && path.includes('/approve')) return 'affiliate_approval';
    if (method === 'get' && path.includes('/stats')) return 'affiliate_stats';
    if (method === 'put' && path.includes('/suspend')) return 'affiliate_suspension';
    return `affiliate_${method}`;
  }

  if (path.includes('/wallet')) {
    if (method === 'post' && path.includes('/credit')) return 'wallet_credit';
    if (method === 'post' && path.includes('/debit')) return 'wallet_debit';
    if (method === 'get' && path.includes('/balance')) return 'wallet_balance';
    if (method === 'get' && path.includes('/transactions')) return 'wallet_transactions';
    return `wallet_${method}`;
  }

  if (path.includes('/commission')) {
    if (method === 'post' && path.includes('/calculate')) return 'commission_calculation';
    if (method === 'post' && path.includes('/process')) return 'commission_processing';
    if (method === 'put' && path.includes('/approve')) return 'commission_approval';
    if (method === 'put' && path.includes('/dispute')) return 'commission_dispute';
    return `commission_${method}`;
  }

  if (path.includes('/withdrawal')) {
    if (method === 'post') return 'withdrawal_request';
    if (method === 'put' && path.includes('/process')) return 'withdrawal_processing';
    if (method === 'put' && path.includes('/cancel')) return 'withdrawal_cancellation';
    return `withdrawal_${method}`;
  }

  if (path.includes('/qr')) {
    if (method === 'post') return 'qr_generation';
    if (method === 'get') return 'qr_retrieval';
    return `qr_${method}`;
  }

  return `${method}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

/**
 * Sanitize request body for logging (remove sensitive data)
 * @param {object} body - Request body
 * @returns {object} Sanitized body
 */
function sanitizeRequestBody(body) {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sanitized = { ...body };
  const sensitiveFields = [
    'password', 'token', 'secret', 'key', 'authorization',
    'accountNumber', 'bankCode', 'pin', 'otp'
  ];

  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });

  return sanitized;
}

/**
 * Generate generic suggestions based on status code
 * @param {number} statusCode - HTTP status code
 * @returns {Array<string>} Suggestions
 */
function generateGenericSuggestions(statusCode) {
  switch (statusCode) {
    case StatusCodes.BAD_REQUEST:
      return [
        'Check request parameters and format',
        'Ensure all required fields are provided',
        'Verify data types and constraints'
      ];
    case StatusCodes.UNAUTHORIZED:
      return [
        'Ensure you are properly authenticated',
        'Check authentication token validity',
        'Login again if session expired'
      ];
    case StatusCodes.FORBIDDEN:
      return [
        'Verify you have permission for this operation',
        'Check account status and privileges',
        'Contact administrator for access'
      ];
    case StatusCodes.NOT_FOUND:
      return [
        'Verify the resource identifier is correct',
        'Check if the resource exists',
        'Ensure proper URL path'
      ];
    case StatusCodes.CONFLICT:
      return [
        'Check for duplicate or conflicting data',
        'Resolve conflicts before retrying',
        'Ensure resource state is valid'
      ];
    case StatusCodes.TOO_MANY_REQUESTS:
      return [
        'Reduce request frequency',
        'Wait before retrying',
        'Check rate limiting policies'
      ];
    default:
      return [
        'Try the operation again',
        'Check service status',
        'Contact support if issue persists'
      ];
  }
}

module.exports = affiliateErrorHandler;