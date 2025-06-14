/**
 * WebSDR Client - Real WebSDR integration for audio capture
 * Handles WebSocket connections and audio streaming from WebSDR instances
 */

import WebSocket from 'ws';
import EventEmitter from 'events';

class WebSDRClient extends EventEmitter {
  constructor(sdrUrl) {
    super();
    this.sdrUrl = sdrUrl;
    this.websocket = null;
    this.isConnected = false;
    this.audioBuffer = [];
    this.currentFrequency = null;
    this.currentMode = null;
    this.captureActive = false;
  }

  /**
   * Connect to WebSDR instance
   */
  async connect() {
    return new Promise((resolve, reject) => {
      try {
        // Convert HTTP URL to WebSocket URL
        const wsUrl = this.sdrUrl.replace('http://', 'ws://').replace('https://', 'wss://') + 'ws';
        
        this.websocket = new WebSocket(wsUrl, {
          headers: {
            'User-Agent': 'Shortwave-Monitor/1.0',
            'Origin': this.sdrUrl
          }
        });

        this.websocket.on('open', () => {
          console.log(`🔗 Connected to WebSDR: ${this.sdrUrl}`);
          this.isConnected = true;
          this.emit('connected');
          resolve();
        });

        this.websocket.on('message', (data) => {
          this.handleWebSDRMessage(data);
        });

        this.websocket.on('error', (error) => {
          console.error(`❌ WebSDR connection error: ${error.message}`);
          this.emit('error', error);
          reject(error);
        });

        this.websocket.on('close', () => {
          console.log(`🔌 WebSDR connection closed: ${this.sdrUrl}`);
          this.isConnected = false;
          this.emit('disconnected');
        });

        // Connection timeout
        setTimeout(() => {
          if (!this.isConnected) {
            reject(new Error('WebSDR connection timeout'));
          }
        }, 10000);

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle incoming WebSDR messages
   */
  handleWebSDRMessage(data) {
    try {
      // Check if this is audio data or control message
      if (Buffer.isBuffer(data)) {
        // Audio data
        if (this.captureActive) {
          this.audioBuffer.push(data);
          this.emit('audioData', data);
        }
      } else {
        // Control message
        const message = data.toString();
        this.emit('message', message);
      }
    } catch (error) {
      this.emit('error', error);
    }
  }

  /**
   * Set frequency and mode
   */
  async setFrequency(frequency, mode = 'usb') {
    if (!this.isConnected) {
      throw new Error('Not connected to WebSDR');
    }

    return new Promise((resolve, reject) => {
      const command = {
        type: 'set_frequency',
        frequency: frequency,
        mode: mode
      };

      this.websocket.send(JSON.stringify(command));
      this.currentFrequency = frequency;
      this.currentMode = mode;

      // Wait for confirmation (simplified)
      setTimeout(() => {
        console.log(`📻 Set frequency: ${frequency} Hz, mode: ${mode}`);
        resolve();
      }, 1000);
    });
  }

  /**
   * Start audio capture
   */
  async startCapture(durationMs = 60000) {
    if (!this.isConnected) {
      throw new Error('Not connected to WebSDR');
    }

    this.audioBuffer = [];
    this.captureActive = true;

    console.log(`🎙️ Starting audio capture for ${durationMs}ms...`);

    // Send capture start command
    const command = {
      type: 'start_audio',
      format: 'wav',
      sampleRate: 16000
    };

    this.websocket.send(JSON.stringify(command));

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.stopCapture();
        const audioData = Buffer.concat(this.audioBuffer);
        
        console.log(`✅ Audio capture complete: ${audioData.length} bytes`);
        resolve(audioData);
      }, durationMs);

      this.once('error', (error) => {
        clearTimeout(timeout);
        this.stopCapture();
        reject(error);
      });
    });
  }

  /**
   * Stop audio capture
   */
  stopCapture() {
    this.captureActive = false;
    
    if (this.websocket && this.isConnected) {
      const command = { type: 'stop_audio' };
      this.websocket.send(JSON.stringify(command));
    }
  }

