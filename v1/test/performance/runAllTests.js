#!/usr/bin/env node

const LoadTester = require('./loadTest');
const StressTester = require('./stressTest');
const BenchmarkTester = require('./benchmarkTest');
const RegressionTester = require('./regressionTest');
const config = require('./performanceTestConfig');
const path = require('path');
const fs = require('fs').promises;

class PerformanceTestRunner {
  constructor() {
    this.results = {
      loadTest: null,
      stressTest: null,
      benchmark: null,
      regression: null
    };
    this.startTime = Date.now();
  }

  async runAllTests(options = {}) {
    console.log('🚀 Starting Complete Performance Testing Suite');
    console.log('==============================================');
    console.log(`Start Time: ${new Date().toLocaleString()}`);
    console.log(`Configuration: ${JSON.stringify(config.server, null, 2)}`);
    console.log('');

    const {
      skipLoad = false,
      skipStress = false,
      skipBenchmark = false,
      skipRegression = false,
      createBaseline = false
    } = options;

    try {
      // 1. Load Testing
      if (!skipLoad) {
        console.log('📊 Phase 1: Load Testing');
        console.log('========================');
        const loadTester = new LoadTester();
        await loadTester.runLoadTests();
        this.results.loadTest = {
          status: 'completed',
          results: loadTester.results,
          timestamp: new Date().toISOString()
        };
        console.log('✅ Load testing completed\n');
      }

      // 2. Stress Testing
      if (!skipStress) {
        console.log('💪 Phase 2: Stress Testing');
        console.log('==========================');
        const stressTester = new StressTester();
        await stressTester.runStressTests();
        this.results.stressTest = {
          status: 'completed',
          results: stressTester.results,
          timestamp: new Date().toISOString()
        };
        console.log('✅ Stress testing completed\n');
      }

      // 3. Benchmark Testing
      if (!skipBenchmark) {
        console.log('📈 Phase 3: Benchmark Testing');
        console.log('=============================');
        const benchmarkTester = new BenchmarkTester();
        await benchmarkTester.runBenchmarks();
        this.results.benchmark = {
          status: 'completed',
          results: benchmarkTester.benchmarks,
          timestamp: new Date().toISOString()
        };
        console.log('✅ Benchmark testing completed\n');
      }

      // 4. Regression Testing
      if (!skipRegression) {
        console.log('🔄 Phase 4: Regression Testing');
        console.log('==============================');
        const regressionTester = new RegressionTester();
        
        if (createBaseline) {
          await regressionTester.createBaseline();
        } else {
          await regressionTester.runRegressionTests();
        }
        
        this.results.regression = {
          status: 'completed',
          results: regressionTester.results,
          regressions: regressionTester.regressions,
          timestamp: new Date().toISOString()
        };
        console.log('✅ Regression testing completed\n');
      }

      // Generate comprehensive report
      await this.generateComprehensiveReport();

    } catch (error) {
      console.error('❌ Performance testing suite failed:', error);
      await this.generateErrorReport(error);
      process.exit(1);
    }
  }

