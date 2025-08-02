// v1/docs/notification-api-documentation.js
// Comprehensive OpenAPI documentation for affiliate notification system endpoints

/**
 * @openapi
 * components:
 *   schemas:
 *     # Notification Preference Schemas
 *     NotificationPreferences:
 *       type: object
 *       properties:
 *         email:
 *           type: boolean
 *           description: Enable email notifications for commission earnings, withdrawals, and account updates
 *           example: true
 *           default: true
 *         sms:
 *           type: boolean
 *           description: Enable SMS notifications for important updates and alerts
 *           example: false
 *           default: false
 *         monthlyStatements:
 *           type: boolean
 *           description: Enable monthly performance statement emails
 *           example: true
 *           default: true
 *     
 *     NotificationPreferencesUpdateRequest:
 *       type: object
 *       properties:
 *         email:
 *           type: boolean
 *           description: Enable or disable email notifications
 *           example: true
 *         sms:
 *           type: boolean
 *           description: Enable or disable SMS notifications
 *           example: false
 *         monthlyStatements:
 *           type: boolean
 *           description: Enable or disable monthly statement emails
 *           example: true
 *       additionalProperties: false
 *     
 *     # Monthly Statement Schemas
 *     MonthlyStatement:
 *       type: object
 *       properties:
 *         affiliateId:
 *           type: string
 *           description: Affiliate record ID
 *           example: "60d5ec49f8c6a7001c8a1b2c"
 *         affiliateName:
 *           type: string
 *           description: Business name of the affiliate
 *           example: "Travel Partners Ltd"
 *         month:
 *           type: string
 *           description: Month name for the statement period
 *           example: "January"
 *         year:
 *           type: integer
 *           description: Year for the statement period
 *           example: 2024
 *           minimum: 2020
 *           maximum: 2030
 *         totalReferrals:
 *           type: integer
 *           description: Total number of referrals made during the period
 *           example: 25
 *           minimum: 0
 *         successfulBookings:
 *           type: integer
 *           description: Number of referrals that converted to successful bookings
 *           example: 18
 *           minimum: 0
 *         totalCommissions:
 *           type: number
 *           description: Total commission amount earned during the period
 *           example: 45000.00
 *           minimum: 0
 *         totalWithdrawals:
 *           type: number
 *           description: Total amount withdrawn during the period
 *           example: 30000.00
 *           minimum: 0
 *         currentBalance:
 *           type: number
 *           description: Current wallet balance at the end of the period
 *           example: 85000.25
 *           minimum: 0
 *         commissionsByService:
 *           type: object
 *           description: Breakdown of commissions by service type
 *           properties:
 *             flights:
 *               type: number
 *               description: Commission earned from flight bookings
 *               example: 25000.00
 *               minimum: 0
 *             hotels:
 *               type: number
 *               description: Commission earned from hotel bookings
 *               example: 12000.00
 *               minimum: 0
 *             insurance:
 *               type: number
 *               description: Commission earned from insurance sales
 *               example: 5000.00
 *               minimum: 0
 *             visa:
 *               type: number
 *               description: Commission earned from visa services
 *               example: 3000.00
 *               minimum: 0
 *         commissionTransactions:
 *           type: array
 *           description: List of commission transactions during the period
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 description: Commission transaction ID
 *                 example: "60d5ec49f8c6a7001c8a1b34"
 *               bookingReference:
 *                 type: string
 *                 description: Related booking reference
 *                 example: "TTP-FL-1678888888888"
 *               serviceType:
 *                 type: string
 *                 enum: [flight, hotel, insurance, visa]
 *                 description: Type of service booked
 *                 example: "flight"
 *               amount:
 *                 type: number
 *                 description: Commission amount earned
 *                 example: 2500.00
 *                 minimum: 0
 *               status:
 *                 type: string
 *                 enum: [pending, approved, paid, disputed]
 *                 description: Commission transaction status
 *                 example: "paid"
 *               date:
 *                 type: string
 *                 format: date-time
 *                 description: Transaction date
 *                 example: "2024-01-15T14:30:00Z"
 *         withdrawalTransactions:
 *           type: array
 *           description: List of withdrawal transactions during the period
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 description: Withdrawal transaction ID
 *                 example: "60d5ec49f8c6a7001c8a1b33"
 *               amount:
 *                 type: number
 *                 description: Withdrawal amount
 *                 example: 50000.00
 *                 minimum: 0
 *               status:
 *                 type: string
 *                 enum: [pending, processing, completed, failed, cancelled]
 *                 description: Withdrawal status
 *                 example: "completed"
 *               date:
 *                 type: string
 *                 format: date-time
 *                 description: Withdrawal date
 *                 example: "2024-01-20T10:15:00Z"
 *     
 *     AvailableStatementMonth:
 *       type: object
 *       properties:
 *         year:
 *           type: integer
 *           description: Statement year
 *           example: 2024
 *           minimum: 2020
 *           maximum: 2030
 *         month:
 *           type: integer
 *           description: Statement month (1-12)
 *           example: 1
 *           minimum: 1
 *           maximum: 12
 *         monthName:
 *           type: string
 *           description: Human-readable month name
 *           example: "January"
 *     
 *     MonthlyStatementRequest:
 *       type: object
 *       required:
 *         - year
 *         - month
 *       properties:
 *         year:
 *           type: integer
 *           description: Year for the statement (YYYY format)
 *           example: 2024
 *           minimum: 2020
 *           maximum: 2030
 *         month:
 *           type: integer
 *           description: Month for the statement (1-12)
 *           example: 1
 *           minimum: 1
 *           maximum: 12
 *     
 *     BulkStatementResults:
 *       type: object
 *       properties:
 *         total:
 *           type: integer
 *           description: Total number of affiliates processed
 *           example: 150
 *           minimum: 0
 *         sent:
 *           type: integer
 *           description: Number of statements successfully sent
 *           example: 145
 *           minimum: 0
 *         failed:
 *           type: integer
 *           description: Number of statements that failed to send
 *           example: 5
 *           minimum: 0
 *         errors:
 *           type: array
 *           description: Details of failed statement deliveries
 *           items:
 *             type: object
 *             properties:
 *               affiliateId:
 *                 type: string
 *                 description: ID of affiliate where statement failed
 *                 example: "60d5ec49f8c6a7001c8a1b2c"
 *               error:
 *                 type: string
 *                 description: Error message describing the failure
 *                 example: "Email delivery failed: invalid email address"
 *     
 *     # Error Schemas
 *     NotificationError:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           description: Human-readable error message
 *           example: "Notification operation failed"
 *         errorCode:
 *           type: string
 *           description: Machine-readable error code
 *           example: "NOTIFICATION_ERROR"
 *           enum:
 *             - "NOTIFICATION_PREFERENCES_NOT_FOUND"
 *             - "NOTIFICATION_PREFERENCES_VALIDATION_ERROR"
 *             - "MONTHLY_STATEMENT_NOT_FOUND"
 *             - "MONTHLY_STATEMENT_GENERATION_ERROR"
 *             - "BULK_NOTIFICATION_ERROR"
 *             - "NOTIFICATION_DELIVERY_ERROR"
 *         errors:
 *           type: array
 *           description: Detailed error information (for validation errors)
 *           items:
 *             type: object
 *             properties:
 *               field:
 *                 type: string
 *                 description: Field that caused the error
 *                 example: "email"
 *               message:
 *                 type: string
 *                 description: Field-specific error message
 *                 example: "Email preference must be a boolean value"
 *               code:
 *                 type: string
 *                 description: Field-specific error code
 *                 example: "INVALID_TYPE"
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: When the error occurred
 *           example: "2024-01-15T14:30:00Z"
 *         requestId:
 *           type: string
 *           description: Unique request identifier for debugging
 *           example: "req_abc123def456"
 */

