/**
 * Unit Tests for Audio Capture Agent
 * TDD approach with mocking of file system and external dependencies
 */

import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import AudioCaptureAgent from '../../src/agents/audio-capture.js';
import { spawn } from 'child_process';
import fs from 'fs/promises';

// Mock file system operations
const mockFs = {
  mkdir: mock.fn(),
  writeFile: mock.fn(),
  readdir: mock.fn(),
  unlink: mock.fn()
};

// Mock child_process spawn
const mockSpawn = mock.fn();

describe('AudioCaptureAgent Unit Tests', () => {
  let agent;
  let memoryMock;

  beforeEach(() => {
    // Reset mocks
    mockFs.mkdir.mock.resetCalls();
    mockFs.writeFile.mock.resetCalls();
    mockSpawn.mock.resetCalls();
    
    // Create memory mock
    memoryMock = {
      waitFor: mock.fn(),
      query: mock.fn(),
      store: mock.fn(),
      signal: mock.fn()
    };
    
    agent = new AudioCaptureAgent();
    agent.memory = memoryMock;
    
    // Mock file system methods
    Object.assign(fs, mockFs);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  describe('Initialization', () => {
    test('should initialize with correct default configuration', () => {
      assert.ok(agent.memory);
      assert.ok(agent.audioDir);
      assert.ok(Array.isArray(agent.capturedSamples));
      assert.strictEqual(agent.capturedSamples.length, 0);
      
      // Check capture configuration
      assert.strictEqual(agent.captureConfig.sampleRate, 16000);
      assert.strictEqual(agent.captureConfig.duration, 60);
      assert.strictEqual(agent.captureConfig.format, 'wav');
      assert.strictEqual(agent.captureConfig.channels, 1);
    });

    test('should create audio directory on initialization', async () => {
      mockFs.mkdir.mock.mockImplementationOnce(() => Promise.resolve());
      
      await agent.initializeAudioDir();
      
      assert.strictEqual(mockFs.mkdir.mock.callCount(), 1);
      const call = mockFs.mkdir.mock.calls[0];
      assert.ok(call.arguments[0].includes('audio'));
      assert.deepStrictEqual(call.arguments[1], { recursive: true });
    });

    test('should handle audio directory creation errors gracefully', async () => {
      mockFs.mkdir.mock.mockImplementationOnce(() => Promise.reject(new Error('Permission denied')));
      
      // Should not throw
      await agent.initializeAudioDir();
      
      assert.strictEqual(mockFs.mkdir.mock.callCount(), 1);
    });
  });

  describe('Signal Quality Estimation', () => {
    test('should calculate quality based on SDR properties', () => {
      const testCases = [
        {
          sdr: {
            quality_score: 75,
            network: 'WebSDR',
            response_time: 800,
            location: 'University of Test'
          },
          expectedMin: 90 // 75 + 10 (WebSDR) + 10 (fast response) + 5 (University)
        },
        {
          sdr: {
            quality_score: 50,
            network: 'KiwiSDR',
            response_time: 1500,
            location: 'Private Station'
          },
          expectedMin: 50 // 50 + 0 (not WebSDR) + 0 (slow response) + 0 (not University)
        },
        {
          sdr: {
            quality_score: 90,
            network: 'WebSDR',
            response_time: 500,
            location: 'University Lab'
          },
          expectedMin: 100 // Should cap at 100
        }
      ];

      testCases.forEach(({ sdr, expectedMin }, index) => {
        const quality = agent.estimateSignalQuality(sdr);
        assert.ok(typeof quality === 'number', `Test case ${index}: Quality should be a number`);
        assert.ok(quality >= 0 && quality <= 100, `Test case ${index}: Quality should be 0-100`);
        assert.ok(quality >= Math.min(expectedMin, 100), `Test case ${index}: Quality should be at least ${expectedMin}`);
      });
    });

    test('should handle missing SDR properties gracefully', () => {
      const incompleteSdr = {
        location: 'Test Location'
        // Missing quality_score, network, response_time
      };

      const quality = agent.estimateSignalQuality(incompleteSdr);
      assert.ok(typeof quality === 'number');
      assert.ok(quality >= 0 && quality <= 100);
    });
  });

  describe('Audio Simulation', () => {
    test('should simulate audio capture with correct buffer size', async () => {
      const mockSDR = {
        url: 'http://test.websdr.com',
        location: 'Test Location'
      };

      const mockConfig = {
        frequency: 14250000,
        mode: 'usb',
        bandwidth: 3000
      };

      const audioData = await agent.simulateAudioCapture(mockSDR, mockConfig);
      
      assert.ok(Buffer.isBuffer(audioData));
      
      // Expected buffer size: sampleRate * duration * 2 bytes per sample
      const expectedSize = agent.captureConfig.sampleRate * agent.captureConfig.duration * 2;
      assert.strictEqual(audioData.length, expectedSize);
    });

    test('should generate different noise patterns', async () => {
      const mockSDR = { url: 'http://test.com', location: 'Test' };
      const mockConfig = { frequency: 14250000 };

      const audio1 = await agent.simulateAudioCapture(mockSDR, mockConfig);
      const audio2 = await agent.simulateAudioCapture(mockSDR, mockConfig);
      
      // Should have different random content (very unlikely to be identical)
      assert.ok(!audio1.equals(audio2));
    });
  });

  describe('Frequency Capture Methods', () => {
    beforeEach(() => {
      // Mock file writing
      mockFs.writeFile.mock.mockImplementation(() => Promise.resolve());
    });

    test('should capture HF voice with correct configuration', async () => {
      const mockSDR = {
        url: 'http://test.websdr.com',
        location: 'Test Location',
        quality_score: 85
      };

      const result = await agent.captureHFVoice(mockSDR);
      
      assert.ok(result);
      assert.ok(result.id);
      assert.ok(result.filename);
      assert.ok(result.filepath);
      assert.strictEqual(result.config.frequency, 14250000);
      assert.strictEqual(result.config.mode, 'usb');
      assert.strictEqual(result.config.type, 'hf_voice');
      assert.strictEqual(result.config.bandwidth, 3000);
    });

    test('should capture broadcast with correct configuration', async () => {
      const mockSDR = {
        url: 'http://test.websdr.com',
        location: 'Test Location',
        quality_score: 85
      };

      const result = await agent.captureBroadcast(mockSDR);
      
      assert.ok(result);
      assert.strictEqual(result.config.frequency, 9500000);
      assert.strictEqual(result.config.mode, 'am');
      assert.strictEqual(result.config.type, 'broadcast');
      assert.strictEqual(result.config.bandwidth, 5000);
    });

    test('should capture CW with correct configuration', async () => {
      const mockSDR = {
        url: 'http://test.websdr.com',
        location: 'Test Location',
        quality_score: 85
      };

      const result = await agent.captureCW(mockSDR);
      
      assert.ok(result);
      assert.strictEqual(result.config.frequency, 14030000);
      assert.strictEqual(result.config.mode, 'cw');
      assert.strictEqual(result.config.type, 'cw_digital');
      assert.strictEqual(result.config.bandwidth, 500);
    });

    test('should capture utility stations with correct configuration', async () => {
      const mockSDR = {
        url: 'http://test.websdr.com',
        location: 'Test Location',
        quality_score: 85
      };

      const result = await agent.captureUtility(mockSDR);
      
      assert.ok(result);
      assert.strictEqual(result.config.frequency, 10000000);
      assert.strictEqual(result.config.mode, 'usb');
      assert.strictEqual(result.config.type, 'utility');
      assert.strictEqual(result.config.bandwidth, 3000);
    });
  });

  describe('Generic Frequency Capture', () => {
    beforeEach(() => {
      mockFs.writeFile.mock.mockImplementation(() => Promise.resolve());
    });

    test('should create proper file naming convention', async () => {
      const mockSDR = {
        url: 'http://test.websdr.com',
        location: 'Test Location, Netherlands',
        quality_score: 85
      };

      const mockConfig = {
        frequency: 14250000,
        mode: 'usb',
        type: 'hf_voice',
        bandwidth: 3000
      };

      const result = await agent.captureFrequency(mockSDR, mockConfig);
      
      assert.ok(result.filename.includes('hf_voice'));
      assert.ok(result.filename.includes('Test_Location__Netherlands'));
      assert.ok(result.filename.endsWith('.wav'));
      assert.ok(result.filepath.includes(agent.audioDir));
    });

    test('should include comprehensive metadata', async () => {
      const mockSDR = {
        url: 'http://test.websdr.com',
        location: 'Test Location',
        quality_score: 85
      };

      const mockConfig = {
        frequency: 14250000,
        mode: 'usb',
        type: 'hf_voice',
        bandwidth: 3000
      };

      const result = await agent.captureFrequency(mockSDR, mockConfig);
      
      assert.ok(result.metadata);
      assert.strictEqual(result.metadata.frequency, 14250000);
      assert.strictEqual(result.metadata.mode, 'usb');
      assert.strictEqual(result.metadata.bandwidth, 3000);
      assert.strictEqual(result.metadata.duration, agent.captureConfig.duration);
      assert.strictEqual(result.metadata.sampleRate, agent.captureConfig.sampleRate);
      assert.ok(result.metadata.timestamp);
      assert.ok(typeof result.metadata.quality_estimate === 'number');
    });

    test('should handle file write errors', async () => {
      mockFs.writeFile.mock.mockImplementationOnce(() => Promise.reject(new Error('Disk full')));

      const mockSDR = { url: 'http://test.com', location: 'Test', quality_score: 85 };
      const mockConfig = { frequency: 14250000, mode: 'usb', type: 'test' };

      try {
        await agent.captureFrequency(mockSDR, mockConfig);
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error.message.includes('Disk full'));
      }
    });
  });

  describe('FFmpeg Audio Processing', () => {
    test('should call FFmpeg with correct parameters', async () => {
      const mockProcess = {
        on: mock.fn((event, callback) => {
          if (event === 'close') {
            // Simulate successful completion
            setTimeout(() => callback(0), 10);
          }
        })
      };

      mockSpawn.mock.mockImplementationOnce(() => mockProcess);
      
      // Mock spawn globally
      const originalSpawn = spawn;
      global.spawn = mockSpawn;

      try {
        await agent.processWithFFmpeg('/input.wav', '/output.wav');
        
        assert.strictEqual(mockSpawn.mock.callCount(), 1);
        const call = mockSpawn.mock.calls[0];
        
        assert.strictEqual(call.arguments[0], 'ffmpeg');
        const args = call.arguments[1];
        assert.ok(args.includes('-i'));
        assert.ok(args.includes('/input.wav'));
        assert.ok(args.includes('-ar'));
        assert.ok(args.includes('16000'));
        assert.ok(args.includes('-ac'));
        assert.ok(args.includes('1'));
        assert.ok(args.includes('/output.wav'));
      } finally {
        global.spawn = originalSpawn;
      }
    });

    test('should handle FFmpeg process errors', async () => {
      const mockProcess = {
        on: mock.fn((event, callback) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('FFmpeg not found')), 10);
          }
        })
      };

      mockSpawn.mock.mockImplementationOnce(() => mockProcess);
      
      const originalSpawn = spawn;
      global.spawn = mockSpawn;

      try {
        await agent.processWithFFmpeg('/input.wav', '/output.wav');
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error.message.includes('FFmpeg'));
      } finally {
        global.spawn = originalSpawn;
      }
    });

    test('should handle FFmpeg exit codes', async () => {
      const mockProcess = {
        on: mock.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(1), 10); // Exit code 1 = error
          }
        })
      };

      mockSpawn.mock.mockImplementationOnce(() => mockProcess);
      
      const originalSpawn = spawn;
      global.spawn = mockSpawn;

      try {
        await agent.processWithFFmpeg('/input.wav', '/output.wav');
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error.message.includes('exited with code 1'));
      } finally {
        global.spawn = originalSpawn;
      }
    });
  });

  describe('Main Execute Method', () => {
    beforeEach(() => {
      // Mock memory operations
      memoryMock.waitFor.mock.mockImplementation((key) => {
        if (key === 'sdr_ready') {
          return Promise.resolve({ count: 3 });
        }
        return Promise.resolve(null);
      });

      memoryMock.query.mock.mockImplementation((key) => {
        if (key === 'active_sdrs') {
          return Promise.resolve([
            { url: 'http://sdr1.com', location: 'Location 1', quality_score: 90 },
            { url: 'http://sdr2.com', location: 'Location 2', quality_score: 85 },
            { url: 'http://sdr3.com', location: 'Location 3', quality_score: 80 }
          ]);
        }
        return Promise.resolve(null);
      });

      memoryMock.store.mock.mockImplementation(() => Promise.resolve());
      memoryMock.signal.mock.mockImplementation(() => Promise.resolve());

      // Mock file operations
      mockFs.writeFile.mock.mockImplementation(() => Promise.resolve());
    });

    test('should execute complete capture workflow', async () => {
      // Mock the capture methods to avoid actual file operations
      agent.captureHFVoice = mock.fn(() => Promise.resolve({
        id: 'test_hf_1',
        filename: 'test_hf.wav',
        filepath: '/test/hf.wav'
      }));
      
      agent.captureBroadcast = mock.fn(() => Promise.resolve({
        id: 'test_bc_1',
        filename: 'test_bc.wav',
        filepath: '/test/bc.wav'
      }));
      
      agent.captureCW = mock.fn(() => Promise.resolve({
        id: 'test_cw_1',
        filename: 'test_cw.wav',
        filepath: '/test/cw.wav'
      }));
      
      agent.captureUtility = mock.fn(() => Promise.resolve({
        id: 'test_util_1',
        filename: 'test_util.wav',
        filepath: '/test/util.wav'
      }));

      agent.processAudioFiles = mock.fn(() => Promise.resolve());

      const result = await agent.execute();
      
      assert.ok(Array.isArray(result));
      assert.ok(result.length > 0);
      
      // Verify memory operations
      assert.ok(memoryMock.waitFor.mock.callCount() > 0);
      assert.ok(memoryMock.query.mock.callCount() > 0);
      assert.ok(memoryMock.store.mock.callCount() > 0);
      assert.ok(memoryMock.signal.mock.callCount() > 0);
      
      // Verify capture methods were called
      assert.ok(agent.captureHFVoice.mock.callCount() > 0);
      assert.ok(agent.captureBroadcast.mock.callCount() > 0);
      assert.ok(agent.captureCW.mock.callCount() > 0);
      assert.ok(agent.captureUtility.mock.callCount() > 0);
    });

    test('should handle no available SDRs', async () => {
      memoryMock.query.mock.mockImplementation(() => Promise.resolve([]));

      try {
        await agent.execute();
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error.message.includes('No active SDRs available'));
      }
    });

    test('should handle SDR ready timeout', async () => {
      memoryMock.waitFor.mock.mockImplementation(() => Promise.reject(new Error('Timeout')));

      try {
        await agent.execute();
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error.message.includes('Timeout'));
      }
    });

    test('should handle partial capture failures gracefully', async () => {
      agent.captureHFVoice = mock.fn(() => Promise.resolve({ id: 'success_1' }));
      agent.captureBroadcast = mock.fn(() => Promise.reject(new Error('Capture failed')));
      agent.captureCW = mock.fn(() => Promise.resolve({ id: 'success_2' }));
      agent.captureUtility = mock.fn(() => Promise.resolve({ id: 'success_3' }));
      agent.processAudioFiles = mock.fn(() => Promise.resolve());

      const result = await agent.execute();
      
      assert.ok(Array.isArray(result));
      // Should have 3 successful captures out of 4 attempted per SDR
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle invalid SDR data gracefully', async () => {
      const invalidSDR = null;
      const validConfig = { frequency: 14250000, mode: 'usb', type: 'test' };

      try {
        await agent.captureFrequency(invalidSDR, validConfig);
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error instanceof TypeError);
      }
    });

    test('should sanitize filenames with special characters', async () => {
      mockFs.writeFile.mock.mockImplementation(() => Promise.resolve());

      const mockSDR = {
        url: 'http://test.com',
        location: 'Test/Location\\With:Special*Characters',
        quality_score: 85
      };

      const mockConfig = {
        frequency: 14250000,
        mode: 'usb',
        type: 'test',
        bandwidth: 3000
      };

      const result = await agent.captureFrequency(mockSDR, mockConfig);
      
      // Should not contain problematic characters
      assert.ok(!result.filename.includes('/'));
      assert.ok(!result.filename.includes('\\'));
      assert.ok(!result.filename.includes(':'));
      assert.ok(!result.filename.includes('*'));
    });

    test('should handle extremely long location names', async () => {
      mockFs.writeFile.mock.mockImplementation(() => Promise.resolve());

      const longLocation = 'A'.repeat(300); // Very long location name
      const mockSDR = {
        url: 'http://test.com',
        location: longLocation,
        quality_score: 85
      };

      const mockConfig = {
        frequency: 14250000,
        mode: 'usb',
        type: 'test',
        bandwidth: 3000
      };

      const result = await agent.captureFrequency(mockSDR, mockConfig);
      
      // Filename should still be reasonable length
      assert.ok(result.filename.length < 255); // Typical filesystem limit
    });
  });
});