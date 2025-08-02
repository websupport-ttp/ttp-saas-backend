// v1/config/testEnv.js
// Test-only configuration constants for deterministic testing

/**
 * @description Test-only configuration constants
 * These constants are used exclusively in test environments to ensure
 * deterministic behavior across test runs and CI/CD pipelines.
 * 
 * IMPORTANT: These values should NEVER be used in production environments.
 * They are intentionally weak and predictable for testing purposes only.
 */

// JWT Configuration for Tests
const TEST_JWT_SECRET = 'test-jwt-secret-for-deterministic-testing-only-do-not-use-in-production';
const TEST_JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-for-deterministic-testing-only-do-not-use-in-production';

// Cookie Configuration for Tests
const TEST_COOKIE_SECRET = 'test-cookie-secret-for-deterministic-testing-only-do-not-use-in-production';

// Token Lifetimes (using shorter lifetimes for faster test execution)
const TEST_JWT_ACCESS_LIFETIME = '15m';
const TEST_JWT_REFRESH_LIFETIME = '30d';

// Test Environment Constants
const TEST_ENV_CONSTANTS = {
  NODE_ENV: 'test',
  PORT: '5001', // Different port for tests to avoid conflicts
  LOG_LEVEL: 'error', // Minimize logging during tests
  
  // Database Configuration
  MONGO_URI: 'mongodb://localhost:27017/ttp_api_test',
  
  // Redis Configuration
  REDIS_URL: 'redis://localhost:6379',
  
  // JWT Secrets
  JWT_ACCESS_SECRET: TEST_JWT_SECRET,
  JWT_REFRESH_SECRET: TEST_JWT_REFRESH_SECRET,
  
  // JWT Lifetimes
  JWT_ACCESS_LIFETIME: TEST_JWT_ACCESS_LIFETIME,
  JWT_REFRESH_LIFETIME: TEST_JWT_REFRESH_LIFETIME,
  
  // Cookie Secret
  COOKIE_SECRET: TEST_COOKIE_SECRET,
  
  // Test-specific service configurations
  SKIP_EXTERNAL_SERVICES: 'true',
  DISABLE_RATE_LIMITING: 'true',
  DISABLE_CSRF: 'true',
  
  // Mock service endpoints
  MOCK_PAYSTACK_ENDPOINT: 'http://localhost:3001/mock-paystack',
  MOCK_AMADEUS_ENDPOINT: 'http://localhost:3001/mock-amadeus',
  MOCK_TWILIO_ENDPOINT: 'http://localhost:3001/mock-twilio',
  MOCK_CLOUDINARY_ENDPOINT: 'http://localhost:3001/mock-cloudinary',
  
  // Email/SMS Testing
  MOCK_EMAIL_SERVICE: 'true',
  MOCK_SMS_SERVICE: 'true',
  
  // Security settings for tests
  BCRYPT_ROUNDS: '4', // Faster hashing for tests
  DISABLE_HELMET: 'true',
  
  // Test database settings
  TEST_DB_AUTO_CLEANUP: 'true',
  TEST_DB_TRANSACTION_TIMEOUT: '10000',
  TEST_DB_CONNECTION_TIMEOUT: '15000',
  TEST_DB_SOCKET_TIMEOUT: '30000',
  
  // App initialization settings for tests
  SKIP_APP_INIT: 'true',
  DISABLE_APP_TIMEOUTS: 'true',
};

/**
 * @description Applies test environment configuration to process.env
 * This function should be called early in the test setup process
 * to ensure all test configurations are properly set.
 */
function applyTestEnvironment() {
  // Only apply in test environment
  if (process.env.NODE_ENV !== 'test') {
    console.warn('TEST_ENV_CONSTANTS should only be applied in test environment');
    return;
  }
  
  // Apply all test constants to process.env
  Object.keys(TEST_ENV_CONSTANTS).forEach(key => {
    if (!process.env[key]) {
      process.env[key] = TEST_ENV_CONSTANTS[key];
    }
  });
}

/**
 * @description Validates that all required test environment variables are set
 * This function should be called in test setup to ensure proper configuration
 */
