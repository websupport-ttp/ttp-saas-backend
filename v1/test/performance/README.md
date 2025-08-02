# Performance Testing Suite

A comprehensive performance testing framework for The Travel Place API that includes load testing, stress testing, benchmarking, and regression testing capabilities.

## 🚀 Quick Start

```bash
# Run all performance tests
npm run test:perf-all

# Run specific test types
npm run test:load          # Load testing only
npm run test:stress        # Stress testing only
npm run test:benchmark     # Benchmark testing only
npm run test:perf-regression # Regression testing only

# CI/CD Integration
npm run test:perf-cicd     # Optimized for CI/CD pipelines

# Create performance baseline
npm run test:perf-baseline

# Light testing (skip heavy tests)
npm run test:perf-light
```

## 📊 Test Types

### 1. Load Testing
Tests system performance under normal expected load conditions.

- **Purpose**: Validate performance under typical usage patterns
- **Configuration**: 10 connections, 30 seconds duration
- **Metrics**: Response time, throughput, error rate
- **Thresholds**: P95 < 500ms, P99 < 1000ms, Error rate < 1%

### 2. Stress Testing
Tests system behavior under extreme load conditions.

- **Purpose**: Identify breaking points and resilience
- **Configuration**: 50 connections, 60 seconds duration
- **Metrics**: System stability, error handling, recovery
- **Focus**: Concurrent user sessions, resource exhaustion

### 3. Benchmark Testing
Comprehensive performance analysis with scoring.

- **Purpose**: Detailed performance profiling and scoring
- **Configuration**: Warmup + sustained load testing
- **Metrics**: Response time distribution, throughput analysis
- **Output**: Performance grades (A-F) and recommendations

### 4. Regression Testing
Compares current performance against established baselines.

- **Purpose**: Detect performance degradation over time
- **Configuration**: Lightweight tests for comparison
- **Metrics**: Performance delta analysis
- **Tolerance**: 10% degradation threshold

## 🏗️ Architecture

```
v1/test/performance/
├── runAllTests.js           # Main test runner
├── loadTest.js             # Load testing implementation
├── stressTest.js           # Stress testing implementation
├── benchmarkTest.js        # Benchmark testing implementation
├── regressionTest.js       # Regression testing implementation
├── cicdIntegration.js      # CI/CD pipeline integration
├── performanceTestConfig.js # Configuration settings
├── performance.test.js     # Jest integration tests
├── utils/
│   ├── performanceUtils.js # Core utilities
│   ├── systemMonitor.js    # System metrics monitoring
│   └── reportGenerator.js  # Multi-format report generation
├── results/                # Test results storage
├── baselines/              # Performance baselines
└── history/                # Historical performance data
```

## ⚙️ Configuration

### Test Configuration (`performanceTestConfig.js`)

```javascript
{
  // Server settings
  server: {
    host: 'localhost',
    port: 5001,
    protocol: 'http'
  },

  // Performance thresholds
  thresholds: {
    responseTime: {
      p50: 100,   // 50th percentile
      p95: 500,   // 95th percentile
      p99: 1000   // 99th percentile
    },
    throughput: {
      minimum: 100  // requests per second
    },
    errorRate: {
      maximum: 0.01  // 1% maximum
    }
  },

  // Test scenarios
  scenarios: {
    light: { connections: 5, duration: 15 },
    normal: { connections: 10, duration: 30 },
    heavy: { connections: 25, duration: 60 },
    extreme: { connections: 100, duration: 120 }
  }
}
```

### Environment Variables

```bash
# Server configuration
TEST_HOST=localhost
TEST_PORT=5001
TEST_PROTOCOL=http

# CI/CD integration
NODE_ENV=test
CI_COMMIT_REF_NAME=main
GITHUB_SHA=abc123

# Notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
PERFORMANCE_EMAIL_NOTIFICATIONS=true

# Baseline management
UPDATE_BASELINE=true
```

## 📈 Metrics and Monitoring

### Core Performance Metrics
- **Response Time**: P50, P95, P99 percentiles
- **Throughput**: Requests per second
- **Error Rate**: Percentage of failed requests
- **Concurrency**: Concurrent request handling

