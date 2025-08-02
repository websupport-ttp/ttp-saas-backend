#!/usr/bin/env node

const config = require('./performanceTestConfig');
const PerformanceUtils = require('./utils/performanceUtils');

class StressTester {
  constructor() {
    this.baseUrl = `${config.server.protocol}://${config.server.host}:${config.server.port}`;
    this.results = [];
  }

  async runStressTests() {
    console.log('💪 Starting Stress Testing Suite');
    console.log(`Base URL: ${this.baseUrl}`);
    console.log(`Configuration:`, config.stressTest);
    console.log('================================\n');

    // Test all endpoints under stress
    const testEndpoints = config.endpoints.filter(ep => ep.priority !== 'low');
    
    for (const endpoint of testEndpoints) {
      await this.stressTestEndpoint(endpoint);
    }

    // Run concurrent user simulation
    await this.runConcurrentUserSimulation();

    // Generate summary report
    await this.generateReport();
  }

  async stressTestEndpoint(endpoint) {
    console.log(`Stress Testing: ${endpoint.name} (${endpoint.method} ${endpoint.path})`);
    
    const url = `${this.baseUrl}${endpoint.path}`;
    const testOptions = {
      ...config.stressTest,
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
      const result = await PerformanceUtils.runStressTest(url, testOptions);
      
      // Analyze stress test results
      const analysis = this.analyzeStressResults(result, endpoint);
      result.analysis = analysis;
      
      this.results.push(result);
      
      PerformanceUtils.printSummary(result);
      this.printStressAnalysis(analysis);
      
    } catch (error) {
      console.error(`Stress test failed for ${endpoint.name}:`, error.message);
      
      this.results.push({
        url,
        endpoint: endpoint.name,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }

    // Wait between tests to allow server recovery
    await this.sleep(5000);
  }

  async runConcurrentUserSimulation() {
    console.log('🔄 Running Concurrent User Session Simulation');
    
    const userSessions = [];
    const numberOfUsers = 20;
    
    // Create multiple user sessions
    for (let i = 0; i < numberOfUsers; i++) {
      userSessions.push(this.simulateUserSession(i + 1));
    }

    try {
      const sessionResults = await Promise.allSettled(userSessions);
      
      const successful = sessionResults.filter(r => r.status === 'fulfilled').length;
      const failed = sessionResults.filter(r => r.status === 'rejected').length;
      
      console.log(`Concurrent User Simulation Results:`);
      console.log(`  Total Users: ${numberOfUsers}`);
      console.log(`  Successful Sessions: ${successful}`);
      console.log(`  Failed Sessions: ${failed}`);
      console.log(`  Success Rate: ${((successful / numberOfUsers) * 100).toFixed(2)}%\n`);
      
      this.results.push({
        testType: 'Concurrent User Simulation',
        totalUsers: numberOfUsers,
        successful,
        failed,
        successRate: (successful / numberOfUsers) * 100,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Concurrent user simulation failed:', error);
    }
  }

  async simulateUserSession(userId) {
    const sessionStart = Date.now();
    const actions = [];
    
    try {
      // 1. Health check
      let response = await fetch(`${this.baseUrl}/api/v1/health`);
      actions.push({ action: 'health_check', status: response.status, duration: Date.now() - sessionStart });
      
      // 2. Browse packages
      response = await fetch(`${this.baseUrl}/api/v1/posts?postType=Packages`);
      actions.push({ action: 'browse_packages', status: response.status, duration: Date.now() - sessionStart });
      
      // 3. Register user
      const testUser = await PerformanceUtils.createTestUser();
      testUser.email = `stresstest${userId}_${Date.now()}@example.com`;
      
      response = await fetch(`${this.baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testUser)
      });
      actions.push({ action: 'register', status: response.status, duration: Date.now() - sessionStart });
      
      if (response.ok) {
        // 4. Login
        response = await fetch(`${this.baseUrl}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: testUser.email,
            password: testUser.password
          })
        });
        actions.push({ action: 'login', status: response.status, duration: Date.now() - sessionStart });
        
        if (response.ok) {
          const loginData = await response.json();
          const token = loginData.token;
          
          // 5. Access protected resource
          response = await fetch(`${this.baseUrl}/api/v1/analytics/summary`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          actions.push({ action: 'protected_access', status: response.status, duration: Date.now() - sessionStart });
        }
      }
      
      return {
        userId,
        totalDuration: Date.now() - sessionStart,
        actions,
        success: true
      };
      
    } catch (error) {
      return {
        userId,
        totalDuration: Date.now() - sessionStart,
        actions,
        error: error.message,
        success: false
      };
    }
  }

  analyzeStressResults(result, endpoint) {
    const analysis = {
      endpoint: endpoint.name,
      stressLevel: 'high',
      passed: true,
      issues: [],
      recommendations: [],
      resilience: 'good'
    };

    // Check if system maintained performance under stress
    if (result.results.latency.p95 > config.thresholds.responseTime.p95 * 2) {
      analysis.passed = false;
      analysis.resilience = 'poor';
      analysis.issues.push({
        type: 'Severe Performance Degradation',
        value: `${result.results.latency.p95.toFixed(2)}ms`,
        threshold: `${config.thresholds.responseTime.p95 * 2}ms`,
        severity: 'critical'
      });
      analysis.recommendations.push('System cannot handle high load - consider load balancing and horizontal scaling');
    }

    // Check error rate under stress
    const errorRate = result.results.errors / result.results.requests.total;
    if (errorRate > 0.05) { // 5% error rate threshold for stress testing
      analysis.passed = false;
      analysis.resilience = errorRate > 0.1 ? 'poor' : 'fair';
      analysis.issues.push({
        type: 'High Error Rate Under Stress',
        value: `${(errorRate * 100).toFixed(2)}%`,
        threshold: '5%',
        severity: 'high'
      });
      analysis.recommendations.push('Implement circuit breakers and graceful degradation');
    }

    // Check timeout rate
    const timeoutRate = result.results.timeouts / result.results.requests.total;
    if (timeoutRate > 0.02) { // 2% timeout rate threshold
      analysis.passed = false;
      analysis.issues.push({
        type: 'High Timeout Rate',
        value: `${(timeoutRate * 100).toFixed(2)}%`,
        threshold: '2%',
        severity: 'high'
      });
      analysis.recommendations.push('Optimize slow operations and increase timeout thresholds');
    }

    // Assess overall resilience
    if (analysis.issues.length === 0) {
      analysis.resilience = 'excellent';
    } else if (analysis.issues.filter(i => i.severity === 'critical').length > 0) {
      analysis.resilience = 'poor';
    } else if (analysis.issues.filter(i => i.severity === 'high').length > 0) {
      analysis.resilience = 'fair';
    }

    return analysis;
  }

  printStressAnalysis(analysis) {
    console.log(`Stress Analysis for ${analysis.endpoint}:`);
    console.log(`Status: ${analysis.passed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Resilience: ${this.getResilienceEmoji(analysis.resilience)} ${analysis.resilience.toUpperCase()}`);
    
    if (analysis.issues.length > 0) {
      console.log('Issues under stress:');
      analysis.issues.forEach(issue => {
        const severity = issue.severity === 'critical' ? '🔴' : 
                        issue.severity === 'high' ? '🟠' : '🟡';
        console.log(`  ${severity} ${issue.type}: ${issue.value} (threshold: ${issue.threshold})`);
      });
    }

    if (analysis.recommendations.length > 0) {
      console.log('Stress test recommendations:');
      analysis.recommendations.forEach(rec => {
        console.log(`  💡 ${rec}`);
      });
    }
    
    console.log('');
  }

  getResilienceEmoji(resilience) {
    switch (resilience) {
      case 'excellent': return '🟢';
      case 'good': return '🟡';
      case 'fair': return '🟠';
      case 'poor': return '🔴';
      default: return '⚪';
    }
  }

  async generateReport() {
    const summary = {
      testType: 'Stress Test',
      timestamp: new Date().toISOString(),
      configuration: config.stressTest,
      totalEndpoints: this.results.filter(r => r.endpoint).length,
      passedEndpoints: this.results.filter(r => r.analysis?.passed).length,
      failedEndpoints: this.results.filter(r => r.analysis?.passed === false).length,
      erroredEndpoints: this.results.filter(r => r.error).length,
      results: this.results
    };

    // Save detailed results
    const filename = `stress-test-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    await PerformanceUtils.saveResults(summary, filename);

    // Print final summary
    console.log('💪 Stress Testing Complete');
    console.log('==========================');
    console.log(`Total Endpoints Tested: ${summary.totalEndpoints}`);
    console.log(`Passed: ${summary.passedEndpoints}`);
    console.log(`Failed: ${summary.failedEndpoints}`);
    console.log(`Errors: ${summary.erroredEndpoints}`);
    console.log(`Results saved to: v1/test/performance/results/${filename}`);
    
    if (summary.failedEndpoints > 0) {
      console.log('\n⚠️  Some endpoints failed under stress. Review the detailed results.');
      process.exit(1);
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run stress tests if this file is executed directly
if (require.main === module) {
  const stressTester = new StressTester();
  
  stressTester.runStressTests()
    .then(() => {
      console.log('Stress testing completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Stress testing failed:', error);
      process.exit(1);
    });
}

module.exports = StressTester;