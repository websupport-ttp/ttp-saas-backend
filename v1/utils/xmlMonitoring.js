// v1/utils/xmlMonitoring.js
const logger = require('./logger');
const { performance } = require('perf_hooks');

/**
 * @class XmlMonitoring
 * @description Monitoring utilities for XML processing operations
 * Provides structured logging, performance metrics, and alerting for XML operations
 */
class XmlMonitoring {
    constructor() {
        this.contextLogger = logger.createContextualLogger('XmlMonitoring');
        
        // Performance metrics storage
        this.metrics = {
            xmlProcessingTimes: [],
            jsonProcessingTimes: [],
            soapCallTimes: [],
            xmlParsingTimes: [],
            xmlTransformationTimes: [],
            errorCounts: {
                parsing: 0,
                timeout: 0,
                connection: 0,
                authentication: 0,
                soapFault: 0
            },
            operationCounts: {
                search: 0,
                booking: 0,
                authentication: 0
            }
        };

        // Alert thresholds
        this.thresholds = {
            xmlProcessingTime: parseInt(process.env.XML_PROCESSING_ALERT_THRESHOLD) || 5000, // 5 seconds
            errorRate: parseFloat(process.env.XML_ERROR_RATE_THRESHOLD) || 0.1, // 10%
            timeoutThreshold: parseInt(process.env.XML_TIMEOUT_ALERT_THRESHOLD) || 30000, // 30 seconds
            consecutiveFailures: parseInt(process.env.XML_CONSECUTIVE_FAILURES_THRESHOLD) || 5
        };

        this.consecutiveFailures = 0;
        this.lastAlertTime = {};
        this.alertCooldown = 300000; // 5 minutes
    }

    /**
     * Start monitoring an XML operation
     * @param {string} operation - Operation name (search, booking, authentication)
     * @param {object} context - Operation context
     * @returns {object} Monitoring context for the operation
     */
    startXmlOperation(operation, context = {}) {
        const operationId = this._generateOperationId();
        const startTime = performance.now();

        const monitoringContext = {
            operationId,
            operation,
            startTime,
            context,
            metrics: {
                xmlProcessingTime: 0,
                soapCallTime: 0,
                parsingTime: 0,
                transformationTime: 0
            }
        };

        this.contextLogger.info('XML operation started', {
            operationId,
            operation,
            context: this._sanitizeContext(context)
        });

        // Increment operation counter
        if (this.metrics.operationCounts[operation] !== undefined) {
            this.metrics.operationCounts[operation]++;
        }

        return monitoringContext;
    }

    /**
     * Record SOAP call timing
     * @param {object} monitoringContext - Monitoring context from startXmlOperation
     * @param {string} soapOperation - SOAP operation name
     * @param {number} duration - Duration in milliseconds
     * @param {boolean} success - Whether the call was successful
     */
    recordSoapCall(monitoringContext, soapOperation, duration, success = true) {
        monitoringContext.metrics.soapCallTime += duration;
        this.metrics.soapCallTimes.push(duration);

        this.contextLogger.debug('SOAP call completed', {
            operationId: monitoringContext.operationId,
            soapOperation,
            duration,
            success
        });

        // Check for performance alerts
        if (duration > this.thresholds.xmlProcessingTime) {
            this._triggerPerformanceAlert('soap_call_slow', {
                operationId: monitoringContext.operationId,
                soapOperation,
                duration,
                threshold: this.thresholds.xmlProcessingTime
            });
        }
    }

    /**
     * Record XML parsing timing
     * @param {object} monitoringContext - Monitoring context
     * @param {number} duration - Parsing duration in milliseconds
     * @param {number} xmlSize - Size of XML in bytes
     * @param {boolean} success - Whether parsing was successful
     */
    recordXmlParsing(monitoringContext, duration, xmlSize = 0, success = true) {
        monitoringContext.metrics.parsingTime += duration;
        this.metrics.xmlParsingTimes.push(duration);

        this.contextLogger.debug('XML parsing completed', {
            operationId: monitoringContext.operationId,
            duration,
            xmlSize,
            success,
            throughput: xmlSize > 0 ? Math.round(xmlSize / duration * 1000) : 0 // bytes per second
        });

        if (!success) {
            this.metrics.errorCounts.parsing++;
            this._recordFailure('xml_parsing');
        }
    }

