// v1/services/allianzService.js
const axios = require('axios');
const logger = require('../utils/logger');
const { ApiError } = require('../utils/apiError');
const { StatusCodes } = require('http-status-codes');
const sanlamAllianzErrorHandler = require('../utils/sanlamAllianzErrorHandler');

// Updated environment variables for SanlamAllianz API
const SANLAM_ALLIANZ_BASE_URL_TRAVEL = process.env.SANLAM_ALLIANZ_TRAVEL_BASE_URL;
const SANLAM_ALLIANZ_BASE_URL_INSTANT_PLAN = process.env.SANLAM_ALLIANZ_INSTANT_PLAN_BASE_URL;
const SANLAM_ALLIANZ_API_USERNAME = process.env.SANLAM_ALLIANZ_API_USERNAME;
const SANLAM_ALLIANZ_API_PASSWORD = process.env.SANLAM_ALLIANZ_API_PASSWORD;
const SANLAM_ALLIANZ_AUTH_BASE_URL = process.env.SANLAM_ALLIANZ_AUTH_BASE_URL || SANLAM_ALLIANZ_BASE_URL_INSTANT_PLAN;

// Token management with support for multiple base URLs
const authTokens = new Map();
const tokenExpiryTimes = new Map();

// Authentication configuration
const AUTH_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000, // 1 second base delay
  tokenRefreshBuffer: 5 * 60 * 1000, // 5 minutes before expiry
};

/**
 * @function authenticateAllianz
 * @description Authenticates with the SanlamAllianz API to get an access token.
 * Supports multiple base URLs with separate authentication and token refresh logic.
 * @param {string} baseUrl - Optional base URL for specific service authentication
 * @returns {string} The SanlamAllianz API authentication token.
 * @throws {ApiError} If authentication fails.
 */
const authenticateAllianz = async (baseUrl = null) => {
  const authUrl = baseUrl || SANLAM_ALLIANZ_AUTH_BASE_URL;
  const tokenKey = authUrl || 'default';
  
  // Check if we have a valid cached token
  const cachedToken = authTokens.get(tokenKey);
  const cachedExpiry = tokenExpiryTimes.get(tokenKey);
  
  if (cachedToken && cachedExpiry && Date.now() < (cachedExpiry - AUTH_CONFIG.tokenRefreshBuffer)) {
    logger.info(`Using cached SanlamAllianz token for ${tokenKey}`);
    return cachedToken;
  }

  // If token is close to expiry, try to refresh it
  if (cachedToken && cachedExpiry && Date.now() < cachedExpiry) {
    logger.info(`Token for ${tokenKey} is close to expiry, attempting refresh...`);
    try {
      const refreshedToken = await refreshAuthToken(tokenKey, cachedToken);
      if (refreshedToken) {
        return refreshedToken;
      }
    } catch (error) {
      logger.warn(`Token refresh failed for ${tokenKey}, proceeding with new authentication:`, error.message);
    }
  }

  return await performAuthentication(authUrl, tokenKey);
};

/**
 * @function performAuthentication
 * @description Performs the actual authentication with retry logic
 * @param {string} authUrl - The authentication URL
 * @param {string} tokenKey - The token cache key
 * @returns {string} The authentication token
 * @throws {ApiError} If authentication fails after all retries
 */
