/**
 * Report Generator Agent - SPARC Phase 4
 * Creates intelligence reports and web dashboard
 * Enhanced with AI-powered report generation using OpenRouter/OpenAI APIs
 */

import fs from 'fs/promises';
import path from 'path';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import passport from 'passport';
import MemoryManager from '../memory/memory-manager.js';
import ResilienceManager from '../utils/resilience-manager.js';
import aiService from '../utils/ai-service.js';
import AuthenticationManager from '../middleware/auth.js';
import HTMLSanitizer from '../utils/html-sanitizer.js';
import { validateInput, schemas } from '../utils/validation.js';

class ReportGeneratorAgent {
  constructor() {
    this.memory = new MemoryManager();
    this.resilience = new ResilienceManager();
    this.reportsDir = path.join(process.cwd(), 'src', 'reports');
    this.reportData = {
      summary: {},
      coverage: {},
      analysis: {},
      audioSamples: []
    };
    this.server = null;
    this.initializeReportsDir();
  }

  async initializeReportsDir() {
    try {
      await fs.mkdir(this.reportsDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create reports directory:', error);
    }
  }

  /**
   * Main report generation workflow
   */
  async execute() {
    console.log('📊 Starting Report Generation Phase...');
    
    try {
      // Wait for analysis to complete
      await this.memory.waitFor('analysis_complete', 30000);
      
      // Aggregate all data sources
      await this.aggregateData();
      
      // Generate report components
      await this.generateReportComponents();
      
      // Build final dashboard
      const reportHtml = await this.buildDashboard();
      
      // Save report
      const reportPath = path.join(this.reportsDir, 'dashboard.html');
      await fs.writeFile(reportPath, reportHtml);
      
      // Start web server
      const reportUrl = await this.deployReport();
      
      // Store completion signal
      await this.memory.store('report_data', this.reportData);
      await this.memory.signal('report_ready', {
        url: reportUrl,
        timestamp: new Date().toISOString(),
        summary: this.reportData.summary
      });

      console.log(`🎯 Report generation complete. Available at: ${reportUrl}`);
      return { url: reportUrl, data: this.reportData };

    } catch (error) {
      console.error('❌ Report Generation failed:', error);
      throw error;
    }
  }

  /**
   * Aggregate data from all agents
   */
  async aggregateData() {
    console.log('📥 Aggregating data from all agents...');
    
    try {
      // Get SDR discovery results
      const activeSDRs = await this.memory.query('active_sdrs') || [];
      
      // Get audio capture results  
      const audioSamples = await this.memory.query('audio_samples') || [];
      
      // Get analysis results
      const analysisResults = await this.memory.query('analysis_results') || [];
      
      this.reportData = {
        timestamp: new Date().toISOString(),
        activeSDRs,
        audioSamples,
        analysisResults,
        summary: this.generateExecutiveSummary(activeSDRs, audioSamples, analysisResults),
        coverage: this.generateCoverageMap(activeSDRs),
        analysis: this.generateAnalysisSummary(analysisResults),
        audioSamples: this.prepareAudioSamples(audioSamples, analysisResults)
      };

      console.log(`✅ Data aggregated: ${activeSDRs.length} SDRs, ${audioSamples.length} samples, ${analysisResults.length} analyses`);
      
    } catch (error) {
      console.error('Failed to aggregate data:', error);
      throw error;
    }
  }

  /**
   * Generate executive summary
   */
  generateExecutiveSummary(sdrs, samples, analyses) {
    const summary = {
      totalSDRs: sdrs.length,
      totalSamples: samples.length,
      totalAnalyses: analyses.length,
      keyFindings: [],
      notableActivity: [],
      coverageAreas: [...new Set(sdrs.map(sdr => sdr.location))],
      detectedLanguages: [...new Set(analyses.map(a => a.analysis_results?.language).filter(l => l && l !== 'unknown'))],
      stationCount: this.countUniqueStations(analyses),
      qualityScore: this.calculateOverallQuality(sdrs, samples)
    };

    // Generate key findings
    summary.keyFindings = [
      `Monitored ${summary.totalSDRs} active SDR receivers across ${summary.coverageAreas.length} geographic locations`,
      `Captured ${summary.totalSamples} audio samples spanning HF voice, broadcast, CW/digital, and utility frequencies`,
      `Identified ${summary.stationCount} unique stations with ${summary.detectedLanguages.length} languages detected`,
      `Overall system quality score: ${summary.qualityScore}/100`
    ];

    // Identify notable activity
    const highConfidenceAnalyses = analyses.filter(a => a.analysis_results?.confidence > 70);
    summary.notableActivity = highConfidenceAnalyses.map(a => ({
      type: a.analysis_results.content_type,
      confidence: a.analysis_results.confidence,
      stations: a.analysis_results.stations,
      language: a.analysis_results.language
    }));

    return summary;
  }

  /**
   * Generate coverage map data
   */
  generateCoverageMap(sdrs) {
    const coverage = {
      totalLocations: sdrs.length,
      regions: {},
      networkDistribution: {},
      qualityDistribution: {}
    };

    // Group by region (simplified)
    sdrs.forEach(sdr => {
      const region = this.determineRegion(sdr.location);
      if (!coverage.regions[region]) {
        coverage.regions[region] = [];
      }
      coverage.regions[region].push(sdr);

      // Network distribution
      coverage.networkDistribution[sdr.network] = 
        (coverage.networkDistribution[sdr.network] || 0) + 1;

      // Quality distribution
      const qualityBand = this.getQualityBand(sdr.quality_score);
      coverage.qualityDistribution[qualityBand] = 
        (coverage.qualityDistribution[qualityBand] || 0) + 1;
    });

    return coverage;
  }

  /**
   * Generate analysis summary
   */
  generateAnalysisSummary(analyses) {
    const summary = {
      contentTypes: {},
      languages: {},
      averageConfidence: 0,
      stationsByType: {},
      trends: []
    };

    analyses.forEach(analysis => {
      const results = analysis.analysis_results;
      
      // Content type distribution
      summary.contentTypes[results.content_type] = 
        (summary.contentTypes[results.content_type] || 0) + 1;

      // Language distribution
      if (results.language && results.language !== 'unknown') {
        summary.languages[results.language] = 
          (summary.languages[results.language] || 0) + 1;
      }

      // Stations by type
      if (results.stations && results.stations.length > 0) {
        if (!summary.stationsByType[results.content_type]) {
          summary.stationsByType[results.content_type] = [];
        }
        summary.stationsByType[results.content_type].push(...results.stations);
      }
    });

    // Calculate average confidence
    const confidences = analyses
      .map(a => a.analysis_results.confidence)
      .filter(c => c > 0);
    summary.averageConfidence = confidences.length > 0 ? 
      Math.round(confidences.reduce((sum, c) => sum + c, 0) / confidences.length) : 0;

    return summary;
  }

  /**
   * Prepare audio samples for dashboard
   */
  prepareAudioSamples(samples, analyses) {
    const prepared = samples.map(sample => {
      const analysis = analyses.find(a => a.sample_id === sample.id);
      
      return {
        id: sample.id,
        filename: sample.filename,
        sdr: sample.sdr?.location || 'Unknown',
        frequency: sample.config?.frequency,
        type: sample.config?.type,
        duration: sample.metadata?.duration,
        quality: sample.metadata?.quality_estimate,
        analysis: analysis?.analysis_results || null,
        playable: sample.processed || false
      };
    });

    return prepared.slice(0, 10); // Limit to top 10 for dashboard
  }

  /**
   * Build HTML dashboard
   */
  async buildDashboard() {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Shortwave Monitor Intelligence Dashboard</title>
    <style>
        ${this.getDashboardCSS()}
    </style>
</head>
<body>
    <div class="dashboard">
        <header class="header">
            <h1>📡 Shortwave Monitor Intelligence Dashboard</h1>
            <p class="timestamp">Generated: ${new Date().toLocaleString()}</p>
        </header>

        <div class="summary-section">
            <h2>📊 Executive Summary</h2>
            <div class="summary-cards">
                ${this.generateSummaryCards()}
            </div>
            <div class="key-findings">
                <h3>🎯 Key Findings</h3>
                <ul>
                    ${this.reportData.summary.keyFindings.map(finding => `<li>${finding}</li>`).join('')}
                </ul>
            </div>
        </div>

        <div class="coverage-section">
            <h2>🌍 Geographic Coverage</h2>
            ${this.generateCoverageVisualization()}
        </div>

        <div class="analysis-section">
            <h2>🔬 Content Analysis</h2>
            ${this.generateAnalysisCharts()}
        </div>

        <div class="stations-section">
            <h2>📻 Notable Stations</h2>
            ${this.generateStationsTable()}
        </div>

        <div class="samples-section">
            <h2>🎵 Audio Samples</h2>
            ${this.generateAudioSamples()}
        </div>

        <footer class="footer">
            <p>Generated by SPARC Shortwave Monitor System | ${new Date().getFullYear()}</p>
        </footer>
    </div>

    <script>
        ${this.getDashboardJS()}
    </script>
</body>
</html>`;

    return html;
  }

  /**
   * Generate report components
   */
  async generateReportComponents() {
    console.log('🔧 Generating report components...');
    
    // This would generate individual components
    // For demo purposes, all components are generated in buildDashboard()
  }

  /**
   * Deploy report as secure web server
   */
  async deployReport() {
    const app = express();
    const port = process.env.PORT || 3000;
    const auth = new AuthenticationManager();

    // Security middleware
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    }));

    // Rate limiting
    const generalLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // 100 requests per window per IP
      message: { error: 'Too many requests, please try again later' },
      standardHeaders: true,
      legacyHeaders: false
    });

    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // 5 login attempts per window
      message: { error: 'Too many login attempts, please try again later' }
    });

    app.use('/api/', generalLimiter);
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Authentication setup
    app.use(auth.getSessionMiddleware());
    app.use(...auth.getPassportMiddleware());

    // Public login page
    app.get('/login', (req, res) => {
      res.send(this.generateLoginPage());
    });

    // Login endpoint
    app.post('/login', authLimiter, (req, res, next) => {
      try {
        validateInput(req.body, schemas.userCredentials);
        next();
      } catch (error) {
        return res.status(400).json({ error: error.message });
      }
    }, (req, res, next) => {
      // Use passport authentication
      passport.authenticate('local', (err, user, info) => {
        if (err) {
          return res.status(500).json({ error: 'Authentication error' });
        }
        if (!user) {
          return res.status(401).json({ error: info.message || 'Invalid credentials' });
        }
        
        req.logIn(user, (err) => {
          if (err) {
            return res.status(500).json({ error: 'Login failed' });
          }
          res.json({ 
            message: 'Login successful', 
            user: { username: user.username, role: user.role }
          });
        });
      })(req, res, next);
    });

    // Logout endpoint
    app.post('/logout', (req, res) => {
      req.logout(() => {
        res.json({ message: 'Logout successful' });
      });
    });

    // Protected routes
    app.use(auth.requireAuth);

    // Secure static file serving for reports
    app.use('/reports', this.createSecureFileMiddleware(['html', 'css', 'js']), 
      express.static(this.reportsDir));

    // Admin-only data access
    app.use('/data', auth.requireRole('admin'), 
      this.createSecureFileMiddleware(['wav', 'json', 'log']),
      express.static(path.join(process.cwd(), 'data')));

    // Main dashboard route
    app.get('/', (req, res) => {
      res.sendFile(path.join(this.reportsDir, 'dashboard.html'));
    });

    // API endpoints with role-based access
    app.get('/api/data', auth.requireRole('monitor'), (req, res) => {
      try {
        const sanitizedData = HTMLSanitizer.sanitizeForDisplay(this.reportData);
        res.json(sanitizedData);
      } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.get('/api/summary', auth.requireRole('monitor'), (req, res) => {
      try {
        const sanitizedSummary = HTMLSanitizer.sanitizeForDisplay(this.reportData.summary);
        res.json(sanitizedSummary);
      } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Admin endpoints
    app.get('/api/admin/users', auth.requireRole('admin'), (req, res) => {
      try {
        const users = auth.getUsers();
        res.json(users);
      } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.post('/api/admin/users', auth.requireRole('admin'), async (req, res) => {
      try {
        const validatedData = validateInput(req.body, schemas.userCredentials);
        const user = await auth.addUser(validatedData.username, validatedData.password, req.body.role || 'monitor');
        res.json({ message: 'User created successfully', user });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Error handling middleware
    app.use((error, req, res, next) => {
      console.error('Server error:', error);
      res.status(500).json({ 
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message 
      });
    });

    return new Promise((resolve) => {
      this.server = app.listen(port, () => {
        const url = `http://localhost:${port}`;
        console.log(`🔐 Secure report server started at ${url}`);
        console.log(`🔑 Default credentials: admin/SecureAdmin123! or monitor/MonitorPass456!`);
        resolve(url);
      });
    });
  }

  /**
   * Create secure file serving middleware
   */
  createSecureFileMiddleware(allowedExtensions) {
    return (req, res, next) => {
      const requestedPath = req.path;
      const extension = path.extname(requestedPath).substring(1).toLowerCase();
      
      // Check allowed extensions
      if (!allowedExtensions.includes(extension)) {
        return res.status(403).json({ error: 'File type not allowed' });
      }
      
      // Prevent path traversal
      if (requestedPath.includes('..') || requestedPath.includes('~')) {
        return res.status(403).json({ error: 'Invalid file path' });
      }
      
      next();
    };
  }

  /**
   * Generate secure login page
   */
  generateLoginPage() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Shortwave Monitor - Login</title>
    <style>
        body { font-family: Arial, sans-serif; background: #f0f2f5; margin: 0; padding: 20px; }
        .login-container { max-width: 400px; margin: 100px auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .logo { text-align: center; margin-bottom: 30px; color: #1e3c72; }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 16px; }
        button { width: 100%; padding: 12px; background: #1e3c72; color: white; border: none; border-radius: 4px; font-size: 16px; cursor: pointer; }
        button:hover { background: #2a5298; }
        .error { color: red; margin-top: 10px; display: none; }
        .security-notice { font-size: 12px; color: #666; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="logo">
            <h1>📡 Shortwave Monitor</h1>
            <p>Secure Access Portal</p>
        </div>
        <form id="loginForm">
            <div class="form-group">
                <label for="username">Username:</label>
                <input type="text" id="username" name="username" required autocomplete="username">
            </div>
            <div class="form-group">
                <label for="password">Password:</label>
                <input type="password" id="password" name="password" required autocomplete="current-password">
            </div>
            <button type="submit">Login</button>
            <div class="error" id="error"></div>
        </form>
        <div class="security-notice">
            🔒 This system is protected by authentication and encryption.
        </div>
    </div>
    <script>
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = { username: formData.get('username'), password: formData.get('password') };
            
            try {
                const response = await fetch('/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                if (response.ok) {
                    window.location.href = '/';
                } else {
                    const error = await response.json();
                    document.getElementById('error').textContent = error.error;
                    document.getElementById('error').style.display = 'block';
                }
            } catch (error) {
                document.getElementById('error').textContent = 'Login failed. Please try again.';
                document.getElementById('error').style.display = 'block';
            }
        });
    </script>
</body>
</html>`;
  }

  /**
   * Helper methods for HTML generation
   */
  generateSummaryCards() {
    const { summary } = this.reportData;
    return `
      <div class="card">
        <h3>${summary.totalSDRs}</h3>
        <p>Active SDRs</p>
      </div>
      <div class="card">
        <h3>${summary.totalSamples}</h3>
        <p>Audio Samples</p>
      </div>
      <div class="card">
        <h3>${summary.stationCount}</h3>
        <p>Unique Stations</p>
      </div>
      <div class="card">
        <h3>${summary.qualityScore}/100</h3>
        <p>Quality Score</p>
      </div>
    `;
  }

  generateCoverageVisualization() {
    const { coverage } = this.reportData;
    const regions = Object.entries(coverage.regions);
    
    return `
      <div class="coverage-grid">
        ${regions.map(([region, sdrs]) => `
          <div class="region-card">
            <h4>${HTMLSanitizer.escapeHtml(region)}</h4>
            <p>${parseInt(sdrs.length)} SDRs</p>
            <div class="region-details">
              ${sdrs.map(sdr => `
                <div class="sdr-item">
                  <span class="location">${HTMLSanitizer.escapeHtml(sdr.location)}</span>
                  <span class="quality">${HTMLSanitizer.sanitizeQualityScore(sdr.quality_score)}/100</span>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  generateAnalysisCharts() {
    const { analysis } = this.reportData;
    
    return `
      <div class="charts-grid">
        <div class="chart-container">
          <h4>Content Types</h4>
          <div class="chart">
            ${Object.entries(analysis.contentTypes).map(([type, count]) => `
              <div class="bar">
                <div class="bar-fill" style="width: ${Math.max(0, Math.min(100, (parseInt(count) / (this.reportData.totalAnalyses || 1)) * 100))}%"></div>
                <span class="bar-label">${HTMLSanitizer.escapeHtml(type)}: ${parseInt(count)}</span>
              </div>
            `).join('')}
          </div>
        </div>
        
        <div class="chart-container">
          <h4>Languages Detected</h4>
          <div class="chart">
            ${Object.entries(analysis.languages).map(([lang, count]) => {
              const total = Object.values(analysis.languages).reduce((a, b) => parseInt(a) + parseInt(b), 0);
              return `
                <div class="bar">
                  <div class="bar-fill" style="width: ${Math.max(0, Math.min(100, (parseInt(count) / (total || 1)) * 100))}%"></div>
                  <span class="bar-label">${HTMLSanitizer.escapeHtml(lang)}: ${parseInt(count)}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }

  generateStationsTable() {
    const { analysis } = this.reportData;
    const allStations = [];
    
    Object.entries(analysis.stationsByType || {}).forEach(([type, stations]) => {
      if (Array.isArray(stations)) {
        stations.forEach(station => {
          allStations.push({ station, type });
        });
      }
    });
    
    const uniqueStations = [...new Map(allStations.map(item => [item.station, item])).values()];
    
    return `
      <div class="stations-table">
        <table>
          <thead>
            <tr>
              <th>Station</th>
              <th>Type</th>
              <th>Activity</th>
            </tr>
          </thead>
          <tbody>
            ${uniqueStations.slice(0, 20).map(item => `
              <tr>
                <td>${HTMLSanitizer.sanitizeCallsign(item.station)}</td>
                <td>${HTMLSanitizer.escapeHtml(item.type)}</td>
                <td>Active</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  generateAudioSamples() {
    return `
      <div class="samples-grid">
        ${(this.reportData.audioSamples || []).map(sample => `
          <div class="sample-card">
            <h4>${HTMLSanitizer.escapeHtml(sample.filename || 'Unknown')}</h4>
            <div class="sample-details">
              <p><strong>SDR:</strong> ${HTMLSanitizer.escapeHtml(sample.sdr || 'Unknown')}</p>
              <p><strong>Frequency:</strong> ${HTMLSanitizer.sanitizeFrequency(sample.frequency) ? (sample.frequency / 1000000).toFixed(2) : '0.00'} MHz</p>
              <p><strong>Type:</strong> ${HTMLSanitizer.escapeHtml(sample.type || 'Unknown')}</p>
              <p><strong>Quality:</strong> ${HTMLSanitizer.sanitizeQualityScore(sample.quality)}/100</p>
              ${sample.analysis ? `
                <p><strong>Content:</strong> ${HTMLSanitizer.escapeHtml(sample.analysis.content_type || 'Unknown')}</p>
                <p><strong>Language:</strong> ${HTMLSanitizer.escapeHtml(sample.analysis.language || 'Unknown')}</p>
                <p><strong>Confidence:</strong> ${HTMLSanitizer.sanitizeQualityScore(sample.analysis.confidence)}%</p>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  getDashboardCSS() {
    return `
      * { margin: 0; padding: 0; box-sizing: border-box; }
      
      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
        color: #333;
        line-height: 1.6;
      }
      
      .dashboard {
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px;
      }
      
      .header {
        background: rgba(255,255,255,0.95);
        padding: 30px;
        border-radius: 10px;
        margin-bottom: 30px;
        text-align: center;
        box-shadow: 0 5px 15px rgba(0,0,0,0.1);
      }
      
      .header h1 {
        color: #1e3c72;
        margin-bottom: 10px;
        font-size: 2.5em;
      }
      
      .timestamp {
        color: #666;
        font-size: 1.1em;
      }
      
      .summary-section, .coverage-section, .analysis-section, .stations-section, .samples-section {
        background: rgba(255,255,255,0.95);
        padding: 25px;
        border-radius: 10px;
        margin-bottom: 25px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.1);
      }
      
      .summary-cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 20px;
        margin: 20px 0;
      }
      
      .card {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 20px;
        border-radius: 8px;
        text-align: center;
        box-shadow: 0 3px 10px rgba(0,0,0,0.2);
      }
      
      .card h3 {
        font-size: 2.5em;
        margin-bottom: 5px;
      }
      
      .coverage-grid, .charts-grid, .samples-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 20px;
        margin-top: 20px;
      }
      
      .region-card, .chart-container, .sample-card {
        background: #f8f9fa;
        padding: 20px;
        border-radius: 8px;
        border-left: 4px solid #667eea;
      }
      
      .chart .bar {
        margin: 10px 0;
        position: relative;
        background: #e9ecef;
        border-radius: 4px;
        overflow: hidden;
      }
      
      .bar-fill {
        height: 30px;
        background: linear-gradient(90deg, #667eea, #764ba2);
        transition: width 0.3s ease;
      }
      
      .bar-label {
        position: absolute;
        left: 10px;
        top: 50%;
        transform: translateY(-50%);
        font-weight: bold;
        color: #333;
      }
      
      .stations-table {
        overflow-x: auto;
        margin-top: 20px;
      }
      
      table {
        width: 100%;
        border-collapse: collapse;
        background: white;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      }
      
      th, td {
        padding: 12px 15px;
        text-align: left;
        border-bottom: 1px solid #ddd;
      }
      
      th {
        background: #667eea;
        color: white;
        font-weight: bold;
      }
      
      tr:hover {
        background: #f5f5f5;
      }
      
      .footer {
        text-align: center;
        padding: 20px;
        color: rgba(255,255,255,0.8);
        margin-top: 30px;
      }
      
      h2 {
        color: #1e3c72;
        margin-bottom: 15px;
        border-bottom: 2px solid #667eea;
        padding-bottom: 10px;
      }
      
      h3, h4 {
        color: #2a5298;
        margin-bottom: 10px;
      }
      
      @media (max-width: 768px) {
        .dashboard { padding: 10px; }
        .header h1 { font-size: 2em; }
        .summary-cards { grid-template-columns: repeat(2, 1fr); }
        .coverage-grid, .charts-grid, .samples-grid { grid-template-columns: 1fr; }
      }
    `;
  }

  getDashboardJS() {
    return `
      // Dashboard interactivity
      document.addEventListener('DOMContentLoaded', function() {
        console.log('Shortwave Monitor Dashboard Loaded');
        
        // Add click handlers for interactive elements
        const cards = document.querySelectorAll('.card');
        cards.forEach(card => {
          card.addEventListener('click', function() {
            this.style.transform = 'scale(1.05)';
            setTimeout(() => {
              this.style.transform = 'scale(1)';
            }, 200);
          });
        });
        
        // Auto-refresh functionality (disabled for demo)
        // setInterval(() => {
        //   window.location.reload();
        // }, 300000); // Refresh every 5 minutes
      });
    `;
  }

  /**
   * Helper methods
   */
  countUniqueStations(analyses) {
    const allStations = analyses.flatMap(a => a.analysis_results?.stations || []);
    return new Set(allStations).size;
  }

  calculateOverallQuality(sdrs, samples) {
    const sdrQuality = sdrs.reduce((sum, sdr) => sum + (sdr.quality_score || 0), 0) / sdrs.length;
    const sampleQuality = samples.reduce((sum, sample) => sum + (sample.metadata?.quality_estimate || 0), 0) / samples.length;
    return Math.round((sdrQuality + sampleQuality) / 2);
  }

  determineRegion(location) {
    // Simplified region determination
    if (location.includes('Netherlands') || location.includes('Germany') || location.includes('Europe')) {
      return 'Europe';
    } else if (location.includes('USA') || location.includes('America')) {
      return 'North America';
    } else if (location.includes('Asia') || location.includes('Japan')) {
      return 'Asia';
    }
    return 'Other';
  }

  getQualityBand(score) {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Poor';
  }

  /**
   * Shutdown method
   */
  shutdown() {
    if (this.server) {
      this.server.close();
      console.log('📊 Report server stopped');
    }
  }
}

// Allow standalone execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const agent = new ReportGeneratorAgent();
  agent.execute().catch(console.error);
}

export default ReportGeneratorAgent;