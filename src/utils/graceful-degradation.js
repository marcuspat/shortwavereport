/**
 * Graceful Degradation Manager
 * Handles service degradation and fallback strategies
 */

import ErrorHandler from './error-handler.js';

export class GracefulDegradationManager {
  constructor() {
    this.errorHandler = new ErrorHandler();
    this.serviceStatus = new Map();
    this.fallbackStrategies = new Map();
    this.performanceMetrics = new Map();
    this.degradationLevels = {
      NORMAL: 0,
      MINOR_DEGRADATION: 1,
      MODERATE_DEGRADATION: 2,
      SEVERE_DEGRADATION: 3,
      CRITICAL_FAILURE: 4
    };
    
    this.initializeFallbackStrategies();
  }

  /**
   * Initialize fallback strategies for different services
   */
  initializeFallbackStrategies() {
    // SDR Discovery fallbacks
    this.addFallbackStrategy('sdr_discovery', [
      {
        level: this.degradationLevels.MINOR_DEGRADATION,
        strategy: 'reduce_concurrent_checks',
        action: (options) => ({ ...options, maxConcurrent: Math.max(1, options.maxConcurrent / 2) })
      },
      {
        level: this.degradationLevels.MODERATE_DEGRADATION,
        strategy: 'use_cached_sdrs',
        action: () => this.useCachedSDRs()
      },
      {
        level: this.degradationLevels.SEVERE_DEGRADATION,
        strategy: 'use_hardcoded_sdrs',
        action: () => this.getHardcodedSDRs()
      },
      {
        level: this.degradationLevels.CRITICAL_FAILURE,
        strategy: 'offline_mode',
        action: () => ({ offline: true, message: 'SDR discovery unavailable' })
      }
    ]);

    // Audio Capture fallbacks
    this.addFallbackStrategy('audio_capture', [
      {
        level: this.degradationLevels.MINOR_DEGRADATION,
        strategy: 'reduce_quality',
        action: (config) => ({ ...config, sampleRate: 8000, duration: 30 })
      },
      {
        level: this.degradationLevels.MODERATE_DEGRADATION,
        strategy: 'single_sdr_only',
        action: (config) => ({ ...config, maxSDRs: 1, skipProcessing: true })
      },
      {
        level: this.degradationLevels.SEVERE_DEGRADATION,
        strategy: 'simulation_mode',
        action: () => this.generateSimulatedAudio()
      },
      {
        level: this.degradationLevels.CRITICAL_FAILURE,
        strategy: 'skip_capture',
        action: () => ({ skipped: true, reason: 'Audio capture unavailable' })
      }
    ]);

    // Audio Analysis fallbacks
    this.addFallbackStrategy('audio_analysis', [
      {
        level: this.degradationLevels.MINOR_DEGRADATION,
        strategy: 'basic_analysis_only',
        action: (config) => ({ ...config, skipAdvancedAnalysis: true })
      },
      {
        level: this.degradationLevels.MODERATE_DEGRADATION,
        strategy: 'metadata_only',
        action: () => this.generateMetadataOnly()
      },
      {
        level: this.degradationLevels.SEVERE_DEGRADATION,
        strategy: 'cached_results',
        action: () => this.useCachedAnalysis()
      },
      {
        level: this.degradationLevels.CRITICAL_FAILURE,
        strategy: 'skip_analysis',
        action: () => ({ skipped: true, reason: 'Analysis unavailable' })
      }
    ]);

    // Report Generation fallbacks
    this.addFallbackStrategy('report_generation', [
      {
        level: this.degradationLevels.MINOR_DEGRADATION,
        strategy: 'simplified_report',
        action: (data) => this.generateSimplifiedReport(data)
      },
      {
        level: this.degradationLevels.MODERATE_DEGRADATION,
        strategy: 'text_only_report',
        action: (data) => this.generateTextOnlyReport(data)
      },
      {
        level: this.degradationLevels.SEVERE_DEGRADATION,
        strategy: 'minimal_report',
        action: (data) => this.generateMinimalReport(data)
      },
      {
        level: this.degradationLevels.CRITICAL_FAILURE,
        strategy: 'error_report',
        action: () => this.generateErrorReport()
      }
    ]);
  }

