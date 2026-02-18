// v1/utils/validateEnv.js
// Note: Cannot use logger here due to circular dependency during initialization

/**
 * @description Validates that required environment variables are set
 * @param {Array<string>} requiredVars - Array of required environment variable names
 * @throws {Error} If any required environment variables are missing
 */
const validateRequiredEnvVars = (requiredVars) => {
  const missingVars = [];
  
  requiredVars.forEach(varName => {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  });
  
  if (missingVars.length > 0) {
    const errorMessage = `Missing required environment variables: ${missingVars.join(', ')}`;
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
};

/**
 * @description Validates environment variables with default values
 * @param {Object} envConfig - Object with env var names as keys and default values
 * @returns {Object} Object with validated environment variables
 */
const validateEnvWithDefaults = (envConfig) => {
  const validatedEnv = {};
  
  Object.keys(envConfig).forEach(key => {
    validatedEnv[key] = process.env[key] || envConfig[key];
    if (!process.env[key] && envConfig[key]) {
      console.warn(`Using default value for ${key}: ${envConfig[key]}`);
    }
  });
  
  return validatedEnv;
};

/**
 * @description Validates URL format for XML endpoints
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid URL
 */
const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * @description Validates Cloudflare API token format
 * @param {string} token - API token to validate
 * @returns {boolean} True if valid token format
 */
const isValidCloudflareToken = (token) => {
  // Cloudflare API tokens are typically 40 characters long and alphanumeric
  return typeof token === 'string' && token.length >= 32 && /^[a-zA-Z0-9_-]+$/.test(token);
};

/**
 * @description Validates all critical environment variables for the application
 */
const validateAppEnvironment = () => {
  // Critical environment variables that must be set
  const criticalVars = [
    'MONGO_URI',
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET'
  ];
  
  // Environment variables with defaults
  const defaultConfig = {
    NODE_ENV: 'development',
    PORT: '5000',
    JWT_ACCESS_LIFETIME: '15m',
    JWT_REFRESH_LIFETIME: '30d',
    REDIS_URL: 'redis://localhost:6379'
  };
  
  try {
    // Validate critical variables
    validateRequiredEnvVars(criticalVars);
    
    // Validate and set defaults
    const envWithDefaults = validateEnvWithDefaults(defaultConfig);
    
    // Set defaults in process.env if not already set
    Object.keys(envWithDefaults).forEach(key => {
      if (!process.env[key]) {
        process.env[key] = envWithDefaults[key];
      }
    });
    
    // Validate Amadeus XML configuration if provided
    if (process.env.AMADEUS_XML_ENDPOINT) {
      if (!isValidUrl(process.env.AMADEUS_XML_ENDPOINT)) {
        throw new Error('AMADEUS_XML_ENDPOINT must be a valid URL');
      }
      
      const requiredAmadeusVars = [
        'AMADEUS_XML_USERNAME',
        'AMADEUS_XML_PASSWORD',
        'AMADEUS_XML_OFFICE_ID'
      ];
      
      const missingAmadeusVars = requiredAmadeusVars.filter(varName => !process.env[varName]);
      if (missingAmadeusVars.length > 0) {
        throw new Error(`Missing required Amadeus XML variables: ${missingAmadeusVars.join(', ')}`);
      }
    }
    
    // Cloudflare configuration removed - now using AWS S3 for file storage
    
    console.log('Environment validation completed successfully');
    
    // Warn about optional but recommended variables
    const optionalVars = [
      'EMAIL_HOST', 'EMAIL_USERNAME', 'EMAIL_PASSWORD',
      'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER',
      'WHATSAPP_API_BASE_URL', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_ACCESS_TOKEN',
      'PAYSTACK_SECRET_KEY',
      'AMADEUS_XML_ENDPOINT', 'AMADEUS_XML_USERNAME'
    ];
    
    const missingOptional = optionalVars.filter(varName => !process.env[varName]);
    if (missingOptional.length > 0) {
      console.warn(`Optional environment variables not set (some features may not work): ${missingOptional.join(', ')}`);
    }
    
  } catch (error) {
    console.error('Environment validation failed:', error.message);
    throw error;
  }
};

module.exports = {
  validateRequiredEnvVars,
  validateEnvWithDefaults,
  validateAppEnvironment,
  isValidUrl,
  isValidCloudflareToken
};