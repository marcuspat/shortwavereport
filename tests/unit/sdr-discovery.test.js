/**
 * Unit Tests for SDR Discovery Agent
 * TDD approach with comprehensive mocking
 */

import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import SDRDiscoveryAgent from '../../src/agents/sdr-discovery.js';

// Mock node-fetch
const mockFetch = mock.fn();
global.fetch = mockFetch;

describe('SDRDiscoveryAgent Unit Tests', () => {
  let agent;
  let memoryMock;

  beforeEach(() => {
    // Reset mocks
    mockFetch.mock.resetCalls();
    
    // Create memory mock
    memoryMock = {
      store: mock.fn(),
      signal: mock.fn(),
      query: mock.fn(),
      exists: mock.fn(),
      waitFor: mock.fn()
    };
    
    agent = new SDRDiscoveryAgent();
    agent.memory = memoryMock;
  });

  afterEach(() => {
    mock.restoreAll();
  });

  describe('Initialization', () => {
    test('should initialize with correct default values', () => {
      assert.ok(agent.memory);
      assert.ok(Array.isArray(agent.discoveredSDRs));
      assert.strictEqual(agent.discoveredSDRs.length, 0);
      assert.strictEqual(agent.maxConcurrentChecks, 5);
    });

    test('should initialize empty discovered SDRs array', () => {
      assert.deepStrictEqual(agent.discoveredSDRs, []);
    });
  });

  describe('Location Extraction', () => {
    test('should extract location from text correctly', () => {
      const testCases = [
        { 
          input: 'WebSDR at University of Twente, Netherlands', 
          expected: 'University of Twente, Netherlands' 
        },
        { 
          input: 'Hungary WebSDR Station', 
          expected: 'Hungary' 
        },
        { 
          input: 'Location: Berlin, Germany Broadcasting', 
          expected: 'Berlin' 
        },
        { 
          input: 'No location info here 123 456', 
          expected: 'Unknown' 
        }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = agent.extractLocation(input);
        assert.strictEqual(result, expected, `Failed for input: "${input}"`);
      });
    });

    test('should handle empty or null input', () => {
      assert.strictEqual(agent.extractLocation(''), 'Unknown');
      assert.strictEqual(agent.extractLocation(null), 'Unknown');
      assert.strictEqual(agent.extractLocation(undefined), 'Unknown');
    });
  });

  describe('HF Bands Configuration', () => {
    test('should return default HF bands array', () => {
      const bands = agent.getDefaultHFBands();
      assert.ok(Array.isArray(bands));
      assert.ok(bands.length >= 5);
    });

    test('should include major amateur radio bands', () => {
      const bands = agent.getDefaultHFBands();
      const bandStrings = bands.join(' ');
      
      assert.ok(bandStrings.includes('80m'));
      assert.ok(bandStrings.includes('40m'));
      assert.ok(bandStrings.includes('20m'));
      assert.ok(bandStrings.includes('15m'));
      assert.ok(bandStrings.includes('10m'));
    });

    test('should include frequency ranges in band descriptions', () => {
      const bands = agent.getDefaultHFBands();
      bands.forEach(band => {
        assert.ok(band.includes('MHz'), `Band should include MHz: ${band}`);
        assert.ok(band.includes('(') && band.includes(')'), `Band should have parentheses: ${band}`);
      });
    });
  });

  describe('WebSDR Discovery', () => {
    test('should handle successful WebSDR discovery', async () => {
      const mockHTML = `
        <html>
          <body>
            <a href="http://websdr.ewi.utwente.nl:8901/">University of Twente WebSDR</a>
            <a href="http://rx.linkfanel.net/">Hungary WebSDR</a>
            <a href="http://websdr.org/other">Not a WebSDR link</a>
          </body>
        </html>
      `;

      mockFetch.mock.mockImplementationOnce(() => Promise.resolve({
        ok: true,
        text: () => Promise.resolve(mockHTML)
      }));

      const sdrs = await agent.discoverWebSDRs();
      
      assert.ok(Array.isArray(sdrs));
      assert.ok(sdrs.length >= 2); // Should include known SDRs + discovered ones
      
      // Check that it includes known reliable WebSDRs
      const urls = sdrs.map(sdr => sdr.url);
      assert.ok(urls.includes('http://websdr.ewi.utwente.nl:8901/'));
      assert.ok(urls.includes('http://rx.linkfanel.net/'));
      
      // Verify SDR structure
      sdrs.forEach(sdr => {
        assert.ok(sdr.url);
        assert.ok(sdr.location);
        assert.ok(sdr.network);
        assert.strictEqual(sdr.network, 'WebSDR');
        assert.ok(Array.isArray(sdr.frequencies));
        assert.ok(sdr.last_checked);
        assert.strictEqual(typeof sdr.quality_score, 'number');
      });
    });

    test('should handle WebSDR discovery network errors gracefully', async () => {
      mockFetch.mock.mockImplementationOnce(() => Promise.reject(new Error('Network error')));

      const sdrs = await agent.discoverWebSDRs();
      
      assert.ok(Array.isArray(sdrs));
      assert.strictEqual(sdrs.length, 0);
    });

    test('should handle WebSDR non-200 response', async () => {
      mockFetch.mock.mockImplementationOnce(() => Promise.resolve({
        ok: false,
        status: 404
      }));

      const sdrs = await agent.discoverWebSDRs();
      
      assert.ok(Array.isArray(sdrs));
      assert.strictEqual(sdrs.length, 0);
    });

    test('should filter out websdr.org URLs', async () => {
      const mockHTML = `
        <a href="http://websdr.org/main">Main site</a>
        <a href="http://external.websdr.com/">External SDR</a>
      `;

      mockFetch.mock.mockImplementationOnce(() => Promise.resolve({
        ok: true,
        text: () => Promise.resolve(mockHTML)
      }));

      const sdrs = await agent.discoverWebSDRs();
      const urls = sdrs.map(sdr => sdr.url);
      
      assert.ok(!urls.some(url => url.includes('websdr.org')));
    });
  });

  describe('KiwiSDR Discovery', () => {
    test('should handle successful KiwiSDR discovery', async () => {
      const mockHTML = `
        <table>
          <tr>
            <td>Netherlands - University</td>
            <td><a href="http://kiwi1.example.com:8073/">Connect</a></td>
            <td>Online</td>
          </tr>
          <tr>
            <td>Germany - Hamburg</td>
            <td><a href="http://kiwi2.example.com:8073/">Connect</a></td>
            <td>Online</td>
          </tr>
        </table>
      `;

      mockFetch.mock.mockImplementationOnce(() => Promise.resolve({
        ok: true,
        text: () => Promise.resolve(mockHTML)
      }));

      const sdrs = await agent.discoverKiwiSDRs();
      
      assert.ok(Array.isArray(sdrs));
      assert.ok(sdrs.length <= 20); // Should limit to top 20
      
      sdrs.forEach(sdr => {
        assert.ok(sdr.url);
        assert.ok(sdr.location);
        assert.strictEqual(sdr.network, 'KiwiSDR');
        assert.ok(Array.isArray(sdr.frequencies));
        assert.strictEqual(typeof sdr.quality_score, 'number');
      });
    });

    test('should handle KiwiSDR discovery errors gracefully', async () => {
      mockFetch.mock.mockImplementationOnce(() => Promise.reject(new Error('KiwiSDR site down')));

      const sdrs = await agent.discoverKiwiSDRs();
      
      assert.ok(Array.isArray(sdrs));
      assert.strictEqual(sdrs.length, 0);
    });
  });

  describe('OpenWebRX Discovery', () => {
    test('should return known OpenWebRX instances', async () => {
      const sdrs = await agent.discoverOpenWebRX();
      
      assert.ok(Array.isArray(sdrs));
      assert.ok(sdrs.length > 0);
      
      sdrs.forEach(sdr => {
        assert.ok(sdr.url);
        assert.ok(sdr.location);
        assert.strictEqual(sdr.network, 'OpenWebRX');
        assert.ok(Array.isArray(sdr.frequencies));
      });
    });
  });

  describe('SDR Scoring', () => {
    test('should score SDRs based on response and network type', async () => {
      agent.discoveredSDRs = [
        {
          url: 'http://fast.websdr.com',
          location: 'Fast WebSDR',
          network: 'WebSDR',
          quality_score: 0
        },
        {
          url: 'http://slow.kiwisdr.com',
          location: 'Slow KiwiSDR',
          network: 'KiwiSDR',
          quality_score: 0
        }
      ];

      // Mock successful fast response
      mockFetch.mock.mockImplementationOnce(() => Promise.resolve({
        ok: true
      }));
      
      // Mock successful slow response
      mockFetch.mock.mockImplementationOnce(() => Promise.resolve({
        ok: true
      }));

      await agent.scoreSDRs();
      
      agent.discoveredSDRs.forEach(sdr => {
        assert.ok(sdr.quality_score >= 0);
        assert.ok(sdr.hasOwnProperty('response_time'));
        assert.ok(sdr.hasOwnProperty('status'));
      });
    });

    test('should handle offline SDRs in scoring', async () => {
      agent.discoveredSDRs = [
        {
          url: 'http://offline.websdr.com',
          location: 'Offline WebSDR',
          network: 'WebSDR',
          quality_score: 0
        }
      ];

      mockFetch.mock.mockImplementationOnce(() => Promise.reject(new Error('Connection failed')));

      await agent.scoreSDRs();
      
      assert.strictEqual(agent.discoveredSDRs[0].quality_score, 0);
      assert.strictEqual(agent.discoveredSDRs[0].status, 'offline');
      assert.ok(agent.discoveredSDRs[0].error);
    });

    test('should filter out low-scoring SDRs', async () => {
      agent.discoveredSDRs = [
        { url: 'http://good.websdr.com', quality_score: 80, network: 'WebSDR' },
        { url: 'http://bad.websdr.com', quality_score: 20, network: 'WebSDR' },
        { url: 'http://excellent.websdr.com', quality_score: 95, network: 'WebSDR' }
      ];

      // Mock the scoring process
      mockFetch.mock.mockImplementation(() => Promise.resolve({ ok: true }));

      await agent.scoreSDRs();
      
      // Should filter out SDRs with score <= 30
      const remainingSDRs = agent.discoveredSDRs.filter(sdr => sdr.quality_score <= 30);
      assert.strictEqual(remainingSDRs.length, 0);
    });

    test('should limit to top 10 SDRs', async () => {
      // Create 15 mock SDRs with high scores
      agent.discoveredSDRs = Array.from({ length: 15 }, (_, i) => ({
        url: `http://sdr${i}.example.com`,
        location: `Location ${i}`,
        network: 'WebSDR',
        quality_score: 90 + i // Ensure they all pass the filter
      }));

      mockFetch.mock.mockImplementation(() => Promise.resolve({ ok: true }));

      await agent.scoreSDRs();
      
      assert.ok(agent.discoveredSDRs.length <= 10);
    });
  });

  describe('Main Execute Method', () => {
    test('should execute complete discovery workflow', async () => {
      // Mock successful discovery methods
      agent.discoverWebSDRs = mock.fn(() => Promise.resolve([
        { url: 'http://websdr1.com', location: 'Location 1', network: 'WebSDR', quality_score: 0 }
      ]));
      
      agent.discoverKiwiSDRs = mock.fn(() => Promise.resolve([
        { url: 'http://kiwi1.com', location: 'Location 2', network: 'KiwiSDR', quality_score: 0 }
      ]));
      
      agent.discoverOpenWebRX = mock.fn(() => Promise.resolve([
        { url: 'http://openwebrx1.com', location: 'Location 3', network: 'OpenWebRX', quality_score: 0 }
      ]));

      // Mock scoring
      agent.scoreSDRs = mock.fn(async () => {
        agent.discoveredSDRs.forEach(sdr => {
          sdr.quality_score = 85; // High score to pass filter
        });
      });

      const result = await agent.execute();
      
      assert.ok(Array.isArray(result));
      assert.strictEqual(result.length, agent.discoveredSDRs.length);
      
      // Verify memory operations
      assert.strictEqual(memoryMock.store.mock.callCount(), 1);
      assert.strictEqual(memoryMock.signal.mock.callCount(), 1);
      
      const storeCall = memoryMock.store.mock.calls[0];
      assert.strictEqual(storeCall.arguments[0], 'active_sdrs');
      assert.deepStrictEqual(storeCall.arguments[1], agent.discoveredSDRs);
      
      const signalCall = memoryMock.signal.mock.calls[0];
      assert.strictEqual(signalCall.arguments[0], 'sdr_ready');
      assert.ok(signalCall.arguments[1].count >= 0);
    });

    test('should handle discovery errors gracefully', async () => {
      // Mock failed discovery
      agent.discoverWebSDRs = mock.fn(() => Promise.reject(new Error('Discovery failed')));
      agent.discoverKiwiSDRs = mock.fn(() => Promise.resolve([]));
      agent.discoverOpenWebRX = mock.fn(() => Promise.resolve([]));

      try {
        await agent.execute();
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error.message.includes('Discovery failed'));
      }
    });

    test('should handle partial discovery failures', async () => {
      // Mock partial failures
      agent.discoverWebSDRs = mock.fn(() => Promise.resolve([
        { url: 'http://websdr1.com', location: 'Location 1', network: 'WebSDR', quality_score: 85 }
      ]));
      
      agent.discoverKiwiSDRs = mock.fn(() => Promise.reject(new Error('KiwiSDR down')));
      agent.discoverOpenWebRX = mock.fn(() => Promise.resolve([]));
      agent.scoreSDRs = mock.fn();

      const result = await agent.execute();
      
      assert.ok(Array.isArray(result));
      assert.ok(result.length >= 0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle malformed HTML in WebSDR discovery', async () => {
      const malformedHTML = '<html><body><<invalid>html</invalid></body>';

      mockFetch.mock.mockImplementationOnce(() => Promise.resolve({
        ok: true,
        text: () => Promise.resolve(malformedHTML)
      }));

      const sdrs = await agent.discoverWebSDRs();
      assert.ok(Array.isArray(sdrs));
    });

    test('should handle empty response in KiwiSDR discovery', async () => {
      mockFetch.mock.mockImplementationOnce(() => Promise.resolve({
        ok: true,
        text: () => Promise.resolve('')
      }));

      const sdrs = await agent.discoverKiwiSDRs();
      assert.ok(Array.isArray(sdrs));
      assert.strictEqual(sdrs.length, 0);
    });

    test('should handle fetch timeout errors', async () => {
      mockFetch.mock.mockImplementationOnce(() => Promise.reject(new Error('Request timeout')));

      const sdrs = await agent.discoverWebSDRs();
      assert.ok(Array.isArray(sdrs));
      assert.strictEqual(sdrs.length, 0);
    });
  });
});