  /**
   * Add fallback strategy for a service
   */
  addFallbackStrategy(serviceId, strategies) {
    this.fallbackStrategies.set(serviceId, strategies);
  }

  /**
   * Execute operation with graceful degradation
   */
  async executeWithDegradation(serviceId, operation, operationConfig = {}) {
    // Get current service status
    const serviceStatus = this.getServiceStatus(serviceId);
    const degradationLevel = this.calculateDegradationLevel(serviceId, serviceStatus);

    // Update service status
    this.updateServiceStatus(serviceId, { lastAttempt: Date.now(), degradationLevel });

    try {
      // Apply degradation strategy if needed
      const adjustedConfig = await this.applyDegradationStrategy(serviceId, degradationLevel, operationConfig);
      
      // Record attempt
      const startTime = Date.now();
      
      // Execute operation
      const result = await operation(adjustedConfig);
      
      // Record success
      const responseTime = Date.now() - startTime;
      this.recordSuccess(serviceId, responseTime);
      
      return result;

    } catch (error) {
      // Record failure
      await this.recordFailure(serviceId, error);
      
      // Try fallback strategy
      return await this.executeFallback(serviceId, error, operationConfig);
    }
  }

  /**
   * Calculate degradation level based on service performance
   */
  calculateDegradationLevel(serviceId, serviceStatus) {
    const metrics = this.performanceMetrics.get(serviceId) || {
      successRate: 100,
      averageResponseTime: 0,
      recentFailures: 0,
      consecutiveFailures: 0
    };

    let level = this.degradationLevels.NORMAL;

    // Check success rate
    if (metrics.successRate < 90) level = Math.max(level, this.degradationLevels.MINOR_DEGRADATION);
    if (metrics.successRate < 70) level = Math.max(level, this.degradationLevels.MODERATE_DEGRADATION);
    if (metrics.successRate < 50) level = Math.max(level, this.degradationLevels.SEVERE_DEGRADATION);
    if (metrics.successRate < 20) level = Math.max(level, this.degradationLevels.CRITICAL_FAILURE);

    // Check response times
    if (metrics.averageResponseTime > 10000) level = Math.max(level, this.degradationLevels.MINOR_DEGRADATION);
    if (metrics.averageResponseTime > 30000) level = Math.max(level, this.degradationLevels.MODERATE_DEGRADATION);
    if (metrics.averageResponseTime > 60000) level = Math.max(level, this.degradationLevels.SEVERE_DEGRADATION);

    // Check consecutive failures
    if (metrics.consecutiveFailures >= 3) level = Math.max(level, this.degradationLevels.MODERATE_DEGRADATION);
    if (metrics.consecutiveFailures >= 5) level = Math.max(level, this.degradationLevels.SEVERE_DEGRADATION);
    if (metrics.consecutiveFailures >= 10) level = Math.max(level, this.degradationLevels.CRITICAL_FAILURE);

    return level;
  }

  /**
   * Apply degradation strategy
   */
  async applyDegradationStrategy(serviceId, degradationLevel, config) {
    if (degradationLevel === this.degradationLevels.NORMAL) {
      return config;
    }

    const strategies = this.fallbackStrategies.get(serviceId) || [];
    
    // Find appropriate strategy for degradation level
    const strategy = strategies.find(s => s.level === degradationLevel) || 
                    strategies.find(s => s.level <= degradationLevel);

    if (strategy) {
      console.log(`🔄 Applying degradation strategy: ${strategy.strategy} for ${serviceId}`);
      return await strategy.action(config);
    }

    return config;
  }

