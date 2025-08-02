// v1/services/monthlyStatementService.js
const Affiliate = require('../models/affiliateModel');
const CommissionTransaction = require('../models/commissionTransactionModel');
const Withdrawal = require('../models/withdrawalModel');
const Wallet = require('../models/walletModel');
const AffiliateNotificationService = require('./affiliateNotificationService');
const logger = require('../utils/logger');

/**
 * @class MonthlyStatementService
 * @description Service for generating and sending monthly affiliate statements
 */
class MonthlyStatementService {
  /**
   * Generate monthly statement data for an affiliate
   * @param {string} affiliateId - Affiliate ID
   * @param {number} year - Year for the statement
   * @param {number} month - Month for the statement (1-12)
   * @returns {Object} Statement data
   */
  static async generateStatementData(affiliateId, year, month) {
    try {
      const affiliate = await Affiliate.findById(affiliateId);
      if (!affiliate) {
        throw new Error('Affiliate not found');
      }

      // Calculate date range for the month
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59, 999);

      // Get commission transactions for the month
      const commissions = await CommissionTransaction.find({
        affiliateId,
        createdAt: { $gte: startDate, $lte: endDate }
      });

      // Get withdrawals for the month
      const withdrawals = await Withdrawal.find({
        affiliateId,
        createdAt: { $gte: startDate, $lte: endDate },
        status: 'completed'
      });

      // Get current wallet balance
      const wallet = await Wallet.findOne({ affiliateId });
      const currentBalance = wallet ? wallet.balance : 0;

      // Calculate totals
      const totalCommissions = commissions.reduce((sum, commission) => {
        return sum + (commission.status === 'approved' || commission.status === 'paid' ? commission.commissionAmount : 0);
      }, 0);

      const totalWithdrawals = withdrawals.reduce((sum, withdrawal) => {
        return sum + withdrawal.amount;
      }, 0);

      // Calculate commission breakdown by service type
      const commissionsByService = commissions.reduce((breakdown, commission) => {
        if (commission.status === 'approved' || commission.status === 'paid') {
          breakdown[commission.serviceType] = (breakdown[commission.serviceType] || 0) + commission.commissionAmount;
        }
        return breakdown;
      }, {});

      // Count successful bookings (commissions that were approved/paid)
      const successfulBookings = commissions.filter(c => 
        c.status === 'approved' || c.status === 'paid'
      ).length;

      // Get referral count for the month (this would need referral tracking data)
      // For now, we'll use successful bookings as a proxy
      const totalReferrals = successfulBookings;

      const statementData = {
        affiliateId: affiliate._id,
        affiliateName: affiliate.businessName,
        month: this.getMonthName(month),
        year,
        totalReferrals,
        successfulBookings,
        totalCommissions,
        totalWithdrawals,
        currentBalance,
        commissionsByService,
        commissionTransactions: commissions.map(c => ({
          id: c._id,
          bookingReference: c.bookingReference,
          serviceType: c.serviceType,
          amount: c.commissionAmount,
          status: c.status,
          date: c.createdAt
        })),
        withdrawalTransactions: withdrawals.map(w => ({
          id: w._id,
          amount: w.amount,
          status: w.status,
          date: w.createdAt
        }))
      };

      return statementData;
    } catch (error) {
      logger.error(`Error generating statement data for affiliate ${affiliateId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate and send monthly statements for all active affiliates
   * @param {number} year - Year for the statement
   * @param {number} month - Month for the statement (1-12)
   */
  static async generateAndSendAllStatements(year, month) {
    try {
      const activeAffiliates = await Affiliate.findActive();
      const results = {
        total: activeAffiliates.length,
        sent: 0,
        failed: 0,
        errors: []
      };

      for (const affiliate of activeAffiliates) {
        try {
          await this.generateAndSendStatement(affiliate._id, year, month);
          results.sent++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            affiliateId: affiliate._id,
            error: error.message
          });
          logger.error(`Failed to send statement to affiliate ${affiliate.affiliateId}: ${error.message}`);
        }
      }

      logger.info(`Monthly statements processed: ${results.sent} sent, ${results.failed} failed`);
      return results;
    } catch (error) {
      logger.error(`Error generating monthly statements: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate and send monthly statement for a specific affiliate
   * @param {string} affiliateId - Affiliate ID
   * @param {number} year - Year for the statement
   * @param {number} month - Month for the statement (1-12)
   */
  static async generateAndSendStatement(affiliateId, year, month) {
    try {
      const affiliate = await Affiliate.findById(affiliateId);
      if (!affiliate) {
        throw new Error('Affiliate not found');
      }

      const statementData = await this.generateStatementData(affiliateId, year, month);
      
      // Send the statement via notification service
      await AffiliateNotificationService.sendMonthlyStatement(affiliate, statementData);

      logger.info(`Monthly statement sent to affiliate ${affiliate.affiliateId} for ${month}/${year}`);
      return statementData;
    } catch (error) {
      logger.error(`Error sending monthly statement to affiliate ${affiliateId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Schedule monthly statement generation (to be called by a cron job)
   * This would typically be called on the 1st of each month for the previous month
   */
  static async scheduleMonthlyStatements() {
    try {
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const year = lastMonth.getFullYear();
      const month = lastMonth.getMonth() + 1;

      logger.info(`Starting scheduled monthly statement generation for ${month}/${year}`);
      
      const results = await this.generateAndSendAllStatements(year, month);
      
      logger.info(`Scheduled monthly statement generation completed: ${JSON.stringify(results)}`);
      return results;
    } catch (error) {
      logger.error(`Error in scheduled monthly statement generation: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get month name from month number
   * @param {number} month - Month number (1-12)
   * @returns {string} Month name
   */
  static getMonthName(month) {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1];
  }

  /**
   * Get statement data for a specific affiliate and month (for admin/affiliate dashboard)
   * @param {string} affiliateId - Affiliate ID
   * @param {number} year - Year
   * @param {number} month - Month (1-12)
   * @returns {Object} Statement data
   */
  static async getStatementData(affiliateId, year, month) {
    return this.generateStatementData(affiliateId, year, month);
  }

  /**
   * Get available statement months for an affiliate
   * @param {string} affiliateId - Affiliate ID
   * @returns {Array} Array of available months with year and month
   */
  static async getAvailableStatementMonths(affiliateId) {
    try {
      const affiliate = await Affiliate.findById(affiliateId);
      if (!affiliate) {
        throw new Error('Affiliate not found');
      }

      // Get the earliest commission transaction date
      const earliestCommission = await CommissionTransaction.findOne({
        affiliateId
      }).sort({ createdAt: 1 });

      if (!earliestCommission) {
        return [];
      }

      const startDate = new Date(earliestCommission.createdAt);
      const currentDate = new Date();
      const months = [];

      // Generate list of months from first commission to current month
      let iterDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      
      while (iterDate <= currentDate) {
        months.push({
          year: iterDate.getFullYear(),
          month: iterDate.getMonth() + 1,
          monthName: this.getMonthName(iterDate.getMonth() + 1)
        });
        
        iterDate.setMonth(iterDate.getMonth() + 1);
      }

      return months.reverse(); // Most recent first
    } catch (error) {
      logger.error(`Error getting available statement months for affiliate ${affiliateId}: ${error.message}`);
      throw error;
    }
  }
}

module.exports = MonthlyStatementService;