/**
 * Unit Tests for SPARC Orchestrator
 * TDD approach with comprehensive mocking of orchestration functions
 */

import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import SPARCOrchestrator from '../../src/orchestrator.js';
import express from 'express';

// Mock express
const mockApp = {
  use: mock.fn(),
  get: mock.fn(),
  listen: mock.fn(),
  close: mock.fn()
};

const mockExpress = mock.fn(() => mockApp);
mockExpress.json = mock.fn();

describe('SPARCOrchestrator Unit Tests', () => {
  let orchestrator;
  let memoryMock;
  let agentMocks;

  beforeEach(() => {
    // Reset mocks
    mockApp.use.mock.resetCalls();
    mockApp.get.mock.resetCalls();
    mockApp.listen.mock.resetCalls();
    mockApp.close.mock.resetCalls();
    mockExpress.mock.resetCalls();
    
    // Mock express globally
    global.express = mockExpress;
    
    // Create memory mock
    memoryMock = {
      store: mock.fn(),
      signal: mock.fn(),
      query: mock.fn(),
      exists: mock.fn(),
      waitFor: mock.fn(),
      list: mock.fn()
    };
    
    // Create agent mocks
    agentMocks = {
      sdrDiscovery: {
        execute: mock.fn()
      },
      audioCapture: {
        execute: mock.fn()
      },
      audioAnalysis: {
        execute: mock.fn()
      },
      reportGenerator: {
        execute: mock.fn(),
        shutdown: mock.fn(),
        server: null
      }
    };
    
    orchestrator = new SPARCOrchestrator();
    orchestrator.memory = memoryMock;
    orchestrator.agents = agentMocks;
  });

  afterEach(() => {
    mock.restoreAll();
    // Cleanup
    if (orchestrator.healthServer) {
      orchestrator.healthServer = null;
    }
  });

  describe('Initialization', () => {
    test('should initialize with correct default values', () => {
      assert.ok(orchestrator.memory);
      assert.ok(orchestrator.agents);
      assert.ok(orchestrator.agents.sdrDiscovery);
      assert.ok(orchestrator.agents.audioCapture);
      assert.ok(orchestrator.agents.audioAnalysis);
      assert.ok(orchestrator.agents.reportGenerator);
      assert.ok(Array.isArray(orchestrator.executionLog));
      assert.strictEqual(orchestrator.executionLog.length, 0);
      assert.strictEqual(orchestrator.startTime, null);
      assert.strictEqual(orchestrator.isHealthy, true);
    });

    test('should initialize health server', () => {
      // Mock successful server start
      mockApp.listen.mock.mockImplementationOnce((port, callback) => {
        callback();
        return { close: mock.fn() };
      });

      orchestrator.initializeHealthServer();
      
      assert.strictEqual(mockApp.use.mock.callCount(), 1); // JSON middleware
      assert.ok(mockApp.get.mock.callCount() >= 5); // Health endpoints
      assert.strictEqual(mockApp.listen.mock.callCount(), 1);
    });

    test('should configure health endpoints correctly', () => {
      mockApp.listen.mock.mockImplementationOnce((port, callback) => {
        callback();
        return { close: mock.fn() };
      });

      orchestrator.initializeHealthServer();
      
      const getCallArgs = mockApp.get.mock.calls.map(call => call.arguments[0]);
      assert.ok(getCallArgs.includes('/health'));
      assert.ok(getCallArgs.includes('/ready'));
      assert.ok(getCallArgs.includes('/live'));
      assert.ok(getCallArgs.includes('/metrics'));
      assert.ok(getCallArgs.includes('/status'));
    });
  });

  describe('Health Status Management', () => {
    test('should return comprehensive health status', () => {
      const health = orchestrator.getHealthStatus();
      
      assert.ok(health.status);
      assert.ok(health.timestamp);
      assert.ok(typeof health.uptime === 'number');
      assert.ok(health.memory);
      assert.ok(health.cpu);
      assert.ok(health.agents);
      assert.ok(health.version);
      assert.ok(health.platform);
      
      // Check memory stats
      assert.ok(typeof health.memory.used === 'number');
      assert.ok(typeof health.memory.total === 'number');
      assert.ok(typeof health.memory.external === 'number');
      
      // Check agent status
      assert.strictEqual(health.agents.sdrDiscovery, 'initialized');
      assert.strictEqual(health.agents.audioCapture, 'initialized');
      assert.strictEqual(health.agents.audioAnalysis, 'initialized');
      assert.strictEqual(health.agents.reportGenerator, 'initialized');
    });

    test('should detect unhealthy status with high memory usage', () => {
      // Mock high memory usage
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = () => ({
        heapUsed: 2 * 1024 * 1024 * 1024, // 2GB (above 1GB threshold)
        heapTotal: 3 * 1024 * 1024 * 1024,
        external: 100 * 1024 * 1024,
        rss: 2.5 * 1024 * 1024 * 1024
      });

      const health = orchestrator.getHealthStatus();
      assert.strictEqual(health.status, 'unhealthy');
      
      process.memoryUsage = originalMemoryUsage;
    });

    test('should detect unhealthy status when isHealthy is false', () => {
      orchestrator.isHealthy = false;
      
      const health = orchestrator.getHealthStatus();
      assert.strictEqual(health.status, 'unhealthy');
    });
  });

  describe('Readiness Status Management', () => {
    test('should return ready when all agents are initialized', () => {
      const readiness = orchestrator.getReadinessStatus();
      
      assert.strictEqual(readiness.ready, true);
      assert.ok(readiness.timestamp);
      assert.ok(readiness.checks);
      assert.strictEqual(readiness.checks.agents, true);
      assert.strictEqual(readiness.checks.memory, true);
      assert.strictEqual(readiness.checks.health, true);
    });

    test('should return not ready when agents are missing', () => {
      orchestrator.agents.sdrDiscovery = null;
      
      const readiness = orchestrator.getReadinessStatus();
      assert.strictEqual(readiness.ready, false);
      assert.strictEqual(readiness.checks.agents, false);
    });

    test('should return not ready when memory is missing', () => {
      orchestrator.memory = null;
      
      const readiness = orchestrator.getReadinessStatus();
      assert.strictEqual(readiness.ready, false);
      assert.strictEqual(readiness.checks.memory, false);
    });

    test('should return not ready when unhealthy', () => {
      orchestrator.isHealthy = false;
      
      const readiness = orchestrator.getReadinessStatus();
      assert.strictEqual(readiness.ready, false);
      assert.strictEqual(readiness.checks.health, false);
    });
  });

  describe('Metrics Generation', () => {
    test('should generate comprehensive metrics', async () => {
      memoryMock.list.mock.mockImplementation(() => Promise.resolve(['key1', 'key2']));
      
      const metrics = await orchestrator.getMetrics();
      
      assert.ok(metrics.timestamp);
      assert.ok(metrics.system);
      assert.ok(metrics.orchestrator);
      assert.ok(metrics.agents);
      
      // Check system metrics
      assert.ok(typeof metrics.system.uptime === 'number');
      assert.ok(metrics.system.memory);
      assert.ok(metrics.system.cpu);
      assert.ok(metrics.system.node_version);
      assert.ok(metrics.system.platform);
      
      // Check orchestrator metrics
      assert.ok(typeof metrics.orchestrator.execution_time === 'number');
      assert.ok(typeof metrics.orchestrator.total_executions === 'number');
      assert.ok(typeof metrics.orchestrator.successful_executions === 'number');
      assert.ok(typeof metrics.orchestrator.failed_executions === 'number');
      assert.ok(typeof metrics.orchestrator.phases_completed === 'number');
    });

    test('should calculate execution statistics correctly', () => {
      orchestrator.executionLog = [
        { component: 'phase_1', status: 'completed' },
        { component: 'phase_2', status: 'completed' },
        { component: 'agent_1', status: 'completed' },
        { component: 'agent_2', status: 'failed' },
        { component: 'phase_3', status: 'failed' }
      ];

      const stats = orchestrator.getExecutionStats();
      
      assert.strictEqual(stats.total, 5);
      assert.strictEqual(stats.successful, 3);
      assert.strictEqual(stats.failed, 2);
      assert.strictEqual(stats.phases, 3); // phase_1, phase_2, phase_3
    });
  });

  describe('System Status', () => {
    test('should return comprehensive system status', async () => {
      memoryMock.list.mock.mockImplementation(() => Promise.resolve(['key1']));
      
      const status = await orchestrator.getSystemStatus();
      
      assert.ok(status.overall_status);
      assert.ok(status.timestamp);
      assert.ok(status.health);
      assert.ok(status.readiness);
      assert.ok(status.metrics);
      assert.ok(status.memory_stats);
      assert.ok(Array.isArray(status.execution_log));
    });

    test('should determine overall status as operational when healthy and ready', async () => {
      memoryMock.list.mock.mockImplementation(() => Promise.resolve([]));
      
      const status = await orchestrator.getSystemStatus();
      assert.strictEqual(status.overall_status, 'operational');
    });

    test('should determine overall status as degraded when unhealthy', async () => {
      orchestrator.isHealthy = false;
      memoryMock.list.mock.mockImplementation(() => Promise.resolve([]));
      
      const status = await orchestrator.getSystemStatus();
      assert.strictEqual(status.overall_status, 'degraded');
    });
  });

  describe('Memory Statistics', () => {
    test('should return memory statistics', async () => {
      memoryMock.list.mock.mockImplementation(() => Promise.resolve(['key1', 'key2', 'key3']));
      
      const stats = await orchestrator.getMemoryStats();
      
      assert.strictEqual(stats.total_keys, 3);
      assert.ok(stats.last_updated);
    });

    test('should handle memory errors gracefully', async () => {
      memoryMock.list.mock.mockImplementation(() => Promise.reject(new Error('Memory access error')));
      
      const stats = await orchestrator.getMemoryStats();
      
      assert.ok(stats.error);
      assert.ok(stats.message);
      assert.strictEqual(stats.message, 'Memory access error');
    });
  });

  describe('Execution Logging', () => {
    test('should log execution events correctly', () => {
      orchestrator.logExecution('test_component', 'starting', 'Test operation');
      
      assert.strictEqual(orchestrator.executionLog.length, 1);
      const logEntry = orchestrator.executionLog[0];
      
      assert.strictEqual(logEntry.component, 'test_component');
      assert.strictEqual(logEntry.status, 'starting');
      assert.strictEqual(logEntry.description, 'Test operation');
      assert.ok(logEntry.timestamp);
    });

    test('should maintain execution log order', () => {
      orchestrator.logExecution('component_1', 'starting', 'First operation');
      orchestrator.logExecution('component_2', 'completed', 'Second operation');
      orchestrator.logExecution('component_3', 'failed', 'Third operation');
      
      assert.strictEqual(orchestrator.executionLog.length, 3);
      assert.strictEqual(orchestrator.executionLog[0].component, 'component_1');
      assert.strictEqual(orchestrator.executionLog[1].component, 'component_2');
      assert.strictEqual(orchestrator.executionLog[2].component, 'component_3');
    });
  });

  describe('Utility Methods', () => {
    test('should validate system requirements', async () => {
      const requirements = await orchestrator.validateRequirements();
      
      assert.ok(requirements);
      assert.strictEqual(requirements.networkAccess, true);
      assert.strictEqual(requirements.ffmpegAvailable, true);
      assert.strictEqual(requirements.memorySpace, true);
      assert.ok(requirements.nodeVersion);
    });

    test('should monitor system health', async () => {
      const health = await orchestrator.monitorSystemHealth();
      
      assert.ok(health);
      assert.ok(health.memory);
      assert.ok(typeof health.uptime === 'number');
      assert.strictEqual(health.status, 'healthy');
    });

    test('should run quality assurance checks', async () => {
      const qa = await orchestrator.runQualityAssurance();
      
      assert.ok(qa);
      assert.strictEqual(qa.passed, true);
      assert.strictEqual(qa.issues, 0);
    });

    test('should enrich data', async () => {
      const enrichment = await orchestrator.enrichData();
      
      assert.ok(enrichment);
      assert.ok(typeof enrichment.sources_queried === 'number');
      assert.ok(typeof enrichment.enrichments_added === 'number');
    });
  });

  describe('Phase Execution', () => {
    beforeEach(() => {
      // Mock memory operations for phases
      memoryMock.store.mock.mockImplementation(() => Promise.resolve());
      memoryMock.signal.mock.mockImplementation(() => Promise.resolve());
      memoryMock.waitFor.mock.mockImplementation(() => Promise.resolve());
    });

    test('should execute system initialization', async () => {
      memoryMock.list.mock.mockImplementation(() => Promise.resolve(['existing_key']));
      
      await orchestrator.initializeSystem();
      
      assert.ok(memoryMock.store.mock.callCount() > 0);
      const storeCall = memoryMock.store.mock.calls.find(call => call.arguments[0] === 'sparc_start');
      assert.ok(storeCall);
      assert.ok(storeCall.arguments[1].orchestrator === 'active');
      assert.ok(storeCall.arguments[1].phase === 'initialization');
    });

    test('should execute phase 1 with parallel operations', async () => {
      agentMocks.sdrDiscovery.execute.mock.mockImplementation(() => Promise.resolve([
        { url: 'http://test.com', location: 'Test', quality_score: 85 }
      ]));
      
      orchestrator.validateRequirements = mock.fn(() => Promise.resolve({ valid: true }));
      
      await orchestrator.executePhase1();
      
      assert.strictEqual(agentMocks.sdrDiscovery.execute.mock.callCount(), 1);
      assert.strictEqual(orchestrator.validateRequirements.mock.callCount(), 1);
      
      // Verify memory operations
      const signalCall = memoryMock.signal.mock.calls.find(call => call.arguments[0] === 'phase_1_complete');
      assert.ok(signalCall);
    });

    test('should execute phase 2 with sequential and parallel operations', async () => {
      agentMocks.audioCapture.execute.mock.mockImplementation(() => Promise.resolve([
        { id: 'sample1', filename: 'test.wav' }
      ]));
      
      orchestrator.monitorSystemHealth = mock.fn(() => Promise.resolve({ status: 'healthy' }));
      
      await orchestrator.executePhase2();
      
      assert.strictEqual(agentMocks.audioCapture.execute.mock.callCount(), 1);
      assert.strictEqual(orchestrator.monitorSystemHealth.mock.callCount(), 1);
      
      const signalCall = memoryMock.signal.mock.calls.find(call => call.arguments[0] === 'phase_2_complete');
      assert.ok(signalCall);
    });

    test('should execute phase 3 with parallel analysis', async () => {
      agentMocks.audioAnalysis.execute.mock.mockImplementation(() => Promise.resolve([
        { sample_id: 'sample1', analysis_results: { confidence: 85 } }
      ]));
      
      orchestrator.runQualityAssurance = mock.fn(() => Promise.resolve({ passed: true }));
      orchestrator.enrichData = mock.fn(() => Promise.resolve({ enrichments: 10 }));
      
      await orchestrator.executePhase3();
      
      assert.strictEqual(agentMocks.audioAnalysis.execute.mock.callCount(), 1);
      assert.strictEqual(orchestrator.runQualityAssurance.mock.callCount(), 1);
      assert.strictEqual(orchestrator.enrichData.mock.callCount(), 1);
      
      const signalCall = memoryMock.signal.mock.calls.find(call => call.arguments[0] === 'phase_3_complete');
      assert.ok(signalCall);
    });

    test('should execute phase 4 with report generation', async () => {
      agentMocks.reportGenerator.execute.mock.mockImplementation(() => Promise.resolve({
        url: 'http://localhost:3000'
      }));
      
      await orchestrator.executePhase4();
      
      assert.strictEqual(agentMocks.reportGenerator.execute.mock.callCount(), 1);
      
      const signalCall = memoryMock.signal.mock.calls.find(call => call.arguments[0] === 'phase_4_complete');
      assert.ok(signalCall);
    });
  });

  describe('Final Validation', () => {
    test('should validate all phase completion signals', async () => {
      memoryMock.exists.mock.mockImplementation((key) => {
        const requiredSignals = ['phase_1_complete', 'phase_2_complete', 'phase_3_complete', 'phase_4_complete'];
        return Promise.resolve(requiredSignals.includes(key));
      });
      
      memoryMock.query.mock.mockImplementation((key) => {
        const mockData = {
          'active_sdrs': [{ location: 'Test' }],
          'audio_samples': [{ id: 'sample1' }],
          'analysis_results': [{ confidence: 85 }],
          'report_data': { summary: 'test' }
        };
        return Promise.resolve(mockData[key]);
      });
      
      await orchestrator.finalValidation();
      
      // Should signal mission completion
      const missionSignal = memoryMock.signal.mock.calls.find(call => call.arguments[0] === 'mission_complete');
      assert.ok(missionSignal);
      assert.ok(missionSignal.arguments[1].status === 'success');
    });

    test('should fail validation when missing required signals', async () => {
      memoryMock.exists.mock.mockImplementation((key) => {
        return Promise.resolve(key !== 'phase_2_complete'); // Missing phase 2
      });
      
      try {
        await orchestrator.finalValidation();
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error.message.includes('Missing completion signal: phase_2_complete'));
      }
    });
  });

  describe('Completion Report', () => {
    test('should generate completion report', async () => {
      memoryMock.query.mock.mockImplementation((key) => {
        const mockData = {
          'mission_complete': {
            execution_time: 120.5,
            summary: {
              sdrs_discovered: 5,
              samples_captured: 20,
              analyses_completed: 15,
              report_generated: true
            }
          },
          'report_ready': {
            url: 'http://localhost:3000'
          }
        };
        return Promise.resolve(mockData[key]);
      });
      
      const report = await orchestrator.generateCompletionReport();
      
      assert.strictEqual(report.status, 'MISSION_COMPLETED');
      assert.strictEqual(report.execution_time, 120.5);
      assert.strictEqual(report.dashboard_url, 'http://localhost:3000');
      assert.strictEqual(report.summary.sdrs_discovered, 5);
      assert.strictEqual(report.phases_completed, 4);
      assert.strictEqual(report.agents_executed, 4);
      assert.ok(Array.isArray(report.execution_log));
    });
  });

  describe('Error Handling', () => {
    test('should handle failure gracefully', async () => {
      const testError = new Error('Test orchestration failure');
      
      await orchestrator.handleFailure(testError);
      
      const failureStore = memoryMock.store.mock.calls.find(call => call.arguments[0] === 'mission_failed');
      assert.ok(failureStore);
      assert.strictEqual(failureStore.arguments[1].error, 'Test orchestration failure');
      assert.ok(failureStore.arguments[1].timestamp);
      assert.ok(Array.isArray(failureStore.arguments[1].execution_log));
    });

    test('should handle phase failures', async () => {
      agentMocks.sdrDiscovery.execute.mock.mockImplementation(() => Promise.reject(new Error('SDR discovery failed')));
      
      try {
        await orchestrator.executePhase1();
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error.message.includes('SDR discovery failed'));
      }
    });

    test('should handle memory operation failures', async () => {
      memoryMock.waitFor.mock.mockImplementation(() => Promise.reject(new Error('Memory timeout')));
      
      try {
        await orchestrator.executePhase2();
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error.message.includes('Memory timeout'));
      }
    });
  });

  describe('Main Execute Method', () => {
    beforeEach(() => {
      // Mock all phase methods
      orchestrator.initializeSystem = mock.fn(() => Promise.resolve());
      orchestrator.executePhase1 = mock.fn(() => Promise.resolve());
      orchestrator.executePhase2 = mock.fn(() => Promise.resolve());
      orchestrator.executePhase3 = mock.fn(() => Promise.resolve());
      orchestrator.executePhase4 = mock.fn(() => Promise.resolve());
      orchestrator.finalValidation = mock.fn(() => Promise.resolve());
      orchestrator.generateCompletionReport = mock.fn(() => Promise.resolve({
        status: 'MISSION_COMPLETED',
        execution_time: 60
      }));
    });

    test('should execute complete orchestration workflow', async () => {
      const result = await orchestrator.execute();
      
      assert.ok(result);
      assert.strictEqual(result.status, 'MISSION_COMPLETED');
      
      // Verify all phases executed
      assert.strictEqual(orchestrator.initializeSystem.mock.callCount(), 1);
      assert.strictEqual(orchestrator.executePhase1.mock.callCount(), 1);
      assert.strictEqual(orchestrator.executePhase2.mock.callCount(), 1);
      assert.strictEqual(orchestrator.executePhase3.mock.callCount(), 1);
      assert.strictEqual(orchestrator.executePhase4.mock.callCount(), 1);
      assert.strictEqual(orchestrator.finalValidation.mock.callCount(), 1);
      assert.strictEqual(orchestrator.generateCompletionReport.mock.callCount(), 1);
      
      // Should set start time
      assert.ok(orchestrator.startTime);
    });

    test('should handle orchestration failure', async () => {
      orchestrator.executePhase2.mock.mockImplementation(() => Promise.reject(new Error('Phase 2 failed')));
      orchestrator.handleFailure = mock.fn(() => Promise.resolve());
      
      try {
        await orchestrator.execute();
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error.message.includes('Phase 2 failed'));
        assert.strictEqual(orchestrator.handleFailure.mock.callCount(), 1);
      }
    });
  });

  describe('Shutdown', () => {
    test('should shutdown gracefully', async () => {
      const mockHealthServer = { close: mock.fn((callback) => callback()) };
      const mockReportServer = { close: mock.fn() };
      
      orchestrator.healthServer = mockHealthServer;
      agentMocks.reportGenerator.server = mockReportServer;
      
      // Mock process.exit to avoid actually exiting
      const originalExit = process.exit;
      process.exit = mock.fn();
      
      try {
        await orchestrator.shutdown();
        
        assert.strictEqual(mockHealthServer.close.mock.callCount(), 1);
        assert.strictEqual(agentMocks.reportGenerator.shutdown.mock.callCount(), 1);
        assert.strictEqual(process.exit.mock.callCount(), 1);
        assert.strictEqual(process.exit.mock.calls[0].arguments[0], 0);
      } finally {
        process.exit = originalExit;
      }
    });

    test('should handle shutdown when servers are not running', async () => {
      orchestrator.healthServer = null;
      agentMocks.reportGenerator.server = null;
      
      const originalExit = process.exit;
      process.exit = mock.fn();
      
      try {
        // Should not throw
        await orchestrator.shutdown();
        assert.strictEqual(process.exit.mock.callCount(), 1);
      } finally {
        process.exit = originalExit;
      }
    });
  });

  describe('Agent Metrics', () => {
    test('should generate agent metrics', async () => {
      const metrics = await orchestrator.getAgentMetrics();
      
      assert.ok(metrics.sdrDiscovery);
      assert.ok(metrics.audioCapture);
      assert.ok(metrics.audioAnalysis);
      assert.ok(metrics.reportGenerator);
      
      Object.values(metrics).forEach(agentMetric => {
        assert.strictEqual(agentMetric.initialized, true);
        assert.strictEqual(agentMetric.status, 'ready');
      });
    });

    test('should handle missing agents in metrics', async () => {
      orchestrator.agents.sdrDiscovery = null;
      
      const metrics = await orchestrator.getAgentMetrics();
      
      assert.strictEqual(metrics.sdrDiscovery.initialized, false);
      assert.strictEqual(metrics.sdrDiscovery.status, 'not_ready');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle null execution log gracefully', () => {
      orchestrator.executionLog = null;
      
      const stats = orchestrator.getExecutionStats();
      assert.strictEqual(stats.total, 0);
      assert.strictEqual(stats.successful, 0);
      assert.strictEqual(stats.failed, 0);
      assert.strictEqual(stats.phases, 0);
    });

    test('should handle empty execution log', () => {
      orchestrator.executionLog = [];
      
      const stats = orchestrator.getExecutionStats();
      assert.strictEqual(stats.total, 0);
    });

    test('should handle malformed log entries', () => {
      orchestrator.executionLog = [
        null,
        undefined,
        { component: 'test' }, // Missing status
        { status: 'completed' }, // Missing component
        { component: 'phase_1', status: 'completed' } // Valid entry
      ];
      
      const stats = orchestrator.getExecutionStats();
      assert.ok(stats.total >= 1); // Should handle malformed entries gracefully
    });

    test('should handle undefined start time in metrics', async () => {
      orchestrator.startTime = null;
      memoryMock.list.mock.mockImplementation(() => Promise.resolve([]));
      
      const metrics = await orchestrator.getMetrics();
      assert.strictEqual(metrics.orchestrator.execution_time, 0);
    });
  });
});