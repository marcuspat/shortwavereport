#!/usr/bin/env node

/**
 * Test Runner for Shortwave Monitor Test Suite
 * Runs comprehensive test suite with coverage reporting
 */

import { spawn, execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { TestConfig } from './test-config.js';
import { coverageConfig, validateCoverage, generateCoverageSummary, generateCoverageHTML } from './coverage.config.js';

class TestRunner {
  constructor() {
    this.results = {
      unit: { passed: 0, failed: 0, skipped: 0, duration: 0, details: [] },
      integration: { passed: 0, failed: 0, skipped: 0, duration: 0, details: [] },
      e2e: { passed: 0, failed: 0, skipped: 0, duration: 0, details: [] },
      coverage: null
    };
    
    this.config = {
      parallel: process.env.TEST_PARALLEL !== 'false',
      coverage: process.env.TEST_COVERAGE !== 'false',
      bail: process.env.TEST_BAIL === 'true',
      timeout: parseInt(process.env.TEST_TIMEOUT) || 60000,
      pattern: process.env.TEST_PATTERN || null,
      verbose: process.env.TEST_VERBOSE === 'true'
    };
  }

  /**
   * Main test execution
   */
  async run() {
    console.log('🧪 Starting Shortwave Monitor Test Suite');
    console.log('━'.repeat(80));
    
    const startTime = Date.now();
    
    try {
      // Initialize test environment
      await this.initialize();
      
      // Run test suites
      if (this.config.coverage) {
        await this.runWithCoverage();
      } else {
        await this.runWithoutCoverage();
      }
      
      // Generate reports
      await this.generateReports();
      
      const totalTime = (Date.now() - startTime) / 1000;
      await this.printSummary(totalTime);
      
      // Exit with appropriate code
      const hasFailures = this.results.unit.failed > 0 || 
                         this.results.integration.failed > 0 || 
                         this.results.e2e.failed > 0;
      
      process.exit(hasFailures ? 1 : 0);
      
    } catch (error) {
      console.error('❌ Test runner failed:', error);
      process.exit(1);
    }
  }

  /**
   * Initialize test environment
   */
  async initialize() {
    console.log('🔧 Initializing test environment...');
    
    await TestConfig.initialize();
    
    // Create coverage directory
    if (this.config.coverage) {
      await fs.mkdir(coverageConfig.reports.dir, { recursive: true });
    }
    
    console.log('✅ Test environment ready');
  }

  /**
   * Run tests with coverage collection
   */
  async runWithCoverage() {
    console.log('📊 Running tests with coverage collection...');
    
    // Install c8 if not available (for coverage)
    try {
      execSync('npx c8 --version', { stdio: 'pipe' });
    } catch (error) {
      console.log('📦 Installing c8 for coverage collection...');
      execSync('npm install --no-save c8', { stdio: 'inherit' });
    }

    const coverageArgs = [
      'c8',
      '--reporter=json',
      '--reporter=html',
      '--reporter=text',
      '--reporter=lcov',
      `--reports-dir=${coverageConfig.reports.dir}`,
      '--include=src/**/*.js',
      '--exclude=src/**/*.test.js',
      '--exclude=src/**/*.spec.js',
      '--exclude=tests/**',
      '--all'
    ];

    // Run all test suites with coverage
    await this.runTestSuite('unit', [...coverageArgs, 'node', '--test', 'tests/unit/**/*.test.js']);
    await this.runTestSuite('integration', [...coverageArgs, 'node', '--test', 'tests/integration/**/*.test.js']);
    await this.runTestSuite('e2e', [...coverageArgs, 'node', '--test', 'tests/e2e/**/*.test.js']);

    // Process coverage data
    await this.processCoverageData();
  }

  /**
   * Run tests without coverage
   */
  async runWithoutCoverage() {
    console.log('🏃 Running tests without coverage...');
    
    // Run test suites in parallel if enabled
    if (this.config.parallel) {
      const testPromises = [
        this.runTestSuite('unit', ['node', '--test', 'tests/unit/**/*.test.js']),
        this.runTestSuite('integration', ['node', '--test', 'tests/integration/**/*.test.js']),
        this.runTestSuite('e2e', ['node', '--test', 'tests/e2e/**/*.test.js'])
      ];
      
      await Promise.allSettled(testPromises);
    } else {
      await this.runTestSuite('unit', ['node', '--test', 'tests/unit/**/*.test.js']);
      await this.runTestSuite('integration', ['node', '--test', 'tests/integration/**/*.test.js']);
      await this.runTestSuite('e2e', ['node', '--test', 'tests/e2e/**/*.test.js']);
    }
  }

  /**
   * Run individual test suite
   */
  async runTestSuite(suiteName, command) {
    console.log(`\n🔍 Running ${suiteName} tests...`);
    
    const startTime = Date.now();
    const suiteResults = this.results[suiteName];
    
    return new Promise((resolve) => {
      const testProcess = spawn('npx', command, {
        stdio: this.config.verbose ? 'inherit' : 'pipe',
        env: { ...process.env, NODE_ENV: 'test', TEST_SUITE: suiteName }
      });

      let output = '';
      let errorOutput = '';

      if (!this.config.verbose) {
        testProcess.stdout?.on('data', (data) => {
          output += data.toString();
        });

        testProcess.stderr?.on('data', (data) => {
          errorOutput += data.toString();
        });
      }

      testProcess.on('close', (code) => {
        const duration = Date.now() - startTime;
        suiteResults.duration = duration;

        if (code === 0) {
          console.log(`✅ ${suiteName} tests completed successfully in ${(duration / 1000).toFixed(2)}s`);
          suiteResults.passed = this.parseTestCount(output, 'passed') || 1;
        } else {
          console.log(`❌ ${suiteName} tests failed (exit code: ${code})`);
          suiteResults.failed = this.parseTestCount(output, 'failed') || 1;
          
          if (!this.config.verbose) {
            console.log('Error output:', errorOutput);
          }
          
          if (this.config.bail) {
            console.log('🛑 Bailing out due to test failure');
            process.exit(1);
          }
        }

        suiteResults.details.push({
          command: command.join(' '),
          exitCode: code,
          duration,
          output: output.slice(-1000), // Keep last 1000 chars
          error: errorOutput.slice(-1000)
        });

        resolve();
      });

      // Handle timeout
      const timeout = setTimeout(() => {
        console.log(`⏰ ${suiteName} tests timed out after ${this.config.timeout}ms`);
        testProcess.kill('SIGTERM');
        suiteResults.failed = 1;
        resolve();
      }, this.config.timeout);

      testProcess.on('exit', () => {
        clearTimeout(timeout);
      });
    });
  }

  /**
   * Parse test count from output
   */
  parseTestCount(output, type) {
    const patterns = {
      passed: /(\d+)\s+(?:test[s]?\s+)?passed/i,
      failed: /(\d+)\s+(?:test[s]?\s+)?failed/i,
      skipped: /(\d+)\s+(?:test[s]?\s+)?skipped/i
    };

    const match = output.match(patterns[type]);
    return match ? parseInt(match[1]) : 0;
  }

  /**
   * Process coverage data
   */
  async processCoverageData() {
    try {
      const coverageFile = path.join(coverageConfig.reports.dir, 'coverage-final.json');
      const coverageData = JSON.parse(await fs.readFile(coverageFile, 'utf8'));
      
      // Validate coverage against thresholds
      const validation = validateCoverage(coverageData);
      this.results.coverage = {
        data: coverageData,
        validation,
        summary: generateCoverageSummary(coverageData)
      };

      if (!validation.passed) {
        console.log('⚠️ Coverage thresholds not met:');
        validation.failures.forEach(failure => {
          console.log(`  ❌ ${failure.message}`);
        });
      }

      if (validation.warnings.length > 0) {
        console.log('⚠️ Coverage warnings:');
        validation.warnings.slice(0, 5).forEach(warning => {
          console.log(`  ⚠️ ${warning.message}`);
        });
        if (validation.warnings.length > 5) {
          console.log(`  ... and ${validation.warnings.length - 5} more warnings`);
        }
      }

    } catch (error) {
      console.warn('Failed to process coverage data:', error.message);
    }
  }

  /**
   * Generate test reports
   */
  async generateReports() {
    console.log('\n📊 Generating test reports...');

    // Generate JSON report
    const reportData = {
      timestamp: new Date().toISOString(),
      configuration: this.config,
      results: this.results,
      environment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch
      }
    };

    const reportsDir = path.join(process.cwd(), 'tests', 'reports');
    await fs.mkdir(reportsDir, { recursive: true });

    // JSON report
    await fs.writeFile(
      path.join(reportsDir, 'test-results.json'),
      JSON.stringify(reportData, null, 2)
    );

    // HTML report
    const htmlReport = this.generateHTMLReport(reportData);
    await fs.writeFile(
      path.join(reportsDir, 'test-results.html'),
      htmlReport
    );

    // Coverage HTML if available
    if (this.results.coverage) {
      const coverageHTML = generateCoverageHTML(
        this.results.coverage.data,
        this.results.coverage.summary
      );
      await fs.writeFile(
        path.join(reportsDir, 'coverage-report.html'),
        coverageHTML
      );
    }

    console.log(`✅ Reports generated in ${reportsDir}`);
  }

  /**
   * Generate HTML test report
   */
  generateHTMLReport(reportData) {
    const { results } = reportData;
    const totalPassed = results.unit.passed + results.integration.passed + results.e2e.passed;
    const totalFailed = results.unit.failed + results.integration.failed + results.e2e.failed;
    const totalTests = totalPassed + totalFailed;
    const passRate = totalTests > 0 ? (totalPassed / totalTests * 100) : 0;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Results - Shortwave Monitor</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .header h1 { color: #2c3e50; margin-bottom: 10px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .card { background: #f8f9fa; padding: 20px; border-radius: 6px; text-align: center; }
        .card.passed { border-left: 4px solid #28a745; }
        .card.failed { border-left: 4px solid #dc3545; }
        .card.coverage { border-left: 4px solid #007bff; }
        .card-value { font-size: 2em; font-weight: bold; color: #2c3e50; }
        .card-label { color: #666; font-size: 14px; }
        .suite-results { margin-bottom: 30px; }
        .suite-results h3 { color: #2c3e50; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
        .progress-bar { width: 100%; height: 20px; background: #e9ecef; border-radius: 10px; overflow: hidden; margin: 10px 0; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #28a745, #20c997); transition: width 0.3s ease; }
        .details { background: #f8f9fa; padding: 15px; border-radius: 4px; margin-top: 15px; }
        .timestamp { color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 Test Results</h1>
            <p class="timestamp">Generated: ${reportData.timestamp}</p>
        </div>

        <div class="summary">
            <div class="card passed">
                <div class="card-value">${totalPassed}</div>
                <div class="card-label">Tests Passed</div>
            </div>
            <div class="card failed">
                <div class="card-value">${totalFailed}</div>
                <div class="card-label">Tests Failed</div>
            </div>
            <div class="card">
                <div class="card-value">${passRate.toFixed(1)}%</div>
                <div class="card-label">Pass Rate</div>
            </div>
            ${results.coverage ? `
            <div class="card coverage">
                <div class="card-value">${results.coverage.summary.qualityScore}%</div>
                <div class="card-label">Coverage</div>
            </div>
            ` : ''}
        </div>

        ${Object.entries(results).filter(([name]) => name !== 'coverage').map(([suiteName, suite]) => `
            <div class="suite-results">
                <h3>${suiteName.charAt(0).toUpperCase() + suiteName.slice(1)} Tests</h3>
                <p>Passed: <strong>${suite.passed}</strong> | Failed: <strong>${suite.failed}</strong> | Duration: <strong>${(suite.duration / 1000).toFixed(2)}s</strong></p>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${suite.passed + suite.failed > 0 ? (suite.passed / (suite.passed + suite.failed) * 100) : 0}%"></div>
                </div>
                ${suite.details.map(detail => `
                    <div class="details">
                        <strong>Command:</strong> ${detail.command}<br>
                        <strong>Exit Code:</strong> ${detail.exitCode}<br>
                        <strong>Duration:</strong> ${(detail.duration / 1000).toFixed(2)}s
                    </div>
                `).join('')}
            </div>
        `).join('')}

        ${results.coverage ? `
            <div class="suite-results">
                <h3>Coverage Results</h3>
                <p>Overall Score: <strong>${results.coverage.summary.qualityScore}%</strong> (Grade: ${results.coverage.summary.grade})</p>
                <div class="details">
                    <strong>Statements:</strong> ${results.coverage.summary.overall.statements.percentage.toFixed(1)}%<br>
                    <strong>Branches:</strong> ${results.coverage.summary.overall.branches.percentage.toFixed(1)}%<br>
                    <strong>Functions:</strong> ${results.coverage.summary.overall.functions.percentage.toFixed(1)}%<br>
                    <strong>Lines:</strong> ${results.coverage.summary.overall.lines.percentage.toFixed(1)}%
                </div>
            </div>
        ` : ''}
    </div>
</body>
</html>`;
  }

  /**
   * Print test summary to console
   */
  async printSummary(totalTime) {
    console.log('\n📊 Test Summary');
    console.log('━'.repeat(80));

    const { results } = this;
    const totalPassed = results.unit.passed + results.integration.passed + results.e2e.passed;
    const totalFailed = results.unit.failed + results.integration.failed + results.e2e.failed;
    const totalSkipped = results.unit.skipped + results.integration.skipped + results.e2e.skipped;
    const totalTests = totalPassed + totalFailed + totalSkipped;

    console.log(`Total Tests:     ${totalTests}`);
    console.log(`✅ Passed:        ${totalPassed}`);
    console.log(`❌ Failed:        ${totalFailed}`);
    console.log(`⏭️  Skipped:       ${totalSkipped}`);
    console.log(`⏱️  Total Time:    ${totalTime.toFixed(2)}s`);

    if (totalTests > 0) {
      const passRate = (totalPassed / totalTests * 100).toFixed(1);
      console.log(`📈 Pass Rate:     ${passRate}%`);
    }

    console.log('\nBy Test Suite:');
    Object.entries(results).forEach(([suiteName, suite]) => {
      if (suiteName === 'coverage') return;
      
      const total = suite.passed + suite.failed + suite.skipped;
      const rate = total > 0 ? (suite.passed / total * 100).toFixed(1) : '0.0';
      const time = (suite.duration / 1000).toFixed(2);
      
      console.log(`  ${suiteName.padEnd(12)} ${suite.passed.toString().padStart(3)}/${total.toString().padEnd(3)} (${rate}%) - ${time}s`);
    });

    if (results.coverage) {
      console.log('\nCoverage Summary:');
      const { summary } = results.coverage;
      console.log(`  Overall Score:   ${summary.qualityScore}% (${summary.grade})`);
      console.log(`  Statements:      ${summary.overall.statements.percentage.toFixed(1)}%`);
      console.log(`  Branches:        ${summary.overall.branches.percentage.toFixed(1)}%`);
      console.log(`  Functions:       ${summary.overall.functions.percentage.toFixed(1)}%`);
      console.log(`  Lines:           ${summary.overall.lines.percentage.toFixed(1)}%`);
    }

    console.log('━'.repeat(80));
    
    if (totalFailed > 0) {
      console.log('❌ Tests failed. See details above.');
    } else {
      console.log('✅ All tests passed!');
      
      if (results.coverage && results.coverage.validation.passed) {
        console.log('✅ Coverage thresholds met!');
      } else if (results.coverage) {
        console.log('⚠️ Some coverage thresholds not met.');
      }
    }
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new TestRunner();
  runner.run().catch(console.error);
}

export default TestRunner;