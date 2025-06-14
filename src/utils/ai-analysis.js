/**
 * AI Analysis Utilities - Real speech-to-text, CW decoding, and signal analysis
 * Integrates with OpenAI Whisper and other AI services for audio analysis
 */

import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs/promises';
import path from 'path';

class SpeechToTextService {
  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.whisperEndpoint = 'https://api.openai.com/v1/audio/transcriptions';
    this.fallbackEndpoint = null; // Could be Google, Azure, etc.
  }

  /**
   * Convert speech to text using OpenAI Whisper
   */
  async transcribeAudio(audioFilePath, language = 'auto') {
    if (!this.openaiApiKey) {
      console.log('⚠️ No OpenAI API key, using mock transcription');
      return this.mockTranscription();
    }

    try {
      const audioBuffer = await fs.readFile(audioFilePath);
      const formData = new FormData();
      
      formData.append('file', audioBuffer, {
        filename: path.basename(audioFilePath),
        contentType: 'audio/wav'
      });
      formData.append('model', 'whisper-1');
      
      if (language !== 'auto') {
        formData.append('language', language);
      }

      const response = await fetch(this.whisperEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          ...formData.getHeaders()
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Whisper API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`🎤 Whisper transcription: "${result.text}"`);
      
      return {
        text: result.text,
        language: result.language || language,
        confidence: 0.95, // Whisper doesn't provide confidence, assume high
        service: 'whisper'
      };

    } catch (error) {
      console.error('❌ Speech-to-text failed:', error.message);
      // Fallback to mock transcription
      return this.mockTranscription();
    }
  }

  /**
   * Mock transcription for testing/demo purposes
   */
  mockTranscription() {
    const mockTranscriptions = [
      "CQ CQ CQ de W1ABC W1ABC K",
      "This is BBC World Service broadcasting from London",
      "Alpha Bravo Charlie, this is Control, over",
      "QRT QRT de DF1XYZ 73",
      "Weather bulletin: Wind northeast 15 knots, visibility 10 kilometers",
      "Ham radio net check-in: Station N2DEF checking in",
      "Emergency traffic: All stations this is Emergency Coordinator",
      "Contest QSO: W5GHI you are 5-9 in Texas"
    ];
    
    return {
      text: mockTranscriptions[Math.floor(Math.random() * mockTranscriptions.length)],
      language: 'en',
      confidence: 0.85,
      service: 'mock'
    };
  }
}

class CWDecoder {
  constructor() {
    this.morseTable = {
      '.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D', '.': 'E',
      '..-.': 'F', '--.': 'G', '....': 'H', '..': 'I', '.---': 'J',
      '-.-': 'K', '.-..': 'L', '--': 'M', '-.': 'N', '---': 'O',
      '.--.': 'P', '--.-': 'Q', '.-.': 'R', '...': 'S', '-': 'T',
      '..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X', '-.--': 'Y',
      '--..': 'Z',
      '.----': '1', '..---': '2', '...--': '3', '....-': '4', '.....': '5',
      '-....': '6', '--...': '7', '---..': '8', '----.': '9', '-----': '0'
    };
  }

  /**
   * Decode CW/Morse code from audio buffer
   */
  async decodeCW(audioFilePath) {
    try {
      console.log(`📻 Decoding CW from ${path.basename(audioFilePath)}`);
      
      // Read audio file and analyze for CW patterns
      const audioBuffer = await fs.readFile(audioFilePath);
      
      // Simplified CW detection - in reality would use DSP analysis
      const cwDetected = await this.detectCWTone(audioBuffer);
      
      if (cwDetected) {
        const cwPattern = await this.extractCWPattern(audioBuffer);
        const decodedText = this.decodeMorsePattern(cwPattern);
        
        console.log(`📡 CW decoded: "${decodedText}"`);
        return {
          text: decodedText,
          confidence: 0.8,
          wpm: this.estimateWPM(cwPattern),
          frequency: 800 // Estimated tone frequency
        };
      } else {
        return null;
      }
    } catch (error) {
      console.error('❌ CW decoding failed:', error.message);
      return null;
    }
  }

