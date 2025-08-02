// v1/utils/analyticsAggregations.js

/**
 * @description MongoDB aggregation pipelines for analytics
 * Centralized location for all analytics aggregation queries
 */

/**
 * Revenue analytics aggregation pipeline
 * @param {Date} startDate - Start date for analysis
 * @param {Date} endDate - End date for analysis
 * @param {string} itemType - Optional filter by item type
 * @returns {Array} Aggregation pipeline
 */
function getRevenueAnalyticsPipeline(startDate, endDate, itemType = null) {
  const matchStage = {
    createdAt: { $gte: startDate, $lte: endDate },
    status: 'Completed'
  };

  if (itemType) {
    matchStage.itemType = itemType;
  }

  return [
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
            profit: '$profitMargin',
            serviceCharge: '$serviceCharge'
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
        },
        serviceChargePercentage: {
          $cond: {
            if: { $gt: ['$totalRevenue', 0] },
            then: { $multiply: [{ $divide: ['$totalServiceCharges', '$totalRevenue'] }, 100] },
            else: 0
          }
        }
      }
    }
  ];
}

/**
 * Daily revenue trend aggregation pipeline
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Array} Aggregation pipeline
 */
function getDailyRevenueTrendPipeline(startDate, endDate) {
  return [
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
        dailyServiceCharges: { $sum: '$serviceCharge' },
        transactionCount: { $sum: 1 },
        averageTransactionValue: { $avg: '$totalAmountPaid' },
        itemTypes: { $addToSet: '$itemType' }
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
        dailyServiceCharges: 1,
        transactionCount: 1,
        averageTransactionValue: 1,
        itemTypes: 1,
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
}

/**
 * Customer segmentation aggregation pipeline
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Array} Aggregation pipeline
 */
function getCustomerSegmentationPipeline(startDate, endDate) {
  return [
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
        averageTransactionValue: { $avg: '$totalAmountPaid' },
        uniqueCustomers: { $addToSet: '$userId' }
      }
    },
    {
      $addFields: {
        uniqueCustomerCount: { $size: '$uniqueCustomers' },
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
        segment: '$_id',
        totalRevenue: 1,
        totalProfit: 1,
        transactionCount: 1,
        averageTransactionValue: 1,
        uniqueCustomerCount: 1,
        profitMarginPercentage: 1,
        _id: 0
      }
    },
    { $sort: { totalRevenue: -1 } }
  ];
}

/**
 * Booking channel performance aggregation pipeline
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Array} Aggregation pipeline
 */
function getBookingChannelPipeline(startDate, endDate) {
  return [
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
        totalProfit: { $sum: '$profitMargin' },
        transactionCount: { $sum: 1 },
        averageTransactionValue: { $avg: '$totalAmountPaid' },
        uniqueCustomers: { $addToSet: '$userId' }
      }
    },
    {
      $addFields: {
        uniqueCustomerCount: { $size: '$uniqueCustomers' },
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
        channel: '$_id',
        totalRevenue: 1,
        totalProfit: 1,
        transactionCount: 1,
        averageTransactionValue: 1,
        uniqueCustomerCount: 1,
        profitMarginPercentage: 1,
        _id: 0
      }
    },
    { $sort: { totalRevenue: -1 } }
  ];
}

/**
 * Product performance aggregation pipeline
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Array} Aggregation pipeline
 */
function getProductPerformancePipeline(startDate, endDate) {
  return [
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
        totalServiceCharges: { $sum: '$serviceCharge' },
        transactionCount: { $sum: 1 },
        averageTransactionValue: { $avg: '$totalAmountPaid' },
        averageProfit: { $avg: '$profitMargin' },
        averageServiceCharge: { $avg: '$serviceCharge' }
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
        },
        serviceChargePercentage: {
          $cond: {
            if: { $gt: ['$totalRevenue', 0] },
            then: { $multiply: [{ $divide: ['$totalServiceCharges', '$totalRevenue'] }, 100] },
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
        totalServiceCharges: 1,
        transactionCount: 1,
        averageTransactionValue: 1,
        averageProfit: 1,
        averageServiceCharge: 1,
        profitMarginPercentage: 1,
        serviceChargePercentage: 1,
        _id: 0
      }
    },
    { $sort: { totalRevenue: -1 } }
  ];
}

/**
 * Package performance aggregation pipeline
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Array} Aggregation pipeline
 */
function getPackagePerformancePipeline(startDate, endDate) {
  return [
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
        packageSlug: { $first: '$packageDetails.slug' },
        totalRevenue: { $sum: '$totalAmountPaid' },
        totalProfit: { $sum: '$profitMargin' },
        salesCount: { $sum: 1 },
        averagePrice: { $avg: '$totalAmountPaid' },
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
        packageId: '$_id',
        packageTitle: 1,
        packageSlug: 1,
        totalRevenue: 1,
        totalProfit: 1,
        salesCount: 1,
        averagePrice: 1,
        averageProfit: 1,
        profitMarginPercentage: 1,
        _id: 0
      }
    },
    { $sort: { totalRevenue: -1 } },
    { $limit: 20 }
  ];
}

