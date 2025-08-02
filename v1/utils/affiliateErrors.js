// v1/utils/affiliateErrors.js
const { StatusCodes } = require('http-status-codes');
const { ApiError } = require('./apiError');

/**
 * @class AffiliateError
 * @extends ApiError
 * @description Specialized error class for affiliate-related operations
 */
class AffiliateError extends ApiError {
  constructor(message, statusCode = StatusCodes.BAD_REQUEST, errors = [], context = {}) {
    super(message, statusCode, errors, 'AFFILIATE_ERROR', context);
    this.name = 'AffiliateError';
    this.isOperational = true;
  }

  /**
   * Create an affiliate not found error
   * @param {string} affiliateId - Affiliate ID that was not found
   * @param {object} context - Additional context
   * @returns {AffiliateError} Affiliate not found error instance
   */
  static notFound(affiliateId, context = {}) {
    return new AffiliateError(
      `Affiliate with ID ${affiliateId} not found`,
      StatusCodes.NOT_FOUND,
      [],
      { affiliateId, ...context }
    );
  }

  /**
   * Create an affiliate already exists error
   * @param {string} identifier - Identifier that already exists (email, business name, etc.)
   * @param {object} context - Additional context
   * @returns {AffiliateError} Affiliate already exists error instance
   */
  static alreadyExists(identifier, context = {}) {
    return new AffiliateError(
      `Affiliate with ${identifier} already exists`,
      StatusCodes.CONFLICT,
      [],
      { identifier, ...context }
    );
  }

  /**
   * Create an affiliate not approved error
   * @param {string} affiliateId - Affiliate ID
   * @param {string} status - Current status
   * @param {object} context - Additional context
   * @returns {AffiliateError} Affiliate not approved error instance
   */
  static notApproved(affiliateId, status, context = {}) {
    return new AffiliateError(
      `Affiliate ${affiliateId} is not approved. Current status: ${status}`,
      StatusCodes.FORBIDDEN,
      [],
      { affiliateId, status, ...context }
    );
  }

  /**
   * Create an affiliate suspended error
   * @param {string} affiliateId - Affiliate ID
   * @param {string} reason - Suspension reason
   * @param {object} context - Additional context
   * @returns {AffiliateError} Affiliate suspended error instance
   */
  static suspended(affiliateId, reason, context = {}) {
    return new AffiliateError(
      `Affiliate ${affiliateId} is suspended: ${reason}`,
      StatusCodes.FORBIDDEN,
      [],
      { affiliateId, reason, ...context }
    );
  }

  /**
   * Create an invalid referral code error
   * @param {string} referralCode - Invalid referral code
   * @param {object} context - Additional context
   * @returns {AffiliateError} Invalid referral code error instance
   */
  static invalidReferralCode(referralCode, context = {}) {
    return new AffiliateError(
      `Invalid or expired referral code: ${referralCode}`,
      StatusCodes.BAD_REQUEST,
      [],
      { referralCode, ...context }
    );
  }

  /**
   * Create a registration validation error
   * @param {Array<string>} validationErrors - Array of validation errors
   * @param {object} context - Additional context
   * @returns {AffiliateError} Registration validation error instance
   */
  static registrationValidation(validationErrors, context = {}) {
    return new AffiliateError(
      'Affiliate registration validation failed',
      StatusCodes.BAD_REQUEST,
      validationErrors,
      context
    );
  }

  /**
   * Create an approval workflow error
   * @param {string} affiliateId - Affiliate ID
   * @param {string} currentStatus - Current affiliate status
   * @param {string} action - Action being attempted
   * @param {object} context - Additional context
   * @returns {AffiliateError} Approval workflow error instance
   */
  static approvalWorkflow(affiliateId, currentStatus, action, context = {}) {
    return new AffiliateError(
      `Cannot ${action} affiliate ${affiliateId} with status ${currentStatus}`,
      StatusCodes.BAD_REQUEST,
      [],
      { affiliateId, currentStatus, action, ...context }
    );
  }
}

/**
 * @class WalletError
 * @extends ApiError
 * @description Specialized error class for wallet-related operations
 */
class WalletError extends ApiError {
  constructor(message, statusCode = StatusCodes.BAD_REQUEST, errors = [], context = {}) {
    super(message, statusCode, errors, 'WALLET_ERROR', context);
    this.name = 'WalletError';
    this.isOperational = true;
  }

