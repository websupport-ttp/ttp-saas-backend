// v1/services/analyticsDataProcessor.js

const Ledger = require('../models/ledgerModel');
const User = require('../models/userModel');
const Post = require('../models/postModel');
const AnalyticsCache = require('../models/analyticsCacheModel');
const AnalyticsSummary = require('../models/analyticsSummaryModel');
const logger = require('../utils/logger');
const { getDateRange } = require('../utils/analyticsHelpers');
const {
  getRevenueAnalyticsPipeline,
  getDailyRevenueTrendPipeline,
  getCustomerSegmentationPipeline,
  getBookingChannelPipeline,
  getProductPerformancePipeline,
  getPackagePerformancePipeline,
  getSeasonalityPipeline,
  getCustomerLifetimeValuePipeline,
  getMonthlyGrowthTrendPipeline,
} = require('../utils/analyticsAggregations');

/**
 * @description Analytics data processor for batch processing and pre-computation
 * Handles heavy analytics computations and stores results for faster dashboard loading
 */
class AnalyticsDataProcessor {
  
  /**
   * Process and cache revenue analytics for a given period
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {string} itemType - Optional item type filter
   * @returns {Object} Processed revenue data
   */
  static async processRevenueAnalytics(startDate, endDate, itemType = null) {
    try {
      logger.info(`Processing revenue analytics from ${startDate.toISOString()} to ${endDate.toISOString()}`);
      
      const pipeline = getRevenueAnalyticsPipeline(startDate, endDate, itemType);
      const [result] = await Ledger.aggregate(pipeline);
      
      if (!result) {
        const emptyResult = {
          totalRevenue: 0,
          totalProfit: 0,
          totalServiceCharges: 0,
          totalTransactions: 0,
          averageTransactionValue: 0,
          profitMarginPercentage: 0,
          serviceChargePercentage: 0,
          revenueByItemType: []
        };
        
        logger.info('No revenue data found for the specified period');
        return emptyResult;
      }

      // Process revenue by item type
      const revenueByType = {};
      result.revenueByItemType.forEach(item => {
        if (!revenueByType[item.itemType]) {
          revenueByType[item.itemType] = { 
            revenue: 0, 
            profit: 0, 
            serviceCharges: 0, 
            count: 0 
          };
        }
        revenueByType[item.itemType].revenue += item.amount;
        revenueByType[item.itemType].profit += item.profit;
        revenueByType[item.itemType].serviceCharges += item.serviceCharge;
        revenueByType[item.itemType].count += 1;
      });

      result.revenueByItemType = Object.entries(revenueByType).map(([type, data]) => ({
        itemType: type,
        totalRevenue: Math.round(data.revenue * 100) / 100,
        totalProfit: Math.round(data.profit * 100) / 100,
        totalServiceCharges: Math.round(data.serviceCharges * 100) / 100,
        transactionCount: data.count,
        averageValue: data.count > 0 ? Math.round((data.revenue / data.count) * 100) / 100 : 0,
        profitMarginPercentage: data.revenue > 0 ? Math.round((data.profit / data.revenue) * 10000) / 100 : 0
      }));

      // Round main metrics
      result.totalRevenue = Math.round(result.totalRevenue * 100) / 100;
      result.totalProfit = Math.round(result.totalProfit * 100) / 100;
      result.totalServiceCharges = Math.round(result.totalServiceCharges * 100) / 100;
      result.averageTransactionValue = Math.round(result.averageTransactionValue * 100) / 100;
      result.profitMarginPercentage = Math.round(result.profitMarginPercentage * 100) / 100;
      result.serviceChargePercentage = Math.round(result.serviceChargePercentage * 100) / 100;

      logger.info(`Revenue analytics processed: ${result.totalRevenue} total revenue, ${result.totalTransactions} transactions`);
      return result;
      
    } catch (error) {
      logger.error(`Error processing revenue analytics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process and cache customer behavior analytics
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Object} Processed customer data
   */
  static async processCustomerAnalytics(startDate, endDate) {
    try {
      logger.info(`Processing customer analytics from ${startDate.toISOString()} to ${endDate.toISOString()}`);
      
      const [customerSegments, bookingChannels, lifetimeValue] = await Promise.all([
        Ledger.aggregate(getCustomerSegmentationPipeline(startDate, endDate)),
        Ledger.aggregate(getBookingChannelPipeline(startDate, endDate)),
        Ledger.aggregate(getCustomerLifetimeValuePipeline(startDate, endDate))
      ]);

      // Calculate repeat customer metrics
      const repeatCustomerPipeline = [
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
            status: 'Completed',
            userId: { $ne: null }
          }
        },
        {
          $group: {
            _id: '$userId',
            transactionCount: { $sum: 1 },
            totalSpent: { $sum: '$totalAmountPaid' },
            firstPurchase: { $min: '$createdAt' },
            lastPurchase: { $max: '$createdAt' }
          }
        },
        {
          $group: {
            _id: null,
            totalCustomers: { $sum: 1 },
            newCustomers: {
              $sum: {
                $cond: [{ $eq: ['$transactionCount', 1] }, 1, 0]
              }
            },
            repeatCustomers: {
              $sum: {
                $cond: [{ $gt: ['$transactionCount', 1] }, 1, 0]
              }
            },
            averageTransactionsPerCustomer: { $avg: '$transactionCount' },
            averageCustomerValue: { $avg: '$totalSpent' }
          }
        },
        {
          $addFields: {
            repeatCustomerRate: {
              $cond: {
                if: { $gt: ['$totalCustomers', 0] },
                then: { $multiply: [{ $divide: ['$repeatCustomers', '$totalCustomers'] }, 100] },
                else: 0
              }
            }
          }
        }
      ];

      const [customerMetrics] = await Ledger.aggregate(repeatCustomerPipeline);

      const result = {
        customerSegments: customerSegments || [],
        bookingChannels: bookingChannels || [],
        lifetimeValue: lifetimeValue[0] || {
          totalCustomers: 0,
          averageLifetimeValue: 0,
          averageTransactionCount: 0,
          averageCustomerLifespan: 0,
          totalRevenue: 0,
          totalProfit: 0,
          highValueCustomers: 0,
          averageProfitPerCustomer: 0,
          highValueCustomerPercentage: 0
        },
        customerMetrics: customerMetrics || {
          totalCustomers: 0,
          newCustomers: 0,
          repeatCustomers: 0,
          repeatCustomerRate: 0,
          averageTransactionsPerCustomer: 0,
          averageCustomerValue: 0
        }
      };

      logger.info(`Customer analytics processed: ${result.customerMetrics.totalCustomers} total customers`);
      return result;
      
    } catch (error) {
      logger.error(`Error processing customer analytics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process and cache product performance analytics
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Object} Processed product data
   */
  static async processProductAnalytics(startDate, endDate) {
    try {
      logger.info(`Processing product analytics from ${startDate.toISOString()} to ${endDate.toISOString()}`);
      
      const [itemPerformance, packagePerformance, seasonalityData] = await Promise.all([
        Ledger.aggregate(getProductPerformancePipeline(startDate, endDate)),
        Ledger.aggregate(getPackagePerformancePipeline(startDate, endDate)),
        Ledger.aggregate(getSeasonalityPipeline(startDate, endDate))
      ]);

      const result = {
        itemPerformance: itemPerformance || [],
        packagePerformance: packagePerformance || [],
        seasonalityData: seasonalityData || []
      };

      logger.info(`Product analytics processed: ${result.itemPerformance.length} item types, ${result.packagePerformance.length} packages`);
      return result;
      
    } catch (error) {
      logger.error(`Error processing product analytics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process daily revenue trends
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Array} Daily trend data
   */
  static async processDailyTrends(startDate, endDate) {
    try {
      logger.info(`Processing daily trends from ${startDate.toISOString()} to ${endDate.toISOString()}`);
      
      const pipeline = getDailyRevenueTrendPipeline(startDate, endDate);
      const result = await Ledger.aggregate(pipeline);
      
      // Process and format the results
      const processedResult = result.map(day => ({
        ...day,
        date: day.date.toISOString().split('T')[0],
        dailyRevenue: Math.round(day.dailyRevenue * 100) / 100,
        dailyProfit: Math.round(day.dailyProfit * 100) / 100,
        dailyServiceCharges: Math.round(day.dailyServiceCharges * 100) / 100,
        averageTransactionValue: Math.round(day.averageTransactionValue * 100) / 100,
        profitMarginPercentage: Math.round(day.profitMarginPercentage * 100) / 100
      }));

      logger.info(`Daily trends processed: ${processedResult.length} days`);
      return processedResult;
      
    } catch (error) {
      logger.error(`Error processing daily trends: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process monthly growth trends
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Array} Monthly trend data
   */
  static async processMonthlyTrends(startDate, endDate) {
    try {
      logger.info(`Processing monthly trends from ${startDate.toISOString()} to ${endDate.toISOString()}`);
      
      const pipeline = getMonthlyGrowthTrendPipeline(startDate, endDate);
      const result = await Ledger.aggregate(pipeline);
      
      logger.info(`Monthly trends processed: ${result.length} months`);
      return result;
      
    } catch (error) {
      logger.error(`Error processing monthly trends: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate and cache comprehensive analytics summary
   * @param {string} summaryType - Type of summary ('daily', 'weekly', 'monthly', etc.)
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {Object} filters - Optional filters
   * @returns {Object} Analytics summary
   */
  static async generateAnalyticsSummary(summaryType, startDate, endDate, filters = {}) {
    try {
      logger.info(`Generating ${summaryType} analytics summary from ${startDate.toISOString()} to ${endDate.toISOString()}`);
      
      // Process all analytics data in parallel
      const [revenueData, customerData, productData, dailyTrends] = await Promise.all([
        this.processRevenueAnalytics(startDate, endDate, filters.itemType),
        this.processCustomerAnalytics(startDate, endDate),
        this.processProductAnalytics(startDate, endDate),
        this.processDailyTrends(startDate, endDate)
      ]);

      // Structure the summary data
      const summaryData = {
        summaryType,
        period: { startDate, endDate },
        filters,
        metrics: {
          revenue: {
            total: revenueData.totalRevenue,
            byItemType: revenueData.revenueByItemType.map(item => ({
              itemType: item.itemType,
              amount: item.totalRevenue,
              percentage: revenueData.totalRevenue > 0 
                ? Math.round((item.totalRevenue / revenueData.totalRevenue) * 10000) / 100 
                : 0
            })),
            growth: { amount: 0, percentage: 0, trend: 'neutral' } // Will be calculated with comparison
          },
          profit: {
            total: revenueData.totalProfit,
            margin: revenueData.profitMarginPercentage,
            byItemType: revenueData.revenueByItemType.map(item => ({
              itemType: item.itemType,
              amount: item.totalProfit,
              margin: item.profitMarginPercentage
            }))
          },
          transactions: {
            total: revenueData.totalTransactions,
            averageValue: revenueData.averageTransactionValue,
            byItemType: revenueData.revenueByItemType.map(item => ({
              itemType: item.itemType,
              count: item.transactionCount,
              averageValue: item.averageValue
            }))
          },
          customers: {
            total: customerData.customerMetrics.totalCustomers,
            new: customerData.customerMetrics.newCustomers,
            returning: customerData.customerMetrics.repeatCustomers,
            retentionRate: customerData.customerMetrics.repeatCustomerRate,
            lifetimeValue: {
              average: customerData.lifetimeValue.averageLifetimeValue,
              median: customerData.lifetimeValue.averageLifetimeValue // Simplified for now
            },
            bySegment: customerData.customerSegments.map(segment => ({
              segment: segment.segment,
              count: segment.uniqueCustomerCount,
              revenue: segment.totalRevenue,
              averageValue: segment.averageTransactionValue
            }))
          },
          performance: {
            topProducts: productData.itemPerformance.slice(0, 5).map(item => ({
              itemType: item.itemType,
              revenue: item.totalRevenue,
              profit: item.totalProfit,
              transactionCount: item.transactionCount
            })),
            topPackages: productData.packagePerformance.slice(0, 5).map(pkg => ({
              packageId: pkg.packageId,
              title: pkg.packageTitle,
              revenue: pkg.totalRevenue,
              salesCount: pkg.salesCount
            })),
            channelPerformance: customerData.bookingChannels.map(channel => ({
              channel: channel.channel,
              revenue: channel.totalRevenue,
              transactionCount: channel.transactionCount,
              conversionRate: 0 // Would need additional data to calculate
            }))
          }
        }
      };

      // Save the summary to database
      const savedSummary = await AnalyticsSummary.createOrUpdateSummary(summaryData);
      
      logger.info(`Analytics summary generated and saved with ID: ${savedSummary._id}`);
      return savedSummary;
      
    } catch (error) {
      logger.error(`Error generating analytics summary: ${error.message}`);
      throw error;
    }
  }

  /**
   * Batch process analytics for multiple periods
   * @param {Array} periods - Array of period objects with startDate and endDate
   * @param {string} summaryType - Type of summary
   * @returns {Array} Generated summaries
   */
  static async batchProcessAnalytics(periods, summaryType = 'custom') {
    try {
      logger.info(`Starting batch processing for ${periods.length} periods`);
      
      const results = [];
      
      for (const period of periods) {
        try {
          const summary = await this.generateAnalyticsSummary(
            summaryType,
            period.startDate,
            period.endDate,
            period.filters || {}
          );
          results.push(summary);
          
          // Add small delay to prevent overwhelming the database
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          logger.error(`Error processing period ${period.startDate} to ${period.endDate}: ${error.message}`);
          results.push({ error: error.message, period });
        }
      }
      
      logger.info(`Batch processing completed. ${results.length} summaries processed`);
      return results;
      
    } catch (error) {
      logger.error(`Error in batch processing: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update customer behavior data after a transaction
   * @param {string} userId - User ID
   * @param {Object} transactionData - Transaction data
   */
  static async updateCustomerBehavior(userId, transactionData) {
    try {
      if (!userId) return; // Skip for guest transactions
      
      const user = await User.findById(userId);
      if (!user) return;
      
      // Update purchase activity
      await user.updatePurchaseActivity(transactionData.totalAmountPaid);
      
      // Update preferred item types
      if (transactionData.itemType) {
        await user.updatePreferredItemTypes(transactionData.itemType);
      }
      
      logger.info(`Customer behavior updated for user ${userId}`);
      
    } catch (error) {
      logger.error(`Error updating customer behavior: ${error.message}`);
      // Don't throw error as this is a background operation
    }
  }

  /**
   * Clean up old analytics data
   * @param {number} daysToKeep - Number of days to keep (default: 90)
   */
  static async cleanupOldAnalytics(daysToKeep = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      // Clean up old cache entries
      const cacheResult = await AnalyticsCache.deleteMany({
        lastUpdated: { $lt: cutoffDate }
      });
      
      // Clean up old summaries (but keep monthly and yearly summaries longer)
      const summaryResult = await AnalyticsSummary.deleteMany({
        computedAt: { $lt: cutoffDate },
        summaryType: { $in: ['daily', 'weekly', 'custom'] }
      });
      
      logger.info(`Cleanup completed: ${cacheResult.deletedCount} cache entries, ${summaryResult.deletedCount} summaries removed`);
      
    } catch (error) {
      logger.error(`Error cleaning up old analytics: ${error.message}`);
      throw error;
    }
  }
}

module.exports = AnalyticsDataProcessor;