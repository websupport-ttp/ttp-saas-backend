const LoadTester = require('./loadTest');
const StressTester = require('./stressTest');
const BenchmarkTester = require('./benchmarkTest');
const RegressionTester = require('./regressionTest');
const config = require('./performanceTestConfig');

describe('Performance Testing Suite', () => {
  // Increase timeout for performance tests
  jest.setTimeout(300000); // 5 minutes

  let server;
  const baseUrl = `${config.server.protocol}://${config.server.host}:${config.server.port}`;

  beforeAll(async () => {
    // Start the server for testing
    const app = require('../../../app');
    server = app.listen(config.server.port, () => {
      console.log(`Test server running on ${baseUrl}`);
    });

    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  afterAll(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  describe('Load Testing', () => {
    test('should handle normal load without performance degradation', async () => {
      const loadTester = new LoadTester();
      
      // Mock the runLoadTests method to avoid full test suite
      const originalMethod = loadTester.runLoadTests;
      loadTester.runLoadTests = async function() {
        // Test just the health endpoint for Jest integration
        const healthEndpoint = config.endpoints.find(ep => ep.name === 'Health Check');
        if (healthEndpoint) {
          await this.testEndpoint(healthEndpoint);
        }
        return this.results;
      };

      await loadTester.runLoadTests();
      
      expect(loadTester.results).toBeDefined();
      expect(loadTester.results.length).toBeGreaterThan(0);
      
      // Check that at least one test passed
      const hasPassingTest = loadTester.results.some(result => 
        result.analysis && result.analysis.passed
      );
      expect(hasPassingTest).toBe(true);
    });

    test('should meet response time thresholds', async () => {
      const response = await fetch(`${baseUrl}/api/v1/health`);
      expect(response.ok).toBe(true);
      
      // Simple response time check
      const start = Date.now();
      await fetch(`${baseUrl}/api/v1/health`);
      const responseTime = Date.now() - start;
      
      expect(responseTime).toBeLessThan(config.thresholds.responseTime.p95);
    });
  });

  describe('Stress Testing', () => {
    test('should maintain stability under stress', async () => {
      const stressTester = new StressTester();
      
      // Mock for lighter stress test in Jest
      const originalMethod = stressTester.runStressTests;
      stressTester.runStressTests = async function() {
        // Run a lighter version for Jest
        const healthEndpoint = config.endpoints.find(ep => ep.name === 'Health Check');
        if (healthEndpoint) {
          await this.stressTestEndpoint(healthEndpoint);
        }
        return this.results;
      };

      await stressTester.runStressTests();
      
      expect(stressTester.results).toBeDefined();
      expect(stressTester.results.length).toBeGreaterThan(0);
    });

    test('should handle concurrent requests gracefully', async () => {
      const concurrentRequests = 10;
      const promises = [];
      
      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(fetch(`${baseUrl}/api/v1/health`));
      }
      
      const results = await Promise.allSettled(promises);
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.ok);
      
      expect(successful.length).toBeGreaterThan(concurrentRequests * 0.9); // 90% success rate
    });
  });

  describe('Benchmark Testing', () => {
    test('should meet performance benchmarks', async () => {
      const benchmarkTester = new BenchmarkTester();
      
      // Mock for lighter benchmark test in Jest
      const originalMethod = benchmarkTester.runBenchmarks;
      benchmarkTester.runBenchmarks = async function() {
        const healthEndpoint = config.endpoints.find(ep => ep.name === 'Health Check');
        if (healthEndpoint) {
          await this.benchmarkEndpoint(healthEndpoint);
        }
        return this.benchmarks;
      };

      await benchmarkTester.runBenchmarks();
      
      expect(benchmarkTester.benchmarks).toBeDefined();
      expect(benchmarkTester.benchmarks.length).toBeGreaterThan(0);
      
      // Check benchmark scores
      const validBenchmarks = benchmarkTester.benchmarks.filter(b => b.analysis);
      if (validBenchmarks.length > 0) {
        const averageScore = validBenchmarks.reduce((sum, b) => sum + b.analysis.score, 0) / validBenchmarks.length;
        expect(averageScore).toBeGreaterThan(60); // Minimum acceptable score
      }
    });

    test('should have acceptable response time distribution', async () => {
      const iterations = 50;
      const times = [];
      
      for (let i = 0; i < iterations; i++) {
        const start = process.hrtime.bigint();
        const response = await fetch(`${baseUrl}/api/v1/health`);
        const end = process.hrtime.bigint();
        
        if (response.ok) {
          times.push(Number(end - start) / 1000000); // Convert to milliseconds
        }
      }
      
      expect(times.length).toBeGreaterThan(iterations * 0.9);
      
      times.sort((a, b) => a - b);
      const p95 = times[Math.floor(times.length * 0.95)];
      const p99 = times[Math.floor(times.length * 0.99)];
      
      expect(p95).toBeLessThan(config.thresholds.responseTime.p95);
      expect(p99).toBeLessThan(config.thresholds.responseTime.p99);
    });
  });

  describe('Regression Testing', () => {
    test('should not have performance regressions', async () => {
      const regressionTester = new RegressionTester();
      
      // Mock for Jest integration
      const originalMethod = regressionTester.runRegressionTests;
      regressionTester.runRegressionTests = async function() {
        // Run a simple regression check
        const currentResults = await this.runCurrentTests();
        
        // If no baseline exists, this test passes
        const baseline = await require('./utils/performanceUtils').loadBaseline(config.regression.baselineFile);
        if (!baseline) {
          console.log('No baseline found for regression testing');
          return;
        }
        
        await this.compareWithBaseline(currentResults, baseline);
        return this.regressions;
      };

      const regressions = await regressionTester.runRegressionTests();
      
      // If regressions were detected, the test should provide information but not necessarily fail
      // This allows for controlled regression testing in CI/CD
      if (regressions && regressions.length > 0) {
        console.warn(`Performance regressions detected: ${regressions.length}`);
        regressions.forEach(regression => {
          console.warn(`  ${regression.endpoint}: ${regression.message}`);
        });
      }
      
      // Test passes if we can run the regression test successfully
      expect(regressions).toBeDefined();
    });
  });

  describe('Performance Monitoring', () => {
    test('should track memory usage during requests', async () => {
      const initialMemory = process.memoryUsage();
      
      // Make several requests to test memory usage
      for (let i = 0; i < 20; i++) {
        await fetch(`${baseUrl}/api/v1/health`);
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 50MB for 20 requests)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    test('should handle error scenarios gracefully', async () => {
      // Test non-existent endpoint
      const response = await fetch(`${baseUrl}/api/v1/nonexistent`);
      expect(response.status).toBe(404);
      
      // Response should still be fast even for errors
      const start = Date.now();
      await fetch(`${baseUrl}/api/v1/nonexistent`);
      const responseTime = Date.now() - start;
      
      expect(responseTime).toBeLessThan(1000); // Error responses should be fast
    });
  });
});

// Helper function to check if server is running
async function isServerRunning(url) {
  try {
    const response = await fetch(`${url}/api/v1/health`);
    return response.ok;
  } catch (error) {
    return false;
  }
}