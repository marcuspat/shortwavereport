/**
 * Secure Command Execution Utility for Shortwave Monitor
 * Prevents command injection and ensures safe file operations
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

export class SecureCommandExecutor {
  /**
   * Validate file paths to prevent path traversal attacks
   */
  static validatePath(filePath, allowedBaseDir = null) {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('Invalid file path');
    }

    // Set default allowed directory
    const baseDir = allowedBaseDir || path.resolve(process.cwd(), 'data');
    const resolvedPath = path.resolve(filePath);
    
    // Ensure path is within allowed directory
    if (!resolvedPath.startsWith(baseDir)) {
      throw new Error(`Path outside allowed directory: ${baseDir}`);
    }
    
    // Check for dangerous characters that could be used for injection
    const dangerousChars = /[;&|`$\\<>]/;
    if (dangerousChars.test(filePath)) {
      throw new Error('Dangerous characters detected in path');
    }
    
    // Check for path traversal attempts
    const traversalPatterns = /(\.\.[\/\\]|[\/\\]\.\.[\/\\]|[\/\\]\.\.$)/;
    if (traversalPatterns.test(filePath)) {
      throw new Error('Path traversal attempt detected');
    }
    
    return resolvedPath;
  }

  /**
   * Sanitize filenames to only allow safe characters
   */
  static sanitizeFilename(filename) {
    if (!filename || typeof filename !== 'string') {
      return 'unknown';
    }
    
    // Allow only alphanumeric, underscore, hyphen, and dot
    // Remove any other characters that could be dangerous
    const sanitized = filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_') // Replace multiple underscores with single
      .substring(0, 255); // Limit length
    
    // Ensure filename doesn't start with dot or hyphen
    return sanitized.replace(/^[.-]/, 'file_');
  }

  /**
   * Validate audio configuration parameters
   */
  static validateAudioConfig(config) {
    const validatedConfig = {
      sampleRate: 16000,
      channels: 1,
      duration: 60,
      format: 'wav'
    };

    if (config.sampleRate) {
      const rate = parseInt(config.sampleRate);
      if (isNaN(rate) || rate < 8000 || rate > 48000) {
        throw new Error('Invalid sample rate: must be between 8000 and 48000');
      }
      validatedConfig.sampleRate = rate;
    }

    if (config.channels) {
      const channels = parseInt(config.channels);
      if (isNaN(channels) || channels < 1 || channels > 2) {
        throw new Error('Invalid channels: must be 1 or 2');
      }
      validatedConfig.channels = channels;
    }

    if (config.duration) {
      const duration = parseInt(config.duration);
      if (isNaN(duration) || duration < 1 || duration > 300) {
        throw new Error('Invalid duration: must be between 1 and 300 seconds');
      }
      validatedConfig.duration = duration;
    }

    return validatedConfig;
  }

  /**
   * Securely execute FFmpeg with validated parameters
   */
  static async executeFFmpeg(inputPath, outputPath, options = {}) {
    try {
      // Validate paths
      const safeInputPath = this.validatePath(inputPath);
      const safeOutputPath = this.validatePath(outputPath);
      
      // Validate audio configuration
      const config = this.validateAudioConfig(options);
      
      // Check if input file exists
      try {
        await fs.access(safeInputPath);
      } catch {
        throw new Error('Input file does not exist');
      }

      // Ensure output directory exists
      const outputDir = path.dirname(safeOutputPath);
      await fs.mkdir(outputDir, { recursive: true });
      
      // Build FFmpeg arguments with strict validation
      const args = [
        '-i', safeInputPath,
        '-ar', String(config.sampleRate),
        '-ac', String(config.channels),
        '-acodec', 'pcm_s16le',
        '-f', 'wav',
        '-y', // Overwrite output file
        safeOutputPath
      ];

      console.log(`🔒 Executing secure FFmpeg: ${args.join(' ')}`);

      return new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', args, {
          stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...process.env, PATH: process.env.PATH }, // Clean environment
          cwd: path.dirname(safeInputPath), // Set working directory
          timeout: 120000 // 2 minute timeout
        });

        let stdout = '';
        let stderr = '';

        ffmpeg.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        ffmpeg.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        ffmpeg.on('close', (code) => {
          if (code === 0) {
            console.log(`✅ FFmpeg completed successfully`);
            resolve({ stdout, stderr, code });
          } else {
            reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
          }
        });

        ffmpeg.on('error', (error) => {
          reject(new Error(`FFmpeg execution error: ${error.message}`));
        });

        // Handle timeout
        ffmpeg.on('exit', (code, signal) => {
          if (signal === 'SIGTERM') {
            reject(new Error('FFmpeg process timed out'));
          }
        });
      });
    } catch (error) {
      throw new Error(`Command validation failed: ${error.message}`);
    }
  }

  /**
   * Create secure temporary file
   */
  static async createTempFile(prefix = 'temp', extension = '.tmp') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const safePrefix = this.sanitizeFilename(prefix);
    const safeExtension = extension.replace(/[^a-zA-Z0-9.]/g, '');
    
    const filename = `${safePrefix}_${timestamp}_${random}${safeExtension}`;
    const tempDir = path.join(process.cwd(), 'data', 'temp');
    
    await fs.mkdir(tempDir, { recursive: true });
    
    const filePath = path.join(tempDir, filename);
    return this.validatePath(filePath);
  }

  /**
   * Clean up temporary files older than specified age
   */
  static async cleanupTempFiles(maxAgeMs = 24 * 60 * 60 * 1000) { // 24 hours
    try {
      const tempDir = path.join(process.cwd(), 'data', 'temp');
      const files = await fs.readdir(tempDir);
      const now = Date.now();
      
      let cleaned = 0;
      
      for (const file of files) {
        const filePath = path.join(tempDir, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtime.getTime() > maxAgeMs) {
          await fs.unlink(filePath);
          cleaned++;
        }
      }
      
      console.log(`🧹 Cleaned up ${cleaned} temporary files`);
      return cleaned;
    } catch (error) {
      console.error('Error cleaning temporary files:', error.message);
      return 0;
    }
  }

  /**
   * Validate command line arguments to prevent injection
   */
  static validateCommandArgs(args) {
    if (!Array.isArray(args)) {
      throw new Error('Arguments must be an array');
    }

    const dangerousPatterns = [
      /[;&|`$\\]/,  // Shell metacharacters
      /\$\(/,       // Command substitution
      /`.*`/,       // Backticks
      /\|\|/,       // OR operator
      /&&/,         // AND operator
      />/,          // Redirection
      /</,          // Input redirection
    ];

    for (const arg of args) {
      if (typeof arg !== 'string') {
        throw new Error('All arguments must be strings');
      }
      
      for (const pattern of dangerousPatterns) {
        if (pattern.test(arg)) {
          throw new Error(`Dangerous pattern detected in argument: ${arg}`);
        }
      }
    }

    return args;
  }

  /**
   * Execute command with security checks
   */
  static async executeSecureCommand(command, args, options = {}) {
    // Validate command name
    const allowedCommands = ['ffmpeg', 'node'];
    if (!allowedCommands.includes(command)) {
      throw new Error(`Command not allowed: ${command}`);
    }

    // Validate arguments
    const safeArgs = this.validateCommandArgs(args);
    
    // Set secure options
    const secureOptions = {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { PATH: process.env.PATH }, // Minimal environment
      timeout: options.timeout || 120000,
      cwd: process.cwd(),
      ...options
    };

    return new Promise((resolve, reject) => {
      const child = spawn(command, safeArgs, secureOptions);
      
      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr, code });
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        reject(new Error(`Command execution error: ${error.message}`));
      });
    });
  }
}

export default SecureCommandExecutor;