/**
 * Test Configuration and Setup
 * Centralizes test configuration and provides common utilities
 */

import fs from 'fs/promises';
import path from 'path';

export class TestConfig {
  static config = {
    // Test timeouts (milliseconds)
    timeouts: {
      unit: 5000,        // 5 seconds for unit tests
      integration: 15000, // 15 seconds for integration tests
      e2e: 60000         // 60 seconds for E2E tests
    },

    // Mock server configuration
    mockServers: {
      basePort: 9000,
      portRange: 100,    // Use ports 9000-9099 for testing
      maxServers: 20
    },

    // Test data paths
    paths: {
      fixtures: path.join(process.cwd(), 'tests', 'fixtures'),
      testData: path.join(process.cwd(), 'tests', 'fixtures', 'data'),
      testAudio: path.join(process.cwd(), 'tests', 'fixtures', 'audio'),
      testReports: path.join(process.cwd(), 'tests', 'fixtures', 'reports'),
      coverage: path.join(process.cwd(), 'coverage')
    },

    // Coverage targets
    coverage: {
      statements: 90,
      branches: 85,
      functions: 90,
      lines: 90
    },

    // Test environment variables
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'error',
      DISABLE_REAL_SDR: 'true',
      TEST_MODE: 'true'
    }
  };

  /**
   * Initialize test environment
   */
  static async initialize() {
    // Set environment variables
    Object.assign(process.env, this.config.env);

    // Create test directories
    for (const [key, dirPath] of Object.entries(this.config.paths)) {
      try {
        await fs.mkdir(dirPath, { recursive: true });
      } catch (error) {
        if (error.code !== 'EEXIST') {
          console.warn(`Failed to create test directory ${dirPath}:`, error.message);
        }
      }
    }

    console.log('Test environment initialized');
  }

  /**
   * Clean up test environment
   */
  static async cleanup() {
    try {
      // Clean up test data directories (but keep structure)
      const testDataDirs = [
        this.config.paths.testAudio,
        this.config.paths.testReports,
        path.join(this.config.paths.testData, 'memory')
      ];

      for (const dir of testDataDirs) {
        try {
          const files = await fs.readdir(dir);
          for (const file of files) {
            if (!file.startsWith('.')) { // Keep hidden files like .gitkeep
              await fs.unlink(path.join(dir, file));
            }
          }
        } catch (error) {
          // Directory might not exist or be empty
        }
      }

      console.log('Test environment cleaned up');
    } catch (error) {
      console.warn('Test cleanup failed:', error.message);
    }
  }

  /**
   * Get available test port
   */
  static getTestPort() {
    const { basePort, portRange } = this.config.mockServers;
    return basePort + Math.floor(Math.random() * portRange);
  }

  /**
   * Create test fixtures
   */
  static async createFixtures() {
    const fixtures = {
      // Sample SDR data
      sampleSDRs: [
        {
          url: 'http://test.websdr.com:8901/',
          location: 'Test WebSDR Station',
          network: 'WebSDR',
          quality_score: 85,
          frequencies: ['80m', '40m', '20m', '15m', '10m']
        },
        {
          url: 'http://test.kiwisdr.com:8073/',
          location: 'Test KiwiSDR Station',
          network: 'KiwiSDR',
          quality_score: 90,
          frequencies: ['160m-10m']
        }
      ],

      // Sample audio metadata
      sampleAudio: [
        {
          id: 'test_sample_1',
          filename: 'test_voice_sample.wav',
          config: {
            frequency: 14250000,
            mode: 'usb',
            type: 'hf_voice',
            bandwidth: 3000
          },
          metadata: {
            duration: 30,
            sampleRate: 16000,
            quality_estimate: 80
          }
        },
        {
          id: 'test_sample_2',
          filename: 'test_cw_sample.wav',
          config: {
            frequency: 14030000,
            mode: 'cw',
            type: 'cw_digital',
            bandwidth: 500
          },
          metadata: {
            duration: 15,
            sampleRate: 16000,
            quality_estimate: 75
          }
        }
      ],

      // Sample analysis results
      sampleAnalysis: [
        {
          sample_id: 'test_sample_1',
          analysis_results: {
            content_type: 'voice',
            language: 'english',
            transcription: 'CQ CQ CQ de W1ABC W1ABC K',
            stations: ['W1ABC'],
            confidence: 85,
            timestamp: new Date().toISOString()
          }
        },
        {
          sample_id: 'test_sample_2',
          analysis_results: {
            content_type: 'cw',
            language: 'unknown',
            transcription: 'CQ DE DF1XYZ K',
            stations: ['DF1XYZ'],
            confidence: 90,
            timestamp: new Date().toISOString()
          }
        }
      ]
    };

    // Write fixtures to files
    for (const [name, data] of Object.entries(fixtures)) {
      const fixturePath = path.join(this.config.paths.fixtures, `${name}.json`);
      await fs.writeFile(fixturePath, JSON.stringify(data, null, 2));
    }

    console.log('Test fixtures created');
    return fixtures;
  }

  /**
   * Load test fixtures
   */
  static async loadFixtures(fixtureName) {
    try {
      const fixturePath = path.join(this.config.paths.fixtures, `${fixtureName}.json`);
      const data = await fs.readFile(fixturePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.warn(`Failed to load fixture ${fixtureName}:`, error.message);
      return null;
    }
  }

  /**
   * Generate mock audio file for testing
   */
  static async generateMockAudioFile(filename, duration = 5) {
    const filepath = path.join(this.config.paths.testAudio, filename);
    const sampleRate = 16000;
    const numSamples = sampleRate * duration;
    const buffer = Buffer.alloc(numSamples * 2); // 16-bit samples

    // Generate test audio pattern
    for (let i = 0; i < numSamples; i++) {
      // Simple sine wave with noise
      const time = i / sampleRate;
      const signal = Math.sin(2 * Math.PI * 1000 * time) * 0.3; // 1kHz tone
      const noise = (Math.random() - 0.5) * 0.1; // Background noise
      const sample = Math.floor((signal + noise) * 32767);
      
      buffer.writeInt16LE(Math.max(-32768, Math.min(32767, sample)), i * 2);
    }

    await fs.writeFile(filepath, buffer);
    return filepath;
  }

  /**
   * Wait for condition with timeout
   */
  static async waitForCondition(condition, timeout = 5000, interval = 100) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
  }

  /**
   * Create memory mock for testing
   */
  static createMemoryMock(initialData = {}) {
    const memoryStore = new Map(Object.entries(initialData));
    
    return {
      store: async (key, data) => {
        memoryStore.set(key, data);
        return true;
      },
      
      query: async (key) => {
        return memoryStore.get(key) || null;
      },
      
      exists: async (key) => {
        return memoryStore.has(key);
      },
      
      signal: async (key, data) => {
        memoryStore.set(key, { signal: true, ...data, timestamp: new Date().toISOString() });
        return true;
      },
      
      waitFor: async (key, timeout = 5000) => {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
          if (memoryStore.has(key)) {
            return memoryStore.get(key);
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        throw new Error(`Timeout waiting for memory key: ${key}`);
      },
      
      list: async () => {
        return Array.from(memoryStore.keys());
      },
      
      clear: async () => {
        memoryStore.clear();
      },
      
      // Internal methods for testing
      _getStore: () => memoryStore,
      _setStore: (data) => {
        memoryStore.clear();
        Object.entries(data).forEach(([k, v]) => memoryStore.set(k, v));
      }
    };
  }

  /**
   * Validate test coverage results
   */
  static validateCoverage(coverageData) {
    const { coverage } = this.config;
    const results = {
      passed: true,
      failures: []
    };

    const metrics = ['statements', 'branches', 'functions', 'lines'];
    
    for (const metric of metrics) {
      const actual = coverageData[metric]?.pct || 0;
      const target = coverage[metric];
      
      if (actual < target) {
        results.passed = false;
        results.failures.push({
          metric,
          actual,
          target,
          message: `${metric} coverage ${actual}% below target ${target}%`
        });
      }
    }

    return results;
  }

  /**
   * Create test summary report
   */
  static createTestSummary(testResults) {
    const summary = {
      timestamp: new Date().toISOString(),
      total: testResults.length,
      passed: testResults.filter(r => r.passed).length,
      failed: testResults.filter(r => !r.passed).length,
      skipped: testResults.filter(r => r.skipped).length,
      duration: testResults.reduce((sum, r) => sum + (r.duration || 0), 0),
      coverage: testResults.coverage || {},
      failures: testResults.filter(r => !r.passed).map(r => ({
        name: r.name,
        error: r.error
      }))
    };

    summary.passRate = (summary.passed / summary.total * 100).toFixed(1);
    
    return summary;
  }
}

