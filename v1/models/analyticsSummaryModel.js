// v1/models/analyticsSummaryModel.js
const mongoose = require('mongoose');

/**
 * @description Mongoose schema for the Analytics Summary model.
 * Stores pre-computed analytics summaries for different time periods and segments.
 * This model helps improve dashboard performance by storing frequently accessed analytics data.
 */
const AnalyticsSummarySchema = new mongoose.Schema({
  summaryType: {
    type: String,
    required: [true, 'Summary type is required'],
    enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom'],
    index: true,
  },
  period: {
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
      index: true,
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
      index: true,
    },
  },
  filters: {
    itemType: {
      type: String,
      enum: ['Flight', 'Hotel', 'Insurance', 'Visa', 'Package', null],
      default: null,
    },
    customerSegment: {
      type: String,
      enum: ['Individual', 'Business', 'Group', 'Corporate', null],
      default: null,
    },
    bookingChannel: {
      type: String,
      enum: ['Web', 'Mobile', 'API', 'Admin', null],
      default: null,
    },
  },
  metrics: {
    revenue: {
      total: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
      },
      byItemType: [{
        itemType: {
          type: String,
          enum: ['Flight', 'Hotel', 'Insurance', 'Visa', 'Package'],
        },
        amount: {
          type: Number,
          min: 0,
        },
        percentage: {
          type: Number,
          min: 0,
          max: 100,
        },
      }],
      growth: {
        amount: Number,
        percentage: Number,
        trend: {
          type: String,
          enum: ['up', 'down', 'neutral'],
        },
      },
    },
    profit: {
      total: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
      },
      margin: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
        max: 100,
      },
      byItemType: [{
        itemType: {
          type: String,
          enum: ['Flight', 'Hotel', 'Insurance', 'Visa', 'Package'],
        },
        amount: {
          type: Number,
          min: 0,
        },
        margin: {
          type: Number,
          min: 0,
          max: 100,
        },
      }],
    },
    transactions: {
      total: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
      },
      averageValue: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
      },
      byItemType: [{
        itemType: {
          type: String,
          enum: ['Flight', 'Hotel', 'Insurance', 'Visa', 'Package'],
        },
        count: {
          type: Number,
          min: 0,
        },
        averageValue: {
          type: Number,
          min: 0,
        },
      }],
    },
    customers: {
      total: {
        type: Number,
        default: 0,
        min: 0,
      },
      new: {
        type: Number,
        default: 0,
        min: 0,
      },
      returning: {
        type: Number,
        default: 0,
        min: 0,
      },
      retentionRate: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
      },
      lifetimeValue: {
        average: {
          type: Number,
          default: 0,
          min: 0,
        },
        median: {
          type: Number,
          default: 0,
          min: 0,
        },
      },
      bySegment: [{
        segment: {
          type: String,
          enum: ['Individual', 'Business', 'Group', 'Corporate'],
        },
        count: {
          type: Number,
          min: 0,
        },
        revenue: {
          type: Number,
          min: 0,
        },
        averageValue: {
          type: Number,
          min: 0,
        },
      }],
    },
    performance: {
      topProducts: [{
        itemType: {
          type: String,
          enum: ['Flight', 'Hotel', 'Insurance', 'Visa', 'Package'],
        },
        revenue: {
          type: Number,
          min: 0,
        },
        profit: {
          type: Number,
          min: 0,
        },
        transactionCount: {
          type: Number,
          min: 0,
        },
      }],
      topPackages: [{
        packageId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Post',
        },
        title: String,
        revenue: {
          type: Number,
          min: 0,
        },
        salesCount: {
          type: Number,
          min: 0,
        },
      }],
      channelPerformance: [{
        channel: {
          type: String,
          enum: ['Web', 'Mobile', 'API', 'Admin'],
        },
        revenue: {
          type: Number,
          min: 0,
        },
        transactionCount: {
          type: Number,
          min: 0,
        },
        conversionRate: {
          type: Number,
          min: 0,
          max: 100,
        },
      }],
    },
  },
  computedAt: {
    type: Date,
    default: Date.now,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  version: {
    type: Number,
    default: 1,
    min: 1,
  },
}, {
  timestamps: true,
});

