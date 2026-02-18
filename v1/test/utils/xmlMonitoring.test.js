// v1/test/utils/xmlMonitoring.test.js
const xmlMonitoring = require('../../utils/xmlMonitoring');

describe('XML Monitoring', () => {
  beforeEach(() => {
    // Reset metrics before each test
    xmlMonitoring.resetMetrics();
  });

  describe('startXmlOperation', () => {
    it('should start monitoring an XML operation', () => {
      const context = xmlMonitoring.startXmlOperation('search', {
        origin: 'JFK',
        destination: 'LAX'
      });

      expect(context).toHaveProperty('operationId');
      expect(context).toHaveProperty('operation', 'search');
      expect(context).toHaveProperty('startTime');
      expect(context).toHaveProperty('context');
      expect(context).toHaveProperty('metrics');
    });

    it('should sanitize sensitive data from context', () => {
      const context = xmlMonitoring.startXmlOperation('authentication', {
        username: 'testuser',
        password: 'secret123',
        endpoint: 'https://api.example.com'
      });

      expect(context.context.password).toBe('[REDACTED]');
      expect(context.context.username).toBe('testuser');
      expect(context.context.endpoint).toBe('https://api.example.com');
    });
  });

  describe('recordSoapCall', () => {
    it('should record SOAP call timing', () => {
      const context = xmlMonitoring.startXmlOperation('search');
      
      xmlMonitoring.recordSoapCall(context, 'Air_FlightSearch', 1500, true);
      
      expect(context.metrics.soapCallTime).toBe(1500);
    });

    it('should accumulate multiple SOAP call times', () => {
      const context = xmlMonitoring.startXmlOperation('search');
      
      xmlMonitoring.recordSoapCall(context, 'Security_Authenticate', 500, true);
      xmlMonitoring.recordSoapCall(context, 'Air_FlightSearch', 1500, true);
      
      expect(context.metrics.soapCallTime).toBe(2000);
    });
  });

  describe('recordXmlParsing', () => {
    it('should record XML parsing timing and size', () => {
      const context = xmlMonitoring.startXmlOperation('search');
      
      xmlMonitoring.recordXmlParsing(context, 250, 5000, true);
      
      expect(context.metrics.parsingTime).toBe(250);
    });

    it('should track parsing failures', () => {
      const context = xmlMonitoring.startXmlOperation('search');
      
      xmlMonitoring.recordXmlParsing(context, 250, 5000, false);
      
      const metrics = xmlMonitoring.getPerformanceMetrics();
      expect(metrics.errorCounts.parsing).toBe(1);
    });
  });

  describe('recordXmlError', () => {
    it('should record different types of XML errors', () => {
      const context = xmlMonitoring.startXmlOperation('search');
      const error = new Error('Connection timeout');
      
      xmlMonitoring.recordXmlError(context, 'timeout', error, {
        endpoint: 'https://api.example.com'
      });
      
      const metrics = xmlMonitoring.getPerformanceMetrics();
      expect(metrics.errorCounts.timeout).toBe(1);
    });

    it('should track consecutive failures', () => {
      const context1 = xmlMonitoring.startXmlOperation('search');
      const context2 = xmlMonitoring.startXmlOperation('search');
      const error = new Error('Test error');
      
      xmlMonitoring.recordXmlError(context1, 'parsing', error);
      xmlMonitoring.recordXmlError(context2, 'parsing', error);
      
      const metrics = xmlMonitoring.getPerformanceMetrics();
      expect(metrics.consecutiveFailures).toBe(2);
    });
  });

  describe('completeXmlOperation', () => {
    it('should complete operation and calculate total duration', () => {
      const context = xmlMonitoring.startXmlOperation('search');
      
      // Simulate some processing time
      setTimeout(() => {
        const result = xmlMonitoring.completeXmlOperation(context, true, { count: 5 });
        
        expect(result).toHaveProperty('operationId', context.operationId);
        expect(result).toHaveProperty('duration');
        expect(result).toHaveProperty('success', true);
        expect(result.duration).toBeGreaterThan(0);
      }, 10);
    });

    it('should reset consecutive failures on success', () => {
      // First create some failures
      const failContext = xmlMonitoring.startXmlOperation('search');
      xmlMonitoring.recordXmlError(failContext, 'parsing', new Error('Test'));
      xmlMonitoring.completeXmlOperation(failContext, false);
      
      // Then succeed
      const successContext = xmlMonitoring.startXmlOperation('search');
      xmlMonitoring.completeXmlOperation(successContext, true);
      
      const metrics = xmlMonitoring.getPerformanceMetrics();
      expect(metrics.consecutiveFailures).toBe(0);
    });
  });

  describe('getPerformanceMetrics', () => {
    it('should return comprehensive performance metrics', () => {
      // Create some test data
      const context = xmlMonitoring.startXmlOperation('search');
      xmlMonitoring.recordSoapCall(context, 'Air_FlightSearch', 1000, true);
      xmlMonitoring.recordXmlParsing(context, 200, 5000, true);
      xmlMonitoring.completeXmlOperation(context, true);
      
      // Record JSON processing time for comparison
      xmlMonitoring.recordJsonProcessingTime('search', 500);
      
      const metrics = xmlMonitoring.getPerformanceMetrics();
      
      expect(metrics).toHaveProperty('averageProcessingTimes');
      expect(metrics).toHaveProperty('operationCounts');
      expect(metrics).toHaveProperty('errorCounts');
      expect(metrics).toHaveProperty('errorRate');
      expect(metrics).toHaveProperty('consecutiveFailures');
      expect(metrics).toHaveProperty('metricsCollectedAt');
      
      expect(metrics.averageProcessingTimes.xmlVsJsonRatio).toBeDefined();
      expect(metrics.operationCounts.search).toBe(1);
    });

    it('should calculate error rate correctly', () => {
      // Create successful operation
      const successContext = xmlMonitoring.startXmlOperation('search');
      xmlMonitoring.completeXmlOperation(successContext, true);
      
      // Create failed operation
      const failContext = xmlMonitoring.startXmlOperation('search');
      xmlMonitoring.recordXmlError(failContext, 'parsing', new Error('Test'));
      xmlMonitoring.completeXmlOperation(failContext, false);
      
      const metrics = xmlMonitoring.getPerformanceMetrics();
      expect(parseFloat(metrics.errorRate)).toBe(0.5); // 50% error rate
    });
  });

  describe('resetMetrics', () => {
    it('should reset all metrics to initial state', () => {
      // Create some test data
      const context = xmlMonitoring.startXmlOperation('search');
      xmlMonitoring.recordXmlError(context, 'parsing', new Error('Test'));
      xmlMonitoring.completeXmlOperation(context, false);
      
      // Reset metrics
      xmlMonitoring.resetMetrics();
      
      const metrics = xmlMonitoring.getPerformanceMetrics();
      expect(metrics.operationCounts.search).toBe(0);
      expect(metrics.errorCounts.parsing).toBe(0);
      expect(metrics.consecutiveFailures).toBe(0);
      expect(metrics.averageProcessingTimes.xml).toBe(0);
    });
  });
});