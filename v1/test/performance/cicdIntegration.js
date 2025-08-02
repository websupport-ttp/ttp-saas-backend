#!/usr/bin/env node

const PerformanceTestRunner = require('./runAllTests');
const config = require('./performanceTestConfig');
const PerformanceUtils = require('./utils/performanceUtils');
const path = require('path');
const fs = require('fs').promises;

class CICDPerformanceIntegration {
  constructor() {
    this.exitCode = 0;
    this.results = null;
    this.notifications = [];
  }

  async runCICDPerformanceTests() {
    console.log('🚀 Starting CI/CD Performance Testing Integration');
    console.log('================================================');
    
    const startTime = Date.now();
    
    try {
      // Determine test configuration based on environment
      const testConfig = this.getTestConfiguration();
      console.log(`Test Configuration: ${testConfig.name}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Branch: ${process.env.CI_COMMIT_REF_NAME || process.env.GITHUB_REF_NAME || 'unknown'}`);
      console.log('');

      // Run performance tests
      const runner = new PerformanceTestRunner();
      await runner.runAllTests(testConfig.options);
      
      this.results = runner.results;
      
      // Analyze results for CI/CD
      const analysis = await this.analyzeCICDResults();
      
      // Generate CI/CD specific reports
      await this.generateCICDReports(analysis);
      
      // Send notifications if configured
      await this.sendNotifications(analysis);
      
      // Set exit code based on results
      this.setExitCode(analysis);
      
      const duration = Date.now() - startTime;
      console.log(`\n🏁 CI/CD Performance Testing Complete (${Math.round(duration / 1000)}s)`);
      console.log(`Exit Code: ${this.exitCode}`);
      
    } catch (error) {
      console.error('❌ CI/CD Performance Testing Failed:', error);
      this.exitCode = 1;
      
      await this.handleTestFailure(error);
    }
    
    process.exit(this.exitCode);
  }

  getTestConfiguration() {
    const environment = process.env.NODE_ENV || 'development';
    const branch = process.env.CI_COMMIT_REF_NAME || process.env.GITHUB_REF_NAME || 'unknown';
    const isPR = process.env.CI_MERGE_REQUEST_ID || process.env.GITHUB_EVENT_NAME === 'pull_request';
    
    // Different configurations for different scenarios
    if (isPR) {
      return {
        name: 'Pull Request Validation',
        options: {
          skipStress: true,  // Skip heavy stress tests for PRs
          skipBenchmark: false,
          skipRegression: false,
          createBaseline: false
        }
      };
    } else if (branch === 'main' || branch === 'master') {
      return {
        name: 'Main Branch Full Testing',
        options: {
          skipLoad: false,
          skipStress: false,
          skipBenchmark: false,
          skipRegression: false,
          createBaseline: false
        }
      };
    } else if (environment === 'production') {
      return {
        name: 'Production Deployment Validation',
        options: {
          skipLoad: false,
          skipStress: true,  // Don't stress test production
          skipBenchmark: false,
          skipRegression: false,
          createBaseline: true  // Update baseline for production
        }
      };
    } else {
      return {
        name: 'Development Branch Testing',
        options: {
          skipLoad: false,
          skipStress: true,
          skipBenchmark: true,
          skipRegression: false,
          createBaseline: false
        }
      };
    }
  }

  async analyzeCICDResults() {
    const analysis = {
      overall: 'PASSED',
      criticalIssues: [],
      warnings: [],
      regressions: [],
      recommendations: [],
      metrics: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        averageResponseTime: 0,
        averageThroughput: 0,
        errorRate: 0
      }
    };

    // Analyze load test results
    if (this.results.loadTest?.results) {
      const loadResults = this.results.loadTest.results.filter(r => !r.error);
      analysis.metrics.totalTests += loadResults.length;
      
      const failedLoadTests = loadResults.filter(r => !r.analysis?.passed);
      analysis.metrics.failedTests += failedLoadTests.length;
      analysis.metrics.passedTests += loadResults.length - failedLoadTests.length;
      
      // Check for critical load test failures
      failedLoadTests.forEach(test => {
        const criticalIssues = test.analysis.issues.filter(i => i.severity === 'critical');
        if (criticalIssues.length > 0) {
          analysis.criticalIssues.push({
            type: 'Load Test Failure',
            endpoint: test.endpointName,
            issues: criticalIssues
          });
        }
      });
      
      // Calculate average metrics
      const validResults = loadResults.filter(r => r.results);
      if (validResults.length > 0) {
        analysis.metrics.averageResponseTime = validResults.reduce((sum, r) => sum + r.results.latency.p95, 0) / validResults.length;
        analysis.metrics.averageThroughput = validResults.reduce((sum, r) => sum + r.results.requests.mean, 0) / validResults.length;
        analysis.metrics.errorRate = validResults.reduce((sum, r) => sum + (r.results.errors / r.results.requests.total), 0) / validResults.length;
      }
    }

