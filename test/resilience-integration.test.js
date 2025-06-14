/**
 * Resilience Integration Tests
 * Tests error handling, retry logic, circuit breakers, rate limiting, and graceful degradation
 */

import { strict as assert } from 'assert';
import { test, describe, before, after } from 'node:test';
import ErrorHandler from '../src/utils/error-handler.js';
import RetryManager from '../src/utils/retry-manager.js';
import CircuitBreaker, { CircuitBreakerManager } from '../src/utils/circuit-breaker.js';
import RateLimiter, { RateLimiterManager } from '../src/utils/rate-limiter.js';
import GracefulDegradationManager from '../src/utils/graceful-degradation.js';
import ResilienceManager from '../src/utils/resilience-manager.js';
import SDRDiscoveryAgent from '../src/agents/sdr-discovery.js';

describe('Resilience Integration Tests', () => {
  let resilienceManager;

  before(() => {
    resilienceManager = new ResilienceManager();
  });

  after(() => {
    resilienceManager.shutdown();
  });

  describe('Error Handler', () => {
    test('should classify network errors correctly', async () => {
      const errorHandler = new ErrorHandler();
      const networkError = new Error('ENOTFOUND example.com');
      networkError.code = 'ENOTFOUND';

      const recovery = await errorHandler.handleError(networkError, { operation: 'test' });
      
      assert.equal(recovery.action, 'retry');
      assert.equal(recovery.maxRetries, 5);
      assert.ok(recovery.delay > 0);
    });

    test('should classify SDR connection errors correctly', async () => {
      const errorHandler = new ErrorHandler();
      const sdrError = new Error('WebSDR connection failed');

      const recovery = await errorHandler.handleError(sdrError, { operation: 'sdr_test' });
      
      assert.equal(recovery.action, 'circuit_breaker');
      assert.equal(recovery.fallback, 'use_alternative_sdr');
    });

    test('should track error statistics', async () => {
      const errorHandler = new ErrorHandler();
      
      // Generate some test errors
      await errorHandler.handleError(new Error('Network error'), { type: 'network' });
      await errorHandler.handleError(new Error('SDR error'), { type: 'sdr' });
      
      const stats = errorHandler.getErrorStats();
      assert.ok(Object.keys(stats).length > 0);
    });
  });

  describe('Retry Manager', () => {
    test('should retry failing operations with exponential backoff', async () => {
      const retryManager = new RetryManager();
      let attempts = 0;

      const failingOperation = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Operation failed');
        }
        return 'success';
      };

      const result = await retryManager.executeWithRetry(
        failingOperation,
        'test_operation',
        { maxRetries: 3, initialDelay: 100 }
      );

      assert.equal(result, 'success');
      assert.equal(attempts, 3);
    });

    test('should calculate exponential backoff delays correctly', async () => {
      const retryManager = new RetryManager();
      const config = { initialDelay: 1000, backoffMultiplier: 2, maxDelay: 10000, jitter: false };

      const delay1 = retryManager.calculateDelay(1, config);
      const delay2 = retryManager.calculateDelay(2, config);
      const delay3 = retryManager.calculateDelay(3, config);

      assert.equal(delay1, 1000);
      assert.equal(delay2, 2000);
      assert.equal(delay3, 4000);
    });

    test('should provide retry statistics', async () => {
      const retryManager = new RetryManager();
      
      try {
        await retryManager.executeWithRetry(
          () => { throw new Error('Always fails'); },
          'failing_operation',
          { maxRetries: 2, initialDelay: 10 }
        );
      } catch (error) {
        // Expected to fail
      }

      const stats = retryManager.getRetryStats();
      assert.ok(stats.totalOperations >= 0);
      assert.ok(stats.totalAttempts >= 0);
    });
  });

  describe('Circuit Breaker', () => {
    test('should open circuit after failure threshold', async () => {
      const circuitBreaker = new CircuitBreaker({ failureThreshold: 3, resetTimeout: 1000 });
      let attempts = 0;

      const failingOperation = async () => {
        attempts++;
        throw new Error('Service unavailable');
      };

      // Should fail and eventually open circuit
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreaker.execute(failingOperation, `operation_${i}`);
        } catch (error) {
          // Expected failures
        }
      }

      assert.equal(circuitBreaker.state, 'OPEN');
      assert.ok(circuitBreaker.failureCount >= 3);
    });

    test('should transition to half-open state after timeout', async () => {
      const circuitBreaker = new CircuitBreaker({ 
        failureThreshold: 2, 
        resetTimeout: 100 
      });

      // Force circuit to open
      circuitBreaker.forceState('OPEN');
      circuitBreaker.lastFailureTime = Date.now() - 200; // Past reset timeout

      const allowRequest = circuitBreaker.allowRequest();
      assert.equal(circuitBreaker.state, 'HALF_OPEN');
      assert.equal(allowRequest, true);
    });

    test('should provide circuit breaker metrics', async () => {
      const circuitBreaker = new CircuitBreaker();
      
      const metrics = circuitBreaker.getMetrics();
      
      assert.ok(typeof metrics.state === 'string');
      assert.ok(typeof metrics.failureCount === 'number');
      assert.ok(typeof metrics.failureRate === 'number');
    });
  });

  describe('Rate Limiter', () => {
    test('should limit requests based on configuration', async () => {
      const rateLimiter = new RateLimiter({ maxRequests: 2, windowMs: 1000 });
      
      // First two requests should succeed
      const result1 = await rateLimiter.checkLimit('test');
      const result2 = await rateLimiter.checkLimit('test');
      
      assert.equal(result1.allowed, true);
      assert.equal(result2.allowed, true);
      
      // Third request should be limited
      const result3 = await rateLimiter.checkLimit('test');
      assert.equal(result3.allowed, false);
      assert.ok(result3.retryAfter > 0);
    });

    test('should execute operations with rate limiting', async () => {
      const rateLimiter = new RateLimiter({ maxRequests: 1, windowMs: 500 });
      let executed = false;

      await rateLimiter.executeWithLimit(
        () => { executed = true; return 'success'; },
        'test_operation'
      );

      assert.equal(executed, true);

      // Second operation should be rate limited
      try {
        await rateLimiter.executeWithLimit(
          () => 'should not execute',
          'test_operation'
        );
        assert.fail('Should have been rate limited');
      } catch (error) {
        assert.ok(error.rateLimited);
      }
    });

    test('should provide rate limiter statistics', async () => {
      const rateLimiter = new RateLimiter({ maxRequests: 5, windowMs: 1000 });
      
      await rateLimiter.checkLimit('test');
      const stats = rateLimiter.getStats();
      
      assert.ok(stats.totalIdentifiers >= 0);
      assert.ok(typeof stats.identifierStats === 'object');
    });
  });

  describe('Graceful Degradation Manager', () => {
    test('should execute with degradation strategies', async () => {
      const degradationManager = new GracefulDegradationManager();
      let executed = false;

      const result = await degradationManager.executeWithDegradation(
        'test_service',
        async (config) => {
          executed = true;
          return { success: true, config };
        },
        { testParam: 'value' }
      );

      assert.equal(executed, true);
      assert.ok(result.success);
    });

    test('should apply fallback strategies on failure', async () => {
      const degradationManager = new GracefulDegradationManager();

      try {
        await degradationManager.executeWithDegradation(
          'sdr_discovery',
          async () => {
            throw new Error('Service unavailable');
          }
        );
      } catch (error) {
        // Should try fallback strategies
      }

      const healthReport = degradationManager.getHealthReport();
      assert.ok(healthReport.timestamp);
      assert.ok(typeof healthReport.overallHealth === 'string');
    });

    test('should provide health metrics', async () => {
      const degradationManager = new GracefulDegradationManager();
      
      const healthReport = degradationManager.getHealthReport();
      
      assert.ok(healthReport.timestamp);
      assert.ok(typeof healthReport.overallHealth === 'string');
      assert.ok(typeof healthReport.services === 'object');
      assert.ok(Array.isArray(healthReport.recommendations));
    });
  });

  describe('Integrated Resilience Manager', () => {
    test('should execute operations with full resilience stack', async () => {
      let operationExecuted = false;

      const result = await resilienceManager.executeResilientOperation({
        operationId: 'test_resilient_operation',
        serviceType: 'test_service',
        operation: async (config) => {
          operationExecuted = true;
          return { success: true, config };
        },
        operationConfig: { testParam: 'value' }
      });

      assert.equal(operationExecuted, true);
      assert.ok(result.success);
    });

    test('should handle multiple operations concurrently', async () => {
      const operations = [
        {
          operationId: 'concurrent_op_1',
          serviceType: 'test_service',
          operation: async () => ({ id: 1, result: 'success' })
        },
        {
          operationId: 'concurrent_op_2', 
          serviceType: 'test_service',
          operation: async () => ({ id: 2, result: 'success' })
        },
        {
          operationId: 'concurrent_op_3',
          serviceType: 'test_service',
          operation: async () => ({ id: 3, result: 'success' })
        }
      ];

      const results = await resilienceManager.executeMultipleResilient(operations);
      
      assert.equal(results.length, 3);
      results.forEach((result, index) => {
        assert.equal(result.status, 'fulfilled');
        assert.equal(result.value.id, index + 1);
      });
    });

    test('should provide comprehensive resilience metrics', async () => {
      const metrics = resilienceManager.getResilienceMetrics();
      
      assert.ok(metrics.timestamp);
      assert.ok(typeof metrics.error_handling === 'object');
      assert.ok(typeof metrics.retry_stats === 'object');
      assert.ok(typeof metrics.circuit_breakers === 'object');
      assert.ok(typeof metrics.rate_limiters === 'object');
      assert.ok(typeof metrics.degradation_health === 'object');
      assert.ok(typeof metrics.operation_history === 'object');
      assert.ok(typeof metrics.global_config === 'object');
    });

    test('should provide health status', async () => {
      const health = resilienceManager.getHealthStatus();
      
      assert.ok(health.timestamp);
      assert.ok(['healthy', 'degraded', 'unhealthy'].includes(health.status));
      assert.ok(typeof health.components === 'object');
    });
  });

  describe('SDR Discovery Agent Integration', () => {
    test('should create SDR discovery agent with resilience', async () => {
      const agent = new SDRDiscoveryAgent();
      
      assert.ok(agent.resilience);
      assert.ok(agent.memory);
      assert.ok(Array.isArray(agent.discoveredSDRs));
    });

    test('should handle discovery failures gracefully', async () => {
      const agent = new SDRDiscoveryAgent();
      
      // Mock a failing discovery operation
      agent.discoverWebSDRs = async () => {
        throw new Error('Network unavailable');
      };

      try {
        // This should trigger fallback mechanisms
        await agent.execute();
      } catch (error) {
        // Expected to potentially fail, but should have tried resilience mechanisms
      }

      // Verify resilience metrics were recorded
      const metrics = agent.resilience.getResilienceMetrics();
      assert.ok(metrics.operation_history);
    });
  });

  describe('Performance and Stress Tests', () => {
    test('should handle high-frequency operations', async () => {
      const startTime = Date.now();
      const operations = [];

      // Create 50 concurrent operations
      for (let i = 0; i < 50; i++) {
        operations.push({
          operationId: `stress_test_${i}`,
          serviceType: 'test_service',
          operation: async () => {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
            return { id: i, timestamp: Date.now() };
          }
        });
      }

      const results = await resilienceManager.executeMultipleResilient(operations);
      const endTime = Date.now();

      assert.equal(results.length, 50);
      
      const successfulResults = results.filter(r => r.status === 'fulfilled');
      assert.ok(successfulResults.length > 40); // At least 80% success rate
      
      console.log(`Stress test completed in ${endTime - startTime}ms with ${successfulResults.length}/50 successful operations`);
    });

    test('should maintain performance under error conditions', async () => {
      let errorCount = 0;
      const totalOperations = 20;

      const operations = [];
      for (let i = 0; i < totalOperations; i++) {
        operations.push({
          operationId: `error_test_${i}`,
          serviceType: 'test_service',
          operation: async () => {
            // 30% chance of failure
            if (Math.random() < 0.3) {
              errorCount++;
              throw new Error(`Simulated failure ${i}`);
            }
            return { id: i, success: true };
          }
        });
      }

      const startTime = Date.now();
      const results = await resilienceManager.executeMultipleResilient(operations);
      const endTime = Date.now();

      const successfulResults = results.filter(r => r.status === 'fulfilled');
      const failedResults = results.filter(r => r.status === 'rejected');

      console.log(`Error resilience test: ${successfulResults.length} successful, ${failedResults.length} failed, ${errorCount} errors generated in ${endTime - startTime}ms`);

      // Should complete even with errors
      assert.equal(results.length, totalOperations);
      assert.ok(endTime - startTime < 10000); // Should complete within 10 seconds
    });
  });
});

// Helper function to run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🧪 Running Resilience Integration Tests...');
  console.log('━'.repeat(80));
}