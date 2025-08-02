// v1/test/services/affiliateNotificationService.test.js
const AffiliateNotificationService = require('../../services/affiliateNotificationService');
const { sendEmail } = require('../../utils/emailService');
const { sendSMS } = require('../../utils/smsService');
const Affiliate = require('../../models/affiliateModel');
const User = require('../../models/userModel');

// Mock dependencies
jest.mock('../../utils/emailService');
jest.mock('../../utils/smsService');
jest.mock('../../models/affiliateModel');
jest.mock('../../models/userModel');

describe('AffiliateNotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockAffiliate = {
    _id: 'affiliate123',
    userId: 'user123',
    businessName: 'Test Business',
    affiliateId: 'AFF-123456',
    notificationPreferences: {
      email: true,
      sms: false,
      monthlyStatements: true
    }
  };

  const mockUser = {
    _id: 'user123',
    email: 'test@business.com',
    phoneNumber: '+2348123456789'
  };

  const mockCommissionData = {
    _id: 'commission123',
    commissionAmount: 5000,
    serviceType: 'flight',
    bookingReference: 'BK123456',
    commissionRate: 2.5,
    bookingAmount: 200000
  };

  const mockWithdrawalData = {
    _id: 'withdrawal123',
    amount: 50000,
    status: 'completed',
    bankDetails: {
      accountName: 'Test Business',
      accountNumber: '1234567890',
      bankName: 'Test Bank'
    },
    createdAt: new Date(),
    processedAt: new Date(),
    paystackReference: 'PSK123456'
  };

  describe('sendCommissionEarnedNotification', () => {
    beforeEach(() => {
      User.findById.mockResolvedValue(mockUser);
      sendEmail.mockResolvedValue({ success: true });
      sendSMS.mockResolvedValue({ success: true });
    });

    it('should send email notification when email preference is enabled', async () => {
      await AffiliateNotificationService.sendCommissionEarnedNotification(mockCommissionData, mockAffiliate);

      expect(User.findById).toHaveBeenCalledWith(mockAffiliate.userId);
      expect(sendEmail).toHaveBeenCalledWith({
        to: mockUser.email,
        subject: expect.stringContaining('Commission Earned'),
        html: expect.stringContaining('₦5,000')
      });
      expect(sendSMS).not.toHaveBeenCalled();
    });

    it('should send SMS notification when SMS preference is enabled', async () => {
      const affiliateWithSMS = {
        ...mockAffiliate,
        notificationPreferences: { email: false, sms: true }
      };

      await AffiliateNotificationService.sendCommissionEarnedNotification(mockCommissionData, affiliateWithSMS);

      expect(sendSMS).toHaveBeenCalledWith(
        mockUser.phoneNumber,
        expect.stringContaining('Commission Earned')
      );
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('should send both email and SMS when both preferences are enabled', async () => {
      const affiliateWithBoth = {
        ...mockAffiliate,
        notificationPreferences: { email: true, sms: true }
      };

      await AffiliateNotificationService.sendCommissionEarnedNotification(mockCommissionData, affiliateWithBoth);

      expect(sendEmail).toHaveBeenCalled();
      expect(sendSMS).toHaveBeenCalled();
    });

    it('should not send notifications when preferences are disabled', async () => {
      const affiliateWithNoNotifications = {
        ...mockAffiliate,
        notificationPreferences: { email: false, sms: false }
      };

      await AffiliateNotificationService.sendCommissionEarnedNotification(mockCommissionData, affiliateWithNoNotifications);

      expect(sendEmail).not.toHaveBeenCalled();
      expect(sendSMS).not.toHaveBeenCalled();
    });

    it('should handle missing user gracefully', async () => {
      User.findById.mockResolvedValue(null);

      await expect(
        AffiliateNotificationService.sendCommissionEarnedNotification(mockCommissionData, mockAffiliate)
      ).rejects.toThrow('User not found for affiliate');
    });

    it('should handle email service failure gracefully', async () => {
      sendEmail.mockRejectedValue(new Error('Email service failed'));

      await expect(
        AffiliateNotificationService.sendCommissionEarnedNotification(mockCommissionData, mockAffiliate)
      ).rejects.toThrow('Email service failed');
    });
  });

  describe('sendWithdrawalProcessedNotification', () => {
    beforeEach(() => {
      User.findById.mockResolvedValue(mockUser);
      sendEmail.mockResolvedValue({ success: true });
      sendSMS.mockResolvedValue({ success: true });
    });

    it('should send withdrawal completed notification', async () => {
      await AffiliateNotificationService.sendWithdrawalProcessedNotification(mockWithdrawalData, mockAffiliate);

      expect(sendEmail).toHaveBeenCalledWith({
        to: mockUser.email,
        subject: expect.stringContaining('Withdrawal Completed'),
        html: expect.stringContaining('₦50,000')
      });
    });

    it('should send withdrawal failed notification', async () => {
      const failedWithdrawal = {
        ...mockWithdrawalData,
        status: 'failed',
        failureReason: 'Insufficient funds'
      };

      await AffiliateNotificationService.sendWithdrawalProcessedNotification(failedWithdrawal, mockAffiliate);

      expect(sendEmail).toHaveBeenCalledWith({
        to: mockUser.email,
        subject: expect.stringContaining('Withdrawal Update'),
        html: expect.stringContaining('failed')
      });
    });

    it('should include bank details in notification', async () => {
      await AffiliateNotificationService.sendWithdrawalProcessedNotification(mockWithdrawalData, mockAffiliate);

      const emailCall = sendEmail.mock.calls[0][0];
      expect(emailCall.html).toContain(mockWithdrawalData.bankDetails.accountName);
      expect(emailCall.html).toContain(mockWithdrawalData.bankDetails.accountNumber);
      expect(emailCall.html).toContain(mockWithdrawalData.bankDetails.bankName);
    });
  });

  describe('sendAccountStatusChangeNotification', () => {
    beforeEach(() => {
      User.findById.mockResolvedValue(mockUser);
      sendEmail.mockResolvedValue({ success: true });
      sendSMS.mockResolvedValue({ success: true });
    });

    it('should send account activation notification', async () => {
      await AffiliateNotificationService.sendAccountStatusChangeNotification(mockAffiliate, 'pending', 'active');

      expect(sendEmail).toHaveBeenCalledWith({
        to: mockUser.email,
        subject: expect.stringContaining('Account Status Update - ACTIVE'),
        html: expect.stringContaining('Congratulations')
      });
    });

    it('should send account suspension notification', async () => {
      const suspendedAffiliate = {
        ...mockAffiliate,
        suspensionReason: 'Policy violation'
      };

      await AffiliateNotificationService.sendAccountStatusChangeNotification(suspendedAffiliate, 'active', 'suspended');

      expect(sendEmail).toHaveBeenCalledWith({
        to: mockUser.email,
        subject: expect.stringContaining('Account Status Update - SUSPENDED'),
        html: expect.stringContaining('suspended')
      });
    });

    it('should include suspension reason in notification', async () => {
      const suspendedAffiliate = {
        ...mockAffiliate,
        suspensionReason: 'Policy violation'
      };

      await AffiliateNotificationService.sendAccountStatusChangeNotification(suspendedAffiliate, 'active', 'suspended');

      const emailCall = sendEmail.mock.calls[0][0];
      expect(emailCall.html).toContain('Policy violation');
    });
  });

  describe('sendMonthlyStatement', () => {
    const mockStatementData = {
      month: 'January',
      year: 2024,
      totalReferrals: 10,
      successfulBookings: 8,
      totalCommissions: 25000,
      totalWithdrawals: 20000,
      currentBalance: 5000,
      commissionsByService: {
        flights: 15000,
        hotels: 10000,
        insurance: 0,
        visa: 0
      }
    };

    beforeEach(() => {
      User.findById.mockResolvedValue(mockUser);
      sendEmail.mockResolvedValue({ success: true });
    });

    it('should send monthly statement when preference is enabled', async () => {
      await AffiliateNotificationService.sendMonthlyStatement(mockAffiliate, mockStatementData);

      expect(sendEmail).toHaveBeenCalledWith({
        to: mockUser.email,
        subject: expect.stringContaining('Monthly Affiliate Statement - January 2024'),
        html: expect.stringContaining('₦25,000')
      });
    });

    it('should not send monthly statement when preference is disabled', async () => {
      const affiliateWithoutStatements = {
        ...mockAffiliate,
        notificationPreferences: { ...mockAffiliate.notificationPreferences, monthlyStatements: false }
      };

      await AffiliateNotificationService.sendMonthlyStatement(affiliateWithoutStatements, mockStatementData);

      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('should include commission breakdown in statement', async () => {
      await AffiliateNotificationService.sendMonthlyStatement(mockAffiliate, mockStatementData);

      const emailCall = sendEmail.mock.calls[0][0];
      expect(emailCall.html).toContain('₦15,000'); // Flights commission
      expect(emailCall.html).toContain('₦10,000'); // Hotels commission
    });
  });

  describe('updateNotificationPreferences', () => {
    beforeEach(() => {
      // Reset mocks for this describe block
      jest.clearAllMocks();
    });

    it('should update notification preferences', async () => {
      const newPreferences = { email: false, sms: true };
      const mockSave = jest.fn().mockResolvedValue(true);
      const affiliate = {
        ...mockAffiliate,
        notificationPreferences: { email: true, sms: false, monthlyStatements: true },
        save: mockSave
      };
      
      Affiliate.findById = jest.fn().mockResolvedValue(affiliate);

      const result = await AffiliateNotificationService.updateNotificationPreferences('affiliate123', newPreferences);

      expect(affiliate.notificationPreferences).toEqual({
        email: false,
        sms: true,
        monthlyStatements: true
      });
      expect(mockSave).toHaveBeenCalled();
      expect(result).toEqual(affiliate.notificationPreferences);
    });

    it('should handle affiliate not found', async () => {
      Affiliate.findById = jest.fn().mockResolvedValue(null);

      await expect(
        AffiliateNotificationService.updateNotificationPreferences('nonexistent', { email: false })
      ).rejects.toThrow('Affiliate not found');
    });
  });

  describe('getNotificationPreferences', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return existing preferences', async () => {
      Affiliate.findById = jest.fn().mockResolvedValue(mockAffiliate);

      const result = await AffiliateNotificationService.getNotificationPreferences('affiliate123');

      expect(result).toEqual(mockAffiliate.notificationPreferences);
    });

    it('should return default preferences when none exist', async () => {
      const affiliateWithoutPreferences = { ...mockAffiliate, notificationPreferences: undefined };
      Affiliate.findById = jest.fn().mockResolvedValue(affiliateWithoutPreferences);

      const result = await AffiliateNotificationService.getNotificationPreferences('affiliate123');

      expect(result).toEqual({
        email: true,
        sms: false,
        monthlyStatements: true
      });
    });

    it('should handle affiliate not found', async () => {
      Affiliate.findById = jest.fn().mockResolvedValue(null);

      await expect(
        AffiliateNotificationService.getNotificationPreferences('nonexistent')
      ).rejects.toThrow('Affiliate not found');
    });
  });

  describe('Template Generation', () => {
    describe('getCommissionEarnedEmailTemplate', () => {
      it('should generate correct email template', () => {
        const template = AffiliateNotificationService.getCommissionEarnedEmailTemplate(mockCommissionData, mockAffiliate);

        expect(template.subject).toContain('Commission Earned - ₦5,000');
        expect(template.html).toContain('Test Business');
        expect(template.html).toContain('₦5,000');
        expect(template.html).toContain('flight');
        expect(template.html).toContain('BK123456');
        expect(template.html).toContain('2.5%');
      });
    });

    describe('getCommissionEarnedSMSTemplate', () => {
      it('should generate correct SMS template', () => {
        const sms = AffiliateNotificationService.getCommissionEarnedSMSTemplate(mockCommissionData, mockAffiliate);

        expect(sms).toContain('Commission Earned!');
        expect(sms).toContain('₦5,000');
        expect(sms).toContain('flight');
        expect(sms).toContain('BK123456');
      });
    });

    describe('getWithdrawalProcessedSMSTemplate', () => {
      it('should generate correct SMS for completed withdrawal', () => {
        const sms = AffiliateNotificationService.getWithdrawalProcessedSMSTemplate(mockWithdrawalData, mockAffiliate);

        expect(sms).toContain('₦50,000');
        expect(sms).toContain('completed');
        expect(sms).toContain('1-3 business days');
      });

      it('should generate correct SMS for failed withdrawal', () => {
        const failedWithdrawal = { ...mockWithdrawalData, status: 'failed' };
        const sms = AffiliateNotificationService.getWithdrawalProcessedSMSTemplate(failedWithdrawal, mockAffiliate);

        expect(sms).toContain('₦50,000');
        expect(sms).toContain('failed');
        expect(sms).toContain('contact support');
      });
    });

    describe('getAccountStatusChangeSMSTemplate', () => {
      it('should generate correct SMS for activation', () => {
        const sms = AffiliateNotificationService.getAccountStatusChangeSMSTemplate(mockAffiliate, 'pending', 'active');

        expect(sms).toContain('affiliate account is now active');
      });

      it('should generate correct SMS for suspension', () => {
        const sms = AffiliateNotificationService.getAccountStatusChangeSMSTemplate(mockAffiliate, 'active', 'suspended');

        expect(sms).toContain('suspended');
      });
    });
  });
});