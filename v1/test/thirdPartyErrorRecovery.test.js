// v1/test/thirdPartyErrorRecovery.test.js
const ServiceWrapper = require('../utils/serviceWrapper');
const { circuitBreakerManager } = require('../utils/circuitBreaker');
const { retryWithBackoff } = require('../utils/retryHandler');
const logger = require('../utils/logger');

// Mock logger to avoid console output during tests
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

describe('Third-Party API Error Recovery Tests', () => {
  beforeEach(() => {
    // Reset all circuit breakers before each test
    circuitBreakerManager.resetAll();
    jest.clearAllMocks();
  });

  describe('ServiceWrapper Error Recovery', () => {
    test('should execute service call successfully', async () => {
      const serviceWrapper = new ServiceWrapper('TestService');
      const mockServiceCall = jest.fn().mockResolvedValue({ success: true });

      const result = await serviceWrapper.execute(mockServiceCall, 'testOperation');

      expect(result).toEqual({ success: true });
      expect(mockServiceCall).toHaveBeenCalledTimes(1);
    });

    test('should retry failed service calls', async () => {
      const serviceWrapper = new ServiceWrapper('TestService', {
        maxRetries: 2,
        initialDelay: 10 // Fast retry for testing
      });

      let attempts = 0;
      const mockServiceCall = jest.fn(() => {
        attempts++;
        if (attempts <= 2) {
          const error = new Error('Service temporarily unavailable');
          error.code = 'ECONNREFUSED';
          throw error;
        }
        return { success: true, attempts };
      });

      const result = await serviceWrapper.execute(mockServiceCall, 'testOperation');

      expect(result).toEqual({ success: true, attempts: 3 });
      expect(mockServiceCall).toHaveBeenCalledTimes(3);
    });

    test('should use fallback when service fails', async () => {
      const serviceWrapper = new ServiceWrapper('TestService', {
        maxRetries: 1,
        initialDelay: 10,
        fallbackStrategies: {
          testOperation: {
            type: 'mock',
            data: { fallback: true }
          }
        }
      });

      const mockServiceCall = jest.fn(() => {
        const error = new Error('Service unavailable');
        error.code = 'ECONNREFUSED';
        throw error;
      });

      const result = await serviceWrapper.execute(mockServiceCall, 'testOperation');

      expect(result).toEqual({ fallback: true });
      expect(mockServiceCall).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });

    test('should handle circuit breaker open state', async () => {
      const serviceWrapper = new ServiceWrapper('TestService', {
        failureThreshold: 2,
        recoveryTimeout: 1000
      });

      const mockServiceCall = jest.fn(() => {
        const error = new Error('Service error');
        error.code = 'ECONNREFUSED';
        throw error;
      });

      // Trigger circuit breaker by failing multiple times
      await expect(serviceWrapper.execute(mockServiceCall, 'testOperation')).rejects.toThrow();
      await expect(serviceWrapper.execute(mockServiceCall, 'testOperation')).rejects.toThrow();
      
      // Circuit breaker should now be open - the service wrapper converts this to a user-friendly error
      await expect(serviceWrapper.execute(mockServiceCall, 'testOperation')).rejects.toThrow('TestService service is temporarily unavailable');
      
      // Verify circuit breaker status
      const status = serviceWrapper.getHealthStatus();
      expect(status.circuitBreakerStatus.state).toBe('OPEN');
    });

    test('should provide degraded response fallback', async () => {
      const serviceWrapper = new ServiceWrapper('TestService', {
        fallbackStrategies: {
          testOperation: {
            type: 'degraded_response'
          }
        }
      });

      const mockServiceCall = jest.fn(() => {
        throw new Error('Service error');
      });

      const result = await serviceWrapper.execute(mockServiceCall, 'testOperation');

      expect(result).toMatchObject({
        status: 'partial_success',
        isDegradedResponse: true
      });
    });

    test('should create user-friendly error messages', async () => {
      const serviceWrapper = new ServiceWrapper('PaymentService');
      const mockServiceCall = jest.fn(() => {
        const error = new Error('Connection refused');
        error.code = 'ECONNREFUSED';
        throw error;
      });

      await expect(serviceWrapper.execute(mockServiceCall, 'payment')).rejects.toThrow('Payment service is temporarily unavailable');
    });
  });

  describe('Retry Handler', () => {
    test('should retry retryable errors', async () => {
      let attempts = 0;
      const mockFunction = jest.fn(() => {
        attempts++;
        if (attempts <= 2) {
          const error = new Error('Network error');
          error.code = 'ETIMEDOUT';
          throw error;
        }
        return { success: true, attempts };
      });

      const result = await retryWithBackoff(mockFunction, {
        maxRetries: 3,
        initialDelay: 10
      }, 'TestService');

      expect(result).toEqual({ success: true, attempts: 3 });
      expect(mockFunction).toHaveBeenCalledTimes(3);
    });

    test('should not retry non-retryable errors', async () => {
      const mockFunction = jest.fn(() => {
        const error = new Error('Validation error');
        error.response = { status: 400 };
        throw error;
      });

      await expect(retryWithBackoff(mockFunction, {
        maxRetries: 3,
        initialDelay: 10
      }, 'TestService')).rejects.toThrow('Validation error');

      expect(mockFunction).toHaveBeenCalledTimes(1);
    });

    test('should respect maximum retry attempts', async () => {
      const mockFunction = jest.fn(() => {
        const error = new Error('Persistent error');
        error.code = 'ECONNREFUSED';
        throw error;
      });

      await expect(retryWithBackoff(mockFunction, {
        maxRetries: 2,
        initialDelay: 10
      }, 'TestService')).rejects.toThrow('Persistent error');

      expect(mockFunction).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    test('should calculate exponential backoff delays', async () => {
      const delays = [];
      const mockFunction = jest.fn(() => {
        const error = new Error('Network error');
        error.code = 'ETIMEDOUT';
        throw error;
      });

      const startTime = Date.now();
      
      try {
        await retryWithBackoff(mockFunction, {
          maxRetries: 2,
          initialDelay: 100,
          backoffMultiplier: 2
        }, 'TestService');
      } catch (error) {
        // Expected to fail
      }

      const totalTime = Date.now() - startTime;
      
      // Should have taken at least the sum of delays (100ms + 200ms = 300ms)
      // Adding some tolerance for test execution time
      expect(totalTime).toBeGreaterThan(250);
      expect(mockFunction).toHaveBeenCalledTimes(3);
    });
  });

  describe('Circuit Breaker Integration', () => {
    test('should track service health status', async () => {
      const serviceWrapper = new ServiceWrapper('HealthTestService');
      
      const healthStatus = serviceWrapper.getHealthStatus();
      
      expect(healthStatus).toMatchObject({
        serviceName: 'HealthTestService',
        isHealthy: true,
        circuitBreakerStatus: expect.any(Object)
      });
    });

    test('should perform health checks', async () => {
      const serviceWrapper = new ServiceWrapper('HealthTestService');
      
      const healthCheckFn = jest.fn().mockResolvedValue(true);
      const isHealthy = await serviceWrapper.performHealthCheck(healthCheckFn);
      
      expect(isHealthy).toBe(true);
      expect(healthCheckFn).toHaveBeenCalledTimes(1);
      
      const healthStatus = serviceWrapper.getHealthStatus();
      expect(healthStatus.isHealthy).toBe(true);
      expect(healthStatus.lastHealthCheck).toBeInstanceOf(Date);
    });

    test('should handle failed health checks', async () => {
      const serviceWrapper = new ServiceWrapper('HealthTestService');
      
      const healthCheckFn = jest.fn().mockRejectedValue(new Error('Health check failed'));
      const isHealthy = await serviceWrapper.performHealthCheck(healthCheckFn);
      
      expect(isHealthy).toBe(false);
      
      const healthStatus = serviceWrapper.getHealthStatus();
      expect(healthStatus.isHealthy).toBe(false);
    });
  });

  describe('Error Classification and Recovery', () => {
    test('should classify network errors as retryable', async () => {
      const serviceWrapper = new ServiceWrapper('NetworkTestService', {
        maxRetries: 1,
        initialDelay: 10
      });

      const networkErrors = [
        { code: 'ECONNREFUSED' },
        { code: 'ETIMEDOUT' },
        { code: 'ENOTFOUND' },
        { name: 'TimeoutError' }
      ];

      for (const errorProps of networkErrors) {
        const mockServiceCall = jest.fn(() => {
          const error = new Error('Network error');
          Object.assign(error, errorProps);
          throw error;
        });

        await expect(serviceWrapper.execute(mockServiceCall, 'testOperation')).rejects.toThrow();
        expect(mockServiceCall).toHaveBeenCalledTimes(2); // Initial + 1 retry
        
        jest.clearAllMocks();
      }
    });

    test('should classify client errors as non-retryable', async () => {
      const serviceWrapper = new ServiceWrapper('ClientErrorTestService');

      const clientErrors = [
        { response: { status: 400 } },
        { response: { status: 401 } },
        { response: { status: 403 } },
        { response: { status: 404 } }
      ];

      for (const errorProps of clientErrors) {
        const mockServiceCall = jest.fn(() => {
          const error = new Error('Client error');
          Object.assign(error, errorProps);
          throw error;
        });

        await expect(serviceWrapper.execute(mockServiceCall, 'testOperation')).rejects.toThrow();
        expect(mockServiceCall).toHaveBeenCalledTimes(1); // No retry
        
        jest.clearAllMocks();
      }
    });

    test('should classify server errors as retryable', async () => {
      const serviceWrapper = new ServiceWrapper('ServerErrorTestService', {
        maxRetries: 1,
        initialDelay: 10
      });

      const serverErrors = [
        { response: { status: 500 } },
        { response: { status: 502 } },
        { response: { status: 503 } },
        { response: { status: 504 } }
      ];

      for (const errorProps of serverErrors) {
        const mockServiceCall = jest.fn(() => {
          const error = new Error('Server error');
          Object.assign(error, errorProps);
          throw error;
        });

        await expect(serviceWrapper.execute(mockServiceCall, 'testOperation')).rejects.toThrow();
        expect(mockServiceCall).toHaveBeenCalledTimes(2); // Initial + 1 retry
        
        jest.clearAllMocks();
      }
    });
  });

  describe('Fallback Strategy Types', () => {
    test('should handle function-based fallbacks', async () => {
      const fallbackFn = jest.fn().mockResolvedValue({ fallback: 'function' });
      
      const serviceWrapper = new ServiceWrapper('FallbackTestService', {
        fallbackStrategies: {
          testOperation: fallbackFn
        }
      });

      const mockServiceCall = jest.fn(() => {
        throw new Error('Service error');
      });

      const result = await serviceWrapper.execute(mockServiceCall, 'testOperation');

      expect(result).toEqual({ fallback: 'function' });
      expect(fallbackFn).toHaveBeenCalledTimes(1);
    });

    test('should handle static value fallbacks', async () => {
      const serviceWrapper = new ServiceWrapper('StaticFallbackTestService', {
        fallbackStrategies: {
          testOperation: { static: 'value' }
        }
      });

      const mockServiceCall = jest.fn(() => {
        throw new Error('Service error');
      });

      const result = await serviceWrapper.execute(mockServiceCall, 'testOperation');

      expect(result).toEqual({ static: 'value' });
    });

    test('should handle mock response fallbacks', async () => {
      const serviceWrapper = new ServiceWrapper('MockFallbackTestService', {
        fallbackStrategies: {
          testOperation: {
            type: 'mock',
            data: { mock: 'response' }
          }
        }
      });

      const mockServiceCall = jest.fn(() => {
        throw new Error('Service error');
      });

      const result = await serviceWrapper.execute(mockServiceCall, 'testOperation');

      expect(result).toEqual({ mock: 'response' });
    });
  });
});