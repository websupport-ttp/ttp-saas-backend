// v1/test/services/walletService.test.js
const mongoose = require('mongoose');
const WalletService = require('../../services/walletService');
const Wallet = require('../../models/walletModel');
const WalletTransaction = require('../../models/walletTransactionModel');
const Affiliate = require('../../models/affiliateModel');
const { ApiError } = require('../../utils/apiError');

// Mock the models
jest.mock('../../models/walletModel');
jest.mock('../../models/walletTransactionModel');
jest.mock('../../models/affiliateModel');

describe('WalletService', () => {
  let mockSession;
  let mockAffiliate;
  let mockWallet;
  let mockTransaction;

  // Import mocked modules
  const Wallet = require('../../models/walletModel');
  const WalletTransaction = require('../../models/walletTransactionModel');
  const Affiliate = require('../../models/affiliateModel');

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup static method mocks
    Wallet.findOne = jest.fn();
    Wallet.findById = jest.fn();
    WalletTransaction.findOne = jest.fn();
    WalletTransaction.findById = jest.fn();
    WalletTransaction.findByAffiliate = jest.fn();
    WalletTransaction.find = jest.fn();
    WalletTransaction.getStatistics = jest.fn();
    Affiliate.findById = jest.fn();
    
    // Mock mongoose session
    mockSession = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    };
    
    mongoose.startSession = jest.fn().mockResolvedValue(mockSession);

    // Mock affiliate
    mockAffiliate = {
      _id: new mongoose.Types.ObjectId(),
      businessName: 'Test Business',
      affiliateId: 'AFF-001234',
    };

    // Mock wallet
    mockWallet = {
      _id: new mongoose.Types.ObjectId(),
      affiliateId: mockAffiliate._id,
      balance: 1000,
      totalEarned: 5000,
      totalWithdrawn: 4000,
      currency: 'NGN',
      status: 'active',
      bankDetails: {
        accountName: 'Test Account',
        accountNumber: '1234567890',
        bankCode: '123',
        bankName: 'Test Bank',
      },
      credit: jest.fn().mockResolvedValue(true),
      debit: jest.fn().mockResolvedValue(true),
      freeze: jest.fn().mockResolvedValue(true),
      unfreeze: jest.fn().mockResolvedValue(true),
      suspend: jest.fn().mockResolvedValue(true),
      canWithdraw: jest.fn().mockReturnValue({ allowed: true }),
      updateBankDetails: jest.fn().mockResolvedValue(true),
      getSummary: jest.fn().mockReturnValue({
        balance: 1000,
        totalEarned: 5000,
        totalWithdrawn: 4000,
        currency: 'NGN',
        status: 'active',
        lastTransactionAt: new Date(),
        hasBankDetails: true,
      }),
      save: jest.fn().mockResolvedValue(true),
    };

    // Mock transaction
    mockTransaction = {
      _id: new mongoose.Types.ObjectId(),
      walletId: mockWallet._id,
      affiliateId: mockAffiliate._id,
      type: 'commission_credit',
      amount: 100,
      balanceBefore: 900,
      balanceAfter: 1000,
      currency: 'NGN',
      description: 'Commission earned',
      reference: 'TXN_123456',
      status: 'completed',
      reverse: jest.fn().mockResolvedValue(true),
      getSummary: jest.fn().mockReturnValue({
        id: new mongoose.Types.ObjectId(),
        type: 'commission_credit',
        amount: 100,
        currency: 'NGN',
        description: 'Commission earned',
        reference: 'TXN_123456',
        status: 'completed',
        balanceBefore: 900,
        balanceAfter: 1000,
        processedAt: new Date(),
        createdAt: new Date(),
      }),
      save: jest.fn().mockResolvedValue(true),
    };
  });

  describe('createWallet', () => {
    beforeEach(() => {
      // Mock Wallet constructor
      Wallet.mockImplementation(() => mockWallet);
    });

    it('should create a new wallet successfully', async () => {
      Affiliate.findById.mockResolvedValue(mockAffiliate);
      Wallet.findOne.mockResolvedValue(null);

      const result = await WalletService.createWallet(mockAffiliate._id);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Wallet created successfully');
      expect(Affiliate.findById).toHaveBeenCalledWith(mockAffiliate._id);
      expect(Wallet.findOne).toHaveBeenCalledWith({ affiliateId: mockAffiliate._id });
      expect(mockWallet.save).toHaveBeenCalled();
    });

    it('should throw error if affiliate not found', async () => {
      Affiliate.findById.mockResolvedValue(null);

      await expect(WalletService.createWallet(mockAffiliate._id))
        .rejects.toThrow('Affiliate not found');
    });

    it('should throw error if wallet already exists', async () => {
      Affiliate.findById.mockResolvedValue(mockAffiliate);
      Wallet.findOne.mockResolvedValue(mockWallet);

      await expect(WalletService.createWallet(mockAffiliate._id))
        .rejects.toThrow('Wallet already exists for this affiliate');
    });
  });

  describe('creditWallet', () => {
    it('should credit wallet successfully', async () => {
      Wallet.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockWallet),
      });
      WalletTransaction.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(null),
      });
      WalletTransaction.mockImplementation(() => mockTransaction);

      const result = await WalletService.creditWallet(
        mockAffiliate._id,
        100,
        'TXN_123456',
        { description: 'Commission earned' }
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe('Wallet credited successfully');
      expect(mockWallet.credit).toHaveBeenCalledWith(100, 'Commission earned');
      expect(mockTransaction.save).toHaveBeenCalled();
      expect(mockSession.commitTransaction).toHaveBeenCalled();
    });

    it('should throw error for invalid amount', async () => {
      await expect(WalletService.creditWallet(mockAffiliate._id, -100, 'TXN_123456'))
        .rejects.toThrow('Credit amount must be positive');
    });

    it('should throw error for missing parameters', async () => {
      await expect(WalletService.creditWallet(null, 100, 'TXN_123456'))
        .rejects.toThrow('Affiliate ID, amount, and transaction reference are required');
    });

    it('should throw error for inactive wallet', async () => {
      const inactiveWallet = { ...mockWallet, status: 'frozen' };
      Wallet.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(inactiveWallet),
      });

      await expect(WalletService.creditWallet(mockAffiliate._id, 100, 'TXN_123456'))
        .rejects.toThrow('Cannot credit frozen wallet');
    });

    it('should throw error for duplicate transaction reference', async () => {
      Wallet.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockWallet),
      });
      WalletTransaction.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockTransaction),
      });

      await expect(WalletService.creditWallet(mockAffiliate._id, 100, 'TXN_123456'))
        .rejects.toThrow('Transaction reference already exists');
    });

    it('should rollback transaction on error', async () => {
      Wallet.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockWallet),
      });
      WalletTransaction.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(null),
      });
      mockWallet.credit.mockRejectedValue(new Error('Credit failed'));

      await expect(WalletService.creditWallet(mockAffiliate._id, 100, 'TXN_123456'))
        .rejects.toThrow('Failed to credit wallet');

      expect(mockSession.abortTransaction).toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalled();
    });
  });

  describe('debitWallet', () => {
    it('should debit wallet successfully', async () => {
      Wallet.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockWallet),
      });
      WalletTransaction.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(null),
      });
      WalletTransaction.mockImplementation(() => mockTransaction);

      const result = await WalletService.debitWallet(
        mockAffiliate._id,
        100,
        'TXN_123456',
        { description: 'Withdrawal processed' }
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe('Wallet debited successfully');
      expect(mockWallet.debit).toHaveBeenCalledWith(100, 'Withdrawal processed');
      expect(mockTransaction.save).toHaveBeenCalled();
      expect(mockSession.commitTransaction).toHaveBeenCalled();
    });

    it('should throw error for insufficient balance', async () => {
      const lowBalanceWallet = { ...mockWallet, balance: 50 };
      Wallet.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(lowBalanceWallet),
      });

      await expect(WalletService.debitWallet(mockAffiliate._id, 100, 'TXN_123456'))
        .rejects.toThrow('Insufficient wallet balance');
    });

    it('should throw error for invalid amount', async () => {
      await expect(WalletService.debitWallet(mockAffiliate._id, -100, 'TXN_123456'))
        .rejects.toThrow('Debit amount must be positive');
    });
  });

  describe('getBalance', () => {
    it('should get wallet balance successfully', async () => {
      const walletWithAffiliate = {
        ...mockWallet,
        affiliateId: mockAffiliate,
      };
      Wallet.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(walletWithAffiliate),
      });

      const result = await WalletService.getBalance(mockAffiliate._id);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Wallet balance retrieved successfully');
      expect(result.data.affiliate).toBe(mockAffiliate);
    });

    it('should throw error if wallet not found', async () => {
      Wallet.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });

      await expect(WalletService.getBalance(mockAffiliate._id))
        .rejects.toThrow('Wallet not found');
    });

    it('should throw error for missing affiliate ID', async () => {
      await expect(WalletService.getBalance(null))
        .rejects.toThrow('Affiliate ID is required');
    });
  });

  describe('getTransactionHistory', () => {
    it('should get transaction history with pagination', async () => {
      const mockTransactions = [mockTransaction, mockTransaction];
      
      Wallet.findOne.mockResolvedValue(mockWallet);
      WalletTransaction.findByAffiliate.mockResolvedValue(mockTransactions);
      WalletTransaction.find.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        countDocuments: jest.fn().mockResolvedValue(10),
      });

      const result = await WalletService.getTransactionHistory(mockAffiliate._id, {
        page: 1,
        limit: 5,
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Transaction history retrieved successfully');
      expect(result.data.transactions).toHaveLength(2);
      expect(result.data.pagination.totalCount).toBe(10);
      expect(result.data.pagination.totalPages).toBe(2);
    });

    it('should throw error if wallet not found', async () => {
      Wallet.findOne.mockResolvedValue(null);

      await expect(WalletService.getTransactionHistory(mockAffiliate._id))
        .rejects.toThrow('Wallet not found');
    });
  });

  describe('freezeWallet', () => {
    it('should freeze wallet successfully', async () => {
      Wallet.findOne.mockResolvedValue(mockWallet);

      const result = await WalletService.freezeWallet(
        mockAffiliate._id,
        'Suspicious activity',
        'admin123'
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe('Wallet frozen successfully');
      expect(mockWallet.freeze).toHaveBeenCalledWith('Suspicious activity');
    });

    it('should throw error if wallet already frozen', async () => {
      const frozenWallet = { ...mockWallet, status: 'frozen' };
      Wallet.findOne.mockResolvedValue(frozenWallet);

      await expect(WalletService.freezeWallet(mockAffiliate._id, 'Reason', 'admin123'))
        .rejects.toThrow('Wallet is already frozen');
    });

    it('should throw error for missing parameters', async () => {
      await expect(WalletService.freezeWallet(mockAffiliate._id, null, 'admin123'))
        .rejects.toThrow('Affiliate ID and reason are required');
    });
  });

  describe('unfreezeWallet', () => {
    it('should unfreeze wallet successfully', async () => {
      const frozenWallet = { ...mockWallet, status: 'frozen' };
      Wallet.findOne.mockResolvedValue(frozenWallet);

      const result = await WalletService.unfreezeWallet(mockAffiliate._id, 'admin123');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Wallet unfrozen successfully');
      expect(frozenWallet.unfreeze).toHaveBeenCalled();
    });

    it('should throw error if wallet is not frozen', async () => {
      Wallet.findOne.mockResolvedValue(mockWallet);

      await expect(WalletService.unfreezeWallet(mockAffiliate._id, 'admin123'))
        .rejects.toThrow('Wallet is not frozen');
    });
  });

  describe('suspendWallet', () => {
    it('should suspend wallet successfully', async () => {
      Wallet.findOne.mockResolvedValue(mockWallet);

      const result = await WalletService.suspendWallet(
        mockAffiliate._id,
        'Policy violation',
        'admin123'
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe('Wallet suspended successfully');
      expect(mockWallet.suspend).toHaveBeenCalledWith('Policy violation');
    });

    it('should throw error if wallet already suspended', async () => {
      const suspendedWallet = { ...mockWallet, status: 'suspended' };
      Wallet.findOne.mockResolvedValue(suspendedWallet);

      await expect(WalletService.suspendWallet(mockAffiliate._id, 'Reason', 'admin123'))
        .rejects.toThrow('Wallet is already suspended');
    });
  });

  describe('validateWallet', () => {
    it('should validate wallet for credit operation', async () => {
      Wallet.findOne.mockResolvedValue(mockWallet);

      const result = await WalletService.validateWallet(mockAffiliate._id, 'credit');

      expect(result.success).toBe(true);
      expect(result.valid).toBe(true);
    });

    it('should validate wallet for debit operation', async () => {
      Wallet.findOne.mockResolvedValue(mockWallet);

      const result = await WalletService.validateWallet(mockAffiliate._id, 'debit', 500);

      expect(result.success).toBe(true);
      expect(result.valid).toBe(true);
    });

    it('should validate wallet for withdraw operation', async () => {
      Wallet.findOne.mockResolvedValue(mockWallet);

      const result = await WalletService.validateWallet(mockAffiliate._id, 'withdraw', 500);

      expect(result.success).toBe(true);
      expect(result.valid).toBe(true);
      expect(mockWallet.canWithdraw).toHaveBeenCalledWith(500);
    });

    it('should return invalid for insufficient balance', async () => {
      const lowBalanceWallet = { 
        ...mockWallet, 
        balance: 50,
        getSummary: jest.fn().mockReturnValue({ balance: 50, status: 'active' })
      };
      Wallet.findOne.mockResolvedValue(lowBalanceWallet);

      const result = await WalletService.validateWallet(mockAffiliate._id, 'debit', 100);

      expect(result.success).toBe(true);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Insufficient balance');
    });

    it('should return invalid for inactive wallet', async () => {
      const inactiveWallet = { 
        ...mockWallet, 
        status: 'frozen',
        getSummary: jest.fn().mockReturnValue({ balance: 1000, status: 'frozen' })
      };
      Wallet.findOne.mockResolvedValue(inactiveWallet);

      const result = await WalletService.validateWallet(mockAffiliate._id, 'credit');

      expect(result.success).toBe(true);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Cannot credit frozen wallet');
    });

    it('should throw error for invalid operation', async () => {
      Wallet.findOne.mockResolvedValue(mockWallet);

      await expect(WalletService.validateWallet(mockAffiliate._id, 'invalid'))
        .rejects.toThrow('Invalid operation type');
    });

    it('should validate suspended wallet correctly', async () => {
      const suspendedWallet = { 
        ...mockWallet, 
        status: 'suspended',
        getSummary: jest.fn().mockReturnValue({ balance: 1000, status: 'suspended' })
      };
      Wallet.findOne.mockResolvedValue(suspendedWallet);

      const result = await WalletService.validateWallet(mockAffiliate._id, 'debit', 100);

      expect(result.success).toBe(true);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Cannot debit suspended wallet');
    });

    it('should validate zero amount operations', async () => {
      Wallet.findOne.mockResolvedValue(mockWallet);

      const result = await WalletService.validateWallet(mockAffiliate._id, 'debit', 0);

      expect(result.success).toBe(true);
      expect(result.valid).toBe(true);
    });

    it('should handle withdrawal validation with missing bank details', async () => {
      const walletWithoutBankDetails = {
        ...mockWallet,
        canWithdraw: jest.fn().mockReturnValue({ allowed: false, reason: 'Bank details not configured' }),
        getSummary: jest.fn().mockReturnValue({ balance: 1000, status: 'active' })
      };
      Wallet.findOne.mockResolvedValue(walletWithoutBankDetails);

      const result = await WalletService.validateWallet(mockAffiliate._id, 'withdraw', 500);

      expect(result.success).toBe(true);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Bank details not configured');
    });
  });

  describe('updateBankDetails', () => {
    it('should update bank details successfully', async () => {
      Wallet.findOne.mockResolvedValue(mockWallet);

      const bankDetails = {
        accountName: 'New Account',
        accountNumber: '9876543210',
        bankCode: '456',
        bankName: 'New Bank',
      };

      const result = await WalletService.updateBankDetails(mockAffiliate._id, bankDetails);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Bank details updated successfully');
      expect(mockWallet.updateBankDetails).toHaveBeenCalledWith(bankDetails);
    });

    it('should throw error for missing parameters', async () => {
      await expect(WalletService.updateBankDetails(mockAffiliate._id, null))
        .rejects.toThrow('Affiliate ID and bank details are required');
    });
  });

  describe('getWalletStatistics', () => {
    it('should get wallet statistics successfully', async () => {
      const mockStats = [{
        totalTransactions: 10,
        totalAmount: 1000,
        byType: [
          { type: 'commission_credit', count: 8, totalAmount: 800 },
          { type: 'withdrawal_debit', count: 2, totalAmount: 200 },
        ],
      }];

      Wallet.findOne.mockResolvedValue(mockWallet);
      WalletTransaction.getStatistics.mockResolvedValue(mockStats);

      const result = await WalletService.getWalletStatistics(mockAffiliate._id);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Wallet statistics retrieved successfully');
      expect(result.data.transactions.totalTransactions).toBe(10);
    });

    it('should handle empty statistics', async () => {
      Wallet.findOne.mockResolvedValue(mockWallet);
      WalletTransaction.getStatistics.mockResolvedValue([]);

      const result = await WalletService.getWalletStatistics(mockAffiliate._id);

      expect(result.success).toBe(true);
      expect(result.data.transactions.totalTransactions).toBe(0);
    });
  });

  describe('reverseTransaction', () => {
    it('should reverse credit transaction successfully', async () => {
      const creditTransaction = { ...mockTransaction, type: 'commission_credit' };
      
      WalletTransaction.findById.mockReturnValue({
        session: jest.fn().mockResolvedValue(creditTransaction),
      });
      Wallet.findById.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockWallet),
      });
      WalletTransaction.mockImplementation(() => mockTransaction);

      const result = await WalletService.reverseTransaction(
        creditTransaction._id,
        'Error in calculation',
        'admin123'
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe('Transaction reversed successfully');
      expect(mockWallet.debit).toHaveBeenCalled();
      expect(creditTransaction.reverse).toHaveBeenCalledWith('Error in calculation', 'admin123');
      expect(mockSession.commitTransaction).toHaveBeenCalled();
    });

    it('should reverse debit transaction successfully', async () => {
      const debitTransaction = { ...mockTransaction, type: 'withdrawal_debit' };
      
      WalletTransaction.findById.mockReturnValue({
        session: jest.fn().mockResolvedValue(debitTransaction),
      });
      Wallet.findById.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockWallet),
      });
      WalletTransaction.mockImplementation(() => mockTransaction);

      const result = await WalletService.reverseTransaction(
        debitTransaction._id,
        'Failed withdrawal',
        'admin123'
      );

      expect(result.success).toBe(true);
      expect(mockWallet.credit).toHaveBeenCalled();
      expect(debitTransaction.reverse).toHaveBeenCalledWith('Failed withdrawal', 'admin123');
    });

    it('should throw error if transaction not found', async () => {
      WalletTransaction.findById.mockReturnValue({
        session: jest.fn().mockResolvedValue(null),
      });

      await expect(WalletService.reverseTransaction('invalid_id', 'Reason', 'admin123'))
        .rejects.toThrow('Transaction not found');
    });

    it('should throw error if transaction already reversed', async () => {
      const reversedTransaction = { ...mockTransaction, status: 'reversed' };
      
      WalletTransaction.findById.mockReturnValue({
        session: jest.fn().mockResolvedValue(reversedTransaction),
      });

      await expect(WalletService.reverseTransaction(
        reversedTransaction._id,
        'Reason',
        'admin123'
      )).rejects.toThrow('Transaction is already reversed');
    });

    it('should rollback on error', async () => {
      WalletTransaction.findById.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockTransaction),
      });
      Wallet.findById.mockReturnValue({
        session: jest.fn().mockRejectedValue(new Error('Wallet not found')),
      });

      await expect(WalletService.reverseTransaction(
        mockTransaction._id,
        'Reason',
        'admin123'
      )).rejects.toThrow('Failed to reverse transaction');

      expect(mockSession.abortTransaction).toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalled();
    });

    it('should handle reversal of adjustment transactions', async () => {
      const adjustmentTransaction = { ...mockTransaction, type: 'adjustment_credit' };
      
      WalletTransaction.findById.mockReturnValue({
        session: jest.fn().mockResolvedValue(adjustmentTransaction),
      });
      Wallet.findById.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockWallet),
      });
      WalletTransaction.mockImplementation(() => mockTransaction);

      const result = await WalletService.reverseTransaction(
        adjustmentTransaction._id,
        'Incorrect adjustment',
        'admin123'
      );

      expect(result.success).toBe(true);
      expect(mockWallet.debit).toHaveBeenCalled();
      expect(adjustmentTransaction.reverse).toHaveBeenCalledWith('Incorrect adjustment', 'admin123');
    });

    it('should handle reversal of penalty transactions', async () => {
      const penaltyTransaction = { ...mockTransaction, type: 'penalty_debit' };
      
      WalletTransaction.findById.mockReturnValue({
        session: jest.fn().mockResolvedValue(penaltyTransaction),
      });
      Wallet.findById.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockWallet),
      });
      WalletTransaction.mockImplementation(() => mockTransaction);

      const result = await WalletService.reverseTransaction(
        penaltyTransaction._id,
        'Penalty reversed',
        'admin123'
      );

      expect(result.success).toBe(true);
      expect(mockWallet.credit).toHaveBeenCalled();
      expect(penaltyTransaction.reverse).toHaveBeenCalledWith('Penalty reversed', 'admin123');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle database connection errors', async () => {
      mongoose.startSession.mockRejectedValue(new Error('Database connection failed'));

      await expect(WalletService.creditWallet(mockAffiliate._id, 100, 'TXN_123456'))
        .rejects.toThrow('Database connection failed');
    });

    it('should handle concurrent transaction conflicts', async () => {
      Wallet.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockWallet),
      });
      WalletTransaction.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(null),
      });
      mockWallet.credit.mockRejectedValue(new Error('Version conflict'));

      await expect(WalletService.creditWallet(mockAffiliate._id, 100, 'TXN_123456'))
        .rejects.toThrow('Failed to credit wallet');
    });

    it('should handle large amounts with precision', async () => {
      const largeAmount = 999999.99;
      
      Wallet.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockWallet),
      });
      WalletTransaction.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(null),
      });
      WalletTransaction.mockImplementation(() => mockTransaction);

      const result = await WalletService.creditWallet(
        mockAffiliate._id,
        largeAmount,
        'TXN_LARGE'
      );

      expect(result.success).toBe(true);
      expect(mockWallet.credit).toHaveBeenCalledWith(largeAmount, 'Commission earned');
    });

    it('should handle wallet not found during credit operation', async () => {
      Wallet.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(null),
      });

      await expect(WalletService.creditWallet(mockAffiliate._id, 100, 'TXN_123456'))
        .rejects.toThrow('Wallet not found');
    });

    it('should handle wallet not found during debit operation', async () => {
      Wallet.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(null),
      });

      await expect(WalletService.debitWallet(mockAffiliate._id, 100, 'TXN_123456'))
        .rejects.toThrow('Wallet not found');
    });

    it('should handle session transaction failures gracefully', async () => {
      Wallet.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockWallet),
      });
      WalletTransaction.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(null),
      });
      mockSession.commitTransaction.mockRejectedValue(new Error('Transaction commit failed'));

      await expect(WalletService.creditWallet(mockAffiliate._id, 100, 'TXN_123456'))
        .rejects.toThrow('Failed to credit wallet');

      expect(mockSession.abortTransaction).toHaveBeenCalled();
    });

    it('should handle floating point precision issues', async () => {
      const precisionAmount = 0.1 + 0.2; // Known floating point issue
      
      Wallet.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockWallet),
      });
      WalletTransaction.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(null),
      });
      WalletTransaction.mockImplementation(() => mockTransaction);

      const result = await WalletService.creditWallet(
        mockAffiliate._id,
        precisionAmount,
        'TXN_PRECISION'
      );

      expect(result.success).toBe(true);
      expect(mockWallet.credit).toHaveBeenCalledWith(precisionAmount, 'Commission earned');
    });

    it('should handle empty transaction history gracefully', async () => {
      Wallet.findOne.mockResolvedValue(mockWallet);
      WalletTransaction.findByAffiliate.mockResolvedValue([]);
      WalletTransaction.find.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        countDocuments: jest.fn().mockResolvedValue(0),
      });

      const result = await WalletService.getTransactionHistory(mockAffiliate._id);

      expect(result.success).toBe(true);
      expect(result.data.transactions).toHaveLength(0);
      expect(result.data.pagination.totalCount).toBe(0);
    });

    it('should handle invalid date ranges in transaction history', async () => {
      Wallet.findOne.mockResolvedValue(mockWallet);
      WalletTransaction.findByAffiliate.mockResolvedValue([]);
      
      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        countDocuments: jest.fn().mockResolvedValue(0),
      };
      WalletTransaction.find.mockReturnValue(mockQuery);

      const result = await WalletService.getTransactionHistory(mockAffiliate._id, {
        dateFrom: '2023-01-01',
        dateTo: '2023-12-31',
      });

      expect(result.success).toBe(true);
      expect(WalletTransaction.findByAffiliate).toHaveBeenCalledWith(
        mockAffiliate._id,
        expect.objectContaining({
          dateFrom: new Date('2023-01-01'),
          dateTo: new Date('2023-12-31'),
        })
      );
    });

    it('should handle maximum pagination limits', async () => {
      Wallet.findOne.mockResolvedValue(mockWallet);
      WalletTransaction.findByAffiliate.mockResolvedValue([]);
      WalletTransaction.find.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        countDocuments: jest.fn().mockResolvedValue(0),
      });

      const result = await WalletService.getTransactionHistory(mockAffiliate._id, {
        page: 1,
        limit: 1000, // Very large limit
      });

      expect(result.success).toBe(true);
      expect(WalletTransaction.findByAffiliate).toHaveBeenCalledWith(
        mockAffiliate._id,
        expect.objectContaining({
          limit: 1000,
        })
      );
    });

    it('should handle wallet validation for non-existent wallet', async () => {
      Wallet.findOne.mockResolvedValue(null);

      const result = await WalletService.validateWallet(mockAffiliate._id, 'credit');

      expect(result.success).toBe(false);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Wallet not found');
    });

    it('should handle bank details update for non-existent wallet', async () => {
      Wallet.findOne.mockResolvedValue(null);

      await expect(WalletService.updateBankDetails(mockAffiliate._id, {}))
        .rejects.toThrow('Wallet not found');
    });

    it('should handle statistics for non-existent wallet', async () => {
      Wallet.findOne.mockResolvedValue(null);

      await expect(WalletService.getWalletStatistics(mockAffiliate._id))
        .rejects.toThrow('Wallet not found');
    });

    it('should handle reversal of non-existent transaction', async () => {
      WalletTransaction.findById.mockReturnValue({
        session: jest.fn().mockResolvedValue(null),
      });

      await expect(WalletService.reverseTransaction('invalid_id', 'Reason', 'admin123'))
        .rejects.toThrow('Transaction not found');
    });

    it('should handle reversal when wallet is not found', async () => {
      WalletTransaction.findById.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockTransaction),
      });
      Wallet.findById.mockReturnValue({
        session: jest.fn().mockResolvedValue(null),
      });

      await expect(WalletService.reverseTransaction(
        mockTransaction._id,
        'Reason',
        'admin123'
      )).rejects.toThrow('Wallet not found');

      expect(mockSession.abortTransaction).toHaveBeenCalled();
    });
  });

  describe('Concurrent Operations and Race Conditions', () => {
    it('should handle concurrent credit operations', async () => {
      Wallet.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockWallet),
      });
      WalletTransaction.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(null),
      });
      WalletTransaction.mockImplementation(() => mockTransaction);

      // Simulate concurrent operations
      const promises = [
        WalletService.creditWallet(mockAffiliate._id, 100, 'TXN_CONCURRENT_1'),
        WalletService.creditWallet(mockAffiliate._id, 200, 'TXN_CONCURRENT_2'),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(2);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });

    it('should handle concurrent debit operations', async () => {
      Wallet.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockWallet),
      });
      WalletTransaction.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(null),
      });
      WalletTransaction.mockImplementation(() => mockTransaction);

      // Simulate concurrent operations
      const promises = [
        WalletService.debitWallet(mockAffiliate._id, 50, 'TXN_DEBIT_1'),
        WalletService.debitWallet(mockAffiliate._id, 75, 'TXN_DEBIT_2'),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(2);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });

    it('should handle mixed concurrent operations', async () => {
      Wallet.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockWallet),
        populate: jest.fn().mockResolvedValue({
          ...mockWallet,
          affiliateId: mockAffiliate,
        }),
      });
      WalletTransaction.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(null),
      });
      WalletTransaction.mockImplementation(() => mockTransaction);

      // Simulate mixed operations
      const promises = [
        WalletService.creditWallet(mockAffiliate._id, 100, 'TXN_MIXED_CREDIT'),
        WalletService.debitWallet(mockAffiliate._id, 50, 'TXN_MIXED_DEBIT'),
        WalletService.getBalance(mockAffiliate._id),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });

    it('should handle transaction reference conflicts', async () => {
      const duplicateRef = 'TXN_DUPLICATE';
      
      Wallet.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockWallet),
      });
      
      // First call returns null (no existing transaction)
      // Second call returns existing transaction (duplicate)
      WalletTransaction.findOne
        .mockReturnValueOnce({
          session: jest.fn().mockResolvedValue(null),
        })
        .mockReturnValueOnce({
          session: jest.fn().mockResolvedValue(mockTransaction),
        });

      WalletTransaction.mockImplementation(() => mockTransaction);

      // First operation should succeed
      const firstResult = await WalletService.creditWallet(mockAffiliate._id, 100, duplicateRef);
      expect(firstResult.success).toBe(true);

      // Second operation with same reference should fail
      await expect(WalletService.creditWallet(mockAffiliate._id, 200, duplicateRef))
        .rejects.toThrow('Transaction reference already exists');
    });

    it('should handle session timeout during operations', async () => {
      Wallet.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockWallet),
      });
      WalletTransaction.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(null),
      });
      mockWallet.credit.mockRejectedValue(new Error('Session timeout'));

      await expect(WalletService.creditWallet(mockAffiliate._id, 100, 'TXN_TIMEOUT'))
        .rejects.toThrow('Failed to credit wallet');

      expect(mockSession.abortTransaction).toHaveBeenCalled();
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large transaction amounts', async () => {
      const largeAmount = Number.MAX_SAFE_INTEGER - 1;
      
      Wallet.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockWallet),
      });
      WalletTransaction.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(null),
      });
      WalletTransaction.mockImplementation(() => mockTransaction);

      const result = await WalletService.creditWallet(
        mockAffiliate._id,
        largeAmount,
        'TXN_LARGE_AMOUNT'
      );

      expect(result.success).toBe(true);
      expect(mockWallet.credit).toHaveBeenCalledWith(largeAmount, 'Commission earned');
    });

    it('should handle very small transaction amounts', async () => {
      const smallAmount = 0.01;
      
      Wallet.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockWallet),
      });
      WalletTransaction.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(null),
      });
      WalletTransaction.mockImplementation(() => mockTransaction);

      const result = await WalletService.creditWallet(
        mockAffiliate._id,
        smallAmount,
        'TXN_SMALL_AMOUNT'
      );

      expect(result.success).toBe(true);
      expect(mockWallet.credit).toHaveBeenCalledWith(smallAmount, 'Commission earned');
    });

    it('should handle bulk transaction history requests', async () => {
      const mockTransactions = Array.from({ length: 1000 }, (_, i) => ({
        ...mockTransaction,
        _id: `transaction_${i}`,
        getSummary: jest.fn().mockReturnValue({ id: `transaction_${i}` }),
      }));

      Wallet.findOne.mockResolvedValue(mockWallet);
      WalletTransaction.findByAffiliate.mockResolvedValue(mockTransactions);
      WalletTransaction.find.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        countDocuments: jest.fn().mockResolvedValue(10000),
      });

      const result = await WalletService.getTransactionHistory(mockAffiliate._id, {
        limit: 1000,
      });

      expect(result.success).toBe(true);
      expect(result.data.transactions).toHaveLength(1000);
      expect(result.data.pagination.totalCount).toBe(10000);
    });

    it('should handle multiple currency operations', async () => {
      const currencies = ['NGN', 'USD', 'EUR', 'GBP'];
      
      Wallet.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockWallet),
      });

      WalletTransaction.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(null),
      });
      WalletTransaction.mockImplementation(() => mockTransaction);

      const promises = currencies.map((currency, index) => 
        WalletService.creditWallet(
          mockAffiliate._id,
          100,
          `TXN_${currency}_${index}`,
          { description: `${currency} transaction` }
        )
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(4);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Data Integrity and Consistency', () => {
    it('should maintain balance consistency during operations', async () => {
      const initialBalance = 1000;
      const creditAmount = 500;
      const debitAmount = 200;
      
      const walletWithBalance = {
        ...mockWallet,
        balance: initialBalance,
        credit: jest.fn().mockImplementation(function(amount) {
          this.balance += amount;
          return Promise.resolve();
        }),
        debit: jest.fn().mockImplementation(function(amount) {
          this.balance -= amount;
          return Promise.resolve();
        }),
      };

      Wallet.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(walletWithBalance),
      });
      WalletTransaction.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(null),
      });
      WalletTransaction.mockImplementation(() => mockTransaction);

      // Credit operation
      await WalletService.creditWallet(mockAffiliate._id, creditAmount, 'TXN_CREDIT_CONSISTENCY');
      expect(walletWithBalance.balance).toBe(initialBalance + creditAmount);

      // Debit operation
      await WalletService.debitWallet(mockAffiliate._id, debitAmount, 'TXN_DEBIT_CONSISTENCY');
      expect(walletWithBalance.balance).toBe(initialBalance + creditAmount - debitAmount);
    });

    it('should validate transaction reference uniqueness', async () => {
      const transactionRef = 'TXN_UNIQUE_TEST';
      
      Wallet.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockWallet),
      });
      
      // Mock existing transaction found
      WalletTransaction.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockTransaction),
      });

      await expect(WalletService.creditWallet(mockAffiliate._id, 100, transactionRef))
        .rejects.toThrow('Transaction reference already exists');
    });

    it('should handle metadata consistency', async () => {
      const metadata = {
        bookingId: 'BOOK_123',
        serviceType: 'flight',
        originalAmount: 5000,
        commissionRate: 2.5,
      };

      Wallet.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockWallet),
      });
      WalletTransaction.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(null),
      });
      
      const transactionWithMetadata = {
        ...mockTransaction,
        metadata,
        save: jest.fn().mockResolvedValue(true),
      };
      WalletTransaction.mockImplementation(() => transactionWithMetadata);

      const result = await WalletService.creditWallet(
        mockAffiliate._id,
        125,
        'TXN_METADATA_TEST',
        { metadata }
      );

      expect(result.success).toBe(true);
      expect(transactionWithMetadata.save).toHaveBeenCalled();
    });
  });
});

  describe('Additional Wallet Features', () => {
    describe('getSystemWalletStatistics', () => {
      it('should get system wallet statistics successfully', async () => {
        const mockSystemStats = [{
          totalBalance: 50000,
          totalEarned: 100000,
          totalWithdrawn: 50000,
          activeWallets: 10,
          frozenWallets: 2,
          suspendedWallets: 1,
        }];

        Wallet.getTotalSystemBalance.mockResolvedValue(mockSystemStats);

        const result = await WalletService.getSystemWalletStatistics();

        expect(result.success).toBe(true);
        expect(result.message).toBe('System wallet statistics retrieved successfully');
        expect(result.data.totalBalance).toBe(50000);
        expect(result.data.activeWallets).toBe(10);
      });

      it('should handle empty system statistics', async () => {
        Wallet.getTotalSystemBalance.mockResolvedValue([]);

        const result = await WalletService.getSystemWalletStatistics();

        expect(result.success).toBe(true);
        expect(result.data.totalBalance).toBe(0);
        expect(result.data.activeWallets).toBe(0);
      });
    });

    describe('bulkWalletOperations', () => {
      it('should perform bulk credit operations successfully', async () => {
        const testAffiliateId = new mongoose.Types.ObjectId();
        const operations = [
          {
            type: 'credit',
            affiliateId: testAffiliateId,
            amount: 100,
            transactionRef: 'BULK_001',
            options: { description: 'Bulk credit 1' },
          },
          {
            type: 'credit',
            affiliateId: testAffiliateId,
            amount: 200,
            transactionRef: 'BULK_002',
            options: { description: 'Bulk credit 2' },
          },
        ];

        // Mock successful credit operations
        const originalCreditWallet = WalletService.creditWallet;
        const mockWalletSummary = { balance: 1000, totalEarned: 5000, totalWithdrawn: 4000 };
        WalletService.creditWallet = jest.fn()
          .mockResolvedValueOnce({ success: true, data: { wallet: mockWalletSummary } })
          .mockResolvedValueOnce({ success: true, data: { wallet: mockWalletSummary } });

        const result = await WalletService.bulkWalletOperations(operations);

        expect(result.success).toBe(true);
        expect(result.data.successCount).toBe(2);
        expect(result.data.errorCount).toBe(0);
        expect(result.data.successful).toHaveLength(2);

        // Restore original method
        WalletService.creditWallet = originalCreditWallet;
      });

      it('should handle mixed success and failure in bulk operations', async () => {
        const testAffiliateId = new mongoose.Types.ObjectId();
        const operations = [
          {
            type: 'credit',
            affiliateId: testAffiliateId,
            amount: 100,
            transactionRef: 'BULK_001',
          },
          {
            type: 'credit',
            affiliateId: 'invalid_id',
            amount: 200,
            transactionRef: 'BULK_002',
          },
        ];

        // Mock one success and one failure
        const originalCreditWallet = WalletService.creditWallet;
        const mockWalletSummary = { balance: 1000, totalEarned: 5000, totalWithdrawn: 4000 };
        WalletService.creditWallet = jest.fn()
          .mockResolvedValueOnce({ success: true, data: { wallet: mockWalletSummary } })
          .mockRejectedValueOnce(new Error('Wallet not found'));

        const result = await WalletService.bulkWalletOperations(operations);

        expect(result.success).toBe(false);
        expect(result.data.successCount).toBe(1);
        expect(result.data.errorCount).toBe(1);
        expect(result.data.successful).toHaveLength(1);
        expect(result.data.failed).toHaveLength(1);

        // Restore original method
        WalletService.creditWallet = originalCreditWallet;
      });

      it('should handle unsupported operation types', async () => {
        const testAffiliateId = new mongoose.Types.ObjectId();
        const operations = [
          {
            type: 'invalid_operation',
            affiliateId: testAffiliateId,
            amount: 100,
          },
        ];

        const result = await WalletService.bulkWalletOperations(operations);

        expect(result.success).toBe(false);
        expect(result.data.errorCount).toBe(1);
        expect(result.data.failed[0].error).toContain('Unsupported operation type');
      });
    });

    describe('checkWalletHealth', () => {
      it('should report healthy wallet', async () => {
        const testAffiliateId = new mongoose.Types.ObjectId();
        const mockTransactions = [
          {
            type: 'commission_credit',
            amount: 100,
            createdAt: new Date(),
          },
          {
            type: 'withdrawal_debit',
            amount: 50,
            createdAt: new Date(),
          },
        ];

        const healthyWallet = {
          _id: new mongoose.Types.ObjectId(),
          affiliateId: testAffiliateId,
          balance: 50,
          totalEarned: 100,
          totalWithdrawn: 50,
        };

        Wallet.findOne.mockResolvedValue(healthyWallet);
        WalletTransaction.find.mockReturnValue({
          sort: jest.fn().mockResolvedValue(mockTransactions),
        });

        const result = await WalletService.checkWalletHealth(testAffiliateId);

        expect(result.success).toBe(true);
        expect(result.data.healthy).toBe(true);
        expect(result.data.issues).toHaveLength(0);
        expect(result.message).toBe('Wallet is healthy');
      });

      it('should detect balance mismatch', async () => {
        const testAffiliateId = new mongoose.Types.ObjectId();
        const mockTransactions = [
          {
            type: 'commission_credit',
            amount: 100,
            createdAt: new Date(),
          },
        ];

        const unhealthyWallet = {
          _id: new mongoose.Types.ObjectId(),
          affiliateId: testAffiliateId,
          balance: 200, // Should be 100
          totalEarned: 100,
          totalWithdrawn: 0,
        };

        Wallet.findOne.mockResolvedValue(unhealthyWallet);
        WalletTransaction.find.mockReturnValue({
          sort: jest.fn().mockResolvedValue(mockTransactions),
        });

        const result = await WalletService.checkWalletHealth(testAffiliateId);

        expect(result.success).toBe(true);
        expect(result.data.healthy).toBe(false);
        expect(result.data.issues).toHaveLength(1);
        expect(result.data.issues[0]).toContain('Balance mismatch');
        expect(result.message).toBe('Wallet has integrity issues');
      });

      it('should throw error for missing affiliate ID', async () => {
        await expect(WalletService.checkWalletHealth(null))
          .rejects.toThrow('Affiliate ID is required');
      });

      it('should throw error for non-existent wallet', async () => {
        const testAffiliateId = new mongoose.Types.ObjectId();
        Wallet.findOne.mockResolvedValue(null);

        await expect(WalletService.checkWalletHealth(testAffiliateId))
          .rejects.toThrow('Wallet not found');
      });
    });
  });