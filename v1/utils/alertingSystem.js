// v1/utils/alertingSystem.js
const logger = require('./logger');
const { sendEmail } = require('./emailService');

/**
 * @class AlertingSystem
 * @description System for managing and sending alerts for critical system failures
 */
class AlertingSystem {
  constructor() {
    this.alertThresholds = {
      responseTime: 5000, // 5 seconds
      errorRate: 0.05, // 5%
      memoryUsage: 0.85, // 85%
      cpuUsage: 0.80, // 80%
      diskUsage: 0.90, // 90%
      consecutiveFailures: 3
    };
    
    this.alertHistory = new Map();
    this.cooldownPeriod = 15 * 60 * 1000; // 15 minutes
    this.adminEmails = (process.env.ADMIN_ALERT_EMAILS || '').split(',').filter(email => email.trim());
  }

  /**
   * @method checkHealthAlerts
   * @description Check health status and trigger alerts if necessary
   * @param {object} healthStatus - Health check results
   */
  async checkHealthAlerts(healthStatus) {
    try {
      // Check overall system health
      if (healthStatus.status === 'unhealthy') {
        await this.triggerAlert('SYSTEM_UNHEALTHY', {
          message: 'System health check failed',
          details: healthStatus.summary,
          failedServices: Object.entries(healthStatus.services)
            .filter(([_, service]) => service.status === 'unhealthy')
            .map(([name, service]) => ({ name, error: service.error }))
        });
      }

      // Check individual services
      for (const [serviceName, serviceHealth] of Object.entries(healthStatus.services)) {
        if (serviceHealth.status === 'unhealthy') {
          await this.triggerAlert('SERVICE_UNHEALTHY', {
            service: serviceName,
            message: `Service ${serviceName} is unhealthy`,
            error: serviceHealth.error,
            details: serviceHealth.details
          });
        }

        // Check response time alerts
        if (serviceHealth.responseTime && serviceHealth.responseTime > this.alertThresholds.responseTime) {
          await this.triggerAlert('HIGH_RESPONSE_TIME', {
            service: serviceName,
            responseTime: serviceHealth.responseTime,
            threshold: this.alertThresholds.responseTime,
            message: `High response time detected for ${serviceName}`
          });
        }
      }

      // Check system resources
      const systemService = healthStatus.services.system;
      if (systemService && systemService.details) {
        const { memory, cpu } = systemService.details;
        
        if (memory && memory.systemUsagePercent > this.alertThresholds.memoryUsage * 100) {
          await this.triggerAlert('HIGH_MEMORY_USAGE', {
            usage: memory.systemUsagePercent,
            threshold: this.alertThresholds.memoryUsage * 100,
            message: 'High memory usage detected'
          });
        }

        if (cpu && cpu.usage > this.alertThresholds.cpuUsage * 100) {
          await this.triggerAlert('HIGH_CPU_USAGE', {
            usage: cpu.usage,
            threshold: this.alertThresholds.cpuUsage * 100,
            message: 'High CPU usage detected'
          });
        }
      }
    } catch (error) {
      logger.error('Failed to check health alerts:', error.message);
    }
  }

  /**
   * @method checkPerformanceAlerts
   * @description Check performance metrics and trigger alerts
   * @param {object} performanceMetrics - Performance metrics data
   */
  async checkPerformanceAlerts(performanceMetrics) {
    try {
      for (const [endpoint, metrics] of Object.entries(performanceMetrics.metrics)) {
        // Check error rate
        if (metrics.errorRate > this.alertThresholds.errorRate * 100) {
          await this.triggerAlert('HIGH_ERROR_RATE', {
            endpoint: metrics.endpoint,
            method: metrics.method,
            errorRate: metrics.errorRate,
            threshold: this.alertThresholds.errorRate * 100,
            message: `High error rate detected for ${metrics.method} ${metrics.endpoint}`
          });
        }

        // Check average response time
        if (metrics.avgResponseTime > this.alertThresholds.responseTime) {
          await this.triggerAlert('SLOW_ENDPOINT', {
            endpoint: metrics.endpoint,
            method: metrics.method,
            avgResponseTime: metrics.avgResponseTime,
            threshold: this.alertThresholds.responseTime,
            message: `Slow response time detected for ${metrics.method} ${metrics.endpoint}`
          });
        }
      }
    } catch (error) {
      logger.error('Failed to check performance alerts:', error.message);
    }
  }

