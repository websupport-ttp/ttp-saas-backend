#!/usr/bin/env node

const config = require('./performanceTestConfig');
const PerformanceUtils = require('./utils/performanceUtils');

class LoadTester {
  constructor() {
    this.baseUrl = `${config.server.protocol}://${config.server.host}:${config.server.port}`;
    this.results = [];
  }

  async runLoadTests() {
    console.log('🚀 Starting Load Testing Suite');
    console.log(`Base URL: ${this.baseUrl}`);
    console.log(`Configuration:`, config.loadTest);
    console.log('================================\n');

    // Test high-priority endpoints
    const highPriorityEndpoints = config.endpoints.filter(ep => ep.priority === 'high');
    
    for (const endpoint of highPriorityEndpoints) {
      await this.testEndpoint(endpoint);
    }

    // Generate summary report
    await this.generateReport();
  }

  async testEndpoint(endpoint) {
    console.log(`Testing: ${endpoint.name} (${endpoint.method} ${endpoint.path})`);
    
    const url = `${this.baseUrl}${endpoint.path}`;
    const testOptions = {
      ...config.loadTest,
      method: endpoint.method,
      headers: endpoint.headers || {}
    };

    // Add request body for POST requests
    if (endpoint.body) {
      testOptions.body = JSON.stringify(endpoint.body);
    }

    // Handle authentication if required
    if (endpoint.requiresAuth) {
      try {
        const testUser = await PerformanceUtils.createTestUser();
        const token = await PerformanceUtils.authenticateUser(this.baseUrl, testUser);
        testOptions.headers['Authorization'] = `Bearer ${token}`;
      } catch (error) {
        console.warn(`Skipping authenticated endpoint ${endpoint.name}: ${error.message}`);
        return;
      }
    }

    try {
      const result = await PerformanceUtils.runLoadTest(url, testOptions);
      
      // Analyze results against thresholds
      const analysis = this.analyzeResults(result, endpoint);
      result.analysis = analysis;
      
      this.results.push(result);
      
      PerformanceUtils.printSummary(result);
      this.printAnalysis(analysis);
      
    } catch (error) {
      console.error(`Load test failed for ${endpoint.name}:`, error.message);
      
      this.results.push({
        url,
        endpoint: endpoint.name,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }

    // Wait between tests to avoid overwhelming the server
    await this.sleep(2000);
  }

  analyzeResults(result, endpoint) {
    const analysis = {
      endpoint: endpoint.name,
      passed: true,
      issues: [],
      recommendations: []
    };

    // Check response time thresholds
    if (result.results.latency.p95 > config.thresholds.responseTime.p95) {
      analysis.passed = false;
      analysis.issues.push({
        type: 'High P95 Latency',
        value: `${result.results.latency.p95.toFixed(2)}ms`,
        threshold: `${config.thresholds.responseTime.p95}ms`,
        severity: 'high'
      });
      analysis.recommendations.push('Consider optimizing database queries and adding caching');
    }

    if (result.results.latency.p99 > config.thresholds.responseTime.p99) {
      analysis.passed = false;
      analysis.issues.push({
        type: 'High P99 Latency',
        value: `${result.results.latency.p99.toFixed(2)}ms`,
        threshold: `${config.thresholds.responseTime.p99}ms`,
        severity: 'medium'
      });
    }

    // Check throughput
    if (result.results.requests.mean < config.thresholds.throughput.minimum) {
      analysis.passed = false;
      analysis.issues.push({
        type: 'Low Throughput',
        value: `${result.results.requests.mean.toFixed(2)} req/s`,
        threshold: `${config.thresholds.throughput.minimum} req/s`,
        severity: 'high'
      });
      analysis.recommendations.push('Consider scaling horizontally or optimizing application performance');
    }

    // Check error rate
    const errorRate = result.results.errors / result.results.requests.total;
    if (errorRate > config.thresholds.errorRate.maximum) {
      analysis.passed = false;
      analysis.issues.push({
        type: 'High Error Rate',
        value: `${(errorRate * 100).toFixed(2)}%`,
        threshold: `${(config.thresholds.errorRate.maximum * 100).toFixed(2)}%`,
        severity: 'critical'
      });
      analysis.recommendations.push('Investigate error logs and fix underlying issues');
    }

    return analysis;
  }

  printAnalysis(analysis) {
    console.log(`Analysis for ${analysis.endpoint}:`);
    console.log(`Status: ${analysis.passed ? '✅ PASSED' : '❌ FAILED'}`);
    
    if (analysis.issues.length > 0) {
      console.log('Issues found:');
      analysis.issues.forEach(issue => {
        const severity = issue.severity === 'critical' ? '🔴' : 
                        issue.severity === 'high' ? '🟠' : '🟡';
        console.log(`  ${severity} ${issue.type}: ${issue.value} (threshold: ${issue.threshold})`);
      });
    }

    if (analysis.recommendations.length > 0) {
      console.log('Recommendations:');
      analysis.recommendations.forEach(rec => {
        console.log(`  💡 ${rec}`);
      });
    }
    
    console.log('');
  }

  async generateReport() {
    const summary = {
      testType: 'Load Test',
      timestamp: new Date().toISOString(),
      configuration: config.loadTest,
      totalEndpoints: this.results.length,
      passedEndpoints: this.results.filter(r => r.analysis?.passed).length,
      failedEndpoints: this.results.filter(r => r.analysis?.passed === false).length,
      erroredEndpoints: this.results.filter(r => r.error).length,
      results: this.results
    };

    // Save detailed results
    const filename = `load-test-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    await PerformanceUtils.saveResults(summary, filename);

    // Print final summary
    console.log('🏁 Load Testing Complete');
    console.log('========================');
    console.log(`Total Endpoints Tested: ${summary.totalEndpoints}`);
    console.log(`Passed: ${summary.passedEndpoints}`);
    console.log(`Failed: ${summary.failedEndpoints}`);
    console.log(`Errors: ${summary.erroredEndpoints}`);
    console.log(`Results saved to: v1/test/performance/results/${filename}`);
    
    if (summary.failedEndpoints > 0) {
      console.log('\n⚠️  Some endpoints failed performance thresholds. Review the detailed results.');
      process.exit(1);
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run load tests if this file is executed directly
if (require.main === module) {
  const loadTester = new LoadTester();
  
  loadTester.runLoadTests()
    .then(() => {
      console.log('Load testing completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Load testing failed:', error);
      process.exit(1);
    });
}

module.exports = LoadTester;