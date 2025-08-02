// v1/docs/analytics-api-documentation.js
// Comprehensive OpenAPI documentation for analytics and business intelligence endpoints

/**
 * @openapi
 * components:
 *   schemas:
 *     # Analytics Response Schemas
 *     AnalyticsSummary:
 *       type: object
 *       properties:
 *         currentPeriod:
 *           type: object
 *           properties:
 *             totalRevenue:
 *               type: number
 *               description: Total revenue for the current period
 *               example: 15750000
 *             totalProfit:
 *               type: number
 *               description: Total profit for the current period
 *               example: 3150000
 *             totalTransactions:
 *               type: integer
 *               description: Total number of transactions
 *               example: 1250
 *             averageTransactionValue:
 *               type: number
 *               description: Average transaction value
 *               example: 12600
 *             profitMarginPercentage:
 *               type: number
 *               description: Profit margin percentage
 *               example: 20.0
 *         previousPeriod:
 *           type: object
 *           properties:
 *             totalRevenue:
 *               type: number
 *               example: 12500000
 *             totalProfit:
 *               type: number
 *               example: 2500000
 *             totalTransactions:
 *               type: integer
 *               example: 1000
 *             averageTransactionValue:
 *               type: number
 *               example: 12500
 *             profitMarginPercentage:
 *               type: number
 *               example: 20.0
 *         changes:
 *           type: object
 *           properties:
 *             revenueChange:
 *               type: string
 *               description: Revenue change percentage
 *               example: "26.00"
 *             profitChange:
 *               type: string
 *               description: Profit change percentage
 *               example: "26.00"
 *             transactionChange:
 *               type: string
 *               description: Transaction count change percentage
 *               example: "25.00"
 *             avgTransactionChange:
 *               type: string
 *               description: Average transaction value change percentage
 *               example: "0.80"
 *         realTime:
 *           $ref: '#/components/schemas/RealTimeMetrics'
 *         dateRanges:
 *           type: object
 *           properties:
 *             current:
 *               type: object
 *               properties:
 *                 startDate:
 *                   type: string
 *                   format: date-time
 *                 endDate:
 *                   type: string
 *                   format: date-time
 *             previous:
 *               type: object
 *               properties:
 *                 startDate:
 *                   type: string
 *                   format: date-time
 *                 endDate:
 *                   type: string
 *                   format: date-time
 *
 *     RevenueAnalytics:
 *       type: object
 *       properties:
 *         totalRevenue:
 *           type: number
 *           description: Total revenue for the period
 *           example: 15750000
 *         totalProfit:
 *           type: number
 *           description: Total profit for the period
 *           example: 3150000
 *         totalServiceCharges:
 *           type: number
 *           description: Total service charges collected
 *           example: 787500
 *         totalTransactions:
 *           type: integer
 *           description: Total number of completed transactions
 *           example: 1250
 *         averageTransactionValue:
 *           type: number
 *           description: Average transaction value
 *           example: 12600
 *         profitMarginPercentage:
 *           type: number
 *           description: Overall profit margin percentage
 *           example: 20.0
 *         revenueByItemType:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               itemType:
 *                 type: string
 *                 example: "Flight"
 *               totalRevenue:
 *                 type: number
 *                 example: 8500000
 *               totalProfit:
 *                 type: number
 *                 example: 1700000
 *               transactionCount:
 *                 type: integer
 *                 example: 450
 *               averageValue:
 *                 type: number
 *                 example: 18889
 *
 *     CustomerAnalytics:
 *       type: object
 *       properties:
 *         customerSegments:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               segment:
 *                 type: string
 *                 example: "Individual"
 *               totalRevenue:
 *                 type: number
 *                 example: 8500000
 *               totalProfit:
 *                 type: number
 *                 example: 1700000
 *               transactionCount:
 *                 type: integer
 *                 example: 450
 *               averageTransactionValue:
 *                 type: number
 *                 example: 18889
 *         bookingChannels:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               channel:
 *                 type: string
 *                 example: "Web"
 *               totalRevenue:
 *                 type: number
 *                 example: 12500000
 *               transactionCount:
 *                 type: integer
 *                 example: 800
 *               averageTransactionValue:
 *                 type: number
 *                 example: 15625
 *         customerMetrics:
 *           type: object
 *           properties:
 *             totalCustomers:
 *               type: integer
 *               description: Total unique customers
 *               example: 850
 *             newCustomers:
 *               type: integer
 *               description: New customers in the period
 *               example: 650
 *             repeatCustomers:
 *               type: integer
 *               description: Returning customers
 *               example: 200
 *             repeatCustomerRate:
 *               type: number
 *               description: Repeat customer rate percentage
 *               example: 23.53
 *             averageTransactionsPerCustomer:
 *               type: number
 *               description: Average transactions per customer
 *               example: 1.47
 *             averageCustomerValue:
 *               type: number
 *               description: Average customer lifetime value
 *               example: 18529
 *
 *     ProductPerformanceAnalytics:
 *       type: object
 *       properties:
 *         itemPerformance:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               itemType:
 *                 type: string
 *                 example: "Flight"
 *               totalRevenue:
 *                 type: number
 *                 example: 8500000
 *               totalProfit:
 *                 type: number
 *                 example: 1700000
 *               transactionCount:
 *                 type: integer
 *                 example: 450
 *               averageTransactionValue:
 *                 type: number
 *                 example: 18889
 *               averageProfit:
 *                 type: number
 *                 example: 3778
 *               profitMarginPercentage:
 *                 type: number
 *                 example: 20.0
 *         packagePerformance:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               packageId:
 *                 type: string
 *                 example: "60d5ec49f8c6a7001c8a1b2d"
 *               packageTitle:
 *                 type: string
 *                 example: "Kenya Safari Package"
 *               totalRevenue:
 *                 type: number
 *                 example: 750000
 *               totalProfit:
 *                 type: number
 *                 example: 150000
 *               salesCount:
 *                 type: integer
 *                 example: 3
 *               averagePrice:
 *                 type: number
 *                 example: 250000
 *         seasonalityData:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               season:
 *                 type: string
 *                 example: "High Season"
 *               totalRevenue:
 *                 type: number
 *                 example: 9500000
 *               transactionCount:
 *                 type: integer
 *                 example: 600
 *               averageTransactionValue:
 *                 type: number
 *                 example: 15833
 *
 *     ProfitMarginAnalytics:
 *       type: object
 *       properties:
 *         overall:
 *           type: object
 *           properties:
 *             totalRevenue:
 *               type: number
 *               example: 15750000
 *             totalProfit:
 *               type: number
 *               example: 3150000
 *             profitMarginPercentage:
 *               type: number
 *               example: 20.0
 *             totalServiceCharges:
 *               type: number
 *               example: 787500
 *         byServiceType:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               serviceType:
 *                 type: string
 *                 example: "Flight"
 *               totalRevenue:
 *                 type: number
 *                 example: 8500000
 *               totalProfit:
 *                 type: number
 *                 example: 1700000
 *               profitMarginPercentage:
 *                 type: string
 *                 example: "20.00"
 *               transactionCount:
 *                 type: integer
 *                 example: 450
 *               averageProfit:
 *                 type: string
 *                 example: "3777.78"
 *               averageRevenue:
 *                 type: number
 *                 example: 18889
 *         performanceRanking:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               rank:
 *                 type: integer
 *                 example: 1
 *               serviceType:
 *                 type: string
 *                 example: "Insurance"
 *               profitMarginPercentage:
 *                 type: number
 *                 example: 25.0
 *               totalProfit:
 *                 type: number
 *                 example: 500000
 *               totalRevenue:
 *                 type: number
 *                 example: 2000000
 *
 *     RealTimeMetrics:
 *       type: object
 *       properties:
 *         today:
 *           type: object
 *           properties:
 *             todayRevenue:
 *               type: number
 *               description: Revenue generated today
 *               example: 125000
 *             todayTransactions:
 *               type: integer
 *               description: Number of transactions today
 *               example: 8
 *         total:
 *           type: object
 *           properties:
 *             totalRevenue:
 *               type: number
 *               description: All-time total revenue
 *               example: 50000000
 *             totalTransactions:
 *               type: integer
 *               description: All-time total transactions
 *               example: 5000
 *         recentTransactions:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               _id:
 *                 type: string
 *                 example: "60d5ec49f8c6a7001c8a1b30"
 *               itemType:
 *                 type: string
 *                 example: "Flight"
 *               totalAmountPaid:
 *                 type: number
 *                 example: 505000
 *               createdAt:
 *                 type: string
 *                 format: date-time
 *               transactionReference:
 *                 type: string
 *                 example: "TTP-FL-1678888888888"
 *         lastUpdated:
 *           type: string
 *           format: date-time
 *           description: Timestamp of last update
 *
 *     AffiliatePerformanceAnalytics:
 *       type: object
 *       properties:
 *         topAffiliates:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               affiliateName:
 *                 type: string
 *                 example: "Travel Partners Ltd"
 *               affiliateCode:
 *                 type: string
 *                 example: "TRAVEL-PARTNER-123"
 *               totalReferrals:
 *                 type: integer
 *                 example: 45
 *               totalBookingValue:
 *                 type: number
 *                 example: 2250000
 *               totalCommissionsEarned:
 *                 type: number
 *                 example: 125000
 *               averageBookingValue:
 *                 type: number
 *                 example: 50000
 *               convertedReferrals:
 *                 type: integer
 *                 example: 38
 *               conversionRate:
 *                 type: number
 *                 example: 84.44
 *               averageCommissionPerReferral:
 *                 type: number
 *                 example: 2778
 *         commissionStats:
 *           type: object
 *           properties:
 *             totalCommissions:
 *               type: number
 *               example: 500000
 *             totalApprovedCommissions:
 *               type: number
 *               example: 450000
 *             totalPendingCommissions:
 *               type: number
 *               example: 50000
 *             totalCommissionTransactions:
 *               type: integer
 *               example: 200
 *             averageCommissionAmount:
 *               type: number
 *               example: 2500
 *         commissionsByService:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               serviceType:
 *                 type: string
 *                 example: "Flight"
 *               totalCommissions:
 *                 type: number
 *                 example: 200000
 *               approvedCommissions:
 *                 type: number
 *                 example: 180000
 *               pendingCommissions:
 *                 type: number
 *                 example: 20000
 *               transactionCount:
 *                 type: integer
 *                 example: 80
 *               averageCommission:
 *                 type: number
 *                 example: 2500
 *
 *     AffiliateRevenueAnalytics:
 *       type: object
 *       properties:
 *         affiliateRevenue:
 *           type: object
 *           properties:
 *             totalAffiliateRevenue:
 *               type: number
 *               description: Total revenue generated through affiliate referrals
 *               example: 5000000
 *             totalAffiliateProfit:
 *               type: number
 *               description: Total profit from affiliate-generated bookings
 *               example: 1000000
 *             totalAffiliateBookings:
 *               type: integer
 *               description: Total bookings from affiliate referrals
 *               example: 250
 *             averageAffiliateBookingValue:
 *               type: number
 *               description: Average booking value from affiliates
 *               example: 20000
 *         totalRevenue:
 *           type: object
 *           properties:
 *             totalRevenue:
 *               type: number
 *               example: 15750000
 *             totalProfit:
 *               type: number
 *               example: 3150000
 *             totalBookings:
 *               type: integer
 *               example: 1250
 *         affiliateContribution:
 *           type: object
 *           properties:
 *             revenuePercentage:
 *               type: string
 *               description: Percentage of total revenue from affiliates
 *               example: "31.75"
 *             profitPercentage:
 *               type: string
 *               description: Percentage of total profit from affiliates
 *               example: "31.75"
 *             bookingPercentage:
 *               type: string
 *               description: Percentage of total bookings from affiliates
 *               example: "20.00"
 *         revenueByService:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               serviceType:
 *                 type: string
 *                 example: "Flight"
 *               revenue:
 *                 type: number
 *                 example: 2500000
 *               profit:
 *                 type: number
 *                 example: 500000
 *               bookingCount:
 *                 type: integer
 *                 example: 125
 *               averageBookingValue:
 *                 type: number
 *                 example: 20000
 *
 *     AffiliateConversionAnalytics:
 *       type: object
 *       properties:
 *         conversionData:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               affiliateName:
 *                 type: string
 *                 example: "Travel Partners Ltd"
 *               totalReferrals:
 *                 type: integer
 *                 example: 45
 *               convertedReferrals:
 *                 type: integer
 *                 example: 38
 *               totalBookings:
 *                 type: integer
 *                 example: 42
 *               totalValue:
 *                 type: number
 *                 example: 2100000
 *               conversionRate:
 *                 type: number
 *                 example: 84.44
 *               averageBookingsPerReferral:
 *                 type: number
 *                 example: 0.93
 *               averageValuePerReferral:
 *                 type: number
 *                 example: 46667
 *         overallMetrics:
 *           type: object
 *           properties:
 *             totalReferrals:
 *               type: integer
 *               example: 500
 *             totalConvertedReferrals:
 *               type: integer
 *               example: 380
 *             totalBookings:
 *               type: integer
 *               example: 420
 *             totalValue:
 *               type: number
 *               example: 21000000
 *             overallConversionRate:
 *               type: number
 *               example: 76.0
 *             averageBookingsPerReferral:
 *               type: number
 *               example: 0.84
 *             averageValuePerReferral:
 *               type: number
 *               example: 42000
 *             uniqueAffiliates:
 *               type: integer
 *               example: 25
 *
 *   parameters:
 *     DateRangeStartParam:
 *       in: query
 *       name: startDate
 *       schema:
 *         type: string
 *         format: date-time
 *       description: Start date for analytics period (ISO 8601 format)
 *       example: "2024-01-01T00:00:00.000Z"
 *     DateRangeEndParam:
 *       in: query
 *       name: endDate
 *       schema:
 *         type: string
 *         format: date-time
 *       description: End date for analytics period (ISO 8601 format)
 *       example: "2024-01-31T23:59:59.999Z"
 *     PeriodParam:
 *       in: query
 *       name: period
 *       schema:
 *         type: string
 *         enum: [7d, 30d, 90d, 1y]
 *       description: Predefined period for analytics (overrides startDate/endDate)
 *       example: "30d"
 *     ItemTypeParam:
 *       in: query
 *       name: itemType
 *       schema:
 *         type: string
 *         enum: [Flight, Hotel, Insurance, Visa, Package]
 *       description: Filter analytics by specific service type
 *       example: "Flight"
 *     CustomerSegmentParam:
 *       in: query
 *       name: segment
 *       schema:
 *         type: string
 *         enum: [Individual, Business, Group, Corporate]
 *       description: Filter analytics by customer segment
 *       example: "Individual"
 *     GroupByParam:
 *       in: query
 *       name: groupBy
 *       schema:
 *         type: string
 *         enum: [day, week, month, quarter, year]
 *         default: month
 *       description: Group analytics data by time period
 *       example: "month"
 *     AffiliateIdParam:
 *       in: query
 *       name: affiliateId
 *       schema:
 *         type: string
 *       description: Filter by specific affiliate ID
 *       example: "60d5ec49f8c6a7001c8a1b2c"
 *     LimitParam:
 *       in: query
 *       name: limit
 *       schema:
 *         type: integer
 *         minimum: 1
 *         maximum: 100
 *         default: 50
 *       description: Maximum number of items to return
 *       example: 50
 *
 * tags:
 *   - name: Analytics
 *     description: Business intelligence and analytics endpoints for revenue, customer behavior, and performance metrics
 *   - name: Real-time Analytics
 *     description: Real-time metrics and live data endpoints
 *   - name: Affiliate Analytics
 *     description: Analytics specific to affiliate performance and commission tracking
 */

