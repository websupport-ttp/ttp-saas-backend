// v1/test/utils/testEnvironmentManager.js
// Enhanced test environment manager for concurrent test execution and rate limit handling

const { RETRY_CONFIG } = require('./testRetryLogic');

/**
 * Test environment configuration for handling concurrent execution
 */
class TestEnvironmentManager {
  constructor() {
    this.testSessions = new Map();
    this.globalRateLimitState = {
      lastRateLimit: 0,
      consecutiveRateLimits: 0,
      cooldownMultiplier: 1
    };
    this.testMetrics = {
      totalTests: 0,
      rateLimitedTests: 0,
      retriedTests: 0,
      failedTests: 0
    };
  }

  /**
   * Initializes test environment for a specific test suite
   * @param {string} suiteName - Name of the test suite
   * @param {Object} options - Configuration options
   */
  async initializeTestSuite(suiteName, options = {}) {
    const {
      maxConcurrentTests = RETRY_CONFIG.isolation.concurrentTestLimit,
      rateLimitBackoff = RETRY_CONFIG.isolation.rateLimitCooldown,
      testIsolationDelay = RETRY_CONFIG.isolation.testDelay
    } = options;

    const session = {
      suiteName,
      startTime: Date.now(),
      maxConcurrentTests,
      rateLimitBackoff,
      testIsolationDelay,
      activeTests: new Set(),
      completedTests: new Set(),
      failedTests: new Set(),
      rateLimitedTests: new Set(),
      testQueue: [],
      metrics: {
        totalRequests: 0,
        rateLimitedRequests: 0,
        retriedRequests: 0,
        averageResponseTime: 0,
        responseTimeSum: 0
      }
    };

    this.testSessions.set(suiteName, session);
    console.log(`🚀 Test suite initialized: ${suiteName}`);
    
    return session;
  }

  /**
   * Gets or creates a test session
   * @param {string} suiteName - Name of the test suite
   * @returns {Object} - Test session
   */
  getTestSession(suiteName) {
    if (!this.testSessions.has(suiteName)) {
      return this.initializeTestSuite(suiteName);
    }
    return this.testSessions.get(suiteName);
  }

  /**
   * Calculates dynamic delays based on current rate limiting state
   * @param {string} suiteName - Test suite name
   * @returns {Object} - Calculated delays
   */
  calculateDynamicDelays(suiteName) {
    const session = this.getTestSession(suiteName);
    const now = Date.now();
    
    // Base delays
    let testDelay = session.testIsolationDelay;
    let rateLimitCooldown = session.rateLimitBackoff;
    
    // Increase delays if we've been hitting rate limits recently
    const timeSinceLastRateLimit = now - this.globalRateLimitState.lastRateLimit;
    const recentRateLimit = timeSinceLastRateLimit < 30000; // 30 seconds
    
    if (recentRateLimit) {
      const multiplier = Math.min(this.globalRateLimitState.cooldownMultiplier, 5);
      testDelay *= multiplier;
      rateLimitCooldown *= multiplier;
      
      console.warn(`⚠️ Recent rate limiting detected - increasing delays by ${multiplier}x`);
    }
    
    // Additional delay based on consecutive rate limits
    if (this.globalRateLimitState.consecutiveRateLimits > 0) {
      const additionalDelay = this.globalRateLimitState.consecutiveRateLimits * 1000;
      testDelay += additionalDelay;
      console.warn(`⚠️ Adding ${additionalDelay}ms delay due to ${this.globalRateLimitState.consecutiveRateLimits} consecutive rate limits`);
    }
    
    return {
      testDelay,
      rateLimitCooldown,
      shouldThrottle: recentRateLimit || this.globalRateLimitState.consecutiveRateLimits > 2
    };
  }