  async generateComprehensiveReport() {
    const endTime = Date.now();
    const duration = endTime - this.startTime;

    const report = {
      testSuite: 'Complete Performance Testing Suite',
      timestamp: new Date().toISOString(),
      duration: {
        milliseconds: duration,
        seconds: Math.round(duration / 1000),
        minutes: Math.round(duration / 60000)
      },
      configuration: config,
      results: this.results,
      summary: this.generateSummary(),
      recommendations: this.generateRecommendations()
    };

    // Save comprehensive report
    const filename = `complete-performance-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const resultsDir = path.join(__dirname, 'results');
    
    try {
      await fs.mkdir(resultsDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    const filepath = path.join(resultsDir, filename);
    await fs.writeFile(filepath, JSON.stringify(report, null, 2));

    // Print comprehensive summary
    this.printComprehensiveSummary(report);
    
    console.log(`\n📄 Comprehensive report saved to: ${filepath}`);
  }

  generateSummary() {
    const summary = {
      totalPhases: 0,
      completedPhases: 0,
      failedPhases: 0,
      overallStatus: 'PASSED',
      criticalIssues: 0,
      warnings: 0,
      performance: {
        averageResponseTime: 0,
        averageThroughput: 0,
        errorRate: 0
      }
    };

    // Analyze each phase
    Object.entries(this.results).forEach(([phase, result]) => {
      if (result) {
        summary.totalPhases++;
        if (result.status === 'completed') {
          summary.completedPhases++;
        } else {
          summary.failedPhases++;
          summary.overallStatus = 'FAILED';
        }
      }
    });

    // Analyze load test results
    if (this.results.loadTest?.results) {
      const loadResults = this.results.loadTest.results.filter(r => !r.error && r.analysis);
      const failedTests = loadResults.filter(r => !r.analysis.passed);
      
      summary.criticalIssues += failedTests.filter(r => 
        r.analysis.issues.some(i => i.severity === 'critical')
      ).length;
      
      summary.warnings += failedTests.filter(r => 
        r.analysis.issues.some(i => i.severity === 'high' || i.severity === 'medium')
      ).length;
    }

    // Analyze stress test results
    if (this.results.stressTest?.results) {
      const stressResults = this.results.stressTest.results.filter(r => !r.error && r.analysis);
      const poorResilience = stressResults.filter(r => r.analysis.resilience === 'poor');
      
      summary.criticalIssues += poorResilience.length;
    }

    // Analyze regression results
    if (this.results.regression?.regressions) {
      summary.criticalIssues += this.results.regression.regressions.length;
    }

    // Set overall status based on issues
    if (summary.criticalIssues > 0) {
      summary.overallStatus = 'FAILED';
    } else if (summary.warnings > 0) {
      summary.overallStatus = 'WARNING';
    }

    return summary;
  }

  generateRecommendations() {
    const recommendations = [];

    // Load test recommendations
    if (this.results.loadTest?.results) {
      const failedLoadTests = this.results.loadTest.results.filter(r => 
        r.analysis && !r.analysis.passed
      );
      
      if (failedLoadTests.length > 0) {
        recommendations.push({
          category: 'Load Testing',
          priority: 'high',
          issue: `${failedLoadTests.length} endpoints failed load testing`,
          recommendation: 'Optimize database queries, implement caching, and consider horizontal scaling'
        });
      }
    }

    // Stress test recommendations
    if (this.results.stressTest?.results) {
      const poorResilienceTests = this.results.stressTest.results.filter(r => 
        r.analysis && r.analysis.resilience === 'poor'
      );
      
      if (poorResilienceTests.length > 0) {
        recommendations.push({
          category: 'Stress Testing',
          priority: 'critical',
          issue: `${poorResilienceTests.length} endpoints show poor resilience under stress`,
          recommendation: 'Implement circuit breakers, graceful degradation, and load balancing'
        });
      }
    }

    // Benchmark recommendations
    if (this.results.benchmark?.results) {
      const lowScoreBenchmarks = this.results.benchmark.results.filter(b => 
        b.analysis && b.analysis.score < 70
      );
      
      if (lowScoreBenchmarks.length > 0) {
        recommendations.push({
          category: 'Performance Benchmarks',
          priority: 'medium',
          issue: `${lowScoreBenchmarks.length} endpoints scored below 70/100`,
          recommendation: 'Review and optimize slow endpoints, implement performance monitoring'
        });
      }
    }

    // Regression recommendations
    if (this.results.regression?.regressions?.length > 0) {
      recommendations.push({
        category: 'Performance Regression',
        priority: 'critical',
        issue: `${this.results.regression.regressions.length} performance regressions detected`,
        recommendation: 'Review recent code changes, rollback if necessary, implement performance CI/CD gates'
      });
    }

    // General recommendations
    recommendations.push({
      category: 'Monitoring',
      priority: 'medium',
      issue: 'Continuous performance monitoring',
      recommendation: 'Set up automated performance monitoring and alerting in production'
    });

    return recommendations;
  }

  printComprehensiveSummary(report) {
    console.log('\n🏁 Complete Performance Testing Suite Results');
    console.log('=============================================');
    console.log(`Duration: ${report.duration.minutes} minutes ${report.duration.seconds % 60} seconds`);
    console.log(`Overall Status: ${this.getStatusEmoji(report.summary.overallStatus)} ${report.summary.overallStatus}`);
    console.log(`Phases Completed: ${report.summary.completedPhases}/${report.summary.totalPhases}`);
    console.log(`Critical Issues: ${report.summary.criticalIssues}`);
    console.log(`Warnings: ${report.summary.warnings}`);

    // Phase-by-phase summary
    console.log('\n📊 Phase Summary:');
    Object.entries(this.results).forEach(([phase, result]) => {
      if (result) {
        const status = result.status === 'completed' ? '✅' : '❌';
        console.log(`  ${status} ${this.formatPhaseName(phase)}: ${result.status}`);
      }
    });

    // Recommendations
    if (report.recommendations.length > 0) {
      console.log('\n💡 Key Recommendations:');
      report.recommendations.forEach(rec => {
        const priority = rec.priority === 'critical' ? '🔴' : 
                        rec.priority === 'high' ? '🟠' : '🟡';
        console.log(`  ${priority} ${rec.category}: ${rec.recommendation}`);
      });
    }

    console.log('\n🎯 Next Steps:');
    if (report.summary.overallStatus === 'FAILED') {
      console.log('  • Address critical performance issues before production deployment');
      console.log('  • Review detailed test results and implement recommended optimizations');
      console.log('  • Re-run performance tests after fixes');
    } else if (report.summary.overallStatus === 'WARNING') {
      console.log('  • Monitor performance closely in production');
      console.log('  • Consider implementing recommended optimizations');
      console.log('  • Set up performance regression testing in CI/CD');
    } else {
      console.log('  • System is ready for production deployment');
      console.log('  • Set up continuous performance monitoring');
      console.log('  • Establish performance baselines for future regression testing');
    }
  }

  getStatusEmoji(status) {
    switch (status) {
      case 'PASSED': return '🟢';
      case 'WARNING': return '🟡';
      case 'FAILED': return '🔴';
      default: return '⚪';
    }
  }

  formatPhaseName(phase) {
    const names = {
      loadTest: 'Load Testing',
      stressTest: 'Stress Testing',
      benchmark: 'Benchmark Testing',
      regression: 'Regression Testing'
    };
    return names[phase] || phase;
  }

  async generateErrorReport(error) {
    const errorReport = {
      testSuite: 'Complete Performance Testing Suite',
      timestamp: new Date().toISOString(),
      status: 'FAILED',
      error: {
        message: error.message,
        stack: error.stack
      },
      completedPhases: Object.entries(this.results).filter(([_, result]) => result).length,
      results: this.results
    };

    const filename = `performance-error-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const resultsDir = path.join(__dirname, 'results');
    
    try {
      await fs.mkdir(resultsDir, { recursive: true });
      const filepath = path.join(resultsDir, filename);
      await fs.writeFile(filepath, JSON.stringify(errorReport, null, 2));
      console.log(`\n📄 Error report saved to: ${filepath}`);
    } catch (saveError) {
      console.error('Failed to save error report:', saveError);
    }
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};

