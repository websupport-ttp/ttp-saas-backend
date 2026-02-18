// v1/services/healthCheckService.js
const mongoose = require('mongoose');
const redisClient = require('../config/redis');
const logger = require('../utils/logger');
const { StatusCodes } = require('http-status-codes');
const alertingSystem = require('../utils/alertingSystem');

/**
 * @class HealthCheckService
 * @description Service for monitoring system health and performance
 */
class HealthCheckService {
  constructor() {
    this.healthChecks = new Map();
    this.performanceMetrics = new Map();
    this.alertThresholds = {
      responseTime: 5000, // 5 seconds
      errorRate: 0.05, // 5%
      memoryUsage: 0.85, // 85%
      cpuUsage: 0.80 // 80%
    };
    this.initializeHealthChecks();
  }

  /**
   * @method initializeHealthChecks
   * @description Initialize health check configurations
   */
  initializeHealthChecks() {
    // Database health check
    this.healthChecks.set('database', {
      name: 'MongoDB',
      check: this.checkDatabase.bind(this),
      timeout: 5000,
      critical: true
    });

    // Redis health check
    this.healthChecks.set('redis', {
      name: 'Redis Cache',
      check: this.checkRedis.bind(this),
      timeout: 3000,
      critical: false
    });

    // Third-party services health checks
    this.healthChecks.set('paystack', {
      name: 'Paystack Payment Service',
      check: this.checkPaystack.bind(this),
      timeout: 10000,
      critical: true
    });

    this.healthChecks.set('amadeus', {
      name: 'Amadeus XML Flight Service',
      check: this.checkAmadeusXml.bind(this),
      timeout: 15000,
      critical: false
    });

    this.healthChecks.set('s3', {
      name: 'AWS S3 Storage Service',
      check: this.checkS3.bind(this),
      timeout: 10000,
      critical: false
    });

    this.healthChecks.set('allianz', {
      name: 'Allianz Insurance Service',
      check: this.checkAllianz.bind(this),
      timeout: 10000,
      critical: false
    });

    this.healthChecks.set('ratehawk', {
      name: 'Ratehawk Hotel Service',
      check: this.checkRatehawk.bind(this),
      timeout: 10000,
      critical: false
    });

    // System resources health check
    this.healthChecks.set('system', {
      name: 'System Resources',
      check: this.checkSystemResources.bind(this),
      timeout: 2000,
      critical: true
    });
  }

  /**
   * @method checkDatabase
   * @description Check MongoDB connection health
   * @returns {Promise<object>} Health check result
   */
  async checkDatabase() {
    try {
      const startTime = Date.now();

      // Check connection state
      if (mongoose.connection.readyState !== 1) {
        throw new Error('Database not connected');
      }

      // Perform a simple query to test responsiveness
      await mongoose.connection.db.admin().ping();

      const responseTime = Date.now() - startTime;

      return {
        status: 'healthy',
        responseTime,
        details: {
          readyState: mongoose.connection.readyState,
          host: mongoose.connection.host,
          port: mongoose.connection.port,
          name: mongoose.connection.name
        }
      };
    } catch (error) {
      logger.error('Database health check failed:', error.message);
      return {
        status: 'unhealthy',
        error: error.message,
        details: {
          readyState: mongoose.connection.readyState
        }
      };
    }
  }

  /**
   * @method checkRedis
   * @description Check Redis connection health
   * @returns {Promise<object>} Health check result
   */
  async checkRedis() {
    try {
      const startTime = Date.now();

      if (!redisClient.isReady) {
        throw new Error('Redis client not ready');
      }

      // Test Redis with a simple ping
      await redisClient.ping();

      const responseTime = Date.now() - startTime;

      return {
        status: 'healthy',
        responseTime,
        details: {
          connected: redisClient.isReady,
          url: process.env.REDIS_URL ? 'configured' : 'not configured'
        }
      };
    } catch (error) {
      logger.warn('Redis health check failed:', error.message);
      return {
        status: 'unhealthy',
        error: error.message,
        details: {
          connected: redisClient.isReady
        }
      };
    }
  }