  /**
   * Records a rate limit event
   * @param {string} suiteName - Test suite name
   * @param {string} testName - Test name
   * @param {Object} error - Rate limit error
   */
  recordRateLimit(suiteName, testName, error) {
    const session = this.getTestSession(suiteName);
    const now = Date.now();
    
    // Update global rate limit state
    this.globalRateLimitState.lastRateLimit = now;
    this.globalRateLimitState.consecutiveRateLimits++;
    this.globalRateLimitState.cooldownMultiplier = Math.min(
      this.globalRateLimitState.cooldownMultiplier * 1.5,
      5
    );
    
    // Update session state
    session.rateLimitedTests.add(testName);
    session.metrics.rateLimitedRequests++;
    
    // Update global metrics
    this.testMetrics.rateLimitedTests++;
    
    console.warn(`🚫 Rate limit recorded for ${suiteName}:${testName} (consecutive: ${this.globalRateLimitState.consecutiveRateLimits})`);
    
    // Log rate limit details
    const retryAfter = error.headers?.['retry-after'] || error.response?.headers?.['retry-after'];
    if (retryAfter) {
      console.warn(`   Server requested ${retryAfter}s retry delay`);
    }
  }

  /**
   * Records a successful request (resets consecutive rate limits)
   * @param {string} suiteName - Test suite name
   * @param {string} testName - Test name
   * @param {number} responseTime - Response time in ms
   */
  recordSuccess(suiteName, testName, responseTime) {
    const session = this.getTestSession(suiteName);
    
    // Reset consecutive rate limits on success
    if (this.globalRateLimitState.consecutiveRateLimits > 0) {
      console.log(`✅ Successful request - resetting consecutive rate limit counter`);
      this.globalRateLimitState.consecutiveRateLimits = 0;
      this.globalRateLimitState.cooldownMultiplier = 1;
    }
    
    // Update metrics
    session.completedTests.add(testName);
    session.metrics.totalRequests++;
    session.metrics.responseTimeSum += responseTime;
    session.metrics.averageResponseTime = session.metrics.responseTimeSum / session.metrics.totalRequests;
    
    this.testMetrics.totalTests++;
  }

  /**
   * Records a test retry
   * @param {string} suiteName - Test suite name
   * @param {string} testName - Test name
   * @param {number} attempt - Attempt number
   * @param {string} reason - Retry reason
   */
  recordRetry(suiteName, testName, attempt, reason) {
    const session = this.getTestSession(suiteName);
    
    session.metrics.retriedRequests++;
    this.testMetrics.retriedTests++;
    
    console.log(`🔄 Test retry recorded: ${suiteName}:${testName} (attempt ${attempt}) - ${reason}`);
  }

  /**
   * Records a test failure
   * @param {string} suiteName - Test suite name
   * @param {string} testName - Test name
   * @param {Object} error - Error object
   */
  recordFailure(suiteName, testName, error) {
    const session = this.getTestSession(suiteName);
    
    session.failedTests.add(testName);
    this.testMetrics.failedTests++;
    
    console.error(`❌ Test failure recorded: ${suiteName}:${testName} - ${error.message}`);
  }

  /**
   * Gets comprehensive test session statistics
   * @param {string} suiteName - Test suite name
   * @returns {Object} - Session statistics
   */
  getSessionStats(suiteName) {
    const session = this.getTestSession(suiteName);
    const now = Date.now();
    const duration = now - session.startTime;
    
    return {
      suiteName,
      duration,
      tests: {
        total: session.activeTests.size + session.completedTests.size + session.failedTests.size,
        active: session.activeTests.size,
        completed: session.completedTests.size,
        failed: session.failedTests.size,
        rateLimited: session.rateLimitedTests.size
      },
      requests: {
        total: session.metrics.totalRequests,
        rateLimited: session.metrics.rateLimitedRequests,
        retried: session.metrics.retriedRequests,
        averageResponseTime: Math.round(session.metrics.averageResponseTime)
      },
      rateLimitState: {
        lastRateLimit: this.globalRateLimitState.lastRateLimit,
        consecutiveRateLimits: this.globalRateLimitState.consecutiveRateLimits,
        cooldownMultiplier: this.globalRateLimitState.cooldownMultiplier
      }
    };
  }