  // Parse command line arguments
  args.forEach(arg => {
    switch (arg) {
      case '--skip-load':
        options.skipLoad = true;
        break;
      case '--skip-stress':
        options.skipStress = true;
        break;
      case '--skip-benchmark':
        options.skipBenchmark = true;
        break;
      case '--skip-regression':
        options.skipRegression = true;
        break;
      case '--create-baseline':
        options.createBaseline = true;
        break;
      case '--help':
        console.log(`
Performance Testing Suite Runner

Usage: node runAllTests.js [options]

Options:
  --skip-load         Skip load testing phase
  --skip-stress       Skip stress testing phase
  --skip-benchmark    Skip benchmark testing phase
  --skip-regression   Skip regression testing phase
  --create-baseline   Create new performance baseline
  --help              Show this help message

Examples:
  node runAllTests.js                    # Run all tests
  node runAllTests.js --skip-stress      # Skip stress testing
  node runAllTests.js --create-baseline  # Create new baseline
        `);
        process.exit(0);
        break;
    }
  });

  const runner = new PerformanceTestRunner();
  
  runner.runAllTests(options)
    .then(() => {
      console.log('\n🎉 Performance testing suite completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Performance testing suite failed:', error);
      process.exit(1);
    });
}

module.exports = PerformanceTestRunner;