#!/usr/bin/env node

const config = require('./performanceTestConfig');
const PerformanceUtils = require('./utils/performanceUtils');
const LoadTester = require('./loadTest');
const fs = require('fs').promises;
const path = require('path');

class RegressionTester {
  constructor() {
    this.baseUrl = `${config.server.protocol}://${config.server.host}:${config.server.port}`;
    this.results = [];
    this.regressions = [];
  }

  async runRegressionTests() {
    console.log('🔄 Starting Performance Regression Testing');
    console.log(`Base URL: ${this.baseUrl}`);
    console.log(`Baseline File: ${config.regression.baselineFile}`);
    console.log(`Tolerance: ${config.regression.tolerancePercent}%`);
    console.log('=============================================\n');

    // Load existing baseline
    const baseline = await PerformanceUtils.loadBaseline(config.regression.baselineFile);
    
    if (!baseline) {
      console.log('📝 No baseline found. Creating new baseline...');
      await this.createBaseline();
      return;
    }

    console.log(`📊 Loaded baseline from ${new Date(baseline.timestamp).toLocaleString()}`);
    
    // Run current performance tests
    console.log('🏃 Running current performance tests...');
    const currentResults = await this.runCurrentTests();
    
    // Compare with baseline
    console.log('🔍 Comparing with baseline...');
    await this.compareWithBaseline(currentResults, baseline);
    
    // Update history
    await this.updateHistory(currentResults);
    
    // Generate regression report
    await this.generateRegressionReport(currentResults, baseline);
  }

  async createBaseline() {
    console.log('Creating performance baseline...');
    
    const loadTester = new LoadTester();
    await loadTester.runLoadTests();
    
    const baselineData = {
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      },
      results: loadTester.results
    };

