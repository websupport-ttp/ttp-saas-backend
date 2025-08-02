// v1/utils/healthCheck.js
const logger = require('./logger');
const mongoose = require('mongoose');
const redisClient = require('../config/redis');

/**
 * @class HealthChecker
 * @description Comprehensive health checking utility for system components
 */
class HealthChecker {
  constructor() {
    this.checks = new Map();
    this.lastResults = new Map();
    this.setupDefaultChecks();
  }

  /**
   * Setup default health checks for core services
   */
  setupDefaultChecks() {
    this.addCheck('database', this.checkDatabase.bind(this));
    this.addCheck('redis', this.checkRedis.bind(this));
    this.addCheck('memory', this.checkMemory.bind(this));
    this.addCheck('disk', this.checkDisk.bind(this));
  }

  /**
   * Add a custom health check
   * @param {string} name - Check name
   * @param {Function} checkFunction - Async function that performs the check
   * @param {object} options - Check options (timeout, critical, etc.)
   */
  addCheck(name, checkFunction, options = {}) {
    this.checks.set(name, {
      fn: checkFunction,
      timeout: options.timeout || 5000,
      critical: options.critical !== false, // Default to critical
      description: options.description || `${name} health check`,
    });
  }

  /**
   * Remove a health check
   * @param {string} name - Check name to remove
   */
  removeCheck(name) {
    this.checks.delete(name);
    this.lastResults.delete(name);
  }

  /**
   * Check MongoDB database connection
   * @returns {Promise<object>} Health check result
   */
  async checkDatabase() {
    try {
      const state = mongoose.connection.readyState;
      const states = {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting'
      };

      if (state !== 1) {
        throw new Error(`Database state: ${states[state] || 'unknown'}`);
      }

      // Perform a simple query to verify connection
      await mongoose.connection.db.admin().ping();

      return {
        status: 'healthy',
        message: 'Database connection is healthy',
        details: {
          state: states[state],
          host: mongoose.connection.host,
          port: mongoose.connection.port,
          name: mongoose.connection.name
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Database connection failed',
        error: error.message,
        details: {
          state: mongoose.connection.readyState
        }
      };
    }
  }

  /**
   * Check Redis connection
   * @returns {Promise<object>} Health check result
   */
  async checkRedis() {
    try {
      if (!redisClient || !redisClient.isOpen) {
        throw new Error('Redis client is not connected');
      }

      // Perform a simple ping
      const result = await redisClient.ping();
      if (result !== 'PONG') {
        throw new Error('Redis ping failed');
      }

      return {
        status: 'healthy',
        message: 'Redis connection is healthy',
        details: {
          connected: redisClient.isOpen,
          ready: redisClient.isReady
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Redis connection failed',
        error: error.message,
        details: {
          connected: redisClient?.isOpen || false,
          ready: redisClient?.isReady || false
        }
      };
    }
  }

  /**
   * Check memory usage
   * @returns {Promise<object>} Health check result
   */
  async checkMemory() {
    try {
      const memUsage = process.memoryUsage();
      const totalMem = require('os').totalmem();
      const freeMem = require('os').freemem();
      const usedMem = totalMem - freeMem;
      const memoryUsagePercent = (usedMem / totalMem) * 100;

      const isHealthy = memoryUsagePercent < 90; // Consider unhealthy if > 90%

      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        message: isHealthy ? 'Memory usage is normal' : 'High memory usage detected',
        details: {
          processMemory: {
            rss: Math.round(memUsage.rss / 1024 / 1024), // MB
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
            external: Math.round(memUsage.external / 1024 / 1024) // MB
          },
          systemMemory: {
            total: Math.round(totalMem / 1024 / 1024), // MB
            free: Math.round(freeMem / 1024 / 1024), // MB
            used: Math.round(usedMem / 1024 / 1024), // MB
            usagePercent: Math.round(memoryUsagePercent)
          }
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Memory check failed',
        error: error.message
      };
    }
  }

  /**
   * Check disk usage
   * @returns {Promise<object>} Health check result
   */
  async checkDisk() {
    try {
      const fs = require('fs');
      const stats = fs.statSync('.');
      
      // This is a simplified disk check
      // In production, you might want to use a library like 'diskusage'
      return {
        status: 'healthy',
        message: 'Disk access is working',
        details: {
          accessible: true,
          // Add more disk metrics if needed
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Disk check failed',
        error: error.message
      };
    }
  }

  /**
   * Run a single health check with timeout
   * @param {string} name - Check name
   * @returns {Promise<object>} Health check result
   */
  async runSingleCheck(name) {
    const check = this.checks.get(name);
    if (!check) {
      return {
        status: 'error',
        message: `Health check '${name}' not found`
      };
    }

    const startTime = Date.now();
    
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), check.timeout);
      });

