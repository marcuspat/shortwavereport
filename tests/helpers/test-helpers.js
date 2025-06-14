/**
 * Test Helper Functions
 * Common utilities for test setup and assertions
 */

import fs from 'fs/promises';
import path from 'path';
import { TestConfig } from '../test-config.js';

/**
 * Create a temporary test file with content
 */
export async function createTestFile(filename, content = 'test content', directory = null) {
  const testDir = directory || TestConfig.config.paths.testData;
  const filepath = path.join(testDir, filename);
  
  await fs.writeFile(filepath, content);
  return filepath;
}

/**
 * Create mock audio file for testing
 */
export async function createMockAudioFile(filename, duration = 1) {
  const filepath = path.join(TestConfig.config.paths.testAudio, filename);
  const sampleRate = 16000;
  const numSamples = sampleRate * duration;
  const buffer = Buffer.alloc(numSamples * 2); // 16-bit samples

  // Generate simple test pattern
  for (let i = 0; i < numSamples; i++) {
    const sample = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 16384; // 440Hz tone
    buffer.writeInt16LE(Math.floor(sample), i * 2);
  }

  await fs.writeFile(filepath, buffer);
  return filepath;
}

/**
 * Wait for a condition to be true with timeout
 */
export async function waitFor(condition, timeout = 5000, interval = 100) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Simulate network delay
 */
export async function simulateNetworkDelay(min = 100, max = 500) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Create mock HTTP response
 */
export function createMockResponse(data, options = {}) {
  const {
    status = 200,
    headers = { 'content-type': 'application/json' },
    delay = 0
  } = options;

  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Map(Object.entries(headers)),
    json: async () => {
      if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
      return typeof data === 'string' ? JSON.parse(data) : data;
    },
    text: async () => {
      if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
      return typeof data === 'string' ? data : JSON.stringify(data);
    },
    arrayBuffer: async () => {
      if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
      return Buffer.isBuffer(data) ? data.buffer : Buffer.from(data || '').buffer;
    }
  };
}

/**
 * Assert that a value is within a tolerance range
 */
export function assertWithinTolerance(actual, expected, tolerance, message) {
  const diff = Math.abs(actual - expected);
  const maxDiff = Math.abs(expected * tolerance);
  
  if (diff > maxDiff) {
    throw new Error(
      `${message || 'Value out of tolerance'}: ${actual} not within ${tolerance * 100}% of ${expected} (diff: ${diff}, max: ${maxDiff})`
    );
  }
}

/**
 * Assert that an array contains specific elements
 */
export function assertArrayContains(array, elements, message) {
  if (!Array.isArray(array)) {
    throw new Error(`${message || 'Expected array'}: got ${typeof array}`);
  }
  
  const missing = elements.filter(element => !array.includes(element));
  if (missing.length > 0) {
    throw new Error(`${message || 'Missing elements'}: ${missing.join(', ')}`);
  }
}

/**
 * Assert that an object has specific properties
 */
export function assertObjectHasProperties(obj, properties, message) {
  if (!obj || typeof obj !== 'object') {
    throw new Error(`${message || 'Expected object'}: got ${typeof obj}`);
  }
  
  const missing = properties.filter(prop => !(prop in obj));
  if (missing.length > 0) {
    throw new Error(`${message || 'Missing properties'}: ${missing.join(', ')}`);
  }
}

/**
 * Assert that a function throws an error
 */
export async function assertThrows(fn, expectedError, message) {
  try {
    await fn();
    throw new Error(`${message || 'Expected function to throw'}`);
  } catch (error) {
    if (expectedError && !error.message.includes(expectedError)) {
      throw new Error(
        `${message || 'Unexpected error'}: expected '${expectedError}', got '${error.message}'`
      );
    }
  }
}

/**
 * Create a mock function with call tracking
 */
export function createMockFunction(implementation) {
  const calls = [];
  
  const mockFn = (...args) => {
    calls.push({
      args,
      timestamp: Date.now(),
      result: null,
      error: null
    });
    
    try {
      const result = implementation ? implementation(...args) : undefined;
      calls[calls.length - 1].result = result;
      return result;
    } catch (error) {
      calls[calls.length - 1].error = error;
      throw error;
    }
  };
  
  // Add utility methods
  mockFn.calls = calls;
  mockFn.callCount = () => calls.length;
  mockFn.calledWith = (...args) => calls.some(call => 
    call.args.length === args.length && 
    call.args.every((arg, i) => arg === args[i])
  );
  mockFn.lastCall = () => calls[calls.length - 1];
  mockFn.reset = () => calls.length = 0;
  
  return mockFn;
}

/**
 * Deep clone an object for test isolation
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map(deepClone);
  if (typeof obj === 'object') {
    const cloned = {};
    Object.keys(obj).forEach(key => {
      cloned[key] = deepClone(obj[key]);
    });
    return cloned;
  }
  return obj;
}

/**
 * Generate random test data
 */
export const generateTestData = {
  string: (length = 10) => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from({ length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
  },
  
  number: (min = 0, max = 100) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },
  
  frequency: () => {
    const bands = [3500000, 7000000, 14000000, 21000000, 28000000];
    const base = bands[Math.floor(Math.random() * bands.length)];
    return base + Math.floor(Math.random() * 350000);
  },
  
  callsign: () => {
    const prefixes = ['W', 'K', 'G', 'DF', 'JA', 'VK', 'EA'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const number = Math.floor(Math.random() * 10);
    const suffix = generateTestData.string(3).toUpperCase();
    return `${prefix}${number}${suffix}`;
  },
  
  location: () => {
    const locations = [
      'University of Twente, Netherlands',
      'Berlin, Germany',
      'Tokyo, Japan',
      'New York, USA',
      'London, UK',
      'Paris, France'
    ];
    return locations[Math.floor(Math.random() * locations.length)];
  }
};

/**
 * Performance measurement helper
 */
export class PerformanceTimer {
  constructor() {
    this.startTime = null;
    this.measurements = [];
  }
  
  start() {
    this.startTime = Date.now();
  }
  
  lap(label) {
    if (!this.startTime) this.start();
    const now = Date.now();
    const duration = now - this.startTime;
    this.measurements.push({ label, duration, timestamp: now });
    return duration;
  }
  
  stop() {
    const duration = this.lap('total');
    this.startTime = null;
    return duration;
  }
  
  getSummary() {
    return {
      total: this.measurements[this.measurements.length - 1]?.duration || 0,
      laps: this.measurements.slice(0, -1),
      average: this.measurements.reduce((sum, m) => sum + m.duration, 0) / this.measurements.length
    };
  }
  
  reset() {
    this.startTime = null;
    this.measurements = [];
  }
}