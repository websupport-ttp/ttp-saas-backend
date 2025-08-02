// v1/utils/performanceTracker.js
const logger = require('./logger');

/**
 * @class PerformanceTracker
 * @description Enhanced performance tracking utility with detailed metrics collection
 */
class PerformanceTracker {
  constructor() {
    this.metrics = new Map();
    this.systemMetrics = {
      startTime: Date.now(),
      totalRequests: 0,
      totalErrors: 0,
      totalResponseTime: 0
    };
    
    // Start periodic system metrics collection
    this.startSystemMetricsCollection();
  }

  /**
   * @method trackRequest
   * @description Track a request with detailed metrics
   * @param {object} requestData - Request tracking data
   */
  trackRequest(requestData) {
    const {
      method,
      url,
      statusCode,
      responseTime,
      userAgent,
      ip,
      userId,
      contentLength
    } = requestData;

    const key = `${method}:${url}`;
    const now = Date.now();

    // Update system-wide metrics
    this.systemMetrics.totalRequests++;
    this.systemMetrics.totalResponseTime += responseTime;
    if (statusCode >= 400) {
      this.systemMetrics.totalErrors++;
    }

    // Get or create endpoint metrics
    if (!this.metrics.has(key)) {
      this.metrics.set(key, {
        endpoint: url,
        method,
        requests: [],
        hourlyStats: new Map(),
        dailyStats: new Map(),
        totalRequests: 0,
        totalResponseTime: 0,
        errorCount: 0,
        lastUpdated: now
      });
    }

    const metric = this.metrics.get(key);
    
    // Add request to recent requests (keep last 100)
    if (metric.requests.length >= 100) {
      const removed = metric.requests.shift();
      metric.totalResponseTime -= removed.responseTime;
      if (removed.statusCode >= 400) {
        metric.errorCount--;
      }
      metric.totalRequests--;
    }

    // Add new request
    const requestRecord = {
      timestamp: now,
      responseTime,
      statusCode,
      userAgent: userAgent ? userAgent.substring(0, 100) : null, // Truncate for storage
      ip,
      userId,
      contentLength: contentLength || 0
    };

    metric.requests.push(requestRecord);
    metric.totalRequests++;
    metric.totalResponseTime += responseTime;
    if (statusCode >= 400) {
      metric.errorCount++;
    }
    metric.lastUpdated = now;

    // Update hourly and daily stats
    this.updateTimeBasedStats(metric, requestRecord);

    // Clean up old metrics periodically
    if (this.systemMetrics.totalRequests % 1000 === 0) {
      this.cleanupOldMetrics();
    }
  }

  /**
   * @method updateTimeBasedStats
   * @description Update hourly and daily statistics
   * @param {object} metric - Endpoint metric object
   * @param {object} requestRecord - Request record
   */
  updateTimeBasedStats(metric, requestRecord) {
    const date = new Date(requestRecord.timestamp);
    const hourKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
    const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

    // Update hourly stats
    if (!metric.hourlyStats.has(hourKey)) {
      metric.hourlyStats.set(hourKey, {
        requests: 0,
        totalResponseTime: 0,
        errors: 0,
        minResponseTime: Infinity,
        maxResponseTime: 0
      });
    }

    const hourlyStats = metric.hourlyStats.get(hourKey);
    hourlyStats.requests++;
    hourlyStats.totalResponseTime += requestRecord.responseTime;
    if (requestRecord.statusCode >= 400) {
      hourlyStats.errors++;
    }
    hourlyStats.minResponseTime = Math.min(hourlyStats.minResponseTime, requestRecord.responseTime);
    hourlyStats.maxResponseTime = Math.max(hourlyStats.maxResponseTime, requestRecord.responseTime);

    // Update daily stats
    if (!metric.dailyStats.has(dayKey)) {
      metric.dailyStats.set(dayKey, {
        requests: 0,
        totalResponseTime: 0,
        errors: 0,
        minResponseTime: Infinity,
        maxResponseTime: 0,
        uniqueUsers: new Set()
      });
    }

    const dailyStats = metric.dailyStats.get(dayKey);
    dailyStats.requests++;
    dailyStats.totalResponseTime += requestRecord.responseTime;
    if (requestRecord.statusCode >= 400) {
      dailyStats.errors++;
    }
    dailyStats.minResponseTime = Math.min(dailyStats.minResponseTime, requestRecord.responseTime);
    dailyStats.maxResponseTime = Math.max(dailyStats.maxResponseTime, requestRecord.responseTime);
    if (requestRecord.userId) {
      dailyStats.uniqueUsers.add(requestRecord.userId);
    }

    // Keep only last 24 hours of hourly stats
    if (metric.hourlyStats.size > 24) {
      const entries = Array.from(metric.hourlyStats.entries());
      entries.sort((a, b) => a[0].localeCompare(b[0]));
      const toDelete = entries.slice(0, entries.length - 24);
      toDelete.forEach(([key]) => metric.hourlyStats.delete(key));
    }

    // Keep only last 30 days of daily stats
    if (metric.dailyStats.size > 30) {
      const entries = Array.from(metric.dailyStats.entries());
      entries.sort((a, b) => a[0].localeCompare(b[0]));
      const toDelete = entries.slice(0, entries.length - 30);
      toDelete.forEach(([key]) => metric.dailyStats.delete(key));
    }
  }