module.exports = {
  // Analytics schemas and parameters are defined above in the OpenAPI comments
  // This module exports the documentation for integration with the main swagger configuration
};

/**
 * @openapi
 * /analytics/summary:
 *   get:
 *     summary: Get analytics summary with KPIs and period comparisons
 *     description: Retrieves comprehensive analytics summary including current period metrics, previous period comparison, percentage changes, and real-time data
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/DateRangeStartParam'
 *       - $ref: '#/components/parameters/DateRangeEndParam'
 *       - $ref: '#/components/parameters/PeriodParam'
 *       - $ref: '#/components/parameters/ItemTypeParam'
 *       - $ref: '#/components/parameters/CustomerSegmentParam'
 *     responses:
 *       200:
 *         description: Analytics summary retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Analytics summary retrieved successfully"
 *                 data:
 *                   $ref: '#/components/schemas/AnalyticsSummary'
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *
 * /analytics/dashboard:
 *   get:
 *     summary: Get comprehensive dashboard analytics
 *     description: Retrieves complete dashboard data including revenue, customer behavior, product performance, affiliate metrics, and trends
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/DateRangeStartParam'
 *       - $ref: '#/components/parameters/DateRangeEndParam'
 *       - $ref: '#/components/parameters/PeriodParam'
 *     responses:
 *       200:
 *         description: Dashboard analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Dashboard analytics retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     overview:
 *                       type: object
 *                       properties:
 *                         totalRevenue:
 *                           type: number
 *                           example: 15750000
 *                         totalProfit:
 *                           type: number
 *                           example: 3150000
 *                         totalTransactions:
 *                           type: integer
 *                           example: 1250
 *                         averageTransactionValue:
 *                           type: number
 *                           example: 12600
 *                         profitMarginPercentage:
 *                           type: number
 *                           example: 20.0
 *                     revenue:
 *                       $ref: '#/components/schemas/RevenueAnalytics'
 *                     customers:
 *                       $ref: '#/components/schemas/CustomerAnalytics'
 *                     products:
 *                       $ref: '#/components/schemas/ProductPerformanceAnalytics'
 *                     affiliates:
 *                       $ref: '#/components/schemas/AffiliatePerformanceAnalytics'
 *                     trends:
 *                       type: object
 *                       properties:
 *                         daily:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               date:
 *                                 type: string
 *                                 format: date
 *                               dailyRevenue:
 *                                 type: number
 *                               dailyProfit:
 *                                 type: number
 *                               transactionCount:
 *                                 type: integer
 *                               averageTransactionValue:
 *                                 type: number
 *                               profitMarginPercentage:
 *                                 type: number
 *                     generatedAt:
 *                       type: string
 *                       format: date-time
 *                     dateRange:
 *                       type: object
 *                       properties:
 *                         startDate:
 *                           type: string
 *                           format: date-time
 *                         endDate:
 *                           type: string
 *                           format: date-time
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *
 * /analytics/revenue:
 *   get:
 *     summary: Get revenue analytics with optional filtering
 *     description: Retrieves detailed revenue analytics including total revenue, profit margins, transaction counts, and breakdown by service type
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/DateRangeStartParam'
 *       - $ref: '#/components/parameters/DateRangeEndParam'
 *       - $ref: '#/components/parameters/ItemTypeParam'
 *       - $ref: '#/components/parameters/GroupByParam'
 *     responses:
 *       200:
 *         description: Revenue analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Revenue analytics retrieved successfully"
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/RevenueAnalytics'
 *                     - type: object
 *                       properties:
 *                         dateRange:
 *                           type: object
 *                           properties:
 *                             startDate:
 *                               type: string
 *                               format: date-time
 *                             endDate:
 *                               type: string
 *                               format: date-time
 *                         filters:
 *                           type: object
 *                           properties:
 *                             itemType:
 *                               type: string
 *                               example: "all"
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *
 * /analytics/revenue/trend:
 *   get:
 *     summary: Get daily revenue trend for specified date range
 *     description: Retrieves daily revenue trend data showing revenue, profit, and transaction patterns over time
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/DateRangeStartParam'
 *       - $ref: '#/components/parameters/DateRangeEndParam'
 *       - $ref: '#/components/parameters/ItemTypeParam'
 *     responses:
 *       200:
 *         description: Revenue trend retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Revenue trend data retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     trend:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                             format: date
 *                             example: "2024-01-15"
 *                           dailyRevenue:
 *                             type: number
 *                             example: 125000
 *                           dailyProfit:
 *                             type: number
 *                             example: 25000
 *                           transactionCount:
 *                             type: integer
 *                             example: 8
 *                           averageTransactionValue:
 *                             type: number
 *                             example: 15625
 *                           profitMarginPercentage:
 *                             type: number
 *                             example: 20.0
 *                     dateRange:
 *                       type: object
 *                       properties:
 *                         startDate:
 *                           type: string
 *                           format: date-time
 *                         endDate:
 *                           type: string
 *                           format: date-time
 *                     totalDataPoints:
 *                       type: integer
 *                       example: 30
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *
 * /analytics/customers:
 *   get:
 *     summary: Get customer behavior analytics
 *     description: Retrieves comprehensive customer analytics including segmentation, booking channels, and customer lifecycle metrics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/DateRangeStartParam'
 *       - $ref: '#/components/parameters/DateRangeEndParam'
 *       - $ref: '#/components/parameters/CustomerSegmentParam'
 *     responses:
 *       200:
 *         description: Customer analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Customer analytics retrieved successfully"
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/CustomerAnalytics'
 *                     - type: object
 *                       properties:
 *                         dateRange:
 *                           type: object
 *                           properties:
 *                             startDate:
 *                               type: string
 *                               format: date-time
 *                             endDate:
 *                               type: string
 *                               format: date-time
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *
 * /analytics/products:
 *   get:
 *     summary: Get product performance analytics
 *     description: Retrieves detailed product performance metrics including service type analysis, package performance, and seasonality data
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/DateRangeStartParam'
 *       - $ref: '#/components/parameters/DateRangeEndParam'
 *       - $ref: '#/components/parameters/ItemTypeParam'
 *     responses:
 *       200:
 *         description: Product analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Product analytics retrieved successfully"
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/ProductPerformanceAnalytics'
 *                     - type: object
 *                       properties:
 *                         dateRange:
 *                           type: object
 *                           properties:
 *                             startDate:
 *                               type: string
 *                               format: date-time
 *                             endDate:
 *                               type: string
 *                               format: date-time
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *
 * /analytics/profit-margins:
 *   get:
 *     summary: Get detailed profit margin analysis by service type
 *     description: Retrieves comprehensive profit margin analytics including overall margins, service type breakdown, and performance ranking
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/DateRangeStartParam'
 *       - $ref: '#/components/parameters/DateRangeEndParam'
 *       - $ref: '#/components/parameters/ItemTypeParam'
 *     responses:
 *       200:
 *         description: Profit margin analysis retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Profit margin analysis retrieved successfully"
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/ProfitMarginAnalytics'
 *                     - type: object
 *                       properties:
 *                         dateRange:
 *                           type: object
 *                           properties:
 *                             startDate:
 *                               type: string
 *                               format: date-time
 *                             endDate:
 *                               type: string
 *                               format: date-time
 *                         filters:
 *                           type: object
 *                           properties:
 *                             itemType:
 *                               type: string
 *                               example: "all"
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *//**
 
* @openapi
 * /analytics/realtime:
 *   get:
 *     summary: Get real-time metrics (not cached)
 *     description: Retrieves current real-time system metrics including today's performance, total system stats, and recent transactions
 *     tags: [Real-time Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Real-time metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Real-time metrics retrieved successfully"
 *                 data:
 *                   $ref: '#/components/schemas/RealTimeMetrics'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *
 * /analytics/realtime/transactions:
 *   get:
 *     summary: Get real-time transaction stream (last 24 hours)
 *     description: Retrieves the most recent transactions from the last 24 hours for real-time monitoring
 *     tags: [Real-time Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/LimitParam'
 *     responses:
 *       200:
 *         description: Real-time transactions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Real-time transactions retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     transactions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: "60d5ec49f8c6a7001c8a1b30"
 *                           itemType:
 *                             type: string
 *                             example: "Flight"
 *                           totalAmountPaid:
 *                             type: number
 *                             example: 505000
 *                           profitMargin:
 *                             type: number
 *                             example: 25000
 *                           transactionReference:
 *                             type: string
 *                             example: "TTP-FL-1678888888888"
 *                           customerSegment:
 *                             type: string
 *                             example: "Individual"
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                     count:
 *                       type: integer
 *                       description: Number of transactions returned
 *                       example: 15
 *                     timeRange:
 *                       type: string
 *                       description: Time range covered
 *                       example: "24 hours"
 *                     lastUpdated:
 *                       type: string
 *                       format: date-time
 *                       description: Timestamp of data retrieval
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *
 * /analytics/realtime/kpis:
 *   get:
 *     summary: Get real-time key performance indicators
 *     description: Retrieves current KPIs including today's and this week's performance metrics
 *     tags: [Real-time Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Real-time KPIs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Real-time KPIs retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     today:
 *                       type: object
 *                       properties:
 *                         revenue:
 *                           type: number
 *                           description: Today's revenue
 *                           example: 125000
 *                         transactions:
 *                           type: integer
 *                           description: Today's transaction count
 *                           example: 8
 *                         profit:
 *                           type: number
 *                           description: Today's profit
 *                           example: 25000
 *                     thisWeek:
 *                       type: object
 *                       properties:
 *                         revenue:
 *                           type: number
 *                           description: This week's revenue
 *                           example: 875000
 *                         transactions:
 *                           type: integer
 *                           description: This week's transaction count
 *                           example: 56
 *                         profit:
 *                           type: number
 *                           description: This week's profit
 *                           example: 175000
 *                     lastUpdated:
 *                       type: string
 *                       format: date-time
 *                       description: Timestamp of last update
 *                       example: "2024-01-15T14:30:00Z"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *//*
*
 * @openapi
 * /analytics/affiliates/performance:
 *   get:
 *     summary: Get affiliate performance analytics
 *     description: Retrieves comprehensive affiliate performance metrics including top performers, commission statistics, and service-wise breakdown
 *     tags: [Affiliate Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/DateRangeStartParam'
 *       - $ref: '#/components/parameters/DateRangeEndParam'
 *       - $ref: '#/components/parameters/AffiliateIdParam'
 *     responses:
 *       200:
 *         description: Affiliate performance analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Affiliate performance analytics retrieved successfully"
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/AffiliatePerformanceAnalytics'
 *                     - type: object
 *                       properties:
 *                         dateRange:
 *                           type: object
 *                           properties:
 *                             startDate:
 *                               type: string
 *                               format: date-time
 *                             endDate:
 *                               type: string
 *                               format: date-time
 *                         filters:
 *                           type: object
 *                           properties:
 *                             affiliateId:
 *                               type: string
 *                               example: "all"
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *
 * /analytics/affiliates/revenue:
 *   get:
 *     summary: Get affiliate revenue analytics
 *     description: Retrieves revenue analytics specifically for affiliate-generated bookings, including contribution percentages and service breakdown
 *     tags: [Affiliate Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/DateRangeStartParam'
 *       - $ref: '#/components/parameters/DateRangeEndParam'
 *     responses:
 *       200:
 *         description: Affiliate revenue analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Affiliate revenue analytics retrieved successfully"
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/AffiliateRevenueAnalytics'
 *                     - type: object
 *                       properties:
 *                         dateRange:
 *                           type: object
 *                           properties:
 *                             startDate:
 *                               type: string
 *                               format: date-time
 *                             endDate:
 *                               type: string
 *                               format: date-time
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *
 * /analytics/affiliates/conversions:
 *   get:
 *     summary: Get affiliate conversion rate and referral performance metrics
 *     description: Retrieves detailed conversion analytics including conversion rates, referral performance, and overall affiliate effectiveness metrics
 *     tags: [Affiliate Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/DateRangeStartParam'
 *       - $ref: '#/components/parameters/DateRangeEndParam'
 *     responses:
 *       200:
 *         description: Affiliate conversion analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Affiliate conversion analytics retrieved successfully"
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/AffiliateConversionAnalytics'
 *                     - type: object
 *                       properties:
 *                         dateRange:
 *                           type: object
 *                           properties:
 *                             startDate:
 *                               type: string
 *                               format: date-time
 *                             endDate:
 *                               type: string
 *                               format: date-time
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *
 * /analytics/affiliates/dashboard:
 *   get:
 *     summary: Get comprehensive affiliate dashboard analytics
 *     description: Retrieves complete affiliate dashboard data combining performance, revenue, and conversion metrics in a single response
 *     tags: [Affiliate Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/DateRangeStartParam'
 *       - $ref: '#/components/parameters/DateRangeEndParam'
 *       - $ref: '#/components/parameters/PeriodParam'
 *     responses:
 *       200:
 *         description: Affiliate dashboard analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Affiliate dashboard analytics retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     performance:
 *                       $ref: '#/components/schemas/AffiliatePerformanceAnalytics'
 *                     revenue:
 *                       $ref: '#/components/schemas/AffiliateRevenueAnalytics'
 *                     conversions:
 *                       $ref: '#/components/schemas/AffiliateConversionAnalytics'
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalAffiliates:
 *                           type: integer
 *                           example: 25
 *                         activeAffiliates:
 *                           type: integer
 *                           example: 20
 *                         totalCommissionsPaid:
 *                           type: number
 *                           example: 450000
 *                         averageCommissionRate:
 *                           type: number
 *                           example: 3.5
 *                         topPerformingService:
 *                           type: string
 *                           example: "Flight"
 *                     dateRange:
 *                       type: object
 *                       properties:
 *                         startDate:
 *                           type: string
 *                           format: date-time
 *                         endDate:
 *                           type: string
 *                           format: date-time
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *
 * /analytics/cache:
 *   delete:
 *     summary: Clear analytics cache
 *     description: Clears analytics cache for improved performance and data freshness. Requires Executive+ role access.
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [revenue, customer, product, affiliate, general, all]
 *         description: Specific cache category to clear (optional, defaults to all)
 *         example: "revenue"
 *     responses:
 *       200:
 *         description: Analytics cache cleared successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Analytics cache cleared successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     deletedCount:
 *                       type: integer
 *                       description: Number of cache entries deleted
 *                       example: 15
 *                     category:
 *                       type: string
 *                       description: Cache category that was cleared
 *                       example: "all"
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */