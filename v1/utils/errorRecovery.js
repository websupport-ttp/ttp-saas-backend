// v1/utils/errorRecovery.js
const mongoose = require('mongoose');
const logger = require('./logger');
const { 
  AffiliateError, 
  WalletError, 
  CommissionError, 
  WithdrawalError,
  QRCodeError 
} = require('./affiliateErrors');

/**
 * @class ErrorRecoveryManager
 * @description Manages error recovery strategies and transaction rollbacks for affiliate operations
 */
class ErrorRecoveryManager {
  constructor() {
    this.retryAttempts = 3;
    this.retryDelay = 1000; // 1 second base delay
    this.maxRetryDelay = 30000; // 30 seconds max delay
  }

  /**
   * Execute operation with retry logic and exponential backoff
   * @param {Function} operation - Operation to execute
   * @param {object} options - Retry options
   * @param {number} options.maxAttempts - Maximum retry attempts
   * @param {number} options.baseDelay - Base delay in milliseconds
   * @param {Array<string>} options.retryableErrors - Error codes that should trigger retry
   * @param {string} options.operationName - Name of operation for logging
   * @param {object} options.context - Additional context for logging
   * @returns {Promise<any>} Operation result
   */
  async executeWithRetry(operation, options = {}) {
    const {
      maxAttempts = this.retryAttempts,
      baseDelay = this.retryDelay,
      retryableErrors = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'DATABASE_ERROR'],
      operationName = 'operation',
      context = {}
    } = options;

    let lastError;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await operation();
        
        if (attempt > 1) {
          logger.info(`${operationName} succeeded after ${attempt} attempts`, {
            attempt,
            context,
            operationName
          });
        }
        