/**
 * Seasonality analysis aggregation pipeline
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Array} Aggregation pipeline
 */
function getSeasonalityPipeline(startDate, endDate) {
  return [
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
        totalProfit: { $sum: '$profitMargin' },
        transactionCount: { $sum: 1 },
        averageTransactionValue: { $avg: '$totalAmountPaid' },
        itemTypeBreakdown: {
          $push: {
            itemType: '$itemType',
            amount: '$totalAmountPaid'
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
    },
    {
      $project: {
        season: '$_id',
        totalRevenue: 1,
        totalProfit: 1,
        transactionCount: 1,
        averageTransactionValue: 1,
        profitMarginPercentage: 1,
        itemTypeBreakdown: 1,
        _id: 0
      }
    },
    { $sort: { totalRevenue: -1 } }
  ];
}

/**
 * Customer lifetime value aggregation pipeline
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Array} Aggregation pipeline
 */
function getCustomerLifetimeValuePipeline(startDate, endDate) {
  return [
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
        totalSpent: { $sum: '$totalAmountPaid' },
        totalProfit: { $sum: '$profitMargin' },
        transactionCount: { $sum: 1 },
        firstPurchase: { $min: '$createdAt' },
        lastPurchase: { $max: '$createdAt' },
        itemTypes: { $addToSet: '$itemType' },
        averageTransactionValue: { $avg: '$totalAmountPaid' }
      }
    },
    {
      $addFields: {
        customerLifespanDays: {
          $divide: [
            { $subtract: ['$lastPurchase', '$firstPurchase'] },
            1000 * 60 * 60 * 24
          ]
        }
      }
    },
    {
      $group: {
        _id: null,
        totalCustomers: { $sum: 1 },
        averageLifetimeValue: { $avg: '$totalSpent' },
        averageTransactionCount: { $avg: '$transactionCount' },
        averageCustomerLifespan: { $avg: '$customerLifespanDays' },
        totalRevenue: { $sum: '$totalSpent' },
        totalProfit: { $sum: '$totalProfit' },
        highValueCustomers: {
          $sum: {
            $cond: [{ $gte: ['$totalSpent', 100000] }, 1, 0] // Customers who spent >= 100k
          }
        }
      }
    },
    {
      $addFields: {
        averageProfitPerCustomer: { $divide: ['$totalProfit', '$totalCustomers'] },
        highValueCustomerPercentage: {
          $cond: {
            if: { $gt: ['$totalCustomers', 0] },
            then: { $multiply: [{ $divide: ['$highValueCustomers', '$totalCustomers'] }, 100] },
            else: 0
          }
        }
      }
    }
  ];
}

/**
 * Monthly growth trend aggregation pipeline
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Array} Aggregation pipeline
 */
function getMonthlyGrowthTrendPipeline(startDate, endDate) {
  return [
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
          month: { $month: '$createdAt' }
        },
        monthlyRevenue: { $sum: '$totalAmountPaid' },
        monthlyProfit: { $sum: '$profitMargin' },
        transactionCount: { $sum: 1 },
        uniqueCustomers: { $addToSet: '$userId' },
        newCustomers: {
          $addToSet: {
            $cond: [
              { $eq: ['$userId', null] },
              '$guestEmail',
              '$userId'
            ]
          }
        }
      }
    },
    {
      $addFields: {
        date: {
          $dateFromParts: {
            year: '$_id.year',
            month: '$_id.month',
            day: 1
          }
        },
        uniqueCustomerCount: { $size: '$uniqueCustomers' }
      }
    },
    { $sort: { date: 1 } },
    {
      $project: {
        _id: 0,
        date: 1,
        monthlyRevenue: 1,
        monthlyProfit: 1,
        transactionCount: 1,
        uniqueCustomerCount: 1,
        profitMarginPercentage: {
          $cond: {
            if: { $gt: ['$monthlyRevenue', 0] },
            then: { $multiply: [{ $divide: ['$monthlyProfit', '$monthlyRevenue'] }, 100] },
            else: 0
          }
        }
      }
    }
  ];
}

module.exports = {
  getRevenueAnalyticsPipeline,
  getDailyRevenueTrendPipeline,
  getCustomerSegmentationPipeline,
  getBookingChannelPipeline,
  getProductPerformancePipeline,
  getPackagePerformancePipeline,
  getSeasonalityPipeline,
  getCustomerLifetimeValuePipeline,
  getMonthlyGrowthTrendPipeline
};