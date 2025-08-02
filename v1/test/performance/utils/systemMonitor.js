const os = require('os');
const fs = require('fs').promises;
const path = require('path');

class SystemMonitor {
  constructor() {
    this.isMonitoring = false;
    this.metrics = [];
    this.interval = null;
    this.startTime = null;
  }

  startMonitoring(intervalMs = 1000) {
    if (this.isMonitoring) {
      console.warn('System monitoring is already running');
      return;
    }

    this.isMonitoring = true;
    this.startTime = Date.now();
    this.metrics = [];

    console.log('📊 Starting system monitoring...');

    this.interval = setInterval(() => {
      this.collectMetrics();
    }, intervalMs);
  }

  stopMonitoring() {
    if (!this.isMonitoring) {
      return null;
    }

    this.isMonitoring = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    console.log('📊 System monitoring stopped');

    return this.generateReport();
  }

  collectMetrics() {
    const timestamp = Date.now();
    const relativeTime = timestamp - this.startTime;

    // Memory usage
    const memoryUsage = process.memoryUsage();
    const systemMemory = {
      total: os.totalmem(),
      free: os.freemem(),
      used: os.totalmem() - os.freemem()
    };

    // CPU usage
    const cpuUsage = process.cpuUsage();
    const loadAverage = os.loadavg();

    // Event loop lag
    const eventLoopStart = process.hrtime.bigint();
    setImmediate(() => {
      const eventLoopEnd = process.hrtime.bigint();
      const eventLoopLag = Number(eventLoopEnd - eventLoopStart) / 1000000; // Convert to milliseconds

      const metric = {
        timestamp,
        relativeTime,
        memory: {
          process: {
            rss: memoryUsage.rss,
            heapTotal: memoryUsage.heapTotal,
            heapUsed: memoryUsage.heapUsed,
            external: memoryUsage.external,
            arrayBuffers: memoryUsage.arrayBuffers
          },
          system: systemMemory,
          usage: {
            processPercent: (memoryUsage.rss / systemMemory.total) * 100,
            systemPercent: (systemMemory.used / systemMemory.total) * 100
          }
        },
        cpu: {
          usage: cpuUsage,
          loadAverage: {
            '1min': loadAverage[0],
            '5min': loadAverage[1],
            '15min': loadAverage[2]
          },
          cores: os.cpus().length
        },
        eventLoop: {
          lag: eventLoopLag
        },
        uptime: process.uptime()
      };

      this.metrics.push(metric);
    });
  }

  generateReport() {
    if (this.metrics.length === 0) {
      return null;
    }

    const report = {
      duration: Date.now() - this.startTime,
      sampleCount: this.metrics.length,
      startTime: new Date(this.startTime).toISOString(),
      endTime: new Date().toISOString(),
      summary: this.calculateSummary(),
      metrics: this.metrics,
      analysis: this.analyzeMetrics()
    };

    return report;
  }

  calculateSummary() {
    if (this.metrics.length === 0) return null;

    const memoryValues = this.metrics.map(m => m.memory.process.heapUsed);
    const cpuLoadValues = this.metrics.map(m => m.cpu.loadAverage['1min']);
    const eventLoopLagValues = this.metrics.map(m => m.eventLoop.lag);

    return {
      memory: {
        heapUsed: {
          min: Math.min(...memoryValues),
          max: Math.max(...memoryValues),
          avg: memoryValues.reduce((sum, val) => sum + val, 0) / memoryValues.length,
          final: memoryValues[memoryValues.length - 1]
        }
      },
      cpu: {
        loadAverage: {
          min: Math.min(...cpuLoadValues),
          max: Math.max(...cpuLoadValues),
          avg: cpuLoadValues.reduce((sum, val) => sum + val, 0) / cpuLoadValues.length
        }
      },
      eventLoop: {
        lag: {
          min: Math.min(...eventLoopLagValues),
          max: Math.max(...eventLoopLagValues),
          avg: eventLoopLagValues.reduce((sum, val) => sum + val, 0) / eventLoopLagValues.length
        }
      }
    };
  }