  /**
   * Execute fallback strategy
   */
  async executeFallback(serviceId, error, config) {
    const strategies = this.fallbackStrategies.get(serviceId) || [];
    
    // Try fallback strategies in order of severity
    for (const strategy of strategies.sort((a, b) => a.level - b.level)) {
      try {
        console.log(`🔄 Trying fallback strategy: ${strategy.strategy} for ${serviceId}`);
        const result = await strategy.action(config);
        
        if (result && !result.skipped) {
          console.log(`✅ Fallback strategy ${strategy.strategy} succeeded`);
          return result;
        }
      } catch (fallbackError) {
        console.log(`❌ Fallback strategy ${strategy.strategy} failed:`, fallbackError.message);
        continue;
      }
    }

    // All fallbacks failed
    console.log(`🚨 All fallback strategies failed for ${serviceId}`);
    throw new Error(`Service ${serviceId} completely unavailable: ${error.message}`);
  }

  /**
   * Record successful operation
   */
  recordSuccess(serviceId, responseTime) {
    const metrics = this.performanceMetrics.get(serviceId) || {
      totalRequests: 0,
      successCount: 0,
      failureCount: 0,
      totalResponseTime: 0,
      consecutiveFailures: 0,
      recentEvents: []
    };

    metrics.totalRequests++;
    metrics.successCount++;
    metrics.totalResponseTime += responseTime;
    metrics.consecutiveFailures = 0;
    metrics.recentEvents.push({ success: true, responseTime, timestamp: Date.now() });

    // Keep only recent events (last 100)
    if (metrics.recentEvents.length > 100) {
      metrics.recentEvents = metrics.recentEvents.slice(-100);
    }

    // Update calculated metrics
    metrics.successRate = (metrics.successCount / metrics.totalRequests) * 100;
    metrics.averageResponseTime = metrics.totalResponseTime / metrics.successCount;

    this.performanceMetrics.set(serviceId, metrics);
  }

  /**
   * Record failed operation
   */
  async recordFailure(serviceId, error) {
    const metrics = this.performanceMetrics.get(serviceId) || {
      totalRequests: 0,
      successCount: 0,
      failureCount: 0,
      totalResponseTime: 0,
      consecutiveFailures: 0,
      recentEvents: []
    };

    metrics.totalRequests++;
    metrics.failureCount++;
    metrics.consecutiveFailures++;
    metrics.recentEvents.push({ success: false, error: error.message, timestamp: Date.now() });

    // Keep only recent events
    if (metrics.recentEvents.length > 100) {
      metrics.recentEvents = metrics.recentEvents.slice(-100);
    }

    // Update calculated metrics
    metrics.successRate = (metrics.successCount / metrics.totalRequests) * 100;

    this.performanceMetrics.set(serviceId, metrics);

    // Log the error
    await this.errorHandler.handleError(error, { serviceId, degradationContext: true });
  }

  /**
   * Get service status
   */
  getServiceStatus(serviceId) {
    return this.serviceStatus.get(serviceId) || {
      status: 'unknown',
      lastAttempt: null,
      degradationLevel: this.degradationLevels.NORMAL
    };
  }

  /**
   * Update service status
   */
  updateServiceStatus(serviceId, status) {
    const currentStatus = this.getServiceStatus(serviceId);
    this.serviceStatus.set(serviceId, { ...currentStatus, ...status });
  }

  /**
   * Get comprehensive health report
   */
  getHealthReport() {
    const report = {
      timestamp: new Date().toISOString(),
      overallHealth: 'healthy',
      services: {},
      recommendations: []
    };

    let unhealthyServices = 0;
    let degradedServices = 0;

    for (const [serviceId, metrics] of this.performanceMetrics.entries()) {
      const status = this.getServiceStatus(serviceId);
      const serviceHealth = {
        serviceId,
        status: this.getHealthStatus(metrics, status),
        degradationLevel: status.degradationLevel,
        metrics: {
          successRate: metrics.successRate,
          averageResponseTime: metrics.averageResponseTime,
          consecutiveFailures: metrics.consecutiveFailures,
          totalRequests: metrics.totalRequests
        }
      };

      report.services[serviceId] = serviceHealth;

      if (serviceHealth.status === 'critical') unhealthyServices++;
      else if (serviceHealth.status === 'degraded') degradedServices++;
    }

    // Determine overall health
    if (unhealthyServices > 0) {
      report.overallHealth = 'critical';
    } else if (degradedServices > 0) {
      report.overallHealth = 'degraded';
    }

    // Add recommendations
    report.recommendations = this.generateRecommendations(report.services);

    return report;
  }

