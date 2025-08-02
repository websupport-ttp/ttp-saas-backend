// v1/test/services/monthlyStatementService.test.js
const MonthlyStatementService = require('../../services/monthlyStatementService');
const Affiliate = require('../../models/affiliateModel');
const CommissionTransaction = require('../../models/commissionTransactionModel');
const Withdrawal = require('../../models/withdrawalModel');
const Wallet = require('../../models/walletModel');
const AffiliateNotificationService = require('../../services/affiliateNotificationService');

// Mock dependencies
jest.mock('../../models/affiliateModel');
jest.mock('../../models/commissionTransactionModel');
jest.mock('../../models/withdrawalModel');
jest.mock('../../models/walletModel');
jest.mock('../../services/affiliateNotificationService');

describe('MonthlyStatementService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockAffiliate = {
    _id: 'affiliate123',
    businessName: 'Test Business',
    affiliateId: 'AFF-123456'
  };

  const mockCommissions = [
    {
      _id: 'comm1',
      affiliateId: 'affiliate123',
      serviceType: 'flight',
      commissionAmount: 5000,
      status: 'approved',
      bookingReference: 'BK001',
      createdAt: new Date('2024-01-15')
    },
    {
      _id: 'comm2',
      affiliateId: 'affiliate123',
      serviceType: 'hotel',
      commissionAmount: 3000,
      status: 'paid',
      bookingReference: 'BK002',
      createdAt: new Date('2024-01-20')
    },
    {
      _id: 'comm3',
      affiliateId: 'affiliate123',
      serviceType: 'flight',
      commissionAmount: 2000,
      status: 'pending',
      bookingReference: 'BK003',
      createdAt: new Date('2024-01-25')
    }
  ];

  const mockWithdrawals = [
    {
      _id: 'with1',
      affiliateId: 'affiliate123',
      amount: 4000,
      status: 'completed',
      createdAt: new Date('2024-01-10')
    },
    {
      _id: 'with2',
      affiliateId: 'affiliate123',
      amount: 2000,
      status: 'completed',
      createdAt: new Date('2024-01-28')
    }
  ];

  const mockWallet = {
    affiliateId: 'affiliate123',
    balance: 10000
  };

  describe('generateStatementData', () => {
    beforeEach(() => {
      Affiliate.findById = jest.fn().mockResolvedValue(mockAffiliate);
      CommissionTransaction.find = jest.fn().mockResolvedValue(mockCommissions);
      Withdrawal.find = jest.fn().mockResolvedValue(mockWithdrawals);
      Wallet.findOne = jest.fn().mockResolvedValue(mockWallet);
    });

    it('should generate statement data for a given month', async () => {
      const result = await MonthlyStatementService.generateStatementData('affiliate123', 2024, 1);

      expect(result).toEqual({
        affiliateId: mockAffiliate._id,
        affiliateName: mockAffiliate.businessName,
        month: 'January',
        year: 2024,
        totalReferrals: 2, // Only approved/paid commissions
        successfulBookings: 2,
        totalCommissions: 8000, // 5000 + 3000 (only approved/paid)
        totalWithdrawals: 6000, // 4000 + 2000
        currentBalance: 10000,
        commissionsByService: {
          flight: 5000,
          hotel: 3000
        },
        commissionTransactions: expect.arrayContaining([
          expect.objectContaining({
            id: 'comm1',
            serviceType: 'flight',
            amount: 5000,
            status: 'approved'
          }),
          expect.objectContaining({
            id: 'comm2',
            serviceType: 'hotel',
            amount: 3000,
            status: 'paid'
          }),
          expect.objectContaining({
            id: 'comm3',
            serviceType: 'flight',
            amount: 2000,
            status: 'pending'
          })
        ]),
        withdrawalTransactions: expect.arrayContaining([
          expect.objectContaining({
            id: 'with1',
            amount: 4000,
            status: 'completed'
          }),
          expect.objectContaining({
            id: 'with2',
            amount: 2000,
            status: 'completed'
          })
        ])
      });
    });

    it('should handle affiliate not found', async () => {
      Affiliate.findById = jest.fn().mockResolvedValue(null);

      await expect(
        MonthlyStatementService.generateStatementData('nonexistent', 2024, 1)
      ).rejects.toThrow('Affiliate not found');
    });

    it('should handle no wallet found', async () => {
      Wallet.findOne = jest.fn().mockResolvedValue(null);

      const result = await MonthlyStatementService.generateStatementData('affiliate123', 2024, 1);

      expect(result.currentBalance).toBe(0);
    });

    it('should filter transactions by date range correctly', async () => {
      await MonthlyStatementService.generateStatementData('affiliate123', 2024, 1);

      expect(CommissionTransaction.find).toHaveBeenCalledWith({
        affiliateId: 'affiliate123',
        createdAt: {
          $gte: new Date(2024, 0, 1),
          $lte: new Date(2024, 1, 0, 23, 59, 59, 999)
        }
      });
    });

    it('should only count approved and paid commissions in totals', async () => {
      const result = await MonthlyStatementService.generateStatementData('affiliate123', 2024, 1);

      // Should only include approved (5000) and paid (3000) commissions, not pending (2000)
      expect(result.totalCommissions).toBe(8000);
      expect(result.successfulBookings).toBe(2);
    });
  });

  describe('generateAndSendStatement', () => {
    beforeEach(() => {
      Affiliate.findById = jest.fn().mockResolvedValue(mockAffiliate);
      CommissionTransaction.find = jest.fn().mockResolvedValue(mockCommissions);
      Withdrawal.find = jest.fn().mockResolvedValue(mockWithdrawals);
      Wallet.findOne = jest.fn().mockResolvedValue(mockWallet);
      AffiliateNotificationService.sendMonthlyStatement = jest.fn().mockResolvedValue();
    });

    it('should generate and send statement successfully', async () => {
      const result = await MonthlyStatementService.generateAndSendStatement('affiliate123', 2024, 1);

      expect(AffiliateNotificationService.sendMonthlyStatement).toHaveBeenCalledWith(
        mockAffiliate,
        expect.objectContaining({
          month: 'January',
          year: 2024,
          affiliateName: 'Test Business'
        })
      );

      expect(result).toEqual(expect.objectContaining({
        month: 'January',
        year: 2024
      }));
    });

    it('should handle affiliate not found', async () => {
      Affiliate.findById = jest.fn().mockResolvedValue(null);

      await expect(
        MonthlyStatementService.generateAndSendStatement('nonexistent', 2024, 1)
      ).rejects.toThrow('Affiliate not found');
    });
  });

  describe('generateAndSendAllStatements', () => {
    const mockActiveAffiliates = [
      { _id: 'affiliate1', businessName: 'Business 1', affiliateId: 'AFF-001' },
      { _id: 'affiliate2', businessName: 'Business 2', affiliateId: 'AFF-002' },
      { _id: 'affiliate3', businessName: 'Business 3', affiliateId: 'AFF-003' }
    ];

    beforeEach(() => {
      Affiliate.findActive = jest.fn().mockResolvedValue(mockActiveAffiliates);
      
      // Mock successful statement generation for first two affiliates
      MonthlyStatementService.generateAndSendStatement = jest.fn()
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: true })
        .mockRejectedValueOnce(new Error('Statement generation failed'));
    });

    it('should generate statements for all active affiliates', async () => {
      const result = await MonthlyStatementService.generateAndSendAllStatements(2024, 1);

      expect(Affiliate.findActive).toHaveBeenCalled();
      expect(MonthlyStatementService.generateAndSendStatement).toHaveBeenCalledTimes(3);
      expect(result).toEqual({
        total: 3,
        sent: 2,
        failed: 1,
        errors: [
          {
            affiliateId: 'affiliate3',
            error: 'Statement generation failed'
          }
        ]
      });
    });

    it('should handle empty affiliate list', async () => {
      Affiliate.findActive = jest.fn().mockResolvedValue([]);

      const result = await MonthlyStatementService.generateAndSendAllStatements(2024, 1);

      expect(result).toEqual({
        total: 0,
        sent: 0,
        failed: 0,
        errors: []
      });
    });
  });

  describe('scheduleMonthlyStatements', () => {
    beforeEach(() => {
      // Mock current date to February 1, 2024
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-02-01'));
      
      MonthlyStatementService.generateAndSendAllStatements = jest.fn().mockResolvedValue({
        total: 5,
        sent: 4,
        failed: 1,
        errors: []
      });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should schedule statements for previous month', async () => {
      const result = await MonthlyStatementService.scheduleMonthlyStatements();

      expect(MonthlyStatementService.generateAndSendAllStatements).toHaveBeenCalledWith(2024, 1); // January 2024
      expect(result).toEqual({
        total: 5,
        sent: 4,
        failed: 1,
        errors: []
      });
    });
  });

  describe('getMonthName', () => {
    it('should return correct month names', () => {
      expect(MonthlyStatementService.getMonthName(1)).toBe('January');
      expect(MonthlyStatementService.getMonthName(6)).toBe('June');
      expect(MonthlyStatementService.getMonthName(12)).toBe('December');
    });
  });

  describe('getAvailableStatementMonths', () => {
    beforeEach(() => {
      Affiliate.findById = jest.fn().mockResolvedValue(mockAffiliate);
      
      // Mock earliest commission from March 2023
      CommissionTransaction.findOne = jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue({
          createdAt: new Date('2023-03-15')
        })
      });
      
      // Mock current date as May 2024
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-05-15'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return available months from first commission to current month', async () => {
      const result = await MonthlyStatementService.getAvailableStatementMonths('affiliate123');

      expect(result).toEqual(expect.arrayContaining([
        { year: 2024, month: 5, monthName: 'May' },
        { year: 2024, month: 4, monthName: 'April' },
        { year: 2024, month: 3, monthName: 'March' },
        // ... more months
        { year: 2023, month: 3, monthName: 'March' }
      ]));

      // Should be in reverse chronological order (most recent first)
      expect(result[0]).toEqual({ year: 2024, month: 5, monthName: 'May' });
    });

    it('should return empty array when no commissions exist', async () => {
      CommissionTransaction.findOne = jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue(null)
      });

      const result = await MonthlyStatementService.getAvailableStatementMonths('affiliate123');

      expect(result).toEqual([]);
    });

    it('should handle affiliate not found', async () => {
      Affiliate.findById = jest.fn().mockResolvedValue(null);

      await expect(
        MonthlyStatementService.getAvailableStatementMonths('nonexistent')
      ).rejects.toThrow('Affiliate not found');
    });
  });
});