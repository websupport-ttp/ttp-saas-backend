// v1/test/services/commissionService.test.js
const CommissionService = require('../../services/commissionService');
const CommissionTransaction = require('../../models/commissionTransactionModel');
const Affiliate = require('../../models/affiliateModel');
const Referral = require('../../models/referralModel');
const WalletService = require('../../services/walletService');
const QRCodeService = require('../../services/qrCodeService');
const mongoose = require('mongoose');

// Mock external dependencies
jest.mock('../../models/affiliateModel');
jest.mock('../../models/commissionTransactionModel');
jest.mock('../../models/referralModel');
jest.mock('../../services/walletService');
jest.mock('../../services/qrCodeService');

describe('CommissionService - Commission Calculation and Processing Engine', () => {
  const mockAffiliate = {
    _id: 'affiliate123',
    businessName: 'Test Business',
    affiliateId: 'AFF-123456',
    status: 'active',
    commissionRates: {
      flights: 2.5,
      hotels: 3.0,
      insurance: 5.0,
      visa: 4.0,
    },
    addCommissionEarnings: jest.fn().mockResolvedValue(true),
    updateCommissionRates: jest.fn().mockImplementation(function(rates) {
      Object.keys(rates).forEach(key => {
        this.commissionRates[key] = rates[key];
      });
      return Promise.resolve(true);
    }),
  };

  const mockReferral = {
    _id: 'referral123',
    affiliateId: 'affiliate123',
    customerId: 'customer123',
    totalValue: 0,
    totalBookings: 0,
    firstBookingAt: null,
    status: 'active',
    save: jest.fn().mockResolvedValue(true),
  };

  const mockCommissionTransaction = {
    _id: 'commission123',
    affiliateId: 'affiliate123',
    referralId: 'referral123',
    bookingReference: 'BK123456',
    serviceType: 'flight',
    bookingAmount: 50000,
    commissionRate: 2.5,
    commissionAmount: 1250,
    status: 'pending',
    qrCode: {},
    save: jest.fn().mockResolvedValue(true),
    getSummary: jest.fn().mockReturnValue({
      id: 'commission123',
      affiliateId: 'affiliate123',
      bookingReference: 'BK123456',
      serviceType: 'flight',
      commissionAmount: 1250,
      status: 'pending',
    }),
    approve: jest.fn().mockImplementation(function(adminId, notes) {
      this.status = 'approved';
      return Promise.resolve(true);
    }),
    dispute: jest.fn().mockResolvedValue(true),
    cancel: jest.fn().mockResolvedValue(true),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    Affiliate.findById = jest.fn().mockResolvedValue(mockAffiliate);
    
    // Mock Referral with session support
    const mockReferralWithSession = {
      ...mockReferral,
    };
    Referral.findOne = jest.fn().mockImplementation(() => ({
      session: jest.fn().mockResolvedValue(mockReferralWithSession),
    }));
    
    // Mock CommissionTransaction with session support
    CommissionTransaction.findOne = jest.fn().mockImplementation(() => ({
      session: jest.fn().mockResolvedValue(null),
    }));
    
    CommissionTransaction.findById = jest.fn().mockImplementation(() => ({
      session: jest.fn().mockResolvedValue(mockCommissionTransaction),
    }));
    
    // Mock query builder for find operations
    const mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      countDocuments: jest.fn().mockResolvedValue(10),
    };
    
    CommissionTransaction.find = jest.fn().mockReturnValue(mockQueryBuilder);
    CommissionTransaction.findByAffiliate = jest.fn().mockResolvedValue([mockCommissionTransaction]);
    CommissionTransaction.findByStatus = jest.fn().mockResolvedValue([mockCommissionTransaction]);
    CommissionTransaction.getCommissionStats = jest.fn().mockResolvedValue([{
      totalCommissions: 1250,
      totalTransactions: 1,
      pendingCommissions: 1250,
      approvedCommissions: 0,
      paidCommissions: 0,
      averageCommission: 1250,
      serviceTypeBreakdown: [{
        serviceType: 'flight',
        commissionAmount: 1250,
        status: 'pending',
      }],
    }]);
    CommissionTransaction.getSystemStats = jest.fn().mockResolvedValue([{
      totalCommissions: 1250,
      totalTransactions: 1,
      totalBookingValue: 50000,
      averageCommissionRate: 2.5,
      statusBreakdown: [{ status: 'pending', count: 1, amount: 1250 }],
      serviceTypeBreakdown: [{ serviceType: 'flight', count: 1, amount: 1250 }],
    }]);
    
    // Mock constructor
    CommissionTransaction.mockImplementation(() => mockCommissionTransaction);
    CommissionTransaction.prototype.save = jest.fn().mockResolvedValue(mockCommissionTransaction);
    
    WalletService.creditWallet = jest.fn().mockResolvedValue({ success: true });
    WalletService.debitWallet = jest.fn().mockResolvedValue({ success: true });
    
    QRCodeService.generateCommissionQR = jest.fn().mockResolvedValue({
      success: true,
      data: { qrCode: { data: 'qr_data', url: 'qr_url' } },
    });

    // Mock mongoose session
    const mockSession = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    };
    mongoose.startSession = jest.fn().mockResolvedValue(mockSession);
    
    // Mock Affiliate.findById with session support for transaction methods
    Affiliate.findById = jest.fn().mockImplementation(() => ({
      session: jest.fn().mockResolvedValue({
        ...mockAffiliate,
        addCommissionEarnings: jest.fn().mockResolvedValue(true),
      }),
    }));
  });

  describe('calculateCommission', () => {
    beforeEach(() => {
      // Reset Affiliate.findById for calculateCommission tests (no session needed)
      Affiliate.findById = jest.fn().mockResolvedValue(mockAffiliate);
    });

    it('should calculate commission correctly for flight booking', async () => {
      const bookingData = {
        serviceType: 'flight',
        bookingAmount: 50000,
        currency: 'NGN',
      };

      const result = await CommissionService.calculateCommission(bookingData, 'affiliate123');

      expect(result.success).toBe(true);
      expect(result.data.serviceType).toBe('flight');
      expect(result.data.bookingAmount).toBe(50000);
      expect(result.data.commissionRate).toBe(2.5);
      expect(result.data.commissionAmount).toBe(1250); // 50000 * 2.5 / 100
      expect(result.data.currency).toBe('NGN');
      expect(result.data.affiliate.businessName).toBe('Test Business');
      expect(Affiliate.findById).toHaveBeenCalledWith('affiliate123');
    });

    it('should calculate commission correctly for different service types', async () => {
      const testCases = [
        { serviceType: 'hotel', rate: 3.0, amount: 30000, expected: 900 },
        { serviceType: 'insurance', rate: 5.0, amount: 10000, expected: 500 },
        { serviceType: 'visa', rate: 4.0, amount: 25000, expected: 1000 },
      ];

      for (const testCase of testCases) {
        const bookingData = {
          serviceType: testCase.serviceType,
          bookingAmount: testCase.amount,
        };

        const result = await CommissionService.calculateCommission(bookingData, 'affiliate123');

        expect(result.success).toBe(true);
        expect(result.data.commissionRate).toBe(testCase.rate);
        expect(result.data.commissionAmount).toBe(testCase.expected);
      }
    });

    it('should handle decimal amounts correctly', async () => {
      const bookingData = {
        serviceType: 'flight',
        bookingAmount: 33333.33,
      };

      const result = await CommissionService.calculateCommission(bookingData, 'affiliate123');

      expect(result.success).toBe(true);
      expect(result.data.commissionAmount).toBe(833.33); // 33333.33 * 2.5 / 100 = 833.3325 ≈ 833.33
    });

    it('should throw error for invalid service type', async () => {
      const bookingData = {
        serviceType: 'invalid_service',
        bookingAmount: 50000,
      };

      await expect(CommissionService.calculateCommission(bookingData, 'affiliate123'))
        .rejects.toThrow('Invalid service type');
    });

    it('should throw error for inactive affiliate', async () => {
      const inactiveAffiliate = { ...mockAffiliate, status: 'suspended' };
      Affiliate.findById.mockResolvedValue(inactiveAffiliate);

      const bookingData = {
        serviceType: 'flight',
        bookingAmount: 50000,
      };

      await expect(CommissionService.calculateCommission(bookingData, 'affiliate123'))
        .rejects.toThrow('Cannot calculate commission for suspended affiliate');
    });

    it('should throw error for zero or negative booking amount', async () => {
      const bookingData = {
        serviceType: 'flight',
        bookingAmount: 0,
      };

      await expect(CommissionService.calculateCommission(bookingData, 'affiliate123'))
        .rejects.toThrow('Booking amount must be positive');
    });

    it('should throw error for missing required fields', async () => {
      await expect(CommissionService.calculateCommission({}, 'affiliate123'))
        .rejects.toThrow('Service type and booking amount are required');

      await expect(CommissionService.calculateCommission({ serviceType: 'flight', bookingAmount: 50000 }, null))
        .rejects.toThrow('Booking data and affiliate ID are required');
    });

    it('should throw error for non-existent affiliate', async () => {
      Affiliate.findById.mockResolvedValue(null);

      const bookingData = {
        serviceType: 'flight',
        bookingAmount: 50000,
      };

      await expect(CommissionService.calculateCommission(bookingData, 'nonexistent'))
        .rejects.toThrow('Affiliate not found');
    });

    it('should throw error when no commission rate configured', async () => {
      const zeroRateAffiliate = {
        ...mockAffiliate,
        commissionRates: {
          flights: 0,
          hotels: 0,
          insurance: 0,
          visa: 0,
        },
      };
      Affiliate.findById.mockResolvedValue(zeroRateAffiliate);

      const bookingData = {
        serviceType: 'flight',
        bookingAmount: 50000,
      };

      await expect(CommissionService.calculateCommission(bookingData, 'affiliate123'))
        .rejects.toThrow('No commission rate configured for flight');
    });
  });

  describe('updateCommissionRates', () => {
    beforeEach(() => {
      // Reset Affiliate.findById for updateCommissionRates tests (no session needed)
      Affiliate.findById = jest.fn().mockResolvedValue(mockAffiliate);
    });

    it('should update commission rates successfully', async () => {
      const mockUpdatedAffiliate = {
        ...mockAffiliate,
        updateCommissionRates: jest.fn().mockImplementation(function(rates) {
          // Update the rates on the affiliate object
          Object.keys(rates).forEach(key => {
            this.commissionRates[key] = rates[key];
          });
          return Promise.resolve(true);
        }),
      };
      
      Affiliate.findById.mockResolvedValue(mockUpdatedAffiliate);

      const newRates = {
        flights: 3.0,
        hotels: 3.5,
      };

      const result = await CommissionService.updateCommissionRates(
        'affiliate123',
        newRates,
        'admin123'
      );

      expect(result.success).toBe(true);
      expect(result.data.newRates.flights).toBe(3.0);
      expect(result.data.newRates.hotels).toBe(3.5);
      expect(result.data.oldRates.flights).toBe(2.5);
      expect(result.data.oldRates.hotels).toBe(3.0);
      expect(mockUpdatedAffiliate.updateCommissionRates).toHaveBeenCalledWith(newRates);
    });

    it('should throw error for invalid service types', async () => {
      const invalidRates = {
        invalid_service: 2.0,
      };

      await expect(CommissionService.updateCommissionRates(
        'affiliate123',
        invalidRates,
        'admin123'
      )).rejects.toThrow('Invalid service types: invalid_service');
    });

    it('should throw error for invalid rate values', async () => {
      const invalidRates = {
        flights: 150, // > 100%
      };

      await expect(CommissionService.updateCommissionRates(
        'affiliate123',
        invalidRates,
        'admin123'
      )).rejects.toThrow('Invalid rate for flights: must be between 0 and 100');
    });

    it('should throw error for negative rates', async () => {
      const invalidRates = {
        flights: -5,
      };

      await expect(CommissionService.updateCommissionRates(
        'affiliate123',
        invalidRates,
        'admin123'
      )).rejects.toThrow('Invalid rate for flights: must be between 0 and 100');
    });
  });

  describe('processCommission', () => {
    const bookingData = {
      serviceType: 'flight',
      bookingAmount: 50000,
      customerId: 'customer123',
      currency: 'NGN',
    };

    beforeEach(() => {
      // Reset mock affiliate rates to ensure clean state
      mockAffiliate.commissionRates = {
        flights: 2.5,
        hotels: 3.0,
        insurance: 5.0,
        visa: 4.0,
      };
      
      // Mock Affiliate.findById to handle both direct calls and session chaining
      Affiliate.findById = jest.fn().mockImplementation((id) => {
        // Create a mock query object that supports both direct resolution and session chaining
        const mockQuery = {
          // For direct await (calculateCommission)
          then: (resolve, reject) => {
            resolve(mockAffiliate);
          },
          // For session chaining (processCommission)
          session: jest.fn().mockResolvedValue({
            ...mockAffiliate,
            addCommissionEarnings: jest.fn().mockResolvedValue(true),
          }),
        };
        
        return mockQuery;
      });
    });

    it('should process commission successfully with auto-approval', async () => {
      const result = await CommissionService.processCommission(
        'BK123456',
        'affiliate123',
        bookingData,
        { autoApprove: true, processedBy: 'admin123' }
      );

      expect(result.success).toBe(true);
      expect(result.data.commission.status).toBe('pending');
      expect(result.data.calculation.commissionAmount).toBe(1250); // 50000 * 2.5% = 1250
      expect(WalletService.creditWallet).toHaveBeenCalledWith(
        'affiliate123',
        1250,
        'COMM_commission123',
        expect.objectContaining({
          type: 'commission_credit',
          processedBy: 'admin123',
        })
      );
      expect(QRCodeService.generateCommissionQR).toHaveBeenCalled();
    });

    it('should process commission without auto-approval', async () => {
      const result = await CommissionService.processCommission(
        'BK123456',
        'affiliate123',
        bookingData
      );

      expect(result.success).toBe(true);
      expect(result.data.commission.status).toBe('pending');
      expect(WalletService.creditWallet).not.toHaveBeenCalled();
    });

    it('should throw error for duplicate booking reference', async () => {
      CommissionTransaction.findOne = jest.fn().mockImplementation(() => ({
        session: jest.fn().mockResolvedValue(mockCommissionTransaction),
      }));

      await expect(CommissionService.processCommission(
        'BK123456',
        'affiliate123',
        bookingData
      )).rejects.toThrow('Commission already processed for this booking');
    });

    it('should throw error when referral not found', async () => {
      Referral.findOne = jest.fn().mockImplementation(() => ({
        session: jest.fn().mockResolvedValue(null),
      }));

      await expect(CommissionService.processCommission(
        'BK123456',
        'affiliate123',
        bookingData
      )).rejects.toThrow('Referral record not found');
    });

    it('should handle QR code generation failure gracefully', async () => {
      QRCodeService.generateCommissionQR.mockRejectedValue(new Error('QR generation failed'));

      const result = await CommissionService.processCommission(
        'BK123456',
        'affiliate123',
        bookingData
      );

      expect(result.success).toBe(true);
      // Should still succeed even if QR code generation fails
    });

    it('should update referral statistics correctly', async () => {
      await CommissionService.processCommission(
        'BK123456',
        'affiliate123',
        bookingData
      );

      // The referral object should be updated during processing
      // Note: The actual referral object returned by the session mock will be updated
      expect(mockReferral.save).toHaveBeenCalled();
    });
  });

  describe('approveCommission', () => {
    beforeEach(() => {
      // Reset mock commission transaction status to ensure clean state
      mockCommissionTransaction.status = 'pending';
      
      // Reset CommissionTransaction.findById for approveCommission tests with session support
      CommissionTransaction.findById = jest.fn().mockImplementation((id) => {
        const mockQuery = {
          then: (resolve, reject) => {
            resolve(mockCommissionTransaction);
          },
          session: jest.fn().mockResolvedValue(mockCommissionTransaction),
        };
        return mockQuery;
      });
    });

    it('should approve commission successfully', async () => {
      const result = await CommissionService.approveCommission(
        'commission123',
        'admin123',
        { notes: 'Approved by admin' }
      );

      expect(result.success).toBe(true);
      expect(mockCommissionTransaction.approve).toHaveBeenCalledWith(
        'admin123',
        'Approved by admin'
      );
      expect(WalletService.creditWallet).toHaveBeenCalled();
    });

    it('should approve commission without auto-pay', async () => {
      const result = await CommissionService.approveCommission(
        'commission123',
        'admin123',
        { autoPay: false }
      );

      expect(result.success).toBe(true);
      expect(WalletService.creditWallet).not.toHaveBeenCalled();
    });

    it('should throw error for non-pending commission', async () => {
      const approvedCommission = { ...mockCommissionTransaction, status: 'approved' };
      
      CommissionTransaction.findById = jest.fn().mockImplementation((id) => {
        const mockQuery = {
          then: (resolve, reject) => {
            resolve(approvedCommission);
          },
          session: jest.fn().mockResolvedValue(approvedCommission),
        };
        return mockQuery;
      });

      await expect(CommissionService.approveCommission(
        'commission123',
        'admin123'
      )).rejects.toThrow('Cannot approve approved commission');
    });

    it('should handle wallet credit failure gracefully', async () => {
      WalletService.creditWallet.mockRejectedValue(new Error('Wallet credit failed'));

      const result = await CommissionService.approveCommission(
        'commission123',
        'admin123'
      );

      expect(result.success).toBe(true);
      // Should still succeed even if wallet credit fails
    });
  });

  describe('disputeCommission', () => {
    beforeEach(() => {
      // Reset CommissionTransaction.findById for disputeCommission tests (no session needed)
      CommissionTransaction.findById = jest.fn().mockResolvedValue(mockCommissionTransaction);
    });

    it('should dispute commission successfully', async () => {
      const result = await CommissionService.disputeCommission(
        'commission123',
        'Fraudulent transaction',
        'admin123'
      );

      expect(result.success).toBe(true);
      expect(mockCommissionTransaction.dispute).toHaveBeenCalledWith(
        'Fraudulent transaction',
        'admin123'
      );
    });

    it('should reverse wallet credit for paid commission', async () => {
      const paidCommission = { ...mockCommissionTransaction, status: 'paid' };
      CommissionTransaction.findById.mockResolvedValue(paidCommission);

      const result = await CommissionService.disputeCommission(
        'commission123',
        'Fraudulent transaction',
        'admin123'
      );

      expect(result.success).toBe(true);
      expect(WalletService.debitWallet).toHaveBeenCalledWith(
        'affiliate123',
        1250,
        'DISP_commission123',
        expect.objectContaining({
          type: 'dispute_debit',
          processedBy: 'admin123',
        })
      );
    });

    it('should throw error for already disputed commission', async () => {
      const disputedCommission = { ...mockCommissionTransaction, status: 'disputed' };
      CommissionTransaction.findById.mockResolvedValue(disputedCommission);

      await expect(CommissionService.disputeCommission(
        'commission123',
        'Fraudulent transaction',
        'admin123'
      )).rejects.toThrow('Commission is already disputed');
    });
  });

  describe('getCommissionHistory', () => {
    it('should get commission history with pagination', async () => {
      CommissionTransaction.prototype.countDocuments = jest.fn().mockResolvedValue(10);

      const result = await CommissionService.getCommissionHistory(
        'affiliate123',
        { page: 1, limit: 5, status: 'pending' }
      );

      expect(result.success).toBe(true);
      expect(result.data.commissions).toHaveLength(1);
      expect(result.data.pagination.totalPages).toBe(2);
      expect(result.data.pagination.currentPage).toBe(1);
      expect(result.data.summary.totalAmount).toBe(1250);
    });

    it('should filter by service type and date range', async () => {
      const filters = {
        serviceType: 'flight',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        status: 'paid',
      };

      const result = await CommissionService.getCommissionHistory('affiliate123', filters);

      expect(result.success).toBe(true);
      expect(CommissionTransaction.findByAffiliate).toHaveBeenCalledWith(
        'affiliate123',
        expect.objectContaining({
          serviceType: 'flight',
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          status: 'paid',
        })
      );
    });
  });

  describe('getCommissionStatistics', () => {
    beforeEach(() => {
      // Reset Affiliate.findById for getCommissionStatistics tests (no session needed)
      Affiliate.findById = jest.fn().mockResolvedValue(mockAffiliate);
    });

    it('should get commission statistics for affiliate', async () => {
      const result = await CommissionService.getCommissionStatistics(
        'affiliate123',
        { startDate: '2024-01-01', endDate: '2024-12-31' }
      );

      expect(result.success).toBe(true);
      expect(result.data.statistics.totalCommissions).toBe(1250);
      expect(result.data.statistics.totalTransactions).toBe(1);
      expect(result.data.statistics.serviceTypeBreakdown.flight).toBeDefined();
      expect(CommissionTransaction.getCommissionStats).toHaveBeenCalledWith(
        'affiliate123',
        { startDate: '2024-01-01', endDate: '2024-12-31' }
      );
    });

    it('should calculate conversion rate correctly', async () => {
      const affiliateWithReferrals = { ...mockAffiliate, totalReferrals: 10 };
      Affiliate.findById.mockResolvedValue(affiliateWithReferrals);

      const result = await CommissionService.getCommissionStatistics('affiliate123');

      expect(result.data.statistics.conversionRate).toBe('10.00'); // 1 transaction / 10 referrals * 100
    });
  });

  describe('bulkApproveCommissions', () => {
    beforeEach(() => {
      // Reset mock commission transaction status to ensure clean state
      mockCommissionTransaction.status = 'pending';
      
      // Reset CommissionTransaction.findById for bulkApproveCommissions tests with session support
      CommissionTransaction.findById = jest.fn().mockImplementation((id) => {
        // Create a fresh mock for each call to avoid status modification issues
        const freshMock = {
          ...mockCommissionTransaction,
          status: 'pending',
          approve: jest.fn().mockImplementation(function(adminId, notes) {
            this.status = 'approved';
            return Promise.resolve(true);
          }),
        };
        
        const mockQuery = {
          then: (resolve, reject) => {
            resolve(freshMock);
          },
          session: jest.fn().mockResolvedValue(freshMock),
        };
        return mockQuery;
      });
    });

    it('should bulk approve multiple commissions', async () => {
      const commissionIds = ['commission1', 'commission2', 'commission3'];
      
      const result = await CommissionService.bulkApproveCommissions(
        commissionIds,
        'admin123',
        { notes: 'Bulk approval', autoPay: true }
      );

      expect(result.success).toBe(true);
      expect(result.data.successful).toHaveLength(3);
      expect(result.data.failed).toHaveLength(0);
    });

    it('should handle partial failures in bulk approval', async () => {
      const commissionIds = ['commission1', 'commission2'];
      
      // Mock one success and one failure
      let callCount = 0;
      CommissionTransaction.findById = jest.fn().mockImplementation((id) => {
        callCount++;
        if (callCount === 1) {
          // First call - success
          const freshMock = {
            ...mockCommissionTransaction,
            status: 'pending',
            approve: jest.fn().mockImplementation(function(adminId, notes) {
              this.status = 'approved';
              return Promise.resolve(true);
            }),
          };
          
          const mockQuery = {
            then: (resolve, reject) => {
              resolve(freshMock);
            },
            session: jest.fn().mockResolvedValue(freshMock),
          };
          return mockQuery;
        } else {
          // Second call - failure (not found)
          const mockQuery = {
            then: (resolve, reject) => {
              resolve(null);
            },
            session: jest.fn().mockResolvedValue(null),
          };
          return mockQuery;
        }
      });

      const result = await CommissionService.bulkApproveCommissions(
        commissionIds,
        'admin123'
      );

      expect(result.success).toBe(true);
      expect(result.data.successful).toHaveLength(1);
      expect(result.data.failed).toHaveLength(1);
      expect(result.data.failed[0].error).toContain('Commission transaction not found');
    });
  });

  describe('getSystemCommissionStatistics', () => {
    it('should get system-wide commission statistics', async () => {
      const result = await CommissionService.getSystemCommissionStatistics({
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });

      expect(result.success).toBe(true);
      expect(result.data.totalCommissions).toBe(1250);
      expect(result.data.totalTransactions).toBe(1);
      expect(result.data.averageTransactionValue).toBe('50000.00');
      expect(result.data.commissionPercentage).toBe('2.50');
      expect(result.data.statusBreakdown.pending).toEqual({ count: 1, amount: 1250 });
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      Affiliate.findById.mockRejectedValue(new Error('Database connection failed'));

      const bookingData = {
        serviceType: 'flight',
        bookingAmount: 50000,
      };

      await expect(CommissionService.calculateCommission(bookingData, 'affiliate123'))
        .rejects.toThrow('Failed to calculate commission');
    });

    it('should validate required parameters', async () => {
      await expect(CommissionService.calculateCommission(null, 'affiliate123'))
        .rejects.toThrow('Booking data and affiliate ID are required');

      await expect(CommissionService.updateCommissionRates(null, {}, 'admin123'))
        .rejects.toThrow('Affiliate ID, rates, and updated by are required');

      await expect(CommissionService.processCommission(null, 'affiliate123', {}))
        .rejects.toThrow('Booking reference, affiliate ID, and booking data are required');

      await expect(CommissionService.approveCommission(null, 'admin123'))
        .rejects.toThrow('Commission ID and admin ID are required');

      await expect(CommissionService.disputeCommission(null, 'reason', 'admin123'))
        .rejects.toThrow('Commission ID, reason, and disputed by are required');
    });

    it('should handle transaction rollback on errors', async () => {
      const mockSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn(),
      };
      mongoose.startSession.mockResolvedValue(mockSession);

      // Mock an error during processing
      mockCommissionTransaction.save.mockRejectedValue(new Error('Save failed'));

      await expect(CommissionService.processCommission(
        'BK123456',
        'affiliate123',
        { serviceType: 'flight', bookingAmount: 50000, customerId: 'customer123' }
      )).rejects.toThrow();

      expect(mockSession.abortTransaction).toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalled();
    });
  });
});