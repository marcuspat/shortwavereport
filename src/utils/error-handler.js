/**
 * Comprehensive Error Handler for Shortwave Monitor
 * Implements error classification, logging, and recovery strategies
 */

import fs from 'fs/promises';
import path from 'path';

export class ErrorHandler {
  constructor() {
    this.errorLogPath = path.join(process.cwd(), 'data', 'logs', 'errors.log');
    this.errorCounters = new Map();
    this.initializeLogging();
  }

  async initializeLogging() {
    const logDir = path.dirname(this.errorLogPath);
    try {
      await fs.mkdir(logDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create error log directory:', error);
    }
  }

  /**
   * Handle errors with classification and recovery
   */
  async handleError(error, context = {}) {
    const errorInfo = this.classifyError(error, context);
    await this.logError(errorInfo);
    this.updateErrorCounters(errorInfo);
    
    return this.determineRecoveryAction(errorInfo);
  }

  /**
   * Classify errors by type and severity
   */
  classifyError(error, context) {
    const errorInfo = {
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      context: context,
      type: 'unknown',
      severity: 'medium',
      recoverable: true,
      retryable: false
    };

    // Network errors
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || 
        error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
      errorInfo.type = 'network';
      errorInfo.severity = 'low';
      errorInfo.retryable = true;
      errorInfo.recoverable = true;
    }
    // SDR connection errors
    else if (error.message.includes('SDR') || error.message.includes('WebSDR') || 
             error.message.includes('KiwiSDR')) {
      errorInfo.type = 'sdr_connection';
      errorInfo.severity = 'medium';
      errorInfo.retryable = true;
      errorInfo.recoverable = true;
    }
    // Audio processing errors
    else if (error.message.includes('ffmpeg') || error.message.includes('audio') || 
             error.message.includes('capture')) {
      errorInfo.type = 'audio_processing';
      errorInfo.severity = 'medium';
      errorInfo.retryable = false;
      errorInfo.recoverable = true;
    }
    // Memory/storage errors
    else if (error.code === 'ENOSPC' || error.code === 'ENOENT' || 
             error.message.includes('memory') || error.message.includes('storage')) {
      errorInfo.type = 'storage';
      errorInfo.severity = 'high';
      errorInfo.retryable = false;
      errorInfo.recoverable = false;
    }
    // Rate limiting errors
    else if (error.status === 429 || error.message.includes('rate limit')) {
      errorInfo.type = 'rate_limit';
      errorInfo.severity = 'low';
      errorInfo.retryable = true;
      errorInfo.recoverable = true;
    }
    // System resource errors
    else if (error.code === 'EMFILE' || error.code === 'ENOMEM') {
      errorInfo.type = 'resource_exhaustion';
      errorInfo.severity = 'high';
      errorInfo.retryable = true;
      errorInfo.recoverable = true;
    }

    return errorInfo;
  }

  /**
   * Log errors to file and console
   */
  async logError(errorInfo) {
    const logEntry = {
      ...errorInfo,
      logLevel: this.getSeverityLogLevel(errorInfo.severity)
    };

    const logLine = JSON.stringify(logEntry) + '\n';
    
    try {
      await fs.appendFile(this.errorLogPath, logLine);
    } catch (logError) {
      console.error('Failed to write error log:', logError);
    }

    // Console output based on severity
    const prefix = this.getConsolePrefix(errorInfo.severity);
    console.error(`${prefix} [${errorInfo.type}] ${errorInfo.message}`);
    
    if (errorInfo.severity === 'high') {
      console.error('Stack trace:', errorInfo.stack);
    }
  }

  /**
   * Update error counters for monitoring
   */
  updateErrorCounters(errorInfo) {
    const key = `${errorInfo.type}_${errorInfo.severity}`;
    const current = this.errorCounters.get(key) || 0;
    this.errorCounters.set(key, current + 1);
  }

  /**
   * Determine recovery action based on error type
   */
  determineRecoveryAction(errorInfo) {
    switch (errorInfo.type) {
      case 'network':
        return {
          action: 'retry',
          delay: 2000,
          maxRetries: 5,
          backoffMultiplier: 2
        };
      
      case 'sdr_connection':
        return {
          action: 'circuit_breaker',
          fallback: 'use_alternative_sdr',
          delay: 5000,
          maxRetries: 3
        };
      
      case 'rate_limit':
        return {
          action: 'backoff',
          delay: 60000, // 1 minute
          maxRetries: 10
        };
      
      case 'audio_processing':
        return {
          action: 'graceful_degradation',
          fallback: 'skip_processing',
          alternative: 'reduce_quality'
        };
      
      case 'storage':
        return {
          action: 'cleanup_and_retry',
          cleanup: 'old_files',
          critical: true
        };
      
      case 'resource_exhaustion':
        return {
          action: 'throttle',
          reduce: 'concurrent_operations',
          delay: 10000
        };
      
      default:
        return {
          action: 'fail_gracefully',
          notify: true
        };
    }
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    const stats = {};
    for (const [key, count] of this.errorCounters.entries()) {
      stats[key] = count;
    }
    return stats;
  }

  /**
   * Helper methods
   */
  getSeverityLogLevel(severity) {
    switch (severity) {
      case 'low': return 'WARN';
      case 'medium': return 'ERROR';
      case 'high': return 'CRITICAL';
      default: return 'ERROR';
    }
  }

  getConsolePrefix(severity) {
    switch (severity) {
      case 'low': return '⚠️';
      case 'medium': return '❌';
      case 'high': return '🚨';
      default: return '❌';
    }
  }

  /**
   * Clear error counters (for testing or reset)
   */
  clearCounters() {
    this.errorCounters.clear();
  }
}

export default ErrorHandler;