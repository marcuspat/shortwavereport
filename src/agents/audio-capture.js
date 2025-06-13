/**
 * Audio Capture Agent - SPARC Phase 2
 * Captures audio samples from WebSDR instances
 */

import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';
import { spawn } from 'child_process';
import MemoryManager from '../memory/memory-manager.js';

class AudioCaptureAgent {
  constructor() {
    this.memory = new MemoryManager();
    this.audioDir = path.join(process.cwd(), 'data', 'audio');
    this.capturedSamples = [];
    this.captureConfig = {
      sampleRate: 16000,
      duration: 60, // seconds
      format: 'wav',
      channels: 1
    };
    this.initializeAudioDir();
  }

  async initializeAudioDir() {
    try {
      await fs.mkdir(this.audioDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create audio directory:', error);
    }
  }

  /**
   * Main audio capture workflow
   */
  async execute() {
    console.log('🎵 Starting Audio Capture Phase...');
    
    try {
      // Wait for SDR discovery to complete
      const activeSDRs = await this.memory.waitFor('sdr_ready', 30000);
      const sdrList = await this.memory.query('active_sdrs');
      
      if (!sdrList || sdrList.length === 0) {
        throw new Error('No active SDRs available for capture');
      }

      console.log(`📡 Found ${sdrList.length} active SDRs for capture`);

      // Select top SDRs for capture
      const selectedSDRs = sdrList.slice(0, 3); // Top 3 SDRs
      
      // Parallel capture across frequency bands
      const capturePromises = [];
      
      for (const sdr of selectedSDRs) {
        capturePromises.push(
          this.captureHFVoice(sdr),
          this.captureBroadcast(sdr),
          this.captureCW(sdr),
          this.captureUtility(sdr)
        );
      }

      const results = await Promise.allSettled(capturePromises);
      
      // Process results
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          console.log(`✅ Capture ${index + 1}: Success`);
          if (result.value) {
            this.capturedSamples.push(result.value);
          }
        } else {
          console.log(`❌ Capture ${index + 1}: Failed - ${result.reason.message}`);
        }
      });

      // Process captured audio files
      await this.processAudioFiles();

      // Store results in memory
      await this.memory.store('audio_samples', this.capturedSamples);
      await this.memory.signal('capture_complete', {
        count: this.capturedSamples.length,
        timestamp: new Date().toISOString()
      });

