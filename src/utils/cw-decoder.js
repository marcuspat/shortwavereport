/**
 * Advanced CW/Morse Code Decoder
 * Real-time CW decoding using audio signal processing
 */

import fs from 'fs/promises';

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
      '-....': '6', '--...': '7', '---..': '8', '----.': '9', '-----': '0',
      '--..--': ',', '.-.-.-': '.', '..--..': '?', '.----.': "'", '-.-.--': '!',
      '-..-.': '/', '-.--.': '(', '-.--.-': ')', '.-...': '&', '---...': ':',
      '-.-.-.': ';', '-...-': '=', '.-.-.': '+', '-....-': '-', '..--.-': '_',
      '.-..-.': '"', '...-..-': '$', '.--.-.': '@'
    };

    this.reverseTable = Object.fromEntries(
      Object.entries(this.morseTable).map(([morse, char]) => [char, morse])
    );

    // CW decoder parameters
    this.config = {
      sampleRate: 16000,
      targetFrequency: 800, // Hz - typical CW tone
      windowSize: 512,
      hopSize: 256,
      minDitLength: 0.05, // seconds - minimum dit duration
      maxDitLength: 0.3,  // seconds - maximum dit duration
      dahRatio: 3.0,      // dah = 3 * dit
      letterSpace: 3.0,   // space between letters = 3 * dit
      wordSpace: 7.0,     // space between words = 7 * dit
      noiseThreshold: 0.1 // minimum signal level
    };
  }

  /**
   * Decode CW from audio file
   */
  async decodeCW(audioFilePath) {
    try {
      console.log(`📻 Advanced CW decoding: ${audioFilePath}`);
      
      const audioBuffer = await this.loadAudioFile(audioFilePath);
      const envelope = this.detectEnvelope(audioBuffer);
      const keyedSegments = this.detectKeying(envelope);
      const morseElements = this.segmentsToMorse(keyedSegments);
      const decodedText = this.morseToText(morseElements);
      
      if (decodedText && decodedText.length > 0) {
        const wpm = this.calculateWPM(keyedSegments);
        
        return {
          text: decodedText,
          wpm: wpm,
          confidence: this.calculateConfidence(keyedSegments, decodedText),
          frequency: this.estimateFrequency(audioBuffer),
          signal_quality: this.assessSignalQuality(envelope),
          elements_detected: morseElements.length
        };
      }
      
      return null;
    } catch (error) {
      console.error('❌ CW decoding error:', error.message);
      return null;
    }
  }

  /**
   * Load and parse audio file
   */
  async loadAudioFile(filePath) {
    const audioData = await fs.readFile(filePath);
    
    // Simple WAV parsing (assumes 16-bit mono)
    const headerSize = 44;
    const samples = [];
    
    for (let i = headerSize; i < audioData.length; i += 2) {
      // Read 16-bit little-endian sample
      const sample = audioData.readInt16LE(i) / 32768.0; // Normalize to [-1, 1]
      samples.push(sample);
    }
    
    console.log(`📊 Loaded ${samples.length} audio samples`);
    return samples;
  }

  /**
   * Detect audio envelope using sliding window
   */
  detectEnvelope(audioBuffer) {
    const envelope = [];
    const windowSize = Math.floor(this.config.sampleRate * 0.01); // 10ms window
    
    for (let i = 0; i < audioBuffer.length - windowSize; i += windowSize) {
      let sum = 0;
      for (let j = 0; j < windowSize; j++) {
        sum += Math.abs(audioBuffer[i + j]);
      }
      envelope.push(sum / windowSize);
    }
    
    return envelope;
  }

  /**
   * Detect CW keying from envelope
   */
  detectKeying(envelope) {
    const threshold = Math.max(...envelope) * 0.3; // Adaptive threshold
    const keyedSegments = [];
    let currentSegment = null;
    
    for (let i = 0; i < envelope.length; i++) {
      const isKeyed = envelope[i] > threshold;
      const timeIndex = i * 0.01; // 10ms per sample
      
      if (isKeyed && !currentSegment) {
        // Start of keyed segment
        currentSegment = { start: timeIndex, end: timeIndex, type: 'key' };
      } else if (!isKeyed && currentSegment) {
        // End of keyed segment
        currentSegment.end = timeIndex;
        currentSegment.duration = currentSegment.end - currentSegment.start;
        keyedSegments.push(currentSegment);
        currentSegment = null;
        
        // Add space segment
        const spaceStart = timeIndex;
        let spaceEnd = timeIndex;
        
        // Find end of space
        while (spaceEnd < envelope.length * 0.01 && envelope[Math.floor(spaceEnd / 0.01)] <= threshold) {
          spaceEnd += 0.01;
        }
        
        if (spaceEnd > spaceStart) {
          keyedSegments.push({
            start: spaceStart,
            end: spaceEnd,
            duration: spaceEnd - spaceStart,
            type: 'space'
          });
        }
      } else if (isKeyed && currentSegment) {
        // Continue keyed segment
        currentSegment.end = timeIndex;
      }
    }
    
    console.log(`🔍 Detected ${keyedSegments.filter(s => s.type === 'key').length} keyed segments`);
    return keyedSegments;
  }

  /**
   * Convert keyed segments to morse elements
   */
  segmentsToMorse(segments) {
    if (segments.length === 0) return [];
    
    // Estimate dit length from shortest keyed segments
    const keyedSegments = segments.filter(s => s.type === 'key');
    if (keyedSegments.length === 0) return [];
    
    const durations = keyedSegments.map(s => s.duration).sort((a, b) => a - b);
    const ditLength = durations[Math.floor(durations.length * 0.2)]; // 20th percentile
    
    console.log(`⏱️ Estimated dit length: ${ditLength.toFixed(3)}s`);
    
    const morseElements = [];
    let currentWord = [];
    let currentLetter = [];
    
    for (const segment of segments) {
      if (segment.type === 'key') {
        const ratio = segment.duration / ditLength;
        
        if (ratio < 2) {
          currentLetter.push('.');
        } else {
          currentLetter.push('-');
        }
      } else if (segment.type === 'space') {
        const ratio = segment.duration / ditLength;
        
        if (ratio > this.config.wordSpace * 0.7) {
          // Word space
          if (currentLetter.length > 0) {
            currentWord.push(currentLetter.join(''));
            currentLetter = [];
          }
          if (currentWord.length > 0) {
            morseElements.push(currentWord.join(' '));
            currentWord = [];
          }
        } else if (ratio > this.config.letterSpace * 0.7) {
          // Letter space
          if (currentLetter.length > 0) {
            currentWord.push(currentLetter.join(''));
            currentLetter = [];
          }
        }
      }
    }
    
    // Add remaining elements
    if (currentLetter.length > 0) {
      currentWord.push(currentLetter.join(''));
    }
    if (currentWord.length > 0) {
      morseElements.push(currentWord.join(' '));
    }
    
    return morseElements;
  }

  /**
   * Convert morse elements to text
   */
  morseToText(morseElements) {
    const words = [];
    
    for (const element of morseElements) {
      const letters = element.split(' ');
      const word = letters.map(morse => this.morseTable[morse] || '?').join('');
      words.push(word);
    }
    
    return words.join(' ').replace(/\?+/g, ' ').trim();
  }

  /**
   * Calculate WPM from timing
   */
  calculateWPM(segments) {
    const keyedSegments = segments.filter(s => s.type === 'key');
    if (keyedSegments.length === 0) return 0;
    
    const totalDuration = segments[segments.length - 1].end - segments[0].start;
    const totalElements = keyedSegments.length;
    
    // PARIS standard: 50 elements per word at standard spacing
    const wpm = (totalElements / 50) * (60 / totalDuration);
    return Math.round(Math.max(1, Math.min(50, wpm))); // Clamp to reasonable range
  }

  /**
   * Calculate decoding confidence
   */
  calculateConfidence(segments, decodedText) {
    let confidence = 0;
    
    // Base confidence from segment detection
    const keyedSegments = segments.filter(s => s.type === 'key').length;
    if (keyedSegments > 5) confidence += 30;
    
    // Confidence from valid morse characters
    const validChars = decodedText.replace(/[^A-Z0-9]/g, '').length;
    const totalChars = decodedText.length;
    if (totalChars > 0) {
      confidence += (validChars / totalChars) * 40;
    }
    
    // Confidence from recognized patterns
    if (/CQ|DE|K|73|QRT/.test(decodedText)) confidence += 20;
    if (/[A-Z0-9]{1,3}[0-9][A-Z0-9]{0,3}[A-Z]/.test(decodedText)) confidence += 10; // Callsign pattern
    
    return Math.round(Math.min(100, confidence));
  }

  /**
   * Estimate CW frequency using FFT-like analysis
   */
  estimateFrequency(audioBuffer) {
    // Simple frequency estimation by finding peak in spectrum
    const fftSize = 1024;
    const frequencies = [];
    
    for (let i = 0; i < audioBuffer.length - fftSize; i += fftSize) {
      const window = audioBuffer.slice(i, i + fftSize);
      const spectrum = this.simpleFFT(window);
      const peakFreq = this.findPeakFrequency(spectrum);
      if (peakFreq > 300 && peakFreq < 2000) { // CW frequency range
        frequencies.push(peakFreq);
      }
    }
    
    if (frequencies.length === 0) return 800; // Default
    
    // Return median frequency
    frequencies.sort((a, b) => a - b);
    return Math.round(frequencies[Math.floor(frequencies.length / 2)]);
  }

  /**
   * Simple FFT implementation for frequency analysis
   */
  simpleFFT(samples) {
    const N = samples.length;
    const spectrum = new Array(N / 2);
    
    for (let k = 0; k < N / 2; k++) {
      let real = 0;
      let imag = 0;
      
      for (let n = 0; n < N; n++) {
        const angle = -2 * Math.PI * k * n / N;
        real += samples[n] * Math.cos(angle);
        imag += samples[n] * Math.sin(angle);
      }
      
      spectrum[k] = Math.sqrt(real * real + imag * imag);
    }
    
    return spectrum;
  }

  /**
   * Find peak frequency in spectrum
   */
  findPeakFrequency(spectrum) {
    let maxIndex = 0;
    let maxValue = 0;
    
    for (let i = 0; i < spectrum.length; i++) {
      if (spectrum[i] > maxValue) {
        maxValue = spectrum[i];
        maxIndex = i;
      }
    }
    
    // Convert bin index to frequency
    return (maxIndex * this.config.sampleRate) / (2 * spectrum.length);
  }

  /**
   * Assess signal quality
   */
  assessSignalQuality(envelope) {
    if (envelope.length === 0) return 0;
    
    const maxLevel = Math.max(...envelope);
    const avgLevel = envelope.reduce((sum, val) => sum + val, 0) / envelope.length;
    const snr = maxLevel / (avgLevel + 0.001); // Signal to noise ratio
    
    return Math.round(Math.min(100, snr * 10));
  }

  /**
   * Get decoder statistics
   */
  getStats() {
    return {
      morseTableSize: Object.keys(this.morseTable).length,
      supportedCharacters: Object.values(this.morseTable).join(''),
      config: this.config
    };
  }
}

export default CWDecoder;