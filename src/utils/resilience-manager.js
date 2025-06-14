/**
 * Resilience Manager - Central coordination of all resilience mechanisms
 * Integrates error handling, retry logic, circuit breakers, rate limiting, and graceful degradation
 */

import ErrorHandler from './error-handler.js';
import RetryManager from './retry-manager.js';
import { CircuitBreakerManager } from './circuit-breaker.js';
import { RateLimiterManager } from './rate-limiter.js';
import GracefulDegradationManager from './graceful-degradation.js';

export class ResilienceManager {
  constructor() {
    this.errorHandler = new ErrorHandler();
    this.retryManager = new RetryManager();
    this.circuitBreakerManager = new CircuitBreakerManager();
    this.rateLimiterManager = new RateLimiterManager();
    this.degradationManager = new GracefulDegradationManager();
    
    this.operationHistory = new Map();
    this.globalConfig = {
      enableRetries: true,
      enableCircuitBreakers: true,
      enableRateLimiting: true,
      enableGracefulDegradation: true,
      maxConcurrentOperations: 10,
      operationTimeout: 30000
    };
  }

  /**
   * Execute operation with full resilience stack
   */
  async executeResilientOperation(config) {
    const {
      operationId,
      serviceType,
      operation,
      operationConfig = {},
      retryConfig = {},
      circuitBreakerConfig = {},
      rateLimitConfig = {}
    } = config;

    const startTime = Date.now();
    let lastError;

    try {
      // Step 1: Rate Limiting Check
      if (this.globalConfig.enableRateLimiting) {
        const rateLimiter = this.rateLimiterManager.getLimiter(serviceType);
        const limitCheck = await rateLimiter.checkLimit(operationId, operationConfig);
        
        if (!limitCheck.allowed) {
          throw new Error(`Rate limit exceeded for ${operationId}. Retry after ${limitCheck.retryAfter}ms`);
        }
      }

      // Step 2: Circuit Breaker Check
      if (this.globalConfig.enableCircuitBreakers) {
        const circuitBreaker = this.circuitBreakerManager.getBreaker(serviceType, circuitBreakerConfig);
        
        if (!circuitBreaker.allowRequest()) {
          throw new Error(`Circuit breaker is OPEN for ${serviceType}`);
        }
      }

      // Step 3: Execute with Graceful Degradation
      const resilientOperation = async (adjustedConfig) => {
        if (this.globalConfig.enableCircuitBreakers) {
          const circuitBreaker = this.circuitBreakerManager.getBreaker(serviceType);
          return await circuitBreaker.execute(
            () => operation(adjustedConfig),
            operationId
          );
        } else {
          return await operation(adjustedConfig);
        }
      };

      let result;
      if (this.globalConfig.enableGracefulDegradation) {
        result = await this.degradationManager.executeWithDegradation(
          serviceType,
          resilientOperation,
          operationConfig
        );
      } else {
        result = await resilientOperation(operationConfig);
      }

      // Record successful operation
      this.recordOperationSuccess(operationId, serviceType, Date.now() - startTime);
      
      return result;

    } catch (error) {
      lastError = error;
      
      // Handle error with full error classification
      const errorInfo = await this.errorHandler.handleError(error, {
        operationId,
        serviceType,
        operationConfig,
        executionTime: Date.now() - startTime
      });

      // Record operation failure
      this.recordOperationFailure(operationId, serviceType, error, Date.now() - startTime);

      // Determine if retry is appropriate
      if (this.globalConfig.enableRetries && errorInfo.retryable) {
        const retryConfiguration = this.retryManager.getRetryConfig(serviceType);
        const finalRetryConfig = { ...retryConfiguration, ...retryConfig };

        try {
          return await this.retryManager.executeWithRetry(
            () => this.executeResilientOperation({
              ...config,
              // Disable retries for nested calls to prevent infinite loops
              retryConfig: { maxRetries: 0 }
            }),
            operationId,
            finalRetryConfig
          );
        } catch (retryError) {
          lastError = retryError;
        }
      }

      // All resilience mechanisms failed
      throw lastError;
    }
  }

  /**
   * Execute multiple operations with resilience
   */
  async executeMultipleResilient(operations) {
    const semaphore = new Semaphore(this.globalConfig.maxConcurrentOperations);
    
    const promises = operations.map(async (operationConfig) => {
      await semaphore.acquire();
      try {
        return await this.executeResilientOperation(operationConfig);
      } finally {
        semaphore.release();
      }
    });

    return await Promise.allSettled(promises);
  }

  /**
   * Record successful operation
   */
  recordOperationSuccess(operationId, serviceType, duration) {
    const key = `${serviceType}_${operationId}`;
    const history = this.operationHistory.get(key) || { successes: 0, failures: 0, totalTime: 0 };
    
    history.successes++;
    history.totalTime += duration;
    history.lastSuccess = Date.now();
    
    this.operationHistory.set(key, history);
  }