      console.log(`🎯 Audio capture complete: ${this.capturedSamples.length} samples captured`);
      return this.capturedSamples;

    } catch (error) {
      console.error('❌ Audio Capture failed:', error);
      throw error;
    }
  }

  /**
   * Capture HF voice frequencies (14.200-14.350 MHz)
   */
  async captureHFVoice(sdr) {
    return await this.captureFrequency(sdr, {
      frequency: 14250000, // 14.25 MHz
      bandwidth: 3000,
      mode: 'usb',
      type: 'hf_voice',
      description: 'Amateur radio voice communications'
    });
  }

  /**
   * Capture shortwave broadcast (9-12 MHz)
   */
  async captureBroadcast(sdr) {
    return await this.captureFrequency(sdr, {
      frequency: 9500000, // 9.5 MHz
      bandwidth: 5000,
      mode: 'am',
      type: 'broadcast',
      description: 'Shortwave broadcast stations'
    });
  }

  /**
   * Capture CW/digital modes (14.000-14.070 MHz)
   */
  async captureCW(sdr) {
    return await this.captureFrequency(sdr, {
      frequency: 14030000, // 14.03 MHz
      bandwidth: 500,
      mode: 'cw',
      type: 'cw_digital',
      description: 'CW and digital modes'
    });
  }

  /**
   * Capture utility stations (8-12 MHz)
   */
  async captureUtility(sdr) {
    return await this.captureFrequency(sdr, {
      frequency: 10000000, // 10 MHz
      bandwidth: 3000,
      mode: 'usb',
      type: 'utility',
      description: 'Utility and maritime stations'
    });
  }

  /**
   * Generic frequency capture method
   */
  async captureFrequency(sdr, config) {
    console.log(`🎙️ Capturing ${config.type} from ${sdr.location} at ${config.frequency/1000000} MHz`);
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${config.type}_${sdr.location.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.wav`;
    const filepath = path.join(this.audioDir, filename);

    try {
      // For WebSDR, we need to simulate audio capture since we can't directly access WebAudio API
      // In a real implementation, this would interface with the WebSDR's audio stream
      const audioData = await this.simulateAudioCapture(sdr, config);
      
      if (audioData) {
        await fs.writeFile(filepath, audioData);
        
        return {
          id: `${sdr.url}_${config.type}_${timestamp}`,
          filename: filename,
          filepath: filepath,
          sdr: sdr,
          config: config,
          metadata: {
            frequency: config.frequency,
            mode: config.mode,
            bandwidth: config.bandwidth,
            duration: this.captureConfig.duration,
            sampleRate: this.captureConfig.sampleRate,
            timestamp: new Date().toISOString(),
            quality_estimate: this.estimateSignalQuality(sdr)
          }
        };
      }
    } catch (error) {
      console.error(`Failed to capture ${config.type} from ${sdr.location}:`, error);
      throw error;
    }
  }

  /**
   * Simulate audio capture (placeholder for real WebSDR integration)
   */
  async simulateAudioCapture(sdr, config) {
    // In a real implementation, this would:
    // 1. Connect to WebSDR's WebSocket or audio stream
    // 2. Set frequency and mode
    // 3. Capture audio data for specified duration
    // 4. Return raw audio data
    
    console.log(`🔧 Simulating capture from ${sdr.url} at ${config.frequency} Hz`);
    
    // Generate placeholder audio data (silence)
    const sampleRate = this.captureConfig.sampleRate;
    const duration = this.captureConfig.duration;
    const numSamples = sampleRate * duration;
    const buffer = Buffer.alloc(numSamples * 2); // 16-bit samples
    
    // Add some random noise to simulate audio
    for (let i = 0; i < numSamples; i++) {
      const sample = Math.floor((Math.random() - 0.5) * 1000); // Low-level noise
      buffer.writeInt16LE(sample, i * 2);
    }
    
    return buffer;
  }

  /**
   * Process captured audio files with ffmpeg
   */
  async processAudioFiles() {
    console.log('🔄 Processing captured audio files...');
    
    const processingPromises = this.capturedSamples.map(async (sample) => {
      try {
        const inputPath = sample.filepath;
        const outputPath = inputPath.replace('.wav', '_processed.wav');
        
        await this.processWithFFmpeg(inputPath, outputPath);
        
        // Update sample metadata
        sample.processed_filepath = outputPath;
        sample.processed = true;
        
        console.log(`✅ Processed: ${sample.filename}`);
      } catch (error) {
        console.error(`❌ Failed to process ${sample.filename}:`, error);
        sample.processed = false;
        sample.error = error.message;
      }
    });

    await Promise.allSettled(processingPromises);
  }

  /**
   * Process audio with ffmpeg
   */
  async processWithFFmpeg(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', inputPath,
        '-ar', this.captureConfig.sampleRate.toString(),
        '-ac', this.captureConfig.channels.toString(),
        '-acodec', 'pcm_s16le',
        '-y', // Overwrite output file
        outputPath
      ]);

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg process exited with code ${code}`));
        }
      });

      ffmpeg.on('error', (error) => {
        reject(new Error(`FFmpeg error: ${error.message}`));
      });
    });
  }

  /**
   * Estimate signal quality based on SDR characteristics
   */
  estimateSignalQuality(sdr) {
    // Base quality on SDR quality score and network type
    let quality = sdr.quality_score || 50;
    
    if (sdr.network === 'WebSDR') quality += 10;
    if (sdr.response_time < 1000) quality += 10;
    if (sdr.location.includes('University')) quality += 5;
    
    return Math.min(100, quality);
  }
}

// Allow standalone execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const agent = new AudioCaptureAgent();
  agent.execute().catch(console.error);
}

export default AudioCaptureAgent;