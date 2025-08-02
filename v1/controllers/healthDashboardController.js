// v1/controllers/healthDashboardController.js
const { StatusCodes } = require('http-status-codes');
const healthCheckService = require('../services/healthCheckService');
const alertingSystem = require('../utils/alertingSystem');
const logger = require('../utils/logger');
const { ApiError } = require('../utils/apiError');

/**
 * @function getHealthDashboard
 * @description Get comprehensive health dashboard data
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @returns {object} Health dashboard response
 */
const getHealthDashboard = async (req, res) => {
  try {
    // Get comprehensive health status
    const healthStatus = await healthCheckService.performAllHealthChecks();
    
    // Get performance metrics
    const performanceMetrics = healthCheckService.getPerformanceMetrics();
    
    // Get system information
    const os = require('os');
    const process = require('process');
    
    const systemInfo = {
      application: {
        name: 'The Travel Place API',
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        uptime: Math.round(process.uptime()),
        startTime: new Date(Date.now() - process.uptime() * 1000).toISOString()
      },
      system: {
        platform: os.platform(),
        architecture: os.arch(),
        nodeVersion: process.version,
        totalMemory: Math.round(os.totalmem() / 1024 / 1024), // MB
        freeMemory: Math.round(os.freemem() / 1024 / 1024), // MB
        cpuCores: os.cpus().length,
        loadAverage: os.loadavg()
      }
    };

    // Get recent alert history
    const recentAlerts = alertingSystem.getAlertHistory(20);

    // Calculate dashboard metrics
    const dashboardMetrics = calculateDashboardMetrics(healthStatus, performanceMetrics);

    // Prepare dashboard data
    const dashboardData = {
      overview: {
        status: healthStatus.status,
        timestamp: healthStatus.timestamp,
        uptime: systemInfo.application.uptime,
        environment: systemInfo.application.environment
      },
      healthSummary: healthStatus.summary,
      services: healthStatus.services,
      performance: {
        summary: dashboardMetrics.performance,
        endpoints: performanceMetrics.metrics
      },
      systemResources: {
        memory: {
          total: systemInfo.system.totalMemory,
          free: systemInfo.system.freeMemory,
          used: systemInfo.system.totalMemory - systemInfo.system.freeMemory,
          usagePercent: Math.round(((systemInfo.system.totalMemory - systemInfo.system.freeMemory) / systemInfo.system.totalMemory) * 100)
        },
        cpu: {
          cores: systemInfo.system.cpuCores,
          loadAverage: systemInfo.system.loadAverage,
          platform: systemInfo.system.platform,
          nodeVersion: systemInfo.system.nodeVersion
        }
      },
      alerts: {
        recent: recentAlerts,
        summary: {
          total: recentAlerts.length,
          critical: recentAlerts.filter(alert => 
            alert.alertType.includes('SYSTEM_UNHEALTHY') || 
            alert.alertType.includes('SERVICE_UNHEALTHY')
          ).length,
          warnings: recentAlerts.filter(alert => 
            alert.alertType.includes('HIGH_') || 
            alert.alertType.includes('SLOW_')
          ).length
        }
      },
      trends: dashboardMetrics.trends
    };

    // Set appropriate HTTP status based on health
    let httpStatus = StatusCodes.OK;
    if (healthStatus.status === 'unhealthy') {
      httpStatus = StatusCodes.SERVICE_UNAVAILABLE;
    } else if (healthStatus.status === 'degraded') {
      httpStatus = StatusCodes.PARTIAL_CONTENT;
    }

    res.status(httpStatus).json({
      status: 'success',
      data: dashboardData
    });
  } catch (error) {
    logger.error('Health dashboard failed:', error.message);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Health dashboard failed',
      error: error.message
    });
  }
};

/**
 * @function getAlertHistory
 * @description Get alert history with pagination
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @returns {object} Alert history response
 */
const getAlertHistory = async (req, res) => {
  try {
    const { limit = 50, type } = req.query;
    const alerts = alertingSystem.getAlertHistory(parseInt(limit));
    
    // Filter by alert type if specified
    const filteredAlerts = type ? 
      alerts.filter(alert => alert.alertType === type) : 
      alerts;

    res.status(StatusCodes.OK).json({
      status: 'success',
      data: {
        alerts: filteredAlerts,
        total: filteredAlerts.length,
        availableTypes: [...new Set(alerts.map(alert => alert.alertType))]
      }
    });
  } catch (error) {
    logger.error('Failed to get alert history:', error.message);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Failed to get alert history',
      error: error.message
    });
  }
};