  /**
   * Record failed operation
   */
  recordOperationFailure(operationId, serviceType, error, duration) {
    const key = `${serviceType}_${operationId}`;
    const history = this.operationHistory.get(key) || { successes: 0, failures: 0, totalTime: 0 };
    
    history.failures++;
    history.lastFailure = Date.now();
    history.lastError = error.message;
    
    this.operationHistory.set(key, history);
  }

  /**
   * Get comprehensive resilience metrics
   */
  getResilienceMetrics() {
    return {
      timestamp: new Date().toISOString(),
      error_handling: this.errorHandler.getErrorStats(),
      retry_stats: this.retryManager.getRetryStats(),
      circuit_breakers: this.circuitBreakerManager.getAllMetrics(),
      rate_limiters: this.rateLimiterManager.getAllStatus(),
      degradation_health: this.degradationManager.getHealthReport(),
      operation_history: this.getOperationStats(),
      global_config: this.globalConfig
    };
  }

  /**
   * Get operation statistics
   */
  getOperationStats() {
    const stats = {
      total_operations: 0,
      successful_operations: 0,
      failed_operations: 0,
      average_duration: 0,
      services: {}
    };

    let totalDuration = 0;
    let totalSuccessfulOperations = 0;

    for (const [key, history] of this.operationHistory.entries()) {
      const [serviceType] = key.split('_');
      
      stats.total_operations += history.successes + history.failures;
      stats.successful_operations += history.successes;
      stats.failed_operations += history.failures;
      
      if (history.successes > 0) {
        totalDuration += history.totalTime;
        totalSuccessfulOperations += history.successes;
      }

      if (!stats.services[serviceType]) {
        stats.services[serviceType] = {
          successes: 0,
          failures: 0,
          success_rate: 0
        };
      }

      stats.services[serviceType].successes += history.successes;
      stats.services[serviceType].failures += history.failures;
    }

    // Calculate averages
    stats.average_duration = totalSuccessfulOperations > 0 ? 
      totalDuration / totalSuccessfulOperations : 0;

    // Calculate success rates per service
    for (const service of Object.values(stats.services)) {
      const total = service.successes + service.failures;
      service.success_rate = total > 0 ? (service.successes / total) * 100 : 0;
    }

    return stats;
  }

  /**
   * Get health status of resilience systems
   */
  getHealthStatus() {
    const circuitBreakerHealth = this.circuitBreakerManager.getHealthStatus();
    const degradationHealth = this.degradationManager.getHealthReport();
    
    const overallHealth = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      components: {
        error_handler: { status: 'healthy' },
        retry_manager: { status: 'healthy' },
        circuit_breakers: {
          status: circuitBreakerHealth.unhealthy > 0 ? 'unhealthy' : 
                  circuitBreakerHealth.degraded > 0 ? 'degraded' : 'healthy',
          details: circuitBreakerHealth
        },
        rate_limiters: { status: 'healthy' },
        degradation_manager: {
          status: degradationHealth.overallHealth,
          details: degradationHealth
        }
      }
    };

    // Determine overall status
    const componentStatuses = Object.values(overallHealth.components).map(c => c.status);
    if (componentStatuses.includes('unhealthy')) {
      overallHealth.status = 'unhealthy';
    } else if (componentStatuses.includes('degraded')) {
      overallHealth.status = 'degraded';
    }

    return overallHealth;
  }

  /**
   * Update global configuration
   */
  updateConfig(newConfig) {
    this.globalConfig = { ...this.globalConfig, ...newConfig };
    console.log('🔧 Resilience configuration updated:', newConfig);
  }

  /**
   * Reset all resilience components
   */
  reset() {
    this.errorHandler.clearCounters();
    this.retryManager.clearRetryHistory();
    this.rateLimiterManager.resetAll();
    this.operationHistory.clear();
    console.log('🔄 Resilience manager reset completed');
  }

  /**
   * Shutdown all components
   */
  shutdown() {
    this.rateLimiterManager.destroy();
    console.log('🛑 Resilience manager shutdown completed');
  }
}

/**
 * Simple semaphore implementation for concurrency control
 */
class Semaphore {
  constructor(max) {
    this.max = max;
    this.current = 0;
    this.queue = [];
  }

  async acquire() {
    if (this.current < this.max) {
      this.current++;
      return;
    }

    return new Promise(resolve => {
      this.queue.push(resolve);
    });
  }

  release() {
    this.current--;
    if (this.queue.length > 0) {
      this.current++;
      const resolve = this.queue.shift();
      resolve();
    }
  }
}

export default ResilienceManager;