/**
 * @openapi
 * /api/v1/affiliate-notifications/{affiliateId}/preferences:
 *   get:
 *     summary: Get notification preferences for an affiliate
 *     description: Retrieve the current notification preferences for an affiliate, including email, SMS, and monthly statement preferences. These preferences control which types of notifications the affiliate receives for commission earnings, withdrawals, account status changes, and monthly performance statements.
 *     tags: [Affiliate Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: affiliateId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: "^[0-9a-fA-F]{24}$"
 *         description: Unique identifier for the affiliate account
 *         example: "60d5ec49f8c6a7001c8a1b2c"
 *     responses:
 *       200:
 *         description: Notification preferences retrieved successfully
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
 *                   example: "Notification preferences retrieved successfully"
 *                 data:
 *                   $ref: '#/components/schemas/NotificationPreferences'
 *             examples:
 *               default_preferences:
 *                 summary: Default notification preferences
 *                 description: Default preferences for a new affiliate
 *                 value:
 *                   success: true
 *                   message: "Notification preferences retrieved successfully"
 *                   data:
 *                     email: true
 *                     sms: false
 *                     monthlyStatements: true
 *               custom_preferences:
 *                 summary: Custom notification preferences
 *                 description: Customized preferences set by affiliate
 *                 value:
 *                   success: true
 *                   message: "Notification preferences retrieved successfully"
 *                   data:
 *                     email: true
 *                     sms: true
 *                     monthlyStatements: false
 *       400:
 *         description: Bad request - invalid affiliate ID format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotificationError'
 *             examples:
 *               invalid_affiliate_id:
 *                 summary: Invalid affiliate ID format
 *                 value:
 *                   success: false
 *                   message: "Affiliate ID is required"
 *                   errorCode: "NOTIFICATION_PREFERENCES_VALIDATION_ERROR"
 *                   timestamp: "2024-01-15T14:30:00Z"
 *       401:
 *         description: Unauthorized - authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthenticationError'
 *       403:
 *         description: Forbidden - insufficient permissions to access affiliate preferences
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthorizationError'
 *       404:
 *         description: Affiliate not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotificationError'
 *             examples:
 *               affiliate_not_found:
 *                 summary: Affiliate account not found
 *                 value:
 *                   success: false
 *                   message: "Affiliate not found"
 *                   errorCode: "NOTIFICATION_PREFERENCES_NOT_FOUND"
 *                   timestamp: "2024-01-15T14:30:00Z"
 *       429:
 *         description: Too many requests - rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RateLimitError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ServerError'
 *   
 *   put:
 *     summary: Update notification preferences for an affiliate
 *     description: Update the notification preferences for an affiliate account. This endpoint allows affiliates to control which types of notifications they receive, including email notifications for commission earnings and withdrawals, SMS alerts for important updates, and monthly performance statement emails. All preference fields are optional in the request body.
 *     tags: [Affiliate Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: affiliateId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: "^[0-9a-fA-F]{24}$"
 *         description: Unique identifier for the affiliate account
 *         example: "60d5ec49f8c6a7001c8a1b2c"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NotificationPreferencesUpdateRequest'
 *           examples:
 *             enable_all:
 *               summary: Enable all notifications
 *               description: Enable email, SMS, and monthly statements
 *               value:
 *                 email: true
 *                 sms: true
 *                 monthlyStatements: true
 *             email_only:
 *               summary: Email notifications only
 *               description: Enable only email notifications, disable SMS
 *               value:
 *                 email: true
 *                 sms: false
 *                 monthlyStatements: true
 *             minimal_notifications:
 *               summary: Minimal notifications
 *               description: Disable all optional notifications
 *               value:
 *                 email: false
 *                 sms: false
 *                 monthlyStatements: false
 *             partial_update:
 *               summary: Partial preference update
 *               description: Update only specific preferences
 *               value:
 *                 sms: true
 *     responses:
 *       200:
 *         description: Notification preferences updated successfully
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
 *                   example: "Notification preferences updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/NotificationPreferences'
 *             examples:
 *               successful_update:
 *                 summary: Successful preference update
 *                 value:
 *                   success: true
 *                   message: "Notification preferences updated successfully"
 *                   data:
 *                     email: true
 *                     sms: true
 *                     monthlyStatements: true
 *       400:
 *         description: Bad request - validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotificationError'
 *             examples:
 *               validation_error:
 *                 summary: Validation error example
 *                 value:
 *                   success: false
 *                   message: "Validation failed"
 *                   errorCode: "NOTIFICATION_PREFERENCES_VALIDATION_ERROR"
 *                   errors:
 *                     - field: "email"
 *                       message: "Preference 'email' must be a boolean value"
 *                       code: "INVALID_TYPE"
 *                   timestamp: "2024-01-15T14:30:00Z"
 *               invalid_keys:
 *                 summary: Invalid preference keys
 *                 value:
 *                   success: false
 *                   message: "Invalid preference keys: push, desktop"
 *                   errorCode: "NOTIFICATION_PREFERENCES_VALIDATION_ERROR"
 *                   timestamp: "2024-01-15T14:30:00Z"
 *       401:
 *         description: Unauthorized - authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthenticationError'
 *       403:
 *         description: Forbidden - insufficient permissions to update affiliate preferences
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthorizationError'
 *       404:
 *         description: Affiliate not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotificationError'
 *       429:
 *         description: Too many requests - rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RateLimitError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ServerError'
 */