  analyzeMetrics() {
    const analysis = {
      issues: [],
      warnings: [],
      recommendations: []
    };

    const summary = this.calculateSummary();
    if (!summary) return analysis;

    // Memory analysis
    const maxHeapUsed = summary.memory.heapUsed.max;
    const avgHeapUsed = summary.memory.heapUsed.avg;
    const heapGrowth = summary.memory.heapUsed.final - summary.memory.heapUsed.min;

    if (maxHeapUsed > 512 * 1024 * 1024) { // 512MB
      analysis.issues.push({
        type: 'High Memory Usage',
        value: `${(maxHeapUsed / 1024 / 1024).toFixed(2)}MB`,
        severity: 'high'
      });
      analysis.recommendations.push('Consider optimizing memory usage and implementing garbage collection strategies');
    }

    if (heapGrowth > 100 * 1024 * 1024) { // 100MB growth
      analysis.warnings.push({
        type: 'Memory Growth',
        value: `${(heapGrowth / 1024 / 1024).toFixed(2)}MB increase`,
        severity: 'medium'
      });
      analysis.recommendations.push('Monitor for potential memory leaks');
    }

    // CPU analysis
    const maxCpuLoad = summary.cpu.loadAverage.max;
    const avgCpuLoad = summary.cpu.loadAverage.avg;

    if (maxCpuLoad > 2.0) {
      analysis.issues.push({
        type: 'High CPU Load',
        value: maxCpuLoad.toFixed(2),
        severity: 'high'
      });
      analysis.recommendations.push('Consider CPU optimization and load balancing');
    }

    // Event loop analysis
    const maxEventLoopLag = summary.eventLoop.lag.max;
    const avgEventLoopLag = summary.eventLoop.lag.avg;

    if (maxEventLoopLag > 100) { // 100ms lag
      analysis.issues.push({
        type: 'High Event Loop Lag',
        value: `${maxEventLoopLag.toFixed(2)}ms`,
        severity: 'high'
      });
      analysis.recommendations.push('Optimize blocking operations and consider worker threads');
    } else if (avgEventLoopLag > 10) { // 10ms average lag
      analysis.warnings.push({
        type: 'Elevated Event Loop Lag',
        value: `${avgEventLoopLag.toFixed(2)}ms average`,
        severity: 'medium'
      });
    }

    return analysis;
  }

  async saveReport(report, filename) {
    const resultsDir = path.join(__dirname, '..', 'results', 'system-metrics');
    
    try {
      await fs.mkdir(resultsDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    const filepath = path.join(resultsDir, filename);
    await fs.writeFile(filepath, JSON.stringify(report, null, 2));
    
    console.log(`📊 System metrics saved to: ${filepath}`);
    return filepath;
  }

  printSummary(report) {
    if (!report || !report.summary) {
      console.log('No system metrics available');
      return;
    }

    console.log('\n📊 System Performance Summary');
    console.log('============================');
    console.log(`Duration: ${(report.duration / 1000).toFixed(2)}s`);
    console.log(`Samples: ${report.sampleCount}`);

    console.log('\nMemory Usage:');
    console.log(`  Heap Used: ${(report.summary.memory.heapUsed.min / 1024 / 1024).toFixed(2)}MB - ${(report.summary.memory.heapUsed.max / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Average: ${(report.summary.memory.heapUsed.avg / 1024 / 1024).toFixed(2)}MB`);

    console.log('\nCPU Load:');
    console.log(`  Load Average: ${report.summary.cpu.loadAverage.min.toFixed(2)} - ${report.summary.cpu.loadAverage.max.toFixed(2)}`);
    console.log(`  Average: ${report.summary.cpu.loadAverage.avg.toFixed(2)}`);

    console.log('\nEvent Loop:');
    console.log(`  Lag: ${report.summary.eventLoop.lag.min.toFixed(2)}ms - ${report.summary.eventLoop.lag.max.toFixed(2)}ms`);
    console.log(`  Average: ${report.summary.eventLoop.lag.avg.toFixed(2)}ms`);

    if (report.analysis.issues.length > 0) {
      console.log('\n⚠️  Issues Detected:');
      report.analysis.issues.forEach(issue => {
        console.log(`  • ${issue.type}: ${issue.value}`);
      });
    }

    if (report.analysis.warnings.length > 0) {
      console.log('\n🟡 Warnings:');
      report.analysis.warnings.forEach(warning => {
        console.log(`  • ${warning.type}: ${warning.value}`);
      });
    }

    if (report.analysis.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.analysis.recommendations.forEach(rec => {
        console.log(`  • ${rec}`);
      });
    }
  }
}

module.exports = SystemMonitor;