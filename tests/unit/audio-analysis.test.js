/**
 * Unit Tests for Audio Analysis Agent
 * TDD approach with comprehensive mocking of analysis functions
 */

import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import AudioAnalysisAgent from '../../src/agents/audio-analysis.js';
import fs from 'fs/promises';

// Mock file system operations
const mockFs = {
  mkdir: mock.fn(),
  writeFile: mock.fn(),
  readFile: mock.fn(),
  access: mock.fn()
};

describe('AudioAnalysisAgent Unit Tests', () => {
  let agent;
  let memoryMock;

  beforeEach(() => {
    // Reset mocks
    mockFs.mkdir.mock.resetCalls();
    mockFs.writeFile.mock.resetCalls();
    mockFs.readFile.mock.resetCalls();
    
    // Create memory mock
    memoryMock = {
      waitFor: mock.fn(),
      query: mock.fn(),
      store: mock.fn(),
      signal: mock.fn()
    };
    
    agent = new AudioAnalysisAgent();
    agent.memory = memoryMock;
    
    // Mock file system methods
    Object.assign(fs, mockFs);
    
    // Mock the initializeAnalysisDir to prevent actual directory creation
    agent.initializeAnalysisDir = mock.fn(() => Promise.resolve());
  });

  afterEach(() => {
    mock.restoreAll();
  });

  describe('Initialization', () => {
    test('should initialize with correct default values', () => {
      assert.ok(agent.memory);
      assert.ok(agent.analysisDir);
      assert.ok(Array.isArray(agent.analysisResults));
      assert.strictEqual(agent.analysisResults.length, 0);
    });

    test('should create analysis directory on initialization', async () => {
      mockFs.mkdir.mock.mockImplementationOnce(() => Promise.resolve());
      
      await agent.initializeAnalysisDir();
      
      assert.strictEqual(mockFs.mkdir.mock.callCount(), 1);
      const call = mockFs.mkdir.mock.calls[0];
      assert.ok(call.arguments[0].includes('analysis'));
      assert.deepStrictEqual(call.arguments[1], { recursive: true });
    });

    test('should handle analysis directory creation errors gracefully', async () => {
      mockFs.mkdir.mock.mockImplementationOnce(() => Promise.reject(new Error('Permission denied')));
      
      // Should not throw
      await agent.initializeAnalysisDir();
      
      assert.strictEqual(mockFs.mkdir.mock.callCount(), 1);
    });
  });

  describe('Language Detection', () => {
    test('should detect English correctly', () => {
      const testCases = [
        'This is BBC World Service from London',
        'The weather forecast is for sunny skies',
        'Control tower, this is flight 123 requesting permission'
      ];

      testCases.forEach(text => {
        const result = agent.detectLanguage(text);
        assert.strictEqual(result, 'english', `Failed for: "${text}"`);
      });
    });

    test('should detect German correctly', () => {
      const testCases = [
        'Das ist Radio Deutschland aus Berlin',
        'Das Wetter ist heute sehr schön und sonnig',
        'Kontrolle, das ist Funkstation Charlie'
      ];

      testCases.forEach(text => {
        const result = agent.detectLanguage(text);
        assert.strictEqual(result, 'german', `Failed for: "${text}"`);
      });
    });

    test('should detect French correctly', () => {
      const testCases = [
        'Le temps est ensoleillé aujourd\'hui',
        'Controle de Paris, ici station Alpha'
      ];

      testCases.forEach(text => {
        const result = agent.detectLanguage(text);
        assert.strictEqual(result, 'french', `Failed for: "${text}"`);
      });
    });

    test('should detect Spanish correctly', () => {
      const testCases = [
        'El tiempo está soleado hoy',
        'Control de Madrid, aquí estación Bravo'
      ];

      testCases.forEach(text => {
        const result = agent.detectLanguage(text);
        assert.strictEqual(result, 'spanish', `Failed for: "${text}"`);
      });
    });

    test('should return unknown for unrecognized languages', () => {
      const testCases = [
        'Random gibberish text with no keywords',
        '12345 67890 numbers only',
        'ABCDEF GHIJKL random letters',
        ''
      ];

      testCases.forEach(text => {
        const result = agent.detectLanguage(text);
        assert.strictEqual(result, 'unknown', `Failed for: "${text}"`);
      });
    });

    test('should handle case insensitive detection', () => {
      const testCases = [
        'THE WEATHER IS SUNNY TODAY',
        'the weather is sunny today',
        'The Weather Is Sunny Today'
      ];

      testCases.forEach(text => {
        const result = agent.detectLanguage(text);
        assert.strictEqual(result, 'english', `Failed for: "${text}"`);
      });
    });
  });

  describe('Callsign Extraction', () => {
    test('should extract valid amateur radio callsigns', () => {
      const testCases = [
        {
          text: 'CQ CQ CQ de W1ABC W1ABC K',
          expected: ['W1ABC']
        },
        {
          text: 'G0XYZ de VK2DEF calling CQ and standing by',
          expected: ['G0XYZ', 'VK2DEF']
        },
        {
          text: 'This is DF1UVW calling JA1MNO over',
          expected: ['DF1UVW', 'JA1MNO']
        },
        {
          text: 'Station 9A1PQR working with F4RST',
          expected: ['9A1PQR', 'F4RST']
        }
      ];

      testCases.forEach(({ text, expected }) => {
        const result = agent.extractCallsigns(text);
        assert.ok(Array.isArray(result));
        expected.forEach(callsign => {
          assert.ok(result.includes(callsign), `Missing callsign ${callsign} from "${text}"`);
        });
      });
    });

    test('should filter out invalid callsign patterns', () => {
      const testCases = [
        'THE WEATHER IS NICE',
        'FREQUENCY 14.205 MHz',
        'SIGNAL REPORT 59',
        '12345 67890',
        'ABCDEFGHIJKLMNOP' // Too long
      ];

      testCases.forEach(text => {
        const result = agent.extractCallsigns(text);
        assert.ok(Array.isArray(result));
        // Should not extract non-callsign patterns
      });
    });

    test('should remove duplicate callsigns', () => {
      const text = 'W1ABC de W1ABC calling CQ, W1ABC standing by';
      const result = agent.extractCallsigns(text);
      
      assert.ok(Array.isArray(result));
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0], 'W1ABC');
    });

    test('should handle empty or null input', () => {
      assert.deepStrictEqual(agent.extractCallsigns(''), []);
      assert.deepStrictEqual(agent.extractCallsigns(null), []);
      assert.deepStrictEqual(agent.extractCallsigns(undefined), []);
    });
  });

  describe('Broadcast Station Extraction', () => {
    test('should extract known broadcast identifiers', () => {
      const testCases = [
        {
          text: 'This is BBC World Service broadcasting from London',
          expectedToInclude: 'BBC World Service'
        },
        {
          text: 'You are listening to Voice of America',
          expectedToInclude: 'Voice of America'
        },
        {
          text: 'Radio Free Europe news update',
          expectedToInclude: 'Radio Free Europe'
        },
        {
          text: 'Welcome to Radio Nederland broadcasting',
          expectedToInclude: 'Radio Nederland'
        }
      ];

      testCases.forEach(({ text, expectedToInclude }) => {
        const result = agent.extractBroadcastStations(text);
        assert.ok(Array.isArray(result));
        
        const found = result.some(station => 
          station.toLowerCase().includes(expectedToInclude.toLowerCase())
        );
        assert.ok(found, `Should find "${expectedToInclude}" in "${text}"`);
      });
    });

    test('should handle text without broadcast identifiers', () => {
      const testCases = [
        'Random amateur radio conversation',
        'Weather report with no station ID',
        'Technical discussion about antennas'
      ];

      testCases.forEach(text => {
        const result = agent.extractBroadcastStations(text);
        assert.ok(Array.isArray(result));
        // May or may not find stations, but should not crash
      });
    });
  });

  describe('Utility Station Extraction', () => {
    test('should extract utility station identifiers', () => {
      const testCases = [
        {
          text: 'Coast Guard Station Boston calling vessel in distress',
          expectedKeywords: ['coast guard']
        },
        {
          text: 'Airport Control requesting flight plan update',
          expectedKeywords: ['control', 'airport']
        },
        {
          text: 'Weather Service broadcasting marine forecast',
          expectedKeywords: ['weather']
        },
        {
          text: 'Maritime Mobile station checking in',
          expectedKeywords: ['maritime']
        }
      ];

      testCases.forEach(({ text, expectedKeywords }) => {
        const result = agent.extractUtilityStations(text);
        assert.ok(Array.isArray(result));
        
        expectedKeywords.forEach(keyword => {
          const found = result.some(station => 
            station.toLowerCase().includes(keyword.toLowerCase())
          );
          assert.ok(found, `Should find "${keyword}" related station in "${text}"`);
        });
      });
    });
  });

  describe('Confidence Calculation', () => {
    test('should calculate confidence based on analysis quality', () => {
      const testCases = [
        {
          results: {
            content_type: 'voice',
            language: 'english',
            transcription: 'This is a good quality transcription with plenty of content',
            stations: ['W1ABC', 'G0XYZ']
          },
          expectedMin: 50 + 20 + 15 + 10 + 15 // All bonuses
        },
        {
          results: {
            content_type: 'unknown',
            language: 'unknown',
            transcription: 'Short',
            stations: []
          },
          expectedMin: 50 // Just base confidence
        },
        {
          results: {
            content_type: 'cw',
            language: 'unknown',
            transcription: 'CQ CQ DE W1ABC K',
            stations: ['W1ABC']
          },
          expectedMin: 50 + 20 + 10 + 15 // content_type + transcription + stations
        }
      ];

      testCases.forEach(({ results, expectedMin }, index) => {
        const confidence = agent.calculateConfidence(results);
        assert.ok(typeof confidence === 'number', `Test ${index}: Should return number`);
        assert.ok(confidence >= 0 && confidence <= 100, `Test ${index}: Should be 0-100`);
        assert.ok(confidence >= expectedMin, `Test ${index}: Should be at least ${expectedMin}, got ${confidence}`);
      });
    });

    test('should cap confidence at 100', () => {
      const excellentResults = {
        content_type: 'voice',
        language: 'english', 
        transcription: 'Very long transcription with lots of meaningful content that should score high',
        stations: ['W1ABC', 'G0XYZ', 'DF1UVW', 'JA1MNO']
      };

      const confidence = agent.calculateConfidence(excellentResults);
      assert.ok(confidence <= 100);
    });
  });

  describe('TDD Test Methods', () => {
    test('should have all required test methods', () => {
      const requiredMethods = [
        'testAudioClassifier',
        'testLanguageDetector',
        'testTranscriptionAccuracy', 
        'testCWDecoder',
        'testDigitalModeDetection'
      ];

      requiredMethods.forEach(method => {
        assert.ok(typeof agent[method] === 'function', `Missing method: ${method}`);
      });
    });

    test('should run all test methods successfully', async () => {
      const testMethods = [
        'testAudioClassifier',
        'testLanguageDetector',
        'testTranscriptionAccuracy',
        'testCWDecoder', 
        'testDigitalModeDetection'
      ];

      for (const method of testMethods) {
        const result = await agent[method]();
        assert.strictEqual(result, true, `${method} should return true`);
      }
    });

    test('should run analysis tests workflow', async () => {
      // Should not throw and should complete
      await agent.runAnalysisTests();
      // Test passed if no exception thrown
      assert.ok(true);
    });
  });

  describe('Mock Analysis Functions', () => {
    test('should simulate speech to text conversion', async () => {
      const testFiles = [
        '/path/to/voice1.wav',
        '/path/to/voice2.wav',
        '/path/to/voice3.wav'
      ];

      const results = await Promise.all(
        testFiles.map(file => agent.speechToText(file))
      );

      results.forEach((result, index) => {
        assert.ok(typeof result === 'string', `Result ${index} should be string`);
        assert.ok(result.length > 0, `Result ${index} should not be empty`);
      });

      // Results should vary (very unlikely to be all identical)
      const uniqueResults = new Set(results);
      assert.ok(uniqueResults.size > 1 || results.length === 1, 'Should generate varied transcriptions');
    });

    test('should decode CW messages', async () => {
      const testFile = '/path/to/cw.wav';
      const result = await agent.decodeCW(testFile);
      
      assert.ok(typeof result === 'string');
      assert.ok(result.length > 0);
      // Should look like CW format
      assert.ok(result.includes('CQ') || result.includes('DE') || result.includes('K'));
    });

    test('should detect broadcast content', async () => {
      const testFile = '/path/to/broadcast.wav';
      const result = await agent.detectBroadcast(testFile);
      
      assert.ok(typeof result === 'boolean');
    });

    test('should detect digital modes', async () => {
      const testFile = '/path/to/digital.wav';
      const result = await agent.detectDigitalMode(testFile);
      
      // Should return a mode name or null
      if (result !== null) {
        assert.ok(typeof result === 'string');
        assert.ok(['psk31', 'ft8', 'rtty'].includes(result));
      }
    });

    test('should decode digital modes', async () => {
      const testFile = '/path/to/digital.wav';
      const mode = 'psk31';
      const result = await agent.decodeDigitalMode(testFile, mode);
      
      assert.ok(typeof result === 'string');
      assert.ok(result.includes(mode.toUpperCase()));
    });

    test('should detect utility types', async () => {
      const testFile = '/path/to/utility.wav';
      const result = await agent.detectUtilityType(testFile);
      
      if (result !== null) {
        assert.ok(typeof result === 'string');
        assert.ok(['voice', 'data', 'beacon', 'unknown'].includes(result));
      }
    });
  });

  describe('Sample Analysis by Type', () => {
    beforeEach(() => {
      mockFs.writeFile.mock.mockImplementation(() => Promise.resolve());
    });

    test('should analyze voice samples correctly', async () => {
      const mockSample = {
        id: 'voice_sample_1',
        filename: 'voice_test.wav',
        filepath: '/path/to/voice_test.wav',
        config: { type: 'hf_voice' },
        metadata: { quality_estimate: 85 }
      };

      const result = await agent.analyzeVoice(mockSample);
      
      assert.strictEqual(result.content_type, 'voice');
      assert.ok(result.transcription);
      assert.ok(result.language);
      assert.ok(Array.isArray(result.stations));
      assert.ok(typeof result.confidence === 'number');
      assert.ok(result.timestamp);
    });

    test('should analyze broadcast samples correctly', async () => {
      const mockSample = {
        id: 'broadcast_sample_1',
        filename: 'broadcast_test.wav',
        filepath: '/path/to/broadcast_test.wav',
        config: { type: 'broadcast' },
        metadata: { quality_estimate: 75 }
      };

      const result = await agent.analyzeBroadcast(mockSample);
      
      assert.ok(['broadcast', 'unknown'].includes(result.content_type));
      assert.ok(result.language);
      assert.ok(Array.isArray(result.stations));
      assert.ok(typeof result.confidence === 'number');
    });

    test('should analyze CW/digital samples correctly', async () => {
      const mockSample = {
        id: 'cw_sample_1',
        filename: 'cw_test.wav',
        filepath: '/path/to/cw_test.wav',
        config: { type: 'cw_digital' },
        metadata: { quality_estimate: 70 }
      };

      const result = await agent.analyzeCWDigital(mockSample);
      
      assert.ok(result.content_type);
      assert.ok(result.transcription !== undefined);
      assert.ok(Array.isArray(result.stations));
      assert.ok(typeof result.confidence === 'number');
    });

    test('should analyze utility samples correctly', async () => {
      const mockSample = {
        id: 'utility_sample_1',
        filename: 'utility_test.wav',
        filepath: '/path/to/utility_test.wav',
        config: { type: 'utility' },
        metadata: { quality_estimate: 80 }
      };

      const result = await agent.analyzeUtility(mockSample);
      
      assert.strictEqual(result.content_type, 'utility');
      assert.ok(result.language);
      assert.ok(Array.isArray(result.stations));
      assert.ok(typeof result.confidence === 'number');
    });

    test('should handle unknown sample types with generic analysis', async () => {
      const mockSample = {
        id: 'unknown_sample_1',
        filename: 'unknown_test.wav',
        filepath: '/path/to/unknown_test.wav',
        config: { type: 'unknown' },
        metadata: { quality_estimate: 60 }
      };

      const result = await agent.analyzeGeneric(mockSample);
      
      assert.strictEqual(result.content_type, 'unknown');
      assert.strictEqual(result.language, 'unknown');
      assert.strictEqual(result.transcription, '');
      assert.deepStrictEqual(result.stations, []);
      assert.ok(typeof result.confidence === 'number');
    });
  });

  describe('Main Execute Method', () => {
    beforeEach(() => {
      // Mock memory operations
      memoryMock.waitFor.mock.mockImplementation((key) => {
        if (key === 'capture_complete') {
          return Promise.resolve({ count: 5 });
        }
        return Promise.resolve(null);
      });

      memoryMock.query.mock.mockImplementation((key) => {
        if (key === 'audio_samples') {
          return Promise.resolve([
            {
              id: 'sample_1',
              filename: 'voice_sample.wav',
              filepath: '/path/to/voice_sample.wav',
              config: { type: 'hf_voice' },
              metadata: { quality_estimate: 85 }
            },
            {
              id: 'sample_2', 
              filename: 'cw_sample.wav',
              filepath: '/path/to/cw_sample.wav',
              config: { type: 'cw_digital' },
              metadata: { quality_estimate: 75 }
            }
          ]);
        }
        return Promise.resolve(null);
      });

      memoryMock.store.mock.mockImplementation(() => Promise.resolve());
      memoryMock.signal.mock.mockImplementation(() => Promise.resolve());
      mockFs.writeFile.mock.mockImplementation(() => Promise.resolve());
    });

    test('should execute complete analysis workflow', async () => {
      agent.runAnalysisTests = mock.fn(() => Promise.resolve());
      agent.analyzeSample = mock.fn((sample) => Promise.resolve({
        sample_id: sample.id,
        filename: sample.filename,
        analysis_results: {
          content_type: 'voice',
          language: 'english',
          confidence: 85
        }
      }));
      agent.validateResults = mock.fn(() => Promise.resolve());

      const result = await agent.execute();
      
      assert.ok(Array.isArray(result));
      assert.ok(result.length > 0);
      
      // Verify workflow steps
      assert.strictEqual(agent.runAnalysisTests.mock.callCount(), 1);
      assert.ok(agent.analyzeSample.mock.callCount() > 0);
      assert.strictEqual(agent.validateResults.mock.callCount(), 1);
      
      // Verify memory operations
      assert.ok(memoryMock.waitFor.mock.callCount() > 0);
      assert.ok(memoryMock.query.mock.callCount() > 0);
      assert.ok(memoryMock.store.mock.callCount() > 0);
      assert.ok(memoryMock.signal.mock.callCount() > 0);
    });

    test('should handle no available audio samples', async () => {
      memoryMock.query.mock.mockImplementation(() => Promise.resolve([]));

      try {
        await agent.execute();
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error.message.includes('No audio samples available'));
      }
    });

    test('should handle capture complete timeout', async () => {
      memoryMock.waitFor.mock.mockImplementation(() => Promise.reject(new Error('Timeout')));

      try {
        await agent.execute();
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error.message.includes('Timeout'));
      }
    });

    test('should handle partial analysis failures gracefully', async () => {
      agent.runAnalysisTests = mock.fn(() => Promise.resolve());
      agent.analyzeSample = mock.fn()
        .mockImplementationOnce(() => Promise.resolve({ sample_id: 'success_1' }))
        .mockImplementationOnce(() => Promise.reject(new Error('Analysis failed')));
      agent.validateResults = mock.fn(() => Promise.resolve());

      const result = await agent.execute();
      
      assert.ok(Array.isArray(result));
      assert.strictEqual(result.length, 1); // One successful analysis
    });
  });

  describe('Result Validation', () => {
    test('should validate analysis results and flag low confidence', async () => {
      agent.analysisResults = [
        {
          filename: 'good_quality.wav',
          analysis_results: { confidence: 85 }
        },
        {
          filename: 'poor_quality.wav',
          analysis_results: { confidence: 25 }
        },
        {
          filename: 'medium_quality.wav',
          analysis_results: { confidence: 60 }
        }
      ];

      // Should not throw
      await agent.validateResults();
      assert.ok(true);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle null or undefined input gracefully', () => {
      assert.strictEqual(agent.detectLanguage(null), 'unknown');
      assert.strictEqual(agent.detectLanguage(undefined), 'unknown');
      assert.deepStrictEqual(agent.extractCallsigns(null), []);
      assert.deepStrictEqual(agent.extractCallsigns(undefined), []);
    });

    test('should handle empty analysis results', () => {
      const emptyResults = {
        content_type: '',
        language: '',
        transcription: '',
        stations: []
      };

      const confidence = agent.calculateConfidence(emptyResults);
      assert.ok(typeof confidence === 'number');
      assert.ok(confidence >= 0 && confidence <= 100);
    });

    test('should handle file writing errors in analysis', async () => {
      mockFs.writeFile.mock.mockImplementationOnce(() => Promise.reject(new Error('Disk full')));

      const mockSample = {
        id: 'test_sample',
        filename: 'test.wav',
        filepath: '/path/to/test.wav',
        config: { type: 'hf_voice' },
        metadata: { quality_estimate: 75 }
      };

      // Mock the AI analysis service to prevent undefined access
      agent.aiAnalysis = {
        analyzeAudio: mock.fn(() => Promise.reject(new Error('AI service unavailable')))
      };

      // Should complete analysis even if file writing fails
      const result = await agent.analyzeSample(mockSample);
      assert.ok(result);
      assert.strictEqual(result.sample_id, 'test_sample');
      assert.ok(result.analysis_results.error);
    });
  });
});