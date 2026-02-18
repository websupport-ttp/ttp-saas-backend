/**
 * XML Error Handler Utility
 * Handles XML parsing errors, SOAP faults, and connection errors for Amadeus XML services
 */

const { parseStringPromise } = require('xml2js');

class XmlErrorHandler {
  /**
   * Parse and transform SOAP fault responses
   * @param {string} xmlString - Raw XML response containing SOAP fault
   * @returns {Object} Standardized error object
   */
  static async parseSoapFault(xmlString) {
    try {
      const parsed = await parseStringPromise(xmlString, {
        explicitArray: false,
        ignoreAttrs: false,
        tagNameProcessors: [name => name.replace(/^soap:/, '')]
      });

      const fault = parsed?.Envelope?.Body?.Fault || parsed?.Fault;
      
      if (!fault) {
        return this.createStandardError('SOAP_FAULT_PARSE_ERROR', 'Unable to parse SOAP fault structure');
      }

      return {
        success: false,
        error: {
          code: 'AMADEUS_SOAP_FAULT',
          message: fault.faultstring || fault.Reason?.Text || 'SOAP fault occurred',
          details: {
            faultCode: fault.faultcode || fault.Code?.Value,
            faultString: fault.faultstring || fault.Reason?.Text,
            faultActor: fault.faultactor,
            detail: fault.detail,
            timestamp: new Date().toISOString(),
            source: 'amadeus_xml_service'
          }
        }
      };
    } catch (parseError) {
      return this.createStandardError('SOAP_FAULT_PARSE_ERROR', 'Failed to parse SOAP fault XML', {
        parseError: parseError.message,
        xmlString: xmlString?.substring(0, 500) // Truncate for logging
      });
    }
  }

  /**
   * Handle XML parsing errors
   * @param {Error} error - XML parsing error
   * @param {string} xmlString - Original XML string that failed to parse
   * @returns {Object} Standardized error object
   */
  static handleXmlParsingError(error, xmlString = '') {
    const errorDetails = {
      parseError: error.message,
      errorType: error.constructor.name,
      timestamp: new Date().toISOString(),
      source: 'xml_parser'
    };

    // Add XML snippet for debugging (truncated)
    if (xmlString) {
      errorDetails.xmlSnippet = xmlString.substring(0, 200);
    }

    // Categorize common XML parsing errors
    if (error.message.includes('Unexpected end of input')) {
      return this.createStandardError('XML_INCOMPLETE', 'Incomplete XML response received', errorDetails);
    }
    
    if (error.message.includes('Invalid character')) {
      return this.createStandardError('XML_INVALID_CHARACTER', 'Invalid character in XML response', errorDetails);
    }
    
    if (error.message.includes('Unclosed tag')) {
      return this.createStandardError('XML_UNCLOSED_TAG', 'Malformed XML with unclosed tags', errorDetails);
    }

    return this.createStandardError('XML_PARSE_ERROR', 'Failed to parse XML response', errorDetails);
  }

  /**
   * Handle timeout errors for XML service calls
   * @param {number} timeout - Timeout duration in milliseconds
   * @param {string} operation - Operation that timed out
   * @returns {Object} Standardized error object
   */
  static handleTimeoutError(timeout, operation = 'XML request') {
    return this.createStandardError('XML_TIMEOUT', `${operation} timed out after ${timeout}ms`, {
      timeout,
      operation,
      timestamp: new Date().toISOString(),
      source: 'xml_service_timeout',
      suggestion: 'Consider increasing timeout or checking network connectivity'
    });
  }

  /**
   * Handle connection errors for XML services
   * @param {Error} error - Connection error
   * @param {string} endpoint - Endpoint that failed to connect
   * @returns {Object} Standardized error object
   */
  static handleConnectionError(error, endpoint = '') {
    const errorDetails = {
      connectionError: error.message,
      errorCode: error.code,
      endpoint,
      timestamp: new Date().toISOString(),
      source: 'xml_service_connection'
    };

    // Categorize common connection errors
    if (error.code === 'ECONNREFUSED') {
      return this.createStandardError('XML_CONNECTION_REFUSED', 'Connection refused by XML service', {
        ...errorDetails,
        suggestion: 'Check if the Amadeus XML service is available and endpoint is correct'
      });
    }
    
    if (error.code === 'ENOTFOUND') {
      return this.createStandardError('XML_HOST_NOT_FOUND', 'XML service host not found', {
        ...errorDetails,
        suggestion: 'Verify the XML endpoint URL in configuration'
      });
    }
    
    if (error.code === 'ETIMEDOUT') {
      return this.createStandardError('XML_CONNECTION_TIMEOUT', 'Connection to XML service timed out', {
        ...errorDetails,
        suggestion: 'Check network connectivity and service availability'
      });
    }

    return this.createStandardError('XML_CONNECTION_ERROR', 'Failed to connect to XML service', errorDetails);
  }

  /**
   * Handle authentication errors for XML services
   * @param {Object} response - Authentication response
   * @returns {Object} Standardized error object
   */
  static handleAuthenticationError(response = {}) {
    return this.createStandardError('XML_AUTHENTICATION_FAILED', 'Authentication with Amadeus XML service failed', {
      statusCode: response.statusCode,
      response: response.body?.substring(0, 300), // Truncate response
      timestamp: new Date().toISOString(),
      source: 'xml_authentication',
      suggestion: 'Verify XML credentials (username, password, office ID) in environment configuration'
    });
  }

  /**
   * Handle schema validation errors
   * @param {Array} validationErrors - Array of validation errors
   * @param {string} operation - Operation being validated
   * @returns {Object} Standardized error object
   */
  static handleSchemaValidationError(validationErrors, operation = 'XML validation') {
    return this.createStandardError('XML_SCHEMA_VALIDATION_ERROR', `Schema validation failed for ${operation}`, {
      validationErrors: validationErrors.map(err => ({
        path: err.path,
        message: err.message,
        value: err.value
      })),
      timestamp: new Date().toISOString(),
      source: 'xml_schema_validation'
    });
  }

  /**
   * Create a standardized error object
   * @param {string} code - Error code
   * @param {string} message - Error message
   * @param {Object} details - Additional error details
   * @returns {Object} Standardized error object
   */
  static createStandardError(code, message, details = {}) {
    return {
      success: false,
      error: {
        code,
        message,
        details: {
          ...details,
          timestamp: details.timestamp || new Date().toISOString()
        }
      }
    };
  }

  /**
   * Check if an error is retryable
   * @param {Object} error - Error object
   * @returns {boolean} Whether the error is retryable
   */
  static isRetryableError(error) {
    const retryableCodes = [
      'XML_TIMEOUT',
      'XML_CONNECTION_TIMEOUT',
      'XML_CONNECTION_REFUSED',
      'XML_INCOMPLETE'
    ];

    return retryableCodes.includes(error?.error?.code);
  }

  /**
   * Get retry delay based on attempt number
   * @param {number} attempt - Current attempt number (0-based)
   * @param {number} baseDelay - Base delay in milliseconds
   * @returns {number} Delay in milliseconds
   */
  static getRetryDelay(attempt, baseDelay = 1000) {
    // Exponential backoff with jitter
    const exponentialDelay = baseDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 0.1 * exponentialDelay;
    return Math.min(exponentialDelay + jitter, 30000); // Max 30 seconds
  }
}

module.exports = XmlErrorHandler;