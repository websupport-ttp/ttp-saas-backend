// v1/services/analyticsService.js
const Ledger = require('../models/ledgerModel');
const User = require('../models/userModel');
const Post = require('../models/postModel');
const AnalyticsCache = require('../models/analyticsCacheModel');
const Affiliate = require('../models/affiliateModel');
const CommissionTransaction = require('../models/commissionTransactionModel');
const Referral = require('../models/referralModel');

/**
 * @description Analytics service for generating business intelligence data
 * Implements MongoDB aggregation pipelines for revenue, customer, and product analytics
 */
class AnalyticsService {
  
  /**
   * Get revenue analytics with date range filtering
   * @param {Date} startDate - Start date for analysis
   * @param {Date} endDate - End date for analysis
   * @param {string} itemType - Optional filter by item type
   * @returns {Object} Revenue analytics data
   */
  static async getRevenueAnalytics(startDate, endDate, itemType = null) {
    const cacheKey = `revenue_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}_${itemType || 'all'}`;
    
    // Check cache first
    const cached = await AnalyticsCache.getCache(cacheKey);
    if (cached) {
      return cached;
    }

    const matchStage = {
      createdAt: { $gte: startDate, $lte: endDate },
      status: 'Completed'
    };

    if (itemType) {
      matchStage.itemType = itemType;
    }

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmountPaid' },
          totalProfit: { $sum: '$profitMargin' },
          totalServiceCharges: { $sum: '$serviceCharge' },
          totalTransactions: { $sum: 1 },
          averageTransactionValue: { $avg: '$totalAmountPaid' },
          revenueByItemType: {
            $push: {
              itemType: '$itemType',
              amount: '$totalAmountPaid',
              profit: '$profitMargin'
            }
          }
        }
      },
      {
        $addFields: {
          profitMarginPercentage: {
            $cond: {
              if: { $gt: ['$totalRevenue', 0] },
              then: { $multiply: [{ $divide: ['$totalProfit', '$totalRevenue'] }, 100] },
              else: 0
            }
          }
        }
      }
    ];

    const [result] = await Ledger.aggregate(pipeline);
    
    if (!result) {
      const emptyResult = {
        totalRevenue: 0,
        totalProfit: 0,
        totalServiceCharges: 0,
        totalTransactions: 0,
        averageTransactionValue: 0,
        profitMarginPercentage: 0,
        revenueByItemType: []
      };
      
      // Cache empty result for shorter time
      await AnalyticsCache.setCache(cacheKey, emptyResult, 15, 'revenue');
      return emptyResult;
    }

    // Process revenue by item type
    const revenueByType = {};
    result.revenueByItemType.forEach(item => {
      if (!revenueByType[item.itemType]) {
        revenueByType[item.itemType] = { revenue: 0, profit: 0, count: 0 };
      }
      revenueByType[item.itemType].revenue += item.amount;
      revenueByType[item.itemType].profit += item.profit;
      revenueByType[item.itemType].count += 1;
    });

    result.revenueByItemType = Object.entries(revenueByType).map(([type, data]) => ({
      itemType: type,
      totalRevenue: data.revenue,
      totalProfit: data.profit,
      transactionCount: data.count,
      averageValue: data.count > 0 ? data.revenue / data.count : 0
    }));

    // Cache result for 1 hour
    await AnalyticsCache.setCache(cacheKey, result, 60, 'revenue');
    
    return result;
  }

  /**
   * Get daily revenue trend for a date range
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Array} Daily revenue data
   */
  static async getDailyRevenueTrend(startDate, endDate) {
    const cacheKey = `daily_revenue_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}`;
    
    const cached = await AnalyticsCache.getCache(cacheKey);
    if (cached) {
      return cached;
    }

    const pipeline = [
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'Completed'
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          dailyRevenue: { $sum: '$totalAmountPaid' },
          dailyProfit: { $sum: '$profitMargin' },
          transactionCount: { $sum: 1 },
          averageTransactionValue: { $avg: '$totalAmountPaid' }
        }
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: '$_id.day'
            }
          }
        }
      },
      { $sort: { date: 1 } },
      {
        $project: {
          _id: 0,
          date: 1,
          dailyRevenue: 1,
          dailyProfit: 1,
          transactionCount: 1,
          averageTransactionValue: 1,
          profitMarginPercentage: {
            $cond: {
              if: { $gt: ['$dailyRevenue', 0] },
              then: { $multiply: [{ $divide: ['$dailyProfit', '$dailyRevenue'] }, 100] },
              else: 0
            }
          }
        }
      }
    ];

    const result = await Ledger.aggregate(pipeline);
    
    // Cache for 2 hours
    await AnalyticsCache.setCache(cacheKey, result, 120, 'revenue');
    
    return result;
  }

  /**
   * Get customer behavior analytics
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Object} Customer behavior data
   */
  static async getCustomerBehaviorAnalytics(startDate, endDate) {
    const cacheKey = `customer_behavior_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}`;
    
    const cached = await AnalyticsCache.getCache(cacheKey);
    if (cached) {
      return cached;
    }

    // Customer segmentation analysis
    const customerSegmentPipeline = [
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'Completed'
        }
      },
      {
        $group: {
          _id: '$customerSegment',
          totalRevenue: { $sum: '$totalAmountPaid' },
          totalProfit: { $sum: '$profitMargin' },
          transactionCount: { $sum: 1 },
          averageTransactionValue: { $avg: '$totalAmountPaid' }
        }
      },
      {
        $project: {
          segment: '$_id',
          totalRevenue: 1,
          totalProfit: 1,
          transactionCount: 1,
          averageTransactionValue: 1,
          _id: 0
        }
      }
    ];

    // Booking channel analysis
    const bookingChannelPipeline = [
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'Completed'
        }
      },
      {
        $group: {
          _id: '$bookingChannel',
          totalRevenue: { $sum: '$totalAmountPaid' },
          transactionCount: { $sum: 1 },
          averageTransactionValue: { $avg: '$totalAmountPaid' }
        }
      },
      {
        $project: {
          channel: '$_id',
          totalRevenue: 1,
          transactionCount: 1,
          averageTransactionValue: 1,
          _id: 0
        }
      }
    ];

    // Repeat customer analysis
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

    const [customerSegments, bookingChannels, customerMetrics] = await Promise.all([
      Ledger.aggregate(customerSegmentPipeline),
      Ledger.aggregate(bookingChannelPipeline),
      Ledger.aggregate(repeatCustomerPipeline)
    ]);

    const result = {
      customerSegments: customerSegments || [],
      bookingChannels: bookingChannels || [],
      customerMetrics: customerMetrics[0] || {
        totalCustomers: 0,
        newCustomers: 0,
        repeatCustomers: 0,
        repeatCustomerRate: 0,
        averageTransactionsPerCustomer: 0,
        averageCustomerValue: 0
      }
    };

    // Cache for 1 hour
    await AnalyticsCache.setCache(cacheKey, result, 60, 'customer');
    
    return result;
  }

  /**
   * Get product performance analytics
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Object} Product performance data
   */
  static async getProductPerformanceAnalytics(startDate, endDate) {
    const cacheKey = `product_performance_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}`;
    
    const cached = await AnalyticsCache.getCache(cacheKey);
    if (cached) {
      return cached;
    }

    // Item type performance
    const itemPerformancePipeline = [
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'Completed'
        }
      },
      {
        $group: {
          _id: '$itemType',
          totalRevenue: { $sum: '$totalAmountPaid' },
          totalProfit: { $sum: '$profitMargin' },
          transactionCount: { $sum: 1 },
          averageTransactionValue: { $avg: '$totalAmountPaid' },
          averageProfit: { $avg: '$profitMargin' }
        }
      },
      {
        $addFields: {
          profitMarginPercentage: {
            $cond: {
              if: { $gt: ['$totalRevenue', 0] },
              then: { $multiply: [{ $divide: ['$totalProfit', '$totalRevenue'] }, 100] },
              else: 0
            }
          }
        }
      },
      {
        $project: {
          itemType: '$_id',
          totalRevenue: 1,
          totalProfit: 1,
          transactionCount: 1,
          averageTransactionValue: 1,
          averageProfit: 1,
          profitMarginPercentage: 1,
          _id: 0
        }
      },
      { $sort: { totalRevenue: -1 } }
    ];

    // Package performance (if any packages exist)
    const packagePerformancePipeline = [
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'Completed',
          itemType: 'Package',
          packageId: { $ne: null }
        }
      },
      {
        $lookup: {
          from: 'posts',
          localField: 'packageId',
          foreignField: '_id',
          as: 'packageDetails'
        }
      },
      {
        $unwind: '$packageDetails'
      },
      {
        $group: {
          _id: '$packageId',
          packageTitle: { $first: '$packageDetails.title' },
          totalRevenue: { $sum: '$totalAmountPaid' },
          totalProfit: { $sum: '$profitMargin' },
          salesCount: { $sum: 1 },
          averagePrice: { $avg: '$totalAmountPaid' }
        }
      },
      {
        $project: {
          packageId: '$_id',
          packageTitle: 1,
          totalRevenue: 1,
          totalProfit: 1,
          salesCount: 1,
          averagePrice: 1,
          _id: 0
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 }
    ];

    // Seasonality analysis
    const seasonalityPipeline = [
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'Completed'
        }
      },
      {
        $group: {
          _id: '$seasonality',
          totalRevenue: { $sum: '$totalAmountPaid' },
          transactionCount: { $sum: 1 },
          averageTransactionValue: { $avg: '$totalAmountPaid' }
        }
      },
      {
        $project: {
          season: '$_id',
          totalRevenue: 1,
          transactionCount: 1,
          averageTransactionValue: 1,
          _id: 0
        }
      }
    ];

    const [itemPerformance, packagePerformance, seasonalityData] = await Promise.all([
      Ledger.aggregate(itemPerformancePipeline),
      Ledger.aggregate(packagePerformancePipeline),
      Ledger.aggregate(seasonalityPipeline)
    ]);

    const result = {
      itemPerformance: itemPerformance || [],
      packagePerformance: packagePerformance || [],
      seasonalityData: seasonalityData || []
    };

    // Cache for 1 hour
    await AnalyticsCache.setCache(cacheKey, result, 60, 'product');
    
    return result;
  }

  /**
   * Get comprehensive dashboard data
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Object} Complete dashboard analytics
   */
  static async getDashboardAnalytics(startDate, endDate) {
    const cacheKey = `dashboard_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}`;
    
    const cached = await AnalyticsCache.getCache(cacheKey);
    if (cached) {
      return cached;
    }

    const [revenueData, customerData, productData, dailyTrend, affiliateOverview] = await Promise.all([
      this.getRevenueAnalytics(startDate, endDate),
      this.getCustomerBehaviorAnalytics(startDate, endDate),
      this.getProductPerformanceAnalytics(startDate, endDate),
      this.getDailyRevenueTrend(startDate, endDate),
      this.getAffiliateOverviewMetrics(startDate, endDate)
    ]);

    const result = {
      overview: {
        totalRevenue: revenueData.totalRevenue,
        totalProfit: revenueData.totalProfit,
        totalTransactions: revenueData.totalTransactions,
        averageTransactionValue: revenueData.averageTransactionValue,
        profitMarginPercentage: revenueData.profitMarginPercentage
      },
      revenue: revenueData,
      customers: customerData,
      products: productData,
      affiliates: affiliateOverview,
      trends: {
        daily: dailyTrend
      },
      generatedAt: new Date()
    };

    // Cache dashboard data for 30 minutes
    await AnalyticsCache.setCache(cacheKey, result, 30, 'general');
    
    return result;
  }

  /**
   * Get real-time metrics (not cached)
   * @returns {Object} Real-time system metrics
   */
  static async getRealTimeMetrics() {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    const [todayStats, totalStats, recentTransactions] = await Promise.all([
      // Today's stats
      Ledger.aggregate([
        {
          $match: {
            createdAt: { $gte: startOfDay },
            status: 'Completed'
          }
        },
        {
          $group: {
            _id: null,
            todayRevenue: { $sum: '$totalAmountPaid' },
            todayTransactions: { $sum: 1 }
          }
        }
      ]),
      
      // Total stats
      Ledger.aggregate([
        {
          $match: { status: 'Completed' }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$totalAmountPaid' },
            totalTransactions: { $sum: 1 }
          }
        }
      ]),
      
      // Recent transactions
      Ledger.find({ status: 'Completed' })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('itemType totalAmountPaid createdAt transactionReference')
    ]);

    return {
      today: todayStats[0] || { todayRevenue: 0, todayTransactions: 0 },
      total: totalStats[0] || { totalRevenue: 0, totalTransactions: 0 },
      recentTransactions: recentTransactions || [],
      lastUpdated: new Date()
    };
  }

  /**
   * Get affiliate performance analytics
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {string} affiliateId - Optional filter by specific affiliate
   * @returns {Object} Affiliate performance data
   */
  static async getAffiliatePerformanceAnalytics(startDate, endDate, affiliateId = null) {
    const cacheKey = `affiliate_performance_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}_${affiliateId || 'all'}`;
    
    const cached = await AnalyticsCache.getCache(cacheKey);
    if (cached) {
      return cached;
    }

    const matchStage = {
      createdAt: { $gte: startDate, $lte: endDate }
    };

    if (affiliateId) {
      matchStage.affiliateId = affiliateId;
    }

    // Affiliate performance aggregation
    const affiliatePerformancePipeline = [
      {
        $lookup: {
          from: 'affiliates',
          localField: 'affiliateId',
          foreignField: '_id',
          as: 'affiliate'
        }
      },
      {
        $unwind: '$affiliate'
      },
      {
        $lookup: {
          from: 'commissiontransactions',
          localField: 'affiliateId',
          foreignField: 'affiliateId',
          as: 'commissions'
        }
      },
      {
        $match: matchStage
      },
      {
        $group: {
          _id: '$affiliateId',
          affiliateName: { $first: '$affiliate.businessName' },
          affiliateCode: { $first: '$affiliate.referralCode' },
          totalReferrals: { $sum: 1 },
          totalBookingValue: { $sum: '$totalValue' },
          totalCommissionsEarned: {
            $sum: {
              $reduce: {
                input: '$commissions',
                initialValue: 0,
                in: {
                  $cond: {
                    if: { $eq: ['$$this.status', 'approved'] },
                    then: { $add: ['$$value', '$$this.commissionAmount'] },
                    else: '$$value'
                  }
                }
              }
            }
          },
          averageBookingValue: { $avg: '$totalValue' },
          convertedReferrals: { $sum: { $cond: [{ $gt: ['$totalBookings', 0] }, 1, 0] } },
          totalReferralsCount: { $sum: 1 }
        }
      },
      {
        $addFields: {
          conversionRate: {
            $cond: {
              if: { $gt: ['$totalReferralsCount', 0] },
              then: { $multiply: [{ $divide: ['$convertedReferrals', '$totalReferralsCount'] }, 100] },
              else: 0
            }
          },
          averageCommissionPerReferral: {
            $cond: {
              if: { $gt: ['$totalReferrals', 0] },
              then: { $divide: ['$totalCommissionsEarned', '$totalReferrals'] },
              else: 0
            }
          }
        }
      },
      { $sort: { totalCommissionsEarned: -1 } }
    ];

    // Top performing affiliates
    const topAffiliates = await Referral.aggregate(affiliatePerformancePipeline);

    // Commission analytics
    const commissionAnalyticsPipeline = [
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          ...(affiliateId && { affiliateId })
        }
      },
      {
        $group: {
          _id: null,
          totalCommissions: { $sum: '$commissionAmount' },
          totalApprovedCommissions: {
            $sum: {
              $cond: [{ $eq: ['$status', 'approved'] }, '$commissionAmount', 0]
            }
          },
          totalPendingCommissions: {
            $sum: {
              $cond: [{ $eq: ['$status', 'pending'] }, '$commissionAmount', 0]
            }
          },
          totalCommissionTransactions: { $sum: 1 },
          averageCommissionAmount: { $avg: '$commissionAmount' },
          commissionsByService: {
            $push: {
              serviceType: '$serviceType',
              amount: '$commissionAmount',
              status: '$status'
            }
          }
        }
      }
    ];

    const [commissionStats] = await CommissionTransaction.aggregate(commissionAnalyticsPipeline);

    // Process commission by service type
    let commissionsByService = {};
    if (commissionStats && commissionStats.commissionsByService) {
      commissionStats.commissionsByService.forEach(item => {
        if (!commissionsByService[item.serviceType]) {
          commissionsByService[item.serviceType] = {
            total: 0,
            approved: 0,
            pending: 0,
            count: 0
          };
        }
        commissionsByService[item.serviceType].total += item.amount;
        commissionsByService[item.serviceType].count += 1;
        if (item.status === 'approved') {
          commissionsByService[item.serviceType].approved += item.amount;
        } else if (item.status === 'pending') {
          commissionsByService[item.serviceType].pending += item.amount;
        }
      });
    }

    const result = {
      topAffiliates: topAffiliates || [],
      commissionStats: commissionStats || {
        totalCommissions: 0,
        totalApprovedCommissions: 0,
        totalPendingCommissions: 0,
        totalCommissionTransactions: 0,
        averageCommissionAmount: 0
      },
      commissionsByService: Object.entries(commissionsByService).map(([service, data]) => ({
        serviceType: service,
        totalCommissions: data.total,
        approvedCommissions: data.approved,
        pendingCommissions: data.pending,
        transactionCount: data.count,
        averageCommission: data.count > 0 ? data.total / data.count : 0
      }))
    };

    // Cache for 1 hour
    await AnalyticsCache.setCache(cacheKey, result, 60, 'affiliate');
    
    return result;
  }

  /**
   * Get affiliate revenue analytics
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Object} Affiliate revenue data
   */
  static async getAffiliateRevenueAnalytics(startDate, endDate) {
    const cacheKey = `affiliate_revenue_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}`;
    
    const cached = await AnalyticsCache.getCache(cacheKey);
    if (cached) {
      return cached;
    }

    // Revenue generated through affiliate referrals
    const affiliateRevenuePipeline = [
      {
        $lookup: {
          from: 'ledgers',
          let: { customerId: '$customerId' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$userId', '$$customerId'] },
                createdAt: { $gte: startDate, $lte: endDate },
                status: 'Completed'
              }
            }
          ],
          as: 'bookings'
        }
      },
      {
        $unwind: '$bookings'
      },
      {
        $lookup: {
          from: 'affiliates',
          localField: 'affiliateId',
          foreignField: '_id',
          as: 'affiliate'
        }
      },
      {
        $unwind: '$affiliate'
      },
      {
        $group: {
          _id: null,
          totalAffiliateRevenue: { $sum: '$bookings.totalAmountPaid' },
          totalAffiliateProfit: { $sum: '$bookings.profitMargin' },
          totalAffiliateBookings: { $sum: 1 },
          averageAffiliateBookingValue: { $avg: '$bookings.totalAmountPaid' },
          revenueByService: {
            $push: {
              serviceType: '$bookings.itemType',
              revenue: '$bookings.totalAmountPaid',
              profit: '$bookings.profitMargin'
            }
          }
        }
      }
    ];

    const [affiliateRevenueData] = await Referral.aggregate(affiliateRevenuePipeline);

    // Process revenue by service type
    let revenueByService = {};
    if (affiliateRevenueData && affiliateRevenueData.revenueByService) {
      affiliateRevenueData.revenueByService.forEach(item => {
        if (!revenueByService[item.serviceType]) {
          revenueByService[item.serviceType] = {
            revenue: 0,
            profit: 0,
            count: 0
          };
        }
        revenueByService[item.serviceType].revenue += item.revenue;
        revenueByService[item.serviceType].profit += item.profit;
        revenueByService[item.serviceType].count += 1;
      });
    }

    // Get total revenue for comparison
    const totalRevenuePipeline = [
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'Completed'
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmountPaid' },
          totalProfit: { $sum: '$profitMargin' },
          totalBookings: { $sum: 1 }
        }
      }
    ];

    const [totalRevenueData] = await Ledger.aggregate(totalRevenuePipeline);

    const result = {
      affiliateRevenue: affiliateRevenueData || {
        totalAffiliateRevenue: 0,
        totalAffiliateProfit: 0,
        totalAffiliateBookings: 0,
        averageAffiliateBookingValue: 0
      },
      totalRevenue: totalRevenueData || {
        totalRevenue: 0,
        totalProfit: 0,
        totalBookings: 0
      },
      affiliateContribution: {
        revenuePercentage: totalRevenueData && totalRevenueData.totalRevenue > 0 
          ? ((affiliateRevenueData?.totalAffiliateRevenue || 0) / totalRevenueData.totalRevenue * 100).toFixed(2)
          : 0,
        profitPercentage: totalRevenueData && totalRevenueData.totalProfit > 0
          ? ((affiliateRevenueData?.totalAffiliateProfit || 0) / totalRevenueData.totalProfit * 100).toFixed(2)
          : 0,
        bookingPercentage: totalRevenueData && totalRevenueData.totalBookings > 0
          ? ((affiliateRevenueData?.totalAffiliateBookings || 0) / totalRevenueData.totalBookings * 100).toFixed(2)
          : 0
      },
      revenueByService: Object.entries(revenueByService).map(([service, data]) => ({
        serviceType: service,
        revenue: data.revenue,
        profit: data.profit,
        bookingCount: data.count,
        averageBookingValue: data.count > 0 ? data.revenue / data.count : 0
      }))
    };

    // Cache for 1 hour
    await AnalyticsCache.setCache(cacheKey, result, 60, 'affiliate');
    
    return result;
  }

  /**
   * Get affiliate conversion rate and referral performance metrics
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Object} Conversion and performance metrics
   */
  static async getAffiliateConversionMetrics(startDate, endDate) {
    const cacheKey = `affiliate_conversion_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}`;
    
    const cached = await AnalyticsCache.getCache(cacheKey);
    if (cached) {
      return cached;
    }

    // Conversion rate analysis
    const conversionPipeline = [
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $lookup: {
          from: 'affiliates',
          localField: 'affiliateId',
          foreignField: '_id',
          as: 'affiliate'
        }
      },
      {
        $unwind: '$affiliate'
      },
      {
        $group: {
          _id: '$affiliateId',
          affiliateName: { $first: '$affiliate.businessName' },
          totalReferrals: { $sum: 1 },
          convertedReferrals: { $sum: { $cond: [{ $gt: ['$totalBookings', 0] }, 1, 0] } },
          totalBookings: { $sum: '$totalBookings' },
          totalValue: { $sum: '$totalValue' },
          averageBookingsPerReferral: { $avg: '$totalBookings' },
          averageValuePerReferral: { $avg: '$totalValue' }
        }
      },
      {
        $addFields: {
          conversionRate: {
            $cond: {
              if: { $gt: ['$totalReferrals', 0] },
              then: { $multiply: [{ $divide: ['$convertedReferrals', '$totalReferrals'] }, 100] },
              else: 0
            }
          }
        }
      },
      { $sort: { conversionRate: -1 } }
    ];

    const conversionData = await Referral.aggregate(conversionPipeline);

    // Overall conversion metrics
    const overallMetricsPipeline = [
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalReferrals: { $sum: 1 },
          totalConvertedReferrals: { $sum: { $cond: [{ $gt: ['$totalBookings', 0] }, 1, 0] } },
          totalBookings: { $sum: '$totalBookings' },
          totalValue: { $sum: '$totalValue' },
          uniqueAffiliates: { $addToSet: '$affiliateId' }
        }
      },
      {
        $addFields: {
          overallConversionRate: {
            $cond: {
              if: { $gt: ['$totalReferrals', 0] },
              then: { $multiply: [{ $divide: ['$totalConvertedReferrals', '$totalReferrals'] }, 100] },
              else: 0
            }
          },
          averageBookingsPerReferral: {
            $cond: {
              if: { $gt: ['$totalReferrals', 0] },
              then: { $divide: ['$totalBookings', '$totalReferrals'] },
              else: 0
            }
          },
          averageValuePerReferral: {
            $cond: {
              if: { $gt: ['$totalReferrals', 0] },
              then: { $divide: ['$totalValue', '$totalReferrals'] },
              else: 0
            }
          },
          activeAffiliateCount: { $size: '$uniqueAffiliates' }
        }
      }
    ];

    const [overallMetrics] = await Referral.aggregate(overallMetricsPipeline);

    // Referral source analysis
    const referralSourcePipeline = [
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$referralSource',
          count: { $sum: 1 },
          convertedCount: { $sum: { $cond: [{ $gt: ['$totalBookings', 0] }, 1, 0] } },
          totalValue: { $sum: '$totalValue' }
        }
      },
      {
        $addFields: {
          conversionRate: {
            $cond: {
              if: { $gt: ['$count', 0] },
              then: { $multiply: [{ $divide: ['$convertedCount', '$count'] }, 100] },
              else: 0
            }
          }
        }
      },
      { $sort: { count: -1 } }
    ];

    const referralSourceData = await Referral.aggregate(referralSourcePipeline);

    const result = {
      overallMetrics: overallMetrics || {
        totalReferrals: 0,
        totalConvertedReferrals: 0,
        overallConversionRate: 0,
        totalBookings: 0,
        totalValue: 0,
        averageBookingsPerReferral: 0,
        averageValuePerReferral: 0,
        activeAffiliateCount: 0
      },
      affiliateConversions: conversionData || [],
      referralSources: referralSourceData.map(source => ({
        source: source._id || 'unknown',
        referralCount: source.count,
        convertedCount: source.convertedCount,
        conversionRate: source.conversionRate,
        totalValue: source.totalValue,
        averageValuePerReferral: source.count > 0 ? source.totalValue / source.count : 0
      }))
    };

    // Cache for 1 hour
    await AnalyticsCache.setCache(cacheKey, result, 60, 'affiliate');
    
    return result;
  }

  /**
   * Get comprehensive affiliate dashboard analytics
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Object} Complete affiliate dashboard data
   */
  static async getAffiliateDashboardAnalytics(startDate, endDate) {
    const cacheKey = `affiliate_dashboard_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}`;
    
    const cached = await AnalyticsCache.getCache(cacheKey);
    if (cached) {
      return cached;
    }

    const [performanceData, revenueData, conversionData] = await Promise.all([
      this.getAffiliatePerformanceAnalytics(startDate, endDate),
      this.getAffiliateRevenueAnalytics(startDate, endDate),
      this.getAffiliateConversionMetrics(startDate, endDate)
    ]);

    const result = {
      overview: {
        totalAffiliates: conversionData.overallMetrics.activeAffiliateCount,
        totalReferrals: conversionData.overallMetrics.totalReferrals,
        totalCommissions: performanceData.commissionStats.totalApprovedCommissions,
        totalAffiliateRevenue: revenueData.affiliateRevenue.totalAffiliateRevenue,
        overallConversionRate: conversionData.overallMetrics.overallConversionRate,
        affiliateRevenueContribution: revenueData.affiliateContribution.revenuePercentage
      },
      performance: performanceData,
      revenue: revenueData,
      conversions: conversionData,
      generatedAt: new Date()
    };

    // Cache dashboard data for 30 minutes
    await AnalyticsCache.setCache(cacheKey, result, 30, 'affiliate');
    
    return result;
  }

  /**
   * Get affiliate overview metrics for dashboard
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Object} Affiliate overview data
   */
  static async getAffiliateOverviewMetrics(startDate, endDate) {
    const cacheKey = `affiliate_overview_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}`;
    
    const cached = await AnalyticsCache.getCache(cacheKey);
    if (cached) {
      return cached;
    }

    // Get basic affiliate metrics
    const affiliateMetricsPipeline = [
      {
        $facet: {
          totalAffiliates: [
            { $match: { status: 'active' } },
            { $count: 'count' }
          ],
          pendingAffiliates: [
            { $match: { status: 'pending' } },
            { $count: 'count' }
          ]
        }
      }
    ];

    // Get referral metrics for the date range
    const referralMetricsPipeline = [
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalReferrals: { $sum: 1 },
          convertedReferrals: { $sum: { $cond: [{ $gt: ['$totalBookings', 0] }, 1, 0] } },
          totalReferralValue: { $sum: '$totalValue' }
        }
      },
      {
        $addFields: {
          conversionRate: {
            $cond: {
              if: { $gt: ['$totalReferrals', 0] },
              then: { $multiply: [{ $divide: ['$convertedReferrals', '$totalReferrals'] }, 100] },
              else: 0
            }
          }
        }
      }
    ];

    // Get commission metrics for the date range
    const commissionMetricsPipeline = [
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalCommissions: { $sum: '$commissionAmount' },
          approvedCommissions: {
            $sum: { $cond: [{ $eq: ['$status', 'approved'] }, '$commissionAmount', 0] }
          },
          paidCommissions: {
            $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$commissionAmount', 0] }
          },
          totalCommissionTransactions: { $sum: 1 }
        }
      }
    ];

    const [affiliateStats, referralStats, commissionStats] = await Promise.all([
      Affiliate.aggregate(affiliateMetricsPipeline),
      Referral.aggregate(referralMetricsPipeline),
      CommissionTransaction.aggregate(commissionMetricsPipeline)
    ]);

    const result = {
      totalActiveAffiliates: affiliateStats[0]?.totalAffiliates[0]?.count || 0,
      pendingAffiliates: affiliateStats[0]?.pendingAffiliates[0]?.count || 0,
      totalReferrals: referralStats[0]?.totalReferrals || 0,
      conversionRate: referralStats[0]?.conversionRate || 0,
      totalReferralValue: referralStats[0]?.totalReferralValue || 0,
      totalCommissions: commissionStats[0]?.totalCommissions || 0,
      approvedCommissions: commissionStats[0]?.approvedCommissions || 0,
      paidCommissions: commissionStats[0]?.paidCommissions || 0,
      commissionTransactions: commissionStats[0]?.totalCommissionTransactions || 0
    };

    // Cache for 1 hour
    await AnalyticsCache.setCache(cacheKey, result, 60, 'affiliate');
    
    return result;
  }

  /**
   * Clear analytics cache
   * @param {string} category - Optional category to clear
   */
  static async clearCache(category = null) {
    if (category) {
      return await AnalyticsCache.invalidateCacheByCategory(category);
    } else {
      return await AnalyticsCache.deleteMany({});
    }
  }
}

module.exports = AnalyticsService;