/**
 * @function updateAlertThresholds
 * @description Update alert thresholds (admin only)
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @returns {object} Success response
 */
const updateAlertThresholds = async (req, res) => {
  try {
    const { thresholds } = req.body;
    
    if (!thresholds || typeof thresholds !== 'object') {
      throw new ApiError('Invalid thresholds data', StatusCodes.BAD_REQUEST);
    }

    // Validate threshold values
    const validThresholds = {};
    const allowedThresholds = [
      'responseTime', 'errorRate', 'memoryUsage', 'cpuUsage', 
      'diskUsage', 'consecutiveFailures'
    ];

    for (const [key, value] of Object.entries(thresholds)) {
      if (allowedThresholds.includes(key) && typeof value === 'number' && value > 0) {
        validThresholds[key] = value;
      }
    }

    if (Object.keys(validThresholds).length === 0) {
      throw new ApiError('No valid thresholds provided', StatusCodes.BAD_REQUEST);
    }

    alertingSystem.updateThresholds(validThresholds);

    logger.info('Alert thresholds updated by admin', {
      adminId: req.user?.userId,
      adminEmail: req.user?.email,
      updatedThresholds: validThresholds
    });

    res.status(StatusCodes.OK).json({
      status: 'success',
      message: 'Alert thresholds updated successfully',
      data: { updatedThresholds: validThresholds }
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    logger.error('Failed to update alert thresholds:', error.message);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Failed to update alert thresholds',
      error: error.message
    });
  }
};

/**
 * @function clearAlertHistory
 * @description Clear alert history (admin only)
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @returns {object} Success response
 */
const clearAlertHistory = async (req, res) => {
  try {
    alertingSystem.clearAlertHistory();

    logger.info('Alert history cleared by admin', {
      adminId: req.user?.userId,
      adminEmail: req.user?.email
    });

    res.status(StatusCodes.OK).json({
      status: 'success',
      message: 'Alert history cleared successfully'
    });
  } catch (error) {
    logger.error('Failed to clear alert history:', error.message);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Failed to clear alert history',
      error: error.message
    });
  }
};

/**
 * @function calculateDashboardMetrics
 * @description Calculate dashboard metrics from health and performance data
 * @param {object} healthStatus - Health status data
 * @param {object} performanceMetrics - Performance metrics data
 * @returns {object} Calculated metrics
 */
function calculateDashboardMetrics(healthStatus, performanceMetrics) {
  const metrics = Object.values(performanceMetrics.metrics);
  
  // Performance summary
  const performanceSummary = {
    totalEndpoints: metrics.length,
    avgResponseTime: metrics.length > 0 ? 
      Math.round(metrics.reduce((sum, m) => sum + m.avgResponseTime, 0) / metrics.length) : 0,
    totalRequests: metrics.reduce((sum, m) => sum + m.totalRequests, 0),
    avgErrorRate: metrics.length > 0 ? 
      Math.round((metrics.reduce((sum, m) => sum + m.errorRate, 0) / metrics.length) * 100) / 100 : 0,
    slowestEndpoint: metrics.length > 0 ? 
      metrics.reduce((slowest, current) => 
        current.avgResponseTime > slowest.avgResponseTime ? current : slowest
      ) : null,
    highestErrorRate: metrics.length > 0 ? 
      metrics.reduce((highest, current) => 
        current.errorRate > highest.errorRate ? current : highest
      ) : null
  };

  // Service health trends (simplified - in production you'd store historical data)
  const serviceTrends = {};
  for (const [serviceName, service] of Object.entries(healthStatus.services)) {
    serviceTrends[serviceName] = {
      current: service.status,
      responseTime: service.responseTime || 0,
      // In a real implementation, you'd track these over time
      trend: 'stable', // 'improving', 'degrading', 'stable'
      uptime: 99.9 // percentage
    };
  }

  return {
    performance: performanceSummary,
    trends: {
      services: serviceTrends,
      overall: healthStatus.status
    }
  };
}

module.exports = {
  getHealthDashboard,
  getAlertHistory,
  updateAlertThresholds,
  clearAlertHistory
};