  /**
   * @method getDetailedMetrics
   * @description Get detailed performance metrics
   * @param {string} endpoint - Specific endpoint (optional)
   * @returns {object} Detailed metrics
   */
  getDetailedMetrics(endpoint = null) {
    const now = Date.now();
    const uptime = now - this.systemMetrics.startTime;

    if (endpoint) {
      const metric = this.metrics.get(endpoint);
      if (!metric) {
        return null;
      }

      return this.formatEndpointMetrics(metric, now);
    }

    // Return all metrics
    const endpointMetrics = {};
    for (const [key, metric] of this.metrics) {
      endpointMetrics[key] = this.formatEndpointMetrics(metric, now);
    }

    return {
      system: {
        uptime,
        totalRequests: this.systemMetrics.totalRequests,
        totalErrors: this.systemMetrics.totalErrors,
        avgResponseTime: this.systemMetrics.totalRequests > 0 ? 
          Math.round(this.systemMetrics.totalResponseTime / this.systemMetrics.totalRequests) : 0,
        errorRate: this.systemMetrics.totalRequests > 0 ? 
          Math.round((this.systemMetrics.totalErrors / this.systemMetrics.totalRequests) * 10000) / 100 : 0,
        requestsPerSecond: this.systemMetrics.totalRequests / (uptime / 1000)
      },
      endpoints: endpointMetrics,
      timestamp: new Date(now).toISOString()
    };
  }

  /**
   * @method formatEndpointMetrics
   * @description Format endpoint metrics for response
   * @param {object} metric - Raw metric data
   * @param {number} now - Current timestamp
   * @returns {object} Formatted metrics
   */
  formatEndpointMetrics(metric, now) {
    const recentRequests = metric.requests.filter(req => now - req.timestamp < 5 * 60 * 1000); // Last 5 minutes
    const avgResponseTime = metric.totalRequests > 0 ? 
      Math.round(metric.totalResponseTime / metric.totalRequests) : 0;
    const errorRate = metric.totalRequests > 0 ? 
      Math.round((metric.errorCount / metric.totalRequests) * 10000) / 100 : 0;

    // Calculate percentiles from recent requests
    const responseTimes = metric.requests.map(req => req.responseTime).sort((a, b) => a - b);
    const percentiles = this.calculatePercentiles(responseTimes);

    // Get hourly trends (last 24 hours)
    const hourlyTrends = Array.from(metric.hourlyStats.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-24)
      .map(([hour, stats]) => ({
        hour,
        requests: stats.requests,
        avgResponseTime: stats.requests > 0 ? Math.round(stats.totalResponseTime / stats.requests) : 0,
        errorRate: stats.requests > 0 ? Math.round((stats.errors / stats.requests) * 10000) / 100 : 0,
        minResponseTime: stats.minResponseTime === Infinity ? 0 : stats.minResponseTime,
        maxResponseTime: stats.maxResponseTime
      }));

    return {
      endpoint: metric.endpoint,
      method: metric.method,
      totalRequests: metric.totalRequests,
      recentRequests: recentRequests.length,
      avgResponseTime,
      errorRate,
      percentiles,
      hourlyTrends,
      lastActivity: new Date(metric.lastUpdated).toISOString(),
      statusCodeDistribution: this.getStatusCodeDistribution(metric.requests)
    };
  }