/**
 * @openapi
 * /api/v1/affiliate-notifications/{affiliateId}/statements:
 *   get:
 *     summary: Get monthly statement for an affiliate
 *     description: Retrieve a detailed monthly performance statement for an affiliate, including commission earnings, withdrawal history, referral statistics, and service-wise breakdown. The statement provides comprehensive insights into affiliate performance for a specific month and year, including transaction details and current wallet balance.
 *     tags: [Monthly Statements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: affiliateId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: "^[0-9a-fA-F]{24}$"
 *         description: Unique identifier for the affiliate account
 *         example: "60d5ec49f8c6a7001c8a1b2c"
 *       - in: query
 *         name: year
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 2020
 *           maximum: 2030
 *         description: Year for the statement (YYYY format)
 *         example: 2024
 *       - in: query
 *         name: month
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *         description: Month for the statement (1-12)
 *         example: 1
 *     responses:
 *       200:
 *         description: Monthly statement retrieved successfully
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
 *                   example: "Monthly statement retrieved successfully"
 *                 data:
 *                   $ref: '#/components/schemas/MonthlyStatement'
 *             examples:
 *               successful_statement:
 *                 summary: Complete monthly statement
 *                 description: Example of a complete monthly statement with transactions
 *                 value:
 *                   success: true
 *                   message: "Monthly statement retrieved successfully"
 *                   data:
 *                     affiliateId: "60d5ec49f8c6a7001c8a1b2c"
 *                     affiliateName: "Travel Partners Ltd"
 *                     month: "January"
 *                     year: 2024
 *                     totalReferrals: 25
 *                     successfulBookings: 18
 *                     totalCommissions: 45000.00
 *                     totalWithdrawals: 30000.00
 *                     currentBalance: 85000.25
 *                     commissionsByService:
 *                       flights: 25000.00
 *                       hotels: 12000.00
 *                       insurance: 5000.00
 *                       visa: 3000.00
 *                     commissionTransactions:
 *                       - id: "60d5ec49f8c6a7001c8a1b34"
 *                         bookingReference: "TTP-FL-1678888888888"
 *                         serviceType: "flight"
 *                         amount: 2500.00
 *                         status: "paid"
 *                         date: "2024-01-15T14:30:00Z"
 *                     withdrawalTransactions:
 *                       - id: "60d5ec49f8c6a7001c8a1b33"
 *                         amount: 30000.00
 *                         status: "completed"
 *                         date: "2024-01-20T10:15:00Z"
 *               empty_statement:
 *                 summary: Statement with no activity
 *                 description: Example of a statement for a month with no activity
 *                 value:
 *                   success: true
 *                   message: "Monthly statement retrieved successfully"
 *                   data:
 *                     affiliateId: "60d5ec49f8c6a7001c8a1b2c"
 *                     affiliateName: "Travel Partners Ltd"
 *                     month: "February"
 *                     year: 2024
 *                     totalReferrals: 0
 *                     successfulBookings: 0
 *                     totalCommissions: 0.00
 *                     totalWithdrawals: 0.00
 *                     currentBalance: 85000.25
 *                     commissionsByService:
 *                       flights: 0.00
 *                       hotels: 0.00
 *                       insurance: 0.00
 *                       visa: 0.00
 *                     commissionTransactions: []
 *                     withdrawalTransactions: []
 *       400:
 *         description: Bad request - missing or invalid parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotificationError'
 *             examples:
 *               missing_parameters:
 *                 summary: Missing required parameters
 *                 value:
 *                   success: false
 *                   message: "Year and month are required"
 *                   errorCode: "MONTHLY_STATEMENT_VALIDATION_ERROR"
 *                   timestamp: "2024-01-15T14:30:00Z"
 *               invalid_date:
 *                 summary: Invalid year or month format
 *                 value:
 *                   success: false
 *                   message: "Invalid year or month format"
 *                   errorCode: "MONTHLY_STATEMENT_VALIDATION_ERROR"
 *                   timestamp: "2024-01-15T14:30:00Z"
 *       401:
 *         description: Unauthorized - authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthenticationError'
 *       403:
 *         description: Forbidden - insufficient permissions to access affiliate statements
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthorizationError'
 *       404:
 *         description: Affiliate not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotificationError'
 *       429:
 *         description: Too many requests - rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RateLimitError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ServerError'
 */

