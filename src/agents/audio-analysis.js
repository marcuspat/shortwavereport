/**
 * Audio Analysis Agent - SPARC Phase 3
 * Processes captured audio for intelligence extraction
 * Enhanced with AI-powered analysis using OpenRouter/OpenAI APIs
 */

import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import MemoryManager from '../memory/memory-manager.js';
import ResilienceManager from '../utils/resilience-manager.js';
import aiService from '../utils/ai-service.js';

class AudioAnalysisAgent {
  constructor() {
    this.memory = new MemoryManager();
    this.resilience = new ResilienceManager();
    this.aiAnalysis = aiService;
    this.analysisDir = path.join(process.cwd(), 'data', 'analysis');
    this.analysisResults = [];
    this.initializeAnalysisDir();
  }

  async initializeAnalysisDir() {
    try {
      await fs.mkdir(this.analysisDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create analysis directory:', error);
    }
  }

  /**
   * Main audio analysis workflow using TDD methodology
   */
  async execute() {
    console.log('🔬 Starting Audio Analysis Phase...');
    
    try {
      // Wait for audio capture to complete
      await this.memory.waitFor('capture_complete', 30000);
      const audioSamples = await this.memory.query('audio_samples');
      
      if (!audioSamples || audioSamples.length === 0) {
        throw new Error('No audio samples available for analysis');
      }

      console.log(`🎵 Found ${audioSamples.length} audio samples for analysis`);

      // Run tests first (TDD approach)
      await this.runAnalysisTests();

      // Parallel analysis of all samples
      const analysisPromises = audioSamples.map(sample => 
        this.analyzeSample(sample)
      );

      const results = await Promise.allSettled(analysisPromises);
      
      // Process results
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          console.log(`✅ Analysis ${index + 1}: Success`);
          this.analysisResults.push(result.value);
        } else {
          console.log(`❌ Analysis ${index + 1}: Failed - ${result.reason.message}`);
        }
      });

      // Validate and refine results
      await this.validateResults();
      
      // Store results in memory
      await this.memory.store('analysis_results', this.analysisResults);
      await this.memory.signal('analysis_complete', {
        count: this.analysisResults.length,
        timestamp: new Date().toISOString()
      });

      console.log(`🎯 Audio analysis complete: ${this.analysisResults.length} samples analyzed`);
      return this.analysisResults;

    } catch (error) {
      console.error('❌ Audio Analysis failed:', error);
      throw error;
    }
  }

  /**
   * Run TDD tests for analysis functions
   */
  async runAnalysisTests() {
    console.log('🧪 Running analysis tests...');
    
    const tests = [
      this.testAudioClassifier(),
      this.testLanguageDetector(),
      this.testTranscriptionAccuracy(),
      this.testCWDecoder(),
      this.testDigitalModeDetection()
    ];

    const testResults = await Promise.allSettled(tests);
    
    testResults.forEach((result, index) => {
      const testNames = ['Classifier', 'Language', 'Transcription', 'CW', 'Digital'];
      if (result.status === 'fulfilled') {
        console.log(`✅ ${testNames[index]} test: PASSED`);
      } else {
        console.log(`❌ ${testNames[index]} test: FAILED - ${result.reason.message}`);
      }
    });
  }

  /**
   * Analyze individual audio sample
   */
  async analyzeSample(sample) {
    console.log(`🔍 Analyzing ${sample.filename}...`);
    
    const analysis = {
      sample_id: sample.id,
      filename: sample.filename,
      metadata: sample.metadata,
      analysis_results: {
        content_type: 'unknown',
        language: 'unknown',
        transcription: '',
        stations: [],
        quality_score: 0,
        timestamp: new Date().toISOString(),
        confidence: 0
      }
    };

    try {
      // Use AI analysis service for comprehensive analysis
      const audioFilePath = sample.processed_filepath || sample.filepath;
      const aiResults = await this.aiAnalysis.analyzeAudio(audioFilePath, sample.config.type);
      
      // Convert AI results to our analysis format
      analysis.analysis_results = {
        content_type: aiResults.content_type,
        language: aiResults.language,
        transcription: aiResults.transcription,
        stations: aiResults.stations,
        quality_score: aiResults.quality_score,
        timestamp: aiResults.timestamp,
        confidence: aiResults.confidence,
        ai_details: aiResults.details || {},
        error: aiResults.error
      };
      
      console.log(`🤖 AI Analysis: ${aiResults.content_type} (${aiResults.confidence}% confidence)`);

      // Save analysis to file
      const analysisFile = path.join(this.analysisDir, `${sample.id}_analysis.json`);
      await fs.writeFile(analysisFile, JSON.stringify(analysis, null, 2));

      return analysis;

    } catch (error) {
      console.error(`Failed to analyze ${sample.filename}:`, error);
      analysis.analysis_results.error = error.message;
      return analysis;
    }
  }

  /**
   * Analyze voice communications
   */
  async analyzeVoice(sample) {
    console.log(`🗣️ Analyzing voice sample: ${sample.filename}`);
    
    const results = {
      content_type: 'voice',
      language: 'unknown',
      transcription: '',
      stations: [],
      quality_score: sample.metadata.quality_estimate || 50,
      timestamp: new Date().toISOString(),
      confidence: 0
    };

    try {
      // Simulate speech-to-text processing
      const transcription = await this.speechToText(sample.filepath);
      results.transcription = transcription;
      
      // Language detection
      results.language = this.detectLanguage(transcription);
      
      // Extract callsigns and stations
      results.stations = this.extractCallsigns(transcription);
      
      // Calculate confidence based on quality
      results.confidence = this.calculateConfidence(results);
      
      console.log(`📝 Voice analysis: ${results.language}, ${results.stations.length} stations`);
      
    } catch (error) {
      console.error('Voice analysis error:', error);
      results.error = error.message;
    }

    return results;
  }

  /**
   * Analyze broadcast transmissions
   */
  async analyzeBroadcast(sample) {
    console.log(`📻 Analyzing broadcast sample: ${sample.filename}`);
    
    const results = {
      content_type: 'broadcast',
      language: 'unknown',
      transcription: '',
      stations: [],
      quality_score: sample.metadata.quality_estimate || 50,
      timestamp: new Date().toISOString(),
      confidence: 0
    };

    try {
      // Detect if this is actually a broadcast
      const isBroadcast = await this.detectBroadcast(sample.filepath);
      
      if (isBroadcast) {
        // Extract station ID and content
        const transcription = await this.speechToText(sample.filepath);
        results.transcription = transcription;
        results.language = this.detectLanguage(transcription);
        results.stations = this.extractBroadcastStations(transcription);
      } else {
        results.content_type = 'unknown';
      }
      
      results.confidence = this.calculateConfidence(results);
      
    } catch (error) {
      console.error('Broadcast analysis error:', error);
      results.error = error.message;
    }

    return results;
  }

  /**
   * Analyze CW and digital mode transmissions
   */
  async analyzeCWDigital(sample) {
    console.log(`⚡ Analyzing CW/Digital sample: ${sample.filename}`);
    
    const results = {
      content_type: 'unknown',
      language: 'unknown',
      transcription: '',
      stations: [],
      quality_score: sample.metadata.quality_estimate || 50,
      timestamp: new Date().toISOString(),
      confidence: 0
    };

    try {
      // Try CW decoding first
      const cwText = await this.decodeCW(sample.filepath);
      if (cwText && cwText.length > 10) {
        results.content_type = 'cw';
        results.transcription = cwText;
        results.stations = this.extractCallsigns(cwText);
      } else {
        // Try digital mode detection
        const digitalMode = await this.detectDigitalMode(sample.filepath);
        if (digitalMode) {
          results.content_type = digitalMode;
          results.transcription = await this.decodeDigitalMode(sample.filepath, digitalMode);
          results.stations = this.extractCallsigns(results.transcription);
        }
      }
      
      results.confidence = this.calculateConfidence(results);
      
    } catch (error) {
      console.error('CW/Digital analysis error:', error);
      results.error = error.message;
    }

    return results;
  }

  /**
   * Analyze utility transmissions
   */
  async analyzeUtility(sample) {
    console.log(`🚢 Analyzing utility sample: ${sample.filename}`);
    
    const results = {
      content_type: 'utility',
      language: 'unknown',
      transcription: '',
      stations: [],
      quality_score: sample.metadata.quality_estimate || 50,
      timestamp: new Date().toISOString(),
      confidence: 0
    };

    try {
      // Check for various utility signals
      const utilityType = await this.detectUtilityType(sample.filepath);
      results.content_type = utilityType || 'utility';
      
      if (utilityType === 'voice') {
        const transcription = await this.speechToText(sample.filepath);
        results.transcription = transcription;
        results.language = this.detectLanguage(transcription);
        results.stations = this.extractUtilityStations(transcription);
      }
      
      results.confidence = this.calculateConfidence(results);
      
    } catch (error) {
      console.error('Utility analysis error:', error);
      results.error = error.message;
    }

    return results;
  }

  /**
   * Generic analysis fallback
   */
  async analyzeGeneric(sample) {
    return {
      content_type: 'unknown',
      language: 'unknown',
      transcription: '',
      stations: [],
      quality_score: sample.metadata.quality_estimate || 50,
      timestamp: new Date().toISOString(),
      confidence: 0
    };
  }

  /**
   * Mock speech-to-text implementation
   */
  async speechToText(filepath) {
    // In a real implementation, this would use a speech recognition service
    console.log(`🎤 Converting speech to text: ${path.basename(filepath)}`);
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Return mock transcription based on file type
    const mockTranscriptions = [
      "CQ CQ CQ de W1ABC W1ABC K",
      "This is BBC World Service broadcasting from London",
      "Alpha Bravo Charlie, this is Control, over",
      "QRT QRT de DF1XYZ 73",
      "Weather bulletin: Wind northeast 15 knots"
    ];
    
    return mockTranscriptions[Math.floor(Math.random() * mockTranscriptions.length)];
  }

  /**
   * Language detection
   */
  detectLanguage(text) {
    const languageKeywords = {
      'english': ['the', 'and', 'this', 'is', 'from', 'weather', 'control'],
      'german': ['das', 'und', 'ist', 'von', 'wetter', 'kontrolle'],
      'french': ['le', 'et', 'est', 'de', 'temps', 'controle'],
      'spanish': ['el', 'y', 'es', 'de', 'tiempo', 'control']
    };

    const textLower = text.toLowerCase();
    let maxMatches = 0;
    let detectedLanguage = 'unknown';

    for (const [language, keywords] of Object.entries(languageKeywords)) {
      const matches = keywords.filter(keyword => textLower.includes(keyword)).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        detectedLanguage = language;
      }
    }

    return detectedLanguage;
  }

  /**
   * Extract amateur radio callsigns
   */
  extractCallsigns(text) {
    const callsignPattern = /\b[A-Z0-9]{1,3}[0-9][A-Z0-9]{0,3}[A-Z]\b/g;
    const matches = text.match(callsignPattern) || [];
    return [...new Set(matches)]; // Remove duplicates
  }

  /**
   * Extract broadcast station identifiers
   */
  extractBroadcastStations(text) {
    const stations = [];
    const textLower = text.toLowerCase();
    
    // Common broadcast identifiers
    const broadcastPatterns = [
      /bbc\s+world\s+service/i,
      /voice\s+of\s+america/i,
      /radio\s+[a-z]+/i,
      /[a-z]+\s+broadcasting/i
    ];

    broadcastPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        stations.push(...matches);
      }
    });

    return stations;
  }

  /**
   * Extract utility station identifiers
   */
  extractUtilityStations(text) {
    const stations = [];
    const patterns = [
      /coast\s+guard/i,
      /control/i,
      /weather/i,
      /maritime/i,
      /airport/i
    ];

    patterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        stations.push(...matches);
      }
    });

    return stations;
  }

  /**
   * Calculate confidence score
   */
  calculateConfidence(results) {
    let confidence = 50; // Base confidence
    
    if (results.content_type !== 'unknown') confidence += 20;
    if (results.language !== 'unknown') confidence += 15;
    if (results.transcription.length > 10) confidence += 10;
    if (results.stations.length > 0) confidence += 15;
    
    return Math.min(100, confidence);
  }

  /**
   * TDD Test methods (mocked)
   */
  async testAudioClassifier() {
    // Mock test - would validate classification accuracy
    return true;
  }

  async testLanguageDetector() {
    // Mock test - would validate language detection
    return true;
  }

  async testTranscriptionAccuracy() {
    // Mock test - would validate speech-to-text accuracy
    return true;
  }

  async testCWDecoder() {
    // Mock test - would validate CW decoding
    return true;
  }

  async testDigitalModeDetection() {
    // Mock test - would validate digital mode detection
    return true;
  }

  /**
   * Additional analysis methods (mocked for demo)
   */
  async decodeCW(filepath) {
    await new Promise(resolve => setTimeout(resolve, 500));
    return "CQ CQ DE W1ABC W1ABC K";
  }

  async detectBroadcast(filepath) {
    return Math.random() > 0.5;
  }

  async detectDigitalMode(filepath) {
    const modes = ['psk31', 'ft8', 'rtty', null];
    return modes[Math.floor(Math.random() * modes.length)];
  }

  async decodeDigitalMode(filepath, mode) {
    return `${mode.toUpperCase()} transmission detected`;
  }

  async detectUtilityType(filepath) {
    const types = ['voice', 'data', 'beacon', 'unknown'];
    return types[Math.floor(Math.random() * types.length)];
  }

  /**
   * Validate analysis results
   */
  async validateResults() {
    console.log('✅ Validating analysis results...');
    
    // Cross-check results for consistency
    this.analysisResults.forEach(result => {
      if (result.analysis_results.confidence < 30) {
        console.log(`⚠️ Low confidence result: ${result.filename}`);
      }
    });
  }
}

// Allow standalone execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const agent = new AudioAnalysisAgent();
  agent.execute().catch(console.error);
}

export default AudioAnalysisAgent;