        return result;
      } catch (error) {
        lastError = error;
        
        // Check if error is retryable
        const isRetryable = this.isRetryableError(error, retryableErrors);
        
        logger.warn(`${operationName} failed on attempt ${attempt}`, {
          attempt,
          maxAttempts,
          error: error.message,
          errorCode: error.code,
          isRetryable,
          context,
          operationName
        });

        // If not retryable or last attempt, throw error
        if (!isRetryable || attempt === maxAttempts) {
          logger.error(`${operationName} failed permanently after ${attempt} attempts`, {
            attempt,
            error: error.message,
            errorCode: error.code,
            context,
            operationName
          });
          throw error;
        }

        // Calculate delay with exponential backoff and jitter
        const delay = Math.min(
          baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000,
          this.maxRetryDelay
        );

        logger.info(`Retrying ${operationName} in ${delay}ms`, {
          attempt,
          delay,
          context,
          operationName
        });

        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Check if error is retryable based on error type and code
   * @param {Error} error - Error to check
   * @param {Array<string>} retryableErrors - List of retryable error codes
   * @returns {boolean} Whether error is retryable
   */
  isRetryableError(error, retryableErrors) {
    // Network and timeout errors are generally retryable
    if (error.code && retryableErrors.includes(error.code)) {
      return true;
    }

    // Check error message for retryable patterns
    if (error.message && retryableErrors.some(code => error.message.includes(code))) {
      return true;
    }

    // MongoDB connection errors
    if (error.name === 'MongoNetworkError' || error.name === 'MongoTimeoutError') {
      return true;
    }

    // Mongoose validation errors are not retryable
    if (error.name === 'ValidationError') {
      return false;
    }

    // Affiliate system operational errors are generally not retryable
    if (error instanceof AffiliateError || 
        error instanceof WalletError || 
        error instanceof CommissionError ||
        error instanceof WithdrawalError ||
        error instanceof QRCodeError) {
      return false;
    }

    // HTTP 5xx errors are retryable, 4xx are not
    if (error.statusCode) {
      return error.statusCode >= 500;
    }

    // Default to not retryable for unknown errors
    return false;
  }

  /**
   * Execute operation within a database transaction with rollback capability
   * @param {Function} operation - Operation to execute within transaction
   * @param {object} options - Transaction options
   * @param {string} options.operationName - Name of operation for logging
   * @param {object} options.context - Additional context for logging
   * @param {boolean} options.retryOnFailure - Whether to retry on failure
   * @returns {Promise<any>} Operation result
   */
  async executeWithTransaction(operation, options = {}) {
    const {
      operationName = 'transaction',
      context = {},
      retryOnFailure = true
    } = options;

    const executeTransaction = async () => {
      const session = await mongoose.startSession();
      
      try {
        session.startTransaction();
        
        logger.info(`Starting transaction for ${operationName}`, {
          operationName,
          context,
          sessionId: session.id
        });

        const result = await operation(session);
        
        await session.commitTransaction();
        
        logger.info(`Transaction committed successfully for ${operationName}`, {
          operationName,
          context,
          sessionId: session.id
        });

        return result;
      } catch (error) {
        logger.error(`Transaction failed for ${operationName}, rolling back`, {
          operationName,
          error: error.message,
          errorCode: error.code,
          context,
          sessionId: session.id
        });

        try {
          await session.abortTransaction();
          logger.info(`Transaction rolled back successfully for ${operationName}`, {
            operationName,
            context,
            sessionId: session.id
          });
        } catch (rollbackError) {
          logger.error(`Failed to rollback transaction for ${operationName}`, {
            operationName,
            rollbackError: rollbackError.message,
            originalError: error.message,
            context,
            sessionId: session.id
          });
        }

        throw error;
      } finally {
        await session.endSession();
      }
    };

    if (retryOnFailure) {
      return this.executeWithRetry(executeTransaction, {
        operationName: `${operationName} (with transaction)`,
        context,
        retryableErrors: ['MongoNetworkError', 'MongoTimeoutError', 'DATABASE_ERROR']
      });
    } else {
      return executeTransaction();
    }
  }

  /**
   * Execute multiple operations with compensation logic
   * @param {Array<object>} operations - Array of operations with compensation
   * @param {object} options - Execution options
   * @returns {Promise<Array<any>>} Results of all operations
   */
  async executeWithCompensation(operations, options = {}) {
    const {
      operationName = 'compensated operation',
      context = {}
    } = options;

    const results = [];
    const executedOperations = [];

    try {
      for (let i = 0; i < operations.length; i++) {
        const { operation, compensation, name } = operations[i];
        
        logger.info(`Executing operation ${i + 1}/${operations.length}: ${name}`, {
          operationName,
          stepName: name,
          context
        });

        const result = await operation();
        results.push(result);
        executedOperations.push({ compensation, name, result });
      }

      logger.info(`All operations completed successfully for ${operationName}`, {
        operationName,
        operationsCount: operations.length,
        context
      });

      return results;
    } catch (error) {
      logger.error(`Operation failed, executing compensation logic for ${operationName}`, {
        operationName,
        error: error.message,
        executedOperationsCount: executedOperations.length,
        context
      });

      // Execute compensation in reverse order
      for (let i = executedOperations.length - 1; i >= 0; i--) {
        const { compensation, name, result } = executedOperations[i];
        
        if (compensation) {
          try {
            logger.info(`Executing compensation for operation: ${name}`, {
              operationName,
              stepName: name,
              context
            });

            await compensation(result);
            
            logger.info(`Compensation completed for operation: ${name}`, {
              operationName,
              stepName: name,
              context
            });
          } catch (compensationError) {
            logger.error(`Compensation failed for operation: ${name}`, {
              operationName,
              stepName: name,
              compensationError: compensationError.message,
              originalError: error.message,
              context
            });
          }
        }
      }

      throw error;
    }
  }

  /**
   * Create a circuit breaker for external service calls
   * @param {string} serviceName - Name of the service
   * @param {object} options - Circuit breaker options
   * @returns {object} Circuit breaker instance
   */
  createCircuitBreaker(serviceName, options = {}) {
    const {
      failureThreshold = 5,
      resetTimeout = 60000, // 1 minute
      monitoringPeriod = 60000 // 1 minute
    } = options;

    return {
      serviceName,
      failureCount: 0,
      lastFailureTime: null,
      state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
      
      async execute(operation, context = {}) {
        if (this.state === 'OPEN') {
          if (Date.now() - this.lastFailureTime > resetTimeout) {
            this.state = 'HALF_OPEN';
            logger.info(`Circuit breaker transitioning to HALF_OPEN for ${serviceName}`, {
              serviceName,
              context
            });
          } else {
            throw new Error(`Circuit breaker is OPEN for ${serviceName}`);
          }
        }

        try {
          const result = await operation();
          
          if (this.state === 'HALF_OPEN') {
            this.state = 'CLOSED';
            this.failureCount = 0;
            logger.info(`Circuit breaker reset to CLOSED for ${serviceName}`, {
              serviceName,
              context
            });
          }

          return result;
        } catch (error) {
          this.failureCount++;
          this.lastFailureTime = Date.now();

          logger.warn(`Circuit breaker recorded failure for ${serviceName}`, {
            serviceName,
            failureCount: this.failureCount,
            failureThreshold,
            error: error.message,
            context
          });

          if (this.failureCount >= failureThreshold) {
            this.state = 'OPEN';
            logger.error(`Circuit breaker opened for ${serviceName}`, {
              serviceName,
              failureCount: this.failureCount,
              context
            });
          }

          throw error;
        }
      }
    };
  }

  /**
   * Sleep for specified duration
   * @param {number} ms - Duration in milliseconds
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a timeout wrapper for operations
   * @param {Function} operation - Operation to wrap
   * @param {number} timeoutMs - Timeout in milliseconds
   * @param {string} operationName - Name of operation
   * @returns {Promise<any>} Operation result
   */
  async withTimeout(operation, timeoutMs, operationName = 'operation') {
    return Promise.race([
      operation(),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      })
    ]);
  }

  /**
   * Batch operations with error isolation
   * @param {Array<Function>} operations - Operations to batch
   * @param {object} options - Batch options
   * @returns {Promise<Array<object>>} Results with success/error status
   */
  async batchWithErrorIsolation(operations, options = {}) {
    const {
      concurrency = 5,
      operationName = 'batch operation',
      context = {}
    } = options;

    const results = [];
    const chunks = [];

    // Split operations into chunks based on concurrency
    for (let i = 0; i < operations.length; i += concurrency) {
      chunks.push(operations.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (operation, index) => {
        try {
          const result = await operation();
          return { success: true, result, index };
        } catch (error) {
          logger.error(`Batch operation failed`, {
            operationName,
            index,
            error: error.message,
            context
          });
          return { success: false, error, index };
        }
      });

      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
    }

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    logger.info(`Batch operation completed`, {
      operationName,
      totalOperations: operations.length,
      successCount,
      errorCount,
      context
    });

    return results;
  }
}

// Export singleton instance
module.exports = new ErrorRecoveryManager();