// Compound indexes for efficient querying
AnalyticsSummarySchema.index({ summaryType: 1, 'period.startDate': 1, 'period.endDate': 1 });
AnalyticsSummarySchema.index({ summaryType: 1, isActive: 1, computedAt: -1 });
AnalyticsSummarySchema.index({ 'filters.itemType': 1, summaryType: 1 });
AnalyticsSummarySchema.index({ 'filters.customerSegment': 1, summaryType: 1 });
AnalyticsSummarySchema.index({ 'filters.bookingChannel': 1, summaryType: 1 });

// TTL index to automatically remove old summaries (keep for 90 days)
AnalyticsSummarySchema.index({ computedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Static methods for analytics summary management
AnalyticsSummarySchema.statics.findSummary = async function(summaryType, startDate, endDate, filters = {}) {
  const query = {
    summaryType,
    'period.startDate': startDate,
    'period.endDate': endDate,
    isActive: true,
  };

  // Add filters if provided
  if (filters.itemType) {
    query['filters.itemType'] = filters.itemType;
  }
  if (filters.customerSegment) {
    query['filters.customerSegment'] = filters.customerSegment;
  }
  if (filters.bookingChannel) {
    query['filters.bookingChannel'] = filters.bookingChannel;
  }

  return await this.findOne(query).sort({ computedAt: -1 });
};

AnalyticsSummarySchema.statics.createOrUpdateSummary = async function(summaryData) {
  const {
    summaryType,
    period,
    filters = {},
    metrics,
  } = summaryData;

  const query = {
    summaryType,
    'period.startDate': period.startDate,
    'period.endDate': period.endDate,
  };

  // Add filters to query
  if (filters.itemType) {
    query['filters.itemType'] = filters.itemType;
  }
  if (filters.customerSegment) {
    query['filters.customerSegment'] = filters.customerSegment;
  }
  if (filters.bookingChannel) {
    query['filters.bookingChannel'] = filters.bookingChannel;
  }

  const update = {
    summaryType,
    period,
    filters,
    metrics,
    computedAt: new Date(),
    isActive: true,
    $inc: { version: 1 },
  };

  return await this.findOneAndUpdate(
    query,
    update,
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );
};

AnalyticsSummarySchema.statics.getLatestSummaries = async function(summaryType, limit = 10) {
  return await this.find({
    summaryType,
    isActive: true,
  })
    .sort({ computedAt: -1 })
    .limit(limit)
    .select('period metrics computedAt version');
};

AnalyticsSummarySchema.statics.invalidateSummaries = async function(criteria = {}) {
  const query = { isActive: true, ...criteria };
  return await this.updateMany(query, { isActive: false });
};

// Instance methods
AnalyticsSummarySchema.methods.isStale = function(maxAgeHours = 24) {
  const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert to milliseconds
  const age = Date.now() - this.computedAt.getTime();
  return age > maxAge;
};

AnalyticsSummarySchema.methods.getGrowthComparison = async function() {
  const previousPeriod = await this.constructor.findOne({
    summaryType: this.summaryType,
    'period.endDate': { $lt: this.period.startDate },
    isActive: true,
  }).sort({ 'period.endDate': -1 });

  if (!previousPeriod) {
    return null;
  }

  const calculateGrowth = (current, previous) => {
    if (previous === 0) {
      return { amount: current, percentage: current > 0 ? 100 : 0, trend: current > 0 ? 'up' : 'neutral' };
    }
    const amount = current - previous;
    const percentage = (amount / previous) * 100;
    return {
      amount: Math.round(amount * 100) / 100,
      percentage: Math.round(percentage * 100) / 100,
      trend: amount > 0 ? 'up' : amount < 0 ? 'down' : 'neutral',
    };
  };

  return {
    revenue: calculateGrowth(this.metrics.revenue.total, previousPeriod.metrics.revenue.total),
    profit: calculateGrowth(this.metrics.profit.total, previousPeriod.metrics.profit.total),
    transactions: calculateGrowth(this.metrics.transactions.total, previousPeriod.metrics.transactions.total),
    customers: calculateGrowth(this.metrics.customers.total, previousPeriod.metrics.customers.total),
  };
};

module.exports = mongoose.model('AnalyticsSummary', AnalyticsSummarySchema);