### System Metrics
- **Memory Usage**: Heap utilization and growth
- **CPU Load**: System load averages
- **Event Loop Lag**: Node.js event loop performance
- **Resource Utilization**: System resource consumption

### Analysis Features
- **Automatic Threshold Checking**: Pass/fail based on configured limits
- **Trend Analysis**: Performance changes over time
- **Regression Detection**: Automatic baseline comparison
- **Issue Classification**: Critical, high, medium, low severity

## 📄 Report Generation

### Supported Formats
- **JSON**: Machine-readable detailed results
- **HTML**: Interactive web-based reports
- **Markdown**: Documentation-friendly format
- **CSV**: Spreadsheet-compatible data export
- **JUnit XML**: CI/CD integration format

### Report Contents
- Executive summary with pass/fail status
- Detailed metrics for each endpoint
- Performance trend analysis
- System resource utilization
- Actionable recommendations
- Historical comparison data

## 🔄 CI/CD Integration

### GitHub Actions Example

```yaml
name: Performance Tests
on: [push, pull_request]

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Start test server
        run: npm start &
        
      - name: Run performance tests
        run: npm run test:perf-cicd
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
      
      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: performance-results
          path: v1/test/performance/results/
```

### GitLab CI Example

```yaml
performance_tests:
  stage: test
  script:
    - npm ci
    - npm start &
    - npm run test:perf-cicd
  artifacts:
    reports:
      junit: v1/test/performance/results/cicd/*-junit.xml
    paths:
      - v1/test/performance/results/
  only:
    - main
    - merge_requests
```

## 🎯 Best Practices

### Test Environment
- Use dedicated test environment
- Ensure consistent resource allocation
- Minimize external dependencies
- Use realistic test data

### Baseline Management
- Create baselines from stable releases
- Update baselines for major changes
- Version control baseline files
- Document baseline creation context

### Threshold Setting
- Base thresholds on business requirements
- Consider user experience impact
- Account for infrastructure variations
- Review and adjust regularly

### CI/CD Integration
- Run appropriate tests for context (PR vs main branch)
- Set reasonable timeout limits
- Configure proper notifications
- Archive results for analysis

## 🔧 Troubleshooting

### Common Issues

#### High Memory Usage
```bash
# Enable garbage collection monitoring
node --expose-gc --max-old-space-size=4096 v1/test/performance/runAllTests.js
```

#### Connection Timeouts
- Increase timeout values in configuration
- Check server capacity and scaling
- Verify network connectivity

#### Inconsistent Results
- Run tests multiple times
- Check for external load on test environment
- Verify test data consistency

#### CI/CD Failures
- Review test configuration for CI environment
- Check resource limits and timeouts
- Verify environment variable configuration

### Debug Mode

```bash
# Enable debug logging
DEBUG=performance:* npm run test:perf-all

# Run with system monitoring
MONITOR_SYSTEM=true npm run test:perf-all

# Generate detailed reports
DETAILED_REPORTS=true npm run test:perf-all
```

## 📚 Advanced Usage

### Custom Test Scenarios

```javascript
// Custom load test
const PerformanceUtils = require('./utils/performanceUtils');

const customTest = async () => {
  const result = await PerformanceUtils.runLoadTest('http://localhost:5001/api/v1/custom', {
    connections: 20,
    duration: 45,
    headers: { 'Authorization': 'Bearer token' }
  });
  
  console.log('Custom test results:', result);
};
```

### Programmatic Usage

```javascript
const PerformanceTestRunner = require('./runAllTests');

const runner = new PerformanceTestRunner();
await runner.runAllTests({
  skipStress: true,
  customEndpoints: [
    { name: 'Custom API', path: '/api/v1/custom', method: 'POST' }
  ]
});
```

### Custom Reporting

```javascript
const ReportGenerator = require('./utils/reportGenerator');

const generator = new ReportGenerator();
const htmlReport = await generator.generateReport(results, 'html');
console.log('Custom HTML report generated');
```

## 🤝 Contributing

1. Follow existing code patterns
2. Add tests for new features
3. Update documentation
4. Ensure CI/CD compatibility
5. Test with multiple scenarios

## 📝 License

This performance testing suite is part of The Travel Place API project and follows the same licensing terms.