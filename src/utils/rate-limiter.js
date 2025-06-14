/**
 * Rate Limiter Implementation
 * Prevents overwhelming SDR services and external APIs
 */

export class RateLimiter {
  constructor(options = {}) {
    this.config = {
      maxRequests: options.maxRequests || 100,
      windowMs: options.windowMs || 60000, // 1 minute
      keyGenerator: options.keyGenerator || ((req) => 'global'),
      skipSuccessfulRequests: options.skipSuccessfulRequests || false,
      skipFailedRequests: options.skipFailedRequests || false,
      ...options
    };

    this.requestCounts = new Map();
    this.requestQueue = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), this.config.windowMs);
  }

  /**
   * Check if request is allowed
   */
  async checkLimit(identifier, requestInfo = {}) {
    const key = typeof this.config.keyGenerator === 'function' ? 
      this.config.keyGenerator(requestInfo) : identifier;
    
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Initialize if not exists
    if (!this.requestCounts.has(key)) {
      this.requestCounts.set(key, []);
    }

    const requests = this.requestCounts.get(key);
    
    // Remove old requests outside the window
    const validRequests = requests.filter(timestamp => timestamp > windowStart);
    this.requestCounts.set(key, validRequests);

    // Check if limit exceeded
    if (validRequests.length >= this.config.maxRequests) {
      const oldestRequest = Math.min(...validRequests);
      const resetTime = oldestRequest + this.config.windowMs;
      
      return {
        allowed: false,
        limit: this.config.maxRequests,
        remaining: 0,
        resetTime: resetTime,
        retryAfter: resetTime - now
      };
    }

    // Record the request
    validRequests.push(now);
    this.requestCounts.set(key, validRequests);

    return {
      allowed: true,
      limit: this.config.maxRequests,
      remaining: this.config.maxRequests - validRequests.length,
      resetTime: now + this.config.windowMs,
      retryAfter: 0
    };
  }

  /**
   * Execute operation with rate limiting
   */
  async executeWithLimit(operation, identifier, requestInfo = {}) {
    const limitCheck = await this.checkLimit(identifier, requestInfo);
    
    if (!limitCheck.allowed) {
      const error = new Error(`Rate limit exceeded for ${identifier}. Retry after ${limitCheck.retryAfter}ms`);
      error.rateLimited = true;
      error.retryAfter = limitCheck.retryAfter;
      error.resetTime = limitCheck.resetTime;
      throw error;
    }

    try {
      const result = await operation();
      
      // Record successful request if configured
      if (!this.config.skipSuccessfulRequests) {
        this.recordRequest(identifier, true, requestInfo);
      }
      
      return result;
    } catch (error) {
      // Record failed request if configured
      if (!this.config.skipFailedRequests) {
        this.recordRequest(identifier, false, requestInfo);
      }
      
      throw error;
    }
  }

  /**
   * Queue operation for later execution
   */
  async queueOperation(operation, identifier, requestInfo = {}) {
    const limitCheck = await this.checkLimit(identifier, requestInfo);
    
    if (limitCheck.allowed) {
      // Execute immediately if allowed
      return await this.executeWithLimit(operation, identifier, requestInfo);
    }

    // Queue for later execution
    return new Promise((resolve, reject) => {
      if (!this.requestQueue.has(identifier)) {
        this.requestQueue.set(identifier, []);
      }

      const queue = this.requestQueue.get(identifier);
      queue.push({
        operation,
        requestInfo,
        resolve,
        reject,
        timestamp: Date.now()
      });

      // Schedule execution
      setTimeout(() => {
        this.processQueue(identifier);
      }, limitCheck.retryAfter);
    });
  }

  /**
   * Process queued operations
   */
  async processQueue(identifier) {
    const queue = this.requestQueue.get(identifier);
    if (!queue || queue.length === 0) return;

    const item = queue.shift();
    if (!item) return;

    try {
      const result = await this.executeWithLimit(item.operation, identifier, item.requestInfo);
      item.resolve(result);
    } catch (error) {
      item.reject(error);
    }

    // Continue processing queue if more items exist
    if (queue.length > 0) {
      const limitCheck = await this.checkLimit(identifier, {});
      if (limitCheck.allowed) {
        setImmediate(() => this.processQueue(identifier));
      } else {
        setTimeout(() => this.processQueue(identifier), limitCheck.retryAfter);
      }
    }
  }

  /**
   * Record request for analytics
   */
  recordRequest(identifier, success, requestInfo) {
    // This could be extended to store more detailed analytics
    console.log(`📊 Rate limiter: ${identifier} - ${success ? 'SUCCESS' : 'FAILED'}`);
  }

  /**
   * Get current status for identifier
   */
  getStatus(identifier) {
    const key = identifier;
    const requests = this.requestCounts.get(key) || [];
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const validRequests = requests.filter(timestamp => timestamp > windowStart);

    return {
      identifier,
      requests: validRequests.length,
      limit: this.config.maxRequests,
      remaining: Math.max(0, this.config.maxRequests - validRequests.length),
      resetTime: now + this.config.windowMs,
      queueLength: (this.requestQueue.get(key) || []).length
    };
  }

  /**
   * Get all rate limiter statistics
   */
  getStats() {
    const stats = {
      totalIdentifiers: this.requestCounts.size,
      totalQueued: 0,
      identifierStats: {}
    };

    for (const [key, requests] of this.requestCounts.entries()) {
      const status = this.getStatus(key);
      stats.identifierStats[key] = status;
      stats.totalQueued += status.queueLength;
    }

    return stats;
  }

  /**
   * Clean up old entries
   */
  cleanup() {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Clean up request counts
    for (const [key, requests] of this.requestCounts.entries()) {
      const validRequests = requests.filter(timestamp => timestamp > windowStart);
      if (validRequests.length === 0) {
        this.requestCounts.delete(key);
      } else {
        this.requestCounts.set(key, validRequests);
      }
    }

    // Clean up old queued requests
    for (const [key, queue] of this.requestQueue.entries()) {
      const validQueue = queue.filter(item => (now - item.timestamp) < this.config.windowMs * 5);
      if (validQueue.length === 0) {
        this.requestQueue.delete(key);
      } else {
        this.requestQueue.set(key, validQueue);
      }
    }
  }

  /**
   * Reset all limits (for testing)
   */
  reset() {
    this.requestCounts.clear();
    this.requestQueue.clear();
  }

  /**
   * Destroy rate limiter
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.reset();
  }
}

/**
 * Rate Limiter Manager for different services
 */
