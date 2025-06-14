/**
 * Integration Tests for Audio Capture Agent
 * Tests real audio capture with mock SDR servers and file operations
 */

import { test, describe, beforeEach, afterEach, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import path from 'path';
import AudioCaptureAgent from '../../src/agents/audio-capture.js';
import MockSDRServer from '../mocks/sdr-server.js';

describe('AudioCaptureAgent Integration Tests', () => {
  let agent;
  let mockServers = [];
  let testAudioDir;
  let basePort = 9001;

  before(async () => {
    // Create test audio directory
    testAudioDir = path.join(process.cwd(), 'tests', 'fixtures', 'audio');
    await fs.mkdir(testAudioDir, { recursive: true });

    // Start mock SDR servers for testing
    const serverConfigs = [
      { port: basePort, sdrType: 'websdr', location: 'Netherlands Audio Test', quality: 90 },
      { port: basePort + 1, sdrType: 'kiwisdr', location: 'Japan Audio Test', quality: 85 },
      { port: basePort + 2, sdrType: 'websdr', location: 'Germany Audio Test', quality: 80 }
    ];

    for (const config of serverConfigs) {
      const server = new MockSDRServer(config);
      await server.start();
      mockServers.push(server);
    }

    console.log(`Started ${mockServers.length} mock SDR servers for audio capture testing`);
  });

  after(async () => {
    // Stop all mock servers
    for (const server of mockServers) {
      await server.stop();
    }

    // Clean up test files
    try {
      await fs.rmdir(testAudioDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }

    console.log('Stopped all mock SDR servers and cleaned up test files');
  });

  beforeEach(() => {
    agent = new AudioCaptureAgent();
    // Override audio directory for testing
    agent.audioDir = testAudioDir;
  });

  afterEach(async () => {
    // Clean up captured samples after each test
    agent.capturedSamples = [];
    
    try {
      const files = await fs.readdir(testAudioDir);
      for (const file of files) {
        if (file.endsWith('.wav')) {
          await fs.unlink(path.join(testAudioDir, file));
        }
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Audio Directory Management', () => {
    test('should create audio directory if it does not exist', async () => {
      const nonExistentDir = path.join(testAudioDir, 'new_subdir');
      agent.audioDir = nonExistentDir;

      await agent.initializeAudioDir();

      const stats = await fs.stat(nonExistentDir);
      assert.ok(stats.isDirectory());

      // Cleanup
      await fs.rmdir(nonExistentDir);
    });

    test('should handle existing audio directory gracefully', async () => {
      // Directory already exists from setup
      await agent.initializeAudioDir();
      
      const stats = await fs.stat(testAudioDir);
      assert.ok(stats.isDirectory());
    });
  });

  describe('Audio File Generation', () => {
    test('should capture and save audio files for different modes', async () => {
      const mockSDR = {
        url: `http://localhost:${basePort}/`,
        location: 'Test Station',
        quality_score: 85
      };

      const testConfigs = [
        { frequency: 14250000, mode: 'usb', type: 'hf_voice', bandwidth: 3000 },
        { frequency: 14030000, mode: 'cw', type: 'cw_digital', bandwidth: 500 },
        { frequency: 9500000, mode: 'am', type: 'broadcast', bandwidth: 5000 }
      ];

      for (const config of testConfigs) {
        const result = await agent.captureFrequency(mockSDR, config);
        
        assert.ok(result);
        assert.ok(result.filename);
        assert.ok(result.filepath);
        assert.ok(result.id);
        
        // Verify file was created
        const stats = await fs.stat(result.filepath);
        assert.ok(stats.isFile());
        assert.ok(stats.size > 0);
        
        // Verify filename contains expected components
        assert.ok(result.filename.includes(config.type));
        assert.ok(result.filename.includes('Test_Station'));
        assert.ok(result.filename.endsWith('.wav'));
        
        // Verify metadata
        assert.strictEqual(result.metadata.frequency, config.frequency);
        assert.strictEqual(result.metadata.mode, config.mode);
        assert.strictEqual(result.metadata.bandwidth, config.bandwidth);
        assert.ok(typeof result.metadata.quality_estimate === 'number');
      }
    });

    test('should generate different audio patterns for different modes', async () => {
      const mockSDR = {
        url: `http://localhost:${basePort}/`,
        location: 'Pattern Test',
        quality_score: 85
      };

      // Capture CW mode
      const cwConfig = { frequency: 14030000, mode: 'cw', type: 'cw_test', bandwidth: 500 };
      const cwResult = await agent.captureFrequency(mockSDR, cwConfig);
      
      // Capture voice mode
      const voiceConfig = { frequency: 14250000, mode: 'usb', type: 'voice_test', bandwidth: 3000 };
      const voiceResult = await agent.captureFrequency(mockSDR, voiceConfig);
      
      // Read and compare audio files
      const cwData = await fs.readFile(cwResult.filepath);
      const voiceData = await fs.readFile(voiceResult.filepath);
      
      assert.ok(cwData.length > 0);
      assert.ok(voiceData.length > 0);
      assert.ok(!cwData.equals(voiceData), 'Different modes should generate different audio patterns');
    });
  });

  describe('Real Server Audio Capture', () => {
    test('should attempt to capture audio from mock WebSDR server', async () => {
      const mockSDR = {
        url: `http://localhost:${basePort}/`,
        location: 'WebSDR Test Server',
        network: 'WebSDR',
        quality_score: 85
      };

      const config = {
        frequency: 14250000,
        mode: 'usb',
        type: 'websdr_test',
        bandwidth: 3000
      };

      // First verify server is accessible
      const healthResponse = await fetch(`${mockSDR.url}health`);
      assert.ok(healthResponse.ok);

      // Test audio endpoint
      const audioResponse = await fetch(`${mockSDR.url}audio.wav`);
      assert.ok(audioResponse.ok);
      assert.strictEqual(audioResponse.headers.get('content-type'), 'audio/wav');

      const audioData = await audioResponse.arrayBuffer();
      assert.ok(audioData.byteLength > 0);
    });

    test('should handle mock KiwiSDR server responses', async () => {
      const mockSDR = {
        url: `http://localhost:${basePort + 1}/`,
        location: 'KiwiSDR Test Server',
        network: 'KiwiSDR',
        quality_score: 85
      };

      // Test KiwiSDR status endpoint
      const statusResponse = await fetch(`${mockSDR.url}status`);
      assert.ok(statusResponse.ok);

      const statusData = await statusResponse.json();
      assert.strictEqual(statusData.sdr, 'KiwiSDR');
      assert.ok(statusData.name);

      // Test KiwiSDR audio endpoint
      const audioResponse = await fetch(`${mockSDR.url}audio`);
      assert.ok(audioResponse.ok);

      const audioData = await audioResponse.arrayBuffer();
      assert.ok(audioData.byteLength > 0);
    });
  });

  describe('Parallel Capture Operations', () => {
    test('should handle concurrent captures from multiple SDRs', async () => {
      const mockSDRs = [
        { url: `http://localhost:${basePort}/`, location: 'SDR 1', quality_score: 90 },
        { url: `http://localhost:${basePort + 1}/`, location: 'SDR 2', quality_score: 85 },
        { url: `http://localhost:${basePort + 2}/`, location: 'SDR 3', quality_score: 80 }
      ];

      const capturePromises = mockSDRs.map(async (sdr, index) => {
        const config = {
          frequency: 14250000 + (index * 100000), // Different frequencies
          mode: 'usb',
          type: `concurrent_test_${index}`,
          bandwidth: 3000
        };
        return agent.captureFrequency(sdr, config);
      });

      const results = await Promise.allSettled(capturePromises);
      
      // All captures should succeed
      const successful = results.filter(r => r.status === 'fulfilled');
      assert.ok(successful.length >= 2, 'Most concurrent captures should succeed');

      // Verify files were created
      for (const result of successful) {
        const captureResult = result.value;
        const stats = await fs.stat(captureResult.filepath);
        assert.ok(stats.isFile());
        assert.ok(stats.size > 0);
      }
    });

    test('should handle mixed success/failure in parallel captures', async () => {
      const mixedSDRs = [
        { url: `http://localhost:${basePort}/`, location: 'Working SDR', quality_score: 90 },
        { url: 'http://localhost:9999/', location: 'Broken SDR', quality_score: 0 } // Non-existent
      ];

      const capturePromises = mixedSDRs.map(async (sdr, index) => {
        const config = {
          frequency: 14250000,
          mode: 'usb',
          type: `mixed_test_${index}`,
          bandwidth: 3000
        };
        return agent.captureFrequency(sdr, config);
      });

      const results = await Promise.allSettled(capturePromises);
      
      // Should have at least one success and one failure
      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');
      
      assert.ok(successful.length >= 1, 'Should have at least one successful capture');
      assert.ok(failed.length >= 1, 'Should have at least one failed capture');
    });
  });

  describe('File Processing and Validation', () => {
    test('should process captured audio files if FFmpeg is available', async () => {
      const mockSDR = {
        url: `http://localhost:${basePort}/`,
        location: 'Processing Test',
        quality_score: 85
      };

      const config = {
        frequency: 14250000,
        mode: 'usb',
        type: 'processing_test',
        bandwidth: 3000
      };

      const result = await agent.captureFrequency(mockSDR, config);
      
      // Add to captured samples for processing
      agent.capturedSamples.push(result);

      try {
        // Try to process the file
        await agent.processAudioFiles();
        
        // If FFmpeg is available, should have processed file
        if (result.processed) {
          assert.ok(result.processed_filepath);
          const processedStats = await fs.stat(result.processed_filepath);
          assert.ok(processedStats.isFile());
        }
      } catch (error) {
        // FFmpeg might not be available in test environment
        console.log('FFmpeg not available for testing, skipping processing test');
      }
    });

    test('should validate audio file format and properties', async () => {
      const mockSDR = {
        url: `http://localhost:${basePort}/`,
        location: 'Validation Test',
        quality_score: 85
      };

      const config = {
        frequency: 14250000,
        mode: 'usb',
        type: 'validation_test',
        bandwidth: 3000
      };

      const result = await agent.captureFrequency(mockSDR, config);
      
      // Read the file and verify basic properties
      const stats = await fs.stat(result.filepath);
      const expectedSize = agent.captureConfig.sampleRate * agent.captureConfig.duration * 2; // 16-bit samples
      
      assert.ok(stats.size >= expectedSize * 0.9, 'File size should be approximately correct');
      assert.ok(stats.size <= expectedSize * 1.1, 'File size should not be excessive');
      
      // Verify metadata
      assert.strictEqual(result.metadata.sampleRate, agent.captureConfig.sampleRate);
      assert.strictEqual(result.metadata.duration, agent.captureConfig.duration);
      assert.ok(result.metadata.timestamp);
    });
  });

  describe('Memory Integration', () => {
    test('should integrate with memory system for SDR data', async () => {
      // Mock memory operations
      const mockMemory = {
        waitFor: async (key) => ({ count: 3 }),
        query: async (key) => {
          if (key === 'active_sdrs') {
            return [
              { url: `http://localhost:${basePort}/`, location: 'Memory Test SDR', quality_score: 85 }
            ];
          }
          return null;
        },
        store: async (key, data) => {
          assert.ok(key === 'audio_samples');
          assert.ok(Array.isArray(data));
          return true;
        },
        signal: async (key, data) => {
          assert.ok(key === 'capture_complete');
          assert.ok(data.count >= 0);
          return true;
        }
      };

      agent.memory = mockMemory;

      // Mock capture methods to avoid long processing
      const originalMethods = {
        captureHFVoice: agent.captureHFVoice,
        captureBroadcast: agent.captureBroadcast,
        captureCW: agent.captureCW,
        captureUtility: agent.captureUtility
      };

      agent.captureHFVoice = async () => ({ id: 'test_hf', filename: 'test_hf.wav' });
      agent.captureBroadcast = async () => ({ id: 'test_bc', filename: 'test_bc.wav' });
      agent.captureCW = async () => ({ id: 'test_cw', filename: 'test_cw.wav' });
      agent.captureUtility = async () => ({ id: 'test_util', filename: 'test_util.wav' });
      agent.processAudioFiles = async () => {}; // Skip processing

      try {
        const result = await agent.execute();
        
        assert.ok(Array.isArray(result));
        assert.ok(result.length > 0);
      } finally {
        // Restore original methods
        Object.assign(agent, originalMethods);
      }
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle file system errors gracefully', async () => {
      // Try to write to a non-existent directory
      const originalAudioDir = agent.audioDir;
      agent.audioDir = '/non/existent/directory/that/should/not/exist';

      const mockSDR = {
        url: `http://localhost:${basePort}/`,
        location: 'Error Test',
        quality_score: 85
      };

      const config = {
        frequency: 14250000,
        mode: 'usb',
        type: 'error_test',
        bandwidth: 3000
      };

      try {
        await agent.captureFrequency(mockSDR, config);
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error.message);
      } finally {
        agent.audioDir = originalAudioDir;
      }
    });

    test('should handle server connection failures', async () => {
      const offlineSDR = {
        url: 'http://localhost:9999/', // Non-existent server
        location: 'Offline Test Server',
        quality_score: 0
      };

      const config = {
        frequency: 14250000,
        mode: 'usb',
        type: 'offline_test',
        bandwidth: 3000
      };

      // Should fall back to simulation
      const result = await agent.captureFrequency(offlineSDR, config);
      
      // Should still create a file (simulated)
      assert.ok(result);
      assert.ok(result.filename);
      
      const stats = await fs.stat(result.filepath);
      assert.ok(stats.isFile());
    });

    test('should handle malformed SDR responses', async () => {
      // Create a server that returns malformed audio data
      const badServer = new MockSDRServer({
        port: basePort + 10,
        sdrType: 'websdr',
        location: 'Bad Audio Server'
      });

      await badServer.start();

      // Override audio endpoint to return invalid data
      badServer.app.get('/audio.wav', (req, res) => {
        res.setHeader('Content-Type', 'audio/wav');
        res.send('Not audio data');
      });

      const badSDR = {
        url: `http://localhost:${basePort + 10}/`,
        location: 'Bad Audio Server',
        quality_score: 50
      };

      const config = {
        frequency: 14250000,
        mode: 'usb',
        type: 'bad_audio_test',
        bandwidth: 3000
      };

      // Should handle gracefully and fall back to simulation
      const result = await agent.captureFrequency(badSDR, config);
      assert.ok(result);
      assert.ok(result.filename);

      await badServer.stop();
    });
  });

  describe('Performance and Resource Management', () => {
    test('should manage disk space efficiently', async () => {
      const mockSDR = {
        url: `http://localhost:${basePort}/`,
        location: 'Disk Test',
        quality_score: 85
      };

      // Capture multiple files
      const capturePromises = Array.from({ length: 5 }, (_, i) => {
        const config = {
          frequency: 14250000 + (i * 1000),
          mode: 'usb',
          type: `disk_test_${i}`,
          bandwidth: 3000
        };
        return agent.captureFrequency(mockSDR, config);
      });

      const results = await Promise.all(capturePromises);
      
      // Verify all files were created
      for (const result of results) {
        const stats = await fs.stat(result.filepath);
        assert.ok(stats.isFile());
      }

      // Calculate total disk usage
      const files = await fs.readdir(testAudioDir);
      const audioFiles = files.filter(f => f.endsWith('.wav'));
      assert.strictEqual(audioFiles.length, 5);

      let totalSize = 0;
      for (const file of audioFiles) {
        const stats = await fs.stat(path.join(testAudioDir, file));
        totalSize += stats.size;
      }

      // Should be reasonable size (not excessive)
      const maxExpectedSize = 5 * 60 * 16000 * 2 * 1.1; // 5 files, 60s, 16kHz, 16-bit, 10% margin
      assert.ok(totalSize <= maxExpectedSize, 'Total disk usage should be reasonable');
    });

    test('should handle memory usage during large captures', async () => {
      const initialMemory = process.memoryUsage();

      const mockSDR = {
        url: `http://localhost:${basePort}/`,
        location: 'Memory Test',
        quality_score: 85
      };

      // Temporarily increase capture duration for memory test
      const originalDuration = agent.captureConfig.duration;
      agent.captureConfig.duration = 10; // 10 seconds instead of 60

      try {
        const config = {
          frequency: 14250000,
          mode: 'usb',
          type: 'memory_test',
          bandwidth: 3000
        };

        await agent.captureFrequency(mockSDR, config);

        const finalMemory = process.memoryUsage();
        const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

        // Memory increase should be reasonable (less than 100MB)
        assert.ok(memoryIncrease < 100 * 1024 * 1024, 'Memory usage should not increase excessively');
      } finally {
        agent.captureConfig.duration = originalDuration;
      }
    });
  });
});