  /**
   * Create an insufficient balance error
   * @param {number} requestedAmount - Amount requested
   * @param {number} availableBalance - Available balance
   * @param {string} currency - Currency
   * @param {object} context - Additional context
   * @returns {WalletError} Insufficient balance error instance
   */
  static insufficientBalance(requestedAmount, availableBalance, currency = 'NGN', context = {}) {
    return new WalletError(
      `Insufficient balance. Requested: ${requestedAmount} ${currency}, Available: ${availableBalance} ${currency}`,
      StatusCodes.BAD_REQUEST,
      [],
      { requestedAmount, availableBalance, currency, ...context }
    );
  }

  /**
   * Create a wallet not found error
   * @param {string} affiliateId - Affiliate ID
   * @param {object} context - Additional context
   * @returns {WalletError} Wallet not found error instance
   */
  static notFound(affiliateId, context = {}) {
    return new WalletError(
      `Wallet not found for affiliate ${affiliateId}`,
      StatusCodes.NOT_FOUND,
      [],
      { affiliateId, ...context }
    );
  }

  /**
   * Create a wallet frozen error
   * @param {string} affiliateId - Affiliate ID
   * @param {string} reason - Freeze reason
   * @param {object} context - Additional context
   * @returns {WalletError} Wallet frozen error instance
   */
  static frozen(affiliateId, reason, context = {}) {
    return new WalletError(
      `Wallet for affiliate ${affiliateId} is frozen: ${reason}`,
      StatusCodes.FORBIDDEN,
      [],
      { affiliateId, reason, ...context }
    );
  }

  /**
   * Create a transaction failed error
   * @param {string} operation - Operation that failed
   * @param {string} transactionId - Transaction ID
   * @param {string} reason - Failure reason
   * @param {object} context - Additional context
   * @returns {WalletError} Transaction failed error instance
   */
  static transactionFailed(operation, transactionId, reason, context = {}) {
    return new WalletError(
      `Wallet ${operation} failed for transaction ${transactionId}: ${reason}`,
      StatusCodes.INTERNAL_SERVER_ERROR,
      [],
      { operation, transactionId, reason, ...context }
    );
  }

  /**
   * Create a duplicate transaction error
   * @param {string} transactionRef - Transaction reference
   * @param {object} context - Additional context
   * @returns {WalletError} Duplicate transaction error instance
   */
  static duplicateTransaction(transactionRef, context = {}) {
    return new WalletError(
      `Duplicate transaction reference: ${transactionRef}`,
      StatusCodes.CONFLICT,
      [],
      { transactionRef, ...context }
    );
  }

  /**
   * Create an invalid amount error
   * @param {number} amount - Invalid amount
   * @param {string} operation - Operation being attempted
   * @param {object} context - Additional context
   * @returns {WalletError} Invalid amount error instance
   */
  static invalidAmount(amount, operation, context = {}) {
    return new WalletError(
      `Invalid amount ${amount} for ${operation}. Amount must be positive`,
      StatusCodes.BAD_REQUEST,
      [],
      { amount, operation, ...context }
    );
  }

  /**
   * Create a concurrent modification error
   * @param {string} walletId - Wallet ID
   * @param {object} context - Additional context
   * @returns {WalletError} Concurrent modification error instance
   */
  static concurrentModification(walletId, context = {}) {
    return new WalletError(
      `Concurrent modification detected for wallet ${walletId}. Please retry`,
      StatusCodes.CONFLICT,
      [],
      { walletId, ...context }
    );
  }
}

/**
 * @class CommissionError
 * @extends ApiError
 * @description Specialized error class for commission-related operations
 */
class CommissionError extends ApiError {
  constructor(message, statusCode = StatusCodes.BAD_REQUEST, errors = [], context = {}) {
    super(message, statusCode, errors, 'COMMISSION_ERROR', context);
    this.name = 'CommissionError';
    this.isOperational = true;
  }

  /**
   * Create a commission not found error
   * @param {string} commissionId - Commission ID
   * @param {object} context - Additional context
   * @returns {CommissionError} Commission not found error instance
   */
  static notFound(commissionId, context = {}) {
    return new CommissionError(
      `Commission with ID ${commissionId} not found`,
      StatusCodes.NOT_FOUND,
      [],
      { commissionId, ...context }
    );
  }