const performAuthentication = async (authUrl, tokenKey) => {
  let lastError;
  
  for (let attempt = 1; attempt <= AUTH_CONFIG.maxRetries; attempt++) {
    try {
      logger.info(`Authenticating with SanlamAllianz API (attempt ${attempt}/${AUTH_CONFIG.maxRetries})...`);
      
      // SanlamAllianz API uses /token endpoint with form-urlencoded data
      const params = new URLSearchParams();
      params.append('username', SANLAM_ALLIANZ_API_USERNAME);
      params.append('password', SANLAM_ALLIANZ_API_PASSWORD);
      params.append('grant_type', 'password');
      
      const response = await axios.post(`${authUrl}/token`, params, {
        timeout: 10000, // 10 second timeout
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'TravelPlace-API/1.0'
        }
      });

      // Validate response structure (OAuth2 token response)
      if (!response.data) {
        throw new Error('Invalid response structure: missing data');
      }

      const data = response.data;
      
      // OAuth2 token response format: { access_token, token_type, expires_in }
      const token = data.access_token || data.token;
      
      if (!token) {
        throw new Error('Invalid response structure: missing access_token');
      }

      // Store token with improved expiry handling
      let expiryTime;
      
      if (data.expires_in) {
        // expires_in is in seconds, convert to milliseconds
        expiryTime = Date.now() + (data.expires_in * 1000);
      } else if (data.expires) {
        // Handle different date formats
        try {
          expiryTime = new Date(data.expires).getTime();
          if (isNaN(expiryTime)) {
            throw new Error('Invalid expiry date format');
          }
        } catch (dateError) {
          logger.warn(`Failed to parse expiry date "${data.expires}", using default 1 hour expiry`);
          expiryTime = Date.now() + (60 * 60 * 1000); // 1 hour default
        }
      } else {
        // Default to 1 hour if no expiry provided
        expiryTime = Date.now() + (60 * 60 * 1000);
      }

      // Cache the token
      authTokens.set(tokenKey, token);
      tokenExpiryTimes.set(tokenKey, expiryTime);

      logger.info(`SanlamAllianz API authenticated successfully for ${tokenKey}. Token expires at: ${new Date(expiryTime).toISOString()}`);
      return token;

    } catch (error) {
      lastError = error;
      logger.error(`SanlamAllianz authentication attempt ${attempt} failed:`, error.message);
      
      // Don't retry on authentication errors (401, 403)
      if (error.response && [401, 403].includes(error.response.status)) {
        throw new ApiError('SanlamAllianz authentication failed: Invalid credentials', StatusCodes.UNAUTHORIZED);
      }
      
      // Wait before retrying (exponential backoff)
      if (attempt < AUTH_CONFIG.maxRetries) {
        const delay = AUTH_CONFIG.retryDelay * Math.pow(2, attempt - 1);
        logger.info(`Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All retries failed
  logger.error(`Failed to authenticate with SanlamAllianz API after ${AUTH_CONFIG.maxRetries} attempts`);
  throw new ApiError('Failed to authenticate with SanlamAllianz API', StatusCodes.INTERNAL_SERVER_ERROR);
};

/**
 * @function refreshAuthToken
 * @description Attempts to refresh an existing authentication token
 * @param {string} tokenKey - The token cache key
 * @param {string} currentToken - The current token to refresh
 * @returns {string|null} The refreshed token or null if refresh is not supported
 */
const refreshAuthToken = async (tokenKey, currentToken) => {
  // Note: This is a placeholder for token refresh logic
  // SanlamAllianz API may not support token refresh, in which case this will return null
  // and trigger a new authentication
  
  try {
    // If the API supports token refresh, implement it here
    // For now, we'll return null to trigger new authentication
    logger.info(`Token refresh not supported for SanlamAllianz API, will perform new authentication`);
    return null;
  } catch (error) {
    logger.warn(`Token refresh failed for ${tokenKey}:`, error.message);
    return null;
  }
};

/**
 * @function validateApiConnection
 * @description Validates connectivity to SanlamAllianz API endpoints
 * @returns {object} Connection status for all configured endpoints
 */
const validateApiConnection = async () => {
  const endpoints = {
    travel: SANLAM_ALLIANZ_BASE_URL_TRAVEL,
    instantPlan: SANLAM_ALLIANZ_BASE_URL_INSTANT_PLAN,
    life: SANLAM_ALLIANZ_BASE_URL_LIFE,
    motor: SANLAM_ALLIANZ_BASE_URL_MOTOR,
  };

  const results = {};

  for (const [service, baseUrl] of Object.entries(endpoints)) {
    if (!baseUrl) {
      results[service] = { status: 'not_configured', error: 'Base URL not configured' };
      continue;
    }

    try {
      const token = await authenticateAllianz(baseUrl);
      results[service] = { 
        status: 'connected', 
        baseUrl,
        tokenExpiry: tokenExpiryTimes.get(baseUrl) ? new Date(tokenExpiryTimes.get(baseUrl)).toISOString() : null
      };
    } catch (error) {
      results[service] = { 
        status: 'failed', 
        baseUrl,
        error: error.message 
      };
    }
  }

  return results;
};

/**
 * @function getServiceHealthStatus
 * @description Get comprehensive health status including error statistics
 * @returns {object} Service health status and error statistics
 */
const getServiceHealthStatus = async () => {
  const connectionStatus = await validateApiConnection();
  const errorStats = sanlamAllianzErrorHandler.getErrorStatistics();
  
  // Calculate overall health score
  const totalEndpoints = Object.keys(connectionStatus).length;
  const connectedEndpoints = Object.values(connectionStatus).filter(status => status.status === 'connected').length;
  const healthScore = totalEndpoints > 0 ? (connectedEndpoints / totalEndpoints) * 100 : 0;
  
  // Determine overall status
  let overallStatus = 'healthy';
  if (healthScore < 50) {
    overallStatus = 'critical';
  } else if (healthScore < 80 || errorStats.totalErrors > 50) {
    overallStatus = 'degraded';
  } else if (errorStats.totalErrors > 20) {
    overallStatus = 'warning';
  }
  
  return {
    overallStatus,
    healthScore,
    timestamp: new Date().toISOString(),
    endpoints: connectionStatus,
    errorStatistics: errorStats,
    tokenStatus: {
      cachedTokens: authTokens.size,
      tokenExpiryTimes: Array.from(tokenExpiryTimes.entries()).map(([key, expiry]) => ({
        endpoint: key,
        expiresAt: new Date(expiry).toISOString(),
        expiresIn: Math.max(0, expiry - Date.now()),
      })),
    },
    retryConfiguration: RETRY_CONFIG,
  };
};

// Enhanced retry configuration with exponential backoff
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second base delay
  maxDelay: 30000, // 30 seconds maximum delay
  backoffMultiplier: 2,
  jitterFactor: 0.1, // Add randomness to prevent thundering herd
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  retryableNetworkErrors: ['ECONNABORTED', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET'],
};

/**
 * @function calculateRetryDelay
 * @description Calculate retry delay with exponential backoff and jitter
 * @param {number} attempt - Current attempt number (1-based)
 * @param {number} baseDelay - Base delay in milliseconds
 * @param {number} maxDelay - Maximum delay in milliseconds
 * @param {number} backoffMultiplier - Exponential backoff multiplier
 * @param {number} jitterFactor - Jitter factor (0-1) to add randomness
 * @returns {number} Delay in milliseconds
 */
const calculateRetryDelay = (attempt, baseDelay = RETRY_CONFIG.baseDelay, maxDelay = RETRY_CONFIG.maxDelay, backoffMultiplier = RETRY_CONFIG.backoffMultiplier, jitterFactor = RETRY_CONFIG.jitterFactor) => {
  // Calculate exponential backoff delay
  const exponentialDelay = baseDelay * Math.pow(backoffMultiplier, attempt - 1);
  
  // Apply maximum delay cap
  const cappedDelay = Math.min(exponentialDelay, maxDelay);
  
  // Add jitter to prevent thundering herd problem
  const jitter = cappedDelay * jitterFactor * Math.random();
  const finalDelay = cappedDelay + jitter;
  
  return Math.floor(finalDelay);
};

/**
 * @function parseSanlamAllianzError
 * @description Parse and categorize SanlamAllianz API error responses
 * @param {object} error - Axios error object
 * @returns {object} Parsed error information
 */
const parseSanlamAllianzError = (error) => {
  const errorInfo = {
    type: 'unknown',
    message: 'Unknown error occurred',
    statusCode: 500,
    isRetryable: false,
    retryAfter: null,
    details: {},
    originalError: error.message,
  };

  // Network/connection errors
  if (!error.response) {
    errorInfo.type = 'network';
    errorInfo.isRetryable = RETRY_CONFIG.retryableNetworkErrors.includes(error.code);
    
    switch (error.code) {
      case 'ECONNABORTED':
        errorInfo.message = 'Request timeout - SanlamAllianz API did not respond in time';
        errorInfo.statusCode = 408;
        break;
      case 'ENOTFOUND':
        errorInfo.message = 'Network error - SanlamAllianz API endpoint not found';
        errorInfo.statusCode = 503;
        break;
      case 'ECONNREFUSED':
        errorInfo.message = 'Connection refused - SanlamAllianz API is not accepting connections';
        errorInfo.statusCode = 503;
        break;
      case 'ETIMEDOUT':
        errorInfo.message = 'Connection timeout - Unable to connect to SanlamAllianz API';
        errorInfo.statusCode = 408;
        break;
      case 'ECONNRESET':
        errorInfo.message = 'Connection reset - SanlamAllianz API closed the connection unexpectedly';
        errorInfo.statusCode = 503;
        break;
      default:
        errorInfo.message = `Network error: ${error.message}`;
        errorInfo.statusCode = 503;
    }
    
    return errorInfo;
  }

  // HTTP response errors
  const { status, statusText, data, headers } = error.response;
  errorInfo.statusCode = status;
  errorInfo.isRetryable = RETRY_CONFIG.retryableStatusCodes.includes(status);

  // Parse rate limiting information
  if (status === 429) {
    errorInfo.type = 'rate_limit';
    errorInfo.message = 'Rate limit exceeded - Too many requests to SanlamAllianz API';
    errorInfo.isRetryable = true;
    errorInfo.retryAfter = parseInt(headers['retry-after']) || parseInt(headers['x-ratelimit-reset']) || null;
  }
  // Authentication errors
  else if (status === 401) {
    errorInfo.type = 'authentication';
    errorInfo.message = 'Authentication failed - Invalid or expired SanlamAllianz API token';
    errorInfo.isRetryable = true; // Can retry with fresh token
  }
  // Authorization errors
  else if (status === 403) {
    errorInfo.type = 'authorization';
    errorInfo.message = 'Authorization failed - Insufficient permissions for SanlamAllianz API';
    errorInfo.isRetryable = false;
  }
  // Client errors (4xx)
  else if (status >= 400 && status < 500) {
    errorInfo.type = 'client';
    errorInfo.isRetryable = false;
    
    // Try to extract meaningful error message from response
    if (data) {
      if (typeof data === 'string') {
        errorInfo.message = data;
      } else if (data.message) {
        errorInfo.message = data.message;
      } else if (data.error) {
        errorInfo.message = typeof data.error === 'string' ? data.error : data.error.message || 'Client error';
      } else if (data.errors && Array.isArray(data.errors)) {
        errorInfo.message = data.errors.join(', ');
        errorInfo.details.validationErrors = data.errors;
      } else {
        errorInfo.message = `Client error: ${statusText}`;
      }
    } else {
      errorInfo.message = `Client error: ${statusText}`;
    }
  }
  // Server errors (5xx)
  else if (status >= 500) {
    errorInfo.type = 'server';
    errorInfo.isRetryable = true;
    
    if (data && data.message) {
      errorInfo.message = `Server error: ${data.message}`;
    } else {
      errorInfo.message = `Server error: ${statusText}`;
    }
  }

  // Add additional error details
  errorInfo.details = {
    ...errorInfo.details,
    statusCode: status,
    statusText,
    headers: headers || {},
    responseData: data,
  };

  return errorInfo;
};

/**
 * @function detectRateLimiting
 * @description Detect rate limiting from response headers and implement throttling
 * @param {object} headers - Response headers
 * @returns {object} Rate limiting information
 */
const detectRateLimiting = (headers) => {
  const rateLimitInfo = {
    isRateLimited: false,
    remaining: null,
    resetTime: null,
    retryAfter: null,
    shouldThrottle: false,
  };

  // Check common rate limiting headers
  const remaining = headers['x-ratelimit-remaining'] || headers['x-rate-limit-remaining'];
  const resetTime = headers['x-ratelimit-reset'] || headers['x-rate-limit-reset'];
  const retryAfter = headers['retry-after'];

  if (remaining !== undefined) {
    rateLimitInfo.remaining = parseInt(remaining);
    rateLimitInfo.shouldThrottle = rateLimitInfo.remaining < 10; // Throttle when less than 10 requests remaining
  }

  if (resetTime !== undefined) {
    rateLimitInfo.resetTime = parseInt(resetTime);
  }

  if (retryAfter !== undefined) {
    rateLimitInfo.retryAfter = parseInt(retryAfter);
    rateLimitInfo.isRateLimited = true;
  }

  return rateLimitInfo;
};

/**
 * @function logCriticalFailure
 * @description Log critical API failures and trigger alerts
 * @param {string} operation - Operation that failed
 * @param {object} errorInfo - Parsed error information
 * @param {number} attempt - Current attempt number
 * @param {string} baseUrl - API base URL
 */
const logCriticalFailure = (operation, errorInfo, attempt, baseUrl) => {
  const isCritical = (
    errorInfo.type === 'server' && 
    errorInfo.statusCode >= 500 && 
    attempt >= RETRY_CONFIG.maxRetries
  ) || (
    errorInfo.type === 'network' && 
    attempt >= RETRY_CONFIG.maxRetries
  );

  if (isCritical) {
    logger.error('CRITICAL: SanlamAllianz API failure after all retries', {
      operation,
      baseUrl,
      errorType: errorInfo.type,
      statusCode: errorInfo.statusCode,
      message: errorInfo.message,
      attempts: attempt,
      maxRetries: RETRY_CONFIG.maxRetries,
      details: errorInfo.details,
      alert: true, // Flag for alerting system
      severity: 'critical',
      timestamp: new Date().toISOString(),
    });

    // Log security event for suspicious patterns
    if (errorInfo.type === 'authentication' && attempt >= RETRY_CONFIG.maxRetries) {
      logger.logSecurityEvent('repeated_auth_failures', {
        service: 'SanlamAllianz',
        baseUrl,
        attempts: attempt,
        operation,
      }, 'high');
    }
  }
};

/**
 * @function allianzApiCall
 * @description Generic function to make authenticated calls to the SanlamAllianz API with enhanced error handling and retry logic.
 * @param {string} url - The API endpoint URL.
 * @param {object} data - The request payload.
 * @param {string} baseUrl - The base URL for the specific SanlamAllianz product (travel, instant plan, life, motor).
 * @param {string} method - HTTP method (default: 'POST')
 * @param {object} options - Additional options (timeout, headers, maxRetries, etc.)
 * @returns {object} The API response data.
 * @throws {ApiError} If the API call fails.
 */
const allianzApiCall = async (url, data, baseUrl, method = 'POST', options = {}) => {
  const maxRetries = options.maxRetries || RETRY_CONFIG.maxRetries;
  const timeout = options.timeout || 30000; // 30 seconds default
  const operation = `${method.toUpperCase()} ${url}`;
  const startTime = Date.now();
  
  let lastError;
  let authRetryCount = 0;
  const maxAuthRetries = 2; // Limit authentication retries

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const attemptStartTime = Date.now();
    
    try {
      // Get authentication token for this base URL
      const token = await authenticateAllianz(baseUrl);
      
      const requestConfig = {
        method: method.toUpperCase(),
        url: `${baseUrl}${url}`,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'TravelPlace-API/1.0',
          ...options.headers
        },
        timeout,
        ...options.axiosConfig
      };

      // Add data for POST/PUT requests
      if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && data) {
        requestConfig.data = data;
      }

      // Add params for GET requests
      if (method.toUpperCase() === 'GET' && data) {
        requestConfig.params = data;
      }

      logger.info(`SanlamAllianz API call: ${operation} (attempt ${attempt}/${maxRetries})`, {
        baseUrl,
        attempt,
        maxRetries,
        timeout,
        hasData: !!data,
      });
      
      const response = await axios(requestConfig);
      const duration = Date.now() - attemptStartTime;
      const totalDuration = Date.now() - startTime;
      
      // Check for rate limiting in successful responses
      const rateLimitInfo = detectRateLimiting(response.headers);
      if (rateLimitInfo.shouldThrottle) {
        logger.warn('SanlamAllianz API rate limit approaching', {
          operation,
          baseUrl,
          remaining: rateLimitInfo.remaining,
          resetTime: rateLimitInfo.resetTime,
        });
      }
      
      // Log successful response with performance metrics
      logger.logExternalService('SanlamAllianz', operation, duration, true, {
        baseUrl,
        statusCode: response.status,
        attempt,
        totalDuration,
        rateLimitRemaining: rateLimitInfo.remaining,
      });
      
      // Log successful recovery if there were previous attempts
      sanlamAllianzErrorHandler.logSuccessfulRecovery(operation, baseUrl, attempt, totalDuration);
      
      return response.data;

    } catch (error) {
      lastError = error;
      const duration = Date.now() - attemptStartTime;
      const errorInfo = parseSanlamAllianzError(error);
      
      // Use specialized error handler for detailed logging and alerting
      sanlamAllianzErrorHandler.logDetailedError(error, operation, baseUrl, attempt, {
        duration,
        timeout,
        hasData: !!data,
        method: method.toUpperCase(),
      });
      
      // Log the error attempt for external service tracking
      logger.logExternalService('SanlamAllianz', operation, duration, false, {
        baseUrl,
        attempt,
        errorType: errorInfo.type,
        statusCode: errorInfo.statusCode,
        message: errorInfo.message,
        isRetryable: errorInfo.isRetryable,
      });

      // Handle authentication errors with limited retries
      if (errorInfo.type === 'authentication' && authRetryCount < maxAuthRetries) {
        logger.warn(`Authentication error for ${baseUrl}, clearing cached token (auth retry ${authRetryCount + 1}/${maxAuthRetries})`);
        const tokenKey = baseUrl || 'default';
        authTokens.delete(tokenKey);
        tokenExpiryTimes.delete(tokenKey);
        authRetryCount++;
        
        // Don't count auth retries against main retry limit
        attempt--;
        continue;
      }

      // Handle rate limiting with proper delay
      if (errorInfo.type === 'rate_limit') {
        if (attempt < maxRetries) {
          const retryDelay = errorInfo.retryAfter ? 
            errorInfo.retryAfter * 1000 : 
            calculateRetryDelay(attempt);
          
          logger.warn(`Rate limited by SanlamAllianz API, waiting ${retryDelay}ms before retry`, {
            operation,
            baseUrl,
            attempt,
            retryAfter: errorInfo.retryAfter,
            calculatedDelay: retryDelay,
          });
          
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
      }

      // Handle retryable errors with exponential backoff
      if (errorInfo.isRetryable && attempt < maxRetries) {
        const retryDelay = calculateRetryDelay(attempt);
        
        logger.warn(`Retryable error from SanlamAllianz API, retrying in ${retryDelay}ms`, {
          operation,
          baseUrl,
          attempt,
          errorType: errorInfo.type,
          statusCode: errorInfo.statusCode,
          retryDelay,
        });
        
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }

      // Log critical failures
      logCriticalFailure(operation, errorInfo, attempt, baseUrl);

      // Don't retry non-retryable errors
      if (!errorInfo.isRetryable) {
        logger.error(`Non-retryable error from SanlamAllianz API`, {
          operation,
          baseUrl,
          errorType: errorInfo.type,
          statusCode: errorInfo.statusCode,
          message: errorInfo.message,
          details: errorInfo.details,
        });
        break;
      }
    }
  }

  // All retries failed, create comprehensive error
  const totalDuration = Date.now() - startTime;
  const errorInfo = parseSanlamAllianzError(lastError);
  
  logger.error(`SanlamAllianz API call failed after ${maxRetries} attempts`, {
    operation,
    baseUrl,
    totalDuration,
    attempts: maxRetries,
    finalError: errorInfo,
  });

  // Create appropriate error based on error type
  let apiError;
  switch (errorInfo.type) {
    case 'authentication':
      apiError = ApiError.authenticationError(
        `SanlamAllianz API authentication failed: ${errorInfo.message}`,
        { service: 'SanlamAllianz', operation, baseUrl, attempts: maxRetries }
      );
      break;
    case 'authorization':
      apiError = ApiError.authorizationError(
        `SanlamAllianz API authorization failed: ${errorInfo.message}`,
        { service: 'SanlamAllianz', operation, baseUrl }
      );
      break;
    case 'rate_limit':
      apiError = ApiError.rateLimitError(
        `SanlamAllianz API rate limit exceeded: ${errorInfo.message}`,
        { service: 'SanlamAllianz', operation, baseUrl, retryAfter: errorInfo.retryAfter }
      );
      break;
    case 'network':
      apiError = ApiError.serviceUnavailableError(
        'SanlamAllianz API',
        { operation, baseUrl, networkError: errorInfo.originalError, attempts: maxRetries }
      );
      break;
    case 'server':
      apiError = ApiError.badGatewayError(
        'SanlamAllianz API',
        { operation, baseUrl, serverError: errorInfo.message, attempts: maxRetries }
      );
      break;
    default:
      apiError = new ApiError(
        errorInfo.message,
        errorInfo.statusCode,
        errorInfo.details.validationErrors || [],
        'SANLAM_ALLIANZ_ERROR',
        { service: 'SanlamAllianz', operation, baseUrl, attempts: maxRetries, errorType: errorInfo.type }
      );
  }

  throw apiError;
};

// --- Travel Insurance Endpoints (using ALLIANZ_BASE_URL_TRAVEL) ---

/**
 * @function getTravelInsuranceLookup
 * @description Fetches lookup data for Travel Insurance.
 * @param {string} type - The type of lookup (e.g., 'GetCountry', 'GetTravelPlan').
 * @param {object} params - Optional query parameters (e.g., { countryId: 1 }).
 * @returns {object} Lookup data.
 */
const getTravelInsuranceLookup = async (type, params = {}) => {
  const url = `/api/lookup/${type}`;
  return allianzApiCall(url, params, SANLAM_ALLIANZ_BASE_URL_TRAVEL, 'GET');
};

/**
 * @function getTravelInsuranceQuote
 * @description Gets a quote for Travel Insurance.
 * @param {object} quoteDetails - Details for the quote request.
 * @returns {object} Quote response.
 */
const getTravelInsuranceQuote = async (quoteDetails) => {
  return allianzApiCall('/api/Quote', quoteDetails, SANLAM_ALLIANZ_BASE_URL_TRAVEL);
};

/**
 * @function purchaseTravelInsuranceIndividual
 * @description Purchases an individual Travel Insurance policy.
 * @param {object} purchaseDetails - Details for individual policy purchase.
 * @returns {object} Purchase confirmation.
 */
const purchaseTravelInsuranceIndividual = async (purchaseDetails) => {
  return allianzApiCall('/api/IndividualBooking', purchaseDetails, SANLAM_ALLIANZ_BASE_URL_TRAVEL);
};

/**
 * @function purchaseTravelInsuranceFamily
 * @description Purchases a family Travel Insurance policy.
 * @param {Array<object>} purchaseDetails - Array of details for family members.
 * @returns {object} Purchase confirmation.
 */
const purchaseTravelInsuranceFamily = async (purchaseDetails) => {
  return allianzApiCall('/api/FamilyBooking', purchaseDetails, SANLAM_ALLIANZ_BASE_URL_TRAVEL);
};

// --- Instant Plan Insurance Endpoints (using ALLIANZ_BASE_URL_INSTANT_PLAN) ---

/**
 * @function getInstantPlanLookup
 * @description Fetches lookup data for Instant Plan Insurance.
 * @param {string} type - The type of lookup (e.g., 'documenttypes', 'genders', 'states').
 * @param {string} [referenceId] - Optional reference ID for document types.
 * @returns {object} Lookup data.
 */
const getInstantPlanLookup = async (type, referenceId = '') => {
  const url = `/api/resources/${type}${referenceId ? `?referenceId=${referenceId}` : ''}`;
  return allianzApiCall(url, null, SANLAM_ALLIANZ_BASE_URL_INSTANT_PLAN, 'GET');
};

/**
 * @function getInstantPlanQuote
 * @description Gets a quote for Instant Plan Insurance.
 * @param {object} quoteDetails - Details for the quote request.
 * @returns {object} Quote response.
 */
const getInstantPlanQuote = async (quoteDetails) => {
  return allianzApiCall('/api/quote/instantplan', quoteDetails, SANLAM_ALLIANZ_BASE_URL_INSTANT_PLAN);
};

/**
 * @function purchaseInstantPlanPolicy
 * @description Purchases an Instant Plan policy.
 * @param {object} purchaseDetails - Details for policy purchase.
 * @returns {object} Purchase confirmation.
 */
const purchaseInstantPlanPolicy = async (purchaseDetails) => {
  return allianzApiCall('/api/quote/instantplan', purchaseDetails, SANLAM_ALLIANZ_BASE_URL_INSTANT_PLAN);
};

/**
 * @function uploadInstantPlanPayment
 * @description Uploads payment details for an Instant Plan policy.
 * @param {string} policyId - The policy ID.
 * @param {object} paymentDetails - Payment details.
 * @returns {object} Payment upload confirmation.
 */
const uploadInstantPlanPayment = async (policyId, paymentDetails) => {
  return allianzApiCall(`/api/policy/${policyId}/payments`, paymentDetails, SANLAM_ALLIANZ_BASE_URL_INSTANT_PLAN);
};

/**
 * @function uploadInstantPlanDocument
 * @description Uploads supporting documents for an Instant Plan policy.
 * @param {string} policyId - The policy ID.
 * @param {FormData} formData - FormData containing file and document name.
 * @returns {object} Document upload confirmation.
 */
const uploadInstantPlanDocument = async (policyId, formData) => {
  const token = await authenticateAllianz(SANLAM_ALLIANZ_BASE_URL_INSTANT_PLAN);
  try {
    const response = await axios.post(`${SANLAM_ALLIANZ_BASE_URL_INSTANT_PLAN}/api/policy/${policyId}/uploads`, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data', // Important for FormData
        'User-Agent': 'TravelPlace-API/1.0'
      },
      timeout: 60000, // 60 seconds for file uploads
    });
    return response.data;
  } catch (error) {
    logger.error(`SanlamAllianz Instant Plan Document Upload failed for policy ${policyId}:`, error.message);
    if (error.response) {
      logger.error('SanlamAllianz API response error:', error.response.data);
      throw new ApiError(
        error.response.data.message || 'SanlamAllianz API document upload failed',
        error.response.status || StatusCodes.INTERNAL_SERVER_ERROR
      );
    }
    throw new ApiError('SanlamAllianz API document upload failed', StatusCodes.INTERNAL_SERVER_ERROR);
  }
};






module.exports = {
  // Authentication and connection validation
  authenticateAllianz,
  validateApiConnection,
  getServiceHealthStatus,
  
  // Travel Insurance
  getTravelInsuranceLookup,
  getTravelInsuranceQuote,
  purchaseTravelInsuranceIndividual,
  purchaseTravelInsuranceFamily,
  
  // Instant Plan Insurance
  getInstantPlanLookup,
  getInstantPlanQuote,
  purchaseInstantPlanPolicy,
  uploadInstantPlanPayment,
  uploadInstantPlanDocument,
  
  // Note: Motor Insurance and Life Insurance functions removed - not implemented
};