  /**
   * Disconnect from WebSDR
   */
  disconnect() {
    if (this.websocket) {
      this.captureActive = false;
      this.websocket.close();
      this.websocket = null;
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      connected: this.isConnected,
      frequency: this.currentFrequency,
      mode: this.currentMode,
      capturing: this.captureActive,
      bufferSize: this.audioBuffer.length
    };
  }
}

/**
 * KiwiSDR Client - Specialized client for KiwiSDR API
 */
class KiwiSDRClient extends EventEmitter {
  constructor(sdrUrl) {
    super();
    this.sdrUrl = sdrUrl;
    this.websocket = null;
    this.isConnected = false;
    this.sessionId = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      try {
        // KiwiSDR uses different WebSocket protocol
        const wsUrl = this.sdrUrl.replace('http://', 'ws://') + ':8073/kiwi';
        
        this.websocket = new WebSocket(wsUrl);

        this.websocket.on('open', () => {
          console.log(`🥝 Connected to KiwiSDR: ${this.sdrUrl}`);
          this.isConnected = true;
          this.initializeKiwiSession();
          resolve();
        });

        this.websocket.on('message', (data) => {
          this.handleKiwiMessage(data);
        });

        this.websocket.on('error', (error) => {
          console.error(`❌ KiwiSDR connection error: ${error.message}`);
          reject(error);
        });

        this.websocket.on('close', () => {
          console.log(`🔌 KiwiSDR connection closed: ${this.sdrUrl}`);
          this.isConnected = false;
          this.emit('disconnected');
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  initializeKiwiSession() {
    // KiwiSDR-specific initialization
    const initMessage = {
      msg: 'SET auth t=kiwi p=#',
      zoom: 0,
      start: 0
    };

    this.websocket.send(JSON.stringify(initMessage));
  }

  handleKiwiMessage(data) {
    // Handle KiwiSDR-specific message format
    try {
      if (typeof data === 'string') {
        const message = JSON.parse(data);
        if (message.msg && message.msg.startsWith('MSG')) {
          // Status message
          this.emit('status', message);
        }
      } else {
        // Binary audio data
        this.emit('audioData', data);
      }
    } catch (error) {
      this.emit('error', error);
    }
  }

  async setFrequency(frequency, mode = 'usb') {
    if (!this.isConnected) {
      throw new Error('Not connected to KiwiSDR');
    }

    const command = {
      msg: 'SET mod=' + mode + ' low_cut=300 high_cut=2700 freq=' + (frequency / 1000)
    };

    this.websocket.send(JSON.stringify(command));
    console.log(`📻 KiwiSDR set frequency: ${frequency} Hz, mode: ${mode}`);
  }

  async startCapture(durationMs = 60000) {
    // KiwiSDR-specific audio capture
    const command = {
      msg: 'SET agc=1 hang=1 thresh=-100 slope=6 decay=1000 manGain=50'
    };

    this.websocket.send(JSON.stringify(command));
    
    return new Promise((resolve) => {
      const audioChunks = [];
      
      const dataHandler = (data) => {
        audioChunks.push(data);
      };
      
      this.on('audioData', dataHandler);
      
      setTimeout(() => {
        this.off('audioData', dataHandler);
        const audioData = Buffer.concat(audioChunks);
        resolve(audioData);
      }, durationMs);
    });
  }

  disconnect() {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
  }
}

/**
 * SDR Client Factory - Creates appropriate client based on SDR type
 */
class SDRClientFactory {
  static createClient(sdr) {
    switch (sdr.network) {
      case 'KiwiSDR':
        return new KiwiSDRClient(sdr.url);
      case 'WebSDR':
      case 'OpenWebRX':
      default:
        return new WebSDRClient(sdr.url);
    }
  }

  static async testConnection(sdr, timeout = 10000) {
    const client = this.createClient(sdr);
    
    try {
      await Promise.race([
        client.connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), timeout)
        )
      ]);
      
      client.disconnect();
      return true;
    } catch (error) {
      client.disconnect();
      return false;
    }
  }
}

export { WebSDRClient, KiwiSDRClient, SDRClientFactory };
export default WebSDRClient;