// v1/test/utils/testRetryLogic.simple.test.js
// Simple test to verify retry logic functionality

const { StatusCodes } = require('http-status-codes');

// Import retry logic components
const {
  withRetry,
  retryableTest,
  getRetryStrategy,
  calculateDelay,
  RETRY_CONFIG,
  testDelay
} = require('./testRetryLogic');

describe('Test Retry Logic - Simple Tests', () => {
  
  test('should import retry logic components correctly', () => {
    expect(withRetry).toBeDefined();
    expect(retryableTest).toBeDefined();
    expect(getRetryStrategy).toBeDefined();
    expect(calculateDelay).toBeDefined();
    expect(RETRY_CONFIG).toBeDefined();
    expect(testDelay).toBeDefined();
    
    // Check configuration structure
    expect(RETRY_CONFIG.rateLimitRetry).toBeDefined();
    expect(RETRY_CONFIG.rateLimitRetry.maxRetries).toBe(3);
    expect(RETRY_CONFIG.rateLimitRetry.baseDelay).toBe(1000);
    
    console.log('✅ All retry logic components imported successfully');
  });

  test('should calculate delay correctly with exponential backoff', () => {
    const config = RETRY_CONFIG.rateLimitRetry;
    
    // Test delay calculation for different attempts
    const delay0 = calculateDelay(0, config);
    const delay1 = calculateDelay(1, config);
    const delay2 = calculateDelay(2, config);
    
    expect(delay0).toBeGreaterThanOrEqual(config.baseDelay * 0.9); // Account for jitter
    expect(delay1).toBeGreaterThanOrEqual(config.baseDelay * 2 * 0.9);
    expect(delay2).toBeGreaterThanOrEqual(config.baseDelay * 4 * 0.9);
    
    console.log(`✅ Delay calculation: attempt 0=${delay0}ms, attempt 1=${delay1}ms, attempt 2=${delay2}ms`);
  });

  test('should identify rate limit errors correctly', () => {
    const rateLimitError = {
      status: StatusCodes.TOO_MANY_REQUESTS,
      message: 'Too many requests'
    };
    
    const strategy = getRetryStrategy(rateLimitError);
    
    expect(strategy.shouldRetry).toBe(true);
    expect(strategy.type).toBe('rateLimitRetry');
    expect(strategy.reason).toBe('Rate limit exceeded');
    
    console.log('✅ Rate limit error detection working correctly');
  });

  test('should identify non-retryable errors correctly', () => {
    const validationError = {
      status: StatusCodes.BAD_REQUEST,
      message: 'Validation failed'
    };
    
    const strategy = getRetryStrategy(validationError);
    
    expect(strategy.shouldRetry).toBe(false);
    expect(strategy.reason).toBe('Non-retryable error');
    
    console.log('✅ Non-retryable error detection working correctly');
  });

  test('should execute successful function without retries', async () => {
    let callCount = 0;
    
    const successfulFunction = async () => {
      callCount++;
      return 'success';
    };
    
    const result = await withRetry(successfulFunction, {
      maxRetries: 3,
      context: 'test function'
    });
    
    expect(result).toBe('success');
    expect(callCount).toBe(1);
    
    console.log('✅ Successful function execution without retries');
  });

  test('should retry failing function and eventually succeed', async () => {
    let callCount = 0;
    
    const eventuallySuccessfulFunction = async () => {
      callCount++;
      if (callCount < 3) {
        const error = new Error('Temporary failure');
        error.status = StatusCodes.INTERNAL_SERVER_ERROR;
        error.message = 'timeout occurred';
        throw error;
      }
      return 'success after retries';
    };
    
    const result = await withRetry(eventuallySuccessfulFunction, {
      maxRetries: 3,
      context: 'eventually successful function'
    });
    
    expect(result).toBe('success after retries');
    expect(callCount).toBe(3);
    
    console.log('✅ Function succeeded after retries');
  });

  test('should handle rate limit with proper delay', async () => {
    let callCount = 0;
    const startTime = Date.now();
    
    const rateLimitedFunction = async () => {
      callCount++;
      if (callCount === 1) {
        const error = new Error('Rate limited');
        error.status = StatusCodes.TOO_MANY_REQUESTS;
        throw error;
      }
      return 'success after rate limit';
    };
    
    const result = await withRetry(rateLimitedFunction, {
      maxRetries: 2,
      context: 'rate limited function'
    });
    
    const duration = Date.now() - startTime;
    
    expect(result).toBe('success after rate limit');
    expect(callCount).toBe(2);
    expect(duration).toBeGreaterThan(1000); // Should have waited at least 1 second
    
    console.log(`✅ Rate limit handled with proper delay (${duration}ms)`);
  });

  test('should respect maximum retries limit', async () => {
    let callCount = 0;
    
    const alwaysFailingFunction = async () => {
      callCount++;
      const error = new Error('Always fails');
      error.status = StatusCodes.TOO_MANY_REQUESTS;
      throw error;
    };
    
    await expect(withRetry(alwaysFailingFunction, {
      maxRetries: 2,
      context: 'always failing function'
    })).rejects.toThrow('Always fails');
    
    expect(callCount).toBe(3); // Initial attempt + 2 retries
    
    console.log('✅ Maximum retries limit respected');
  });

  test('should add test delay correctly', async () => {
    const startTime = Date.now();
    const delayMs = 100;
    
    await testDelay(delayMs);
    
    const duration = Date.now() - startTime;
    expect(duration).toBeGreaterThanOrEqual(delayMs - 10); // Allow small margin
    
    console.log(`✅ Test delay working correctly (${duration}ms)`);
  });

  test('should wrap test function with retry logic', async () => {
    let callCount = 0;
    
    const testFunction = async () => {
      callCount++;
      if (callCount === 1) {
        const error = new Error('First attempt fails');
        error.status = StatusCodes.TOO_MANY_REQUESTS;
        throw error;
      }
      return 'test passed';
    };
    
    const wrappedTest = retryableTest(testFunction, {
      maxRetries: 2,
      context: 'wrapped test'
    });
    
    const result = await wrappedTest();
    
    expect(result).toBe('test passed');
    expect(callCount).toBe(2);
    
    console.log('✅ Test function wrapped with retry logic successfully');
  });

});