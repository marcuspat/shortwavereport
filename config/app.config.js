/**
 * Application Configuration
 * Centralized configuration management for the Shortwavereport system
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment-specific configuration
const env = process.env.NODE_ENV || 'development';
const envFile = `.env.${env}`;

// Try to load environment-specific config first, fallback to .env
dotenv.config({ path: path.join(__dirname, '..', envFile) });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const config = {
  // Application Settings
  app: {
    name: 'Shortwavereport',
    version: '1.0.0',
    env: env,
    port: parseInt(process.env.PORT) || 3000,
    healthPort: parseInt(process.env.HEALTH_PORT) || 3000,
    websocketPort: parseInt(process.env.WEBSOCKET_PORT) || 8080,
    debug: process.env.DEBUG === 'true',
    mockData: process.env.MOCK_DATA === 'true'
  },

  // Redis Configuration
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB) || 0,
    retryDelayOnFailover: 100,
    enableReadyCheck: true,
    maxRetriesPerRequest: null
  },

  // Database Configuration
  database: {
    url: process.env.DATABASE_URL,
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT) || 5432,
    name: process.env.DATABASE_NAME || 'shortwavereport',
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    ssl: env === 'production'
  },

  // Monitoring Configuration
  monitoring: {
    prometheus: {
      port: parseInt(process.env.PROMETHEUS_PORT) || 9090,
      enabled: true
    },
    grafana: {
      port: parseInt(process.env.GRAFANA_PORT) || 3001,
      adminUser: process.env.GRAFANA_ADMIN_USER || 'admin',
      adminPassword: process.env.GRAFANA_ADMIN_PASSWORD || 'shortwavereport123'
    },
    healthCheck: {
      interval: 30000,
      timeout: 5000,
      retries: 3
    }
  },

  // Audio Processing Configuration
  audio: {
    sampleRate: parseInt(process.env.AUDIO_SAMPLE_RATE) || 48000,
    bufferSize: parseInt(process.env.AUDIO_BUFFER_SIZE) || 8192,
    maxFiles: parseInt(process.env.MAX_AUDIO_FILES) || 1000,
    retentionHours: parseInt(process.env.AUDIO_RETENTION_HOURS) || 24,
    formats: ['wav', 'mp3'],
    quality: env === 'production' ? 'high' : 'medium'
  },

  // SDR Configuration
  sdr: {
    maxConcurrentChecks: parseInt(process.env.MAX_CONCURRENT_SDR_CHECKS) || 5,
    timeoutMs: parseInt(process.env.SDR_TIMEOUT_MS) || 10000,
    retryAttempts: parseInt(process.env.SDR_RETRY_ATTEMPTS) || 3,
    scoreThreshold: parseInt(process.env.SDR_SCORE_THRESHOLD) || 30,
    skipDiscovery: process.env.SKIP_SDR_DISCOVERY === 'true',
    networks: ['WebSDR', 'KiwiSDR', 'OpenWebRX'],
    preferredBands: ['20m', '40m', '80m', '15m', '10m']
  },

  // Analysis Configuration
  analysis: {
    stt: {
      engine: process.env.STT_ENGINE || 'local',
      enabled: true
    },
    languageDetection: {
      enabled: process.env.LANGUAGE_DETECTION_ENABLED !== 'false'
    },
    cwDecoding: {
      enabled: process.env.CW_DECODING_ENABLED !== 'false'
    },
    callsignExtraction: {
      enabled: process.env.CALLSIGN_EXTRACTION_ENABLED !== 'false'
    }
  },

  // Report Generation Configuration
  reporting: {
    updateInterval: parseInt(process.env.REPORT_UPDATE_INTERVAL) || 30,
    autoRefresh: process.env.DASHBOARD_AUTO_REFRESH !== 'false',
    maxHistory: parseInt(process.env.MAX_REPORT_HISTORY) || 100,
    formats: ['html', 'json', 'csv']
  },

  // Security Configuration
  security: {
    apiRateLimit: parseInt(process.env.API_RATE_LIMIT) || 100,
    corsOrigin: process.env.CORS_ORIGIN || '*',
    sessionSecret: process.env.SESSION_SECRET || 'change-this-in-production',
    jwtSecret: process.env.JWT_SECRET || 'change-this-in-production',
    bcryptRounds: 12
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    filePath: process.env.LOG_FILE_PATH || './logs/shortwavereport.log',
    maxSize: process.env.LOG_MAX_SIZE || '10m',
    maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5,
    console: env === 'development'
  },

  // External Services Configuration
  external: {
    weather: {
      apiKey: process.env.WEATHER_API_KEY,
      enabled: !!process.env.WEATHER_API_KEY
    },
    geolocation: {
      apiKey: process.env.GEOLOCATION_API_KEY,
      enabled: !!process.env.GEOLOCATION_API_KEY
    },
    timezone: {
      apiKey: process.env.TIMEZONE_API_KEY,
      enabled: !!process.env.TIMEZONE_API_KEY
    }
  },

  // File Paths
  paths: {
    data: path.join(__dirname, '..', 'data'),
    audio: path.join(__dirname, '..', 'data', 'audio'),
    analysis: path.join(__dirname, '..', 'data', 'analysis'),
    memory: path.join(__dirname, '..', 'data', 'memory'),
    reports: path.join(__dirname, '..', 'data', 'reports'),
    logs: path.join(__dirname, '..', 'logs'),
    temp: path.join(__dirname, '..', 'temp')
  }
};

// Validation
function validateConfig() {
  const required = [];

  if (env === 'production') {
    if (!config.security.sessionSecret || config.security.sessionSecret === 'change-this-in-production') {
      required.push('SESSION_SECRET');
    }
    if (!config.security.jwtSecret || config.security.jwtSecret === 'change-this-in-production') {
      required.push('JWT_SECRET');
    }
  }

  if (required.length > 0) {
    throw new Error(`Missing required environment variables: ${required.join(', ')}`);
  }
}

// Validate configuration
validateConfig();

export default config;