/**
 * Retry Manager with Exponential Backoff
 * Handles retryable operations with configurable strategies
 */

import ErrorHandler from './error-handler.js';

export class RetryManager {
  constructor() {
    this.errorHandler = new ErrorHandler();
    this.retryHistory = new Map();
    this.defaultConfig = {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitter: true,
      resetAfter: 300000 // 5 minutes
    };
  }

  /**
   * Execute operation with retry logic
   */
  async executeWithRetry(operation, operationId, config = {}) {
    const retryConfig = { ...this.defaultConfig, ...config };
    const key = `${operationId}_${Date.now()}`;
    
    let lastError;
    let attempt = 0;

    while (attempt <= retryConfig.maxRetries) {
      try {
        // Record attempt
        this.recordAttempt(key, attempt);

        // Execute operation
        const result = await operation();
        
        // Success - clear retry history
        this.clearRetryHistory(operationId);
        return result;

      } catch (error) {
        lastError = error;
        attempt++;

        // Handle error and get recovery strategy
        const errorInfo = await this.errorHandler.handleError(error, {
          operationId,
          attempt,
          maxRetries: retryConfig.maxRetries
        });

        // Check if error is retryable
        if (!errorInfo.retryable || attempt > retryConfig.maxRetries) {
          throw new Error(`Operation ${operationId} failed after ${attempt} attempts: ${error.message}`);
        }

        // Calculate delay with exponential backoff
        const delay = this.calculateDelay(attempt, retryConfig);
        
        console.log(`🔄 Retrying ${operationId} (attempt ${attempt}/${retryConfig.maxRetries}) after ${delay}ms`);
        
        // Wait before retry
        await this.sleep(delay);
      }
    }

    // If we get here, all retries failed
    throw new Error(`Operation ${operationId} failed after ${retryConfig.maxRetries} retries: ${lastError.message}`);
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  calculateDelay(attempt, config) {
    // Exponential backoff: delay = initialDelay * (backoffMultiplier ^ attempt)
    let delay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    
    // Cap at maximum delay
    delay = Math.min(delay, config.maxDelay);
    
    // Add jitter to prevent thundering herd
    if (config.jitter) {
      const jitterAmount = delay * 0.1; // 10% jitter
      delay += (Math.random() - 0.5) * jitterAmount;
    }
    
    return Math.floor(delay);
  }

  /**
   * Sleep for specified milliseconds
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Record retry attempt
   */
  recordAttempt(key, attempt) {
    if (!this.retryHistory.has(key)) {
      this.retryHistory.set(key, []);
    }
    
    this.retryHistory.get(key).push({
      attempt,
      timestamp: Date.now()
    });
  }

  /**
   * Clear retry history for operation
   */
  clearRetryHistory(operationId) {
    // Remove entries older than resetAfter
    const cutoff = Date.now() - this.defaultConfig.resetAfter;
    
    for (const [key, attempts] of this.retryHistory.entries()) {
      if (key.startsWith(operationId) || 
          (attempts.length > 0 && attempts[attempts.length - 1].timestamp < cutoff)) {
        this.retryHistory.delete(key);
      }
    }
  }

  /**
   * Get retry statistics
   */
  getRetryStats() {
    const stats = {
      totalOperations: this.retryHistory.size,
      totalAttempts: 0,
      averageAttempts: 0,
      operationsByAttempts: {}
    };

    for (const attempts of this.retryHistory.values()) {
      stats.totalAttempts += attempts.length;
      const attemptCount = attempts.length;
      stats.operationsByAttempts[attemptCount] = (stats.operationsByAttempts[attemptCount] || 0) + 1;
    }

    stats.averageAttempts = stats.totalOperations > 0 ? 
      stats.totalAttempts / stats.totalOperations : 0;

    return stats;
  }

  /**
   * Create retry configuration for specific operation types
   */
  getRetryConfig(operationType) {
    const configs = {
      network: {
        maxRetries: 5,
        initialDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2,
        jitter: true
      },
      sdr_connection: {
        maxRetries: 3,
        initialDelay: 2000,
        maxDelay: 60000,
        backoffMultiplier: 3,
        jitter: true
      },
      audio_processing: {
        maxRetries: 2,
        initialDelay: 5000,
        maxDelay: 20000,
        backoffMultiplier: 2,
        jitter: false
      },
      rate_limited: {
        maxRetries: 10,
        initialDelay: 60000, // 1 minute
        maxDelay: 600000, // 10 minutes
        backoffMultiplier: 1.5,
        jitter: true
      },
      critical: {
        maxRetries: 1,
        initialDelay: 10000,
        maxDelay: 10000,
        backoffMultiplier: 1,
        jitter: false
      }
    };

    return configs[operationType] || this.defaultConfig;
  }

  /**
   * Bulk retry operation (for parallel operations)
   */
  async executeMultipleWithRetry(operations, operationIds, config = {}) {
    const promises = operations.map((operation, index) => 
      this.executeWithRetry(operation, operationIds[index] || `operation_${index}`, config)
    );

    return await Promise.allSettled(promises);
  }
}

export default RetryManager;