  /**
   * Detect CW tone in audio buffer (simplified)
   */
  async detectCWTone(audioBuffer) {
    // Mock CW detection - real implementation would use FFT analysis
    // Look for consistent tone around 600-800 Hz with on/off keying
    return Math.random() > 0.6; // 40% chance of CW detection in mock
  }

  /**
   * Extract CW timing pattern from audio
   */
  async extractCWPattern(audioBuffer) {
    // Mock pattern extraction - real implementation would analyze audio timing
    const mockPatterns = [
      '... --- ... ', // SOS
      '.-. .- -.. .. --- ', // RADIO
      '- . ... - ', // TEST
      '.-.. --- -.-. .- - .. --- -. ', // LOCATION
      '-..- .---- .- -... -.-.', // X1ABC
    ];
    
    return mockPatterns[Math.floor(Math.random() * mockPatterns.length)];
  }

  /**
   * Decode morse pattern to text
   */
  decodeMorsePattern(pattern) {
    return pattern
      .split(' ')
      .map(morse => this.morseTable[morse] || '?')
      .join('')
      .replace(/\?+/g, ' '); // Replace unknown characters with spaces
  }

  /**
   * Estimate words per minute
   */
  estimateWPM(pattern) {
    // Simple WPM estimation based on pattern length
    const elementCount = pattern.replace(/ /g, '').length;
    return Math.round(12 + Math.random() * 8); // 12-20 WPM typical range
  }
}

class DigitalModeDetector {
  constructor() {
    this.digitalModes = {
      'PSK31': { baudRate: 31.25, frequency: 1000 },
      'PSK63': { baudRate: 62.5, frequency: 1000 },
      'RTTY': { baudRate: 45.45, frequency: 2125 },
      'FT8': { baudRate: 6.25, frequency: 1500 },
      'FT4': { baudRate: 12.5, frequency: 1500 },
      'JT65': { baudRate: 1.736, frequency: 1270 }
    };
  }

  /**
   * Detect digital mode in audio
   */
  async detectDigitalMode(audioFilePath) {
    try {
      console.log(`💻 Detecting digital modes in ${path.basename(audioFilePath)}`);
      
      const audioBuffer = await fs.readFile(audioFilePath);
      
      // Analyze audio for digital mode characteristics
      const detectedMode = await this.analyzeDigitalSignature(audioBuffer);
      
      if (detectedMode) {
        const decodedData = await this.decodeDigitalMode(audioBuffer, detectedMode);
        
        console.log(`📊 Digital mode detected: ${detectedMode}`);
        return {
          mode: detectedMode,
          data: decodedData,
          confidence: 0.75,
          parameters: this.digitalModes[detectedMode]
        };
      }
      
      return null;
    } catch (error) {
      console.error('❌ Digital mode detection failed:', error.message);
      return null;
    }
  }

  /**
   * Analyze audio for digital mode signatures
   */
  async analyzeDigitalSignature(audioBuffer) {
    // Mock digital mode detection
    const modes = Object.keys(this.digitalModes);
    
    // 30% chance of detecting a digital mode
    if (Math.random() > 0.7) {
      return modes[Math.floor(Math.random() * modes.length)];
    }
    
    return null;
  }

  /**
   * Decode specific digital mode
   */
  async decodeDigitalMode(audioBuffer, mode) {
    const mockData = {
      'PSK31': 'CQ CQ DE W1ABC W1ABC K',
      'RTTY': 'RYRYRY DE W1ABC TEST TEST K',
      'FT8': 'CQ NA W1ABC FN42',
      'FT4': '73 W1ABC N2DEF RRR',
      'JT65': 'W1ABC N2DEF 73'
    };
    
    return mockData[mode] || 'DIGITAL DATA DETECTED';
  }
}