/**
 * @openapi
 * /api/v1/affiliate-notifications/{affiliateId}/statements/available:
 *   get:
 *     summary: Get available statement months for an affiliate
 *     description: Retrieve a list of all available months for which monthly statements can be generated for an affiliate. This endpoint returns months from the affiliate's first commission transaction to the current month, allowing users to know which statements are available for viewing or download.
 *     tags: [Monthly Statements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: affiliateId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: "^[0-9a-fA-F]{24}$"
 *         description: Unique identifier for the affiliate account
 *         example: "60d5ec49f8c6a7001c8a1b2c"
 *     responses:
 *       200:
 *         description: Available statement months retrieved successfully
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
 *                   example: "Available statement months retrieved successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AvailableStatementMonth'
 *             examples:
 *               available_months:
 *                 summary: List of available statement months
 *                 description: Example showing available months for an active affiliate
 *                 value:
 *                   success: true
 *                   message: "Available statement months retrieved successfully"
 *                   data:
 *                     - year: 2024
 *                       month: 3
 *                       monthName: "March"
 *                     - year: 2024
 *                       month: 2
 *                       monthName: "February"
 *                     - year: 2024
 *                       month: 1
 *                       monthName: "January"
 *                     - year: 2023
 *                       month: 12
 *                       monthName: "December"
 *               no_statements:
 *                 summary: No statements available
 *                 description: Example for a new affiliate with no commission history
 *                 value:
 *                   success: true
 *                   message: "Available statement months retrieved successfully"
 *                   data: []
 *       400:
 *         description: Bad request - invalid affiliate ID format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotificationError'
 *       401:
 *         description: Unauthorized - authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthenticationError'
 *       403:
 *         description: Forbidden - insufficient permissions to access affiliate statements
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthorizationError'
 *       404:
 *         description: Affiliate not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotificationError'
 *       429:
 *         description: Too many requests - rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RateLimitError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ServerError'
 */