  /**
   * Create a duplicate commission error
   * @param {string} bookingReference - Booking reference
   * @param {string} affiliateId - Affiliate ID
   * @param {object} context - Additional context
   * @returns {CommissionError} Duplicate commission error instance
   */
  static duplicate(bookingReference, affiliateId, context = {}) {
    return new CommissionError(
      `Commission already exists for booking ${bookingReference} and affiliate ${affiliateId}`,
      StatusCodes.CONFLICT,
      [],
      { bookingReference, affiliateId, ...context }
    );
  }

  /**
   * Create a calculation failed error
   * @param {string} bookingReference - Booking reference
   * @param {string} reason - Failure reason
   * @param {object} context - Additional context
   * @returns {CommissionError} Calculation failed error instance
   */
  static calculationFailed(bookingReference, reason, context = {}) {
    return new CommissionError(
      `Commission calculation failed for booking ${bookingReference}: ${reason}`,
      StatusCodes.INTERNAL_SERVER_ERROR,
      [],
      { bookingReference, reason, ...context }
    );
  }

  /**
   * Create an invalid status transition error
   * @param {string} commissionId - Commission ID
   * @param {string} currentStatus - Current status
   * @param {string} targetStatus - Target status
   * @param {object} context - Additional context
   * @returns {CommissionError} Invalid status transition error instance
   */
  static invalidStatusTransition(commissionId, currentStatus, targetStatus, context = {}) {
    return new CommissionError(
      `Invalid status transition for commission ${commissionId}: ${currentStatus} -> ${targetStatus}`,
      StatusCodes.BAD_REQUEST,
      [],
      { commissionId, currentStatus, targetStatus, ...context }
    );
  }

  /**
   * Create a processing failed error
   * @param {string} commissionId - Commission ID
   * @param {string} operation - Operation that failed
   * @param {string} reason - Failure reason
   * @param {object} context - Additional context
   * @returns {CommissionError} Processing failed error instance
   */
  static processingFailed(commissionId, operation, reason, context = {}) {
    return new CommissionError(
      `Commission ${operation} failed for ${commissionId}: ${reason}`,
      StatusCodes.INTERNAL_SERVER_ERROR,
      [],
      { commissionId, operation, reason, ...context }
    );
  }

  /**
   * Create an invalid commission rate error
   * @param {string} serviceType - Service type
   * @param {number} rate - Invalid rate
   * @param {object} context - Additional context
   * @returns {CommissionError} Invalid commission rate error instance
   */
  static invalidRate(serviceType, rate, context = {}) {
    return new CommissionError(
      `Invalid commission rate ${rate}% for service type ${serviceType}`,
      StatusCodes.BAD_REQUEST,
      [],
      { serviceType, rate, ...context }
    );
  }

  /**
   * Create a dispute error
   * @param {string} commissionId - Commission ID
   * @param {string} reason - Dispute reason
   * @param {object} context - Additional context
   * @returns {CommissionError} Dispute error instance
   */
  static dispute(commissionId, reason, context = {}) {
    return new CommissionError(
      `Commission ${commissionId} is disputed: ${reason}`,
      StatusCodes.CONFLICT,
      [],
      { commissionId, reason, ...context }
    );
  }
}

/**
 * @class WithdrawalError
 * @extends ApiError
 * @description Specialized error class for withdrawal-related operations
 */
class WithdrawalError extends ApiError {
  constructor(message, statusCode = StatusCodes.BAD_REQUEST, errors = [], context = {}) {
    super(message, statusCode, errors, 'WITHDRAWAL_ERROR', context);
    this.name = 'WithdrawalError';
    this.isOperational = true;
  }

  /**
   * Create a withdrawal not found error
   * @param {string} withdrawalId - Withdrawal ID
   * @param {object} context - Additional context
   * @returns {WithdrawalError} Withdrawal not found error instance
   */
  static notFound(withdrawalId, context = {}) {
    return new WithdrawalError(
      `Withdrawal with ID ${withdrawalId} not found`,
      StatusCodes.NOT_FOUND,
      [],
      { withdrawalId, ...context }
    );
  }

