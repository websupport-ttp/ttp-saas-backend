// v1/test/controllers/affiliateNotificationController.test.js
const AffiliateNotificationController = require('../../controllers/affiliateNotificationController');
const AffiliateNotificationService = require('../../services/affiliateNotificationService');
const MonthlyStatementService = require('../../services/monthlyStatementService');
const { StatusCodes } = require('http-status-codes');

// Mock dependencies
jest.mock('../../services/affiliateNotificationService');
jest.mock('../../services/monthlyStatementService');

describe('AffiliateNotificationController', () => {
  let req, res;

  beforeEach(() => {
    req = {
      params: {},
      query: {},
      body: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    jest.clearAllMocks();
  });

  describe('getNotificationPreferences', () => {
    it('should get notification preferences successfully', async () => {
      req.params.affiliateId = 'affiliate123';
      const mockPreferences = {
        email: true,
        sms: false,
        monthlyStatements: true
      };

      AffiliateNotificationService.getNotificationPreferences.mockResolvedValue(mockPreferences);

      await AffiliateNotificationController.getNotificationPreferences(req, res);

      expect(AffiliateNotificationService.getNotificationPreferences).toHaveBeenCalledWith('affiliate123');
      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockPreferences,
        message: 'Notification preferences retrieved successfully'
      });
    });

    it('should handle missing affiliate ID', async () => {
      req.params.affiliateId = undefined;

      await AffiliateNotificationController.getNotificationPreferences(req, res);

      expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Affiliate ID is required'
      });
    });

    it('should handle service errors', async () => {
      req.params.affiliateId = 'affiliate123';
      AffiliateNotificationService.getNotificationPreferences.mockRejectedValue(new Error('Service error'));

      await AffiliateNotificationController.getNotificationPreferences(req, res);

      expect(res.status).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to get notification preferences'
      });
    });
  });

  describe('updateNotificationPreferences', () => {
    it('should update notification preferences successfully', async () => {
      req.params.affiliateId = 'affiliate123';
      req.body = {
        email: false,
        sms: true,
        monthlyStatements: true
      };

      const updatedPreferences = req.body;
      AffiliateNotificationService.updateNotificationPreferences.mockResolvedValue(updatedPreferences);

      await AffiliateNotificationController.updateNotificationPreferences(req, res);

      expect(AffiliateNotificationService.updateNotificationPreferences).toHaveBeenCalledWith('affiliate123', req.body);
      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: updatedPreferences,
        message: 'Notification preferences updated successfully'
      });
    });

    it('should handle missing affiliate ID', async () => {
      req.params.affiliateId = undefined;
      req.body = { email: false };

      await AffiliateNotificationController.updateNotificationPreferences(req, res);

      expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Affiliate ID is required'
      });
    });

    it('should validate preference keys', async () => {
      req.params.affiliateId = 'affiliate123';
      req.body = {
        email: true,
        invalidKey: false
      };

      await AffiliateNotificationController.updateNotificationPreferences(req, res);

      expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid preference keys: invalidKey'
      });
    });

    it('should validate preference values are boolean', async () => {
      req.params.affiliateId = 'affiliate123';
      req.body = {
        email: 'true', // Should be boolean
        sms: false
      };

      await AffiliateNotificationController.updateNotificationPreferences(req, res);

      expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Preference 'email' must be a boolean value"
      });
    });
  });

  describe('getMonthlyStatement', () => {
    it('should get monthly statement successfully', async () => {
      req.params.affiliateId = 'affiliate123';
      req.query = { year: '2024', month: '1' };

      const mockStatementData = {
        month: 'January',
        year: 2024,
        totalCommissions: 25000
      };

      MonthlyStatementService.getStatementData.mockResolvedValue(mockStatementData);

      await AffiliateNotificationController.getMonthlyStatement(req, res);

      expect(MonthlyStatementService.getStatementData).toHaveBeenCalledWith('affiliate123', 2024, 1);
      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockStatementData,
        message: 'Monthly statement retrieved successfully'
      });
    });

    it('should handle missing parameters', async () => {
      req.params.affiliateId = 'affiliate123';
      req.query = { year: '2024' }; // Missing month

      await AffiliateNotificationController.getMonthlyStatement(req, res);

      expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Year and month are required'
      });
    });

    it('should validate year and month format', async () => {
      req.params.affiliateId = 'affiliate123';
      req.query = { year: 'invalid', month: '13' };

      await AffiliateNotificationController.getMonthlyStatement(req, res);

      expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid year or month format'
      });
    });
  });

  describe('getAvailableStatementMonths', () => {
    it('should get available statement months successfully', async () => {
      req.params.affiliateId = 'affiliate123';

      const mockAvailableMonths = [
        { year: 2024, month: 1, monthName: 'January' },
        { year: 2023, month: 12, monthName: 'December' }
      ];

      MonthlyStatementService.getAvailableStatementMonths.mockResolvedValue(mockAvailableMonths);

      await AffiliateNotificationController.getAvailableStatementMonths(req, res);

      expect(MonthlyStatementService.getAvailableStatementMonths).toHaveBeenCalledWith('affiliate123');
      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockAvailableMonths,
        message: 'Available statement months retrieved successfully'
      });
    });

    it('should handle missing affiliate ID', async () => {
      req.params.affiliateId = undefined;

      await AffiliateNotificationController.getAvailableStatementMonths(req, res);

      expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Affiliate ID is required'
      });
    });
  });

  describe('sendMonthlyStatement', () => {
    it('should send monthly statement successfully', async () => {
      req.params.affiliateId = 'affiliate123';
      req.body = { year: 2024, month: 1 };

      const mockStatementData = {
        month: 'January',
        year: 2024,
        totalCommissions: 25000
      };

      MonthlyStatementService.generateAndSendStatement.mockResolvedValue(mockStatementData);

      await AffiliateNotificationController.sendMonthlyStatement(req, res);

      expect(MonthlyStatementService.generateAndSendStatement).toHaveBeenCalledWith('affiliate123', 2024, 1);
      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockStatementData,
        message: 'Monthly statement sent successfully'
      });
    });

    it('should handle missing parameters', async () => {
      req.params.affiliateId = 'affiliate123';
      req.body = { year: 2024 }; // Missing month

      await AffiliateNotificationController.sendMonthlyStatement(req, res);

      expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Year and month are required'
      });
    });
  });

  describe('sendAllMonthlyStatements', () => {
    it('should send all monthly statements successfully', async () => {
      req.body = { year: 2024, month: 1 };

      const mockResults = {
        total: 10,
        sent: 8,
        failed: 2,
        errors: []
      };

      MonthlyStatementService.generateAndSendAllStatements.mockResolvedValue(mockResults);

      await AffiliateNotificationController.sendAllMonthlyStatements(req, res);

      expect(MonthlyStatementService.generateAndSendAllStatements).toHaveBeenCalledWith(2024, 1);
      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockResults,
        message: 'Monthly statements processed: 8 sent, 2 failed'
      });
    });

    it('should handle missing parameters', async () => {
      req.body = { year: 2024 }; // Missing month

      await AffiliateNotificationController.sendAllMonthlyStatements(req, res);

      expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Year and month are required'
      });
    });

    it('should validate year and month format', async () => {
      req.body = { year: 'invalid', month: 13 };

      await AffiliateNotificationController.sendAllMonthlyStatements(req, res);

      expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid year or month format'
      });
    });
  });
});