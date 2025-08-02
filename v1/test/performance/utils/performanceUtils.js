const fs = require('fs').promises;
const path = require('path');
const autocannon = require('autocannon');
const SystemMonitor = require('./systemMonitor');
const ReportGenerator = require('./reportGenerator');

class PerformanceUtils {
  static async createTestUser() {
    const timestamp = Date.now();
    return {
      firstName: 'PerfTest',
      lastName: 'User',
      email: `perftest${timestamp}@example.com`,
      password: 'TestPassword123!',
      phoneNumber: `+123456${timestamp.toString().slice(-4)}`
    };
  }

  static async authenticateUser(baseUrl, userCredentials) {
    const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: userCredentials.email,
        password: userCredentials.password
      })
    });

    if (!response.ok) {
      throw new Error(`Authentication failed: ${response.status}`);
    }

    const data = await response.json();
    return data.token;
  }

  static async runLoadTest(url, options = {}) {
    const defaultOptions = {
      connections: 10,
      duration: 30,
      pipelining: 1,
      timeout: 10000
    };

    const testOptions = { ...defaultOptions, ...options, url };
    
    console.log(`Starting load test for ${url}...`);
    console.log(`Configuration:`, testOptions);

    // Start system monitoring
    const monitor = new SystemMonitor();
    monitor.startMonitoring(500); // Monitor every 500ms

    const result = await autocannon(testOptions);
    
    // Stop system monitoring and get report
    const systemReport = monitor.stopMonitoring();
    
    return {
      url,
      timestamp: new Date().toISOString(),
      configuration: testOptions,
      results: {
        requests: {
          total: result.requests.total,
          average: result.requests.average,
          mean: result.requests.mean,
          stddev: result.requests.stddev,
          min: result.requests.min,
          max: result.requests.max
        },
        latency: {
          average: result.latency.average,
          mean: result.latency.mean,
          stddev: result.latency.stddev,
          min: result.latency.min,
          max: result.latency.max,
          p50: result.latency.p50,
          p90: result.latency.p90,
          p95: result.latency.p95,
          p99: result.latency.p99
        },
        throughput: {
          average: result.throughput.average,
          mean: result.throughput.mean,
          stddev: result.throughput.stddev,
          min: result.throughput.min,
          max: result.throughput.max
        },
        errors: result.errors,
        timeouts: result.timeouts,
        duration: result.duration,
        start: result.start,
        finish: result.finish
      }
    };
  }

  static async runStressTest(url, options = {}) {
    const defaultOptions = {
      connections: 50,
      duration: 60,
      pipelining: 2,
      timeout: 15000
    };

    const testOptions = { ...defaultOptions, ...options, url };
    
    console.log(`Starting stress test for ${url}...`);
    console.log(`Configuration:`, testOptions);

    // Start system monitoring
    const monitor = new SystemMonitor();
    monitor.startMonitoring(500); // Monitor every 500ms

    const result = await autocannon(testOptions);
    
    // Stop system monitoring and get report
    const systemReport = monitor.stopMonitoring();
    
    return {
      url,
      timestamp: new Date().toISOString(),
      configuration: testOptions,
      results: {
        requests: {
          total: result.requests.total,
          average: result.requests.average,
          mean: result.requests.mean,
          stddev: result.requests.stddev,
          min: result.requests.min,
          max: result.requests.max
        },
        latency: {
          average: result.latency.average,
          mean: result.latency.mean,
          stddev: result.latency.stddev,
          min: result.latency.min,
          max: result.latency.max,
          p50: result.latency.p50,
          p90: result.latency.p90,
          p95: result.latency.p95,
          p99: result.latency.p99
        },
        throughput: {
          average: result.throughput.average,
          mean: result.throughput.mean,
          stddev: result.throughput.stddev,
          min: result.throughput.min,
          max: result.throughput.max
        },
        errors: result.errors,
        timeouts: result.timeouts,
        duration: result.duration,
        start: result.start,
        finish: result.finish
      },
      systemMetrics: systemReport
    };
  }

  static async measureResponseTime(url, iterations = 100) {
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = process.hrtime.bigint();
      
      try {
        const response = await fetch(url);
        const end = process.hrtime.bigint();
        
        if (response.ok) {
          times.push(Number(end - start) / 1000000); // Convert to milliseconds
        }
      } catch (error) {
        console.warn(`Request ${i + 1} failed:`, error.message);
      }
    }

    if (times.length === 0) {
      throw new Error('All requests failed');
    }

    times.sort((a, b) => a - b);
    
    return {
      count: times.length,
      min: times[0],
      max: times[times.length - 1],
      mean: times.reduce((sum, time) => sum + time, 0) / times.length,
      median: times[Math.floor(times.length / 2)],
      p95: times[Math.floor(times.length * 0.95)],
      p99: times[Math.floor(times.length * 0.99)]
    };
  }

  static async saveResults(results, filename) {
    const resultsDir = path.join(__dirname, '..', 'results');
    
    try {
      await fs.mkdir(resultsDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    const filepath = path.join(resultsDir, filename);
    await fs.writeFile(filepath, JSON.stringify(results, null, 2));
    
    console.log(`Results saved to: ${filepath}`);
    return filepath;
  }

  static async loadBaseline(baselineFile) {
    try {
      const data = await fs.readFile(baselineFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.warn(`Could not load baseline file ${baselineFile}:`, error.message);
      return null;
    }
  }

  static async saveBaseline(results, baselineFile) {
    const baselineDir = path.dirname(baselineFile);
    
    try {
      await fs.mkdir(baselineDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    await fs.writeFile(baselineFile, JSON.stringify(results, null, 2));
    console.log(`Baseline saved to: ${baselineFile}`);
  }

  static compareWithBaseline(current, baseline, tolerancePercent = 10) {
    if (!baseline) {
      return {
        hasRegression: false,
        message: 'No baseline available for comparison'
      };
    }

    const regressions = [];
    
    // Compare response times
    if (current.results.latency.p95 > baseline.results.latency.p95 * (1 + tolerancePercent / 100)) {
      regressions.push({
        metric: 'P95 Latency',
        current: current.results.latency.p95,
        baseline: baseline.results.latency.p95,
        regression: ((current.results.latency.p95 / baseline.results.latency.p95 - 1) * 100).toFixed(2) + '%'
      });
    }

    // Compare throughput
    if (current.results.throughput.mean < baseline.results.throughput.mean * (1 - tolerancePercent / 100)) {
      regressions.push({
        metric: 'Mean Throughput',
        current: current.results.throughput.mean,
        baseline: baseline.results.throughput.mean,
        regression: ((1 - current.results.throughput.mean / baseline.results.throughput.mean) * 100).toFixed(2) + '%'
      });
    }

    // Compare error rates
    const currentErrorRate = current.results.errors / current.results.requests.total;
    const baselineErrorRate = baseline.results.errors / baseline.results.requests.total;
    
    if (currentErrorRate > baselineErrorRate * (1 + tolerancePercent / 100)) {
      regressions.push({
        metric: 'Error Rate',
        current: (currentErrorRate * 100).toFixed(2) + '%',
        baseline: (baselineErrorRate * 100).toFixed(2) + '%',
        regression: 'Increased'
      });
    }

    return {
      hasRegression: regressions.length > 0,
      regressions,
      message: regressions.length > 0 
        ? `Performance regression detected in ${regressions.length} metric(s)`
        : 'No performance regression detected'
    };
  }

  static generateReport(results, comparison = null) {
    const report = {
      summary: {
        timestamp: new Date().toISOString(),
        url: results.url,
        duration: results.results.duration,
        totalRequests: results.results.requests.total,
        requestsPerSecond: results.results.requests.mean,
        averageLatency: results.results.latency.mean,
        p95Latency: results.results.latency.p95,
        p99Latency: results.results.latency.p99,
        errors: results.results.errors,
        timeouts: results.results.timeouts
      },
      detailed: results,
      comparison
    };

    return report;
  }

  static printSummary(results) {
    console.log('\n=== Performance Test Summary ===');
    console.log(`URL: ${results.url}`);
    console.log(`Duration: ${results.results.duration}s`);
    console.log(`Total Requests: ${results.results.requests.total}`);
    console.log(`Requests/sec: ${results.results.requests.mean.toFixed(2)}`);
    console.log(`Average Latency: ${results.results.latency.mean.toFixed(2)}ms`);
    console.log(`P95 Latency: ${results.results.latency.p95.toFixed(2)}ms`);
    console.log(`P99 Latency: ${results.results.latency.p99.toFixed(2)}ms`);
    console.log(`Errors: ${results.results.errors}`);
    console.log(`Timeouts: ${results.results.timeouts}`);
    
    // Print system metrics summary if available
    if (results.systemMetrics && results.systemMetrics.summary) {
      console.log('\n--- System Metrics ---');
      const metrics = results.systemMetrics.summary;
      console.log(`Memory Usage: ${(metrics.memory.heapUsed.avg / 1024 / 1024).toFixed(2)}MB avg`);
      console.log(`CPU Load: ${metrics.cpu.loadAverage.avg.toFixed(2)} avg`);
      console.log(`Event Loop Lag: ${metrics.eventLoop.lag.avg.toFixed(2)}ms avg`);
    }
    
    console.log('================================\n');
  }

  static async generateMultiFormatReports(data, basePath) {
    const reportGenerator = new ReportGenerator();
    const reports = {};

    try {
      // Generate JSON report
      const jsonPath = `${basePath}.json`;
      reports.json = await reportGenerator.generateReport(data, 'json', jsonPath);

      // Generate HTML report
      const htmlPath = `${basePath}.html`;
      reports.html = await reportGenerator.generateReport(data, 'html', htmlPath);

      // Generate Markdown report
      const mdPath = `${basePath}.md`;
      reports.markdown = await reportGenerator.generateReport(data, 'markdown', mdPath);

      // Generate CSV report
      const csvPath = `${basePath}.csv`;
      reports.csv = await reportGenerator.generateReport(data, 'csv', csvPath);

      // Generate JUnit report for CI/CD
      const junitPath = `${basePath}-junit.xml`;
      reports.junit = await reportGenerator.generateReport(data, 'junit', junitPath);

      console.log(`📄 Multi-format reports generated:`);
      console.log(`  JSON: ${jsonPath}`);
      console.log(`  HTML: ${htmlPath}`);
      console.log(`  Markdown: ${mdPath}`);
      console.log(`  CSV: ${csvPath}`);
      console.log(`  JUnit: ${junitPath}`);

      return reports;
    } catch (error) {
      console.error('Failed to generate multi-format reports:', error);
      return null;
    }
  }

  static calculatePerformanceScore(results) {
    let score = 100;
    const thresholds = {
      responseTime: { p95: 500, p99: 1000 },
      throughput: { minimum: 100 },
      errorRate: { maximum: 0.01 }
    };

    // Deduct points for slow response times
    if (results.results.latency.p95 > thresholds.responseTime.p95) {
      score -= 20;
    }
    if (results.results.latency.p99 > thresholds.responseTime.p99) {
      score -= 15;
    }

    // Deduct points for low throughput
    if (results.results.requests.mean < thresholds.throughput.minimum) {
      score -= 25;
    }

    // Deduct points for high error rate
    const errorRate = results.results.errors / results.results.requests.total;
    if (errorRate > thresholds.errorRate.maximum) {
      score -= 30;
    }

    // Deduct points for system resource issues
    if (results.systemMetrics && results.systemMetrics.analysis) {
      const issues = results.systemMetrics.analysis.issues;
      score -= issues.length * 10;
    }

    return Math.max(0, score);
  }
}

module.exports = PerformanceUtils;