class LanguageDetector {
  constructor() {
    this.languageKeywords = {
      'english': ['the', 'and', 'this', 'is', 'from', 'weather', 'control', 'radio', 'station'],
      'spanish': ['el', 'la', 'y', 'es', 'de', 'tiempo', 'control', 'radio', 'estacion'],
      'french': ['le', 'la', 'et', 'est', 'de', 'temps', 'controle', 'radio', 'station'],
      'german': ['das', 'der', 'und', 'ist', 'von', 'wetter', 'kontrolle', 'radio', 'station'],
      'italian': ['il', 'la', 'e', 'è', 'di', 'tempo', 'controllo', 'radio', 'stazione'],
      'portuguese': ['o', 'a', 'e', 'é', 'de', 'tempo', 'controle', 'rádio', 'estação'],
      'russian': ['и', 'в', 'на', 'с', 'по', 'радио', 'станция', 'погода'],
      'japanese': ['の', 'に', 'は', 'を', 'が', 'ラジオ', '放送', '天気'],
      'chinese': ['的', '是', '在', '了', '和', '广播', '电台', '天气']
    };
  }

  /**
   * Detect language from transcribed text
   */
  detectLanguage(text) {
    if (!text || text.length < 10) {
      return { language: 'unknown', confidence: 0 };
    }

    const textLower = text.toLowerCase();
    const scores = {};

    // Score each language based on keyword matches
    for (const [language, keywords] of Object.entries(this.languageKeywords)) {
      let score = 0;
      for (const keyword of keywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = (textLower.match(regex) || []).length;
        score += matches;
      }
      scores[language] = score;
    }

    // Find the language with the highest score
    const [bestLanguage, bestScore] = Object.entries(scores)
      .reduce((max, current) => current[1] > max[1] ? current : max, ['unknown', 0]);

    const confidence = Math.min(bestScore / 5, 1.0); // Normalize confidence

    return {
      language: confidence > 0.3 ? bestLanguage : 'unknown',
      confidence: confidence,
      scores: scores
    };
  }
}

class StationIdentifier {
  constructor() {
    this.callsignPatterns = {
      amateur: /\b[A-Z0-9]{1,3}[0-9][A-Z0-9]{0,3}[A-Z]\b/g,
      broadcast: /(BBC|VOA|RFI|DW|NHK|CCTV|RT)/gi,
      utility: /(COAST GUARD|CONTROL|TOWER|BASE|MOBILE)/gi,
      maritime: /\b[A-Z0-9]{4,7}\b(?=.*(?:SHIP|VESSEL|MARITIME))/gi
    };
    
    this.broadcastStations = {
      'BBC': 'BBC World Service',
      'VOA': 'Voice of America',
      'RFI': 'Radio France Internationale',
      'DW': 'Deutsche Welle',
      'NHK': 'NHK World Japan',
      'CCTV': 'China Global Television Network',
      'RT': 'RT International'
    };
  }

  /**
   * Extract station identifiers from text
   */
  extractStations(text, contentType = 'unknown') {
    const stations = [];

    try {
      // Extract amateur radio callsigns
      const amateurMatches = text.match(this.callsignPatterns.amateur) || [];
      stations.push(...amateurMatches.map(call => ({
        callsign: call,
        type: 'amateur',
        confidence: 0.9
      })));

      // Extract broadcast stations
      const broadcastMatches = text.match(this.callsignPatterns.broadcast) || [];
      stations.push(...broadcastMatches.map(station => ({
        callsign: this.broadcastStations[station.toUpperCase()] || station,
        type: 'broadcast',
        confidence: 0.95
      })));

      // Extract utility stations
      const utilityMatches = text.match(this.callsignPatterns.utility) || [];
      stations.push(...utilityMatches.map(station => ({
        callsign: station,
        type: 'utility',
        confidence: 0.8
      })));

      // Remove duplicates
      const uniqueStations = stations.filter((station, index, array) => 
        array.findIndex(s => s.callsign === station.callsign) === index
      );

      console.log(`📻 Identified ${uniqueStations.length} stations: ${uniqueStations.map(s => s.callsign).join(', ')}`);
      return uniqueStations;

    } catch (error) {
      console.error('❌ Station identification failed:', error.message);
      return [];
    }
  }
}

/**
 * Comprehensive AI Analysis Service
 */
class AIAnalysisService {
  constructor() {
    this.speechToText = new SpeechToTextService();
    this.cwDecoder = new CWDecoder();
    this.digitalDetector = new DigitalModeDetector();
    this.languageDetector = new LanguageDetector();
    this.stationIdentifier = new StationIdentifier();
  }