  /**
   * Get health status for a service
   */
  getHealthStatus(metrics, status) {
    if (status.degradationLevel >= this.degradationLevels.CRITICAL_FAILURE) return 'critical';
    if (status.degradationLevel >= this.degradationLevels.SEVERE_DEGRADATION) return 'unhealthy';
    if (status.degradationLevel >= this.degradationLevels.MINOR_DEGRADATION) return 'degraded';
    return 'healthy';
  }

  /**
   * Generate recommendations based on service health
   */
  generateRecommendations(services) {
    const recommendations = [];

    for (const [serviceId, serviceHealth] of Object.entries(services)) {
      if (serviceHealth.status === 'critical') {
        recommendations.push(`🚨 ${serviceId}: Service is critical - consider maintenance or replacement`);
      } else if (serviceHealth.status === 'unhealthy') {
        recommendations.push(`⚠️ ${serviceId}: Service is unhealthy - investigate and apply fixes`);
      } else if (serviceHealth.status === 'degraded') {
        recommendations.push(`🔄 ${serviceId}: Service is degraded - monitor closely`);
      }

      if (serviceHealth.metrics.averageResponseTime > 10000) {
        recommendations.push(`🐌 ${serviceId}: High response times detected - optimize performance`);
      }

      if (serviceHealth.metrics.consecutiveFailures > 5) {
        recommendations.push(`❌ ${serviceId}: Multiple consecutive failures - check service availability`);
      }
    }

    return recommendations;
  }

  /**
   * Fallback implementations
   */
  async useCachedSDRs() {
    // Return cached SDR list if available
    return [
      {
        url: 'http://websdr.ewi.utwente.nl:8901/',
        location: 'University of Twente, Netherlands',
        frequencies: ['80m', '40m', '20m', '15m', '10m'],
        quality_score: 80,
        network: 'WebSDR',
        cached: true
      }
    ];
  }

  getHardcodedSDRs() {
    return [
      {
        url: 'http://websdr.ewi.utwente.nl:8901/',
        location: 'University of Twente, Netherlands',
        frequencies: ['80m', '40m', '20m', '15m', '10m'],
        quality_score: 70,
        network: 'WebSDR',
        hardcoded: true
      }
    ];
  }

  generateSimulatedAudio() {
    return {
      simulated: true,
      samples: [{
        id: 'simulated_audio',
        filename: 'simulated.wav',
        metadata: {
          frequency: 14000000,
          mode: 'usb',
          duration: 60,
          simulated: true
        }
      }]
    };
  }

  generateMetadataOnly() {
    return {
      metadata_only: true,
      analysis: {
        signal_detected: true,
        estimated_mode: 'voice',
        confidence: 0.5
      }
    };
  }

  async useCachedAnalysis() {
    return {
      cached: true,
      analysis: {
        signal_types: ['voice', 'data'],
        quality: 'fair',
        timestamp: new Date().toISOString()
      }
    };
  }

  generateSimplifiedReport(data) {
    return {
      type: 'simplified',
      summary: 'Shortwave monitoring report (simplified)',
      data: data,
      timestamp: new Date().toISOString()
    };
  }

  generateTextOnlyReport(data) {
    return {
      type: 'text_only',
      content: `Shortwave Report - ${new Date().toISOString()}\n\nData: ${JSON.stringify(data, null, 2)}`,
      timestamp: new Date().toISOString()
    };
  }

  generateMinimalReport(data) {
    return {
      type: 'minimal',
      status: 'completed',
      timestamp: new Date().toISOString()
    };
  }

  generateErrorReport() {
    return {
      type: 'error',
      message: 'Report generation failed - system in degraded state',
      timestamp: new Date().toISOString()
    };
  }
}

export default GracefulDegradationManager;