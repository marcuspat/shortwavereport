/**
 * Memory Manager for Shortwave Monitor SPARC System
 * Handles inter-agent communication and state persistence
 */

import fs from 'fs/promises';
import path from 'path';

class MemoryManager {
  constructor() {
    this.memoryDir = path.join(process.cwd(), 'data', 'memory');
    this.namespace = 'shortwave_monitor';
    this.initializeMemory();
  }

  async initializeMemory() {
    try {
      await fs.mkdir(this.memoryDir, { recursive: true });
    } catch (error) {
      console.error('Failed to initialize memory directory:', error);
    }
  }

  /**
   * Store data in memory with namespace
   */
  async store(key, data) {
    const filePath = path.join(this.memoryDir, `${this.namespace}_${key}.json`);
    const memoryEntry = {
      key,
      data,
      timestamp: new Date().toISOString(),
      namespace: this.namespace
    };

    try {
      await fs.writeFile(filePath, JSON.stringify(memoryEntry, null, 2));
      console.log(`Memory stored: ${key}`);
      return true;
    } catch (error) {
      console.error(`Failed to store memory ${key}:`, error);
      return false;
    }
  }

  /**
   * Query data from memory
   */
  async query(key) {
    const filePath = path.join(this.memoryDir, `${this.namespace}_${key}.json`);
    
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const memoryEntry = JSON.parse(content);
      return memoryEntry.data;
    } catch (error) {
      console.log(`Memory key not found: ${key}`);
      return null;
    }
  }

  /**
   * List all memory keys
   */
  async list() {
    try {
      const files = await fs.readdir(this.memoryDir);
      return files
        .filter(file => file.startsWith(this.namespace))
        .map(file => file.replace(`${this.namespace}_`, '').replace('.json', ''));
    } catch (error) {
      console.error('Failed to list memory keys:', error);
      return [];
    }
  }

  /**
   * Check if memory key exists
   */
  async exists(key) {
    const filePath = path.join(this.memoryDir, `${this.namespace}_${key}.json`);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Wait for a memory key to be available
   */
  async waitFor(key, timeoutMs = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      if (await this.exists(key)) {
        return await this.query(key);
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error(`Timeout waiting for memory key: ${key}`);
  }

  /**
   * Signal completion to other agents
   */
  async signal(signal, data = {}) {
    return await this.store(signal, {
      ...data,
      signal: true,
      timestamp: new Date().toISOString()
    });
  }
}

export default MemoryManager;