    // Analyze stress test results
    if (this.results.stressTest?.results) {
      const stressResults = this.results.stressTest.results.filter(r => !r.error && r.analysis);
      const poorResilienceTests = stressResults.filter(r => r.analysis.resilience === 'poor');
      
      if (poorResilienceTests.length > 0) {
        analysis.criticalIssues.push({
          type: 'Poor Stress Resilience',
          count: poorResilienceTests.length,
          endpoints: poorResilienceTests.map(t => t.endpointName)
        });
      }
    }

    // Analyze regression results
    if (this.results.regression?.regressions?.length > 0) {
      analysis.regressions = this.results.regression.regressions;
      analysis.criticalIssues.push({
        type: 'Performance Regression',
        count: this.results.regression.regressions.length,
        regressions: this.results.regression.regressions
      });
    }

    // Set overall status
    if (analysis.criticalIssues.length > 0) {
      analysis.overall = 'FAILED';
    } else if (analysis.warnings.length > 0) {
      analysis.overall = 'WARNING';
    }

    // Generate recommendations
    this.generateCICDRecommendations(analysis);

    return analysis;
  }

  generateCICDRecommendations(analysis) {
    if (analysis.criticalIssues.length > 0) {
      analysis.recommendations.push('❌ Critical performance issues detected - deployment should be blocked');
      analysis.recommendations.push('🔍 Review failed endpoints and optimize before merging');
    }

    if (analysis.regressions.length > 0) {
      analysis.recommendations.push('📉 Performance regressions detected - consider reverting recent changes');
      analysis.recommendations.push('🔄 Run regression analysis to identify root cause');
    }

    if (analysis.metrics.errorRate > 0.01) {
      analysis.recommendations.push('⚠️ High error rate detected - investigate error handling');
    }

    if (analysis.metrics.averageResponseTime > 500) {
      analysis.recommendations.push('🐌 Slow response times detected - optimize database queries and caching');
    }

    if (analysis.overall === 'PASSED') {
      analysis.recommendations.push('✅ All performance tests passed - safe to deploy');
      analysis.recommendations.push('📊 Consider updating performance baselines if this is a major release');
    }
  }

  async generateCICDReports(analysis) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportsDir = path.join(__dirname, 'results', 'cicd');
    
    try {
      await fs.mkdir(reportsDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    // Generate CI/CD summary report
    const summaryReport = {
      cicd: {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        branch: process.env.CI_COMMIT_REF_NAME || process.env.GITHUB_REF_NAME || 'unknown',
        commit: process.env.CI_COMMIT_SHA || process.env.GITHUB_SHA || 'unknown',
        buildNumber: process.env.CI_PIPELINE_ID || process.env.GITHUB_RUN_NUMBER || 'unknown'
      },
      analysis,
      results: this.results
    };

    // Save JSON report
    const jsonPath = path.join(reportsDir, `cicd-performance-${timestamp}.json`);
    await fs.writeFile(jsonPath, JSON.stringify(summaryReport, null, 2));

    // Generate multi-format reports
    const basePath = path.join(reportsDir, `cicd-performance-${timestamp}`);
    await PerformanceUtils.generateMultiFormatReports(summaryReport, basePath);

    // Generate GitHub Actions / GitLab CI specific outputs
    await this.generateCIOutputs(analysis, reportsDir);

    console.log(`📄 CI/CD reports generated in: ${reportsDir}`);
  }

  async generateCIOutputs(analysis, reportsDir) {
    // GitHub Actions outputs
    if (process.env.GITHUB_ACTIONS) {
      const outputs = [
        `performance_status=${analysis.overall}`,
        `critical_issues=${analysis.criticalIssues.length}`,
        `warnings=${analysis.warnings.length}`,
        `regressions=${analysis.regressions.length}`,
        `average_response_time=${analysis.metrics.averageResponseTime.toFixed(2)}`,
        `average_throughput=${analysis.metrics.averageThroughput.toFixed(2)}`,
        `error_rate=${(analysis.metrics.errorRate * 100).toFixed(2)}`
      ];

      const outputsPath = path.join(reportsDir, 'github-outputs.txt');
      await fs.writeFile(outputsPath, outputs.join('\n'));

      // Set GitHub Actions outputs
      outputs.forEach(output => {
        console.log(`::set-output name=${output}`);
      });

      // Create job summary
      const summary = this.generateGitHubSummary(analysis);
      const summaryPath = path.join(reportsDir, 'github-summary.md');
      await fs.writeFile(summaryPath, summary);
      
      if (process.env.GITHUB_STEP_SUMMARY) {
        await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
      }
    }

    // GitLab CI outputs
    if (process.env.GITLAB_CI) {
      const metrics = [
        `performance_status ${analysis.overall}`,
        `critical_issues ${analysis.criticalIssues.length}`,
        `average_response_time ${analysis.metrics.averageResponseTime.toFixed(2)}`,
        `average_throughput ${analysis.metrics.averageThroughput.toFixed(2)}`
      ];

      const metricsPath = path.join(reportsDir, 'gitlab-metrics.txt');
      await fs.writeFile(metricsPath, metrics.join('\n'));
    }
  }

  generateGitHubSummary(analysis) {
    return `# 🚀 Performance Test Results

## Overall Status: ${analysis.overall === 'PASSED' ? '✅' : analysis.overall === 'WARNING' ? '⚠️' : '❌'} ${analysis.overall}

### 📊 Test Summary
- **Total Tests:** ${analysis.metrics.totalTests}
- **Passed:** ${analysis.metrics.passedTests}
- **Failed:** ${analysis.metrics.failedTests}
- **Critical Issues:** ${analysis.criticalIssues.length}
- **Regressions:** ${analysis.regressions.length}

### 📈 Performance Metrics
- **Average Response Time:** ${analysis.metrics.averageResponseTime.toFixed(2)}ms
- **Average Throughput:** ${analysis.metrics.averageThroughput.toFixed(2)} req/s
- **Error Rate:** ${(analysis.metrics.errorRate * 100).toFixed(2)}%

${analysis.criticalIssues.length > 0 ? `
### ❌ Critical Issues
${analysis.criticalIssues.map(issue => `- **${issue.type}:** ${issue.count || 1} issue(s)`).join('\n')}
` : ''}

${analysis.regressions.length > 0 ? `
### 📉 Performance Regressions
${analysis.regressions.map(reg => `- **${reg.endpoint}:** ${reg.regressions.length} regression(s)`).join('\n')}
` : ''}

### 💡 Recommendations
${analysis.recommendations.map(rec => `- ${rec}`).join('\n')}
`;
  }

  async sendNotifications(analysis) {
    if (!config.cicd.slackWebhook && !config.cicd.emailNotifications) {
      return;
    }

    const notification = {
      status: analysis.overall,
      criticalIssues: analysis.criticalIssues.length,
      regressions: analysis.regressions.length,
      branch: process.env.CI_COMMIT_REF_NAME || process.env.GITHUB_REF_NAME || 'unknown',
      commit: process.env.CI_COMMIT_SHA || process.env.GITHUB_SHA || 'unknown'
    };

    // Slack notification
    if (config.cicd.slackWebhook) {
      try {
        await this.sendSlackNotification(notification);
      } catch (error) {
        console.warn('Failed to send Slack notification:', error.message);
      }
    }

    // Email notification (placeholder - would need actual email service)
    if (config.cicd.emailNotifications) {
      console.log('📧 Email notifications configured but not implemented');
    }
  }

  async sendSlackNotification(notification) {
    const color = notification.status === 'PASSED' ? 'good' : 
                  notification.status === 'WARNING' ? 'warning' : 'danger';
    
    const message = {
      attachments: [{
        color,
        title: `Performance Test Results - ${notification.status}`,
        fields: [
          {
            title: 'Branch',
            value: notification.branch,
            short: true
          },
          {
            title: 'Commit',
            value: notification.commit.substring(0, 8),
            short: true
          },
          {
            title: 'Critical Issues',
            value: notification.criticalIssues.toString(),
            short: true
          },
          {
            title: 'Regressions',
            value: notification.regressions.toString(),
            short: true
          }
        ],
        footer: 'Performance Testing CI/CD',
        ts: Math.floor(Date.now() / 1000)
      }]
    };

    const response = await fetch(config.cicd.slackWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      throw new Error(`Slack notification failed: ${response.status}`);
    }

    console.log('📱 Slack notification sent successfully');
  }

  setExitCode(analysis) {
    if (config.cicd.failOnRegression && analysis.regressions.length > 0) {
      this.exitCode = 1;
      console.log('❌ Failing due to performance regressions');
    } else if (config.cicd.failOnHighErrorRate && analysis.metrics.errorRate > 0.05) {
      this.exitCode = 1;
      console.log('❌ Failing due to high error rate');
    } else if (config.cicd.failOnSlowResponse && analysis.metrics.averageResponseTime > 1000) {
      this.exitCode = 1;
      console.log('❌ Failing due to slow response times');
    } else if (analysis.criticalIssues.length > 0) {
      this.exitCode = 1;
      console.log('❌ Failing due to critical performance issues');
    } else {
      this.exitCode = 0;
      console.log('✅ All performance checks passed');
    }
  }

  async handleTestFailure(error) {
    const errorReport = {
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        stack: error.stack
      },
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        cicd: {
          branch: process.env.CI_COMMIT_REF_NAME || process.env.GITHUB_REF_NAME,
          commit: process.env.CI_COMMIT_SHA || process.env.GITHUB_SHA,
          buildNumber: process.env.CI_PIPELINE_ID || process.env.GITHUB_RUN_NUMBER
        }
      }
    };

    const reportsDir = path.join(__dirname, 'results', 'cicd');
    try {
      await fs.mkdir(reportsDir, { recursive: true });
      const errorPath = path.join(reportsDir, `error-${Date.now()}.json`);
      await fs.writeFile(errorPath, JSON.stringify(errorReport, null, 2));
      console.log(`💥 Error report saved to: ${errorPath}`);
    } catch (saveError) {
      console.error('Failed to save error report:', saveError);
    }
  }
}

// CLI interface
if (require.main === module) {
  const cicdIntegration = new CICDPerformanceIntegration();
  cicdIntegration.runCICDPerformanceTests();
}

module.exports = CICDPerformanceIntegration;