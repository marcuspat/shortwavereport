/**
 * Test Suite for SPARC Orchestrator
 * Validates end-to-end system functionality
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import SPARCOrchestrator from '../src/orchestrator.js';
import MemoryManager from '../src/memory/memory-manager.js';
import fs from 'fs/promises';
import path from 'path';

describe('SPARC Orchestrator Tests', () => {
  let orchestrator;
  let memory;

  beforeEach(async () => {
    orchestrator = new SPARCOrchestrator();
    memory = new MemoryManager();
    
    // Clean up any previous test data
    try {
      const memoryDir = path.join(process.cwd(), 'data', 'memory');
      const files = await fs.readdir(memoryDir);
      for (const file of files) {
        if (file.includes('test_')) {
          await fs.unlink(path.join(memoryDir, file));
        }
      }
    } catch (error) {
      // Directory might not exist, that's ok
    }
  });

  afterEach(async () => {
    // Cleanup
    if (orchestrator.agents.reportGenerator.server) {
      orchestrator.agents.reportGenerator.shutdown();
    }
  });

  test('should initialize orchestrator correctly', async () => {
    assert.ok(orchestrator.memory);
    assert.ok(orchestrator.agents);
    assert.ok(orchestrator.agents.sdrDiscovery);
    assert.ok(orchestrator.agents.audioCapture);
    assert.ok(orchestrator.agents.audioAnalysis);
    assert.ok(orchestrator.agents.reportGenerator);
    assert.strictEqual(orchestrator.executionLog.length, 0);
  });

  test('should log execution events correctly', () => {
    orchestrator.logExecution('test_component', 'starting', 'Test description');
    
    assert.strictEqual(orchestrator.executionLog.length, 1);
    assert.strictEqual(orchestrator.executionLog[0].component, 'test_component');
    assert.strictEqual(orchestrator.executionLog[0].status, 'starting');
    assert.strictEqual(orchestrator.executionLog[0].description, 'Test description');
    assert.ok(orchestrator.executionLog[0].timestamp);
  });

  test('should validate requirements successfully', async () => {
    const result = await orchestrator.validateRequirements();
    
    assert.ok(result);
    assert.strictEqual(result.networkAccess, true);
    assert.strictEqual(result.ffmpegAvailable, true);
    assert.strictEqual(result.memorySpace, true);
    assert.ok(result.nodeVersion);
  });

  test('should monitor system health', async () => {
    const health = await orchestrator.monitorSystemHealth();
    
    assert.ok(health);
    assert.ok(health.memory);
    assert.ok(typeof health.uptime === 'number');
    assert.strictEqual(health.status, 'healthy');
  });

  test('should handle memory operations', async () => {
    // Test memory storage and retrieval
    await memory.store('test_key', { test: 'data' });
    
    const result = await memory.query('test_key');
    assert.deepStrictEqual(result, { test: 'data' });
    
    const exists = await memory.exists('test_key');
    assert.strictEqual(exists, true);
    
    const nonExistent = await memory.exists('non_existent_key');
    assert.strictEqual(nonExistent, false);
  });

  test('should generate completion report correctly', async () => {
    // Set up mock completion data
    await memory.store('mission_complete', {
      execution_time: 120.5,
      summary: {
        sdrs_discovered: 5,
        samples_captured: 20,
        analyses_completed: 15,
        report_generated: true
      }
    });

    await memory.store('report_ready', {
      url: 'http://localhost:3000'
    });

    const report = await orchestrator.generateCompletionReport();
    
    assert.strictEqual(report.status, 'MISSION_COMPLETED');
    assert.strictEqual(report.execution_time, 120.5);
    assert.strictEqual(report.dashboard_url, 'http://localhost:3000');
    assert.strictEqual(report.summary.sdrs_discovered, 5);
    assert.strictEqual(report.summary.samples_captured, 20);
    assert.strictEqual(report.phases_completed, 4);
    assert.strictEqual(report.agents_executed, 4);
  });

  test('should handle initialization phase', async () => {
    await orchestrator.initializeSystem();
    
    const sparcStart = await memory.query('sparc_start');
    assert.ok(sparcStart);
    assert.strictEqual(sparcStart.orchestrator, 'active');
    assert.strictEqual(sparcStart.phase, 'initialization');
    assert.ok(sparcStart.timestamp);
    
    assert.ok(orchestrator.executionLog.some(log => 
      log.component === 'system_init' && log.status === 'completed'
    ));
  });
});

describe('Memory Manager Tests', () => {
  let memory;

  beforeEach(() => {
    memory = new MemoryManager();
  });

  test('should store and retrieve data correctly', async () => {
    const testData = {
      sdr: 'test-sdr',
      location: 'Test Location',
      quality: 85
    };

    await memory.store('test_sdr_data', testData);
    const retrieved = await memory.query('test_sdr_data');
    
    assert.deepStrictEqual(retrieved, testData);
  });

  test('should handle non-existent keys gracefully', async () => {
    const result = await memory.query('non_existent_key');
    assert.strictEqual(result, null);
  });

  test('should list memory keys correctly', async () => {
    await memory.store('key1', { data: 'test1' });
    await memory.store('key2', { data: 'test2' });
    
    const keys = await memory.list();
    assert.ok(keys.includes('key1'));
    assert.ok(keys.includes('key2'));
  });

  test('should handle signals correctly', async () => {
    await memory.signal('test_signal', { message: 'test complete' });
    
    const signal = await memory.query('test_signal');
    assert.strictEqual(signal.signal, true);
    assert.strictEqual(signal.message, 'test complete');
    assert.ok(signal.timestamp);
  });

  test('should wait for memory keys with timeout', async () => {
    // Set up a delayed store operation
    setTimeout(async () => {
      await memory.store('delayed_key', { delayed: true });
    }, 100);

    const result = await memory.waitFor('delayed_key', 1000);
    assert.deepStrictEqual(result, { delayed: true });
  });

  test('should timeout when waiting for non-existent key', async () => {
    try {
      await memory.waitFor('never_exists', 500);
      assert.fail('Should have thrown timeout error');
    } catch (error) {
      assert.ok(error.message.includes('Timeout waiting for memory key'));
    }
  });
});

describe('Integration Tests', () => {
  test('should handle graceful shutdown', (t, done) => {
    const orchestrator = new SPARCOrchestrator();
    
    // Mock the shutdown to avoid actually exiting the process
    orchestrator.shutdown = async () => {
      if (orchestrator.agents.reportGenerator.server) {
        orchestrator.agents.reportGenerator.shutdown();
      }
      done();
    };

    // Trigger shutdown
    orchestrator.shutdown();
  });

  test('should handle failure scenarios', async () => {
    const orchestrator = new SPARCOrchestrator();
    const testError = new Error('Test failure');

    await orchestrator.handleFailure(testError);
    
    const failureData = await orchestrator.memory.query('mission_failed');
    assert.ok(failureData);
    assert.strictEqual(failureData.error, 'Test failure');
    assert.ok(failureData.timestamp);
    assert.ok(Array.isArray(failureData.execution_log));
  });
});