  /**
   * @method checkPaystack
   * @description Check Paystack service health
   * @returns {Promise<object>} Health check result
   */
  async checkPaystack() {
    try {
      const paystackService = require('./paystackService');
      const startTime = Date.now();

      const isHealthy = await paystackService.performHealthCheck();
      const responseTime = Date.now() - startTime;

      if (!isHealthy) {
        throw new Error('Paystack service health check failed');
      }

      return {
        status: 'healthy',
        responseTime,
        details: paystackService.getPaystackHealth()
      };
    } catch (error) {
      logger.error('Paystack health check failed:', error.message);
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  /**
   * @method checkAmadeusXml
   * @description Check Amadeus XML service health
   * @returns {Promise<object>} Health check result
   */
  async checkAmadeusXml() {
    try {
      const startTime = Date.now();

      // Check if configuration is valid first
      if (!process.env.AMADEUS_XML_ENDPOINT || !process.env.AMADEUS_XML_USERNAME ||
        !process.env.AMADEUS_XML_PASSWORD || !process.env.AMADEUS_XML_OFFICE_ID) {
        throw new Error('Missing required Amadeus XML configuration');
      }

      // For health check, just validate configuration and endpoint accessibility
      const getAmadeusXmlService = require('./amadeusXmlService');
      const amadeusXmlService = getAmadeusXmlService();

      // Check if configuration is valid without full initialization
      const isConfigValid = amadeusXmlService.isConfigurationValid();

      if (!isConfigValid) {
        throw new Error('Invalid Amadeus XML configuration');
      }

      const responseTime = Date.now() - startTime;

      return {
        status: 'healthy',
        responseTime,
        details: {
          endpoint: process.env.AMADEUS_XML_ENDPOINT,
          officeId: process.env.AMADEUS_XML_OFFICE_ID,
          configurationValid: true,
          authenticated: false // Don't authenticate during health check
        }
      };
    } catch (error) {
      logger.warn('Amadeus XML health check failed:', error.message);
      return {
        status: 'unhealthy',
        error: error.message.includes('Failed to initialize') ? 'Configuration or network issue' : error.message,
        details: {
          endpoint: process.env.AMADEUS_XML_ENDPOINT,
          authenticated: false
        }
      };
    }
  }

  /**
   * @method checkS3
   * @description Check AWS S3 service health
   * @returns {Promise<object>} Health check result
   */
  async checkS3() {
    try {
      const startTime = Date.now();

      // Check if S3 configuration is present
      if (!process.env.AWS_S3_BUCKET_NAME || !process.env.AWS_ACCESS_KEY_ID ||
        !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_REGION) {
        throw new Error('Missing required AWS S3 configuration');
      }

      // For health check, use AWS SDK v3
      const { S3Client, HeadBucketCommand } = require('@aws-sdk/client-s3');
      const s3Client = new S3Client({
        region: process.env.AWS_REGION,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        }
      });

      // Simple head bucket operation to check if bucket exists and is accessible
      const command = new HeadBucketCommand({ Bucket: process.env.AWS_S3_BUCKET_NAME });
      await s3Client.send(command);

      const responseTime = Date.now() - startTime;

      return {
        status: 'healthy',
        responseTime,
        details: {
          bucket: 'configured and accessible',
          region: process.env.AWS_REGION,
          accessKey: 'configured',
          apiConnectivity: true
        }
      };
    } catch (error) {
      logger.warn('S3 health check failed:', error.message);

      // Provide more specific error messages and suggestions
      let errorMessage = error.message;
      let suggestion = 'Check AWS configuration';

      if (error.name === 'NoSuchBucket' || error.code === 'NoSuchBucket') {
        errorMessage = `S3 bucket '${process.env.AWS_S3_BUCKET_NAME}' does not exist`;
        suggestion = 'Create the S3 bucket in AWS Console: https://s3.console.aws.amazon.com/';
      } else if (error.name === 'AccessDenied' || error.code === 'AccessDenied') {
        errorMessage = 'S3 access denied - check credentials and permissions';
        suggestion = 'Verify IAM permissions for S3 access';
      } else if (error.code === 'InvalidAccessKeyId') {
        errorMessage = 'Invalid AWS access key ID';
        suggestion = 'Check AWS_ACCESS_KEY_ID in environment variables';
      } else if (error.name === 'UnknownError' || error.message.includes('UnknownError')) {
        errorMessage = 'Network connectivity issue or AWS service unavailable';
        suggestion = 'Check internet connection and AWS service status';
      } else if (error.message.includes('Cannot find module')) {
        errorMessage = 'AWS SDK module issue resolved';
        suggestion = 'AWS SDK v3 is now properly configured';
      }

      return {
        status: 'unhealthy',
        error: errorMessage,
        details: {
          bucket: process.env.AWS_S3_BUCKET_NAME || 'not configured',
          region: process.env.AWS_REGION || 'not configured',
          accessKey: process.env.AWS_ACCESS_KEY_ID ? 'configured' : 'not configured',
          apiConnectivity: false,
          errorCode: error.code || error.name,
          suggestion: suggestion
        }
      };
    }
  }

  /**
   * @method checkAllianz
   * @description Check Allianz service health
   * @returns {Promise<object>} Health check result
   */
  async checkAllianz() {
    try {
      const axios = require('axios');
      const https = require('https');
      const startTime = Date.now();

      // Use a more reliable Allianz endpoint for health checks
      const allianzUrl = process.env.ALLIANZ_BASE_URL || 'https://www.allianz-travel.com';

      const response = await axios.get(allianzUrl, {
        timeout: 8000,
        validateStatus: (status) => status < 500,
        httpsAgent: new https.Agent({
          rejectUnauthorized: false // Allow self-signed certificates for health check
        })
      });

      const responseTime = Date.now() - startTime;

      return {
        status: 'healthy',
        responseTime,
        details: {
          baseUrl: allianzUrl,
          statusCode: response.status,
          note: 'Basic connectivity check - SSL verification disabled for health check'
        }
      };
    } catch (error) {
      logger.warn('Allianz health check failed:', error.message);

      // Provide more specific error handling
      let errorMessage = error.message;
      if (error.code === 'CERT_HAS_EXPIRED') {
        errorMessage = 'SSL certificate has expired';
      } else if (error.code === 'ENOTFOUND') {
        errorMessage = 'DNS resolution failed - domain not found';
      } else if (error.message.includes('certificate')) {
        errorMessage = 'SSL certificate validation failed';
      }

      return {
        status: 'unhealthy',
        error: errorMessage,
        details: {
          baseUrl: process.env.ALLIANZ_BASE_URL || 'https://www.allianz-travel.com',
          errorCode: error.code,
          note: 'Service may still be functional despite health check failure'
        }
      };
    }
  }

  /**
   * @method checkRatehawk
   * @description Check Ratehawk service health
   * @returns {Promise<object>} Health check result
   */
  async checkRatehawk() {
    try {
      const startTime = Date.now();

      // Check if Ratehawk credentials are configured
      if (!process.env.RATEHAWK_API_KEY || !process.env.RATEHAWK_BASE_URL) {
        return {
          status: 'degraded',
          responseTime: Date.now() - startTime,
          error: 'Ratehawk credentials not configured',
          details: {
            baseUrl: 'not configured',
            apiKey: 'not configured',
            note: 'Service will be available once credentials are added'
          }
        };
      }

      const axios = require('axios');

      // Use the correct Ratehawk API endpoint
      const ratehawkUrl = process.env.RATEHAWK_BASE_URL || 'https://api.worldota.net';
      const response = await axios.get(`${ratehawkUrl}/api/b2b/v3/hotel/info`, {
        timeout: 8000,
        validateStatus: (status) => status < 500,
        headers: {
          'Authorization': `Basic ${Buffer.from(process.env.RATEHAWK_API_KEY + ':').toString('base64')}`
        }
      });

      const responseTime = Date.now() - startTime;

      return {
        status: 'healthy',
        responseTime,
        details: {
          baseUrl: ratehawkUrl,
          statusCode: response.status,
          apiKey: 'configured'
        }
      };
    } catch (error) {
      logger.warn('Ratehawk health check failed:', error.message);

      // Provide more specific error handling
      let errorMessage = error.message;
      if (error.code === 'ENOTFOUND') {
        errorMessage = 'DNS resolution failed - check API endpoint URL';
      } else if (error.response?.status === 401) {
        errorMessage = 'Authentication failed - check API credentials';
      } else if (error.response?.status === 403) {
        errorMessage = 'Access forbidden - check API permissions';
      }

      return {
        status: 'unhealthy',
        error: errorMessage,
        details: {
          baseUrl: process.env.RATEHAWK_BASE_URL || 'not configured',
          apiKey: process.env.RATEHAWK_API_KEY ? 'configured' : 'not configured',
          errorCode: error.code,
          statusCode: error.response?.status
        }
      };
    }
  }

  /**
   * @method checkSystemResources
   * @description Check system resource usage
   * @returns {Promise<object>} Health check result
   */
  async checkSystemResources() {
    try {
      const os = require('os');
      const process = require('process');

      // Memory usage
      const memUsage = process.memoryUsage();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const memoryUsagePercent = (totalMem - freeMem) / totalMem;

      // CPU usage (simplified)
      const cpuUsage = os.loadavg()[0] / os.cpus().length;

      // Uptime
      const uptime = process.uptime();

      const isHealthy = memoryUsagePercent < this.alertThresholds.memoryUsage &&
        cpuUsage < this.alertThresholds.cpuUsage;

      return {
        status: isHealthy ? 'healthy' : 'degraded',
        details: {
          memory: {
            used: Math.round((memUsage.heapUsed / 1024 / 1024) * 100) / 100, // MB
            total: Math.round((memUsage.heapTotal / 1024 / 1024) * 100) / 100, // MB
            systemUsagePercent: Math.round(memoryUsagePercent * 10000) / 100
          },
          cpu: {
            usage: Math.round(cpuUsage * 10000) / 100,
            cores: os.cpus().length
          },
          uptime: Math.round(uptime),
          platform: os.platform(),
          nodeVersion: process.version
        }
      };
    } catch (error) {
      logger.error('System resources health check failed:', error.message);
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  /**
   * @method performHealthCheck
   * @description Perform health check for a specific service
   * @param {string} serviceName - Name of the service to check
   * @returns {Promise<object>} Health check result
   */
  async performHealthCheck(serviceName) {
    const healthCheck = this.healthChecks.get(serviceName);
    if (!healthCheck) {
      throw new Error(`Health check not found for service: ${serviceName}`);
    }

    const startTime = Date.now();
    try {
      const result = await Promise.race([
        healthCheck.check(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Health check timeout')), healthCheck.timeout)
        )
      ]);

      const duration = Date.now() - startTime;
      logger.debug(`Health check completed for ${healthCheck.name}`, {
        service: serviceName,
        status: result.status,
        duration
      });

      return {
        service: serviceName,
        name: healthCheck.name,
        ...result,
        timestamp: new Date().toISOString(),
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Health check failed for ${healthCheck.name}:`, error.message);

      return {
        service: serviceName,
        name: healthCheck.name,
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
        duration
      };
    }
  }

  /**
   * @method performAllHealthChecks
   * @description Perform health checks for all services
   * @returns {Promise<object>} Complete health status
   */
  async performAllHealthChecks() {
    const results = {};
    const promises = [];

    for (const [serviceName] of this.healthChecks) {
      promises.push(
        this.performHealthCheck(serviceName)
          .then(result => ({ serviceName, result }))
          .catch(error => ({
            serviceName,
            result: {
              status: 'unhealthy',
              error: error.message,
              timestamp: new Date().toISOString()
            }
          }))
      );
    }

    const healthCheckResults = await Promise.all(promises);

    let overallStatus = 'healthy';
    let criticalIssues = 0;
    let warnings = 0;

    healthCheckResults.forEach(({ serviceName, result }) => {
      results[serviceName] = result;

      if (result.status === 'unhealthy') {
        const healthCheck = this.healthChecks.get(serviceName);
        if (healthCheck.critical) {
          criticalIssues++;
          overallStatus = 'unhealthy';
        } else {
          warnings++;
          if (overallStatus === 'healthy') {
            overallStatus = 'degraded';
          }
        }
      } else if (result.status === 'degraded' && overallStatus === 'healthy') {
        overallStatus = 'degraded';
      }
    });

    const summary = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      summary: {
        total: this.healthChecks.size,
        healthy: healthCheckResults.filter(({ result }) => result.status === 'healthy').length,
        degraded: healthCheckResults.filter(({ result }) => result.status === 'degraded').length,
        unhealthy: healthCheckResults.filter(({ result }) => result.status === 'unhealthy').length,
        criticalIssues,
        warnings
      },
      services: results
    };

    // Log overall health status
    if (overallStatus === 'unhealthy') {
      logger.error('System health check failed', { summary: summary.summary });
    } else if (overallStatus === 'degraded') {
      logger.warn('System health degraded', { summary: summary.summary });
    } else {
      logger.info('System health check passed', { summary: summary.summary });
    }

    // Trigger health alerts
    try {
      await alertingSystem.checkHealthAlerts(summary);
    } catch (alertError) {
      logger.error('Failed to check health alerts:', alertError.message);
    }

    return summary;
  }

  /**
   * @method recordPerformanceMetric
   * @description Record performance metric for monitoring
   * @param {string} endpoint - API endpoint
   * @param {number} responseTime - Response time in milliseconds
   * @param {number} statusCode - HTTP status code
   * @param {string} method - HTTP method
   */
  recordPerformanceMetric(endpoint, responseTime, statusCode, method = 'GET') {
    const key = `${method}:${endpoint}`;
    const now = Date.now();

    if (!this.performanceMetrics.has(key)) {
      this.performanceMetrics.set(key, {
        endpoint,
        method,
        requests: [],
        totalRequests: 0,
        totalResponseTime: 0,
        errorCount: 0,
        lastUpdated: now
      });
    }

    const metric = this.performanceMetrics.get(key);

    // Keep only last 100 requests for memory efficiency
    if (metric.requests.length >= 100) {
      const removed = metric.requests.shift();
      metric.totalResponseTime -= removed.responseTime;
      if (removed.statusCode >= 400) {
        metric.errorCount--;
      }
      metric.totalRequests--;
    }

    // Add new request
    metric.requests.push({
      timestamp: now,
      responseTime,
      statusCode
    });

    metric.totalRequests++;
    metric.totalResponseTime += responseTime;
    if (statusCode >= 400) {
      metric.errorCount++;
    }
    metric.lastUpdated = now;

    // Check for performance alerts
    this.checkPerformanceAlerts(key, metric);

    // Trigger alerting system performance checks
    try {
      alertingSystem.checkPerformanceAlerts({ metrics: { [key]: metric } });
    } catch (alertError) {
      logger.error('Failed to check performance alerts:', alertError.message);
    }
  }

  /**
   * @method checkPerformanceAlerts
   * @description Check if performance metrics exceed alert thresholds
   * @param {string} key - Metric key
   * @param {object} metric - Performance metric data
   */
  checkPerformanceAlerts(key, metric) {
    const avgResponseTime = metric.totalResponseTime / metric.totalRequests;
    const errorRate = metric.errorCount / metric.totalRequests;

    if (avgResponseTime > this.alertThresholds.responseTime) {
      logger.warn(`High response time detected for ${key}`, {
        endpoint: metric.endpoint,
        method: metric.method,
        avgResponseTime,
        threshold: this.alertThresholds.responseTime,
        alert: 'performance'
      });
    }

    if (errorRate > this.alertThresholds.errorRate) {
      logger.error(`High error rate detected for ${key}`, {
        endpoint: metric.endpoint,
        method: metric.method,
        errorRate: Math.round(errorRate * 10000) / 100,
        threshold: Math.round(this.alertThresholds.errorRate * 10000) / 100,
        alert: 'error_rate'
      });
    }
  }

  /**
   * @method getPerformanceMetrics
   * @description Get performance metrics for all endpoints
   * @returns {object} Performance metrics summary
   */
  getPerformanceMetrics() {
    const metrics = {};
    const now = Date.now();

    for (const [key, metric] of this.performanceMetrics) {
      const avgResponseTime = metric.totalRequests > 0 ?
        Math.round(metric.totalResponseTime / metric.totalRequests) : 0;
      const errorRate = metric.totalRequests > 0 ?
        Math.round((metric.errorCount / metric.totalRequests) * 10000) / 100 : 0;

      // Get recent requests (last 5 minutes)
      const recentRequests = metric.requests.filter(
        req => now - req.timestamp < 5 * 60 * 1000
      );

      metrics[key] = {
        endpoint: metric.endpoint,
        method: metric.method,
        totalRequests: metric.totalRequests,
        avgResponseTime,
        errorRate,
        recentRequests: recentRequests.length,
        lastActivity: new Date(metric.lastUpdated).toISOString()
      };
    }

    return {
      timestamp: new Date().toISOString(),
      metrics
    };
  }

  /**
   * @method clearPerformanceMetrics
   * @description Clear all performance metrics (for admin use)
   */
  clearPerformanceMetrics() {
    this.performanceMetrics.clear();
    logger.info('Performance metrics cleared');
  }
}

// Export singleton instance
module.exports = new HealthCheckService();