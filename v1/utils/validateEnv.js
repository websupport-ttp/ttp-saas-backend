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
    
    console.log('Environment validation completed successfully');
    
    // Warn about optional but recommended variables
    const optionalVars = [
      'EMAIL_HOST', 'EMAIL_USERNAME', 'EMAIL_PASSWORD',
      'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN',
      'PAYSTACK_SECRET_KEY',
      'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY'
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
  validateAppEnvironment
};