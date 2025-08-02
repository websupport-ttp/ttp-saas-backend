// v1/test/utils/affiliateErrors.test.js
const { StatusCodes } = require('http-status-codes');
const {
  AffiliateError,
  WalletError,
  CommissionError,
  WithdrawalError,
  QRCodeError
} = require('../../utils/affiliateErrors');

describe('Affiliate Error Classes', () => {
  describe('AffiliateError', () => {
    it('should create basic affiliate error', () => {
      const error = new AffiliateError('Test error');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AffiliateError);
      expect(error.name).toBe('AffiliateError');
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(error.code).toBe('AFFILIATE_ERROR');
      expect(error.isOperational).toBe(true);
    });

    it('should create affiliate not found error', () => {
      const affiliateId = 'AFF-123';
      const error = AffiliateError.notFound(affiliateId, { userId: 'user123' });
      
      expect(error.message).toBe(`Affiliate with ID ${affiliateId} not found`);
      expect(error.statusCode).toBe(StatusCodes.NOT_FOUND);
      expect(error.context.affiliateId).toBe(affiliateId);
      expect(error.context.userId).toBe('user123');
    });

    it('should create affiliate already exists error', () => {
      const identifier = 'business@example.com';
      const error = AffiliateError.alreadyExists(identifier);
      
      expect(error.message).toBe(`Affiliate with ${identifier} already exists`);
      expect(error.statusCode).toBe(StatusCodes.CONFLICT);
      expect(error.context.identifier).toBe(identifier);
    });

    it('should create affiliate not approved error', () => {
      const affiliateId = 'AFF-123';
      const status = 'pending';
      const error = AffiliateError.notApproved(affiliateId, status);
      
      expect(error.message).toBe(`Affiliate ${affiliateId} is not approved. Current status: ${status}`);
      expect(error.statusCode).toBe(StatusCodes.FORBIDDEN);
      expect(error.context.affiliateId).toBe(affiliateId);
      expect(error.context.status).toBe(status);
    });

    it('should create affiliate suspended error', () => {
      const affiliateId = 'AFF-123';
      const reason = 'Fraudulent activity';
      const error = AffiliateError.suspended(affiliateId, reason);
      
      expect(error.message).toBe(`Affiliate ${affiliateId} is suspended: ${reason}`);
      expect(error.statusCode).toBe(StatusCodes.FORBIDDEN);
      expect(error.context.affiliateId).toBe(affiliateId);
      expect(error.context.reason).toBe(reason);
    });

    it('should create invalid referral code error', () => {
      const referralCode = 'INVALID-CODE';
      const error = AffiliateError.invalidReferralCode(referralCode);
      
      expect(error.message).toBe(`Invalid or expired referral code: ${referralCode}`);
      expect(error.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(error.context.referralCode).toBe(referralCode);
    });

    it('should create registration validation error', () => {
      const validationErrors = ['Business name is required', 'Invalid email format'];
      const error = AffiliateError.registrationValidation(validationErrors);
      
      expect(error.message).toBe('Affiliate registration validation failed');
      expect(error.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(error.errors).toEqual(validationErrors);
    });

    it('should create approval workflow error', () => {
      const affiliateId = 'AFF-123';
      const currentStatus = 'suspended';
      const action = 'approve';
      const error = AffiliateError.approvalWorkflow(affiliateId, currentStatus, action);
      
      expect(error.message).toBe(`Cannot ${action} affiliate ${affiliateId} with status ${currentStatus}`);
      expect(error.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(error.context.affiliateId).toBe(affiliateId);
      expect(error.context.currentStatus).toBe(currentStatus);
      expect(error.context.action).toBe(action);
    });
  });

  describe('WalletError', () => {
    it('should create basic wallet error', () => {
      const error = new WalletError('Wallet operation failed');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(WalletError);
      expect(error.name).toBe('WalletError');
      expect(error.message).toBe('Wallet operation failed');
      expect(error.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(error.code).toBe('WALLET_ERROR');
      expect(error.isOperational).toBe(true);
    });

    it('should create insufficient balance error', () => {
      const requestedAmount = 1000;
      const availableBalance = 500;
      const currency = 'NGN';
      const error = WalletError.insufficientBalance(requestedAmount, availableBalance, currency);
      
      expect(error.message).toBe(`Insufficient balance. Requested: ${requestedAmount} ${currency}, Available: ${availableBalance} ${currency}`);
      expect(error.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(error.context.requestedAmount).toBe(requestedAmount);
      expect(error.context.availableBalance).toBe(availableBalance);
      expect(error.context.currency).toBe(currency);
    });

    it('should create wallet not found error', () => {
      const affiliateId = 'AFF-123';
      const error = WalletError.notFound(affiliateId);
      
      expect(error.message).toBe(`Wallet not found for affiliate ${affiliateId}`);
      expect(error.statusCode).toBe(StatusCodes.NOT_FOUND);
      expect(error.context.affiliateId).toBe(affiliateId);
    });

    it('should create wallet frozen error', () => {
      const affiliateId = 'AFF-123';
      const reason = 'Suspicious activity';
      const error = WalletError.frozen(affiliateId, reason);
      
      expect(error.message).toBe(`Wallet for affiliate ${affiliateId} is frozen: ${reason}`);
      expect(error.statusCode).toBe(StatusCodes.FORBIDDEN);
      expect(error.context.affiliateId).toBe(affiliateId);
      expect(error.context.reason).toBe(reason);
    });

    it('should create transaction failed error', () => {
      const operation = 'credit';
      const transactionId = 'TXN-123';
      const reason = 'Database connection failed';
      const error = WalletError.transactionFailed(operation, transactionId, reason);
      
      expect(error.message).toBe(`Wallet ${operation} failed for transaction ${transactionId}: ${reason}`);
      expect(error.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(error.context.operation).toBe(operation);
      expect(error.context.transactionId).toBe(transactionId);
      expect(error.context.reason).toBe(reason);
    });

    it('should create duplicate transaction error', () => {
      const transactionRef = 'REF-123';
      const error = WalletError.duplicateTransaction(transactionRef);
      
      expect(error.message).toBe(`Duplicate transaction reference: ${transactionRef}`);
      expect(error.statusCode).toBe(StatusCodes.CONFLICT);
      expect(error.context.transactionRef).toBe(transactionRef);
    });

    it('should create invalid amount error', () => {
      const amount = -100;
      const operation = 'credit';
      const error = WalletError.invalidAmount(amount, operation);
      
      expect(error.message).toBe(`Invalid amount ${amount} for ${operation}. Amount must be positive`);
      expect(error.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(error.context.amount).toBe(amount);
      expect(error.context.operation).toBe(operation);
    });

    it('should create concurrent modification error', () => {
      const walletId = 'WALLET-123';
      const error = WalletError.concurrentModification(walletId);
      
      expect(error.message).toBe(`Concurrent modification detected for wallet ${walletId}. Please retry`);
      expect(error.statusCode).toBe(StatusCodes.CONFLICT);
      expect(error.context.walletId).toBe(walletId);
    });
  });

  describe('CommissionError', () => {
    it('should create basic commission error', () => {
      const error = new CommissionError('Commission calculation failed');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(CommissionError);
      expect(error.name).toBe('CommissionError');
      expect(error.message).toBe('Commission calculation failed');
      expect(error.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(error.code).toBe('COMMISSION_ERROR');
      expect(error.isOperational).toBe(true);
    });

    it('should create commission not found error', () => {
      const commissionId = 'COMM-123';
      const error = CommissionError.notFound(commissionId);
      
      expect(error.message).toBe(`Commission with ID ${commissionId} not found`);
      expect(error.statusCode).toBe(StatusCodes.NOT_FOUND);
      expect(error.context.commissionId).toBe(commissionId);
    });

    it('should create duplicate commission error', () => {
      const bookingReference = 'BOOK-123';
      const affiliateId = 'AFF-123';
      const error = CommissionError.duplicate(bookingReference, affiliateId);
      
      expect(error.message).toBe(`Commission already exists for booking ${bookingReference} and affiliate ${affiliateId}`);
      expect(error.statusCode).toBe(StatusCodes.CONFLICT);
      expect(error.context.bookingReference).toBe(bookingReference);
      expect(error.context.affiliateId).toBe(affiliateId);
    });

    it('should create calculation failed error', () => {
      const bookingReference = 'BOOK-123';
      const reason = 'Invalid service type';
      const error = CommissionError.calculationFailed(bookingReference, reason);
      
      expect(error.message).toBe(`Commission calculation failed for booking ${bookingReference}: ${reason}`);
      expect(error.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(error.context.bookingReference).toBe(bookingReference);
      expect(error.context.reason).toBe(reason);
    });

    it('should create invalid status transition error', () => {
      const commissionId = 'COMM-123';
      const currentStatus = 'paid';
      const targetStatus = 'pending';
      const error = CommissionError.invalidStatusTransition(commissionId, currentStatus, targetStatus);
      
      expect(error.message).toBe(`Invalid status transition for commission ${commissionId}: ${currentStatus} -> ${targetStatus}`);
      expect(error.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(error.context.commissionId).toBe(commissionId);
      expect(error.context.currentStatus).toBe(currentStatus);
      expect(error.context.targetStatus).toBe(targetStatus);
    });

    it('should create processing failed error', () => {
      const commissionId = 'COMM-123';
      const operation = 'approval';
      const reason = 'Wallet service unavailable';
      const error = CommissionError.processingFailed(commissionId, operation, reason);
      
      expect(error.message).toBe(`Commission ${operation} failed for ${commissionId}: ${reason}`);
      expect(error.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(error.context.commissionId).toBe(commissionId);
      expect(error.context.operation).toBe(operation);
      expect(error.context.reason).toBe(reason);
    });

    it('should create invalid rate error', () => {
      const serviceType = 'flights';
      const rate = -5;
      const error = CommissionError.invalidRate(serviceType, rate);
      
      expect(error.message).toBe(`Invalid commission rate ${rate}% for service type ${serviceType}`);
      expect(error.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(error.context.serviceType).toBe(serviceType);
      expect(error.context.rate).toBe(rate);
    });

    it('should create dispute error', () => {
      const commissionId = 'COMM-123';
      const reason = 'Booking was cancelled';
      const error = CommissionError.dispute(commissionId, reason);
      
      expect(error.message).toBe(`Commission ${commissionId} is disputed: ${reason}`);
      expect(error.statusCode).toBe(StatusCodes.CONFLICT);
      expect(error.context.commissionId).toBe(commissionId);
      expect(error.context.reason).toBe(reason);
    });
  });

  describe('WithdrawalError', () => {
    it('should create basic withdrawal error', () => {
      const error = new WithdrawalError('Withdrawal processing failed');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(WithdrawalError);
      expect(error.name).toBe('WithdrawalError');
      expect(error.message).toBe('Withdrawal processing failed');
      expect(error.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(error.code).toBe('WITHDRAWAL_ERROR');
      expect(error.isOperational).toBe(true);
    });

    it('should create withdrawal not found error', () => {
      const withdrawalId = 'WD-123';
      const error = WithdrawalError.notFound(withdrawalId);
      
      expect(error.message).toBe(`Withdrawal with ID ${withdrawalId} not found`);
      expect(error.statusCode).toBe(StatusCodes.NOT_FOUND);
      expect(error.context.withdrawalId).toBe(withdrawalId);
    });

    it('should create minimum amount error', () => {
      const amount = 500;
      const minimum = 1000;
      const currency = 'NGN';
      const error = WithdrawalError.minimumAmount(amount, minimum, currency);
      
      expect(error.message).toBe(`Withdrawal amount ${amount} ${currency} is below minimum ${minimum} ${currency}`);
      expect(error.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(error.context.amount).toBe(amount);
      expect(error.context.minimum).toBe(minimum);
      expect(error.context.currency).toBe(currency);
    });

    it('should create bank details validation error', () => {
      const validationErrors = ['Invalid account number', 'Bank code is required'];
      const error = WithdrawalError.bankDetailsValidation(validationErrors);
      
      expect(error.message).toBe('Bank details validation failed');
      expect(error.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(error.errors).toEqual(validationErrors);
    });

    it('should create processing failed error', () => {
      const withdrawalId = 'WD-123';
      const reason = 'Bank transfer failed';
      const error = WithdrawalError.processingFailed(withdrawalId, reason);
      
      expect(error.message).toBe(`Withdrawal ${withdrawalId} processing failed: ${reason}`);
      expect(error.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(error.context.withdrawalId).toBe(withdrawalId);
      expect(error.context.reason).toBe(reason);
    });

    it('should create pending withdrawal exists error', () => {
      const affiliateId = 'AFF-123';
      const error = WithdrawalError.pendingWithdrawalExists(affiliateId);
      
      expect(error.message).toBe(`Affiliate ${affiliateId} has a pending withdrawal request`);
      expect(error.statusCode).toBe(StatusCodes.CONFLICT);
      expect(error.context.affiliateId).toBe(affiliateId);
    });

    it('should create invalid status transition error', () => {
      const withdrawalId = 'WD-123';
      const currentStatus = 'completed';
      const targetStatus = 'pending';
      const error = WithdrawalError.invalidStatusTransition(withdrawalId, currentStatus, targetStatus);
      
      expect(error.message).toBe(`Invalid status transition for withdrawal ${withdrawalId}: ${currentStatus} -> ${targetStatus}`);
      expect(error.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(error.context.withdrawalId).toBe(withdrawalId);
      expect(error.context.currentStatus).toBe(currentStatus);
      expect(error.context.targetStatus).toBe(targetStatus);
    });
  });

  describe('QRCodeError', () => {
    it('should create basic QR code error', () => {
      const error = new QRCodeError('QR code operation failed');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(QRCodeError);
      expect(error.name).toBe('QRCodeError');
      expect(error.message).toBe('QR code operation failed');
      expect(error.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(error.code).toBe('QR_CODE_ERROR');
      expect(error.isOperational).toBe(true);
    });

    it('should create generation failed error', () => {
      const type = 'affiliate';
      const reason = 'Invalid data format';
      const error = QRCodeError.generationFailed(type, reason);
      
      expect(error.message).toBe(`QR code generation failed for type ${type}: ${reason}`);
      expect(error.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(error.context.type).toBe(type);
      expect(error.context.reason).toBe(reason);
    });

    it('should create invalid QR code error', () => {
      const qrData = 'corrupted-data';
      const error = QRCodeError.invalid(qrData);
      
      expect(error.message).toBe('Invalid or corrupted QR code data');
      expect(error.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(error.context.qrData).toBe(qrData);
    });

    it('should create expired QR code error', () => {
      const qrId = 'QR-123';
      const expiredAt = new Date('2023-01-01');
      const error = QRCodeError.expired(qrId, expiredAt);
      
      expect(error.message).toBe(`QR code ${qrId} expired at ${expiredAt}`);
      expect(error.statusCode).toBe(StatusCodes.GONE);
      expect(error.context.qrId).toBe(qrId);
      expect(error.context.expiredAt).toBe(expiredAt);
    });
  });

  describe('Error inheritance and properties', () => {
    it('should have proper error inheritance chain', () => {
      const affiliateError = new AffiliateError('Test');
      const walletError = new WalletError('Test');
      const commissionError = new CommissionError('Test');
      const withdrawalError = new WithdrawalError('Test');
      const qrCodeError = new QRCodeError('Test');

      expect(affiliateError).toBeInstanceOf(Error);
      expect(walletError).toBeInstanceOf(Error);
      expect(commissionError).toBeInstanceOf(Error);
      expect(withdrawalError).toBeInstanceOf(Error);
      expect(qrCodeError).toBeInstanceOf(Error);
    });

    it('should have stack traces', () => {
      const error = new AffiliateError('Test error');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('AffiliateError');
      expect(error.stack).toContain('Test error');
    });

    it('should support custom status codes and contexts', () => {
      const context = { userId: 'user123', operation: 'test' };
      const error = new WalletError('Custom error', StatusCodes.FORBIDDEN, ['error1', 'error2'], context);
      
      expect(error.statusCode).toBe(StatusCodes.FORBIDDEN);
      expect(error.errors).toEqual(['error1', 'error2']);
      expect(error.context).toEqual(context);
    });
  });
});