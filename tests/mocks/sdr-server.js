/**
 * Mock SDR Server for Testing
 * Simulates WebSDR, KiwiSDR, and OpenWebRX endpoints
 */

import express from 'express';
import { WebSocketServer } from 'ws';

class MockSDRServer {
  constructor(options = {}) {
    this.port = options.port || 8901;
    this.sdrType = options.sdrType || 'websdr';
    this.location = options.location || 'Test Location';
    this.quality = options.quality || 85;
    this.app = express();
    this.server = null;
    this.wsServer = null;
    this.clients = new Set();
    this.isOnline = true;
    this.responseDelay = options.responseDelay || 0;
    
    this.setupRoutes();
    this.setupWebSockets();
  }

  /**
   * Set up HTTP routes for different SDR types
   */
  setupRoutes() {
    // Enable CORS for testing
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      next();
    });

    // Add response delay if configured
    if (this.responseDelay > 0) {
      this.app.use((req, res, next) => {
        setTimeout(next, this.responseDelay);
      });
    }

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      if (!this.isOnline) {
        return res.status(503).json({ status: 'offline' });
      }
      res.json({
        status: 'online',
        sdr_type: this.sdrType,
        location: this.location,
        quality: this.quality,
        clients: this.clients.size,
        timestamp: new Date().toISOString()
      });
    });

    // SDR type-specific routes
    switch (this.sdrType) {
      case 'websdr':
        this.setupWebSDRRoutes();
        break;
      case 'kiwisdr':
        this.setupKiwiSDRRoutes();
        break;
      case 'openwebrx':
        this.setupOpenWebRXRoutes();
        break;
    }
  }

  /**
   * Set up WebSDR-specific routes
   */
  setupWebSDRRoutes() {
    // Main WebSDR interface
    this.app.get('/', (req, res) => {
      const html = this.generateWebSDRHTML();
      res.send(html);
    });

    // Frequency tuning endpoint
    this.app.get('/tune', (req, res) => {
      const frequency = req.query.f;
      const mode = req.query.mode || 'usb';
      
      res.json({
        frequency: parseInt(frequency),
        mode: mode,
        bandwidth: 3000,
        signal_strength: Math.floor(Math.random() * 100),
        timestamp: new Date().toISOString()
      });
    });

    // Audio stream endpoint (returns mock audio data)
    this.app.get('/audio.wav', (req, res) => {
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Content-Length', '44100'); // 1 second of 16-bit 44.1kHz
      
      // Generate mock audio data (silence with noise)
      const audioData = this.generateMockAudio(44100);
      res.send(audioData);
    });

    // WebSocket for real-time audio
    this.app.get('/ws', (req, res) => {
      res.json({ websocket_url: `ws://localhost:${this.port}/audio` });
    });
  }

  /**
   * Set up KiwiSDR-specific routes
   */
  setupKiwiSDRRoutes() {
    // Main KiwiSDR interface
    this.app.get('/', (req, res) => {
      const html = this.generateKiwiSDRHTML();
      res.send(html);
    });

    // Status endpoint
    this.app.get('/status', (req, res) => {
      res.json({
        name: this.location,
        sdr: 'KiwiSDR',
        loc: this.location,
        grid: 'JO32',
        asl: 100,
        hw: 'KiwiSDR v1.2',
        sw: 'v1.462',
        antenna: 'Random wire',
        users: this.clients.size,
        users_max: 4,
        avatar_ctime: Date.now(),
        gps: { lat: 52.0, lon: 5.0 }
      });
    });

    // Audio data endpoint
    this.app.get('/audio', (req, res) => {
      res.setHeader('Content-Type', 'application/octet-stream');
      const audioData = this.generateMockAudio(16000); // 1 second at 16kHz
      res.send(audioData);
    });
  }

  /**
   * Set up OpenWebRX-specific routes
   */
  setupOpenWebRXRoutes() {
    // Main OpenWebRX interface
    this.app.get('/', (req, res) => {
      const html = this.generateOpenWebRXHTML();
      res.send(html);
    });

    // Config endpoint
    this.app.get('/config', (req, res) => {
      res.json({
        receiver_name: this.location,
        receiver_location: this.location,
        receiver_gps: [52.0, 5.0],
        photo_title: 'Test SDR Station',
        samp_rate: 2400000,
        start_freq: 14200000,
        start_mod: 'usb'
      });
    });

    // Spectrum data endpoint
    this.app.get('/spectrum', (req, res) => {
      const spectrumData = this.generateMockSpectrum();
      res.json(spectrumData);
    });
  }

  /**
   * Set up WebSocket server for real-time audio streaming
   */
  setupWebSockets() {
    // WebSocket server will be created when HTTP server starts
  }

  /**
   * Generate mock WebSDR HTML page
   */
  generateWebSDRHTML() {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>WebSDR - ${this.location}</title>
</head>
<body>
    <h1>WebSDR at ${this.location}</h1>
    <div id="waterfall"></div>
    <div id="controls">
        <input type="text" id="frequency" placeholder="Frequency (kHz)">
        <select id="mode">
            <option value="am">AM</option>
            <option value="usb">USB</option>
            <option value="lsb">LSB</option>
            <option value="cw">CW</option>
        </select>
        <button onclick="tune()">Tune</button>
    </div>
    <audio id="audio" controls></audio>
    
    <script>
        function tune() {
            const freq = document.getElementById('frequency').value;
            const mode = document.getElementById('mode').value;
            fetch('/tune?f=' + freq + '&mode=' + mode)
                .then(r => r.json())
                .then(data => console.log('Tuned to:', data));
        }
        
        // Mock WebSocket connection
        const ws = new WebSocket('ws://localhost:${this.port}/audio');
        ws.onmessage = function(event) {
            // Handle audio data
        };
    </script>
</body>
</html>`;
  }

  /**
   * Generate mock KiwiSDR HTML page
   */
  generateKiwiSDRHTML() {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>KiwiSDR - ${this.location}</title>
</head>
<body>
    <h1>KiwiSDR at ${this.location}</h1>
    <div id="openwebrx-main-container">
        <div id="openwebrx-frequency-container">
            <div id="openwebrx-panel-receiver">
                <div id="webrx-actual-freq">14205.00</div>
            </div>
        </div>
        <canvas id="openwebrx-canvas-container"></canvas>
    </div>
    
    <script>
        console.log('KiwiSDR mock interface loaded');
    </script>
</body>
</html>`;
  }

  /**
   * Generate mock OpenWebRX HTML page
   */
  generateOpenWebRXHTML() {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>OpenWebRX - ${this.location}</title>
</head>
<body>
    <h1>OpenWebRX at ${this.location}</h1>
    <div id="openwebrx-main-container">
        <div id="openwebrx-panel-container">
            <div id="openwebrx-panel-receiver">
                <span id="webrx-actual-freq">14205000</span>
            </div>
        </div>
    </div>
    
    <script>
        console.log('OpenWebRX mock interface loaded');
    </script>
</body>
</html>`;
  }

  /**
   * Generate mock audio data
   */
  generateMockAudio(sampleCount) {
    const buffer = Buffer.alloc(sampleCount * 2); // 16-bit samples
    
    for (let i = 0; i < sampleCount; i++) {
      // Generate some noise + optional tone
      let sample = (Math.random() - 0.5) * 1000; // Noise
      
      // Add a test tone occasionally
      if (Math.random() > 0.8) {
        const tone = Math.sin(2 * Math.PI * 1000 * i / 16000) * 5000; // 1kHz tone
        sample += tone;
      }
      
      // Clamp to 16-bit range
      sample = Math.max(-32768, Math.min(32767, sample));
      buffer.writeInt16LE(sample, i * 2);
    }
    
    return buffer;
  }

  /**
   * Generate mock spectrum data
   */
  generateMockSpectrum() {
    const bins = 1024;
    const spectrum = new Array(bins);
    
    for (let i = 0; i < bins; i++) {
      // Generate realistic spectrum with noise floor and signals
      let power = -80 + Math.random() * 10; // Noise floor
      
      // Add some signal peaks
      if (i % 100 === 0) {
        power += 20 + Math.random() * 30; // Strong signal
      } else if (i % 50 === 0) {
        power += 10 + Math.random() * 15; // Weak signal
      }
      
      spectrum[i] = power;
    }
    
    return {
      timestamp: Date.now(),
      center_freq: 14200000,
      sample_rate: 2400000,
      fft_size: bins,
      spectrum: spectrum
    };
  }

  /**
   * Start the mock SDR server
   */
  async start() {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Set up WebSocket server
        this.wsServer = new WebSocketServer({ 
          server: this.server,
          path: '/audio'
        });
        
        this.wsServer.on('connection', (ws) => {
          this.clients.add(ws);
          console.log(`Mock SDR client connected. Total: ${this.clients.size}`);
          
          // Send periodic audio data
          const audioInterval = setInterval(() => {
            if (ws.readyState === ws.OPEN && this.isOnline) {
              const audioChunk = this.generateMockAudio(1600); // 0.1s at 16kHz
              ws.send(audioChunk);
            }
          }, 100);
          
          ws.on('close', () => {
            this.clients.delete(ws);
            clearInterval(audioInterval);
            console.log(`Mock SDR client disconnected. Total: ${this.clients.size}`);
          });
          
          ws.on('message', (data) => {
            // Handle client commands
            try {
              const command = JSON.parse(data);
              this.handleCommand(ws, command);
            } catch (e) {
              // Ignore invalid JSON
            }
          });
        });
        
        console.log(`Mock ${this.sdrType.toUpperCase()} server started on port ${this.port}`);
        resolve(`http://localhost:${this.port}`);
      });
    });
  }

  /**
   * Handle WebSocket commands
   */
  handleCommand(ws, command) {
    switch (command.type) {
      case 'tune':
        ws.send(JSON.stringify({
          type: 'tune_response',
          frequency: command.frequency,
          mode: command.mode,
          success: true
        }));
        break;
        
      case 'set_mode':
        ws.send(JSON.stringify({
          type: 'mode_response',
          mode: command.mode,
          success: true
        }));
        break;
        
      default:
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Unknown command'
        }));
    }
  }

  /**
   * Stop the mock SDR server
   */
  async stop() {
    return new Promise((resolve) => {
      if (this.wsServer) {
        this.wsServer.close();
      }
      
      if (this.server) {
        this.server.close(() => {
          console.log(`Mock ${this.sdrType.toUpperCase()} server stopped`);
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Set server online/offline status
   */
  setOnline(online) {
    this.isOnline = online;
    console.log(`Mock SDR server is now ${online ? 'online' : 'offline'}`);
  }

  /**
   * Simulate server degradation
   */
  simulateDegradation(degradationType) {
    switch (degradationType) {
      case 'slow':
        this.responseDelay = 5000; // 5 second delay
        break;
      case 'intermittent':
        // Randomly go offline/online
        setInterval(() => {
          this.setOnline(Math.random() > 0.3);
        }, 2000);
        break;
      case 'poor_audio':
        // Reduce audio quality
        this.quality = 30;
        break;
      case 'overloaded':
        // Simulate overloaded server
        this.app.use((req, res, next) => {
          if (Math.random() > 0.5) {
            return res.status(503).json({ error: 'Server overloaded' });
          }
          next();
        });
        break;
    }
  }

  /**
   * Get server statistics
   */
  getStats() {
    return {
      sdr_type: this.sdrType,
      location: this.location,
      port: this.port,
      is_online: this.isOnline,
      connected_clients: this.clients.size,
      quality: this.quality,
      response_delay: this.responseDelay,
      uptime: process.uptime()
    };
  }
}

export default MockSDRServer;