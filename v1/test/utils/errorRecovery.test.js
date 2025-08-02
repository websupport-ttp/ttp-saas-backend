// v1/test/utils/errorRecovery.test.js
const mongoose = require('mongoose');
const errorRecovery = require('../../utils/errorRecovery');
const { AffiliateError, WalletError } = require('../../utils/affiliateErrors');

// Mock logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

describe('ErrorRecoveryManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('executeWithRetry', () => {
    it('should execute operation successfully on first attempt', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      const result = await errorRecovery.executeWithRetry(mockOperation, {
        operationName: 'test-operation'
      });
      
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockResolvedValue('success');
      
      const result = await errorRecovery.executeWithRetry(mockOperation, {
        operationName: 'test-operation',
        maxAttempts: 3,
        baseDelay: 10 // Reduce delay for testing
      });
      
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });

    it('should not retry on non-retryable errors', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new AffiliateError('Not retryable'));
      
      await expect(errorRecovery.executeWithRetry(mockOperation, {
        operationName: 'test-operation'
      })).rejects.toThrow('Not retryable');
      
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should fail after max attempts', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
      
      await expect(errorRecovery.executeWithRetry(mockOperation, {
        operationName: 'test-operation',
        maxAttempts: 2,
        baseDelay: 10
      })).rejects.toThrow('ECONNRESET');
      
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });

    it('should respect custom retryable errors', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('CUSTOM_ERROR'));
      
      await expect(errorRecovery.executeWithRetry(mockOperation, {
        operationName: 'test-operation',
        retryableErrors: ['CUSTOM_ERROR'],
        maxAttempts: 2,
        baseDelay: 10
      })).rejects.toThrow('CUSTOM_ERROR');
      
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });
  });

  describe('isRetryableError', () => {
    it('should identify retryable network errors', () => {
      const networkError = new Error('Connection failed');
      networkError.code = 'ECONNRESET';
      
      expect(errorRecovery.isRetryableError(networkError, ['ECONNRESET'])).toBe(true);
    });

    it('should identify MongoDB network errors as retryable', () => {
      const mongoError = new Error('MongoDB connection failed');
      mongoError.name = 'MongoNetworkError';
      
      expect(errorRecovery.isRetryableError(mongoError, [])).toBe(true);
    });

    it('should identify MongoDB timeout errors as retryable', () => {
      const mongoError = new Error('MongoDB timeout');
      mongoError.name = 'MongoTimeoutError';
      
      expect(errorRecovery.isRetryableError(mongoError, [])).toBe(true);
    });

    it('should not retry validation errors', () => {
      const validationError = new Error('Validation failed');
      validationError.name = 'ValidationError';
      
      expect(errorRecovery.isRetryableError(validationError, [])).toBe(false);
    });

    it('should not retry affiliate system errors', () => {
      const affiliateError = new AffiliateError('Affiliate not found');
      const walletError = new WalletError('Insufficient balance');
      
      expect(errorRecovery.isRetryableError(affiliateError, [])).toBe(false);
      expect(errorRecovery.isRetryableError(walletError, [])).toBe(false);
    });

    it('should retry 5xx HTTP errors but not 4xx', () => {
      const serverError = new Error('Server error');
      serverError.statusCode = 500;
      
      const clientError = new Error('Client error');
      clientError.statusCode = 400;
      
      expect(errorRecovery.isRetryableError(serverError, [])).toBe(true);
      expect(errorRecovery.isRetryableError(clientError, [])).toBe(false);
    });
  });

  describe('executeWithTransaction', () => {
    let mockSession;

    beforeEach(() => {
      mockSession = {
        id: 'session-123',
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn()
      };
      
      jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should execute operation within transaction successfully', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      const result = await errorRecovery.executeWithTransaction(mockOperation, {
        operationName: 'test-transaction',
        retryOnFailure: false
      });
      
      expect(result).toBe('success');
      expect(mockSession.startTransaction).toHaveBeenCalled();
      expect(mockSession.commitTransaction).toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalled();
      expect(mockOperation).toHaveBeenCalledWith(mockSession);
    });

    it('should rollback transaction on error', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Operation failed'));
      
      await expect(errorRecovery.executeWithTransaction(mockOperation, {
        operationName: 'test-transaction',
        retryOnFailure: false
      })).rejects.toThrow('Operation failed');
      
      expect(mockSession.startTransaction).toHaveBeenCalled();
      expect(mockSession.abortTransaction).toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalled();
      expect(mockSession.commitTransaction).not.toHaveBeenCalled();
    });

    it('should handle rollback errors gracefully', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Operation failed'));
      mockSession.abortTransaction.mockRejectedValue(new Error('Rollback failed'));
      
      await expect(errorRecovery.executeWithTransaction(mockOperation, {
        operationName: 'test-transaction',
        retryOnFailure: false
      })).rejects.toThrow('Operation failed');
      
      expect(mockSession.abortTransaction).toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalled();
    });
  });

  describe('executeWithCompensation', () => {
    it('should execute all operations successfully', async () => {
      const operation1 = jest.fn().mockResolvedValue('result1');
      const operation2 = jest.fn().mockResolvedValue('result2');
      const compensation1 = jest.fn();
      const compensation2 = jest.fn();
      
      const operations = [
        { operation: operation1, compensation: compensation1, name: 'op1' },
        { operation: operation2, compensation: compensation2, name: 'op2' }
      ];
      
      const results = await errorRecovery.executeWithCompensation(operations, {
        operationName: 'test-compensation'
      });
      
      expect(results).toEqual(['result1', 'result2']);
      expect(operation1).toHaveBeenCalled();
      expect(operation2).toHaveBeenCalled();
      expect(compensation1).not.toHaveBeenCalled();
      expect(compensation2).not.toHaveBeenCalled();
    });

    it('should execute compensation in reverse order on failure', async () => {
      const operation1 = jest.fn().mockResolvedValue('result1');
      const operation2 = jest.fn().mockRejectedValue(new Error('Operation 2 failed'));
      const compensation1 = jest.fn();
      const compensation2 = jest.fn();
      
      const operations = [
        { operation: operation1, compensation: compensation1, name: 'op1' },
        { operation: operation2, compensation: compensation2, name: 'op2' }
      ];
      
      await expect(errorRecovery.executeWithCompensation(operations, {
        operationName: 'test-compensation'
      })).rejects.toThrow('Operation 2 failed');
      
      expect(operation1).toHaveBeenCalled();
      expect(operation2).toHaveBeenCalled();
      expect(compensation1).toHaveBeenCalledWith('result1');
      expect(compensation2).not.toHaveBeenCalled(); // Operation 2 failed, so no compensation
    });

    it('should handle compensation failures gracefully', async () => {
      const operation1 = jest.fn().mockResolvedValue('result1');
      const operation2 = jest.fn().mockRejectedValue(new Error('Operation 2 failed'));
      const compensation1 = jest.fn().mockRejectedValue(new Error('Compensation failed'));
      
      const operations = [
        { operation: operation1, compensation: compensation1, name: 'op1' },
        { operation: operation2, compensation: null, name: 'op2' }
      ];
      
      await expect(errorRecovery.executeWithCompensation(operations, {
        operationName: 'test-compensation'
      })).rejects.toThrow('Operation 2 failed');
      
      expect(compensation1).toHaveBeenCalled();
    });
  });

  describe('createCircuitBreaker', () => {
    it('should execute operation when circuit is closed', async () => {
      const circuitBreaker = errorRecovery.createCircuitBreaker('test-service');
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      const result = await circuitBreaker.execute(mockOperation);
      
      expect(result).toBe('success');
      expect(circuitBreaker.state).toBe('CLOSED');
      expect(circuitBreaker.failureCount).toBe(0);
    });

    it('should open circuit after failure threshold', async () => {
      const circuitBreaker = errorRecovery.createCircuitBreaker('test-service', {
        failureThreshold: 2
      });
      const mockOperation = jest.fn().mockRejectedValue(new Error('Service failed'));
      
      // First failure
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('Service failed');
      expect(circuitBreaker.state).toBe('CLOSED');
      expect(circuitBreaker.failureCount).toBe(1);
      
      // Second failure - should open circuit
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('Service failed');
      expect(circuitBreaker.state).toBe('OPEN');
      expect(circuitBreaker.failureCount).toBe(2);
    });

    it('should reject requests when circuit is open', async () => {
      const circuitBreaker = errorRecovery.createCircuitBreaker('test-service', {
        failureThreshold: 1
      });
      const mockOperation = jest.fn().mockRejectedValue(new Error('Service failed'));
      
      // Trigger circuit opening
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('Service failed');
      expect(circuitBreaker.state).toBe('OPEN');
      
      // Should reject without calling operation
      const mockOperation2 = jest.fn();
      await expect(circuitBreaker.execute(mockOperation2)).rejects.toThrow('Circuit breaker is OPEN');
      expect(mockOperation2).not.toHaveBeenCalled();
    });

    it('should transition to half-open after reset timeout', async () => {
      const circuitBreaker = errorRecovery.createCircuitBreaker('test-service', {
        failureThreshold: 1,
        resetTimeout: 10 // 10ms for testing
      });
      const mockOperation = jest.fn().mockRejectedValue(new Error('Service failed'));
      
      // Open circuit
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('Service failed');
      expect(circuitBreaker.state).toBe('OPEN');
      
      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 15));
      
      // Should transition to half-open and allow operation
      const mockOperation2 = jest.fn().mockResolvedValue('success');
      const result = await circuitBreaker.execute(mockOperation2);
      
      expect(result).toBe('success');
      expect(circuitBreaker.state).toBe('CLOSED');
      expect(circuitBreaker.failureCount).toBe(0);
    });
  });

  describe('withTimeout', () => {
    it('should resolve operation within timeout', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      const result = await errorRecovery.withTimeout(mockOperation, 1000, 'test-operation');
      
      expect(result).toBe('success');
    });

    it('should timeout long-running operations', async () => {
      const mockOperation = jest.fn(() => new Promise(resolve => setTimeout(resolve, 100)));
      
      await expect(errorRecovery.withTimeout(mockOperation, 10, 'test-operation'))
        .rejects.toThrow('test-operation timed out after 10ms');
    });
  });

  describe('batchWithErrorIsolation', () => {
    it('should execute all operations successfully', async () => {
      const operations = [
        jest.fn().mockResolvedValue('result1'),
        jest.fn().mockResolvedValue('result2'),
        jest.fn().mockResolvedValue('result3')
      ];
      
      const results = await errorRecovery.batchWithErrorIsolation(operations, {
        operationName: 'test-batch'
      });
      
      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
      expect(results.map(r => r.result)).toEqual(['result1', 'result2', 'result3']);
    });

    it('should isolate errors and continue with other operations', async () => {
      const operations = [
        jest.fn().mockResolvedValue('result1'),
        jest.fn().mockRejectedValue(new Error('Operation 2 failed')),
        jest.fn().mockResolvedValue('result3')
      ];
      
      const results = await errorRecovery.batchWithErrorIsolation(operations, {
        operationName: 'test-batch'
      });
      
      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[0].result).toBe('result1');
      expect(results[1].success).toBe(false);
      expect(results[1].error.message).toBe('Operation 2 failed');
      expect(results[2].success).toBe(true);
      expect(results[2].result).toBe('result3');
    });

    it('should respect concurrency limits', async () => {
      let concurrentCount = 0;
      let maxConcurrent = 0;
      
      const operations = Array(10).fill().map(() => jest.fn(async () => {
        concurrentCount++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCount);
        await new Promise(resolve => setTimeout(resolve, 10));
        concurrentCount--;
        return 'success';
      }));
      
      await errorRecovery.batchWithErrorIsolation(operations, {
        concurrency: 3,
        operationName: 'test-batch'
      });
      
      expect(maxConcurrent).toBeLessThanOrEqual(3);
    });
  });

  describe('sleep', () => {
    it('should sleep for specified duration', async () => {
      const start = Date.now();
      await errorRecovery.sleep(50);
      const end = Date.now();
      
      expect(end - start).toBeGreaterThanOrEqual(45); // Allow some variance
    });
  });
});