function validateTestEnvironment() {
  const requiredVars = [
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'COOKIE_SECRET',
    'JWT_ACCESS_LIFETIME',
    'JWT_REFRESH_LIFETIME',
    'MONGO_URI',
    'REDIS_URL'
  ];
  
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required test environment variables: ${missing.join(', ')}`);
  }
}

/**
 * @description Test-specific JWT configuration
 * These settings provide deterministic JWT behavior for testing
 */
const TEST_JWT_CONFIG = {
  access: {
    secret: TEST_JWT_SECRET,
    lifetime: TEST_JWT_ACCESS_LIFETIME,
    algorithm: 'HS256'
  },
  refresh: {
    secret: TEST_JWT_REFRESH_SECRET,
    lifetime: TEST_JWT_REFRESH_LIFETIME,
    algorithm: 'HS256'
  }
};

/**
 * @description Test-specific cookie configuration
 * These settings provide deterministic cookie behavior for testing
 */
const TEST_COOKIE_CONFIG = {
  secret: TEST_COOKIE_SECRET,
  options: {
    httpOnly: true,
    signed: true,
    sameSite: 'Lax',
    secure: false, // Always false in tests
    maxAge: 24 * 60 * 60 * 1000, // 1 day for access token
  },
  refreshOptions: {
    httpOnly: true,
    signed: true,
    sameSite: 'Lax',
    secure: false, // Always false in tests
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days for refresh token
  }
};

/**
 * @description Test database configuration
 * Provides isolated database settings for testing with optimized connection pooling
 */
const TEST_DB_CONFIG = {
  uri: TEST_ENV_CONSTANTS.MONGO_URI,
  options: {
    // Connection pool settings optimized for testing
    maxPoolSize: 2, // Minimal pool size for tests
    minPoolSize: 1,
    maxIdleTimeMS: 10000, // Shorter idle time for tests
    
    // Timeout settings to prevent buffering issues - optimized for stability
    serverSelectionTimeoutMS: parseInt(TEST_ENV_CONSTANTS.TEST_DB_CONNECTION_TIMEOUT) || 15000,
    socketTimeoutMS: parseInt(TEST_ENV_CONSTANTS.TEST_DB_SOCKET_TIMEOUT) || 30000,
    connectTimeoutMS: parseInt(TEST_ENV_CONSTANTS.TEST_DB_CONNECTION_TIMEOUT) || 15000,
    heartbeatFrequencyMS: 10000, // Less frequent heartbeats for tests
    
    // Network settings
    family: 4, // Use IPv4, skip trying IPv6
    
    // Mongoose buffering settings - CRITICAL for preventing timeout errors
    bufferCommands: false, // Disable mongoose buffering completely
    
    // Index and collection settings for tests
    autoIndex: false, // Don't build indexes automatically in tests
    autoCreate: false, // Don't auto-create collections in tests
    
    // Write concern for tests - optimized for speed
    writeConcern: {
      w: 1,
      journal: false, // Don't wait for journal in tests for speed
      wtimeout: 3000 // Shorter timeout for tests
    },
    
    // Read preference
    readPreference: 'primary',
    
    // Compression (disabled for tests)
    compressors: [],
    
    // Additional test-specific settings
    retryWrites: false, // Disable retry writes for tests
    retryReads: false, // Disable retry reads for tests
  }
};

/**
 * @description Test Redis configuration
 * Provides isolated Redis settings for testing
 */
const TEST_REDIS_CONFIG = {
  url: TEST_ENV_CONSTANTS.REDIS_URL,
  options: {
    connectTimeout: 5000,
    commandTimeout: 3000,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    db: 1, // Use different database for tests
  }
};

module.exports = {
  // Constants
  TEST_JWT_SECRET,
  TEST_JWT_REFRESH_SECRET,
  TEST_COOKIE_SECRET,
  TEST_JWT_ACCESS_LIFETIME,
  TEST_JWT_REFRESH_LIFETIME,
  TEST_ENV_CONSTANTS,
  
  // Configuration objects
  TEST_JWT_CONFIG,
  TEST_COOKIE_CONFIG,
  TEST_DB_CONFIG,
  TEST_REDIS_CONFIG,
  
  // Utility functions
  applyTestEnvironment,
  validateTestEnvironment,
};
