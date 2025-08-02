const fs = require('fs').promises;
const path = require('path');

class PerformanceReportGenerator {
  constructor() {
    this.templates = {
      html: this.generateHTMLReport.bind(this),
      json: this.generateJSONReport.bind(this),
      junit: this.generateJUnitReport.bind(this),
      markdown: this.generateMarkdownReport.bind(this),
      csv: this.generateCSVReport.bind(this)
    };
  }

  async generateReport(data, format = 'json', outputPath = null) {
    if (!this.templates[format]) {
      throw new Error(`Unsupported report format: ${format}`);
    }

    const report = await this.templates[format](data);
    
    if (outputPath) {
      await fs.writeFile(outputPath, report);
      console.log(`📄 ${format.toUpperCase()} report saved to: ${outputPath}`);
    }

    return report;
  }

  async generateJSONReport(data) {
    return JSON.stringify(data, null, 2);
  }

  async generateHTMLReport(data) {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric-card { background: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 4px solid #007bff; }
        .metric-value { font-size: 24px; font-weight: bold; color: #007bff; }
        .metric-label { color: #666; font-size: 14px; }
        .status-passed { color: #28a745; }
        .status-failed { color: #dc3545; }
        .status-warning { color: #ffc107; }
        .section { margin-bottom: 30px; }
        .section h2 { border-bottom: 2px solid #007bff; padding-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; font-weight: bold; }
        .chart-container { height: 300px; margin: 20px 0; }
        .recommendations { background: #e7f3ff; padding: 15px; border-radius: 6px; border-left: 4px solid #007bff; }
        .issue-critical { color: #dc3545; }
        .issue-high { color: #fd7e14; }
        .issue-medium { color: #ffc107; }
        .issue-low { color: #6c757d; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Performance Test Report</h1>
            <p>Generated on ${new Date(data.timestamp).toLocaleString()}</p>
            <p class="status-${data.summary?.overallStatus?.toLowerCase() || 'unknown'}">
                Status: ${data.summary?.overallStatus || 'Unknown'}
            </p>
        </div>

        <div class="summary">
            <div class="metric-card">
                <div class="metric-value">${data.duration?.minutes || 0}m ${(data.duration?.seconds || 0) % 60}s</div>
                <div class="metric-label">Total Duration</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${data.summary?.completedPhases || 0}/${data.summary?.totalPhases || 0}</div>
                <div class="metric-label">Phases Completed</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${data.summary?.criticalIssues || 0}</div>
                <div class="metric-label">Critical Issues</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${data.summary?.warnings || 0}</div>
                <div class="metric-label">Warnings</div>
            </div>
        </div>

        ${this.generateLoadTestSection(data.results?.loadTest)}
        ${this.generateStressTestSection(data.results?.stressTest)}
        ${this.generateBenchmarkSection(data.results?.benchmark)}
        ${this.generateRegressionSection(data.results?.regression)}
        ${this.generateRecommendationsSection(data.recommendations)}
    </div>
</body>
</html>`;
    return html;
  }

  generateLoadTestSection(loadTestData) {
    if (!loadTestData?.results) return '';

    const results = loadTestData.results.filter(r => !r.error);
    const passedTests = results.filter(r => r.analysis?.passed);
    const failedTests = results.filter(r => r.analysis?.passed === false);

    return `
        <div class="section">
            <h2>Load Testing Results</h2>
            <p>Passed: ${passedTests.length} | Failed: ${failedTests.length} | Total: ${results.length}</p>
            
            <table>
                <thead>
                    <tr>
                        <th>Endpoint</th>
                        <th>Status</th>
                        <th>P95 Latency (ms)</th>
                        <th>Throughput (req/s)</th>
                        <th>Error Rate</th>
                    </tr>
                </thead>
                <tbody>
                    ${results.map(result => `
                        <tr>
                            <td>${result.endpointName || 'Unknown'}</td>
                            <td class="status-${result.analysis?.passed ? 'passed' : 'failed'}">
                                ${result.analysis?.passed ? 'PASSED' : 'FAILED'}
                            </td>
                            <td>${result.results?.latency?.p95?.toFixed(2) || 'N/A'}</td>
                            <td>${result.results?.requests?.mean?.toFixed(2) || 'N/A'}</td>
                            <td>${((result.results?.errors || 0) / (result.results?.requests?.total || 1) * 100).toFixed(2)}%</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>`;
  }

  generateStressTestSection(stressTestData) {
    if (!stressTestData?.results) return '';

    const results = stressTestData.results.filter(r => !r.error && r.analysis);

    return `
        <div class="section">
            <h2>Stress Testing Results</h2>
            
            <table>
                <thead>
                    <tr>
                        <th>Endpoint</th>
                        <th>Resilience</th>
                        <th>P95 Latency (ms)</th>
                        <th>Error Rate</th>
                        <th>Issues</th>
                    </tr>
                </thead>
                <tbody>
                    ${results.map(result => `
                        <tr>
                            <td>${result.endpointName || 'Unknown'}</td>
                            <td class="status-${result.analysis.resilience === 'excellent' ? 'passed' : 
                                              result.analysis.resilience === 'poor' ? 'failed' : 'warning'}">
                                ${result.analysis.resilience.toUpperCase()}
                            </td>
                            <td>${result.results?.latency?.p95?.toFixed(2) || 'N/A'}</td>
                            <td>${((result.results?.errors || 0) / (result.results?.requests?.total || 1) * 100).toFixed(2)}%</td>
                            <td>${result.analysis.issues.length}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>`;
  }

  generateBenchmarkSection(benchmarkData) {
    if (!benchmarkData?.results) return '';

    const results = benchmarkData.results.filter(r => !r.error && r.analysis);

    return `
        <div class="section">
            <h2>Benchmark Results</h2>
            
            <table>
                <thead>
                    <tr>
                        <th>Endpoint</th>
                        <th>Grade</th>
                        <th>Score</th>
                        <th>Mean Response (ms)</th>
                        <th>P95 Response (ms)</th>
                        <th>Throughput (req/s)</th>
                    </tr>
                </thead>
                <tbody>
                    ${results.map(result => `
                        <tr>
                            <td>${result.endpoint}</td>
                            <td class="status-${result.analysis.grade === 'A' ? 'passed' : 
                                              result.analysis.grade === 'F' ? 'failed' : 'warning'}">
                                ${result.analysis.grade}
                            </td>
                            <td>${result.analysis.score}/100</td>
                            <td>${result.responseTimes?.mean?.toFixed(2) || 'N/A'}</td>
                            <td>${result.responseTimes?.p95?.toFixed(2) || 'N/A'}</td>
                            <td>${result.throughput?.requestsPerSecond?.toFixed(2) || 'N/A'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>`;
  }

  generateRegressionSection(regressionData) {
    if (!regressionData?.regressions) return '';

    return `
        <div class="section">
            <h2>Regression Testing Results</h2>
            ${regressionData.regressions.length === 0 ? 
                '<p class="status-passed">No performance regressions detected</p>' :
                `<p class="status-failed">${regressionData.regressions.length} regression(s) detected</p>
                <table>
                    <thead>
                        <tr>
                            <th>Endpoint</th>
                            <th>Metric</th>
                            <th>Current</th>
                            <th>Baseline</th>
                            <th>Regression</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${regressionData.regressions.map(regression => 
                            regression.regressions.map(r => `
                                <tr>
                                    <td>${regression.endpoint}</td>
                                    <td>${r.metric}</td>
                                    <td>${r.current}</td>
                                    <td>${r.baseline}</td>
                                    <td class="status-failed">${r.regression}</td>
                                </tr>
                            `).join('')
                        ).join('')}
                    </tbody>
                </table>`
            }
        </div>`;
  }

  generateRecommendationsSection(recommendations) {
    if (!recommendations || recommendations.length === 0) return '';

    return `
        <div class="section">
            <h2>Recommendations</h2>
            <div class="recommendations">
                ${recommendations.map(rec => `
                    <div style="margin-bottom: 15px;">
                        <strong class="issue-${rec.priority}">${rec.category}</strong>
                        <p>${rec.recommendation}</p>
                    </div>
                `).join('')}
            </div>
        </div>`;
  }

  async generateJUnitReport(data) {
    const testSuites = [];
    
    // Load test suite
    if (data.results?.loadTest?.results) {
      const results = data.results.loadTest.results.filter(r => !r.error);
      const testCases = results.map(result => {
        const passed = result.analysis?.passed;
        const failures = result.analysis?.issues || [];
        
        return `
        <testcase name="${result.endpointName || 'Unknown'}" 
                  classname="LoadTest" 
                  time="${(result.results?.duration || 0) / 1000}">
          ${!passed ? `<failure message="Performance thresholds not met">
            ${failures.map(f => `${f.type}: ${f.value}`).join('\n')}
          </failure>` : ''}
        </testcase>`;
      });

      testSuites.push(`
      <testsuite name="Load Testing" 
                 tests="${results.length}" 
                 failures="${results.filter(r => !r.analysis?.passed).length}" 
                 time="${data.duration?.seconds || 0}">
        ${testCases.join('')}
      </testsuite>`);
    }

    // Stress test suite
    if (data.results?.stressTest?.results) {
      const results = data.results.stressTest.results.filter(r => !r.error && r.analysis);
      const testCases = results.map(result => {
        const passed = result.analysis.passed;
        const failures = result.analysis.issues || [];
        
        return `
        <testcase name="${result.endpointName || 'Unknown'}" 
                  classname="StressTest" 
                  time="${(result.results?.duration || 0) / 1000}">
          ${!passed ? `<failure message="Stress test failed">
            ${failures.map(f => `${f.type}: ${f.value}`).join('\n')}
          </failure>` : ''}
        </testcase>`;
      });

      testSuites.push(`
      <testsuite name="Stress Testing" 
                 tests="${results.length}" 
                 failures="${results.filter(r => !r.analysis.passed).length}" 
                 time="${data.duration?.seconds || 0}">
        ${testCases.join('')}
      </testsuite>`);
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="Performance Tests" 
            tests="${data.summary?.totalPhases || 0}" 
            failures="${data.summary?.criticalIssues || 0}" 
            time="${data.duration?.seconds || 0}">
  ${testSuites.join('')}
</testsuites>`;
  }

  async generateMarkdownReport(data) {
    return `# Performance Test Report

**Generated:** ${new Date(data.timestamp).toLocaleString()}  
**Duration:** ${data.duration?.minutes || 0}m ${(data.duration?.seconds || 0) % 60}s  
**Status:** ${data.summary?.overallStatus || 'Unknown'}

## Summary

- **Phases Completed:** ${data.summary?.completedPhases || 0}/${data.summary?.totalPhases || 0}
- **Critical Issues:** ${data.summary?.criticalIssues || 0}
- **Warnings:** ${data.summary?.warnings || 0}

${this.generateMarkdownLoadTestSection(data.results?.loadTest)}
${this.generateMarkdownStressTestSection(data.results?.stressTest)}
${this.generateMarkdownBenchmarkSection(data.results?.benchmark)}
${this.generateMarkdownRegressionSection(data.results?.regression)}
${this.generateMarkdownRecommendationsSection(data.recommendations)}
`;
  }

  generateMarkdownLoadTestSection(loadTestData) {
    if (!loadTestData?.results) return '';

    const results = loadTestData.results.filter(r => !r.error);
    const passedTests = results.filter(r => r.analysis?.passed);

    return `
## Load Testing Results

**Passed:** ${passedTests.length} | **Failed:** ${results.length - passedTests.length} | **Total:** ${results.length}

| Endpoint | Status | P95 Latency (ms) | Throughput (req/s) | Error Rate |
|----------|--------|------------------|-------------------|------------|
${results.map(result => 
  `| ${result.endpointName || 'Unknown'} | ${result.analysis?.passed ? '✅' : '❌'} | ${result.results?.latency?.p95?.toFixed(2) || 'N/A'} | ${result.results?.requests?.mean?.toFixed(2) || 'N/A'} | ${((result.results?.errors || 0) / (result.results?.requests?.total || 1) * 100).toFixed(2)}% |`
).join('\n')}
`;
  }

  generateMarkdownStressTestSection(stressTestData) {
    if (!stressTestData?.results) return '';

    const results = stressTestData.results.filter(r => !r.error && r.analysis);

    return `
## Stress Testing Results

| Endpoint | Resilience | P95 Latency (ms) | Error Rate | Issues |
|----------|------------|------------------|------------|--------|
${results.map(result => 
  `| ${result.endpointName || 'Unknown'} | ${result.analysis.resilience} | ${result.results?.latency?.p95?.toFixed(2) || 'N/A'} | ${((result.results?.errors || 0) / (result.results?.requests?.total || 1) * 100).toFixed(2)}% | ${result.analysis.issues.length} |`
).join('\n')}
`;
  }

  generateMarkdownBenchmarkSection(benchmarkData) {
    if (!benchmarkData?.results) return '';

    const results = benchmarkData.results.filter(r => !r.error && r.analysis);

    return `
## Benchmark Results

| Endpoint | Grade | Score | Mean Response (ms) | P95 Response (ms) | Throughput (req/s) |
|----------|-------|-------|-------------------|-------------------|-------------------|
${results.map(result => 
  `| ${result.endpoint} | ${result.analysis.grade} | ${result.analysis.score}/100 | ${result.responseTimes?.mean?.toFixed(2) || 'N/A'} | ${result.responseTimes?.p95?.toFixed(2) || 'N/A'} | ${result.throughput?.requestsPerSecond?.toFixed(2) || 'N/A'} |`
).join('\n')}
`;
  }

  generateMarkdownRegressionSection(regressionData) {
    if (!regressionData?.regressions) return '';

    if (regressionData.regressions.length === 0) {
      return `
## Regression Testing Results

✅ No performance regressions detected
`;
    }

    return `
## Regression Testing Results

❌ ${regressionData.regressions.length} regression(s) detected

| Endpoint | Metric | Current | Baseline | Regression |
|----------|--------|---------|----------|------------|
${regressionData.regressions.map(regression => 
  regression.regressions.map(r => 
    `| ${regression.endpoint} | ${r.metric} | ${r.current} | ${r.baseline} | ${r.regression} |`
  ).join('\n')
).join('\n')}
`;
  }

  generateMarkdownRecommendationsSection(recommendations) {
    if (!recommendations || recommendations.length === 0) return '';

    return `
## Recommendations

${recommendations.map(rec => 
  `### ${rec.category} (${rec.priority} priority)
${rec.recommendation}
`).join('\n')}
`;
  }

  async generateCSVReport(data) {
    const csvRows = ['Test Type,Endpoint,Status,P95 Latency (ms),Throughput (req/s),Error Rate,Score'];

    // Load test results
    if (data.results?.loadTest?.results) {
      data.results.loadTest.results.filter(r => !r.error).forEach(result => {
        csvRows.push([
          'Load Test',
          result.endpointName || 'Unknown',
          result.analysis?.passed ? 'PASSED' : 'FAILED',
          result.results?.latency?.p95?.toFixed(2) || 'N/A',
          result.results?.requests?.mean?.toFixed(2) || 'N/A',
          ((result.results?.errors || 0) / (result.results?.requests?.total || 1) * 100).toFixed(2) + '%',
          'N/A'
        ].join(','));
      });
    }

    // Stress test results
    if (data.results?.stressTest?.results) {
      data.results.stressTest.results.filter(r => !r.error && r.analysis).forEach(result => {
        csvRows.push([
          'Stress Test',
          result.endpointName || 'Unknown',
          result.analysis.passed ? 'PASSED' : 'FAILED',
          result.results?.latency?.p95?.toFixed(2) || 'N/A',
          result.results?.requests?.mean?.toFixed(2) || 'N/A',
          ((result.results?.errors || 0) / (result.results?.requests?.total || 1) * 100).toFixed(2) + '%',
          'N/A'
        ].join(','));
      });
    }

    // Benchmark results
    if (data.results?.benchmark?.results) {
      data.results.benchmark.results.filter(r => !r.error && r.analysis).forEach(result => {
        csvRows.push([
          'Benchmark',
          result.endpoint,
          result.analysis.grade,
          result.responseTimes?.p95?.toFixed(2) || 'N/A',
          result.throughput?.requestsPerSecond?.toFixed(2) || 'N/A',
          'N/A',
          result.analysis.score + '/100'
        ].join(','));
      });
    }

    return csvRows.join('\n');
  }
}

module.exports = PerformanceReportGenerator;