// jest.config.js
module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Global setup and teardown
  globalSetup: './tests/globalSetup.js',
  globalTeardown: './tests/globalTeardown.js',
  
  // Setup files (runs before each test file)
  setupFilesAfterEnv: ['./tests/setup.js', './tests/mocks.js'],
  
  // Test file patterns
  testMatch: [
    '**/v1/test/**/*.test.js',
    '**/v1/test/**/*.spec.js',
    '**/tests/root-level/**/*.test.js',
    '**/tests/root-level/**/*.spec.js',
    '**/__tests__/**/*.js',
    '**/*.test.js',
    '**/*.spec.js'
  ],
  
  // Coverage configuration
  collectCoverageFrom: [
    'v1/**/*.js',
    '!v1/test/**',
    '!v1/**/node_modules/**',
    '!v1/config/testEnv.js', // Exclude test configuration
    '!coverage/**',
    '!jest.*.js',
    '!tests/**', // Exclude test setup files
    '!**/index.js'
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  
  // Test timeout - optimized for MongoDB operations
  testTimeout: 30000,
  
  // Detect open handles but don't fail on them during development
  detectOpenHandles: process.env.CI === 'true',
  
  // Force exit after tests complete to prevent hanging
  forceExit: true,
  
  // Detect leaked timers
  detectLeaks: false, // Disabled to prevent false positives
  
  // Bail on first failure for faster feedback during development
  bail: false,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks after each test
  restoreMocks: true,
  
  // Reset modules between tests
  resetModules: true,
  
  // Verbose output
  verbose: false, // Reduced verbosity for cleaner output
  
  // Maximum number of concurrent workers - optimized for stability and rate limit handling
  maxWorkers: process.env.CI ? 1 : 2, // Sequential in CI, limited parallel locally
  
  // Test retry configuration removed - not a valid Jest option
  
  // Transform configuration (disabled - not needed for Node.js)
  // transform: {
  //   '^.+\\.js$': 'babel-jest'
  // },
  
  // Module name mapping (correct property name)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/v1/$1',
    '^@config/(.*)$': '<rootDir>/v1/config/$1',
    '^@utils/(.*)$': '<rootDir>/v1/utils/$1',
    '^@models/(.*)$': '<rootDir>/v1/models/$1',
    '^@controllers/(.*)$': '<rootDir>/v1/controllers/$1',
    '^@middleware/(.*)$': '<rootDir>/v1/middleware/$1',
    '^@services/(.*)$': '<rootDir>/v1/services/$1',
    '^@test/(.*)$': '<rootDir>/v1/test/$1',
    '^@testUtils/(.*)$': '<rootDir>/tests/$1'
  },
  
  // Test result processor
  testResultsProcessor: './jest.resultProcessor.js',
  
  // Error handling
  errorOnDeprecated: true,
  
  // Bail on first failure (optional, can be enabled for faster feedback)
  // bail: 1,
  
  // Reporters
  reporters: [
    'default'
  ],
  
  // Module paths
  modulePaths: ['<rootDir>', '<rootDir>/v1'],
  
  // Setup files that run before the test framework is installed
  setupFiles: [],
  
  // Test path ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/coverage/',
    '/uploads/',
    '/docs/'
  ],
  
  // Transform ignore patterns
  transformIgnorePatterns: [
    '/node_modules/(?!(module-that-needs-transform)/)'
  ],
  
  // Module file extensions
  moduleFileExtensions: ['js', 'json', 'node'],
  
  // Watch plugins (disabled - not installed)
  // watchPlugins: [
  //   'jest-watch-typeahead/filename',
  //   'jest-watch-typeahead/testname'
  // ],
  
  // Watch path ignore patterns
  watchPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/coverage/',
    '/uploads/',
    '/docs/',
    '/.git/'
  ],
  
  // Custom matchers
  // setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  
  // Test environment options
  testEnvironmentOptions: {
    url: 'http://localhost:5001'
  },
  
  // Globals
  globals: {
    'process.env.NODE_ENV': 'test'
  }
};