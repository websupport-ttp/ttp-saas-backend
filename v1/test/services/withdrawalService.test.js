// v1/test/services/withdrawalService.test.js
const WithdrawalService = require('../../services/withdrawalService');
const Withdrawal = require('../../models/withdrawalModel');
const Wallet = require('../../models/walletModel');
const Affiliate = require('../../models/affiliateModel');
const WalletService = require('../../services/walletService');
const QRCodeService = require('../../services/qrCodeService');
const paystackService = require('../../services/paystackService');
const { ApiError } = require('../../utils/apiError');
const { StatusCodes } = require('http-status-codes');

// Mock dependencies
jest.mock('../../models/withdrawalModel');
jest.mock('../../models/walletModel');
jest.mock('../../models/affiliateModel');
jest.mock('../../services/walletService');
jest.mock('../../services/qrCodeService');
jest.mock('../../services/paystackService');

describe('WithdrawalService', () => {
  let mockAffiliate;
  let mockWallet;
  let mockWithdrawal;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock affiliate
    mockAffiliate = {
      _id: 'affiliate123',
      businessName: 'Test Business',
      status: 'active'
    };

    // Mock wallet
    mockWallet = {
      _id: 'wallet123',
      affiliateId: 'affiliate123',
      balance: 10000,
      status: 'active',
      canWithdraw: jest.fn().mockReturnValue({ allowed: true })
    };

    // Mock withdrawal
    mockWithdrawal = {
      _id: 'withdrawal123',
      affiliateId: 'affiliate123',
      walletId: 'wallet123',
      amount: 5000,
      processingFee: 75,
      netAmount: 4925,
      status: 'pending',
      bankDetails: {
        accountName: 'Test Account',
        accountNumber: '1234567890',
        bankCode: '058',
        bankName: 'GTB'
      },
      requestedAt: new Date(),
      save: jest.fn().mockResolvedValue(true),
      getSummary: jest.fn().mockReturnValue({
        id: 'withdrawal123',
        amount: 5000,
        status: 'pending'
      }),
      markAsProcessing: jest.fn().mockResolvedValue(true),
      markAsCompleted: jest.fn().mockResolvedValue(true),
      markAsFailed: jest.fn().mockResolvedValue(true),
      cancel: jest.fn().mockResolvedValue(true),
      reverse: jest.fn().mockResolvedValue(true),
      retry: jest.fn().mockResolvedValue(true),
      canBeCancelled: jest.fn().mockReturnValue(true),
      canBeRetried: jest.fn().mockReturnValue(true),
      retryCount: 0
    };

    // Mock QR code service
    QRCodeService.generateWithdrawalQR.mockResolvedValue({
      data: 'base64qrcode',
      url: 'https://example.com/qr/withdrawal123',
      metadata: { withdrawalId: 'withdrawal123' }
    });

    // Mock wallet service
    WalletService.debitWallet.mockResolvedValue({ success: true });
    WalletService.creditWallet.mockResolvedValue({ success: true });
  });

  describe('requestWithdrawal', () => {
    const validBankDetails = {
      accountName: 'Test Account',
      accountNumber: '1234567890',
      bankCode: '058',
      bankName: 'GTB'
    };

    beforeEach(() => {
      Affiliate.findById.mockResolvedValue(mockAffiliate);
      Wallet.findOne.mockResolvedValue(mockWallet);
      Withdrawal.find.mockResolvedValue([]); // No pending withdrawals
      Withdrawal.mockImplementation(() => mockWithdrawal);
    });

    it('should create withdrawal request successfully', async () => {
      const result = await WithdrawalService.requestWithdrawal(
        'affiliate123',
        5000,
        validBankDetails
      );

      expect(result.success).toBe(true);
      expect(result.withdrawal).toBeDefined();
      expect(result.message).toBe('Withdrawal request created successfully');
      expect(WalletService.debitWallet).toHaveBeenCalledWith(
        'affiliate123',
        5000,
        'withdrawal_withdrawal123',
        expect.objectContaining({
          type: 'withdrawal_reserve'
        })
      );
    });

    it('should validate required parameters', async () => {
      await expect(
        WithdrawalService.requestWithdrawal(null, 5000, validBankDetails)
      ).rejects.toThrow(ApiError);

      await expect(
        WithdrawalService.requestWithdrawal('affiliate123', null, validBankDetails)
      ).rejects.toThrow(ApiError);

      await expect(
        WithdrawalService.requestWithdrawal('affiliate123', 5000, null)
      ).rejects.toThrow(ApiError);
    });

    it('should validate withdrawal amount', async () => {
      await expect(
        WithdrawalService.requestWithdrawal('affiliate123', 0, validBankDetails)
      ).rejects.toThrow('Withdrawal amount must be greater than 0');

      await expect(
        WithdrawalService.requestWithdrawal('affiliate123', -100, validBankDetails)
      ).rejects.toThrow('Withdrawal amount must be greater than 0');
    });

    it('should validate bank details', async () => {
      const invalidBankDetails = {
        accountName: '',
        accountNumber: '123', // Invalid length
        bankCode: '12', // Invalid length
        bankName: 'Test Bank'
      };

      await expect(
        WithdrawalService.requestWithdrawal('affiliate123', 5000, invalidBankDetails)
      ).rejects.toThrow('Invalid bank details');
    });

    it('should check affiliate exists and is active', async () => {
      Affiliate.findById.mockResolvedValue(null);

      await expect(
        WithdrawalService.requestWithdrawal('affiliate123', 5000, validBankDetails)
      ).rejects.toThrow('Affiliate not found');

      Affiliate.findById.mockResolvedValue({ ...mockAffiliate, status: 'suspended' });

      await expect(
        WithdrawalService.requestWithdrawal('affiliate123', 5000, validBankDetails)
      ).rejects.toThrow('Affiliate account is not active');
    });

    it('should check wallet exists and is active', async () => {
      Wallet.findOne.mockResolvedValue(null);

      await expect(
        WithdrawalService.requestWithdrawal('affiliate123', 5000, validBankDetails)
      ).rejects.toThrow('Wallet not found for affiliate');

      Wallet.findOne.mockResolvedValue({ ...mockWallet, status: 'frozen' });

      await expect(
        WithdrawalService.requestWithdrawal('affiliate123', 5000, validBankDetails)
      ).rejects.toThrow('Wallet is not active');
    });

    it('should validate withdrawal eligibility', async () => {
      mockWallet.canWithdraw.mockReturnValue({
        allowed: false,
        reason: 'Insufficient balance'
      });

      await expect(
        WithdrawalService.requestWithdrawal('affiliate123', 5000, validBankDetails)
      ).rejects.toThrow('Withdrawal not allowed: Insufficient balance');
    });

    it('should check for pending withdrawals', async () => {
      Withdrawal.find.mockResolvedValue([{ _id: 'pending123', status: 'pending' }]);

      await expect(
        WithdrawalService.requestWithdrawal('affiliate123', 5000, validBankDetails)
      ).rejects.toThrow('You have pending withdrawal requests');
    });

    it('should calculate processing fees correctly', async () => {
      const result = await WithdrawalService.requestWithdrawal(
        'affiliate123',
        5000,
        validBankDetails,
        { processingFeeRate: 0.02, minFee: 100, maxFee: 1000 }
      );

      expect(result.success).toBe(true);
      // 5000 * 0.02 = 100, which is equal to minFee
    });

    it('should apply minimum processing fee', async () => {
      const result = await WithdrawalService.requestWithdrawal(
        'affiliate123',
        1000, // Low amount
        validBankDetails,
        { processingFeeRate: 0.015, minFee: 100, maxFee: 2000 }
      );

      expect(result.success).toBe(true);
      // 1000 * 0.015 = 15, but minFee is 100
    });

    it('should apply maximum processing fee', async () => {
      const result = await WithdrawalService.requestWithdrawal(
        'affiliate123',
        200000, // High amount
        validBankDetails,
        { processingFeeRate: 0.015, minFee: 50, maxFee: 1000 }
      );

      expect(result.success).toBe(true);
      // 200000 * 0.015 = 3000, but maxFee is 1000
    });

    it('should validate net amount after fees', async () => {
      await expect(
        WithdrawalService.requestWithdrawal(
          'affiliate123',
          100,
          validBankDetails,
          { processingFeeRate: 0.015, minFee: 200, maxFee: 2000 }
        )
      ).rejects.toThrow('Net withdrawal amount after fees must be greater than 0');
    });

    it('should generate QR code for withdrawal', async () => {
      const result = await WithdrawalService.requestWithdrawal(
        'affiliate123',
        5000,
        validBankDetails
      );

      expect(QRCodeService.generateWithdrawalQR).toHaveBeenCalledWith(
        expect.objectContaining({
          withdrawalId: 'withdrawal123',
          affiliateId: 'affiliate123',
          amount: 5000
        })
      );
      expect(result.success).toBe(true);
    });

    it('should handle QR code generation failure gracefully', async () => {
      QRCodeService.generateWithdrawalQR.mockRejectedValue(new Error('QR generation failed'));

      const result = await WithdrawalService.requestWithdrawal(
        'affiliate123',
        5000,
        validBankDetails
      );

      expect(result.success).toBe(true); // Should still succeed
    });
  });

  describe('processWithdrawal', () => {
    beforeEach(() => {
      Withdrawal.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue({
            ...mockWithdrawal,
            affiliateId: mockAffiliate,
            walletId: mockWallet
          })
        })
      });

      // Mock Paystack methods
      WithdrawalService.createOrGetPaystackRecipient = jest.fn().mockResolvedValue('RCP_123');
      WithdrawalService.initiatePaystackTransfer = jest.fn().mockResolvedValue({
        reference: 'TRF_123456789',
        transfer_code: 'TRF-CODE-123',
        status: 'pending'
      });
    });

    it('should process withdrawal successfully', async () => {
      const result = await WithdrawalService.processWithdrawal('withdrawal123', 'admin123');

      expect(result.success).toBe(true);
      expect(result.paystackReference).toBe('TRF_123456789');
      expect(mockWithdrawal.markAsProcessing).toHaveBeenCalledWith(
        'TRF_123456789',
        'TRF-CODE-123',
        'admin123'
      );
    });

    it('should validate withdrawal exists', async () => {
      Withdrawal.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(null)
        })
      });

      await expect(
        WithdrawalService.processWithdrawal('nonexistent')
      ).rejects.toThrow('Withdrawal not found');
    });

    it('should validate withdrawal status', async () => {
      const processingWithdrawal = {
        ...mockWithdrawal,
        status: 'processing',
        affiliateId: mockAffiliate,
        walletId: mockWallet
      };

      Withdrawal.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(processingWithdrawal)
        })
      });

      await expect(
        WithdrawalService.processWithdrawal('withdrawal123')
      ).rejects.toThrow('Withdrawal cannot be processed. Current status: processing');
    });

    it('should validate affiliate status', async () => {
      const inactiveAffiliate = { ...mockAffiliate, status: 'suspended' };
      const withdrawalWithInactiveAffiliate = {
        ...mockWithdrawal,
        affiliateId: inactiveAffiliate,
        walletId: mockWallet
      };

      Withdrawal.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(withdrawalWithInactiveAffiliate)
        })
      });

      await expect(
        WithdrawalService.processWithdrawal('withdrawal123')
      ).rejects.toThrow('Affiliate account is not active');
    });

    it('should validate wallet status', async () => {
      const inactiveWallet = { ...mockWallet, status: 'frozen' };
      const withdrawalWithInactiveWallet = {
        ...mockWithdrawal,
        affiliateId: mockAffiliate,
        walletId: inactiveWallet
      };

      Withdrawal.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(withdrawalWithInactiveWallet)
        })
      });

      await expect(
        WithdrawalService.processWithdrawal('withdrawal123')
      ).rejects.toThrow('Wallet is not active');
    });

    it('should handle Paystack transfer failure', async () => {
      WithdrawalService.initiatePaystackTransfer.mockRejectedValue(
        new Error('Paystack transfer failed')
      );

      Withdrawal.findById.mockResolvedValue(mockWithdrawal);
      WithdrawalService.reverseWithdrawal = jest.fn().mockResolvedValue({ success: true });

      await expect(
        WithdrawalService.processWithdrawal('withdrawal123')
      ).rejects.toThrow('Failed to process withdrawal');

      expect(mockWithdrawal.markAsFailed).toHaveBeenCalled();
    });
  });

  describe('cancelWithdrawal', () => {
    beforeEach(() => {
      Withdrawal.findById.mockResolvedValue(mockWithdrawal);
      WithdrawalService.reverseWithdrawal = jest.fn().mockResolvedValue({ success: true });
    });

    it('should cancel withdrawal successfully', async () => {
      const result = await WithdrawalService.cancelWithdrawal(
        'withdrawal123',
        'User requested cancellation',
        'admin123'
      );

      expect(result.success).toBe(true);
      expect(mockWithdrawal.cancel).toHaveBeenCalledWith(
        'User requested cancellation',
        'admin123'
      );
      expect(WithdrawalService.reverseWithdrawal).toHaveBeenCalledWith(
        'withdrawal123',
        'User requested cancellation'
      );
    });

    it('should validate withdrawal exists', async () => {
      Withdrawal.findById.mockResolvedValue(null);

      await expect(
        WithdrawalService.cancelWithdrawal('nonexistent', 'reason')
      ).rejects.toThrow('Withdrawal not found');
    });

    it('should validate withdrawal can be cancelled', async () => {
      mockWithdrawal.canBeCancelled.mockReturnValue(false);
      mockWithdrawal.status = 'completed';

      await expect(
        WithdrawalService.cancelWithdrawal('withdrawal123', 'reason')
      ).rejects.toThrow('Withdrawal cannot be cancelled. Current status: completed');
    });
  });

  describe('reverseWithdrawal', () => {
    beforeEach(() => {
      Withdrawal.findById.mockResolvedValue(mockWithdrawal);
    });

    it('should reverse withdrawal successfully', async () => {
      const result = await WithdrawalService.reverseWithdrawal(
        'withdrawal123',
        'Transfer failed',
        'admin123'
      );

      expect(result.success).toBe(true);
      expect(WalletService.creditWallet).toHaveBeenCalledWith(
        'affiliate123',
        5000,
        'withdrawal_reversal_withdrawal123',
        expect.objectContaining({
          type: 'withdrawal_reversal',
          description: 'Withdrawal reversal: Transfer failed'
        })
      );
      expect(mockWithdrawal.reverse).toHaveBeenCalledWith('Transfer failed', 'admin123');
    });

    it('should validate withdrawal exists', async () => {
      Withdrawal.findById.mockResolvedValue(null);

      await expect(
        WithdrawalService.reverseWithdrawal('nonexistent', 'reason')
      ).rejects.toThrow('Withdrawal not found');
    });

    it('should not update status if already reversed', async () => {
      mockWithdrawal.status = 'reversed';

      const result = await WithdrawalService.reverseWithdrawal(
        'withdrawal123',
        'Transfer failed'
      );

      expect(result.success).toBe(true);
      expect(mockWithdrawal.reverse).not.toHaveBeenCalled();
    });
  });

  describe('retryWithdrawal', () => {
    beforeEach(() => {
      Withdrawal.findById.mockResolvedValue(mockWithdrawal);
      WithdrawalService.processWithdrawal = jest.fn().mockResolvedValue({ success: true });
    });

    it('should retry withdrawal successfully', async () => {
      const result = await WithdrawalService.retryWithdrawal('withdrawal123');

      expect(result.success).toBe(true);
      expect(mockWithdrawal.retry).toHaveBeenCalled();
      expect(WithdrawalService.processWithdrawal).toHaveBeenCalledWith('withdrawal123');
    });

    it('should validate withdrawal exists', async () => {
      Withdrawal.findById.mockResolvedValue(null);

      await expect(
        WithdrawalService.retryWithdrawal('nonexistent')
      ).rejects.toThrow('Withdrawal not found');
    });

    it('should validate withdrawal can be retried', async () => {
      mockWithdrawal.canBeRetried.mockReturnValue(false);
      mockWithdrawal.status = 'completed';
      mockWithdrawal.retryCount = 5;

      await expect(
        WithdrawalService.retryWithdrawal('withdrawal123')
      ).rejects.toThrow('Withdrawal cannot be retried. Status: completed, Retry count: 5');
    });
  });

  describe('getWithdrawalHistory', () => {
    const mockWithdrawals = [
      { _id: 'w1', amount: 1000, status: 'completed' },
      { _id: 'w2', amount: 2000, status: 'pending' }
    ];

    const mockStats = [{
      totalWithdrawals: 3000,
      totalRequests: 2,
      completedWithdrawals: 1000,
      pendingWithdrawals: 2000
    }];

    beforeEach(() => {
      Withdrawal.findByAffiliate.mockResolvedValue(mockWithdrawals);
      Withdrawal.countDocuments.mockResolvedValue(2);
      Withdrawal.getWithdrawalStats.mockResolvedValue(mockStats);
    });

    it('should get withdrawal history successfully', async () => {
      const result = await WithdrawalService.getWithdrawalHistory('affiliate123');

      expect(result.success).toBe(true);
      expect(result.withdrawals).toEqual(mockWithdrawals);
      expect(result.pagination.total).toBe(2);
      expect(result.statistics).toEqual(mockStats[0]);
    });

    it('should handle pagination options', async () => {
      const options = {
        limit: 10,
        skip: 20,
        status: 'completed'
      };

      await WithdrawalService.getWithdrawalHistory('affiliate123', options);

      expect(Withdrawal.findByAffiliate).toHaveBeenCalledWith('affiliate123', {
        status: 'completed',
        startDate: undefined,
        endDate: undefined,
        limit: 10,
        skip: 20
      });
    });

    it('should handle date range filters', async () => {
      const options = {
        startDate: '2023-01-01',
        endDate: '2023-12-31'
      };

      await WithdrawalService.getWithdrawalHistory('affiliate123', options);

      expect(Withdrawal.getWithdrawalStats).toHaveBeenCalledWith('affiliate123', {
        startDate: '2023-01-01',
        endDate: '2023-12-31'
      });
    });

    it('should handle empty statistics', async () => {
      Withdrawal.getWithdrawalStats.mockResolvedValue([]);

      const result = await WithdrawalService.getWithdrawalHistory('affiliate123');

      expect(result.statistics).toEqual({
        totalWithdrawals: 0,
        totalProcessingFees: 0,
        totalNetAmount: 0,
        totalRequests: 0,
        completedWithdrawals: 0,
        pendingWithdrawals: 0,
        failedWithdrawals: 0,
        averageWithdrawalAmount: 0
      });
    });
  });

  describe('validateBankDetails', () => {
    const validBankDetails = {
      accountName: 'Test Account',
      accountNumber: '1234567890',
      bankCode: '058',
      bankName: 'GTB'
    };

    beforeEach(() => {
      WithdrawalService.verifyBankAccount = jest.fn().mockResolvedValue({
        valid: true,
        accountName: 'Test Account'
      });
    });

    it('should validate correct bank details', async () => {
      const result = await WithdrawalService.validateBankDetails(validBankDetails);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate required fields', async () => {
      const invalidDetails = {
        accountName: '',
        accountNumber: '',
        bankCode: '',
        bankName: ''
      };

      const result = await WithdrawalService.validateBankDetails(invalidDetails);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Account name is required');
      expect(result.errors).toContain('Account number is required');
      expect(result.errors).toContain('Bank code is required');
      expect(result.errors).toContain('Bank name is required');
    });

    it('should validate account number format', async () => {
      const invalidDetails = {
        ...validBankDetails,
        accountNumber: '123' // Too short
      };

      const result = await WithdrawalService.validateBankDetails(invalidDetails);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Account number must be exactly 10 digits');
    });

    it('should validate bank code format', async () => {
      const invalidDetails = {
        ...validBankDetails,
        bankCode: '12' // Too short
      };

      const result = await WithdrawalService.validateBankDetails(invalidDetails);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Bank code must be exactly 3 digits');
    });

    it('should validate field lengths', async () => {
      const invalidDetails = {
        ...validBankDetails,
        accountName: 'a'.repeat(101), // Too long
        bankName: 'b'.repeat(101) // Too long
      };

      const result = await WithdrawalService.validateBankDetails(invalidDetails);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Account name cannot exceed 100 characters');
      expect(result.errors).toContain('Bank name cannot exceed 100 characters');
    });

    it('should handle bank verification failure', async () => {
      WithdrawalService.verifyBankAccount.mockResolvedValue({
        valid: false,
        error: 'Account not found'
      });

      const result = await WithdrawalService.validateBankDetails(validBankDetails);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Bank account verification failed');
    });

    it('should handle bank verification service error gracefully', async () => {
      WithdrawalService.verifyBankAccount.mockRejectedValue(new Error('Service unavailable'));

      const result = await WithdrawalService.validateBankDetails(validBankDetails);

      // Should still pass validation if verification service is down
      expect(result.valid).toBe(true);
    });
  });

  describe('handleWebhook', () => {
    beforeEach(() => {
      Withdrawal.findOne.mockResolvedValue(mockWithdrawal);
      WithdrawalService.reverseWithdrawal = jest.fn().mockResolvedValue({ success: true });
    });

    it('should handle transfer success webhook', async () => {
      const webhookData = {
        event: 'transfer.success',
        data: { reference: 'TRF_123456789' }
      };

      const result = await WithdrawalService.handleWebhook(webhookData);

      expect(result.success).toBe(true);
      expect(mockWithdrawal.markAsCompleted).toHaveBeenCalledWith(webhookData);
    });

    it('should handle transfer failed webhook', async () => {
      const webhookData = {
        event: 'transfer.failed',
        data: { 
          reference: 'TRF_123456789',
          failure_reason: 'Insufficient funds'
        }
      };

      const result = await WithdrawalService.handleWebhook(webhookData);

      expect(result.success).toBe(true);
      expect(mockWithdrawal.markAsFailed).toHaveBeenCalledWith(
        'Insufficient funds',
        webhookData
      );
      expect(WithdrawalService.reverseWithdrawal).toHaveBeenCalledWith(
        'withdrawal123',
        'Transfer failed'
      );
    });

    it('should handle transfer reversed webhook', async () => {
      const webhookData = {
        event: 'transfer.reversed',
        data: { reference: 'TRF_123456789' }
      };

      const result = await WithdrawalService.handleWebhook(webhookData);

      expect(result.success).toBe(true);
      expect(mockWithdrawal.reverse).toHaveBeenCalledWith('Transfer reversed by bank', null);
      expect(WithdrawalService.reverseWithdrawal).toHaveBeenCalledWith(
        'withdrawal123',
        'Transfer reversed by bank'
      );
    });

    it('should handle unknown webhook events', async () => {
      const webhookData = {
        event: 'unknown.event',
        data: { reference: 'TRF_123456789' }
      };

      const result = await WithdrawalService.handleWebhook(webhookData);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Webhook processed successfully');
    });

    it('should handle webhook for unknown withdrawal', async () => {
      Withdrawal.findOne.mockResolvedValue(null);

      const webhookData = {
        event: 'transfer.success',
        data: { reference: 'UNKNOWN_REF' }
      };

      const result = await WithdrawalService.handleWebhook(webhookData);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Withdrawal not found');
    });

    it('should validate webhook data', async () => {
      const invalidWebhookData = {
        event: 'transfer.success'
        // Missing data
      };

      await expect(
        WithdrawalService.handleWebhook(invalidWebhookData)
      ).rejects.toThrow('Invalid webhook data');
    });
  });

  describe('getWithdrawalById', () => {
    beforeEach(() => {
      Withdrawal.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnValue({
              populate: jest.fn().mockResolvedValue(mockWithdrawal)
            })
          })
        })
      });
    });

    it('should get withdrawal by ID successfully', async () => {
      const result = await WithdrawalService.getWithdrawalById('withdrawal123');

      expect(result.success).toBe(true);
      expect(result.withdrawal).toEqual(mockWithdrawal);
    });

    it('should get withdrawal by ID with affiliate authorization', async () => {
      const result = await WithdrawalService.getWithdrawalById('withdrawal123', 'affiliate123');

      expect(result.success).toBe(true);
      expect(Withdrawal.findOne).toHaveBeenCalledWith({
        _id: 'withdrawal123',
        affiliateId: 'affiliate123'
      });
    });

    it('should handle withdrawal not found', async () => {
      Withdrawal.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnValue({
              populate: jest.fn().mockResolvedValue(null)
            })
          })
        })
      });

      await expect(
        WithdrawalService.getWithdrawalById('nonexistent')
      ).rejects.toThrow('Withdrawal not found');
    });
  });

  describe('getPendingWithdrawals', () => {
    const mockPendingWithdrawals = [
      { _id: 'w1', status: 'pending' },
      { _id: 'w2', status: 'pending' }
    ];

    beforeEach(() => {
      Withdrawal.findPendingForProcessing.mockResolvedValue(mockPendingWithdrawals);
    });

    it('should get pending withdrawals successfully', async () => {
      const result = await WithdrawalService.getPendingWithdrawals(5);

      expect(result.success).toBe(true);
      expect(result.withdrawals).toEqual(mockPendingWithdrawals);
      expect(result.count).toBe(2);
      expect(Withdrawal.findPendingForProcessing).toHaveBeenCalledWith(5);
    });

    it('should use default limit', async () => {
      await WithdrawalService.getPendingWithdrawals();

      expect(Withdrawal.findPendingForProcessing).toHaveBeenCalledWith(10);
    });
  });

  describe('getFailedWithdrawalsForRetry', () => {
    const mockFailedWithdrawals = [
      { _id: 'w1', status: 'failed', retryCount: 1 }
    ];

    beforeEach(() => {
      Withdrawal.findFailedForRetry.mockResolvedValue(mockFailedWithdrawals);
    });

    it('should get failed withdrawals for retry successfully', async () => {
      const result = await WithdrawalService.getFailedWithdrawalsForRetry(12);

      expect(result.success).toBe(true);
      expect(result.withdrawals).toEqual(mockFailedWithdrawals);
      expect(result.count).toBe(1);
      expect(Withdrawal.findFailedForRetry).toHaveBeenCalledWith(12);
    });

    it('should use default retry hours', async () => {
      await WithdrawalService.getFailedWithdrawalsForRetry();

      expect(Withdrawal.findFailedForRetry).toHaveBeenCalledWith(24);
    });
  });

  describe('getSystemWithdrawalStats', () => {
    const mockSystemStats = [{
      totalWithdrawals: 50000,
      totalRequests: 10,
      averageProcessingTime: 3600000 // 1 hour in milliseconds
    }];

    beforeEach(() => {
      Withdrawal.getSystemStats.mockResolvedValue(mockSystemStats);
    });

    it('should get system withdrawal stats successfully', async () => {
      const dateRange = {
        startDate: '2023-01-01',
        endDate: '2023-12-31'
      };

      const result = await WithdrawalService.getSystemWithdrawalStats(dateRange);

      expect(result.success).toBe(true);
      expect(result.statistics).toEqual(mockSystemStats[0]);
      expect(Withdrawal.getSystemStats).toHaveBeenCalledWith(dateRange);
    });

    it('should handle empty stats', async () => {
      Withdrawal.getSystemStats.mockResolvedValue([]);

      const result = await WithdrawalService.getSystemWithdrawalStats();

      expect(result.statistics).toEqual({
        totalWithdrawals: 0,
        totalProcessingFees: 0,
        totalNetAmount: 0,
        totalRequests: 0,
        averageProcessingTime: 0
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      Affiliate.findById.mockRejectedValue(new Error('Database connection failed'));

      await expect(
        WithdrawalService.requestWithdrawal('affiliate123', 5000, {
          accountName: 'Test',
          accountNumber: '1234567890',
          bankCode: '058',
          bankName: 'GTB'
        })
      ).rejects.toThrow('Failed to create withdrawal request');
    });

    it('should preserve ApiError instances', async () => {
      const apiError = new ApiError('Custom API error', StatusCodes.BAD_REQUEST);
      Affiliate.findById.mockRejectedValue(apiError);

      await expect(
        WithdrawalService.requestWithdrawal('affiliate123', 5000, {
          accountName: 'Test',
          accountNumber: '1234567890',
          bankCode: '058',
          bankName: 'GTB'
        })
      ).rejects.toThrow(apiError);
    });
  });
});