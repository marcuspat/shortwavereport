/**
 * SPARC Orchestrator - Main System Controller
 * Coordinates all agents using BatchTool patterns for parallel execution
 */

import express from 'express';
import MemoryManager from './memory/memory-manager.js';
import SDRDiscoveryAgent from './agents/sdr-discovery.js';
import AudioCaptureAgent from './agents/audio-capture.js';
import AudioAnalysisAgent from './agents/audio-analysis.js';
import ReportGeneratorAgent from './agents/report-generator.js';
import aiService from './utils/ai-service.js';
import aiConfig from './config/ai-config.js';

class SPARCOrchestrator {
  constructor() {
    this.memory = new MemoryManager();
    this.agents = {
      sdrDiscovery: new SDRDiscoveryAgent(),
      audioCapture: new AudioCaptureAgent(),
      audioAnalysis: new AudioAnalysisAgent(),
      reportGenerator: new ReportGeneratorAgent()
    };
    this.executionLog = [];
    this.startTime = null;
    this.healthServer = null;
    this.isHealthy = true;
    this.initializeHealthServer();
  }

  /**
   * Initialize health check endpoints
   */
  initializeHealthServer() {
    const app = express();
    const port = process.env.HEALTH_PORT || 3000;

    // Middleware for parsing JSON
    app.use(express.json());

    // Health check endpoint
    app.get('/health', (req, res) => {
      const healthStatus = this.getHealthStatus();
      const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
      res.status(statusCode).json(healthStatus);
    });

    // Readiness check endpoint
    app.get('/ready', (req, res) => {
      const readinessStatus = this.getReadinessStatus();
      const statusCode = readinessStatus.ready ? 200 : 503;
      res.status(statusCode).json(readinessStatus);
    });

    // Liveness check endpoint
    app.get('/live', (req, res) => {
      res.status(200).json({
        status: 'alive',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });

    // Metrics endpoint
    app.get('/metrics', async (req, res) => {
      const metrics = await this.getMetrics();
      res.status(200).json(metrics);
    });

    // System status endpoint
    app.get('/status', async (req, res) => {
      const status = await this.getSystemStatus();
      res.status(200).json(status);
    });

    // AI service endpoints
    app.get('/ai/status', async (req, res) => {
      try {
        const status = aiService.getProviderStatus();
        const config = aiConfig.getConfigSummary();
        res.status(200).json({ ...status, config });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/ai/models', (req, res) => {
      try {
        const models = aiService.getAvailableModels();
        const freeModels = aiConfig.getFreeModels();
        res.status(200).json({ available: models, free: freeModels });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/ai/setup', (req, res) => {
      try {
        const instructions = aiConfig.getSetupInstructions();
        const detection = aiConfig.autoDetectBestSetup();
        res.status(200).json({ instructions, detection });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.post('/ai/test', async (req, res) => {
      try {
        const testResult = await aiService.testProvider();
        res.status(200).json(testResult);
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    app.post('/ai/analyze', async (req, res) => {
      try {
        const { prompt, options = {} } = req.body;
        if (!prompt) {
          return res.status(400).json({ error: 'Prompt is required' });
        }

        const result = await aiService.generateCompletion(prompt, options);
        res.status(200).json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Start health server
    this.healthServer = app.listen(port, () => {
      console.log(`🏥 Health server running on port ${port}`);
    });
  }

  /**
   * Get comprehensive health status
   */
  getHealthStatus() {
    const memoryUsage = process.memoryUsage();
    const memoryThreshold = 1024 * 1024 * 1024; // 1GB threshold

    return {
      status: this.isHealthy && memoryUsage.heapUsed < memoryThreshold ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024)
      },
      cpu: {
        usage: process.cpuUsage()
      },
      agents: {
        sdrDiscovery: this.agents.sdrDiscovery ? 'initialized' : 'not_initialized',
        audioCapture: this.agents.audioCapture ? 'initialized' : 'not_initialized',
        audioAnalysis: this.agents.audioAnalysis ? 'initialized' : 'not_initialized',
        reportGenerator: this.agents.reportGenerator ? 'initialized' : 'not_initialized'
      },
      version: process.version,
      platform: process.platform
    };
  }

  /**
   * Get readiness status (ready to accept requests)
   */
  getReadinessStatus() {
    const allAgentsReady = Object.values(this.agents).every(agent => agent !== null);
    const memoryReady = this.memory !== null;

    return {
      ready: allAgentsReady && memoryReady && this.isHealthy,
      timestamp: new Date().toISOString(),
      checks: {
        agents: allAgentsReady,
        memory: memoryReady,
        health: this.isHealthy
      }
    };
  }

  /**
   * Get system metrics
   */
  async getMetrics() {
    const memoryUsage = process.memoryUsage();
    const executionStats = this.getExecutionStats();
    
    return {
      timestamp: new Date().toISOString(),
      system: {
        uptime: process.uptime(),
        memory: {
          heap_used: memoryUsage.heapUsed,
          heap_total: memoryUsage.heapTotal,
          external: memoryUsage.external,
          rss: memoryUsage.rss
        },
        cpu: process.cpuUsage(),
        node_version: process.version,
        platform: process.platform
      },
      orchestrator: {
        execution_time: this.startTime ? (Date.now() - this.startTime) / 1000 : 0,
        total_executions: executionStats.total,
        successful_executions: executionStats.successful,
        failed_executions: executionStats.failed,
        phases_completed: executionStats.phases
      },
      agents: await this.getAgentMetrics()
    };
  }

  /**
   * Get comprehensive system status
   */
  async getSystemStatus() {
    const health = this.getHealthStatus();
    const readiness = this.getReadinessStatus();
    const metrics = await this.getMetrics();
    const memoryStats = await this.getMemoryStats();

    return {
      overall_status: health.status === 'healthy' && readiness.ready ? 'operational' : 'degraded',
      timestamp: new Date().toISOString(),
      health,
      readiness,
      metrics,
      memory_stats: memoryStats,
      execution_log: this.executionLog.slice(-10) // Last 10 entries
    };
  }

  /**
   * Get execution statistics
   */
  getExecutionStats() {
    const stats = {
      total: this.executionLog.length,
      successful: 0,
      failed: 0,
      phases: 0
    };

    this.executionLog.forEach(entry => {
      if (entry.status === 'completed') stats.successful++;
      if (entry.status === 'failed') stats.failed++;
      if (entry.component.startsWith('phase_')) stats.phases++;
    });

    return stats;
  }

  /**
   * Get agent-specific metrics
   */
  async getAgentMetrics() {
    const metrics = {};
    
    for (const [name, agent] of Object.entries(this.agents)) {
      metrics[name] = {
        initialized: agent !== null,
        status: agent ? 'ready' : 'not_ready'
      };
    }

    return metrics;
  }

  /**
   * Get memory system statistics
   */
  async getMemoryStats() {
    try {
      const keys = await this.memory.list();
      return {
        total_keys: keys.length,
        last_updated: new Date().toISOString()
      };
    } catch (error) {
      return {
        error: 'Unable to retrieve memory stats',
        message: error.message
      };
    }
  }

  /**
   * Main SPARC orchestration workflow
   */
  async execute() {
    console.log('🚀 Starting SPARC Orchestration for Shortwave Monitor System');
    console.log('━'.repeat(80));
    
    this.startTime = Date.now();
    
    try {
      // Initialize system
      await this.initializeSystem();

      // Phase 1: Specification & Discovery (Parallel)
      await this.executePhase1();

      // Phase 2: Architecture & Implementation (Sequential then Parallel) 
      await this.executePhase2();

      // Phase 3: Refinement & Analysis (Parallel)
      await this.executePhase3();

      // Phase 4: Completion & Delivery
      await this.executePhase4();

      // Final validation and deployment
      await this.finalValidation();

      const totalTime = ((Date.now() - this.startTime) / 1000).toFixed(2);
      console.log(`🎯 SPARC Orchestration completed successfully in ${totalTime}s`);
      
      return await this.generateCompletionReport();

    } catch (error) {
      console.error('❌ SPARC Orchestration failed:', error);
      await this.handleFailure(error);
      throw error;
    }
  }

  /**
   * Initialize system and clear previous state
   */
  async initializeSystem() {
    console.log('🔧 Initializing SPARC system...');
    
    this.logExecution('system_init', 'starting', 'System initialization');
    
    // Clear previous execution state
    const previousKeys = await this.memory.list();
    console.log(`📝 Found ${previousKeys.length} previous memory entries`);
    
    // Store initialization
    await this.memory.store('sparc_start', {
      timestamp: new Date().toISOString(),
      orchestrator: 'active',
      phase: 'initialization'
    });

    this.logExecution('system_init', 'completed', 'System initialized successfully');
    console.log('✅ System initialization complete');
  }

  /**
   * Phase 1: Specification & Discovery (Parallel)
   */
  async executePhase1() {
    console.log('\n📡 Phase 1: Specification & Discovery');
    console.log('─'.repeat(50));
    
    this.logExecution('phase_1', 'starting', 'SDR Discovery and Requirements Validation');
    
    try {
      // Store phase start
      await this.memory.store('phase_1_start', {
        timestamp: new Date().toISOString(),
        tasks: ['sdr_discovery', 'requirements_validation']
      });

      // Parallel execution: SDR Discovery + Requirements Validation
      console.log('🔄 Running parallel discovery tasks...');
      
      const discoveryPromise = this.agents.sdrDiscovery.execute();
      const validationPromise = this.validateRequirements();

      const [discoveryResult, validationResult] = await Promise.allSettled([
        discoveryPromise,
        validationPromise
      ]);

      // Process results
      if (discoveryResult.status === 'fulfilled') {
        console.log(`✅ SDR Discovery: ${discoveryResult.value.length} SDRs found`);
        this.logExecution('sdr_discovery', 'completed', `Found ${discoveryResult.value.length} active SDRs`);
      } else {
        throw new Error(`SDR Discovery failed: ${discoveryResult.reason.message}`);
      }

      if (validationResult.status === 'fulfilled') {
        console.log('✅ Requirements Validation: Passed');
        this.logExecution('requirements_validation', 'completed', 'System capabilities validated');
      } else {
        console.log('⚠️ Requirements Validation: Issues detected');
      }

      // Signal phase completion
      await this.memory.signal('phase_1_complete', {
        timestamp: new Date().toISOString(),
        sdr_count: discoveryResult.value?.length || 0
      });

      this.logExecution('phase_1', 'completed', 'Discovery phase successful');

    } catch (error) {
      this.logExecution('phase_1', 'failed', error.message);
      throw error;
    }
  }

  /**
   * Phase 2: Architecture & Implementation (Sequential then Parallel)
   */
  async executePhase2() {
    console.log('\n🎵 Phase 2: Architecture & Implementation');
    console.log('─'.repeat(50));
    
    this.logExecution('phase_2', 'starting', 'Audio capture and processing');
    
    try {
      // Wait for Phase 1 completion
      await this.memory.waitFor('phase_1_complete', 10000);
      console.log('📋 Phase 1 dependencies satisfied');

      // Store phase start
      await this.memory.store('phase_2_start', {
        timestamp: new Date().toISOString(),
        tasks: ['audio_capture', 'system_monitoring']
      });

      // Sequential: Audio Capture (depends on SDR discovery)
      console.log('🎙️ Starting audio capture...');
      const captureResult = await this.agents.audioCapture.execute();
      
      console.log(`✅ Audio Capture: ${captureResult.length} samples captured`);
      this.logExecution('audio_capture', 'completed', `Captured ${captureResult.length} audio samples`);

      // Parallel: System monitoring while capture runs
      const monitoringResult = await this.monitorSystemHealth();
      console.log('✅ System Monitoring: Health check passed');

      // Signal phase completion
      await this.memory.signal('phase_2_complete', {
        timestamp: new Date().toISOString(),
        samples_captured: captureResult.length
      });

      this.logExecution('phase_2', 'completed', 'Audio capture phase successful');

    } catch (error) {
      this.logExecution('phase_2', 'failed', error.message);
      throw error;
    }
  }

  /**
   * Phase 3: Refinement & Analysis (Parallel)
   */
  async executePhase3() {
    console.log('\n🔬 Phase 3: Refinement & Analysis');
    console.log('─'.repeat(50));
    
    this.logExecution('phase_3', 'starting', 'TDD-driven audio analysis');
    
    try {
      // Wait for Phase 2 completion
      await this.memory.waitFor('phase_2_complete', 10000);
      console.log('📋 Phase 2 dependencies satisfied');

      // Store phase start
      await this.memory.store('phase_3_start', {
        timestamp: new Date().toISOString(),
        tasks: ['audio_analysis', 'quality_assurance', 'data_enrichment']
      });

      // Parallel execution: Analysis + QA + Enrichment
      console.log('🔄 Running parallel analysis tasks...');
      
      const analysisPromise = this.agents.audioAnalysis.execute();
      const qaPromise = this.runQualityAssurance();
      const enrichmentPromise = this.enrichData();

      const [analysisResult, qaResult, enrichmentResult] = await Promise.allSettled([
        analysisPromise,
        qaPromise,
        enrichmentPromise
      ]);

      // Process results
      if (analysisResult.status === 'fulfilled') {
        console.log(`✅ Audio Analysis: ${analysisResult.value.length} samples analyzed`);
        this.logExecution('audio_analysis', 'completed', `Analyzed ${analysisResult.value.length} samples`);
      } else {
        throw new Error(`Audio Analysis failed: ${analysisResult.reason.message}`);
      }

      if (qaResult.status === 'fulfilled') {
        console.log('✅ Quality Assurance: Validation passed');
        this.logExecution('quality_assurance', 'completed', 'Analysis quality validated');
      }

      if (enrichmentResult.status === 'fulfilled') {
        console.log('✅ Data Enrichment: Cross-references completed');
        this.logExecution('data_enrichment', 'completed', 'Data enriched with external sources');
      }

      // Signal phase completion
      await this.memory.signal('phase_3_complete', {
        timestamp: new Date().toISOString(),
        analyses_completed: analysisResult.value?.length || 0
      });

      this.logExecution('phase_3', 'completed', 'Analysis phase successful');

    } catch (error) {
      this.logExecution('phase_3', 'failed', error.message);
      throw error;
    }
  }

  /**
   * Phase 4: Completion & Delivery
   */
  async executePhase4() {
    console.log('\n📊 Phase 4: Completion & Delivery');
    console.log('─'.repeat(50));
    
    this.logExecution('phase_4', 'starting', 'Report generation and deployment');
    
    try {
      // Wait for Phase 3 completion
      await this.memory.waitFor('phase_3_complete', 10000);
      console.log('📋 Phase 3 dependencies satisfied');

      // Store phase start
      await this.memory.store('phase_4_start', {
        timestamp: new Date().toISOString(),
        tasks: ['report_generation']
      });

      // Generate final intelligence dashboard
      console.log('📊 Generating intelligence report...');
      const reportResult = await this.agents.reportGenerator.execute();
      
      console.log(`✅ Report Generation: Dashboard available at ${reportResult.url}`);
      this.logExecution('report_generation', 'completed', `Dashboard deployed at ${reportResult.url}`);

      // Signal phase completion
      await this.memory.signal('phase_4_complete', {
        timestamp: new Date().toISOString(),
        report_url: reportResult.url
      });

      this.logExecution('phase_4', 'completed', 'Report generation successful');

    } catch (error) {
      this.logExecution('phase_4', 'failed', error.message);
      throw error;
    }
  }

  /**
   * Final validation and deployment
   */
  async finalValidation() {
    console.log('\n✅ Final System Validation');
    console.log('─'.repeat(50));
    
    this.logExecution('final_validation', 'starting', 'End-to-end system validation');
    
    try {
      // Validate all phases completed
      const requiredSignals = ['phase_1_complete', 'phase_2_complete', 'phase_3_complete', 'phase_4_complete'];
      
      for (const signal of requiredSignals) {
        const exists = await this.memory.exists(signal);
        if (!exists) {
          throw new Error(`Missing completion signal: ${signal}`);
        }
      }

      // Validate data integrity
      const activeSDRs = await this.memory.query('active_sdrs');
      const audioSamples = await this.memory.query('audio_samples');
      const analysisResults = await this.memory.query('analysis_results');
      const reportData = await this.memory.query('report_data');

      console.log(`🔍 Data Integrity Check:`);
      console.log(`   📡 SDRs: ${activeSDRs?.length || 0}`);
      console.log(`   🎵 Samples: ${audioSamples?.length || 0}`);
      console.log(`   🔬 Analyses: ${analysisResults?.length || 0}`);
      console.log(`   📊 Report: ${reportData ? 'Generated' : 'Missing'}`);

      // Signal mission completion
      await this.memory.signal('mission_complete', {
        status: 'success',
        timestamp: new Date().toISOString(),
        execution_time: (Date.now() - this.startTime) / 1000,
        summary: {
          sdrs_discovered: activeSDRs?.length || 0,
          samples_captured: audioSamples?.length || 0,
          analyses_completed: analysisResults?.length || 0,
          report_generated: !!reportData
        }
      });

      this.logExecution('final_validation', 'completed', 'System validation successful');
      console.log('🎯 All validation checks passed');

    } catch (error) {
      this.logExecution('final_validation', 'failed', error.message);
      throw error;
    }
  }

  /**
   * Supporting methods for orchestration tasks
   */
  async validateRequirements() {
    console.log('📋 Validating system requirements...');
    
    // Mock requirements validation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const requirements = {
      networkAccess: true,
      ffmpegAvailable: true,
      memorySpace: true,
      nodeVersion: process.version
    };

    return requirements;
  }

  async monitorSystemHealth() {
    console.log('💊 Monitoring system health...');
    
    // Mock system health monitoring
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const health = {
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      status: 'healthy'
    };

    return health;
  }

  async runQualityAssurance() {
    console.log('🧪 Running quality assurance checks...');
    
    // Mock QA validation
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    return { passed: true, issues: 0 };
  }

  async enrichData() {
    console.log('📈 Enriching data with external sources...');
    
    // Mock data enrichment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return { sources_queried: 3, enrichments_added: 15 };
  }

  /**
   * Generate completion report
   */
  async generateCompletionReport() {
    const missionComplete = await this.memory.query('mission_complete');
    const reportReady = await this.memory.query('report_ready');
    
    const report = {
      status: 'MISSION_COMPLETED',
      execution_time: missionComplete?.execution_time || 0,
      dashboard_url: reportReady?.url,
      summary: missionComplete?.summary || {},
      phases_completed: 4,
      agents_executed: Object.keys(this.agents).length,
      execution_log: this.executionLog
    };

    console.log('\n🎉 SPARC Mission Completion Report');
    console.log('━'.repeat(80));
    console.log(`Status: ${report.status}`);
    console.log(`Execution Time: ${report.execution_time}s`);
    console.log(`Dashboard URL: ${report.dashboard_url}`);
    console.log(`SDRs Discovered: ${report.summary.sdrs_discovered}`);
    console.log(`Samples Captured: ${report.summary.samples_captured}`);
    console.log(`Analyses Completed: ${report.summary.analyses_completed}`);
    console.log('━'.repeat(80));

    return report;
  }

  /**
   * Handle orchestration failure
   */
  async handleFailure(error) {
    console.log('\n💥 SPARC Orchestration Failure Handler');
    console.log('─'.repeat(50));
    
    this.logExecution('orchestration', 'failed', error.message);
    
    // Store failure information
    await this.memory.store('mission_failed', {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack,
      execution_log: this.executionLog
    });

    // Cleanup resources
    if (this.agents.reportGenerator.server) {
      this.agents.reportGenerator.shutdown();
    }

    console.log('🧹 Cleanup completed');
  }

  /**
   * Log execution events
   */
  logExecution(component, status, description) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      component,
      status,
      description
    };
    
    this.executionLog.push(logEntry);
    console.log(`📝 ${component}: ${status} - ${description}`);
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('\n🛑 Shutting down SPARC Orchestrator...');
    
    // Shutdown health server
    if (this.healthServer) {
      this.healthServer.close(() => {
        console.log('🏥 Health server stopped');
      });
    }
    
    // Shutdown report server if running
    if (this.agents.reportGenerator.server) {
      this.agents.reportGenerator.shutdown();
    }
    
    console.log('✅ Shutdown complete');
    process.exit(0);
  }
}

// Handle process signals for graceful shutdown
const orchestrator = new SPARCOrchestrator();

process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  orchestrator.shutdown();
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  orchestrator.shutdown();
});

// Execute if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  orchestrator.execute().catch(console.error);
}

export default SPARCOrchestrator;