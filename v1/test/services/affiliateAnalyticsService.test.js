// v1/test/services/affiliateAnalyticsService.test.js
const AnalyticsService = require('../../services/analyticsService');

describe('Affiliate Analytics Service Integration', () => {
  const startDate = new Date('2024-01-01');
  const endDate = new Date('2024-01-31');

  test('should have affiliate performance analytics method', () => {
    expect(typeof AnalyticsService.getAffiliatePerformanceAnalytics).toBe('function');
  });

  test('should have affiliate revenue analytics method', () => {
    expect(typeof AnalyticsService.getAffiliateRevenueAnalytics).toBe('function');
  });

  test('should have affiliate conversion metrics method', () => {
    expect(typeof AnalyticsService.getAffiliateConversionMetrics).toBe('function');
  });

  test('should have affiliate dashboard analytics method', () => {
    expect(typeof AnalyticsService.getAffiliateDashboardAnalytics).toBe('function');
  });

  test('should have affiliate overview metrics method', () => {
    expect(typeof AnalyticsService.getAffiliateOverviewMetrics).toBe('function');
  });

  test('should return proper structure for affiliate performance analytics', async () => {
    const result = await AnalyticsService.getAffiliatePerformanceAnalytics(startDate, endDate);
    
    expect(result).toHaveProperty('topAffiliates');
    expect(result).toHaveProperty('commissionStats');
    expect(result).toHaveProperty('commissionsByService');
    expect(Array.isArray(result.topAffiliates)).toBe(true);
    expect(Array.isArray(result.commissionsByService)).toBe(true);
  });

  test('should return proper structure for affiliate revenue analytics', async () => {
    const result = await AnalyticsService.getAffiliateRevenueAnalytics(startDate, endDate);
    
    expect(result).toHaveProperty('affiliateRevenue');
    expect(result).toHaveProperty('totalRevenue');
    expect(result).toHaveProperty('affiliateContribution');
    expect(result).toHaveProperty('revenueByService');
    expect(Array.isArray(result.revenueByService)).toBe(true);
  });

  test('should return proper structure for affiliate conversion metrics', async () => {
    const result = await AnalyticsService.getAffiliateConversionMetrics(startDate, endDate);
    
    expect(result).toHaveProperty('overallMetrics');
    expect(result).toHaveProperty('affiliateConversions');
    expect(result).toHaveProperty('referralSources');
    expect(Array.isArray(result.affiliateConversions)).toBe(true);
    expect(Array.isArray(result.referralSources)).toBe(true);
  });

  test('should return proper structure for affiliate dashboard analytics', async () => {
    const result = await AnalyticsService.getAffiliateDashboardAnalytics(startDate, endDate);
    
    expect(result).toHaveProperty('overview');
    expect(result).toHaveProperty('performance');
    expect(result).toHaveProperty('revenue');
    expect(result).toHaveProperty('conversions');
    expect(result).toHaveProperty('generatedAt');
    expect(result.generatedAt).toBeInstanceOf(Date);
  });

  test('should return proper structure for affiliate overview metrics', async () => {
    const result = await AnalyticsService.getAffiliateOverviewMetrics(startDate, endDate);
    
    expect(result).toHaveProperty('totalActiveAffiliates');
    expect(result).toHaveProperty('pendingAffiliates');
    expect(result).toHaveProperty('totalReferrals');
    expect(result).toHaveProperty('conversionRate');
    expect(result).toHaveProperty('totalCommissions');
    expect(typeof result.totalActiveAffiliates).toBe('number');
    expect(typeof result.conversionRate).toBe('number');
  });

  test('should include affiliate data in main dashboard analytics', async () => {
    const result = await AnalyticsService.getDashboardAnalytics(startDate, endDate);
    
    expect(result).toHaveProperty('affiliates');
    expect(result).toHaveProperty('overview');
    expect(result).toHaveProperty('revenue');
    expect(result).toHaveProperty('customers');
    expect(result).toHaveProperty('products');
    expect(result).toHaveProperty('trends');
    expect(result.affiliates).toHaveProperty('totalActiveAffiliates');
    expect(result.affiliates).toHaveProperty('totalReferrals');
    expect(result.affiliates).toHaveProperty('totalCommissions');
  });

  test('should handle empty database gracefully', async () => {
    const result = await AnalyticsService.getAffiliatePerformanceAnalytics(startDate, endDate);

    expect(result).toHaveProperty('topAffiliates');
    expect(result).toHaveProperty('commissionStats');
    expect(result.topAffiliates).toBeInstanceOf(Array);
    expect(result.commissionStats).toHaveProperty('totalCommissions');
  });

  test('should handle date range edge cases', async () => {
    const sameDate = new Date('2024-01-15');
    const result = await AnalyticsService.getAffiliatePerformanceAnalytics(sameDate, sameDate);

    expect(result).toHaveProperty('topAffiliates');
    expect(result).toHaveProperty('commissionStats');
  });

  test('should calculate affiliate contribution percentages correctly', async () => {
    const result = await AnalyticsService.getAffiliateRevenueAnalytics(startDate, endDate);

    expect(result.affiliateContribution).toHaveProperty('revenuePercentage');
    expect(result.affiliateContribution).toHaveProperty('profitPercentage');
    expect(result.affiliateContribution).toHaveProperty('bookingPercentage');
    expect(typeof result.affiliateContribution.revenuePercentage).toBe('string');
  });

  test('should provide conversion metrics with proper data types', async () => {
    const result = await AnalyticsService.getAffiliateConversionMetrics(startDate, endDate);

    expect(typeof result.overallMetrics.totalReferrals).toBe('number');
    expect(typeof result.overallMetrics.overallConversionRate).toBe('number');
    expect(typeof result.overallMetrics.activeAffiliateCount).toBe('number');
    expect(result.overallMetrics.totalReferrals).toBeGreaterThanOrEqual(0);
    expect(result.overallMetrics.overallConversionRate).toBeGreaterThanOrEqual(0);
  });

  test('should aggregate commission data by service type', async () => {
    const result = await AnalyticsService.getAffiliatePerformanceAnalytics(startDate, endDate);

    expect(result.commissionsByService).toBeInstanceOf(Array);
    result.commissionsByService.forEach(service => {
      expect(service).toHaveProperty('serviceType');
      expect(service).toHaveProperty('totalCommissions');
      expect(service).toHaveProperty('approvedCommissions');
      expect(service).toHaveProperty('pendingCommissions');
      expect(typeof service.totalCommissions).toBe('number');
    });
  });

  test('should provide referral source breakdown', async () => {
    const result = await AnalyticsService.getAffiliateConversionMetrics(startDate, endDate);

    expect(result.referralSources).toBeInstanceOf(Array);
    result.referralSources.forEach(source => {
      expect(source).toHaveProperty('source');
      expect(source).toHaveProperty('referralCount');
      expect(source).toHaveProperty('convertedCount');
      expect(source).toHaveProperty('conversionRate');
      expect(typeof source.conversionRate).toBe('number');
    });
  });
});