  /**
   * Gets global test environment statistics
   * @returns {Object} - Global statistics
   */
  getGlobalStats() {
    const activeSessions = Array.from(this.testSessions.keys());
    const totalSessions = this.testSessions.size;
    
    return {
      sessions: {
        total: totalSessions,
        active: activeSessions
      },
      globalMetrics: this.testMetrics,
      rateLimitState: this.globalRateLimitState,
      recommendations: this.generateRecommendations()
    };
  }

  /**
   * Generates recommendations based on current test performance
   * @returns {Array} - Array of recommendations
   */
  generateRecommendations() {
    const recommendations = [];
    const rateLimitRatio = this.testMetrics.rateLimitedTests / Math.max(this.testMetrics.totalTests, 1);
    const retryRatio = this.testMetrics.retriedTests / Math.max(this.testMetrics.totalTests, 1);
    
    if (rateLimitRatio > 0.1) {
      recommendations.push({
        type: 'rate_limiting',
        severity: 'high',
        message: `High rate limiting detected (${(rateLimitRatio * 100).toFixed(1)}% of tests). Consider increasing test delays or reducing concurrency.`
      });
    }
    
    if (retryRatio > 0.2) {
      recommendations.push({
        type: 'retries',
        severity: 'medium',
        message: `High retry rate detected (${(retryRatio * 100).toFixed(1)}% of tests). Consider optimizing test stability.`
      });
    }
    
    if (this.globalRateLimitState.consecutiveRateLimits > 5) {
      recommendations.push({
        type: 'consecutive_rate_limits',
        severity: 'high',
        message: `${this.globalRateLimitState.consecutiveRateLimits} consecutive rate limits detected. Consider implementing longer cooldown periods.`
      });
    }
    
    return recommendations;
  }

  /**
   * Cleans up a test session
   * @param {string} suiteName - Test suite name
   */
  cleanupSession(suiteName) {
    if (this.testSessions.has(suiteName)) {
      const session = this.testSessions.get(suiteName);
      const stats = this.getSessionStats(suiteName);
      
      console.log(`🧹 Cleaning up test session: ${suiteName}`);
      console.log(`   Duration: ${stats.duration}ms`);
      console.log(`   Tests: ${stats.tests.completed} completed, ${stats.tests.failed} failed, ${stats.tests.rateLimited} rate limited`);
      console.log(`   Requests: ${stats.requests.total} total, ${stats.requests.rateLimited} rate limited, ${stats.requests.retried} retried`);
      
      this.testSessions.delete(suiteName);
    }
  }

  /**
   * Resets global state (useful for test cleanup)
   */
  reset() {
    this.testSessions.clear();
    this.globalRateLimitState = {
      lastRateLimit: 0,
      consecutiveRateLimits: 0,
      cooldownMultiplier: 1
    };
    this.testMetrics = {
      totalTests: 0,
      rateLimitedTests: 0,
      retriedTests: 0,
      failedTests: 0
    };
    console.log('🔄 Test environment manager reset');
  }

  /**
   * Prints comprehensive test environment report
   */
  printReport() {
    const globalStats = this.getGlobalStats();
    
    console.log('\n📊 Test Environment Report');
    console.log('=' .repeat(50));
    console.log(`Sessions: ${globalStats.sessions.total} total`);
    console.log(`Tests: ${globalStats.globalMetrics.totalTests} total, ${globalStats.globalMetrics.failedTests} failed`);
    console.log(`Rate Limits: ${globalStats.globalMetrics.rateLimitedTests} tests affected`);
    console.log(`Retries: ${globalStats.globalMetrics.retriedTests} tests retried`);
    console.log(`Consecutive Rate Limits: ${globalStats.rateLimitState.consecutiveRateLimits}`);
    console.log(`Cooldown Multiplier: ${globalStats.rateLimitState.cooldownMultiplier}x`);
    
    if (globalStats.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      globalStats.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. [${rec.severity.toUpperCase()}] ${rec.message}`);
      });
    }
    
    console.log('=' .repeat(50));
  }
}

// Export singleton instance
const testEnvironmentManager = new TestEnvironmentManager();

module.exports = {
  TestEnvironmentManager,
  testEnvironmentManager
};