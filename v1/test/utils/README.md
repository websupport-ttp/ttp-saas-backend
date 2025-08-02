# Test Retry Logic for Rate-Limited Scenarios

This directory contains intelligent test retry logic designed to handle rate-limited scenarios and improve test reliability in concurrent execution environments.

## Overview

The test retry logic provides:

- **Intelligent Retry Mechanisms**: Automatically retries failed tests based on error type
- **Exponential Backoff**: Implements exponential backoff with jitter to prevent thundering herd problems
- **Rate Limit Handling**: Gracefully handles HTTP 429 (Too Many Requests) responses
- **Test Isolation**: Prevents test conflicts through concurrency control and timing management
- **Comprehensive Monitoring**: Tracks test performance and provides detailed statistics

## Components

### 1. testRetryLogic.js

Core retry logic implementation with:

- `withRetry()`: Generic retry wrapper for any async function
- `retryableTest()`: Jest test wrapper with retry logic
- `retryableRequest()`: Supertest request wrapper with retry logic
- `TestIsolationManager`: Manages test concurrency and rate limiting

### 2. testEnvironmentManager.js

Test environment management with:

- Session tracking and statistics
- Dynamic delay calculation based on rate limiting history
- Performance monitoring and recommendations
- Global state management across test suites

### 3. testHelpers.js

Enhanced test utilities including:

- `EnhancedTestClient`: Supertest wrapper with built-in retry logic
- `describeWithRetry()`: Jest describe wrapper with isolation
- `testWithRetry()`: Jest test wrapper with retry logic
- Test data creation utilities

## Usage Examples

### Basic Test with Retry Logic

```javascript
const { testWithRetry, createTestClient } = require('../utils/testHelpers');

testWithRetry('should handle rate limiting gracefully', async () => {
  const testClient = createTestClient(app, {
    enableRetries: true,
    enableRateLimitHandling: true
  });

  const response = await testClient.get('/api/v1/posts', {
    expectedStatus: 200,
    allowRateLimit: true,
    maxRetries: 3
  });

  expect(response.status).toBe(200);
}, { 
  timeout: 20000, 
  skipOnRateLimit: true 
});
```

### Test Suite with Isolation

```javascript
const { describeWithRetry } = require('../utils/testHelpers');

describeWithRetry('API Integration Tests', () => {
  // Tests run with automatic isolation and retry logic
  
  test('should handle concurrent requests', async () => {
    // Test implementation
  });
  
}, {
  timeout: 60000,
  beforeEachDelay: 500,
  maxConcurrentTests: 2
});
```

### Enhanced Test Client

```javascript
const { createTestClient } = require('../utils/testHelpers');

const testClient = createTestClient(app, {
  suiteName: 'MyTestSuite',
  enableRetries: true,
  enableRateLimitHandling: true,
  timeout: 15000
});

// Automatic retry on rate limits
const response = await testClient.post('/api/v1/auth/login', loginData, {
  allowRateLimit: true,
  maxRetries: 3
});
```

## Configuration

### Retry Configuration

```javascript
const RETRY_CONFIG = {
  rateLimitRetry: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    jitter: true
  },
  isolation: {
    testDelay: 100,
    concurrentTestLimit: 2,
    rateLimitCooldown: 5000
  }
};
```

### Environment Variables

```bash
TEST_RETRY_ENABLED=true
TEST_RATE_LIMIT_HANDLING=true
NODE_ENV=test
```

## Error Handling

The retry logic handles various error types:

### Rate Limiting (HTTP 429)
- Implements exponential backoff with jitter
- Adds cooldown periods after rate limit detection
- Tracks consecutive rate limits for adaptive delays

### Network Errors
- Retries on connection timeouts
- Handles DNS resolution failures
- Manages connection resets

### Database Errors
- Retries MongoDB connection issues
- Handles transaction timeouts
- Manages connection pool exhaustion

## Monitoring and Statistics

### Test Session Statistics

```javascript
const stats = testClient.getStats();
console.log(stats);
// Output:
// {
//   suiteName: 'MyTestSuite',
//   duration: 45000,
//   tests: { total: 10, completed: 8, failed: 1, rateLimited: 1 },
//   requests: { total: 25, rateLimited: 3, retried: 5 },
//   rateLimitState: { consecutiveRateLimits: 0, cooldownMultiplier: 1 }
// }
```

### Global Environment Report

```javascript
testEnvironmentManager.printReport();
// Prints comprehensive test environment statistics
```

## Best Practices

### 1. Test Isolation

- Use `describeWithRetry()` for test suites that may hit rate limits
- Configure appropriate delays between tests
- Limit concurrent test execution for rate-limited APIs

### 2. Rate Limit Handling

- Always set `allowRateLimit: true` for tests that may hit rate limits
- Use `skipOnRateLimit: true` to skip tests instead of failing on rate limits
- Monitor rate limiting patterns and adjust test timing accordingly

### 3. Retry Configuration

- Set appropriate `maxRetries` based on API characteristics
- Use exponential backoff for better resource utilization
- Add jitter to prevent thundering herd problems

### 4. Test Data Management

- Use `createTestData()` for consistent test data generation
- Ensure unique identifiers to prevent conflicts
- Clean up test data between test runs

## Integration with Jest

### Jest Configuration

```javascript
// jest.config.js
module.exports = {
  maxWorkers: process.env.CI ? 1 : 2,
  testTimeout: 30000,
  setupFilesAfterEnv: ['./tests/setup.js'],
  testRetryConfig: {
    enableRetries: true,
    maxRetries: 3,
    retryDelay: 1000,
    rateLimitCooldown: 5000
  }
};
```

### Global Setup Integration

The retry logic is automatically integrated into the global test setup through `tests/setup.js`, providing:

- Automatic test environment initialization
- Global retry configuration
- Comprehensive cleanup and reporting

## Troubleshooting

### High Rate Limiting

If tests frequently hit rate limits:

1. Increase delays between tests
2. Reduce concurrent test execution
3. Implement longer cooldown periods
4. Consider test data isolation strategies

### Test Timeouts

If tests timeout frequently:

1. Increase test timeout values
2. Optimize test data setup
3. Check database connection stability
4. Review network connectivity

### Flaky Tests

If tests are inconsistent:

1. Enable retry logic with appropriate configuration
2. Add test isolation delays
3. Review test data dependencies
4. Check for race conditions

## Performance Impact

The retry logic is designed to minimize performance impact:

- **Minimal Overhead**: Only activates on failures
- **Smart Delays**: Uses exponential backoff to minimize wait times
- **Concurrent Control**: Prevents resource exhaustion
- **Adaptive Behavior**: Learns from rate limiting patterns

## Future Enhancements

Planned improvements include:

- Machine learning-based retry prediction
- Integration with CI/CD pipeline metrics
- Advanced rate limiting pattern detection
- Distributed test coordination
- Real-time test performance dashboards

## Contributing

When adding new retry logic:

1. Follow the existing error classification patterns
2. Add comprehensive tests for new retry scenarios
3. Update documentation with usage examples
4. Consider performance implications
5. Maintain backward compatibility

## Support

For issues or questions about the retry logic:

1. Check the test logs for detailed error information
2. Review the test environment statistics
3. Consult the troubleshooting section
4. Examine similar test implementations in the codebase