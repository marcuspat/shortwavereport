/**
 * Test Coverage Configuration
 * Configures code coverage collection and reporting
 */

export const coverageConfig = {
  // Coverage collection settings
  collect: {
    // Include patterns for coverage
    include: [
      'src/**/*.js',
      '!src/**/*.test.js',
      '!src/**/*.spec.js'
    ],
    
    // Exclude patterns from coverage
    exclude: [
      'node_modules/**',
      'tests/**',
      'coverage/**',
      'dist/**',
      '**/*.config.js',
      '**/*.conf.js',
      'src/reports/**', // Generated HTML reports
      'src/demo.js'     // Demo files
    ],
    
    // File extensions to include
    extensions: ['.js', '.mjs'],
    
    // Source map support
    sourceMap: true,
    
    // Instrument options
    instrument: {
      compact: false,
      preserveComments: true,
      esModules: true
    }
  },

  // Coverage thresholds
  thresholds: {
    global: {
      statements: 90,
      branches: 85,
      functions: 90,
      lines: 90
    },
    
    // Per-file thresholds
    perFile: {
      statements: 80,
      branches: 75,
      functions: 80,
      lines: 80
    }
  },

  // Report generation
  reports: {
    // Output directory
    dir: 'coverage',
    
    // Report formats
    formats: [
      'html',      // HTML report for detailed viewing
      'json',      // JSON for CI/CD integration
      'lcov',      // LCOV for external tools
      'text',      // Console text summary
      'cobertura'  // Cobertura XML for Jenkins/etc
    ],
    
    // Report options
    options: {
      html: {
        skipEmpty: false,
        skipFull: false,
        maxCols: 120
      },
      text: {
        skipEmpty: false,
        skipFull: false,
        maxCols: 80
      }
    }
  },

  // Badge generation
  badges: {
    enabled: true,
    outputDir: 'coverage/badges',
    formats: ['svg', 'png'],
    thresholds: {
      excellent: 95,
      good: 90,
      ok: 80,
      poor: 70
    }
  }
};

/**
 * Generate coverage badge configuration
 */
export function generateBadgeConfig(coverageData) {
  const { thresholds } = coverageConfig.badges;
  
  function getBadgeColor(percentage) {
    if (percentage >= thresholds.excellent) return 'brightgreen';
    if (percentage >= thresholds.good) return 'green';
    if (percentage >= thresholds.ok) return 'yellow';
    if (percentage >= thresholds.poor) return 'orange';
    return 'red';
  }

  function getBadgeLabel(percentage) {
    if (percentage >= thresholds.excellent) return 'excellent';
    if (percentage >= thresholds.good) return 'good';
    if (percentage >= thresholds.ok) return 'ok';
    if (percentage >= thresholds.poor) return 'poor';
    return 'needs improvement';
  }

  const badges = {};
  
  ['statements', 'branches', 'functions', 'lines'].forEach(metric => {
    const percentage = coverageData[metric]?.pct || 0;
    badges[metric] = {
      subject: metric,
      status: `${percentage.toFixed(1)}%`,
      color: getBadgeColor(percentage),
      label: getBadgeLabel(percentage)
    };
  });

  // Overall coverage badge
  const overall = (
    (coverageData.statements?.pct || 0) +
    (coverageData.branches?.pct || 0) +
    (coverageData.functions?.pct || 0) +
    (coverageData.lines?.pct || 0)
  ) / 4;

  badges.overall = {
    subject: 'coverage',
    status: `${overall.toFixed(1)}%`,
    color: getBadgeColor(overall),
    label: getBadgeLabel(overall)
  };

  return badges;
}

/**
 * Validate coverage against thresholds
 */
export function validateCoverage(coverageData) {
  const { thresholds } = coverageConfig;
  const results = {
    passed: true,
    failures: [],
    warnings: []
  };

  // Check global thresholds
  Object.entries(thresholds.global).forEach(([metric, threshold]) => {
    const actual = coverageData[metric]?.pct || 0;
    
    if (actual < threshold) {
      results.passed = false;
      results.failures.push({
        type: 'global',
        metric,
        actual,
        threshold,
        message: `Global ${metric} coverage ${actual.toFixed(1)}% below threshold ${threshold}%`
      });
    }
  });

  // Check per-file thresholds
  if (coverageData.files) {
    Object.entries(coverageData.files).forEach(([filename, fileData]) => {
      Object.entries(thresholds.perFile).forEach(([metric, threshold]) => {
        const actual = fileData[metric]?.pct || 0;
        
        if (actual < threshold) {
          results.warnings.push({
            type: 'file',
            file: filename,
            metric,
            actual,
            threshold,
            message: `File ${filename} ${metric} coverage ${actual.toFixed(1)}% below threshold ${threshold}%`
          });
        }
      });
    });
  }

  return results;
}

/**
 * Generate coverage summary
 */