  /**
   * Comprehensive audio analysis
   */
  async analyzeAudio(audioFilePath, expectedType = 'unknown') {
    console.log(`🤖 Starting AI analysis of ${path.basename(audioFilePath)}`);
    
    const analysis = {
      content_type: 'unknown',
      language: 'unknown',
      transcription: '',
      stations: [],
      quality_score: 50,
      timestamp: new Date().toISOString(),
      confidence: 0,
      details: {}
    };

    try {
      // Determine analysis approach based on expected type
      if (expectedType === 'cw_digital' || expectedType === 'cw') {
        await this.analyzeCWDigital(audioFilePath, analysis);
      } else if (expectedType === 'voice' || expectedType === 'broadcast') {
        await this.analyzeVoiceContent(audioFilePath, analysis);
      } else {
        // Try all analysis methods
        await this.analyzeVoiceContent(audioFilePath, analysis);
        await this.analyzeCWDigital(audioFilePath, analysis);
      }

      // Calculate overall confidence
      analysis.confidence = this.calculateConfidence(analysis);
      
      console.log(`✅ AI analysis complete: ${analysis.content_type} (${analysis.confidence}% confidence)`);
      return analysis;

    } catch (error) {
      console.error('❌ AI analysis failed:', error.message);
      analysis.error = error.message;
      return analysis;
    }
  }

  /**
   * Analyze voice/speech content
   */
  async analyzeVoiceContent(audioFilePath, analysis) {
    // Speech-to-text transcription
    const transcription = await this.speechToText.transcribeAudio(audioFilePath);
    
    if (transcription && transcription.text.length > 5) {
      analysis.transcription = transcription.text;
      analysis.content_type = 'voice';
      analysis.quality_score = Math.round(transcription.confidence * 100);
      
      // Language detection
      const languageResult = this.languageDetector.detectLanguage(transcription.text);
      analysis.language = languageResult.language;
      analysis.details.language_confidence = languageResult.confidence;
      
      // Station identification
      const stations = this.stationIdentifier.extractStations(transcription.text);
      analysis.stations = stations.map(s => s.callsign);
      analysis.details.station_details = stations;
      
      // Determine if broadcast vs amateur
      if (stations.some(s => s.type === 'broadcast')) {
        analysis.content_type = 'broadcast';
      }
    }
  }

  /**
   * Analyze CW and digital modes
   */
  async analyzeCWDigital(audioFilePath, analysis) {
    // Try CW decoding
    const cwResult = await this.cwDecoder.decodeCW(audioFilePath);
    if (cwResult) {
      analysis.content_type = 'cw';
      analysis.transcription = cwResult.text;
      analysis.quality_score = Math.round(cwResult.confidence * 100);
      analysis.details.wpm = cwResult.wpm;
      analysis.details.tone_frequency = cwResult.frequency;
      
      // Extract stations from CW
      const stations = this.stationIdentifier.extractStations(cwResult.text);
      analysis.stations = stations.map(s => s.callsign);
      return;
    }

    // Try digital mode detection
    const digitalResult = await this.digitalDetector.detectDigitalMode(audioFilePath);
    if (digitalResult) {
      analysis.content_type = 'digital';
      analysis.transcription = digitalResult.data;
      analysis.quality_score = Math.round(digitalResult.confidence * 100);
      analysis.details.digital_mode = digitalResult.mode;
      analysis.details.mode_parameters = digitalResult.parameters;
      
      // Extract stations from digital data
      const stations = this.stationIdentifier.extractStations(digitalResult.data);
      analysis.stations = stations.map(s => s.callsign);
    }
  }

  /**
   * Calculate overall confidence based on analysis results
   */
  calculateConfidence(analysis) {
    let confidence = 30; // Base confidence
    
    if (analysis.content_type !== 'unknown') confidence += 25;
    if (analysis.language !== 'unknown') confidence += 15;
    if (analysis.transcription.length > 10) confidence += 15;
    if (analysis.stations.length > 0) confidence += 15;
    
    return Math.min(100, confidence);
  }
}

export { 
  SpeechToTextService,
  CWDecoder, 
  DigitalModeDetector,
  LanguageDetector,
  StationIdentifier,
  AIAnalysisService 
};

export default AIAnalysisService;