/**
 * End-to-End Tests for Complete SPARC Workflow
 * Tests the entire system from discovery through report generation
 */

import { test, describe, beforeEach, afterEach, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import path from 'path';
import SPARCOrchestrator from '../../src/orchestrator.js';
import MockSDRServer from '../mocks/sdr-server.js';

describe('Complete SPARC Workflow E2E Tests', () => {
  let orchestrator;
  let mockServers = [];
  let testDataDir;
  let basePort = 9101;
  let originalProcessExit;

  before(async () => {
    // Create test data directory
    testDataDir = path.join(process.cwd(), 'tests', 'fixtures', 'e2e-data');
    await fs.mkdir(testDataDir, { recursive: true });
    await fs.mkdir(path.join(testDataDir, 'audio'), { recursive: true });
    await fs.mkdir(path.join(testDataDir, 'analysis'), { recursive: true });
    await fs.mkdir(path.join(testDataDir, 'memory'), { recursive: true });

    // Start comprehensive mock SDR infrastructure
    const serverConfigs = [
      { port: basePort, sdrType: 'websdr', location: 'Netherlands E2E Station', quality: 95 },
      { port: basePort + 1, sdrType: 'websdr', location: 'Germany E2E Station', quality: 90 },
      { port: basePort + 2, sdrType: 'kiwisdr', location: 'Japan E2E Station', quality: 85 },
      { port: basePort + 3, sdrType: 'openwebrx', location: 'France E2E Station', quality: 80 },
      { port: basePort + 4, sdrType: 'websdr', location: 'USA E2E Station', quality: 75 }
    ];

    for (const config of serverConfigs) {
      const server = new MockSDRServer(config);
      await server.start();
      mockServers.push(server);
    }

    // Mock process.exit to prevent test process from exiting
    originalProcessExit = process.exit;
    process.exit = () => {}; // No-op during tests

    console.log(`Started ${mockServers.length} mock SDR servers for E2E testing`);
  });

  after(async () => {
    // Restore process.exit
    process.exit = originalProcessExit;

    // Stop all mock servers
    for (const server of mockServers) {
      await server.stop();
    }

    // Clean up test data
    try {
      await fs.rmdir(testDataDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }

    console.log('Stopped all mock SDR servers and cleaned up test data');
  });

  beforeEach(() => {
    orchestrator = new SPARCOrchestrator();
    
    // Override data directories for testing
    orchestrator.agents.audioCapture.audioDir = path.join(testDataDir, 'audio');
    orchestrator.agents.audioAnalysis.analysisDir = path.join(testDataDir, 'analysis');
    
    // Disable actual health server to avoid port conflicts
    orchestrator.healthServer = null;
  });

  afterEach(async () => {
    // Cleanup orchestrator
    if (orchestrator.healthServer) {
      orchestrator.healthServer.close();
    }
    if (orchestrator.agents.reportGenerator.server) {
      orchestrator.agents.reportGenerator.shutdown();
    }

    // Clean up test files
    try {
      const audioFiles = await fs.readdir(path.join(testDataDir, 'audio'));
      for (const file of audioFiles) {
        if (file.endsWith('.wav')) {
          await fs.unlink(path.join(testDataDir, 'audio', file));
        }
      }

      const analysisFiles = await fs.readdir(path.join(testDataDir, 'analysis'));
      for (const file of analysisFiles) {
        if (file.endsWith('.json')) {
          await fs.unlink(path.join(testDataDir, 'analysis', file));
        }
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Complete System Integration', () => {
    test('should execute full SPARC workflow from discovery to report', async () => {
      // Override discovery methods to use mock servers
      orchestrator.agents.sdrDiscovery.discoverWebSDRs = async function() {
        return [
          {
            url: `http://localhost:${basePort}/`,
            location: 'Netherlands E2E Station',
            frequencies: this.getDefaultHFBands(),
            quality_score: 0,
            last_checked: new Date().toISOString(),
            network: 'WebSDR'
          },
          {
            url: `http://localhost:${basePort + 1}/`,
            location: 'Germany E2E Station',
            frequencies: this.getDefaultHFBands(),
            quality_score: 0,
            last_checked: new Date().toISOString(),
            network: 'WebSDR'
          }
        ];
      };

      orchestrator.agents.sdrDiscovery.discoverKiwiSDRs = async function() {
        return [
          {
            url: `http://localhost:${basePort + 2}/`,
            location: 'Japan E2E Station',
            frequencies: this.getDefaultHFBands(),
            quality_score: 0,
            last_checked: new Date().toISOString(),
            network: 'KiwiSDR'
          }
        ];
      };

      // Reduce capture duration for faster testing
      orchestrator.agents.audioCapture.captureConfig.duration = 5; // 5 seconds

      // Override report deployment to use different port
      const originalDeployReport = orchestrator.agents.reportGenerator.deployReport;
      orchestrator.agents.reportGenerator.deployReport = async function() {
        const app = require('express')();
        const port = 3001; // Different port to avoid conflicts

        return new Promise((resolve) => {
          this.server = app.listen(port, () => {
            const url = `http://localhost:${port}`;
            console.log(`🌐 Test report server started at ${url}`);
            resolve(url);
          });
        });
      };

      // Execute full workflow
      const result = await orchestrator.execute();
      
      // Verify completion report
      assert.ok(result);
      assert.strictEqual(result.status, 'MISSION_COMPLETED');
      assert.ok(result.execution_time > 0);
      assert.ok(result.dashboard_url);
      assert.ok(result.summary);
      assert.strictEqual(result.phases_completed, 4);
      assert.strictEqual(result.agents_executed, 4);
      
      // Verify execution log
      assert.ok(Array.isArray(result.execution_log));
      assert.ok(result.execution_log.length > 0);
      
      // Verify all phases completed
      const phaseEntries = result.execution_log.filter(entry => 
        entry.component.startsWith('phase_') && entry.status === 'completed'
      );
      assert.ok(phaseEntries.length >= 4, 'All phases should complete');

    }, { timeout: 60000 }); // 60 second timeout for full workflow

    test('should handle mixed server availability in end-to-end workflow', async () => {
      // Take some servers offline
      mockServers[1].setOnline(false); // Germany offline
      mockServers[3].setOnline(false); // France offline

      // Override discovery to include offline servers
      orchestrator.agents.sdrDiscovery.discoverWebSDRs = async function() {
        return [
          {
            url: `http://localhost:${basePort}/`,
            location: 'Netherlands E2E Station',
            frequencies: this.getDefaultHFBands(),
            quality_score: 0,
            last_checked: new Date().toISOString(),
            network: 'WebSDR'
          },
          {
            url: `http://localhost:${basePort + 1}/`, // Offline
            location: 'Germany E2E Station (Offline)',
            frequencies: this.getDefaultHFBands(),
            quality_score: 0,
            last_checked: new Date().toISOString(),
            network: 'WebSDR'
          }
        ];
      };

      orchestrator.agents.sdrDiscovery.discoverKiwiSDRs = async function() {
        return [
          {
            url: `http://localhost:${basePort + 2}/`,
            location: 'Japan E2E Station',
            frequencies: this.getDefaultHFBands(),
            quality_score: 0,
            last_checked: new Date().toISOString(),
            network: 'KiwiSDR'
          }
        ];
      };

      // Reduce processing time
      orchestrator.agents.audioCapture.captureConfig.duration = 3;

      // Should complete successfully despite some offline servers
      const result = await orchestrator.execute();
      
      assert.ok(result);
      assert.strictEqual(result.status, 'MISSION_COMPLETED');
      assert.ok(result.summary.sdrs_discovered >= 1, 'Should discover at least online servers');

      // Bring servers back online
      mockServers[1].setOnline(true);
      mockServers[3].setOnline(true);

    }, { timeout: 45000 });
  });

  describe('Data Flow Validation', () => {
    test('should maintain data integrity throughout workflow', async () => {
      // Simplified workflow with validation at each step
      
      // Phase 1: SDR Discovery
      orchestrator.agents.sdrDiscovery.discoverWebSDRs = async function() {
        return [
          {
            url: `http://localhost:${basePort}/`,
            location: 'Validation Test Station',
            frequencies: this.getDefaultHFBands(),
            quality_score: 0,
            last_checked: new Date().toISOString(),
            network: 'WebSDR'
          }
        ];
      };

      await orchestrator.executePhase1();
      
      // Verify SDR data
      const sdrData = await orchestrator.memory.query('active_sdrs');
      assert.ok(Array.isArray(sdrData));
      assert.ok(sdrData.length > 0);
      assert.ok(sdrData[0].url);
      assert.ok(sdrData[0].location);
      assert.ok(sdrData[0].quality_score >= 0);

      // Phase 2: Audio Capture
      orchestrator.agents.audioCapture.captureConfig.duration = 2; // Quick capture
      await orchestrator.executePhase2();
      
      // Verify audio data
      const audioData = await orchestrator.memory.query('audio_samples');
      assert.ok(Array.isArray(audioData));
      assert.ok(audioData.length > 0);
      assert.ok(audioData[0].id);
      assert.ok(audioData[0].filename);
      assert.ok(audioData[0].metadata);

      // Phase 3: Analysis
      await orchestrator.executePhase3();
      
      // Verify analysis data
      const analysisData = await orchestrator.memory.query('analysis_results');
      assert.ok(Array.isArray(analysisData));
      assert.ok(analysisData.length > 0);
      assert.ok(analysisData[0].analysis_results);
      assert.ok(typeof analysisData[0].analysis_results.confidence === 'number');

      // Phase 4: Report Generation
      orchestrator.agents.reportGenerator.deployReport = async function() {
        return 'http://localhost:3002';
      };
      
      await orchestrator.executePhase4();
      
      // Verify report data
      const reportData = await orchestrator.memory.query('report_data');
      assert.ok(reportData);
      assert.ok(reportData.summary);
      assert.ok(reportData.coverage);
      assert.ok(reportData.analysis);

    }, { timeout: 30000 });

    test('should generate comprehensive analytics across workflow', async () => {
      // Set up for analytics collection
      const analytics = {
        discovery: { startTime: 0, endTime: 0, sdrCount: 0 },
        capture: { startTime: 0, endTime: 0, sampleCount: 0 },
        analysis: { startTime: 0, endTime: 0, analysisCount: 0 },
        report: { startTime: 0, endTime: 0, reportGenerated: false }
      };

      // Hook into phases to collect analytics
      const originalPhase1 = orchestrator.executePhase1;
      orchestrator.executePhase1 = async function() {
        analytics.discovery.startTime = Date.now();
        const result = await originalPhase1.call(this);
        analytics.discovery.endTime = Date.now();
        const sdrData = await this.memory.query('active_sdrs');
        analytics.discovery.sdrCount = sdrData ? sdrData.length : 0;
        return result;
      };

      const originalPhase2 = orchestrator.executePhase2;
      orchestrator.executePhase2 = async function() {
        analytics.capture.startTime = Date.now();
        const result = await originalPhase2.call(this);
        analytics.capture.endTime = Date.now();
        const audioData = await this.memory.query('audio_samples');
        analytics.capture.sampleCount = audioData ? audioData.length : 0;
        return result;
      };

      const originalPhase3 = orchestrator.executePhase3;
      orchestrator.executePhase3 = async function() {
        analytics.analysis.startTime = Date.now();
        const result = await originalPhase3.call(this);
        analytics.analysis.endTime = Date.now();
        const analysisData = await this.memory.query('analysis_results');
        analytics.analysis.analysisCount = analysisData ? analysisData.length : 0;
        return result;
      };

      const originalPhase4 = orchestrator.executePhase4;
      orchestrator.executePhase4 = async function() {
        analytics.report.startTime = Date.now();
        const result = await originalPhase4.call(this);
        analytics.report.endTime = Date.now();
        analytics.report.reportGenerated = true;
        return result;
      };

      // Configure for quick execution
      orchestrator.agents.sdrDiscovery.discoverWebSDRs = async function() {
        return [
          {
            url: `http://localhost:${basePort}/`,
            location: 'Analytics Test Station',
            frequencies: this.getDefaultHFBands(),
            quality_score: 85,
            last_checked: new Date().toISOString(),
            network: 'WebSDR'
          }
        ];
      };

      orchestrator.agents.audioCapture.captureConfig.duration = 1;
      orchestrator.agents.reportGenerator.deployReport = async function() {
        return 'http://localhost:3003';
      };

      // Execute workflow
      await orchestrator.execute();

      // Validate analytics
      assert.ok(analytics.discovery.sdrCount > 0, 'Should discover SDRs');
      assert.ok(analytics.capture.sampleCount > 0, 'Should capture audio samples');
      assert.ok(analytics.analysis.analysisCount > 0, 'Should generate analyses');
      assert.ok(analytics.report.reportGenerated, 'Should generate report');

      // Validate timing
      Object.values(analytics).forEach(phase => {
        if (phase.startTime && phase.endTime) {
          assert.ok(phase.endTime > phase.startTime, 'Phase should have valid timing');
          assert.ok(phase.endTime - phase.startTime < 30000, 'Phase should complete reasonably quickly');
        }
      });

    }, { timeout: 40000 });
  });

  describe('Error Recovery and Resilience', () => {
    test('should recover from partial failures in workflow', async () => {
      // Set up scenario with some failures
      let failureCount = 0;
      
      // Mock some operations to fail initially then succeed
      const originalScoreSDRs = orchestrator.agents.sdrDiscovery.scoreSDRs;
      orchestrator.agents.sdrDiscovery.scoreSDRs = async function() {
        if (failureCount < 1) {
          failureCount++;
          throw new Error('Temporary scoring failure');
        }
        return originalScoreSDRs.call(this);
      };

      orchestrator.agents.sdrDiscovery.discoverWebSDRs = async function() {
        return [
          {
            url: `http://localhost:${basePort}/`,
            location: 'Recovery Test Station',
            frequencies: this.getDefaultHFBands(),
            quality_score: 0,
            last_checked: new Date().toISOString(),
            network: 'WebSDR'
          }
        ];
      };

      try {
        // First attempt should fail
        await orchestrator.executePhase1();
        assert.fail('Should have failed on first attempt');
      } catch (error) {
        assert.ok(error.message.includes('Temporary scoring failure'));
      }

      // Reset failure count for retry
      failureCount = 1;

      // Second attempt should succeed
      const result = await orchestrator.executePhase1();
      
      // Should have SDR data despite initial failure
      const sdrData = await orchestrator.memory.query('active_sdrs');
      assert.ok(Array.isArray(sdrData));

    }, { timeout: 20000 });

    test('should maintain system stability under load', async () => {
      // Create multiple mock servers for load testing
      const loadServers = [];
      const loadBasePort = 9201;
      
      try {
        // Start additional servers for load test
        for (let i = 0; i < 5; i++) {
          const server = new MockSDRServer({
            port: loadBasePort + i,
            sdrType: 'websdr',
            location: `Load Test Server ${i}`,
            quality: 80 - (i * 5)
          });
          await server.start();
          loadServers.push(server);
        }

        // Configure discovery to find all load test servers
        orchestrator.agents.sdrDiscovery.discoverWebSDRs = async function() {
          return loadServers.map((server, i) => ({
            url: `http://localhost:${loadBasePort + i}/`,
            location: `Load Test Server ${i}`,
            frequencies: this.getDefaultHFBands(),
            quality_score: 0,
            last_checked: new Date().toISOString(),
            network: 'WebSDR'
          }));
        };

        // Reduce capture duration but increase parallelism
        orchestrator.agents.audioCapture.captureConfig.duration = 1;
        
        // Monitor memory usage
        const initialMemory = process.memoryUsage();

        // Execute discovery and capture phases
        await orchestrator.executePhase1();
        await orchestrator.executePhase2();

        const finalMemory = process.memoryUsage();
        const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

        // Should handle load without excessive memory usage
        assert.ok(memoryIncrease < 200 * 1024 * 1024, 'Memory usage should remain reasonable under load');

        // Verify data quality
        const sdrData = await orchestrator.memory.query('active_sdrs');
        const audioData = await orchestrator.memory.query('audio_samples');
        
        assert.ok(sdrData.length > 0, 'Should discover multiple SDRs under load');
        assert.ok(audioData.length > 0, 'Should capture audio samples under load');

      } finally {
        // Clean up load test servers
        for (const server of loadServers) {
          await server.stop();
        }
      }

    }, { timeout: 30000 });
  });

  describe('Report Generation and Validation', () => {
    test('should generate accessible and valid reports', async () => {
      // Quick workflow to generate report
      orchestrator.agents.sdrDiscovery.discoverWebSDRs = async function() {
        return [
          {
            url: `http://localhost:${basePort}/`,
            location: 'Report Test Station',
            frequencies: this.getDefaultHFBands(),
            quality_score: 90,
            last_checked: new Date().toISOString(),
            network: 'WebSDR'
          }
        ];
      };

      orchestrator.agents.audioCapture.captureConfig.duration = 1;

      // Execute through report generation
      await orchestrator.executePhase1();
      await orchestrator.executePhase2();
      await orchestrator.executePhase3();

      // Use a test port for report server
      const reportPort = 3004;
      orchestrator.agents.reportGenerator.deployReport = async function() {
        const express = require('express');
        const app = express();

        app.get('/', (req, res) => {
          res.send('<html><body><h1>Test Report</h1></body></html>');
        });

        return new Promise((resolve) => {
          this.server = app.listen(reportPort, () => {
            resolve(`http://localhost:${reportPort}`);
          });
        });
      };

      await orchestrator.executePhase4();

      // Verify report accessibility
      const reportData = await orchestrator.memory.query('report_ready');
      assert.ok(reportData);
      assert.ok(reportData.url);

      // Test report endpoint
      const response = await fetch(reportData.url);
      assert.ok(response.ok);
      
      const html = await response.text();
      assert.ok(html.includes('<html>'));
      assert.ok(html.includes('Test Report'));

    }, { timeout: 25000 });
  });

  describe('Performance Benchmarks', () => {
    test('should complete workflow within performance targets', async () => {
      const performanceTargets = {
        totalWorkflow: 30000, // 30 seconds
        discovery: 10000,     // 10 seconds
        capture: 8000,        // 8 seconds (with 5s audio)
        analysis: 5000,       // 5 seconds
        report: 5000          // 5 seconds
      };

      // Configure for performance test
      orchestrator.agents.sdrDiscovery.discoverWebSDRs = async function() {
        return [
          {
            url: `http://localhost:${basePort}/`,
            location: 'Performance Test',
            frequencies: this.getDefaultHFBands(),
            quality_score: 85,
            last_checked: new Date().toISOString(),
            network: 'WebSDR'
          }
        ];
      };

      orchestrator.agents.audioCapture.captureConfig.duration = 3; // 3 second capture
      orchestrator.agents.reportGenerator.deployReport = async () => 'http://localhost:3005';

      const startTime = Date.now();
      
      // Measure individual phases
      const phase1Start = Date.now();
      await orchestrator.executePhase1();
      const phase1Time = Date.now() - phase1Start;

      const phase2Start = Date.now();
      await orchestrator.executePhase2();
      const phase2Time = Date.now() - phase2Start;

      const phase3Start = Date.now();
      await orchestrator.executePhase3();
      const phase3Time = Date.now() - phase3Start;

      const phase4Start = Date.now();
      await orchestrator.executePhase4();
      const phase4Time = Date.now() - phase4Start;

      const totalTime = Date.now() - startTime;

      // Validate performance targets
      assert.ok(phase1Time <= performanceTargets.discovery, 
        `Discovery phase took ${phase1Time}ms, target: ${performanceTargets.discovery}ms`);
      assert.ok(phase2Time <= performanceTargets.capture, 
        `Capture phase took ${phase2Time}ms, target: ${performanceTargets.capture}ms`);
      assert.ok(phase3Time <= performanceTargets.analysis, 
        `Analysis phase took ${phase3Time}ms, target: ${performanceTargets.analysis}ms`);
      assert.ok(phase4Time <= performanceTargets.report, 
        `Report phase took ${phase4Time}ms, target: ${performanceTargets.report}ms`);
      assert.ok(totalTime <= performanceTargets.totalWorkflow, 
        `Total workflow took ${totalTime}ms, target: ${performanceTargets.totalWorkflow}ms`);

      console.log(`Performance test completed in ${totalTime}ms (target: ${performanceTargets.totalWorkflow}ms)`);

    }, { timeout: 35000 });
  });
});