#!/usr/bin/env node

const config = require('./performanceTestConfig');
const PerformanceUtils = require('./utils/performanceUtils');

class BenchmarkTester {
  constructor() {
    this.baseUrl = `${config.server.protocol}://${config.server.host}:${config.server.port}`;
    this.benchmarks = [];
  }

  async runBenchmarks() {
    console.log('📊 Starting Performance Benchmark Suite');
    console.log(`Base URL: ${this.baseUrl}`);
    console.log(`Configuration:`, config.benchmark);
    console.log('=====================================\n');

    // Run benchmarks for all endpoints
    for (const endpoint of config.endpoints) {
      await this.benchmarkEndpoint(endpoint);
    }

    // Generate benchmark report
    await this.generateBenchmarkReport();
  }

  async benchmarkEndpoint(endpoint) {
    console.log(`Benchmarking: ${endpoint.name} (${endpoint.method} ${endpoint.path})`);
    
    const url = `${this.baseUrl}${endpoint.path}`;
    
    try {
      // Handle authentication if required
      let authToken = null;
      if (endpoint.requiresAuth) {
        try {
          const testUser = await PerformanceUtils.createTestUser();
          authToken = await PerformanceUtils.authenticateUser(this.baseUrl, testUser);
        } catch (error) {
          console.warn(`Skipping authenticated endpoint ${endpoint.name}: ${error.message}`);
          return;
        }
      }

      // Warmup phase
      console.log('  🔥 Warming up...');
      await this.warmupEndpoint(url, endpoint, authToken);

      // Benchmark phase
      console.log('  📏 Running benchmark...');
      const benchmark = await this.runEndpointBenchmark(url, endpoint, authToken);
      
      this.benchmarks.push(benchmark);
      this.printBenchmarkResults(benchmark);
      
    } catch (error) {
      console.error(`Benchmark failed for ${endpoint.name}:`, error.message);
      
      this.benchmarks.push({
        endpoint: endpoint.name,
        url,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }

    // Wait between benchmarks
    await this.sleep(1000);
  }

  async warmupEndpoint(url, endpoint, authToken) {
    const warmupOptions = {
      method: endpoint.method || 'GET',
      headers: {
        ...endpoint.headers,
        ...(authToken && { 'Authorization': `Bearer ${authToken}` })
      }
    };

    if (endpoint.body) {
      warmupOptions.body = JSON.stringify(endpoint.body);
    }

    // Run warmup requests
    const warmupPromises = [];
    for (let i = 0; i < config.benchmark.warmupRequests; i++) {
      warmupPromises.push(
        fetch(url, warmupOptions).catch(() => {}) // Ignore warmup errors
      );
    }

    await Promise.allSettled(warmupPromises);
  }

  async runEndpointBenchmark(url, endpoint, authToken) {
    const requestOptions = {
      method: endpoint.method || 'GET',
      headers: {
        ...endpoint.headers,
        ...(authToken && { 'Authorization': `Bearer ${authToken}` })
      }
    };

    if (endpoint.body) {
      requestOptions.body = JSON.stringify(endpoint.body);
    }

    // Measure response times
    const responseTimes = await PerformanceUtils.measureResponseTime(
      url, 
      config.benchmark.testRequests
    );

    // Run concurrent benchmark
    const concurrentResults = await this.runConcurrentBenchmark(url, requestOptions);

    // Calculate throughput
    const throughput = await this.measureThroughput(url, requestOptions);

    return {
      endpoint: endpoint.name,
      url,
      timestamp: new Date().toISOString(),
      responseTimes,
      concurrentPerformance: concurrentResults,
      throughput,
      analysis: this.analyzeBenchmark(responseTimes, concurrentResults, throughput, endpoint)
    };
  }

  async runConcurrentBenchmark(url, requestOptions) {
    const concurrency = config.benchmark.concurrency;
    const requestsPerWorker = Math.floor(config.benchmark.testRequests / concurrency);
    
    const workers = [];
    for (let i = 0; i < concurrency; i++) {
      workers.push(this.runConcurrentWorker(url, requestOptions, requestsPerWorker));
    }

    const results = await Promise.allSettled(workers);
    const successful = results.filter(r => r.status === 'fulfilled');
    
    if (successful.length === 0) {
      throw new Error('All concurrent workers failed');
    }

    // Aggregate results
    const allTimes = successful.flatMap(r => r.value.times);
    const totalErrors = successful.reduce((sum, r) => sum + r.value.errors, 0);
    
    allTimes.sort((a, b) => a - b);
    
    return {
      concurrency,
      totalRequests: allTimes.length + totalErrors,
      successfulRequests: allTimes.length,
      errors: totalErrors,
      responseTimes: {
        min: allTimes[0],
        max: allTimes[allTimes.length - 1],
        mean: allTimes.reduce((sum, time) => sum + time, 0) / allTimes.length,
        median: allTimes[Math.floor(allTimes.length / 2)],
        p95: allTimes[Math.floor(allTimes.length * 0.95)],
        p99: allTimes[Math.floor(allTimes.length * 0.99)]
      }
    };
  }

  async runConcurrentWorker(url, requestOptions, requestCount) {
    const times = [];
    let errors = 0;

    for (let i = 0; i < requestCount; i++) {
      const start = process.hrtime.bigint();
      
      try {
        const response = await fetch(url, requestOptions);
        const end = process.hrtime.bigint();
        
        if (response.ok) {
          times.push(Number(end - start) / 1000000); // Convert to milliseconds
        } else {
          errors++;
        }
      } catch (error) {
        errors++;
      }
    }

    return { times, errors };
  }

  async measureThroughput(url, requestOptions) {
    const duration = 10; // 10 seconds
    const startTime = Date.now();
    const endTime = startTime + (duration * 1000);
    
    let requestCount = 0;
    let errorCount = 0;
    
    const promises = [];
    
    while (Date.now() < endTime) {
      const promise = fetch(url, requestOptions)
        .then(response => {
          requestCount++;
          if (!response.ok) errorCount++;
        })
        .catch(() => {
          requestCount++;
          errorCount++;
        });
      
      promises.push(promise);
      
      // Small delay to prevent overwhelming the server
      await this.sleep(10);
    }
    
    await Promise.allSettled(promises);
    
    const actualDuration = (Date.now() - startTime) / 1000;
    
    return {
      duration: actualDuration,
      totalRequests: requestCount,
      successfulRequests: requestCount - errorCount,
      errors: errorCount,
      requestsPerSecond: requestCount / actualDuration,
      successRate: ((requestCount - errorCount) / requestCount) * 100
    };
  }

  analyzeBenchmark(responseTimes, concurrentResults, throughput, endpoint) {
    const analysis = {
      endpoint: endpoint.name,
      grade: 'A',
      score: 100,
      issues: [],
      strengths: [],
      recommendations: []
    };

    let scoreDeduction = 0;

    // Analyze response times
    if (responseTimes.p95 > config.thresholds.responseTime.p95) {
      scoreDeduction += 20;
      analysis.issues.push({
        type: 'Slow P95 Response Time',
        value: `${responseTimes.p95.toFixed(2)}ms`,
        impact: 'high'
      });
      analysis.recommendations.push('Optimize database queries and add caching');
    } else if (responseTimes.p95 < config.thresholds.responseTime.p50) {
      analysis.strengths.push('Excellent P95 response time');
    }

    if (responseTimes.p99 > config.thresholds.responseTime.p99) {
      scoreDeduction += 15;
      analysis.issues.push({
        type: 'Slow P99 Response Time',
        value: `${responseTimes.p99.toFixed(2)}ms`,
        impact: 'medium'
      });
    }

    // Analyze concurrent performance
    if (concurrentResults.errors > 0) {
      const errorRate = (concurrentResults.errors / concurrentResults.totalRequests) * 100;
      if (errorRate > 5) {
        scoreDeduction += 25;
        analysis.issues.push({
          type: 'High Error Rate Under Concurrency',
          value: `${errorRate.toFixed(2)}%`,
          impact: 'high'
        });
        analysis.recommendations.push('Implement proper connection pooling and rate limiting');
      }
    } else {
      analysis.strengths.push('No errors under concurrent load');
    }

    // Analyze throughput
    if (throughput.requestsPerSecond < config.thresholds.throughput.minimum) {
      scoreDeduction += 20;
      analysis.issues.push({
        type: 'Low Throughput',
        value: `${throughput.requestsPerSecond.toFixed(2)} req/s`,
        impact: 'high'
      });
      analysis.recommendations.push('Consider horizontal scaling or performance optimization');
    } else if (throughput.requestsPerSecond > config.thresholds.throughput.minimum * 2) {
      analysis.strengths.push('Excellent throughput performance');
    }

    // Calculate final score and grade
    analysis.score = Math.max(0, 100 - scoreDeduction);
    
    if (analysis.score >= 90) analysis.grade = 'A';
    else if (analysis.score >= 80) analysis.grade = 'B';
    else if (analysis.score >= 70) analysis.grade = 'C';
    else if (analysis.score >= 60) analysis.grade = 'D';
    else analysis.grade = 'F';

    return analysis;
  }

  printBenchmarkResults(benchmark) {
    console.log(`\n📊 Benchmark Results for ${benchmark.endpoint}:`);
    console.log(`   Grade: ${benchmark.analysis.grade} (${benchmark.analysis.score}/100)`);
    
    console.log(`   Response Times:`);
    console.log(`     Mean: ${benchmark.responseTimes.mean.toFixed(2)}ms`);
    console.log(`     Median: ${benchmark.responseTimes.median.toFixed(2)}ms`);
    console.log(`     P95: ${benchmark.responseTimes.p95.toFixed(2)}ms`);
    console.log(`     P99: ${benchmark.responseTimes.p99.toFixed(2)}ms`);
    
    console.log(`   Concurrent Performance (${benchmark.concurrentPerformance.concurrency} workers):`);
    console.log(`     Successful: ${benchmark.concurrentPerformance.successfulRequests}`);
    console.log(`     Errors: ${benchmark.concurrentPerformance.errors}`);
    console.log(`     Mean Response: ${benchmark.concurrentPerformance.responseTimes.mean.toFixed(2)}ms`);
    
    console.log(`   Throughput:`);
    console.log(`     Requests/sec: ${benchmark.throughput.requestsPerSecond.toFixed(2)}`);
    console.log(`     Success Rate: ${benchmark.throughput.successRate.toFixed(2)}%`);

    if (benchmark.analysis.strengths.length > 0) {
      console.log(`   ✅ Strengths:`);
      benchmark.analysis.strengths.forEach(strength => {
        console.log(`     • ${strength}`);
      });
    }

    if (benchmark.analysis.issues.length > 0) {
      console.log(`   ⚠️  Issues:`);
      benchmark.analysis.issues.forEach(issue => {
        console.log(`     • ${issue.type}: ${issue.value}`);
      });
    }

    if (benchmark.analysis.recommendations.length > 0) {
      console.log(`   💡 Recommendations:`);
      benchmark.analysis.recommendations.forEach(rec => {
        console.log(`     • ${rec}`);
      });
    }
    
    console.log('');
  }

  async generateBenchmarkReport() {
    const summary = {
      testType: 'Performance Benchmark',
      timestamp: new Date().toISOString(),
      configuration: config.benchmark,
      totalEndpoints: this.benchmarks.filter(b => !b.error).length,
      averageGrade: this.calculateAverageGrade(),
      averageScore: this.calculateAverageScore(),
      topPerformers: this.getTopPerformers(),
      needsImprovement: this.getNeedsImprovement(),
      benchmarks: this.benchmarks
    };

    // Save detailed results
    const filename = `benchmark-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    await PerformanceUtils.saveResults(summary, filename);

    // Print final summary
    console.log('📊 Performance Benchmarking Complete');
    console.log('====================================');
    console.log(`Total Endpoints Benchmarked: ${summary.totalEndpoints}`);
    console.log(`Average Grade: ${summary.averageGrade}`);
    console.log(`Average Score: ${summary.averageScore.toFixed(1)}/100`);
    
    if (summary.topPerformers.length > 0) {
      console.log(`\n🏆 Top Performers:`);
      summary.topPerformers.forEach(performer => {
        console.log(`   ${performer.endpoint}: ${performer.grade} (${performer.score}/100)`);
      });
    }
    
    if (summary.needsImprovement.length > 0) {
      console.log(`\n⚠️  Needs Improvement:`);
      summary.needsImprovement.forEach(endpoint => {
        console.log(`   ${endpoint.endpoint}: ${endpoint.grade} (${endpoint.score}/100)`);
      });
    }
    
    console.log(`\nResults saved to: v1/test/performance/results/${filename}`);
  }

  calculateAverageGrade() {
    const validBenchmarks = this.benchmarks.filter(b => b.analysis);
    if (validBenchmarks.length === 0) return 'N/A';
    
    const totalScore = validBenchmarks.reduce((sum, b) => sum + b.analysis.score, 0);
    const avgScore = totalScore / validBenchmarks.length;
    
    if (avgScore >= 90) return 'A';
    else if (avgScore >= 80) return 'B';
    else if (avgScore >= 70) return 'C';
    else if (avgScore >= 60) return 'D';
    else return 'F';
  }

  calculateAverageScore() {
    const validBenchmarks = this.benchmarks.filter(b => b.analysis);
    if (validBenchmarks.length === 0) return 0;
    
    return validBenchmarks.reduce((sum, b) => sum + b.analysis.score, 0) / validBenchmarks.length;
  }

  getTopPerformers() {
    return this.benchmarks
      .filter(b => b.analysis && b.analysis.score >= 90)
      .sort((a, b) => b.analysis.score - a.analysis.score)
      .slice(0, 3)
      .map(b => ({
        endpoint: b.endpoint,
        grade: b.analysis.grade,
        score: b.analysis.score
      }));
  }

  getNeedsImprovement() {
    return this.benchmarks
      .filter(b => b.analysis && b.analysis.score < 70)
      .sort((a, b) => a.analysis.score - b.analysis.score)
      .map(b => ({
        endpoint: b.endpoint,
        grade: b.analysis.grade,
        score: b.analysis.score
      }));
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run benchmarks if this file is executed directly
if (require.main === module) {
  const benchmarkTester = new BenchmarkTester();
  
  benchmarkTester.runBenchmarks()
    .then(() => {
      console.log('Performance benchmarking completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Performance benchmarking failed:', error);
      process.exit(1);
    });
}

module.exports = BenchmarkTester;