/**
 * Unit Tests for Report Generator Agent
 * TDD approach with comprehensive mocking of report generation functions
 */

import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import ReportGeneratorAgent from '../../src/agents/report-generator.js';
import fs from 'fs/promises';
import express from 'express';

// Mock file system operations
const mockFs = {
  mkdir: mock.fn(),
  writeFile: mock.fn(),
  readFile: mock.fn(),
  access: mock.fn()
};

// Mock express
const mockExpress = mock.fn();
const mockApp = {
  use: mock.fn(),
  get: mock.fn(),
  listen: mock.fn()
};

describe('ReportGeneratorAgent Unit Tests', () => {
  let agent;
  let memoryMock;

  beforeEach(() => {
    // Reset mocks
    mockFs.mkdir.mock.resetCalls();
    mockFs.writeFile.mock.resetCalls();
    mockExpress.mock.resetCalls();
    mockApp.use.mock.resetCalls();
    mockApp.get.mock.resetCalls();
    mockApp.listen.mock.resetCalls();
    
    // Create memory mock
    memoryMock = {
      waitFor: mock.fn(),
      query: mock.fn(),
      store: mock.fn(),
      signal: mock.fn()
    };
    
    agent = new ReportGeneratorAgent();
    agent.memory = memoryMock;
    
    // Mock file system methods
    Object.assign(fs, mockFs);
    
    // Mock the initializeReportsDir to prevent actual directory creation
    agent.initializeReportsDir = mock.fn(() => Promise.resolve());
    
    // Mock express
    global.express = () => mockApp;
    mockApp.static = mock.fn();
  });

  afterEach(() => {
    mock.restoreAll();
    // Cleanup server if running
    if (agent.server) {
      agent.server = null;
    }
  });

  describe('Initialization', () => {
    test('should initialize with correct default values', () => {
      assert.ok(agent.memory);
      assert.ok(agent.reportsDir);
      assert.ok(agent.reportData);
      assert.ok(agent.reportData.summary);
      assert.ok(agent.reportData.coverage);
      assert.ok(agent.reportData.analysis);
      assert.ok(Array.isArray(agent.reportData.audioSamples));
      assert.strictEqual(agent.server, null);
    });

    test('should create reports directory on initialization', async () => {
      mockFs.mkdir.mock.mockImplementationOnce(() => Promise.resolve());
      
      await agent.initializeReportsDir();
      
      assert.strictEqual(mockFs.mkdir.mock.callCount(), 1);
      const call = mockFs.mkdir.mock.calls[0];
      assert.ok(call.arguments[0].includes('reports'));
      assert.deepStrictEqual(call.arguments[1], { recursive: true });
    });

    test('should handle reports directory creation errors gracefully', async () => {
      mockFs.mkdir.mock.mockImplementationOnce(() => Promise.reject(new Error('Permission denied')));
      
      // Should not throw
      await agent.initializeReportsDir();
      
      assert.strictEqual(mockFs.mkdir.mock.callCount(), 1);
    });
  });

  describe('Executive Summary Generation', () => {
    test('should generate comprehensive executive summary', () => {
      const mockSDRs = [
        { location: 'Netherlands', quality_score: 85, network: 'WebSDR' },
        { location: 'Germany', quality_score: 90, network: 'KiwiSDR' },
        { location: 'France', quality_score: 75, network: 'WebSDR' }
      ];

      const mockSamples = [
        { id: 'sample1', metadata: { quality_estimate: 80 } },
        { id: 'sample2', metadata: { quality_estimate: 85 } },
        { id: 'sample3', metadata: { quality_estimate: 75 } }
      ];

      const mockAnalyses = [
        { 
          analysis_results: { 
            language: 'english', 
            stations: ['W1ABC', 'G0XYZ'],
            confidence: 85,
            content_type: 'voice'
          }
        },
        {
          analysis_results: {
            language: 'german',
            stations: ['DF1UVW'],
            confidence: 75,
            content_type: 'cw'
          }
        },
        {
          analysis_results: {
            language: 'unknown',
            stations: [],
            confidence: 40,
            content_type: 'unknown'
          }
        }
      ];

      const summary = agent.generateExecutiveSummary(mockSDRs, mockSamples, mockAnalyses);
      
      // Check basic counts
      assert.strictEqual(summary.totalSDRs, 3);
      assert.strictEqual(summary.totalSamples, 3);
      assert.strictEqual(summary.totalAnalyses, 3);
      
      // Check arrays
      assert.ok(Array.isArray(summary.keyFindings));
      assert.ok(summary.keyFindings.length > 0);
      assert.ok(Array.isArray(summary.notableActivity));
      assert.ok(Array.isArray(summary.coverageAreas));
      assert.ok(Array.isArray(summary.detectedLanguages));
      
      // Check derived values
      assert.strictEqual(summary.coverageAreas.length, 3);
      assert.ok(summary.detectedLanguages.includes('english'));
      assert.ok(summary.detectedLanguages.includes('german'));
      assert.ok(!summary.detectedLanguages.includes('unknown'));
      assert.strictEqual(summary.stationCount, 3); // W1ABC, G0XYZ, DF1UVW
      assert.ok(typeof summary.qualityScore === 'number');
      
      // Check notable activity (confidence > 70)
      assert.strictEqual(summary.notableActivity.length, 2); // Two high-confidence analyses
    });

    test('should handle empty data gracefully', () => {
      const summary = agent.generateExecutiveSummary([], [], []);
      
      assert.strictEqual(summary.totalSDRs, 0);
      assert.strictEqual(summary.totalSamples, 0);
      assert.strictEqual(summary.totalAnalyses, 0);
      assert.strictEqual(summary.coverageAreas.length, 0);
      assert.strictEqual(summary.detectedLanguages.length, 0);
      assert.strictEqual(summary.stationCount, 0);
      assert.ok(Array.isArray(summary.keyFindings));
      assert.ok(Array.isArray(summary.notableActivity));
    });

    test('should filter out unknown languages', () => {
      const mockAnalyses = [
        { analysis_results: { language: 'english' } },
        { analysis_results: { language: 'unknown' } },
        { analysis_results: { language: 'german' } },
        { analysis_results: { language: null } },
        { analysis_results: { language: undefined } }
      ];

      const summary = agent.generateExecutiveSummary([], [], mockAnalyses);
      
      assert.strictEqual(summary.detectedLanguages.length, 2);
      assert.ok(summary.detectedLanguages.includes('english'));
      assert.ok(summary.detectedLanguages.includes('german'));
      assert.ok(!summary.detectedLanguages.includes('unknown'));
    });
  });

  describe('Coverage Map Generation', () => {
    test('should generate coverage map with regional grouping', () => {
      const mockSDRs = [
        { location: 'University of Twente, Netherlands', network: 'WebSDR', quality_score: 85 },
        { location: 'Berlin, Germany', network: 'KiwiSDR', quality_score: 90 },
        { location: 'Paris, France', network: 'WebSDR', quality_score: 75 },
        { location: 'Tokyo, Japan', network: 'OpenWebRX', quality_score: 80 },
        { location: 'New York, USA', network: 'WebSDR', quality_score: 70 }
      ];

      const coverage = agent.generateCoverageMap(mockSDRs);
      
      assert.strictEqual(coverage.totalLocations, 5);
      assert.ok(coverage.regions);
      assert.ok(coverage.networkDistribution);
      assert.ok(coverage.qualityDistribution);
      
      // Check regional grouping
      assert.ok(coverage.regions['Europe']);
      assert.ok(coverage.regions['Asia']);
      assert.ok(coverage.regions['North America']);
      
      // Check network distribution
      assert.strictEqual(coverage.networkDistribution.WebSDR, 3);
      assert.strictEqual(coverage.networkDistribution.KiwiSDR, 1);
      assert.strictEqual(coverage.networkDistribution.OpenWebRX, 1);
      
      // Check quality distribution
      assert.ok(coverage.qualityDistribution.Good > 0);
      assert.ok(coverage.qualityDistribution.Excellent > 0);
    });

    test('should handle SDRs with no clear region', () => {
      const mockSDRs = [
        { location: 'Unknown Location', network: 'WebSDR', quality_score: 85 },
        { location: 'Remote Station', network: 'KiwiSDR', quality_score: 70 }
      ];

      const coverage = agent.generateCoverageMap(mockSDRs);
      
      assert.ok(coverage.regions['Other']);
      assert.strictEqual(coverage.regions['Other'].length, 2);
    });
  });

  describe('Analysis Summary Generation', () => {
    test('should generate comprehensive analysis summary', () => {
      const mockAnalyses = [
        {
          analysis_results: {
            content_type: 'voice',
            language: 'english',
            confidence: 85,
            stations: ['W1ABC', 'G0XYZ']
          }
        },
        {
          analysis_results: {
            content_type: 'voice',
            language: 'english',
            confidence: 90,
            stations: ['DF1UVW']
          }
        },
        {
          analysis_results: {
            content_type: 'cw',
            language: 'unknown',
            confidence: 75,
            stations: ['JA1MNO']
          }
        },
        {
          analysis_results: {
            content_type: 'broadcast',
            language: 'german',
            confidence: 60,
            stations: []
          }
        }
      ];

      const summary = agent.generateAnalysisSummary(mockAnalyses);
      
      // Check content type distribution
      assert.strictEqual(summary.contentTypes.voice, 2);
      assert.strictEqual(summary.contentTypes.cw, 1);
      assert.strictEqual(summary.contentTypes.broadcast, 1);
      
      // Check language distribution (excluding unknown)
      assert.strictEqual(summary.languages.english, 2);
      assert.strictEqual(summary.languages.german, 1);
      assert.ok(!summary.languages.unknown);
      
      // Check average confidence
      assert.strictEqual(summary.averageConfidence, 78); // (85+90+75+60)/4 = 77.5, rounded to 78
      
      // Check stations by type
      assert.ok(Array.isArray(summary.stationsByType.voice));
      assert.ok(Array.isArray(summary.stationsByType.cw));
      assert.strictEqual(summary.stationsByType.voice.length, 3); // W1ABC, G0XYZ, DF1UVW
      assert.strictEqual(summary.stationsByType.cw.length, 1); // JA1MNO
    });

    test('should handle analyses with no confidence values', () => {
      const mockAnalyses = [
        { analysis_results: { content_type: 'voice', confidence: 0 } },
        { analysis_results: { content_type: 'cw', confidence: null } },
        { analysis_results: { content_type: 'broadcast' } } // No confidence field
      ];

      const summary = agent.generateAnalysisSummary(mockAnalyses);
      
      assert.strictEqual(summary.averageConfidence, 0);
    });

    test('should handle empty stations arrays', () => {
      const mockAnalyses = [
        { analysis_results: { content_type: 'voice', stations: [] } },
        { analysis_results: { content_type: 'cw', stations: null } },
        { analysis_results: { content_type: 'broadcast' } } // No stations field
      ];

      const summary = agent.generateAnalysisSummary(mockAnalyses);
      
      assert.ok(typeof summary.stationsByType === 'object');
    });
  });

  describe('Audio Samples Preparation', () => {
    test('should prepare audio samples with analysis data', () => {
      const mockSamples = [
        {
          id: 'sample1',
          filename: 'voice_sample.wav',
          sdr: { location: 'Netherlands' },
          config: { frequency: 14250000, type: 'hf_voice' },
          metadata: { duration: 60, quality_estimate: 85 },
          processed: true
        },
        {
          id: 'sample2',
          filename: 'cw_sample.wav',
          sdr: { location: 'Germany' },
          config: { frequency: 14030000, type: 'cw_digital' },
          metadata: { duration: 30, quality_estimate: 75 },
          processed: false
        }
      ];

      const mockAnalyses = [
        {
          sample_id: 'sample1',
          analysis_results: {
            content_type: 'voice',
            language: 'english',
            confidence: 85
          }
        }
      ];

      const prepared = agent.prepareAudioSamples(mockSamples, mockAnalyses);
      
      assert.ok(Array.isArray(prepared));
      assert.strictEqual(prepared.length, 2);
      
      // Check first sample with analysis
      const sample1 = prepared.find(s => s.id === 'sample1');
      assert.ok(sample1);
      assert.strictEqual(sample1.sdr, 'Netherlands');
      assert.strictEqual(sample1.frequency, 14250000);
      assert.strictEqual(sample1.type, 'hf_voice');
      assert.strictEqual(sample1.quality, 85);
      assert.strictEqual(sample1.playable, true);
      assert.ok(sample1.analysis);
      assert.strictEqual(sample1.analysis.content_type, 'voice');
      
      // Check second sample without analysis
      const sample2 = prepared.find(s => s.id === 'sample2');
      assert.ok(sample2);
      assert.strictEqual(sample2.sdr, 'Germany');
      assert.strictEqual(sample2.analysis, null);
      assert.strictEqual(sample2.playable, false);
    });

    test('should handle samples with missing SDR data', () => {
      const mockSamples = [
        {
          id: 'sample1',
          filename: 'test.wav',
          config: { frequency: 14250000, type: 'test' },
          metadata: { quality_estimate: 75 }
        }
      ];

      const prepared = agent.prepareAudioSamples(mockSamples, []);
      
      assert.strictEqual(prepared.length, 1);
      assert.strictEqual(prepared[0].sdr, 'Unknown');
    });

    test('should limit to top 10 samples', () => {
      const mockSamples = Array.from({ length: 15 }, (_, i) => ({
        id: `sample${i}`,
        filename: `sample${i}.wav`,
        config: { frequency: 14250000, type: 'test' },
        metadata: { quality_estimate: 75 }
      }));

      const prepared = agent.prepareAudioSamples(mockSamples, []);
      
      assert.strictEqual(prepared.length, 10);
    });
  });

  describe('Helper Methods', () => {
    test('should count unique stations correctly', () => {
      const mockAnalyses = [
        { analysis_results: { stations: ['W1ABC', 'G0XYZ'] } },
        { analysis_results: { stations: ['W1ABC', 'DF1UVW'] } }, // W1ABC is duplicate
        { analysis_results: { stations: ['JA1MNO'] } },
        { analysis_results: { stations: [] } },
        { analysis_results: {} } // No stations field
      ];

      const count = agent.countUniqueStations(mockAnalyses);
      assert.strictEqual(count, 4); // W1ABC, G0XYZ, DF1UVW, JA1MNO
    });

    test('should calculate overall quality correctly', () => {
      const mockSDRs = [
        { quality_score: 80 },
        { quality_score: 90 },
        { quality_score: 70 }
      ];

      const mockSamples = [
        { metadata: { quality_estimate: 85 } },
        { metadata: { quality_estimate: 75 } }
      ];

      const quality = agent.calculateOverallQuality(mockSDRs, mockSamples);
      
      // SDR average: (80+90+70)/3 = 80
      // Sample average: (85+75)/2 = 80
      // Overall: (80+80)/2 = 80
      assert.strictEqual(quality, 80);
    });

    test('should handle missing quality scores gracefully', () => {
      const mockSDRs = [
        { quality_score: 80 },
        {}, // No quality_score
        { quality_score: null }
      ];

      const mockSamples = [
        { metadata: { quality_estimate: 85 } },
        { metadata: {} }, // No quality_estimate
        {} // No metadata
      ];

      const quality = agent.calculateOverallQuality(mockSDRs, mockSamples);
      
      assert.ok(typeof quality === 'number');
      assert.ok(!isNaN(quality));
    });

    test('should determine regions correctly', () => {
      const testCases = [
        { location: 'University of Twente, Netherlands', expected: 'Europe' },
        { location: 'Berlin, Germany', expected: 'Europe' },
        { location: 'Paris, Europe', expected: 'Europe' },
        { location: 'New York, USA', expected: 'North America' },
        { location: 'California, America', expected: 'North America' },
        { location: 'Tokyo, Japan', expected: 'Asia' },
        { location: 'Seoul, Asia', expected: 'Asia' },
        { location: 'Sydney, Australia', expected: 'Other' },
        { location: 'Unknown Location', expected: 'Other' }
      ];

      testCases.forEach(({ location, expected }) => {
        const result = agent.determineRegion(location);
        assert.strictEqual(result, expected, `Failed for location: ${location}`);
      });
    });

    test('should categorize quality bands correctly', () => {
      const testCases = [
        { score: 95, expected: 'Excellent' },
        { score: 80, expected: 'Excellent' },
        { score: 79, expected: 'Good' },
        { score: 60, expected: 'Good' },
        { score: 59, expected: 'Fair' },
        { score: 40, expected: 'Fair' },
        { score: 39, expected: 'Poor' },
        { score: 0, expected: 'Poor' }
      ];

      testCases.forEach(({ score, expected }) => {
        const result = agent.getQualityBand(score);
        assert.strictEqual(result, expected, `Failed for score: ${score}`);
      });
    });
  });

  describe('HTML Generation', () => {
    beforeEach(() => {
      // Set up mock report data
      agent.reportData = {
        timestamp: new Date().toISOString(),
        summary: {
          totalSDRs: 5,
          totalSamples: 20,
          stationCount: 15,
          qualityScore: 85,
          keyFindings: ['Finding 1', 'Finding 2']
        },
        coverage: {
          regions: {
            'Europe': [{ location: 'Netherlands', quality_score: 90 }],
            'Asia': [{ location: 'Japan', quality_score: 80 }]
          }
        },
        analysis: {
          contentTypes: { 'voice': 10, 'cw': 5 },
          languages: { 'english': 8, 'german': 2 }
        },
        audioSamples: [
          {
            id: 'sample1',
            filename: 'test.wav',
            sdr: 'Netherlands',
            frequency: 14250000,
            type: 'hf_voice',
            quality: 85,
            analysis: { content_type: 'voice', language: 'english', confidence: 80 }
          }
        ]
      };
    });

    test('should generate summary cards HTML', () => {
      const html = agent.generateSummaryCards();
      
      assert.ok(typeof html === 'string');
      assert.ok(html.includes('5')); // totalSDRs
      assert.ok(html.includes('20')); // totalSamples
      assert.ok(html.includes('15')); // stationCount
      assert.ok(html.includes('85/100')); // qualityScore
      assert.ok(html.includes('Active SDRs'));
      assert.ok(html.includes('Audio Samples'));
    });

    test('should generate coverage visualization HTML', () => {
      const html = agent.generateCoverageVisualization();
      
      assert.ok(typeof html === 'string');
      assert.ok(html.includes('Europe'));
      assert.ok(html.includes('Asia'));
      assert.ok(html.includes('Netherlands'));
      assert.ok(html.includes('Japan'));
      assert.ok(html.includes('90/100'));
      assert.ok(html.includes('80/100'));
    });

    test('should generate analysis charts HTML', () => {
      const html = agent.generateAnalysisCharts();
      
      assert.ok(typeof html === 'string');
      assert.ok(html.includes('Content Types'));
      assert.ok(html.includes('Languages Detected'));
      assert.ok(html.includes('voice: 10'));
      assert.ok(html.includes('cw: 5'));
      assert.ok(html.includes('english: 8'));
      assert.ok(html.includes('german: 2'));
    });

    test('should generate stations table HTML', () => {
      // Add station data to report
      agent.reportData.analysis.stationsByType = {
        'voice': ['W1ABC', 'G0XYZ'],
        'cw': ['DF1UVW']
      };

      const html = agent.generateStationsTable();
      
      assert.ok(typeof html === 'string');
      assert.ok(html.includes('<table>'));
      assert.ok(html.includes('Station'));
      assert.ok(html.includes('Type'));
      assert.ok(html.includes('W1ABC'));
    });

    test('should generate audio samples HTML', () => {
      const html = agent.generateAudioSamples();
      
      assert.ok(typeof html === 'string');
      assert.ok(html.includes('test.wav'));
      assert.ok(html.includes('Netherlands'));
      assert.ok(html.includes('14.25 MHz'));
      assert.ok(html.includes('hf_voice'));
      assert.ok(html.includes('voice'));
      assert.ok(html.includes('english'));
    });

    test('should build complete dashboard HTML', async () => {
      const html = await agent.buildDashboard();
      
      assert.ok(typeof html === 'string');
      assert.ok(html.includes('<!DOCTYPE html>'));
      assert.ok(html.includes('Shortwave Monitor Intelligence Dashboard'));
      assert.ok(html.includes('Executive Summary'));
      assert.ok(html.includes('Geographic Coverage'));
      assert.ok(html.includes('Content Analysis'));
      assert.ok(html.includes('Notable Stations'));
      assert.ok(html.includes('Audio Samples'));
      assert.ok(html.includes('</html>'));
    });

    test('should include CSS and JavaScript', async () => {
      const html = await agent.buildDashboard();
      
      assert.ok(html.includes('<style>'));
      assert.ok(html.includes('</style>'));
      assert.ok(html.includes('<script>'));
      assert.ok(html.includes('</script>'));
      assert.ok(html.includes('font-family'));
      assert.ok(html.includes('addEventListener'));
    });
  });

  describe('Server Deployment', () => {
    test('should configure express app correctly', async () => {
      mockApp.listen.mock.mockImplementationOnce((port, callback) => {
        callback();
        return { close: mock.fn() };
      });

      const url = await agent.deployReport();
      
      assert.ok(typeof url === 'string');
      assert.ok(url.includes('http://localhost:'));
      
      // Verify express configuration
      assert.ok(mockApp.use.mock.callCount() >= 2); // Static files + data
      assert.ok(mockApp.get.mock.callCount() >= 2); // Main route + API
      assert.strictEqual(mockApp.listen.mock.callCount(), 1);
    });

    test('should handle custom port from environment', async () => {
      process.env.PORT = '4000';
      
      mockApp.listen.mock.mockImplementationOnce((port, callback) => {
        assert.strictEqual(port, '4000');
        callback();
        return { close: mock.fn() };
      });

      await agent.deployReport();
      
      delete process.env.PORT;
    });
  });

  describe('Main Execute Method', () => {
    beforeEach(() => {
      // Mock memory operations
      memoryMock.waitFor.mock.mockImplementation((key) => {
        if (key === 'analysis_complete') {
          return Promise.resolve({ count: 5 });
        }
        return Promise.resolve(null);
      });

      memoryMock.query.mock.mockImplementation((key) => {
        if (key === 'active_sdrs') {
          return Promise.resolve([
            { location: 'Netherlands', quality_score: 90, network: 'WebSDR' }
          ]);
        } else if (key === 'audio_samples') {
          return Promise.resolve([
            { id: 'sample1', metadata: { quality_estimate: 85 } }
          ]);
        } else if (key === 'analysis_results') {
          return Promise.resolve([
            { sample_id: 'sample1', analysis_results: { confidence: 80 } }
          ]);
        }
        return Promise.resolve(null);
      });

      memoryMock.store.mock.mockImplementation(() => Promise.resolve());
      memoryMock.signal.mock.mockImplementation(() => Promise.resolve());
      
      // Mock file operations
      mockFs.writeFile.mock.mockImplementation(() => Promise.resolve());
      
      // Mock server deployment
      mockApp.listen.mock.mockImplementation((port, callback) => {
        callback();
        return { close: mock.fn() };
      });
    });

    test('should execute complete report generation workflow', async () => {
      agent.aggregateData = mock.fn(() => Promise.resolve());
      agent.generateReportComponents = mock.fn(() => Promise.resolve());
      agent.buildDashboard = mock.fn(() => Promise.resolve('<html>Dashboard</html>'));
      agent.deployReport = mock.fn(() => Promise.resolve('http://localhost:3000'));

      const result = await agent.execute();
      
      assert.ok(result);
      assert.strictEqual(result.url, 'http://localhost:3000');
      assert.ok(result.data);
      
      // Verify workflow steps
      assert.strictEqual(agent.aggregateData.mock.callCount(), 1);
      assert.strictEqual(agent.generateReportComponents.mock.callCount(), 1);
      assert.strictEqual(agent.buildDashboard.mock.callCount(), 1);
      assert.strictEqual(agent.deployReport.mock.callCount(), 1);
      
      // Verify memory operations
      assert.ok(memoryMock.waitFor.mock.callCount() > 0);
      assert.ok(memoryMock.store.mock.callCount() > 0);
      assert.ok(memoryMock.signal.mock.callCount() > 0);
      
      // Verify file writing
      assert.ok(mockFs.writeFile.mock.callCount() > 0);
    });

    test('should handle analysis complete timeout', async () => {
      memoryMock.waitFor.mock.mockImplementation(() => Promise.reject(new Error('Timeout')));

      try {
        await agent.execute();
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error.message.includes('Timeout'));
      }
    });

    test('should handle data aggregation errors', async () => {
      memoryMock.query.mock.mockImplementation(() => Promise.reject(new Error('Memory error')));

      try {
        await agent.execute();
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error.message.includes('Memory error'));
      }
    });

    test('should handle file writing errors', async () => {
      mockFs.writeFile.mock.mockImplementation(() => Promise.reject(new Error('Disk full')));
      agent.buildDashboard = mock.fn(() => Promise.resolve('<html>Test</html>'));

      try {
        await agent.execute();
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error.message.includes('Disk full'));
      }
    });
  });

  describe('Data Aggregation', () => {
    beforeEach(() => {
      memoryMock.query.mock.mockImplementation((key) => {
        const mockData = {
          'active_sdrs': [
            { location: 'Netherlands', quality_score: 90, network: 'WebSDR' },
            { location: 'Germany', quality_score: 85, network: 'KiwiSDR' }
          ],
          'audio_samples': [
            { id: 'sample1', metadata: { quality_estimate: 80 } },
            { id: 'sample2', metadata: { quality_estimate: 75 } }
          ],
          'analysis_results': [
            { 
              sample_id: 'sample1', 
              analysis_results: { 
                content_type: 'voice', 
                language: 'english', 
                confidence: 85 
              } 
            }
          ]
        };
        return Promise.resolve(mockData[key] || []);
      });
    });

    test('should aggregate data from all sources', async () => {
      await agent.aggregateData();
      
      assert.ok(agent.reportData.timestamp);
      assert.ok(Array.isArray(agent.reportData.activeSDRs));
      assert.ok(Array.isArray(agent.reportData.audioSamples));
      assert.ok(Array.isArray(agent.reportData.analysisResults));
      assert.ok(agent.reportData.summary);
      assert.ok(agent.reportData.coverage);
      assert.ok(agent.reportData.analysis);
      
      assert.strictEqual(agent.reportData.activeSDRs.length, 2);
      assert.strictEqual(agent.reportData.audioSamples.length, 2);
      assert.strictEqual(agent.reportData.analysisResults.length, 1);
    });

    test('should handle missing data gracefully', async () => {
      memoryMock.query.mock.mockImplementation(() => Promise.resolve(null));

      await agent.aggregateData();
      
      assert.ok(Array.isArray(agent.reportData.activeSDRs));
      assert.ok(Array.isArray(agent.reportData.audioSamples));
      assert.ok(Array.isArray(agent.reportData.analysisResults));
      assert.strictEqual(agent.reportData.activeSDRs.length, 0);
    });
  });

  describe('Shutdown', () => {
    test('should shutdown server correctly', () => {
      const mockServer = { close: mock.fn() };
      agent.server = mockServer;

      agent.shutdown();
      
      assert.strictEqual(mockServer.close.mock.callCount(), 1);
    });

    test('should handle shutdown when no server is running', () => {
      agent.server = null;
      
      // Should not throw
      agent.shutdown();
      assert.ok(true);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle malformed analysis data', () => {
      const malformedAnalyses = [
        null,
        undefined,
        { analysis_results: null },
        { analysis_results: { stations: 'not-an-array' } },
        { analysis_results: { confidence: 'not-a-number' } }
      ];

      // Should not throw
      const summary = agent.generateAnalysisSummary(malformedAnalyses);
      assert.ok(summary);
      assert.ok(typeof summary.averageConfidence === 'number');
    });

    test('should handle empty or null location strings', () => {
      const testCases = ['', null, undefined, '   '];
      
      testCases.forEach(location => {
        const region = agent.determineRegion(location);
        assert.strictEqual(region, 'Other');
      });
    });

    test('should handle division by zero in quality calculation', () => {
      const quality = agent.calculateOverallQuality([], []);
      
      assert.ok(typeof quality === 'number');
      assert.ok(!isNaN(quality));
    });

    test('should handle HTML special characters in data', () => {
      agent.reportData = {
        summary: { keyFindings: ['Finding with <script>alert("xss")</script>'] },
        coverage: { regions: {} },
        analysis: { contentTypes: {}, languages: {} },
        audioSamples: []
      };

      const html = agent.generateSummaryCards();
      
      // HTML should be generated without throwing
      assert.ok(typeof html === 'string');
    });
  });
});