    /**
     * Record XML transformation timing
     * @param {object} monitoringContext - Monitoring context
     * @param {string} transformationType - Type of transformation (xml_to_json, json_to_xml)
     * @param {number} duration - Transformation duration in milliseconds
     * @param {boolean} success - Whether transformation was successful
     */
    recordXmlTransformation(monitoringContext, transformationType, duration, success = true) {
        monitoringContext.metrics.transformationTime += duration;
        this.metrics.xmlTransformationTimes.push(duration);

        this.contextLogger.debug('XML transformation completed', {
            operationId: monitoringContext.operationId,
            transformationType,
            duration,
            success
        });

        if (!success) {
            this._recordFailure('xml_transformation');
        }
    }

    /**
     * Record XML processing error
     * @param {object} monitoringContext - Monitoring context
     * @param {string} errorType - Type of error (parsing, timeout, connection, authentication, soapFault)
     * @param {Error} error - The error object
     * @param {object} additionalContext - Additional error context
     */
    recordXmlError(monitoringContext, errorType, error, additionalContext = {}) {
        // Increment error counter
        if (this.metrics.errorCounts[errorType] !== undefined) {
            this.metrics.errorCounts[errorType]++;
        }

        this.contextLogger.error('XML operation error', {
            operationId: monitoringContext.operationId,
            operation: monitoringContext.operation,
            errorType,
            error: error.message,
            stack: error.stack,
            ...additionalContext
        });

        this._recordFailure(errorType);

        // Check for error rate alerts
        this._checkErrorRateAlert(errorType);
    }

    /**
     * Complete XML operation monitoring
     * @param {object} monitoringContext - Monitoring context
     * @param {boolean} success - Whether the operation was successful
     * @param {object} result - Operation result (optional)
     */
    completeXmlOperation(monitoringContext, success = true, result = null) {
        const totalDuration = performance.now() - monitoringContext.startTime;
        monitoringContext.metrics.xmlProcessingTime = totalDuration;

        // Store metrics for comparison
        this.metrics.xmlProcessingTimes.push(totalDuration);

        // Log operation completion
        this.contextLogger.info('XML operation completed', {
            operationId: monitoringContext.operationId,
            operation: monitoringContext.operation,
            success,
            totalDuration,
            metrics: monitoringContext.metrics,
            resultSize: result ? JSON.stringify(result).length : 0
        });

        if (success) {
            this.consecutiveFailures = 0;
        } else {
            this._recordFailure('operation_failure');
        }

        // Performance comparison logging
        this._logPerformanceComparison(monitoringContext.operation, totalDuration);

        return {
            operationId: monitoringContext.operationId,
            duration: totalDuration,
            metrics: monitoringContext.metrics,
            success
        };
    }

    /**
     * Record JSON processing time for comparison
     * @param {string} operation - Operation name
     * @param {number} duration - Processing duration in milliseconds
     */
    recordJsonProcessingTime(operation, duration) {
        this.metrics.jsonProcessingTimes.push(duration);

        this.contextLogger.debug('JSON processing completed', {
            operation,
            duration,
            type: 'json_processing'
        });
    }

    /**
     * Get performance metrics summary
     * @returns {object} Performance metrics summary
     */
    getPerformanceMetrics() {
        const xmlAvg = this._calculateAverage(this.metrics.xmlProcessingTimes);
        const jsonAvg = this._calculateAverage(this.metrics.jsonProcessingTimes);
        const soapAvg = this._calculateAverage(this.metrics.soapCallTimes);
        const parsingAvg = this._calculateAverage(this.metrics.xmlParsingTimes);

        return {
            averageProcessingTimes: {
                xml: xmlAvg,
                json: jsonAvg,
                soap: soapAvg,
                parsing: parsingAvg,
                xmlVsJsonRatio: jsonAvg > 0 ? (xmlAvg / jsonAvg).toFixed(2) : 'N/A'
            },
            operationCounts: { ...this.metrics.operationCounts },
            errorCounts: { ...this.metrics.errorCounts },
            totalErrors: Object.values(this.metrics.errorCounts).reduce((sum, count) => sum + count, 0),
            errorRate: this._calculateErrorRate(),
            consecutiveFailures: this.consecutiveFailures,
            metricsCollectedAt: new Date().toISOString()
        };
    }

    /**
     * Reset metrics (useful for testing or periodic resets)
     */
    resetMetrics() {
        this.metrics = {
            xmlProcessingTimes: [],
            jsonProcessingTimes: [],
            soapCallTimes: [],
            xmlParsingTimes: [],
            xmlTransformationTimes: [],
            errorCounts: {
                parsing: 0,
                timeout: 0,
                connection: 0,
                authentication: 0,
                soapFault: 0
            },
            operationCounts: {
                search: 0,
                booking: 0,
                authentication: 0
            }
        };

        this.consecutiveFailures = 0;
        this.contextLogger.info('XML monitoring metrics reset');
    }

