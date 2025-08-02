// v1/test/services/affiliateNotificationQRIntegration.test.js
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

describe('AffiliateNotificationService - QR Code Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockAffiliate = {
    _id: 'affiliate123',
    userId: 'user123',
    businessName: 'Test Business',
    affiliateId: 'AFF-123456',
    qrCode: {
      data: 'base64-encoded-qr-code-data',
      url: 'https://api.travelplace.com/qr/affiliate/AFF-123456',
      metadata: {
        type: 'affiliate',
        affiliateId: 'AFF-123456',
        createdAt: new Date()
      }
    },
    notificationPreferences: {
      email: true,
      sms: true,
      monthlyStatements: true
    }
  };

  const mockUser = {
    _id: 'user123',
    email: 'test@business.com',
    phoneNumber: '+2348123456789'
  };

  describe('Commission Earned Notifications with QR Codes', () => {
    beforeEach(() => {
      User.findById.mockResolvedValue(mockUser);
      sendEmail.mockResolvedValue({ success: true });
      sendSMS.mockResolvedValue({ success: true });
    });

    it('should include QR code in commission earned email when QR code exists', async () => {
      const commissionData = {
        _id: 'commission123',
        commissionAmount: 5000,
        serviceType: 'flight',
        bookingReference: 'BK123456',
        commissionRate: 2.5,
        bookingAmount: 200000,
        qrCode: {
          data: 'base64-commission-qr-code',
          url: 'https://api.travelplace.com/qr/commission/commission123',
          metadata: {
            type: 'commission',
            commissionId: 'commission123',
            amount: 5000
          }
        }
      };

      await AffiliateNotificationService.sendCommissionEarnedNotification(commissionData, mockAffiliate);

      expect(sendEmail).toHaveBeenCalledWith({
        to: mockUser.email,
        subject: expect.stringContaining('Commission Earned'),
        html: expect.stringContaining('https://api.travelplace.com/qr/commission/commission123')
      });

      // Verify QR code section is included in email
      const emailCall = sendEmail.mock.calls[0][0];
      expect(emailCall.html).toContain('Transaction QR Code');
      expect(emailCall.html).toContain('View QR Code');
      expect(emailCall.html).toContain('Use this QR code to quickly access transaction details');
    });

    it('should include QR code in commission earned SMS when QR code exists', async () => {
      const commissionData = {
        _id: 'commission123',
        commissionAmount: 5000,
        serviceType: 'flight',
        bookingReference: 'BK123456',
        commissionRate: 2.5,
        bookingAmount: 200000,
        qrCode: {
          data: 'base64-commission-qr-code',
          url: 'https://api.travelplace.com/qr/commission/commission123',
          metadata: {
            type: 'commission',
            commissionId: 'commission123'
          }
        }
      };

      await AffiliateNotificationService.sendCommissionEarnedNotification(commissionData, mockAffiliate);

      expect(sendSMS).toHaveBeenCalledWith(
        mockUser.phoneNumber,
        expect.stringContaining('https://api.travelplace.com/qr/commission/commission123')
      );

      // Verify QR code URL is included in SMS
      const smsCall = sendSMS.mock.calls[0][1];
      expect(smsCall).toContain('QR code:');
      expect(smsCall).toContain('https://api.travelplace.com/qr/commission/commission123');
    });

    it('should not include QR code section when QR code does not exist', async () => {
      const commissionDataWithoutQR = {
        _id: 'commission123',
        commissionAmount: 5000,
        serviceType: 'flight',
        bookingReference: 'BK123456',
        commissionRate: 2.5,
        bookingAmount: 200000
        // No qrCode field
      };

      await AffiliateNotificationService.sendCommissionEarnedNotification(commissionDataWithoutQR, mockAffiliate);

      const emailCall = sendEmail.mock.calls[0][0];
      expect(emailCall.html).not.toContain('Transaction QR Code');
      expect(emailCall.html).not.toContain('View QR Code');

      const smsCall = sendSMS.mock.calls[0][1];
      expect(smsCall).not.toContain('QR code:');
    });
  });

  describe('Withdrawal Processed Notifications with QR Codes', () => {
    beforeEach(() => {
      User.findById.mockResolvedValue(mockUser);
      sendEmail.mockResolvedValue({ success: true });
      sendSMS.mockResolvedValue({ success: true });
    });

    it('should include QR code in withdrawal processed email when QR code exists', async () => {
      const withdrawalData = {
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
        paystackReference: 'PSK123456',
        qrCode: {
          data: 'base64-withdrawal-qr-code',
          url: 'https://api.travelplace.com/qr/withdrawal/withdrawal123',
          metadata: {
            type: 'withdrawal',
            withdrawalId: 'withdrawal123',
            amount: 50000
          }
        }
      };

      await AffiliateNotificationService.sendWithdrawalProcessedNotification(withdrawalData, mockAffiliate);

      expect(sendEmail).toHaveBeenCalledWith({
        to: mockUser.email,
        subject: expect.stringContaining('Withdrawal Completed'),
        html: expect.stringContaining('https://api.travelplace.com/qr/withdrawal/withdrawal123')
      });

      // Verify QR code section is included in email
      const emailCall = sendEmail.mock.calls[0][0];
      expect(emailCall.html).toContain('Withdrawal QR Code');
      expect(emailCall.html).toContain('View QR Code');
      expect(emailCall.html).toContain('Use this QR code to quickly access withdrawal details');
    });

    it('should include QR code in withdrawal processed SMS when QR code exists', async () => {
      const withdrawalData = {
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
        paystackReference: 'PSK123456',
        qrCode: {
          data: 'base64-withdrawal-qr-code',
          url: 'https://api.travelplace.com/qr/withdrawal/withdrawal123',
          metadata: {
            type: 'withdrawal',
            withdrawalId: 'withdrawal123'
          }
        }
      };

      await AffiliateNotificationService.sendWithdrawalProcessedNotification(withdrawalData, mockAffiliate);

      expect(sendSMS).toHaveBeenCalledWith(
        mockUser.phoneNumber,
        expect.stringContaining('https://api.travelplace.com/qr/withdrawal/withdrawal123')
      );

      // Verify QR code URL is included in SMS
      const smsCall = sendSMS.mock.calls[0][1];
      expect(smsCall).toContain('QR:');
      expect(smsCall).toContain('https://api.travelplace.com/qr/withdrawal/withdrawal123');
    });
  });

  describe('Account Status Change Notifications with QR Codes', () => {
    beforeEach(() => {
      User.findById.mockResolvedValue(mockUser);
      sendEmail.mockResolvedValue({ success: true });
      sendSMS.mockResolvedValue({ success: true });
    });

    it('should include affiliate QR code in activation email when account becomes active', async () => {
      await AffiliateNotificationService.sendAccountStatusChangeNotification(mockAffiliate, 'pending', 'active');

      expect(sendEmail).toHaveBeenCalledWith({
        to: mockUser.email,
        subject: expect.stringContaining('Account Status Update - ACTIVE'),
        html: expect.stringContaining('https://api.travelplace.com/qr/affiliate/AFF-123456')
      });

      // Verify affiliate QR code section is included in email
      const emailCall = sendEmail.mock.calls[0][0];
      expect(emailCall.html).toContain('Your Affiliate QR Code');
      expect(emailCall.html).toContain('View QR Code');
      expect(emailCall.html).toContain('Share this QR code with customers');
    });

    it('should include affiliate QR code in activation SMS when account becomes active', async () => {
      await AffiliateNotificationService.sendAccountStatusChangeNotification(mockAffiliate, 'pending', 'active');

      expect(sendSMS).toHaveBeenCalledWith(
        mockUser.phoneNumber,
        expect.stringContaining('https://api.travelplace.com/qr/affiliate/AFF-123456')
      );

      // Verify QR code URL is included in SMS
      const smsCall = sendSMS.mock.calls[0][1];
      expect(smsCall).toContain('QR:');
      expect(smsCall).toContain('https://api.travelplace.com/qr/affiliate/AFF-123456');
    });

    it('should not include QR code when account is not active', async () => {
      await AffiliateNotificationService.sendAccountStatusChangeNotification(mockAffiliate, 'active', 'suspended');

      const emailCall = sendEmail.mock.calls[0][0];
      expect(emailCall.html).not.toContain('Your Affiliate QR Code');

      const smsCall = sendSMS.mock.calls[0][1];
      expect(smsCall).not.toContain('QR:');
    });

    it('should not include QR code when affiliate has no QR code', async () => {
      const affiliateWithoutQR = {
        ...mockAffiliate,
        qrCode: null
      };

      await AffiliateNotificationService.sendAccountStatusChangeNotification(affiliateWithoutQR, 'pending', 'active');

      const emailCall = sendEmail.mock.calls[0][0];
      expect(emailCall.html).not.toContain('Your Affiliate QR Code');

      const smsCall = sendSMS.mock.calls[0][1];
      expect(smsCall).not.toContain('QR:');
    });
  });

  describe('Template Generation with QR Codes', () => {
    it('should generate commission email template with QR code section', () => {
      const commissionData = {
        _id: 'commission123',
        commissionAmount: 5000,
        serviceType: 'flight',
        bookingReference: 'BK123456',
        commissionRate: 2.5,
        bookingAmount: 200000,
        qrCode: {
          url: 'https://api.travelplace.com/qr/commission/commission123'
        }
      };

      const template = AffiliateNotificationService.getCommissionEarnedEmailTemplate(commissionData, mockAffiliate);

      expect(template.html).toContain('Transaction QR Code');
      expect(template.html).toContain('https://api.travelplace.com/qr/commission/commission123');
      expect(template.html).toContain('View QR Code');
    });

    it('should generate withdrawal email template with QR code section', () => {
      const withdrawalData = {
        _id: 'withdrawal123',
        amount: 50000,
        status: 'completed',
        bankDetails: {
          accountName: 'Test Business',
          accountNumber: '1234567890',
          bankName: 'Test Bank'
        },
        createdAt: new Date(),
        qrCode: {
          url: 'https://api.travelplace.com/qr/withdrawal/withdrawal123'
        }
      };

      const template = AffiliateNotificationService.getWithdrawalProcessedEmailTemplate(withdrawalData, mockAffiliate);

      expect(template.html).toContain('Withdrawal QR Code');
      expect(template.html).toContain('https://api.travelplace.com/qr/withdrawal/withdrawal123');
      expect(template.html).toContain('View QR Code');
    });

    it('should generate account status email template with affiliate QR code section for active status', () => {
      const template = AffiliateNotificationService.getAccountStatusChangeEmailTemplate(mockAffiliate, 'pending', 'active');

      expect(template.html).toContain('Your Affiliate QR Code');
      expect(template.html).toContain('https://api.travelplace.com/qr/affiliate/AFF-123456');
      expect(template.html).toContain('View QR Code');
    });
  });

  describe('Notification Triggers Integration', () => {
    it('should handle notification sending with QR code integration gracefully', async () => {
      User.findById.mockResolvedValue(mockUser);
      sendEmail.mockResolvedValue({ success: true });
      sendSMS.mockResolvedValue({ success: true });

      const commissionData = {
        _id: 'commission123',
        commissionAmount: 5000,
        serviceType: 'flight',
        bookingReference: 'BK123456',
        commissionRate: 2.5,
        bookingAmount: 200000,
        qrCode: {
          url: 'https://api.travelplace.com/qr/commission/commission123'
        }
      };

      // This should not throw an error and should include QR code
      await expect(
        AffiliateNotificationService.sendCommissionEarnedNotification(commissionData, mockAffiliate)
      ).resolves.not.toThrow();

      expect(sendEmail).toHaveBeenCalled();
      expect(sendSMS).toHaveBeenCalled();

      // Verify QR code was included in both email and SMS
      const emailCall = sendEmail.mock.calls[0][0];
      const smsCall = sendSMS.mock.calls[0][1];
      
      expect(emailCall.html).toContain('Transaction QR Code');
      expect(smsCall).toContain('QR code:');
    });

    it('should handle missing QR codes gracefully without breaking notifications', async () => {
      User.findById.mockResolvedValue(mockUser);
      sendEmail.mockResolvedValue({ success: true });
      sendSMS.mockResolvedValue({ success: true });

      const commissionDataWithoutQR = {
        _id: 'commission123',
        commissionAmount: 5000,
        serviceType: 'flight',
        bookingReference: 'BK123456',
        commissionRate: 2.5,
        bookingAmount: 200000
        // No qrCode field
      };

      // This should not throw an error even without QR code
      await expect(
        AffiliateNotificationService.sendCommissionEarnedNotification(commissionDataWithoutQR, mockAffiliate)
      ).resolves.not.toThrow();

      expect(sendEmail).toHaveBeenCalled();
      expect(sendSMS).toHaveBeenCalled();

      // Verify notifications were sent without QR code sections
      const emailCall = sendEmail.mock.calls[0][0];
      const smsCall = sendSMS.mock.calls[0][1];
      
      expect(emailCall.html).not.toContain('Transaction QR Code');
      expect(smsCall).not.toContain('QR code:');
    });
  });
});