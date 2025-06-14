/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascading failures in SDR connections
 */

import ErrorHandler from './error-handler.js';

export class CircuitBreaker {
  constructor(options = {}) {
    this.errorHandler = new ErrorHandler();
    this.config = {
      failureThreshold: options.failureThreshold || 5,
      resetTimeout: options.resetTimeout || 60000, // 1 minute
      monitoringPeriod: options.monitoringPeriod || 120000, // 2 minutes
      volumeThreshold: options.volumeThreshold || 10,
      errorThresholdPercentage: options.errorThresholdPercentage || 50,
      ...options
    };

    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
    this.totalRequests = 0;
    this.requestLog = [];
    this.stateChangeCallbacks = [];
  }

  /**
   * Execute operation through circuit breaker
   */
  async execute(operation, operationId) {
    // Check if circuit breaker should allow the request
    if (!this.allowRequest()) {
      const error = new Error(`Circuit breaker is OPEN for operation: ${operationId}`);
      error.circuitBreakerOpen = true;
      throw error;
    }

    const startTime = Date.now();
    
    try {
      // Execute the operation
      const result = await operation();
      
      // Record success
      this.onSuccess(Date.now() - startTime);
      
      return result;
    } catch (error) {
      // Record failure
      await this.onFailure(error, operationId, Date.now() - startTime);
      throw error;
    }
  }

  /**
   * Check if request should be allowed
   */
  allowRequest() {
    this.cleanupOldRequests();

    switch (this.state) {
      case 'CLOSED':
        return true;
      
      case 'OPEN':
        // Check if enough time has passed to attempt reset
        if (Date.now() - this.lastFailureTime >= this.config.resetTimeout) {
          this.setState('HALF_OPEN');
          return true;
        }
        return false;
      
      case 'HALF_OPEN':
        // Allow limited requests to test if service is back
        return this.successCount < 3; // Allow 3 test requests
      
      default:
        return false;
    }
  }

  /**
   * Handle successful operation
   */
  onSuccess(responseTime) {
    this.recordRequest(true, responseTime);
    this.successCount++;
    this.totalRequests++;

    if (this.state === 'HALF_OPEN') {
      // If we're in half-open state and getting successes, close the circuit
      if (this.successCount >= 3) {
        this.setState('CLOSED');
        this.reset();
      }
    }
  }

  /**
   * Handle failed operation
   */
  async onFailure(error, operationId, responseTime) {
    this.recordRequest(false, responseTime);
    this.failureCount++;
    this.totalRequests++;
    this.lastFailureTime = Date.now();

    // Log the error
    await this.errorHandler.handleError(error, {
      operationId,
      circuitBreakerState: this.state,
      failureCount: this.failureCount,
      responseTime
    });

    // Check if we should open the circuit
    if (this.shouldOpenCircuit()) {
      this.setState('OPEN');
    }
  }

  /**
   * Record request for monitoring
   */
  recordRequest(success, responseTime) {
    const request = {
      timestamp: Date.now(),
      success,
      responseTime
    };

    this.requestLog.push(request);
    
    // Keep only recent requests
    const cutoff = Date.now() - this.config.monitoringPeriod;
    this.requestLog = this.requestLog.filter(req => req.timestamp > cutoff);
  }

  /**
   * Check if circuit should be opened
   */
  shouldOpenCircuit() {
    // Simple failure count threshold
    if (this.failureCount >= this.config.failureThreshold) {
      return true;
    }

    // Percentage-based threshold (within monitoring period)
    if (this.requestLog.length >= this.config.volumeThreshold) {
      const recentFailures = this.requestLog.filter(req => !req.success).length;
      const failurePercentage = (recentFailures / this.requestLog.length) * 100;
      
      return failurePercentage >= this.config.errorThresholdPercentage;
    }

    return false;
  }

  /**
   * Set circuit breaker state
   */
  setState(newState) {
    const oldState = this.state;
    this.state = newState;
    
    console.log(`🔌 Circuit Breaker state changed: ${oldState} → ${newState}`);
    
    // Notify callbacks
    this.stateChangeCallbacks.forEach(callback => {
      try {
        callback(newState, oldState);
      } catch (error) {
        console.error('Circuit breaker callback error:', error);
      }
    });
  }