export function generateCoverageSummary(coverageData) {
  const summary = {
    timestamp: new Date().toISOString(),
    overall: {},
    details: {},
    files: {
      total: 0,
      covered: 0,
      uncovered: 0
    }
  };

  // Calculate overall metrics
  ['statements', 'branches', 'functions', 'lines'].forEach(metric => {
    const data = coverageData[metric] || {};
    summary.overall[metric] = {
      total: data.total || 0,
      covered: data.covered || 0,
      skipped: data.skipped || 0,
      percentage: data.pct || 0
    };
  });

  // File statistics
  if (coverageData.files) {
    summary.files.total = Object.keys(coverageData.files).length;
    
    Object.values(coverageData.files).forEach(fileData => {
      const hasStatements = (fileData.statements?.total || 0) > 0;
      if (hasStatements) {
        const coverage = fileData.statements?.pct || 0;
        if (coverage > 0) {
          summary.files.covered++;
        } else {
          summary.files.uncovered++;
        }
      }
    });
  }

  // Calculate quality score
  const avgCoverage = Object.values(summary.overall)
    .reduce((sum, metric) => sum + metric.percentage, 0) / 4;
  
  summary.qualityScore = Math.round(avgCoverage);
  summary.grade = getQualityGrade(avgCoverage);

  return summary;
}

/**
 * Get quality grade based on coverage percentage
 */
function getQualityGrade(percentage) {
  if (percentage >= 95) return 'A+';
  if (percentage >= 90) return 'A';
  if (percentage >= 85) return 'B+';
  if (percentage >= 80) return 'B';
  if (percentage >= 75) return 'C+';
  if (percentage >= 70) return 'C';
  if (percentage >= 60) return 'D';
  return 'F';
}

/**
 * Generate HTML coverage report
 */
export function generateCoverageHTML(coverageData, summary) {
  const badges = generateBadgeConfig(coverageData);
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Coverage Report - Shortwave Monitor</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .header h1 { color: #2c3e50; margin-bottom: 10px; }
        .timestamp { color: #666; font-size: 14px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric-card { background: #f8f9fa; padding: 20px; border-radius: 6px; text-align: center; border-left: 4px solid #007bff; }
        .metric-value { font-size: 2em; font-weight: bold; color: #2c3e50; }
        .metric-label { color: #666; font-size: 14px; text-transform: uppercase; }
        .quality-score { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
        .details { margin-top: 30px; }
        .details table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        .details th, .details td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        .details th { background: #f8f9fa; font-weight: bold; }
        .coverage-bar { width: 100%; height: 20px; background: #e9ecef; border-radius: 10px; overflow: hidden; }
        .coverage-fill { height: 100%; transition: width 0.3s ease; }
        .excellent { background: linear-gradient(90deg, #28a745, #20c997); }
        .good { background: linear-gradient(90deg, #20c997, #17a2b8); }
        .ok { background: linear-gradient(90deg, #ffc107, #fd7e14); }
        .poor { background: linear-gradient(90deg, #fd7e14, #dc3545); }
        .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; color: white; font-size: 12px; margin-right: 5px; }
        .badge.excellent { background: #28a745; }
        .badge.good { background: #20c997; }
        .badge.ok { background: #ffc107; color: #000; }
        .badge.poor { background: #dc3545; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Test Coverage Report</h1>
            <p class="timestamp">Generated: ${summary.timestamp}</p>
        </div>

        <div class="summary">
            ${Object.entries(summary.overall).map(([metric, data]) => `
                <div class="metric-card">
                    <div class="metric-value">${data.percentage.toFixed(1)}%</div>
                    <div class="metric-label">${metric}</div>
                    <div class="coverage-bar">
                        <div class="coverage-fill ${badges[metric].label}" style="width: ${data.percentage}%"></div>
                    </div>
                    <span class="badge ${badges[metric].label}">${badges[metric].label}</span>
                </div>
            `).join('')}
            
            <div class="metric-card quality-score">
                <div class="metric-value">${summary.qualityScore}%</div>
                <div class="metric-label">Overall Score</div>
                <div style="margin-top: 10px; font-size: 1.2em;">Grade: ${summary.grade}</div>
            </div>
        </div>

        <div class="details">
            <h2>Coverage Details</h2>
            <table>
                <thead>
                    <tr>
                        <th>Metric</th>
                        <th>Covered</th>
                        <th>Total</th>
                        <th>Percentage</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(summary.overall).map(([metric, data]) => `
                        <tr>
                            <td>${metric.charAt(0).toUpperCase() + metric.slice(1)}</td>
                            <td>${data.covered}</td>
                            <td>${data.total}</td>
                            <td>${data.percentage.toFixed(1)}%</td>
                            <td><span class="badge ${badges[metric].label}">${badges[metric].label}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <h3>File Statistics</h3>
            <p>Total Files: <strong>${summary.files.total}</strong></p>
            <p>Files with Coverage: <strong>${summary.files.covered}</strong></p>
            <p>Files without Coverage: <strong>${summary.files.uncovered}</strong></p>
        </div>
    </div>
</body>
</html>`;
}

export default coverageConfig;