    await PerformanceUtils.saveBaseline(baselineData, config.regression.baselineFile);
    console.log('✅ Baseline created successfully');
  }

  async runCurrentTests() {
    const results = [];
    
    // Test critical endpoints with regression-focused configuration
    const criticalEndpoints = config.endpoints.filter(ep => ep.priority === 'high');
    
    for (const endpoint of criticalEndpoints) {
      console.log(`Testing ${endpoint.name} for regression...`);
      
      const url = `${this.baseUrl}${endpoint.path}`;
      const testOptions = {
        connections: 5, // Lighter load for regression testing
        duration: 15,   // Shorter duration
        pipelining: 1,
        timeout: 10000,
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
          continue;
        }
      }

      try {
        const result = await PerformanceUtils.runLoadTest(url, testOptions);
        result.endpointName = endpoint.name;
        result.priority = endpoint.priority;
        results.push(result);
        
        console.log(`  ✅ ${endpoint.name}: ${result.results.latency.p95.toFixed(2)}ms P95`);
        
      } catch (error) {
        console.error(`  ❌ ${endpoint.name}: ${error.message}`);
        results.push({
          endpointName: endpoint.name,
          url,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }

      // Brief pause between tests
      await this.sleep(1000);
    }

    return {
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      },
      results
    };
  }

  async compareWithBaseline(current, baseline) {
    console.log('\n🔍 Regression Analysis Results:');
    console.log('================================');

    for (const currentResult of current.results) {
      if (currentResult.error) continue;

      // Find corresponding baseline result
      const baselineResult = baseline.results.find(r => 
        r.endpointName === currentResult.endpointName || 
        r.url === currentResult.url
      );

      if (!baselineResult || baselineResult.error) {
        console.log(`⚪ ${currentResult.endpointName}: No baseline data available`);
        continue;
      }

      const comparison = PerformanceUtils.compareWithBaseline(
        currentResult, 
        baselineResult, 
        config.regression.tolerancePercent
      );

      if (comparison.hasRegression) {
        console.log(`🔴 ${currentResult.endpointName}: REGRESSION DETECTED`);
        comparison.regressions.forEach(regression => {
          console.log(`   ${regression.metric}: ${regression.current} vs ${regression.baseline} (${regression.regression} worse)`);
        });
        
        this.regressions.push({
          endpoint: currentResult.endpointName,
          ...comparison
        });
      } else {
        console.log(`🟢 ${currentResult.endpointName}: No regression`);
      }

      // Store detailed comparison
      this.results.push({
        endpoint: currentResult.endpointName,
        current: currentResult,
        baseline: baselineResult,
        comparison
      });
    }
  }

  async updateHistory(currentResults) {
    try {
      let history = [];
      
      // Load existing history
      try {
        const historyData = await fs.readFile(config.regression.historyFile, 'utf8');
        history = JSON.parse(historyData);
      } catch (error) {
        // History file doesn't exist yet
      }

      // Add current results to history
      const historyEntry = {
        timestamp: currentResults.timestamp,
        version: currentResults.version,
        summary: {
          totalEndpoints: currentResults.results.length,
          averageP95: this.calculateAverageP95(currentResults.results),
          averageThroughput: this.calculateAverageThroughput(currentResults.results),
          regressionCount: this.regressions.length
        }
      };

      history.push(historyEntry);

      // Keep only last 50 entries
      if (history.length > 50) {
        history = history.slice(-50);
      }

      // Save updated history
      const historyDir = path.dirname(config.regression.historyFile);
      await fs.mkdir(historyDir, { recursive: true });
      await fs.writeFile(config.regression.historyFile, JSON.stringify(history, null, 2));
      
      console.log(`📈 Performance history updated (${history.length} entries)`);
      
    } catch (error) {
      console.warn('Failed to update performance history:', error.message);
    }
  }

  calculateAverageP95(results) {
    const validResults = results.filter(r => !r.error && r.results);
    if (validResults.length === 0) return 0;
    
    const totalP95 = validResults.reduce((sum, r) => sum + r.results.latency.p95, 0);
    return totalP95 / validResults.length;
  }

  calculateAverageThroughput(results) {
    const validResults = results.filter(r => !r.error && r.results);
    if (validResults.length === 0) return 0;
    
    const totalThroughput = validResults.reduce((sum, r) => sum + r.results.throughput.mean, 0);
    return totalThroughput / validResults.length;
  }

  async generateRegressionReport(current, baseline) {
    const report = {
      testType: 'Performance Regression Test',
      timestamp: new Date().toISOString(),
      baseline: {
        timestamp: baseline.timestamp,
        version: baseline.version
      },
      current: {
        timestamp: current.timestamp,
        version: current.version
      },
      configuration: {
        tolerancePercent: config.regression.tolerancePercent
      },
      summary: {
        totalEndpoints: this.results.length,
        regressionsDetected: this.regressions.length,
        regressionRate: (this.regressions.length / this.results.length) * 100,
        status: this.regressions.length === 0 ? 'PASSED' : 'FAILED'
      },
      regressions: this.regressions,
      detailedResults: this.results
    };

    // Save detailed report
    const filename = `regression-test-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    await PerformanceUtils.saveResults(report, filename);

    // Print final summary
    console.log('\n🔄 Performance Regression Testing Complete');
    console.log('==========================================');
    console.log(`Baseline: ${new Date(baseline.timestamp).toLocaleString()} (v${baseline.version})`);
    console.log(`Current:  ${new Date(current.timestamp).toLocaleString()} (v${current.version})`);
    console.log(`Tolerance: ${config.regression.tolerancePercent}%`);
    console.log(`Total Endpoints: ${report.summary.totalEndpoints}`);
    console.log(`Regressions: ${report.summary.regressionsDetected}`);
    console.log(`Status: ${report.summary.status}`);

    if (this.regressions.length > 0) {
      console.log('\n🔴 Regressions Detected:');
      this.regressions.forEach(regression => {
        console.log(`   ${regression.endpoint}:`);
        regression.regressions.forEach(r => {
          console.log(`     • ${r.metric}: ${r.regression} worse`);
        });
      });
      
      console.log('\n💡 Recommendations:');
      console.log('   • Review recent code changes that might impact performance');
      console.log('   • Check database query performance and indexing');
      console.log('   • Monitor system resources during peak load');
      console.log('   • Consider rolling back recent changes if regression is severe');
    }

    console.log(`\nDetailed report saved to: v1/test/performance/results/${filename}`);

    // Update baseline if no regressions (optional)
    if (this.regressions.length === 0 && process.env.UPDATE_BASELINE === 'true') {
      console.log('\n📝 Updating baseline with current results...');
      await PerformanceUtils.saveBaseline(current, config.regression.baselineFile);
      console.log('✅ Baseline updated');
    }

    // Exit with error code if regressions detected
    if (this.regressions.length > 0) {
      process.exit(1);
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run regression tests if this file is executed directly
if (require.main === module) {
  const regressionTester = new RegressionTester();
  
  regressionTester.runRegressionTests()
    .then(() => {
      console.log('Performance regression testing completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Performance regression testing failed:', error);
      process.exit(1);
    });
}

module.exports = RegressionTester;