  /**
   * Reset circuit breaker counters
   */
  reset() {
    this.failureCount = 0;
    this.successCount = 0;
    this.totalRequests = 0;
    this.lastFailureTime = null;
    this.requestLog = [];
  }

  /**
   * Clean up old requests from log
   */
  cleanupOldRequests() {
    const cutoff = Date.now() - this.config.monitoringPeriod;
    this.requestLog = this.requestLog.filter(req => req.timestamp > cutoff);
  }

  /**
   * Get circuit breaker metrics
   */
  getMetrics() {
    this.cleanupOldRequests();
    
    const recentRequests = this.requestLog.length;
    const recentFailures = this.requestLog.filter(req => !req.success).length;
    const recentSuccesses = recentRequests - recentFailures;
    
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalRequests: this.totalRequests,
      recentRequests,
      recentFailures,
      recentSuccesses,
      failureRate: recentRequests > 0 ? (recentFailures / recentRequests) * 100 : 0,
      averageResponseTime: this.calculateAverageResponseTime(),
      lastFailureTime: this.lastFailureTime,
      timeUntilReset: this.state === 'OPEN' ? 
        Math.max(0, this.config.resetTimeout - (Date.now() - this.lastFailureTime)) : 0
    };
  }

  /**
   * Calculate average response time
   */
  calculateAverageResponseTime() {
    if (this.requestLog.length === 0) return 0;
    
    const totalTime = this.requestLog.reduce((sum, req) => sum + req.responseTime, 0);
    return totalTime / this.requestLog.length;
  }

  /**
   * Add state change callback
   */
  onStateChange(callback) {
    this.stateChangeCallbacks.push(callback);
  }

  /**
   * Remove state change callback
   */
  removeStateChangeCallback(callback) {
    const index = this.stateChangeCallbacks.indexOf(callback);
    if (index > -1) {
      this.stateChangeCallbacks.splice(index, 1);
    }
  }

  /**
   * Force circuit breaker to specific state (for testing)
   */
  forceState(state) {
    if (['CLOSED', 'OPEN', 'HALF_OPEN'].includes(state)) {
      this.setState(state);
      if (state === 'CLOSED') {
        this.reset();
      }
    }
  }
}

/**
 * Circuit Breaker Manager for multiple services
 */
export class CircuitBreakerManager {
  constructor() {
    this.breakers = new Map();
    this.defaultConfig = {
      failureThreshold: 5,
      resetTimeout: 60000,
      monitoringPeriod: 120000,
      volumeThreshold: 10,
      errorThresholdPercentage: 50
    };
  }

  /**
   * Get or create circuit breaker for service
   */
  getBreaker(serviceId, config = {}) {
    if (!this.breakers.has(serviceId)) {
      const breakerConfig = { ...this.defaultConfig, ...config };
      this.breakers.set(serviceId, new CircuitBreaker(breakerConfig));
    }
    
    return this.breakers.get(serviceId);
  }

  /**
   * Execute operation through circuit breaker
   */
  async execute(serviceId, operation, operationId, config = {}) {
    const breaker = this.getBreaker(serviceId, config);
    return await breaker.execute(operation, operationId);
  }

  /**
   * Get metrics for all circuit breakers
   */
  getAllMetrics() {
    const metrics = {};
    
    for (const [serviceId, breaker] of this.breakers.entries()) {
      metrics[serviceId] = breaker.getMetrics();
    }
    
    return metrics;
  }

  /**
   * Get health status across all services
   */
  getHealthStatus() {
    const status = {
      healthy: 0,
      degraded: 0,
      unhealthy: 0,
      total: this.breakers.size
    };

    for (const breaker of this.breakers.values()) {
      switch (breaker.state) {
        case 'CLOSED':
          status.healthy++;
          break;
        case 'HALF_OPEN':
          status.degraded++;
          break;
        case 'OPEN':
          status.unhealthy++;
          break;
      }
    }

    return status;
  }
}

export default CircuitBreaker;