/**
 * @openapi
 * /api/v1/affiliate-notifications/{affiliateId}/statements/send:
 *   post:
 *     summary: Send monthly statement manually (admin only)
 *     description: Manually trigger the generation and delivery of a monthly statement for a specific affiliate. This admin-only endpoint allows administrators to resend statements or generate statements for specific months outside of the automated monthly process. The statement will be sent via email if the affiliate has email notifications enabled.
 *     tags: [Monthly Statements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: affiliateId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: "^[0-9a-fA-F]{24}$"
 *         description: Unique identifier for the affiliate account
 *         example: "60d5ec49f8c6a7001c8a1b2c"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MonthlyStatementRequest'
 *           examples:
 *             current_month:
 *               summary: Send current month statement
 *               description: Generate and send statement for the current month
 *               value:
 *                 year: 2024
 *                 month: 3
 *             previous_month:
 *               summary: Send previous month statement
 *               description: Resend statement for a previous month
 *               value:
 *                 year: 2024
 *                 month: 2
 *     responses:
 *       200:
 *         description: Monthly statement sent successfully
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
 *                   example: "Monthly statement sent successfully"
 *                 data:
 *                   $ref: '#/components/schemas/MonthlyStatement'
 *             examples:
 *               statement_sent:
 *                 summary: Statement sent successfully
 *                 value:
 *                   success: true
 *                   message: "Monthly statement sent successfully"
 *                   data:
 *                     affiliateId: "60d5ec49f8c6a7001c8a1b2c"
 *                     affiliateName: "Travel Partners Ltd"
 *                     month: "March"
 *                     year: 2024
 *                     totalReferrals: 25
 *                     successfulBookings: 18
 *                     totalCommissions: 45000.00
 *                     totalWithdrawals: 30000.00
 *                     currentBalance: 85000.25
 *       400:
 *         description: Bad request - missing or invalid parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotificationError'
 *             examples:
 *               missing_parameters:
 *                 summary: Missing required parameters
 *                 value:
 *                   success: false
 *                   message: "Year and month are required"
 *                   errorCode: "MONTHLY_STATEMENT_VALIDATION_ERROR"
 *                   timestamp: "2024-01-15T14:30:00Z"
 *       401:
 *         description: Unauthorized - authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthenticationError'
 *       403:
 *         description: Forbidden - admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthorizationError'
 *             examples:
 *               insufficient_permissions:
 *                 summary: Admin access required
 *                 value:
 *                   success: false
 *                   message: "Admin access required"
 *                   errorCode: "INSUFFICIENT_PERMISSIONS"
 *                   timestamp: "2024-01-15T14:30:00Z"
 *       404:
 *         description: Affiliate not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotificationError'
 *       429:
 *         description: Too many requests - rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RateLimitError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ServerError'
 */