// Test utilities
export class TestUtils {
  /**
   * Create temporary directory for test
   */
  static async createTempDir(prefix = 'test-') {
    const tempDir = path.join(TestConfig.config.paths.testData, `${prefix}${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    return tempDir;
  }

  /**
   * Clean up temporary directory
   */
  static async cleanupTempDir(tempDir) {
    try {
      await fs.rmdir(tempDir, { recursive: true });
    } catch (error) {
      console.warn(`Failed to cleanup temp dir ${tempDir}:`, error.message);
    }
  }

  /**
   * Assert that a value is within range
   */
  static assertWithinRange(actual, expected, tolerance, message) {
    const diff = Math.abs(actual - expected);
    const maxDiff = expected * tolerance;
    
    if (diff > maxDiff) {
      throw new Error(`${message}: ${actual} not within ${tolerance * 100}% of ${expected}`);
    }
  }

  /**
   * Assert that async operation completes within timeout
   */
  static async assertCompletesWithin(operation, timeout, message) {
    const startTime = Date.now();
    
    await operation();
    
    const duration = Date.now() - startTime;
    if (duration > timeout) {
      throw new Error(`${message}: took ${duration}ms, expected < ${timeout}ms`);
    }
  }

  /**
   * Mock function with call tracking
   */
  static createMockFunction(implementation) {
    const calls = [];
    
    const mockFn = (...args) => {
      calls.push({ args, timestamp: Date.now() });
      return implementation ? implementation(...args) : undefined;
    };
    
    mockFn.calls = calls;
    mockFn.callCount = () => calls.length;
    mockFn.calledWith = (...args) => calls.some(call => 
      call.args.length === args.length && 
      call.args.every((arg, i) => arg === args[i])
    );
    mockFn.reset = () => calls.length = 0;
    
    return mockFn;
  }

  /**
   * Deep comparison for test assertions
   */
  static deepEqual(actual, expected, message = 'Values are not deeply equal') {
    const actualStr = JSON.stringify(actual, null, 2);
    const expectedStr = JSON.stringify(expected, null, 2);
    
    if (actualStr !== expectedStr) {
      throw new Error(`${message}\nActual: ${actualStr}\nExpected: ${expectedStr}`);
    }
  }

  /**
   * Retry operation with exponential backoff
   */
  static async retryOperation(operation, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxRetries) {
          break;
        }
        
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }
}

export default TestConfig;