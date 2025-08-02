// v1/controllers/healthController.js
const { StatusCodes } = require('http-status-codes');
const healthCheckService = require('../services/healthCheckService');
const performanceTracker = require('../utils/performanceTracker');
const logger = require('../utils/logger');
const { ApiError } = require('../utils/apiError');

/**
 * @function getHealthStatus
 * @description Get overall system health status
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @returns {object} Health status response
 */
const getHealthStatus = async (req, res) => {
  try {
    const healthStatus = await healthCheckService.performAllHealthChecks();
    
    // Set appropriate HTTP status based on health
    let httpStatus = StatusCodes.OK;
    if (healthStatus.status === 'unhealthy') {
      httpStatus = StatusCodes.SERVICE_UNAVAILABLE;
    } else if (healthStatus.status === 'degraded') {
      httpStatus = StatusCodes.PARTIAL_CONTENT;
    }

    res.status(httpStatus).json({
      status: 'success',
      data: healthStatus
    });
  } catch (error) {
    logger.error('Health check failed:', error.message);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Health check failed',
      error: error.message
    });
  }
};

/**
 * @function getServiceHealth
 * @description Get health status for a specific service
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @returns {object} Service health status response
 */
const getServiceHealth = async (req, res) => {
  try {
    const { serviceName } = req.params;
    const healthStatus = await healthCheckService.performHealthCheck(serviceName);
    
    let httpStatus = StatusCodes.OK;
    if (healthStatus.status === 'unhealthy') {
      httpStatus = StatusCodes.SERVICE_UNAVAILABLE;
    } else if (healthStatus.status === 'degraded') {
      httpStatus = StatusCodes.PARTIAL_CONTENT;
    }

    res.status(httpStatus).json({
      status: 'success',
      data: healthStatus
    });
  } catch (error) {
    if (error.message.includes('Health check not found')) {
      return res.status(StatusCodes.NOT_FOUND).json({
        status: 'error',
        message: `Service '${req.params.serviceName}' not found`,
        error: error.message
      });
    }
    
    logger.error(`Service health check failed for ${req.params.serviceName}:`, error.message);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Service health check failed',
      error: error.message
    });
  }
};

/**
 * @function getPerformanceMetrics
 * @description Get performance metrics for API endpoints
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @returns {object} Performance metrics response
 */
const getPerformanceMetrics = async (req, res) => {
  try {
    const { detailed = false, endpoint } = req.query;
    
    let metrics;
    if (detailed === 'true') {
      // Get detailed metrics from enhanced tracker
      metrics = performanceTracker.getDetailedMetrics(endpoint);
    } else {
      // Get basic metrics from health check service
      metrics = healthCheckService.getPerformanceMetrics();
    }
    
    res.status(StatusCodes.OK).json({
      status: 'success',
      data: metrics
    });
  } catch (error) {
    logger.error('Failed to get performance metrics:', error.message);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Failed to get performance metrics',
      error: error.message
    });
  }
};

/**
 * @function getSystemInfo
 * @description Get basic system information
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @returns {object} System information response
 */
const getSystemInfo = async (req, res) => {
  try {
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
      },
      timestamp: new Date().toISOString()
    };

    res.status(StatusCodes.OK).json({
      status: 'success',
      data: systemInfo
    });
  } catch (error) {
    logger.error('Failed to get system info:', error.message);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Failed to get system info',
      error: error.message
    });
  }
};

/**
 * @function clearPerformanceMetrics
 * @description Clear performance metrics (admin only)
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @returns {object} Success response
 */
const clearPerformanceMetrics = async (req, res) => {
  try {
    // Clear both basic and detailed metrics
    healthCheckService.clearPerformanceMetrics();
    performanceTracker.reset();
    
    logger.info('Performance metrics cleared by admin', {
      adminId: req.user?.userId,
      adminEmail: req.user?.email
    });

    res.status(StatusCodes.OK).json({
      status: 'success',
      message: 'Performance metrics cleared successfully'
    });
  } catch (error) {
    logger.error('Failed to clear performance metrics:', error.message);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Failed to clear performance metrics',
      error: error.message
    });
  }
};

/**
 * @function getLivenessProbe
 * @description Simple liveness probe for container orchestration
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @returns {object} Liveness status
 */
const getLivenessProbe = (req, res) => {
  res.status(StatusCodes.OK).json({
    status: 'alive',
    timestamp: new Date().toISOString()
  });
};

/**
 * @function getReadinessProbe
 * @description Readiness probe that checks critical services
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @returns {object} Readiness status
 */
const getReadinessProbe = async (req, res) => {
  try {
    // Check only critical services for readiness
    const criticalServices = ['database', 'system'];
    const promises = criticalServices.map(service => 
      healthCheckService.performHealthCheck(service)
    );
    
    const results = await Promise.all(promises);
    const allHealthy = results.every(result => result.status === 'healthy');
    
    if (allHealthy) {
      res.status(StatusCodes.OK).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        services: results
      });
    } else {
      res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        services: results
      });
    }
  } catch (error) {
    logger.error('Readiness probe failed:', error.message);
    res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
      status: 'not_ready',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

module.exports = {
  getHealthStatus,
  getServiceHealth,
  getPerformanceMetrics,
  getSystemInfo,
  clearPerformanceMetrics,
  getLivenessProbe,
  getReadinessProbe
};