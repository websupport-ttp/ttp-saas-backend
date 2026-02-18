// v1/controllers/affiliateNotificationController.js
const AffiliateNotificationService = require('../services/affiliateNotificationService');
const MonthlyStatementService = require('../services/monthlyStatementService');
const { ApiError } = require('../utils/apiError');
const { StatusCodes } = require('http-status-codes');
const logger = require('../utils/logger');

/**
 * @description Controller for managing affiliate notification preferences and statements
 */
class AffiliateNotificationController {
  /**
   * Get notification preferences for an affiliate
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getNotificationPreferences(req, res) {
    try {
      const { affiliateId } = req.params;

      if (!affiliateId) {
        throw new ApiError('Affiliate ID is required', StatusCodes.BAD_REQUEST);
      }

      const preferences = await AffiliateNotificationService.getNotificationPreferences(affiliateId);

      res.status(StatusCodes.OK).json({
        success: true,
        data: preferences,
        message: 'Notification preferences retrieved successfully'
      });
    } catch (error) {
      logger.error('Error getting notification preferences:', error);

      if (error instanceof ApiError) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }

      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to get notification preferences'
      });
    }
  }

  /**
   * Update notification preferences for an affiliate
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateNotificationPreferences(req, res) {
    try {
      const { affiliateId } = req.params;
      const preferences = req.body;

      if (!affiliateId) {
        throw new ApiError('Affiliate ID is required', StatusCodes.BAD_REQUEST);
      }

      // Validate preferences structure
      const validPreferences = ['email', 'sms', 'monthlyStatements'];
      const invalidKeys = Object.keys(preferences).filter(key => !validPreferences.includes(key));

      if (invalidKeys.length > 0) {
        throw new ApiError(`Invalid preference keys: ${invalidKeys.join(', ')}`, StatusCodes.BAD_REQUEST);
      }

      // Validate preference values
      Object.entries(preferences).forEach(([key, value]) => {
        if (typeof value !== 'boolean') {
          throw new ApiError(`Preference '${key}' must be a boolean value`, StatusCodes.BAD_REQUEST);
        }
      });

      const updatedPreferences = await AffiliateNotificationService.updateNotificationPreferences(
        affiliateId,
        preferences
      );

      res.status(StatusCodes.OK).json({
        success: true,
        data: updatedPreferences,
        message: 'Notification preferences updated successfully'
      });
    } catch (error) {
      logger.error('Error updating notification preferences:', error);

      if (error instanceof ApiError) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }

      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to update notification preferences'
      });
    }
  }

  /**
   * Get monthly statement for an affiliate
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getMonthlyStatement(req, res) {
    try {
      const { affiliateId } = req.params;
      const { year, month } = req.query;

      if (!affiliateId) {
        throw new ApiError('Affiliate ID is required', StatusCodes.BAD_REQUEST);
      }

      if (!year || !month) {
        throw new ApiError('Year and month are required', StatusCodes.BAD_REQUEST);
      }

      const yearNum = parseInt(year);
      const monthNum = parseInt(month);

      if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
        throw new ApiError('Invalid year or month format', StatusCodes.BAD_REQUEST);
      }

      const statementData = await MonthlyStatementService.getStatementData(affiliateId, yearNum, monthNum);

      res.status(StatusCodes.OK).json({
        success: true,
        data: statementData,
        message: 'Monthly statement retrieved successfully'
      });
    } catch (error) {
      logger.error('Error getting monthly statement:', error);

      if (error instanceof ApiError) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }

      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to get monthly statement'
      });
    }
  }

  /**
   * Get available statement months for an affiliate
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getAvailableStatementMonths(req, res) {
    try {
      const { affiliateId } = req.params;

      if (!affiliateId) {
        throw new ApiError('Affiliate ID is required', StatusCodes.BAD_REQUEST);
      }

      const availableMonths = await MonthlyStatementService.getAvailableStatementMonths(affiliateId);

      res.status(StatusCodes.OK).json({
        success: true,
        data: availableMonths,
        message: 'Available statement months retrieved successfully'
      });
    } catch (error) {
      logger.error('Error getting available statement months:', error);

      if (error instanceof ApiError) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }

      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to get available statement months'
      });
    }
  }

  /**
   * Send monthly statement manually (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async sendMonthlyStatement(req, res) {
    try {
      const { affiliateId } = req.params;
      const { year, month } = req.body;

      if (!affiliateId) {
        throw new ApiError('Affiliate ID is required', StatusCodes.BAD_REQUEST);
      }

      if (!year || !month) {
        throw new ApiError('Year and month are required', StatusCodes.BAD_REQUEST);
      }

      const yearNum = parseInt(year);
      const monthNum = parseInt(month);

      if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
        throw new ApiError('Invalid year or month format', StatusCodes.BAD_REQUEST);
      }

      const statementData = await MonthlyStatementService.generateAndSendStatement(affiliateId, yearNum, monthNum);

      res.status(StatusCodes.OK).json({
        success: true,
        data: statementData,
        message: 'Monthly statement sent successfully'
      });
    } catch (error) {
      logger.error('Error sending monthly statement:', error);

      if (error instanceof ApiError) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }

      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to send monthly statement'
      });
    }
  }

  /**
   * Send monthly statements to all affiliates (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async sendAllMonthlyStatements(req, res) {
    try {
      const { year, month } = req.body;

      if (!year || !month) {
        throw new ApiError('Year and month are required', StatusCodes.BAD_REQUEST);
      }

      const yearNum = parseInt(year);
      const monthNum = parseInt(month);

      if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
        throw new ApiError('Invalid year or month format', StatusCodes.BAD_REQUEST);
      }

      const results = await MonthlyStatementService.generateAndSendAllStatements(yearNum, monthNum);

      res.status(StatusCodes.OK).json({
        success: true,
        data: results,
        message: `Monthly statements processed: ${results.sent} sent, ${results.failed} failed`
      });
    } catch (error) {
      logger.error('Error sending all monthly statements:', error);

      if (error instanceof ApiError) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }

      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to send monthly statements'
      });
    }
  }
}

module.exports = AffiliateNotificationController;