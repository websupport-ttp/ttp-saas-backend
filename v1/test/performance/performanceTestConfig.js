// Performance Test Configuration
const config = {
  // Server configuration
  server: {
    host: process.env.TEST_HOST || 'localhost',
    port: process.env.TEST_PORT || 5001,
    protocol: process.env.TEST_PROTOCOL || 'http'
  },

  // Load testing configuration
  loadTest: {
    connections: 10,
    duration: 30, // seconds
    pipelining: 1,
    timeout: 10000, // 10 seconds
    maxConnectionRequests: 100,
    maxOverallRequests: 1000
  },

  // Stress testing configuration
  stressTest: {
    connections: 50,
    duration: 60, // seconds
    pipelining: 2,
    timeout: 15000, // 15 seconds
    maxConnectionRequests: 200,
    maxOverallRequests: 5000
  },

  // Benchmark configuration
  benchmark: {
    warmupRequests: 100,
    testRequests: 1000,
    concurrency: 10,
    timeout: 5000
  },

  // Performance thresholds
  thresholds: {
    responseTime: {
      p50: 100, // 50th percentile should be under 100ms
      p95: 500, // 95th percentile should be under 500ms
      p99: 1000 // 99th percentile should be under 1000ms
    },
    throughput: {
      minimum: 100 // requests per second
    },
    errorRate: {
      maximum: 0.01 // 1% error rate maximum
    },
    memoryUsage: {
      maximum: 512 * 1024 * 1024 // 512MB maximum
    },
    cpuUsage: {
      maximum: 80 // 80% CPU usage maximum
    }
  },

  // Test endpoints
  endpoints: [
    {
      name: 'Health Check',
      path: '/api/v1/health',
      method: 'GET',
      headers: {},
      priority: 'high'
    },
    {
      name: 'User Registration',
      path: '/api/v1/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: 'TestPassword123!',
        phoneNumber: '+1234567890'
      },
      priority: 'high'
    },
    {
      name: 'User Login',
      path: '/api/v1/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        email: 'test@example.com',
        password: 'TestPassword123!'
      },
      priority: 'high'
    },
    {
      name: 'Get Posts',
      path: '/api/v1/posts',
      method: 'GET',
      headers: {},
      priority: 'medium'
    },
    {
      name: 'Get Packages',
      path: '/api/v1/posts?postType=Packages',
      method: 'GET',
      headers: {},
      priority: 'high'
    },
    {
      name: 'Analytics Summary',
      path: '/api/v1/analytics/summary',
      method: 'GET',
      headers: {},
      requiresAuth: true,
      priority: 'medium'
    }
  ],

  // Regression test configuration
  regression: {
    baselineFile: 'v1/test/performance/baselines/performance-baseline.json',
    tolerancePercent: 10, // 10% tolerance for regression
    historyFile: 'v1/test/performance/history/performance-history.json'
  },

  // CI/CD Integration settings
  cicd: {
    failOnRegression: true,
    failOnHighErrorRate: true,
    failOnSlowResponse: true,
    generateJunitReport: true,
    slackWebhook: process.env.SLACK_WEBHOOK_URL,
    emailNotifications: process.env.PERFORMANCE_EMAIL_NOTIFICATIONS === 'true'
  },

  // Advanced monitoring settings
  monitoring: {
    collectSystemMetrics: true,
    profileMemoryUsage: true,
    trackCpuUsage: true,
    monitorEventLoop: true,
    collectGcStats: true
  },

  // Load testing scenarios
  scenarios: {
    light: {
      connections: 5,
      duration: 15,
      pipelining: 1
    },
    normal: {
      connections: 10,
      duration: 30,
      pipelining: 1
    },
    heavy: {
      connections: 25,
      duration: 60,
      pipelining: 2
    },
    extreme: {
      connections: 100,
      duration: 120,
      pipelining: 3
    }
  }
};

module.exports = config;