  /**
   * @method triggerAlert
   * @description Trigger an alert with cooldown management
   * @param {string} alertType - Type of alert
   * @param {object} alertData - Alert data
   */
  async triggerAlert(alertType, alertData) {
    const alertKey = `${alertType}:${JSON.stringify(alertData)}`;
    const now = Date.now();
    
    // Check if alert is in cooldown period
    const lastAlert = this.alertHistory.get(alertKey);
    if (lastAlert && (now - lastAlert.timestamp) < this.cooldownPeriod) {
      return; // Skip alert due to cooldown
    }

    // Record alert
    this.alertHistory.set(alertKey, {
      timestamp: now,
      alertType,
      alertData
    });

    // Log alert
    logger.error(`ALERT: ${alertType}`, {
      alertType,
      alertData,
      timestamp: new Date(now).toISOString()
    });

    // Send notifications
    await this.sendAlertNotifications(alertType, alertData);

    // Clean up old alert history (keep last 1000 alerts)
    if (this.alertHistory.size > 1000) {
      const entries = Array.from(this.alertHistory.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toDelete = entries.slice(0, entries.length - 1000);
      toDelete.forEach(([key]) => this.alertHistory.delete(key));
    }
  }

  /**
   * @method sendAlertNotifications
   * @description Send alert notifications via email and other channels
   * @param {string} alertType - Type of alert
   * @param {object} alertData - Alert data
   */
  async sendAlertNotifications(alertType, alertData) {
    try {
      // Send email notifications to admins
      if (this.adminEmails.length > 0) {
        const emailSubject = this.getAlertEmailSubject(alertType);
        const emailBody = this.getAlertEmailBody(alertType, alertData);

        for (const email of this.adminEmails) {
          try {
            await sendEmail({
              to: email,
              subject: emailSubject,
              html: emailBody
            });
          } catch (emailError) {
            logger.error(`Failed to send alert email to ${email}:`, emailError.message);
          }
        }
      }

      // Here you could add other notification channels like:
      // - Slack webhooks
      // - SMS notifications
      // - Push notifications
      // - PagerDuty integration
      
    } catch (error) {
      logger.error('Failed to send alert notifications:', error.message);
    }
  }

  /**
   * @method getAlertEmailSubject
   * @description Generate email subject for alert
   * @param {string} alertType - Type of alert
   * @returns {string} Email subject
   */
  getAlertEmailSubject(alertType) {
    const subjects = {
      SYSTEM_UNHEALTHY: '🚨 CRITICAL: System Health Failure',
      SERVICE_UNHEALTHY: '⚠️ Service Health Alert',
      HIGH_RESPONSE_TIME: '🐌 Performance Alert: High Response Time',
      HIGH_ERROR_RATE: '❌ Error Rate Alert',
      SLOW_ENDPOINT: '🐌 Endpoint Performance Alert',
      HIGH_MEMORY_USAGE: '💾 Memory Usage Alert',
      HIGH_CPU_USAGE: '⚡ CPU Usage Alert'
    };

    return subjects[alertType] || `🔔 System Alert: ${alertType}`;
  }

  /**
   * @method getAlertEmailBody
   * @description Generate email body for alert
   * @param {string} alertType - Type of alert
   * @param {object} alertData - Alert data
   * @returns {string} Email body HTML
   */
  getAlertEmailBody(alertType, alertData) {
    const timestamp = new Date().toISOString();
    const environment = process.env.NODE_ENV || 'development';

    let alertDetails = '';
    
    switch (alertType) {
      case 'SYSTEM_UNHEALTHY':
        alertDetails = `
          <p><strong>Failed Services:</strong></p>
          <ul>
            ${alertData.failedServices.map(service => 
              `<li>${service.name}: ${service.error}</li>`
            ).join('')}
          </ul>
          <p><strong>Summary:</strong> ${JSON.stringify(alertData.details, null, 2)}</p>
        `;
        break;
        
      case 'SERVICE_UNHEALTHY':
        alertDetails = `
          <p><strong>Service:</strong> ${alertData.service}</p>
          <p><strong>Error:</strong> ${alertData.error}</p>
          <p><strong>Details:</strong> ${JSON.stringify(alertData.details, null, 2)}</p>
        `;
        break;
        
      case 'HIGH_RESPONSE_TIME':
        alertDetails = `
          <p><strong>Service:</strong> ${alertData.service}</p>
          <p><strong>Response Time:</strong> ${alertData.responseTime}ms</p>
          <p><strong>Threshold:</strong> ${alertData.threshold}ms</p>
        `;
        break;
        
      case 'HIGH_ERROR_RATE':
      case 'SLOW_ENDPOINT':
        alertDetails = `
          <p><strong>Endpoint:</strong> ${alertData.method} ${alertData.endpoint}</p>
          <p><strong>Current Value:</strong> ${alertData.errorRate || alertData.avgResponseTime}${alertData.errorRate ? '%' : 'ms'}</p>
          <p><strong>Threshold:</strong> ${alertData.threshold}${alertData.errorRate ? '%' : 'ms'}</p>
        `;
        break;
        
      case 'HIGH_MEMORY_USAGE':
      case 'HIGH_CPU_USAGE':
        alertDetails = `
          <p><strong>Current Usage:</strong> ${alertData.usage}%</p>
          <p><strong>Threshold:</strong> ${alertData.threshold}%</p>
        `;
        break;
        
      default:
        alertDetails = `<p><strong>Alert Data:</strong> ${JSON.stringify(alertData, null, 2)}</p>`;
    }

    return `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #d32f2f; border-bottom: 2px solid #d32f2f; padding-bottom: 10px;">
              System Alert: ${alertType}
            </h2>
            
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Message:</strong> ${alertData.message}</p>
              <p><strong>Environment:</strong> ${environment}</p>
              <p><strong>Timestamp:</strong> ${timestamp}</p>
            </div>
            
            <div style="margin: 20px 0;">
              <h3>Alert Details:</h3>
              ${alertDetails}
            </div>
            
            <div style="background-color: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3>Recommended Actions:</h3>
              <ul>
                <li>Check system logs for more details</li>
                <li>Verify service configurations</li>
                <li>Monitor system resources</li>
                <li>Contact the development team if issues persist</li>
              </ul>
            </div>
            
            <hr style="margin: 30px 0;">
            <p style="font-size: 12px; color: #666;">
              This is an automated alert from The Travel Place API monitoring system.
            </p>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * @method getAlertHistory
   * @description Get recent alert history
   * @param {number} limit - Number of alerts to return
   * @returns {Array} Recent alerts
   */
  getAlertHistory(limit = 50) {
    const alerts = Array.from(this.alertHistory.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)
      .map(alert => ({
        ...alert,
        timestamp: new Date(alert.timestamp).toISOString()
      }));

    return alerts;
  }

  /**
   * @method clearAlertHistory
   * @description Clear alert history
   */
  clearAlertHistory() {
    this.alertHistory.clear();
    logger.info('Alert history cleared');
  }

  /**
   * @method updateThresholds
   * @description Update alert thresholds
   * @param {object} newThresholds - New threshold values
   */
  updateThresholds(newThresholds) {
    this.alertThresholds = { ...this.alertThresholds, ...newThresholds };
    logger.info('Alert thresholds updated', { thresholds: this.alertThresholds });
  }
}

// Export singleton instance
module.exports = new AlertingSystem();