    /**
     * Generate unique operation ID
     * @private
     */
    _generateOperationId() {
        return `xml_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Sanitize context for logging (remove sensitive data)
     * @private
     */
    _sanitizeContext(context) {
        const sanitized = { ...context };
        
        // Remove sensitive fields
        const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'authorization'];
        sensitiveFields.forEach(field => {
            if (sanitized[field]) {
                sanitized[field] = '[REDACTED]';
            }
        });

        return sanitized;
    }

    /**
     * Calculate average from array of numbers
     * @private
     */
    _calculateAverage(numbers) {
        if (numbers.length === 0) return 0;
        const sum = numbers.reduce((acc, num) => acc + num, 0);
        return Math.round(sum / numbers.length);
    }

    /**
     * Calculate current error rate
     * @private
     */
    _calculateErrorRate() {
        const totalOperations = Object.values(this.metrics.operationCounts).reduce((sum, count) => sum + count, 0);
        const totalErrors = Object.values(this.metrics.errorCounts).reduce((sum, count) => sum + count, 0);
        
        if (totalOperations === 0) return 0;
        return (totalErrors / totalOperations).toFixed(4);
    }

    /**
     * Record a failure and check for consecutive failure alerts
     * @private
     */
    _recordFailure(failureType) {
        this.consecutiveFailures++;

        if (this.consecutiveFailures >= this.thresholds.consecutiveFailures) {
            this._triggerAlert('consecutive_failures', {
                failureType,
                consecutiveFailures: this.consecutiveFailures,
                threshold: this.thresholds.consecutiveFailures
            });
        }
    }

    /**
     * Check if error rate exceeds threshold and trigger alert
     * @private
     */
    _checkErrorRateAlert(errorType) {
        const errorRate = parseFloat(this._calculateErrorRate());
        
        if (errorRate > this.thresholds.errorRate) {
            this._triggerAlert('high_error_rate', {
                errorType,
                currentErrorRate: errorRate,
                threshold: this.thresholds.errorRate,
                errorCounts: this.metrics.errorCounts
            });
        }
    }

    /**
     * Trigger performance alert
     * @private
     */
    _triggerPerformanceAlert(alertType, context) {
        const alertKey = `${alertType}_${context.operationId || 'general'}`;
        const now = Date.now();

        // Check cooldown
        if (this.lastAlertTime[alertKey] && (now - this.lastAlertTime[alertKey]) < this.alertCooldown) {
            return;
        }

        this.lastAlertTime[alertKey] = now;

        this.contextLogger.warn('XML performance alert triggered', {
            alertType,
            ...context,
            timestamp: new Date().toISOString()
        });

        // In a production environment, this would integrate with alerting systems
        // like PagerDuty, Slack, or email notifications
    }

    /**
     * Trigger general alert
     * @private
     */
    _triggerAlert(alertType, context) {
        const alertKey = alertType;
        const now = Date.now();

        // Check cooldown
        if (this.lastAlertTime[alertKey] && (now - this.lastAlertTime[alertKey]) < this.alertCooldown) {
            return;
        }

        this.lastAlertTime[alertKey] = now;

        this.contextLogger.error('XML monitoring alert triggered', {
            alertType,
            ...context,
            timestamp: new Date().toISOString()
        });

        // In a production environment, this would integrate with alerting systems
    }

    /**
     * Log performance comparison between XML and JSON processing
     * @private
     */
    _logPerformanceComparison(operation, xmlDuration) {
        const recentJsonTimes = this.metrics.jsonProcessingTimes.slice(-10); // Last 10 JSON operations
        const recentXmlTimes = this.metrics.xmlProcessingTimes.slice(-10); // Last 10 XML operations

        if (recentJsonTimes.length > 0 && recentXmlTimes.length > 0) {
            const jsonAvg = this._calculateAverage(recentJsonTimes);
            const xmlAvg = this._calculateAverage(recentXmlTimes);
            const performanceRatio = jsonAvg > 0 ? (xmlAvg / jsonAvg).toFixed(2) : 'N/A';

            this.contextLogger.info('XML vs JSON performance comparison', {
                operation,
                currentXmlDuration: Math.round(xmlDuration),
                averageXmlDuration: xmlAvg,
                averageJsonDuration: jsonAvg,
                xmlToJsonRatio: performanceRatio,
                interpretation: performanceRatio > 1 ? 'XML slower than JSON' : 'XML faster than JSON'
            });
        }
    }
}

// Export singleton instance
module.exports = new XmlMonitoring();