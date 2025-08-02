// v1/utils/analyticsHelpers.js

/**
 * @description Utility functions for analytics calculations and data processing
 */

/**
 * Generate date range for analytics queries
 * @param {string} period - Period type ('today', 'week', 'month', 'quarter', 'year', 'custom')
 * @param {Date} customStart - Custom start date (for 'custom' period)
 * @param {Date} customEnd - Custom end date (for 'custom' period)
 * @returns {Object} Start and end dates
 */
function getDateRange(period, customStart = null, customEnd = null) {
  const now = new Date();
  let startDate, endDate;

  switch (period) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      break;
    
    case 'yesterday':
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      startDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
      endDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);
      break;
    
    case 'week':
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startDate = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate());
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      break;
    
    case 'last_week':
      const lastWeekEnd = new Date(now);
      lastWeekEnd.setDate(now.getDate() - now.getDay() - 1);
      const lastWeekStart = new Date(lastWeekEnd);
      lastWeekStart.setDate(lastWeekEnd.getDate() - 6);
      startDate = new Date(lastWeekStart.getFullYear(), lastWeekStart.getMonth(), lastWeekStart.getDate());
      endDate = new Date(lastWeekEnd.getFullYear(), lastWeekEnd.getMonth(), lastWeekEnd.getDate(), 23, 59, 59);
      break;
    
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      break;
    
    case 'last_month':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      break;
    
    case 'quarter':
      const quarterStart = Math.floor(now.getMonth() / 3) * 3;
      startDate = new Date(now.getFullYear(), quarterStart, 1);
      endDate = new Date(now.getFullYear(), quarterStart + 3, 0, 23, 59, 59);
      break;
    
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      break;
    
    case 'last_year':
      startDate = new Date(now.getFullYear() - 1, 0, 1);
      endDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
      break;
    
    case 'custom':
      if (!customStart || !customEnd) {
        throw new Error('Custom start and end dates are required for custom period');
      }
      startDate = new Date(customStart);
      endDate = new Date(customEnd);
      break;
    
    default:
      // Default to last 30 days
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 30);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  }

  return { startDate, endDate };
}

/**
 * Calculate percentage change between two values
 * @param {number} current - Current value
 * @param {number} previous - Previous value
 * @returns {Object} Change amount and percentage
 */
function calculatePercentageChange(current, previous) {
  if (previous === 0) {
    return {
      change: current,
      percentage: current > 0 ? 100 : 0,
      trend: current > 0 ? 'up' : current < 0 ? 'down' : 'neutral'
    };
  }

  const change = current - previous;
  const percentage = (change / previous) * 100;
  
  return {
    change: Math.round(change * 100) / 100,
    percentage: Math.round(percentage * 100) / 100,
    trend: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral'
  };
}

/**
 * Format currency values
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code (default: 'NGN')
 * @returns {string} Formatted currency string
 */
function formatCurrency(amount, currency = 'NGN') {
  const currencySymbols = {
    NGN: '₦',
    USD: '$',
    EUR: '€',
    GBP: '£'
  };

  const symbol = currencySymbols[currency] || currency;
  const formattedAmount = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);

  return `${symbol}${formattedAmount}`;
}

/**
 * Generate cache key for analytics data
 * @param {string} type - Analytics type
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @param {Object} filters - Additional filters
 * @returns {string} Cache key
 */
function generateCacheKey(type, startDate, endDate, filters = {}) {
  const start = startDate.toISOString().split('T')[0];
  const end = endDate.toISOString().split('T')[0];
  const filterString = Object.keys(filters).length > 0 
    ? '_' + Object.entries(filters).map(([k, v]) => `${k}:${v}`).join('_')
    : '';
  
  return `${type}_${start}_${end}${filterString}`;
}

/**
 * Validate date range for analytics queries
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @param {number} maxDays - Maximum allowed days (default: 365)
 * @returns {Object} Validation result
 */