/**
 * @openapi
 * /api/v1/affiliate-notifications/statements/send-all:
 *   post:
 *     summary: Send monthly statements to all affiliates (admin only)
 *     description: Bulk operation to generate and send monthly statements to all active affiliates for a specified month and year. This admin-only endpoint is typically used for automated monthly statement distribution or to resend statements for a specific period. The operation processes all active affiliates and returns a summary of successful and failed deliveries.
 *     tags: [Bulk Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MonthlyStatementRequest'
 *           examples:
 *             monthly_batch:
 *               summary: Send statements for all affiliates
 *               description: Generate and send statements for all active affiliates for a specific month
 *               value:
 *                 year: 2024
 *                 month: 2
 *             year_end_batch:
 *               summary: Year-end statement batch
 *               description: Send December statements for year-end processing
 *               value:
 *                 year: 2023
 *                 month: 12
 *     responses:
 *       200:
 *         description: Bulk statement operation completed
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
 *                   example: "Monthly statements processed: 145 sent, 5 failed"
 *                 data:
 *                   $ref: '#/components/schemas/BulkStatementResults'
 *             examples:
 *               successful_batch:
 *                 summary: Successful bulk operation
 *                 description: Most statements sent successfully with few failures
 *                 value:
 *                   success: true
 *                   message: "Monthly statements processed: 145 sent, 5 failed"
 *                   data:
 *                     total: 150
 *                     sent: 145
 *                     failed: 5
 *                     errors:
 *                       - affiliateId: "60d5ec49f8c6a7001c8a1b2c"
 *                         error: "Email delivery failed: invalid email address"
 *                       - affiliateId: "60d5ec49f8c6a7001c8a1b2d"
 *                         error: "Affiliate account suspended"
 *               all_successful:
 *                 summary: All statements sent successfully
 *                 description: Perfect batch with no failures
 *                 value:
 *                   success: true
 *                   message: "Monthly statements processed: 150 sent, 0 failed"
 *                   data:
 *                     total: 150
 *                     sent: 150
 *                     failed: 0
 *                     errors: []
 *               partial_failure:
 *                 summary: Batch with significant failures
 *                 description: Batch operation with multiple failures
 *                 value:
 *                   success: true
 *                   message: "Monthly statements processed: 120 sent, 30 failed"
 *                   data:
 *                     total: 150
 *                     sent: 120
 *                     failed: 30
 *                     errors:
 *                       - affiliateId: "60d5ec49f8c6a7001c8a1b2c"
 *                         error: "Email service temporarily unavailable"
 *                       - affiliateId: "60d5ec49f8c6a7001c8a1b2d"
 *                         error: "Statement generation failed: no commission data"
 *       400:
 *         description: Bad request - missing or invalid parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotificationError'
 *             examples:
 *               missing_parameters:
 *                 summary: Missing required parameters
 *                 value:
 *                   success: false
 *                   message: "Year and month are required"
 *                   errorCode: "BULK_NOTIFICATION_ERROR"
 *                   timestamp: "2024-01-15T14:30:00Z"
 *               invalid_date:
 *                 summary: Invalid date parameters
 *                 value:
 *                   success: false
 *                   message: "Invalid year or month format"
 *                   errorCode: "BULK_NOTIFICATION_ERROR"
 *                   timestamp: "2024-01-15T14:30:00Z"
 *       401:
 *         description: Unauthorized - authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthenticationError'
 *       403:
 *         description: Forbidden - admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthorizationError'
 *             examples:
 *               insufficient_permissions:
 *                 summary: Admin access required
 *                 value:
 *                   success: false
 *                   message: "Admin access required for bulk operations"
 *                   errorCode: "INSUFFICIENT_PERMISSIONS"
 *                   timestamp: "2024-01-15T14:30:00Z"
 *       429:
 *         description: Too many requests - rate limit exceeded for bulk operations
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RateLimitError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ServerError'
 *             examples:
 *               bulk_operation_failure:
 *                 summary: Bulk operation system failure
 *                 value:
 *                   success: false
 *                   message: "Failed to send monthly statements"
 *                   errorCode: "BULK_NOTIFICATION_ERROR"
 *                   timestamp: "2024-01-15T14:30:00Z"
 */

module.exports = {};