export class RateLimiterManager {
  constructor() {
    this.limiters = new Map();
    this.configs = {
      sdr_discovery: {
        maxRequests: 20,
        windowMs: 60000, // 1 minute
        keyGenerator: (req) => req.sdrUrl || 'sdr_discovery'
      },
      audio_capture: {
        maxRequests: 10,
        windowMs: 300000, // 5 minutes
        keyGenerator: (req) => req.sdrUrl || 'audio_capture'
      },
      external_api: {
        maxRequests: 100,
        windowMs: 3600000, // 1 hour
        keyGenerator: (req) => req.apiEndpoint || 'external_api'
      },
      websdr_connection: {
        maxRequests: 5,
        windowMs: 60000, // 1 minute per SDR
        keyGenerator: (req) => req.sdrUrl || 'websdr'
      },
      kiwisdr_connection: {
        maxRequests: 3,
        windowMs: 60000, // 1 minute per SDR
        keyGenerator: (req) => req.sdrUrl || 'kiwisdr'
      }
    };
  }

  /**
   * Get rate limiter for service type
   */
  getLimiter(serviceType) {
    if (!this.limiters.has(serviceType)) {
      const config = this.configs[serviceType] || {
        maxRequests: 50,
        windowMs: 60000
      };
      this.limiters.set(serviceType, new RateLimiter(config));
    }
    
    return this.limiters.get(serviceType);
  }

  /**
   * Execute operation with appropriate rate limiting
   */
  async executeWithLimit(serviceType, operation, identifier, requestInfo = {}) {
    const limiter = this.getLimiter(serviceType);
    return await limiter.executeWithLimit(operation, identifier, requestInfo);
  }

  /**
   * Queue operation with appropriate rate limiting
   */
  async queueOperation(serviceType, operation, identifier, requestInfo = {}) {
    const limiter = this.getLimiter(serviceType);
    return await limiter.queueOperation(operation, identifier, requestInfo);
  }

  /**
   * Get status for all services
   */
  getAllStatus() {
    const status = {};
    
    for (const [serviceType, limiter] of this.limiters.entries()) {
      status[serviceType] = limiter.getStats();
    }
    
    return status;
  }

  /**
   * Reset all rate limiters
   */
  resetAll() {
    for (const limiter of this.limiters.values()) {
      limiter.reset();
    }
  }

  /**
   * Destroy all rate limiters
   */
  destroy() {
    for (const limiter of this.limiters.values()) {
      limiter.destroy();
    }
    this.limiters.clear();
  }
}

export default RateLimiter;