      const result = await Promise.race([
        check.fn(),
        timeoutPromise
      ]);

      const duration = Date.now() - startTime;
      
      const checkResult = {
        ...result,
        duration,
        timestamp: new Date().toISOString(),
        critical: check.critical,
        description: check.description
      };

      this.lastResults.set(name, checkResult);
      return checkResult;

    } catch (error) {
      const duration = Date.now() - startTime;
      const checkResult = {
        status: 'error',
        message: error.message,
        duration,
        timestamp: new Date().toISOString(),
        critical: check.critical,
        description: check.description
      };

      this.lastResults.set(name, checkResult);
      return checkResult;
    }
  }

  /**
   * Run all health checks
   * @param {Array<string>} checkNames - Specific checks to run (optional)
   * @returns {Promise<object>} Complete health status
   */
  async runAllChecks(checkNames = null) {
    const checksToRun = checkNames || Array.from(this.checks.keys());
    const results = {};
    const promises = checksToRun.map(async (name) => {
      results[name] = await this.runSingleCheck(name);
    });

    await Promise.all(promises);

    // Determine overall health
    const allChecks = Object.values(results);
    const criticalChecks = allChecks.filter(check => check.critical);
    const failedCriticalChecks = criticalChecks.filter(check => 
      check.status === 'unhealthy' || check.status === 'error'
    );

    const overallStatus = failedCriticalChecks.length > 0 ? 'unhealthy' : 'healthy';
    
    const summary = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks: results,
      summary: {
        total: allChecks.length,
        healthy: allChecks.filter(c => c.status === 'healthy').length,
        unhealthy: allChecks.filter(c => c.status === 'unhealthy').length,
        errors: allChecks.filter(c => c.status === 'error').length,
        critical: criticalChecks.length,
        failedCritical: failedCriticalChecks.length
      }
    };

    // Log health status
    if (overallStatus === 'unhealthy') {
      logger.error('System health check failed', {
        summary: summary.summary,
        failedChecks: failedCriticalChecks.map(c => c.description)
      });
    } else {
      logger.info('System health check passed', { summary: summary.summary });
    }

    return summary;
  }

  /**
   * Get the last results without running checks
   * @returns {object} Last health check results
   */
  getLastResults() {
    const results = {};
    for (const [name, result] of this.lastResults) {
      results[name] = result;
    }

    const allChecks = Object.values(results);
    const criticalChecks = allChecks.filter(check => check.critical);
    const failedCriticalChecks = criticalChecks.filter(check => 
      check.status === 'unhealthy' || check.status === 'error'
    );

    return {
      status: failedCriticalChecks.length > 0 ? 'unhealthy' : 'healthy',
      timestamp: new Date().toISOString(),
      checks: results,
      summary: {
        total: allChecks.length,
        healthy: allChecks.filter(c => c.status === 'healthy').length,
        unhealthy: allChecks.filter(c => c.status === 'unhealthy').length,
        errors: allChecks.filter(c => c.status === 'error').length,
        critical: criticalChecks.length,
        failedCritical: failedCriticalChecks.length
      }
    };
  }

  /**
   * Get system information
   * @returns {object} System information
   */
  getSystemInfo() {
    const os = require('os');
    return {
      node: {
        version: process.version,
        uptime: process.uptime(),
        pid: process.pid
      },
      system: {
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname(),
        uptime: os.uptime(),
        loadavg: os.loadavg(),
        cpus: os.cpus().length
      },
      environment: process.env.NODE_ENV || 'development'
    };
  }
}

// Create singleton instance
const healthChecker = new HealthChecker();

module.exports = healthChecker;