  /**
   * @method calculatePercentiles
   * @description Calculate response time percentiles
   * @param {Array} responseTimes - Sorted array of response times
   * @returns {object} Percentile values
   */
  calculatePercentiles(responseTimes) {
    if (responseTimes.length === 0) {
      return { p50: 0, p90: 0, p95: 0, p99: 0 };
    }

    const getPercentile = (arr, percentile) => {
      const index = Math.ceil((percentile / 100) * arr.length) - 1;
      return arr[Math.max(0, index)];
    };

    return {
      p50: getPercentile(responseTimes, 50),
      p90: getPercentile(responseTimes, 90),
      p95: getPercentile(responseTimes, 95),
      p99: getPercentile(responseTimes, 99)
    };
  }

  /**
   * @method getStatusCodeDistribution
   * @description Get distribution of status codes
   * @param {Array} requests - Request records
   * @returns {object} Status code distribution
   */
  getStatusCodeDistribution(requests) {
    const distribution = {};
    
    requests.forEach(req => {
      const statusRange = `${Math.floor(req.statusCode / 100)}xx`;
      distribution[statusRange] = (distribution[statusRange] || 0) + 1;
    });

    return distribution;
  }

  /**
   * @method startSystemMetricsCollection
   * @description Start collecting system-level metrics
   */
  startSystemMetricsCollection() {
    // Collect system metrics every 30 seconds
    setInterval(() => {
      try {
        const os = require('os');
        const process = require('process');
        
        const memUsage = process.memoryUsage();
        const systemMem = {
          total: os.totalmem(),
          free: os.freemem()
        };
        
        logger.debug('System metrics collected', {
          memory: {
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
            systemUsage: Math.round(((systemMem.total - systemMem.free) / systemMem.total) * 100) // %
          },
          cpu: {
            loadAverage: os.loadavg(),
            uptime: os.uptime()
          },
          requests: {
            total: this.systemMetrics.totalRequests,
            errors: this.systemMetrics.totalErrors,
            avgResponseTime: this.systemMetrics.totalRequests > 0 ? 
              Math.round(this.systemMetrics.totalResponseTime / this.systemMetrics.totalRequests) : 0
          }
        });
      } catch (error) {
        logger.error('Failed to collect system metrics:', error.message);
      }
    }, 30000);
  }

  /**
   * @method cleanupOldMetrics
   * @description Clean up old metrics to prevent memory leaks
   */
  cleanupOldMetrics() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [key, metric] of this.metrics) {
      // Remove old requests
      metric.requests = metric.requests.filter(req => now - req.timestamp < maxAge);
      
      // Recalculate totals
      metric.totalRequests = metric.requests.length;
      metric.totalResponseTime = metric.requests.reduce((sum, req) => sum + req.responseTime, 0);
      metric.errorCount = metric.requests.filter(req => req.statusCode >= 400).length;

      // Remove metrics with no recent activity
      if (metric.requests.length === 0 && now - metric.lastUpdated > maxAge) {
        this.metrics.delete(key);
      }
    }

    logger.debug('Performance metrics cleanup completed', {
      activeEndpoints: this.metrics.size,
      totalRequests: this.systemMetrics.totalRequests
    });
  }

  /**
   * @method reset
   * @description Reset all metrics (for admin use)
   */
  reset() {
    this.metrics.clear();
    this.systemMetrics = {
      startTime: Date.now(),
      totalRequests: 0,
      totalErrors: 0,
      totalResponseTime: 0
    };
    
    logger.info('Performance metrics reset');
  }
}

// Export singleton instance
module.exports = new PerformanceTracker();