  /**
   * Create a minimum amount error
   * @param {number} amount - Requested amount
   * @param {number} minimum - Minimum allowed amount
   * @param {string} currency - Currency
   * @param {object} context - Additional context
   * @returns {WithdrawalError} Minimum amount error instance
   */
  static minimumAmount(amount, minimum, currency = 'NGN', context = {}) {
    return new WithdrawalError(
      `Withdrawal amount ${amount} ${currency} is below minimum ${minimum} ${currency}`,
      StatusCodes.BAD_REQUEST,
      [],
      { amount, minimum, currency, ...context }
    );
  }

  /**
   * Create a bank details validation error
   * @param {Array<string>} validationErrors - Array of validation errors
   * @param {object} context - Additional context
   * @returns {WithdrawalError} Bank details validation error instance
   */
  static bankDetailsValidation(validationErrors, context = {}) {
    return new WithdrawalError(
      'Bank details validation failed',
      StatusCodes.BAD_REQUEST,
      validationErrors,
      context
    );
  }

  /**
   * Create a processing failed error
   * @param {string} withdrawalId - Withdrawal ID
   * @param {string} reason - Failure reason
   * @param {object} context - Additional context
   * @returns {WithdrawalError} Processing failed error instance
   */
  static processingFailed(withdrawalId, reason, context = {}) {
    return new WithdrawalError(
      `Withdrawal ${withdrawalId} processing failed: ${reason}`,
      StatusCodes.INTERNAL_SERVER_ERROR,
      [],
      { withdrawalId, reason, ...context }
    );
  }

  /**
   * Create a pending withdrawal exists error
   * @param {string} affiliateId - Affiliate ID
   * @param {object} context - Additional context
   * @returns {WithdrawalError} Pending withdrawal exists error instance
   */
  static pendingWithdrawalExists(affiliateId, context = {}) {
    return new WithdrawalError(
      `Affiliate ${affiliateId} has a pending withdrawal request`,
      StatusCodes.CONFLICT,
      [],
      { affiliateId, ...context }
    );
  }

  /**
   * Create an invalid status transition error
   * @param {string} withdrawalId - Withdrawal ID
   * @param {string} currentStatus - Current status
   * @param {string} targetStatus - Target status
   * @param {object} context - Additional context
   * @returns {WithdrawalError} Invalid status transition error instance
   */
  static invalidStatusTransition(withdrawalId, currentStatus, targetStatus, context = {}) {
    return new WithdrawalError(
      `Invalid status transition for withdrawal ${withdrawalId}: ${currentStatus} -> ${targetStatus}`,
      StatusCodes.BAD_REQUEST,
      [],
      { withdrawalId, currentStatus, targetStatus, ...context }
    );
  }
}

/**
 * @class QRCodeError
 * @extends ApiError
 * @description Specialized error class for QR code-related operations
 */
class QRCodeError extends ApiError {
  constructor(message, statusCode = StatusCodes.BAD_REQUEST, errors = [], context = {}) {
    super(message, statusCode, errors, 'QR_CODE_ERROR', context);
    this.name = 'QRCodeError';
    this.isOperational = true;
  }

  /**
   * Create a generation failed error
   * @param {string} type - QR code type
   * @param {string} reason - Failure reason
   * @param {object} context - Additional context
   * @returns {QRCodeError} Generation failed error instance
   */
  static generationFailed(type, reason, context = {}) {
    return new QRCodeError(
      `QR code generation failed for type ${type}: ${reason}`,
      StatusCodes.INTERNAL_SERVER_ERROR,
      [],
      { type, reason, ...context }
    );
  }

  /**
   * Create an invalid QR code error
   * @param {string} qrData - Invalid QR data
   * @param {object} context - Additional context
   * @returns {QRCodeError} Invalid QR code error instance
   */
  static invalid(qrData, context = {}) {
    return new QRCodeError(
      'Invalid or corrupted QR code data',
      StatusCodes.BAD_REQUEST,
      [],
      { qrData, ...context }
    );
  }

  /**
   * Create an expired QR code error
   * @param {string} qrId - QR code ID
   * @param {Date} expiredAt - Expiration date
   * @param {object} context - Additional context
   * @returns {QRCodeError} Expired QR code error instance
   */
  static expired(qrId, expiredAt, context = {}) {
    return new QRCodeError(
      `QR code ${qrId} expired at ${expiredAt}`,
      StatusCodes.GONE,
      [],
      { qrId, expiredAt, ...context }
    );
  }
}

module.exports = {
  AffiliateError,
  WalletError,
  CommissionError,
  WithdrawalError,
  QRCodeError
};