function validateDateRange(startDate, endDate, maxDays = 365) {
  const errors = [];

  if (!(startDate instanceof Date) || isNaN(startDate)) {
    errors.push('Invalid start date');
  }

  if (!(endDate instanceof Date) || isNaN(endDate)) {
    errors.push('Invalid end date');
  }

  if (startDate && endDate && startDate > endDate) {
    errors.push('Start date must be before end date');
  }

  if (startDate && endDate) {
    const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    if (daysDiff > maxDays) {
      errors.push(`Date range cannot exceed ${maxDays} days`);
    }
  }

  const now = new Date();
  if (endDate && endDate > now) {
    errors.push('End date cannot be in the future');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Process aggregation results for consistent formatting
 * @param {Array} results - Raw aggregation results
 * @param {string} type - Result type for formatting
 * @returns {Array} Processed results
 */
function processAggregationResults(results, type) {
  if (!Array.isArray(results)) {
    return [];
  }

  switch (type) {
    case 'revenue':
      return results.map(item => ({
        ...item,
        totalRevenue: Math.round(item.totalRevenue * 100) / 100,
        totalProfit: Math.round(item.totalProfit * 100) / 100,
        averageTransactionValue: Math.round(item.averageTransactionValue * 100) / 100,
        profitMarginPercentage: Math.round(item.profitMarginPercentage * 100) / 100
      }));

    case 'daily_trend':
      return results.map(item => ({
        ...item,
        date: item.date.toISOString().split('T')[0],
        dailyRevenue: Math.round(item.dailyRevenue * 100) / 100,
        dailyProfit: Math.round(item.dailyProfit * 100) / 100,
        averageTransactionValue: Math.round(item.averageTransactionValue * 100) / 100,
        profitMarginPercentage: Math.round(item.profitMarginPercentage * 100) / 100
      }));

    case 'customer_segments':
      return results.map(item => ({
        ...item,
        totalRevenue: Math.round(item.totalRevenue * 100) / 100,
        averageTransactionValue: Math.round(item.averageTransactionValue * 100) / 100
      }));

    default:
      return results;
  }
}

/**
 * Generate comparison data for period-over-period analysis
 * @param {Object} currentData - Current period data
 * @param {Object} previousData - Previous period data
 * @returns {Object} Comparison data with trends
 */
function generateComparisonData(currentData, previousData) {
  const comparison = {};

  const metricsToCompare = [
    'totalRevenue',
    'totalProfit',
    'totalTransactions',
    'averageTransactionValue',
    'profitMarginPercentage'
  ];

  metricsToCompare.forEach(metric => {
    const current = currentData[metric] || 0;
    const previous = previousData[metric] || 0;
    
    comparison[metric] = {
      current,
      previous,
      ...calculatePercentageChange(current, previous)
    };
  });

  return comparison;
}

/**
 * Calculate customer lifetime value metrics
 * @param {Array} customerData - Customer transaction data
 * @returns {Object} CLV metrics
 */
function calculateCustomerLifetimeValue(customerData) {
  if (!Array.isArray(customerData) || customerData.length === 0) {
    return {
      averageLifetimeValue: 0,
      averageTransactionValue: 0,
      averageTransactionFrequency: 0,
      customerLifespan: 0
    };
  }

  const totalRevenue = customerData.reduce((sum, customer) => sum + (customer.totalSpent || 0), 0);
  const totalTransactions = customerData.reduce((sum, customer) => sum + (customer.totalTransactions || 0), 0);
  const totalCustomers = customerData.length;

  // Calculate average customer lifespan in days
  const now = new Date();
  const totalLifespan = customerData.reduce((sum, customer) => {
    const createdAt = new Date(customer.createdAt);
    const lifespanDays = Math.ceil((now - createdAt) / (1000 * 60 * 60 * 24));
    return sum + lifespanDays;
  }, 0);

  return {
    averageLifetimeValue: Math.round((totalRevenue / totalCustomers) * 100) / 100,
    averageTransactionValue: Math.round((totalRevenue / totalTransactions) * 100) / 100,
    averageTransactionFrequency: Math.round((totalTransactions / totalCustomers) * 100) / 100,
    customerLifespan: Math.round(totalLifespan / totalCustomers)
  };
}

/**
 * Determine seasonality based on date
 * @param {Date} date - Date to analyze
 * @returns {string} Season classification
 */
function determineSeason(date) {
  const month = date.getMonth() + 1; // JavaScript months are 0-indexed
  
  // Define seasons based on typical travel patterns
  if (month >= 12 || month <= 2) {
    return 'Peak'; // Holiday season
  } else if (month >= 6 && month <= 8) {
    return 'Peak'; // Summer vacation
  } else if (month >= 3 && month <= 5) {
    return 'Shoulder'; // Spring
  } else {
    return 'Off-Peak'; // Fall
  }
}

/**
 * Generate analytics summary for dashboard
 * @param {Object} analyticsData - Raw analytics data
 * @returns {Object} Dashboard summary
 */
function generateDashboardSummary(analyticsData) {
  const {
    revenue = {},
    customers = {},
    products = {},
    trends = {}
  } = analyticsData;

  return {
    keyMetrics: {
      totalRevenue: revenue.totalRevenue || 0,
      totalProfit: revenue.totalProfit || 0,
      totalTransactions: revenue.totalTransactions || 0,
      averageTransactionValue: revenue.averageTransactionValue || 0,
      profitMarginPercentage: revenue.profitMarginPercentage || 0
    },
    customerInsights: {
      totalCustomers: customers.customerMetrics?.totalCustomers || 0,
      newCustomers: customers.customerMetrics?.newCustomers || 0,
      repeatCustomers: customers.customerMetrics?.repeatCustomers || 0,
      repeatCustomerRate: customers.customerMetrics?.repeatCustomerRate || 0
    },
    topPerformingProducts: products.itemPerformance?.slice(0, 5) || [],
    recentTrends: trends.daily?.slice(-7) || [], // Last 7 days
    generatedAt: new Date()
  };
}

module.exports = {
  getDateRange,
  calculatePercentageChange,
  formatCurrency,
  generateCacheKey,
  validateDateRange,
  processAggregationResults,
  generateComparisonData,
  calculateCustomerLifetimeValue,
  determineSeason,
  generateDashboardSummary
};