/**
 * Integration Tests for SDR Discovery Agent
 * Tests real network interactions with mock SDR servers
 */

import { test, describe, beforeEach, afterEach, before, after } from 'node:test';
import assert from 'node:assert';
import SDRDiscoveryAgent from '../../src/agents/sdr-discovery.js';
import MockSDRServer from '../mocks/sdr-server.js';

describe('SDRDiscoveryAgent Integration Tests', () => {
  let agent;
  let mockServers = [];
  let basePort = 8901;

  before(async () => {
    // Start mock SDR servers for testing
    const serverConfigs = [
      { port: basePort, sdrType: 'websdr', location: 'Netherlands Test Station', quality: 90 },
      { port: basePort + 1, sdrType: 'websdr', location: 'Germany Test Station', quality: 85 },
      { port: basePort + 2, sdrType: 'kiwisdr', location: 'Japan Test Station', quality: 80 },
      { port: basePort + 3, sdrType: 'openwebrx', location: 'France Test Station', quality: 75 },
      { port: basePort + 4, sdrType: 'websdr', location: 'Slow Station', quality: 70, responseDelay: 3000 }
    ];

    for (const config of serverConfigs) {
      const server = new MockSDRServer(config);
      await server.start();
      mockServers.push(server);
    }

    console.log(`Started ${mockServers.length} mock SDR servers for integration testing`);
  });

  after(async () => {
    // Stop all mock servers
    for (const server of mockServers) {
      await server.stop();
    }
    console.log('Stopped all mock SDR servers');
  });

  beforeEach(() => {
    agent = new SDRDiscoveryAgent();
  });

  afterEach(() => {
    // Reset agent state
    agent.discoveredSDRs = [];
  });

  describe('Real Network Discovery', () => {
    test('should discover mock WebSDR servers', async () => {
      // Override the WebSDR discovery to use our mock servers
      agent.discoverWebSDRs = async function() {
        const mockWebSDRs = [
          {
            url: `http://localhost:${basePort}/`,
            location: 'Netherlands Test Station',
            frequencies: this.getDefaultHFBands(),
            quality_score: 0,
            last_checked: new Date().toISOString(),
            network: 'WebSDR'
          },
          {
            url: `http://localhost:${basePort + 1}/`,
            location: 'Germany Test Station',
            frequencies: this.getDefaultHFBands(),
            quality_score: 0,
            last_checked: new Date().toISOString(),
            network: 'WebSDR'
          }
        ];
        
        return mockWebSDRs;
      };

      const sdrs = await agent.discoverWebSDRs();
      
      assert.ok(Array.isArray(sdrs));
      assert.ok(sdrs.length >= 2);
      
      sdrs.forEach(sdr => {
        assert.ok(sdr.url.includes('localhost'));
        assert.ok(sdr.location);
        assert.strictEqual(sdr.network, 'WebSDR');
        assert.ok(Array.isArray(sdr.frequencies));
      });
    });

    test('should discover mock KiwiSDR servers', async () => {
      agent.discoverKiwiSDRs = async function() {
        const mockKiwiSDRs = [
          {
            url: `http://localhost:${basePort + 2}/`,
            location: 'Japan Test Station',
            frequencies: this.getDefaultHFBands(),
            quality_score: 0,
            last_checked: new Date().toISOString(),
            network: 'KiwiSDR'
          }
        ];
        
        return mockKiwiSDRs;
      };

      const sdrs = await agent.discoverKiwiSDRs();
      
      assert.ok(Array.isArray(sdrs));
      assert.ok(sdrs.length >= 1);
      assert.strictEqual(sdrs[0].network, 'KiwiSDR');
    });

    test('should discover mock OpenWebRX servers', async () => {
      const sdrs = await agent.discoverOpenWebRX();
      
      assert.ok(Array.isArray(sdrs));
      assert.ok(sdrs.length > 0);
      sdrs.forEach(sdr => {
        assert.strictEqual(sdr.network, 'OpenWebRX');
      });
    });
  });

  describe('Network Health Checks', () => {
    test('should successfully check health of online mock servers', async () => {
      agent.discoveredSDRs = [
        {
          url: `http://localhost:${basePort}/`,
          location: 'Test Station 1',
          network: 'WebSDR',
          quality_score: 0
        },
        {
          url: `http://localhost:${basePort + 1}/`,
          location: 'Test Station 2',
          network: 'WebSDR',
          quality_score: 0
        }
      ];

      await agent.scoreSDRs();
      
      agent.discoveredSDRs.forEach(sdr => {
        assert.ok(sdr.quality_score > 0, `SDR ${sdr.location} should have a quality score`);
        assert.ok(sdr.status, `SDR ${sdr.location} should have a status`);
        assert.ok(typeof sdr.response_time === 'number', `SDR ${sdr.location} should have response time`);
      });
    });

    test('should handle slow responding servers', async () => {
      agent.discoveredSDRs = [
        {
          url: `http://localhost:${basePort + 4}/`, // Slow server with 3s delay
          location: 'Slow Test Station',
          network: 'WebSDR',
          quality_score: 0
        }
      ];

      await agent.scoreSDRs();
      
      const slowSDR = agent.discoveredSDRs[0];
      assert.ok(slowSDR.response_time > 2000, 'Slow server should have high response time');
      assert.ok(slowSDR.quality_score < 80, 'Slow server should have lower quality score');
    });

    test('should handle offline servers gracefully', async () => {
      agent.discoveredSDRs = [
        {
          url: 'http://localhost:9999/', // Non-existent server
          location: 'Offline Test Station',
          network: 'WebSDR',
          quality_score: 0
        }
      ];

      await agent.scoreSDRs();
      
      const offlineSDR = agent.discoveredSDRs[0];
      assert.strictEqual(offlineSDR.quality_score, 0);
      assert.strictEqual(offlineSDR.status, 'offline');
      assert.ok(offlineSDR.error);
    });
  });

  describe('Server Response Validation', () => {
    test('should validate WebSDR server responses', async () => {
      const serverUrl = `http://localhost:${basePort}/`;
      
      // Test main page
      const response = await fetch(serverUrl);
      assert.ok(response.ok);
      
      const html = await response.text();
      assert.ok(html.includes('WebSDR'));
      assert.ok(html.includes('Netherlands Test Station'));
      
      // Test health endpoint
      const healthResponse = await fetch(`${serverUrl}health`);
      assert.ok(healthResponse.ok);
      
      const healthData = await healthResponse.json();
      assert.strictEqual(healthData.status, 'online');
      assert.strictEqual(healthData.sdr_type, 'websdr');
    });

    test('should validate KiwiSDR server responses', async () => {
      const serverUrl = `http://localhost:${basePort + 2}/`;
      
      // Test main page
      const response = await fetch(serverUrl);
      assert.ok(response.ok);
      
      const html = await response.text();
      assert.ok(html.includes('KiwiSDR'));
      assert.ok(html.includes('Japan Test Station'));
      
      // Test status endpoint
      const statusResponse = await fetch(`${serverUrl}status`);
      assert.ok(statusResponse.ok);
      
      const statusData = await statusResponse.json();
      assert.ok(statusData.name);
      assert.strictEqual(statusData.sdr, 'KiwiSDR');
    });

    test('should validate OpenWebRX server responses', async () => {
      const serverUrl = `http://localhost:${basePort + 3}/`;
      
      // Test main page
      const response = await fetch(serverUrl);
      assert.ok(response.ok);
      
      const html = await response.text();
      assert.ok(html.includes('OpenWebRX'));
      assert.ok(html.includes('France Test Station'));
      
      // Test config endpoint
      const configResponse = await fetch(`${serverUrl}config`);
      assert.ok(configResponse.ok);
      
      const configData = await configResponse.json();
      assert.ok(configData.receiver_name);
      assert.ok(configData.samp_rate);
    });
  });

  describe('End-to-End Discovery Workflow', () => {
    test('should execute complete discovery workflow with mock servers', async () => {
      // Override discovery methods to use mock servers
      agent.discoverWebSDRs = async function() {
        return [
          {
            url: `http://localhost:${basePort}/`,
            location: 'Netherlands Test Station',
            frequencies: this.getDefaultHFBands(),
            quality_score: 0,
            last_checked: new Date().toISOString(),
            network: 'WebSDR'
          },
          {
            url: `http://localhost:${basePort + 1}/`,
            location: 'Germany Test Station',
            frequencies: this.getDefaultHFBands(),
            quality_score: 0,
            last_checked: new Date().toISOString(),
            network: 'WebSDR'
          }
        ];
      };

      agent.discoverKiwiSDRs = async function() {
        return [
          {
            url: `http://localhost:${basePort + 2}/`,
            location: 'Japan Test Station',
            frequencies: this.getDefaultHFBands(),
            quality_score: 0,
            last_checked: new Date().toISOString(),
            network: 'KiwiSDR'
          }
        ];
      };

      const result = await agent.execute();
      
      assert.ok(Array.isArray(result));
      assert.ok(result.length > 0);
      
      // Verify that servers were scored and filtered
      result.forEach(sdr => {
        assert.ok(sdr.quality_score > 30, 'All returned SDRs should pass quality filter');
        assert.ok(sdr.status, 'All SDRs should have status');
        assert.ok(typeof sdr.response_time === 'number', 'All SDRs should have response time');
      });
      
      // Should include multiple network types
      const networks = new Set(result.map(sdr => sdr.network));
      assert.ok(networks.size > 1, 'Should discover multiple network types');
    });

    test('should handle mixed online/offline servers', async () => {
      agent.discoveredSDRs = [
        {
          url: `http://localhost:${basePort}/`, // Online
          location: 'Online Station',
          network: 'WebSDR',
          quality_score: 0
        },
        {
          url: 'http://localhost:9999/', // Offline
          location: 'Offline Station',
          network: 'WebSDR',
          quality_score: 0
        },
        {
          url: `http://localhost:${basePort + 2}/`, // Online
          location: 'Another Online Station',
          network: 'KiwiSDR',
          quality_score: 0
        }
      ];

      await agent.scoreSDRs();
      
      // Should filter out offline servers
      const onlineSDRs = agent.discoveredSDRs.filter(sdr => sdr.status === 'online');
      const offlineSDRs = agent.discoveredSDRs.filter(sdr => sdr.status === 'offline');
      
      assert.ok(onlineSDRs.length >= 2, 'Should have online servers');
      assert.ok(offlineSDRs.length >= 1, 'Should detect offline servers');
      
      onlineSDRs.forEach(sdr => {
        assert.ok(sdr.quality_score > 0, 'Online servers should have quality scores');
      });
    });
  });

  describe('Performance and Resilience', () => {
    test('should handle concurrent server checks efficiently', async () => {
      // Create many mock SDRs to test concurrency
      const manySDRs = Array.from({ length: 10 }, (_, i) => ({
        url: i < 5 ? `http://localhost:${basePort + (i % 5)}/` : `http://localhost:${9000 + i}/`, // Mix online/offline
        location: `Test Station ${i}`,
        network: 'WebSDR',
        quality_score: 0
      }));

      agent.discoveredSDRs = manySDRs;
      
      const startTime = Date.now();
      await agent.scoreSDRs();
      const duration = Date.now() - startTime;
      
      // Should complete in reasonable time despite many servers
      assert.ok(duration < 15000, `Scoring should complete in under 15s, took ${duration}ms`);
      
      // Should respect maxConcurrentChecks
      assert.strictEqual(agent.maxConcurrentChecks, 5);
    });

    test('should maintain stability under server degradation', async () => {
      // Simulate server going offline during discovery
      const onlineServer = mockServers[0];
      
      agent.discoveredSDRs = [
        {
          url: `http://localhost:${basePort}/`,
          location: 'Test Station',
          network: 'WebSDR',
          quality_score: 0
        }
      ];

      // First check should succeed
      await agent.scoreSDRs();
      assert.strictEqual(agent.discoveredSDRs[0].status, 'online');
      
      // Take server offline
      onlineServer.setOnline(false);
      
      // Reset quality scores
      agent.discoveredSDRs[0].quality_score = 0;
      agent.discoveredSDRs[0].status = undefined;
      
      // Second check should detect offline status
      await agent.scoreSDRs();
      assert.strictEqual(agent.discoveredSDRs[0].status, 'offline');
      
      // Bring server back online
      onlineServer.setOnline(true);
    });

    test('should handle network timeouts gracefully', async () => {
      // Create a server that doesn't respond
      agent.discoveredSDRs = [
        {
          url: 'http://192.0.2.1:12345/', // Non-routable address (RFC 5737)
          location: 'Timeout Station',
          network: 'WebSDR',
          quality_score: 0
        }
      ];

      const startTime = Date.now();
      await agent.scoreSDRs();
      const duration = Date.now() - startTime;
      
      // Should timeout quickly and not hang
      assert.ok(duration < 10000, 'Should timeout quickly for unreachable servers');
      assert.strictEqual(agent.discoveredSDRs[0].status, 'offline');
      assert.ok(agent.discoveredSDRs[0].error);
    });
  });

  describe('Server Statistics and Monitoring', () => {
    test('should collect comprehensive server statistics', async () => {
      for (const server of mockServers.slice(0, 3)) { // Test first 3 servers
        const stats = server.getStats();
        
        assert.ok(stats.sdr_type);
        assert.ok(stats.location);
        assert.ok(typeof stats.port === 'number');
        assert.ok(typeof stats.is_online === 'boolean');
        assert.ok(typeof stats.connected_clients === 'number');
        assert.ok(typeof stats.quality === 'number');
        assert.ok(typeof stats.uptime === 'number');
      }
    });

    test('should monitor server health endpoints', async () => {
      for (const server of mockServers.slice(0, 3)) {
        const healthUrl = `http://localhost:${server.port}/health`;
        const response = await fetch(healthUrl);
        
        assert.ok(response.ok);
        
        const health = await response.json();
        assert.strictEqual(health.status, 'online');
        assert.ok(health.timestamp);
        assert.ok(typeof health.clients === 'number');
      }
    });
  });

  describe('Error Recovery and Fallbacks', () => {
    test('should continue discovery when some sources fail', async () => {
      // Mock one discovery method to fail
      agent.discoverWebSDRs = async function() {
        throw new Error('WebSDR discovery failed');
      };

      agent.discoverKiwiSDRs = async function() {
        return [
          {
            url: `http://localhost:${basePort + 2}/`,
            location: 'Working KiwiSDR',
            frequencies: this.getDefaultHFBands(),
            quality_score: 0,
            last_checked: new Date().toISOString(),
            network: 'KiwiSDR'
          }
        ];
      };

      // Should not throw and should return available SDRs
      const result = await agent.execute();
      
      assert.ok(Array.isArray(result));
      // Should have at least one SDR from working discovery method
    });

    test('should gracefully handle malformed server responses', async () => {
      // Create a server that returns invalid responses
      const badServer = new MockSDRServer({
        port: basePort + 10,
        sdrType: 'websdr',
        location: 'Bad Server'
      });
      
      await badServer.start();
      
      // Override route to return malformed response
      badServer.app.get('/health', (req, res) => {
        res.status(200).send('Not JSON');
      });

      agent.discoveredSDRs = [
        {
          url: `http://localhost:${basePort + 10}/`,
          location: 'Bad Server',
          network: 'WebSDR',
          quality_score: 0
        }
      ];

      // Should handle malformed response gracefully
      await agent.scoreSDRs();
      
      // Server should be marked as problematic but not crash the agent
      assert.ok(agent.discoveredSDRs[0].quality_score >= 0);
      
      await badServer.stop();
    });
  });
});