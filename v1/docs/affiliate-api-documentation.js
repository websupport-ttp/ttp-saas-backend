// v1/docs/affiliate-api-documentation.js
// Comprehensive OpenAPI documentation for affiliate marketing system endpoints

/**
 * @openapi
 * components:
 *   schemas:
 *     # Affiliate Schemas
 *     Affiliate:
 *       type: object
 *       required:
 *         - userId
 *         - businessName
 *         - businessEmail
 *         - businessPhone
 *         - businessAddress
 *         - affiliateId
 *         - referralCode
 *         - status
 *       properties:
 *         _id:
 *           type: string
 *           description: Affiliate record ID
 *           example: "60d5ec49f8c6a7001c8a1b2c"
 *         userId:
 *           type: string
 *           description: Reference to User model
 *           example: "60d5ec49f8c6a7001c8a1b2d"
 *         businessName:
 *           type: string
 *           description: Business name
 *           example: "Travel Partners Ltd"
 *           maxLength: 100
 *         businessEmail:
 *           type: string
 *           format: email
 *           description: Business email address
 *           example: "partners@travelpartners.com"
 *         businessPhone:
 *           type: string
 *           description: Business phone number (E.164 format)
 *           example: "+2348012345678"
 *           pattern: "^\\+?[1-9]\\d{1,14}$"
 *         businessAddress:
 *           type: object
 *           properties:
 *             street:
 *               type: string
 *               example: "123 Business Street"
 *             city:
 *               type: string
 *               example: "Lagos"
 *             state:
 *               type: string
 *               example: "Lagos State"
 *             country:
 *               type: string
 *               example: "Nigeria"
 *             postalCode:
 *               type: string
 *               example: "100001"
 *         affiliateId:
 *           type: string
 *           description: Unique affiliate identifier
 *           example: "AFF-001234"
 *         referralCode:
 *           type: string
 *           description: Unique referral code
 *           example: "TRAVEL-PARTNER-123"
 *         status:
 *           type: string
 *           enum: [pending, active, suspended, inactive]
 *           description: Affiliate account status
 *           example: "active"
 *         commissionRates:
 *           type: object
 *           properties:
 *             flights:
 *               type: number
 *               description: Flight commission rate (percentage)
 *               example: 2.5
 *               minimum: 0
 *               maximum: 100
 *             hotels:
 *               type: number
 *               description: Hotel commission rate (percentage)
 *               example: 3.0
 *               minimum: 0
 *               maximum: 100
 *             insurance:
 *               type: number
 *               description: Insurance commission rate (percentage)
 *               example: 5.0
 *               minimum: 0
 *               maximum: 100
 *             visa:
 *               type: number
 *               description: Visa commission rate (percentage)
 *               example: 10.0
 *               minimum: 0
 *               maximum: 100
 *         qrCode:
 *           type: object
 *           properties:
 *             data:
 *               type: string
 *               description: Base64 encoded QR code image
 *               example: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
 *             url:
 *               type: string
 *               description: QR code access URL
 *               example: "https://api.travelplace.com/qr/affiliate/AFF-001234"
 *             metadata:
 *               type: object
 *               description: Additional QR code information
 *         totalReferrals:
 *           type: integer
 *           description: Total number of referrals
 *           example: 150
 *           minimum: 0
 *         totalCommissionsEarned:
 *           type: number
 *           description: Total commissions earned
 *           example: 125000.50
 *           minimum: 0
 *         approvedBy:
 *           type: string
 *           description: Admin who approved the affiliate
 *           example: "60d5ec49f8c6a7001c8a1b2e"
 *         approvedAt:
 *           type: string
 *           format: date-time
 *           description: Approval timestamp
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *     
 *     AffiliateRegistrationRequest:
 *       type: object
 *       required:
 *         - businessName
 *         - businessEmail
 *         - businessPhone
 *         - businessAddress
 *       properties:
 *         businessName:
 *           type: string
 *           minLength: 2
 *           maxLength: 100
 *           example: "Travel Partners Ltd"
 *         businessEmail:
 *           type: string
 *           format: email
 *           example: "partners@travelpartners.com"
 *         businessPhone:
 *           type: string
 *           pattern: "^\\+?[1-9]\\d{1,14}$"
 *           example: "+2348012345678"
 *         businessAddress:
 *           type: object
 *           required:
 *             - street
 *             - city
 *             - state
 *             - country
 *           properties:
 *             street:
 *               type: string
 *               minLength: 5
 *               example: "123 Business Street"
 *             city:
 *               type: string
 *               minLength: 2
 *               example: "Lagos"
 *             state:
 *               type: string
 *               minLength: 2
 *               example: "Lagos State"
 *             country:
 *               type: string
 *               minLength: 2
 *               example: "Nigeria"
 *               default: "Nigeria"
 *             postalCode:
 *               type: string
 *               example: "100001"
 *     
 *     AffiliateStats:
 *       type: object
 *       properties:
 *         totalReferrals:
 *           type: integer
 *           example: 150
 *         totalCommissions:
 *           type: number
 *           example: 125000.50
 *         pendingCommissions:
 *           type: number
 *           example: 15000.00
 *         approvedCommissions:
 *           type: number
 *           example: 110000.50
 *         walletBalance:
 *           type: number
 *           example: 85000.25
 *         totalWithdrawals:
 *           type: number
 *           example: 40000.25
 *         conversionRate:
 *           type: number
 *           description: Referral to booking conversion rate (percentage)
 *           example: 12.5
 *         averageCommissionPerReferral:
 *           type: number
 *           example: 833.33
 *         topPerformingServices:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               serviceType:
 *                 type: string
 *                 example: "flights"
 *               referrals:
 *                 type: integer
 *                 example: 75
 *               commissions:
 *                 type: number
 *                 example: 62500.00
 *         monthlyPerformance:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               month:
 *                 type: string
 *                 example: "2024-01"
 *               referrals:
 *                 type: integer
 *                 example: 25
 *               commissions:
 *                 type: number
 *                 example: 20000.00
 *         dateRange:
 *           type: object
 *           properties:
 *             startDate:
 *               type: string
 *               format: date-time
 *               example: "2024-01-01T00:00:00.000Z"
 *             endDate:
 *               type: string
 *               format: date-time
 *               example: "2024-12-31T23:59:59.999Z"
 *     
 *     # Wallet Schemas
 *     Wallet:
 *       type: object
 *       required:
 *         - affiliateId
 *         - balance
 *         - currency
 *         - status
 *       properties:
 *         _id:
 *           type: string
 *           description: Wallet ID
 *           example: "60d5ec49f8c6a7001c8a1b30"
 *         affiliateId:
 *           type: string
 *           description: Reference to Affiliate
 *           example: "60d5ec49f8c6a7001c8a1b2c"
 *         balance:
 *           type: number
 *           description: Current available balance
 *           example: 85000.25
 *           minimum: 0
 *         totalEarned:
 *           type: number
 *           description: Lifetime earnings
 *           example: 125000.50
 *           minimum: 0
 *         totalWithdrawn:
 *           type: number
 *           description: Lifetime withdrawals
 *           example: 40000.25
 *           minimum: 0
 *         currency:
 *           type: string
 *           description: Currency code
 *           example: "NGN"
 *           default: "NGN"
 *         status:
 *           type: string
 *           enum: [active, frozen, suspended]
 *           description: Wallet status
 *           example: "active"
 *         bankDetails:
 *           type: object
 *           properties:
 *             accountName:
 *               type: string
 *               example: "Travel Partners Ltd"
 *             accountNumber:
 *               type: string
 *               pattern: "^\\d{10}$"
 *               example: "0123456789"
 *             bankCode:
 *               type: string
 *               pattern: "^\\d{3}$"
 *               example: "044"
 *             bankName:
 *               type: string
 *               example: "Access Bank"
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     
 *     WalletTransaction:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: "60d5ec49f8c6a7001c8a1b31"
 *         walletId:
 *           type: string
 *           example: "60d5ec49f8c6a7001c8a1b30"
 *         affiliateId:
 *           type: string
 *           example: "60d5ec49f8c6a7001c8a1b2c"
 *         type:
 *           type: string
 *           enum: [commission_credit, withdrawal_debit, adjustment_credit, adjustment_debit, refund_credit]
 *           example: "commission_credit"
 *         amount:
 *           type: number
 *           example: 2500.00
 *         balanceBefore:
 *           type: number
 *           example: 82500.25
 *         balanceAfter:
 *           type: number
 *           example: 85000.25
 *         reference:
 *           type: string
 *           description: Transaction reference
 *           example: "COMM-TXN-1678888888888"
 *         relatedId:
 *           type: string
 *           description: Related record ID (commission, withdrawal, etc.)
 *           example: "60d5ec49f8c6a7001c8a1b32"
 *         description:
 *           type: string
 *           example: "Commission from flight booking TTP-FL-1678888888888"
 *         status:
 *           type: string
 *           enum: [pending, completed, failed, reversed]
 *           example: "completed"
 *         metadata:
 *           type: object
 *           description: Additional transaction metadata
 *         createdAt:
 *           type: string
 *           format: date-time
 *     
 *     WithdrawalRequest:
 *       type: object
 *       required:
 *         - amount
 *         - bankDetails
 *       properties:
 *         amount:
 *           type: number
 *           minimum: 100
 *           maximum: 1000000
 *           example: 50000.00
 *         bankDetails:
 *           type: object
 *           required:
 *             - accountName
 *             - accountNumber
 *             - bankCode
 *             - bankName
 *           properties:
 *             accountName:
 *               type: string
 *               minLength: 2
 *               maxLength: 100
 *               example: "Travel Partners Ltd"
 *             accountNumber:
 *               type: string
 *               pattern: "^\\d{10}$"
 *               example: "0123456789"
 *             bankCode:
 *               type: string
 *               pattern: "^\\d{3}$"
 *               example: "044"
 *             bankName:
 *               type: string
 *               minLength: 2
 *               maxLength: 100
 *               example: "Access Bank"
 *     
 *     Withdrawal:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: "60d5ec49f8c6a7001c8a1b33"
 *         affiliateId:
 *           type: string
 *           example: "60d5ec49f8c6a7001c8a1b2c"
 *         walletId:
 *           type: string
 *           example: "60d5ec49f8c6a7001c8a1b30"
 *         amount:
 *           type: number
 *           example: 50000.00
 *         currency:
 *           type: string
 *           example: "NGN"
 *         bankDetails:
 *           type: object
 *           description: Snapshot of bank details at withdrawal time
 *         paystackReference:
 *           type: string
 *           description: Paystack transfer reference
 *           example: "TRF_abc123def456"
 *         status:
 *           type: string
 *           enum: [pending, processing, completed, failed, cancelled]
 *           example: "completed"
 *         qrCode:
 *           type: object
 *           properties:
 *             data:
 *               type: string
 *               description: Base64 encoded QR code
 *             url:
 *               type: string
 *               description: QR code access URL
 *             metadata:
 *               type: object
 *         processedAt:
 *           type: string
 *           format: date-time
 *         failureReason:
 *           type: string
 *           example: "Insufficient funds in source account"
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     
 *     # Commission Schemas
 *     CommissionTransaction:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: "60d5ec49f8c6a7001c8a1b34"
 *         affiliateId:
 *           type: string
 *           example: "60d5ec49f8c6a7001c8a1b2c"
 *         referralId:
 *           type: string
 *           example: "60d5ec49f8c6a7001c8a1b35"
 *         bookingReference:
 *           type: string
 *           example: "TTP-FL-1678888888888"
 *         serviceType:
 *           type: string
 *           enum: [flight, hotel, insurance, visa]
 *           example: "flight"
 *         bookingAmount:
 *           type: number
 *           example: 100000.00
 *         commissionRate:
 *           type: number
 *           description: Rate applied (percentage)
 *           example: 2.5
 *         commissionAmount:
 *           type: number
 *           example: 2500.00
 *         status:
 *           type: string
 *           enum: [pending, approved, paid, disputed]
 *           example: "paid"
 *         qrCode:
 *           type: object
 *           properties:
 *             data:
 *               type: string
 *             url:
 *               type: string
 *             metadata:
 *               type: object
 *         processedAt:
 *           type: string
 *           format: date-time
 *         createdAt:
 *           type: string
 *           format: date-time
 *     
 *     # Referral Schemas
 *     Referral:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: "60d5ec49f8c6a7001c8a1b35"
 *         affiliateId:
 *           type: string
 *           example: "60d5ec49f8c6a7001c8a1b2c"
 *         customerId:
 *           type: string
 *           example: "60d5ec49f8c6a7001c8a1b36"
 *         referralCode:
 *           type: string
 *           example: "TRAVEL-PARTNER-123"
 *         referralSource:
 *           type: string
 *           enum: [qr_code, link, manual]
 *           example: "qr_code"
 *         ipAddress:
 *           type: string
 *           example: "192.168.1.1"
 *         userAgent:
 *           type: string
 *           example: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
 *         firstBookingAt:
 *           type: string
 *           format: date-time
 *         totalBookings:
 *           type: integer
 *           example: 3
 *         totalValue:
 *           type: number
 *           description: Total value of bookings from this referral
 *           example: 250000.00
 *         status:
 *           type: string
 *           enum: [active, converted, inactive]
 *           example: "converted"
 *         createdAt:
 *           type: string
 *           format: date-time
 *     
 *     # QR Code Schemas
 *     QRCodeData:
 *       type: object
 *       properties:
 *         type:
 *           type: string
 *           enum: [affiliate, commission, withdrawal, referral]
 *           example: "affiliate"
 *         id:
 *           type: string
 *           description: Related record ID
 *           example: "60d5ec49f8c6a7001c8a1b2c"
 *         timestamp:
 *           type: string
 *           format: date-time
 *         metadata:
 *           type: object
 *           properties:
 *             affiliateId:
 *               type: string
 *               example: "AFF-001234"
 *             amount:
 *               type: number
 *               description: For commission/withdrawal QRs
 *               example: 2500.00
 *             referralCode:
 *               type: string
 *               description: For referral QRs
 *               example: "TRAVEL-PARTNER-123"
 *             expiresAt:
 *               type: string
 *               format: date-time
 *               description: For time-sensitive QRs
 *         url:
 *           type: string
 *           description: Deep link URL for mobile apps
 *           example: "https://app.travelplace.com/referral/TRAVEL-PARTNER-123"
 *     
 *     # Error Schemas
 *     AffiliateError:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: "Affiliate registration failed"
 *         errorCode:
 *           type: string
 *           example: "AFFILIATE_ERROR"
 *         errors:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               field:
 *                 type: string
 *                 example: "businessEmail"
 *               message:
 *                 type: string
 *                 example: "Business email already exists"
 *         timestamp:
 *           type: string
 *           format: date-time
 *     
 *     WalletError:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: "Insufficient wallet balance"
 *         errorCode:
 *           type: string
 *           example: "WALLET_ERROR"
 *         errors:
 *           type: array
 *           items:
 *             type: object
 *         timestamp:
 *           type: string
 *           format: date-time
 *     
 *     CommissionError:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: "Commission calculation failed"
 *         errorCode:
 *           type: string
 *           example: "COMMISSION_ERROR"
 *         errors:
 *           type: array
 *           items:
 *             type: object
 *         timestamp:
 *           type: string
 *           format: date-time
 */

/**
 * @openapi
 * /affiliates/validate-referral/{referralCode}:
 *   get:
 *     summary: Validate referral code
 *     description: Validates if a referral code exists and is active
 *     tags: [Affiliates]
 *     parameters:
 *       - in: path
 *         name: referralCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Referral code to validate
 *         example: "TRAVEL-PARTNER-123"
 *     responses:
 *       200:
 *         description: Referral code validation result
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
 *                   example: "Referral code is valid"
 *                 data:
 *                   type: object
 *                   properties:
 *                     isValid:
 *                       type: boolean
 *                       example: true
 *                     affiliate:
 *                       type: object
 *                       properties:
 *                         affiliateId:
 *                           type: string
 *                           example: "AFF-001234"
 *                         businessName:
 *                           type: string
 *                           example: "Travel Partners Ltd"
 *                         status:
 *                           type: string
 *                           example: "active"
 *       400:
 *         description: Invalid referral code
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 *       404:
 *         description: Referral code not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 * 
 * /affiliates/register:
 *   post:
 *     summary: Register as affiliate partner
 *     description: Submit application to become an affiliate partner
 *     tags: [Affiliates]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AffiliateRegistrationRequest'
 *     responses:
 *       201:
 *         description: Affiliate registration submitted successfully
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
 *                   example: "Affiliate registration submitted successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Affiliate'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 *       409:
 *         description: User already has affiliate account
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 * 
 * /affiliates/me:
 *   get:
 *     summary: Get current user's affiliate account
 *     description: Retrieve affiliate account information for authenticated user
 *     tags: [Affiliates]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Affiliate account information
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
 *                   example: "Affiliate account retrieved successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Affiliate'
 *       404:
 *         description: No affiliate account found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 * 
 * /affiliates/{affiliateId}/referral-link:
 *   get:
 *     summary: Generate referral link
 *     description: Generate a referral link for the affiliate
 *     tags: [Affiliates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: affiliateId
 *         required: true
 *         schema:
 *           type: string
 *         description: Affiliate ID
 *         example: "60d5ec49f8c6a7001c8a1b2c"
 *     responses:
 *       200:
 *         description: Referral link generated successfully
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
 *                   example: "Referral link generated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     referralLink:
 *                       type: string
 *                       example: "https://travelplace.com/book?ref=TRAVEL-PARTNER-123"
 *                     referralCode:
 *                       type: string
 *                       example: "TRAVEL-PARTNER-123"
 *                     qrCode:
 *                       type: string
 *                       description: Base64 encoded QR code
 *                       example: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
 *       403:
 *         description: Unauthorized access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 *       404:
 *         description: Affiliate not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 * 
 * /affiliates/{affiliateId}/stats:
 *   get:
 *     summary: Get affiliate statistics and performance metrics
 *     description: Retrieve comprehensive performance statistics, analytics, and metrics for an affiliate including referral performance, commission earnings, conversion rates, and trending data
 *     tags: [Affiliate Statistics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: affiliateId
 *         required: true
 *         schema:
 *           type: string
 *         description: Affiliate ID
 *         example: "60d5ec49f8c6a7001c8a1b2c"
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for statistics period
 *         example: "2024-01-01T00:00:00.000Z"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for statistics period
 *         example: "2024-12-31T23:59:59.999Z"
 *       - in: query
 *         name: includePerformanceMetrics
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include detailed performance analytics
 *         example: true
 *       - in: query
 *         name: includeMonthlyBreakdown
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include month-by-month performance breakdown
 *         example: false
 *     responses:
 *       200:
 *         description: Affiliate statistics and performance metrics retrieved successfully
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
 *                   example: "Affiliate statistics retrieved successfully"
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/AffiliateStats'
 *                     - type: object
 *                       properties:
 *                         performanceMetrics:
 *                           type: object
 *                           properties:
 *                             clickThroughRate:
 *                               type: number
 *                               description: CTR percentage for referral links
 *                               example: 15.5
 *                             averageOrderValue:
 *                               type: number
 *                               description: Average booking value from referrals
 *                               example: 85000.00
 *                             customerRetentionRate:
 *                               type: number
 *                               description: Percentage of repeat customers
 *                               example: 35.2
 *                             topReferralSources:
 *                               type: array
 *                               items:
 *                                 type: object
 *                                 properties:
 *                                   source:
 *                                     type: string
 *                                     example: "qr_code"
 *                                   referrals:
 *                                     type: integer
 *                                     example: 45
 *                                   conversions:
 *                                     type: integer
 *                                     example: 38
 *                         trends:
 *                           type: object
 *                           properties:
 *                             referralGrowth:
 *                               type: number
 *                               description: Month-over-month referral growth percentage
 *                               example: 12.5
 *                             commissionGrowth:
 *                               type: number
 *                               description: Month-over-month commission growth percentage
 *                               example: 18.3
 *       403:
 *         description: Unauthorized access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 *       404:
 *         description: Affiliate not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 * 
 * /affiliates/{affiliateId}/dashboard/wallet:
 *   get:
 *     summary: Get affiliate wallet information
 *     description: Retrieve wallet balance and summary for affiliate dashboard
 *     tags: [Affiliate Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: affiliateId
 *         required: true
 *         schema:
 *           type: string
 *         description: Affiliate ID
 *         example: "60d5ec49f8c6a7001c8a1b2c"
 *     responses:
 *       200:
 *         description: Wallet information retrieved successfully
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
 *                   example: "Wallet information retrieved successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Wallet'
 *       403:
 *         description: Unauthorized access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletError'
 *       404:
 *         description: Wallet not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletError'
 * 
 * /affiliates/{affiliateId}/dashboard/wallet/transactions:
 *   get:
 *     summary: Get wallet transaction history
 *     description: Retrieve paginated wallet transaction history for affiliate dashboard
 *     tags: [Affiliate Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: affiliateId
 *         required: true
 *         schema:
 *           type: string
 *         description: Affiliate ID
 *         example: "60d5ec49f8c6a7001c8a1b2c"
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [commission_credit, withdrawal_debit, adjustment_credit, adjustment_debit, refund_credit]
 *         description: Filter by transaction type
 *       - $ref: '#/components/parameters/DateRangeStartParam'
 *       - $ref: '#/components/parameters/DateRangeEndParam'
 *     responses:
 *       200:
 *         description: Transaction history retrieved successfully
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
 *                   example: "Transaction history retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     transactions:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/WalletTransaction'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *       403:
 *         description: Unauthorized access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletError'
 * 
 * /affiliates/{affiliateId}/dashboard/commissions:
 *   get:
 *     summary: Get commission history
 *     description: Retrieve commission transaction history for affiliate dashboard
 *     tags: [Affiliate Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: affiliateId
 *         required: true
 *         schema:
 *           type: string
 *         description: Affiliate ID
 *         example: "60d5ec49f8c6a7001c8a1b2c"
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, paid, disputed]
 *         description: Filter by commission status
 *       - in: query
 *         name: serviceType
 *         schema:
 *           type: string
 *           enum: [flight, hotel, insurance, visa]
 *         description: Filter by service type
 *       - $ref: '#/components/parameters/DateRangeStartParam'
 *       - $ref: '#/components/parameters/DateRangeEndParam'
 *     responses:
 *       200:
 *         description: Commission history retrieved successfully
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
 *                   example: "Commission history retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     commissions:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/CommissionTransaction'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalCommissions:
 *                           type: number
 *                           example: 125000.50
 *                         pendingCommissions:
 *                           type: number
 *                           example: 15000.00
 *                         paidCommissions:
 *                           type: number
 *                           example: 110000.50
 *       403:
 *         description: Unauthorized access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommissionError'
 * 
 * /affiliates/{affiliateId}/dashboard/referrals:
 *   get:
 *     summary: Get referral history
 *     description: Retrieve referral tracking information for affiliate dashboard
 *     tags: [Affiliate Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: affiliateId
 *         required: true
 *         schema:
 *           type: string
 *         description: Affiliate ID
 *         example: "60d5ec49f8c6a7001c8a1b2c"
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, converted, inactive]
 *         description: Filter by referral status
 *       - in: query
 *         name: source
 *         schema:
 *           type: string
 *           enum: [qr_code, link, manual]
 *         description: Filter by referral source
 *       - $ref: '#/components/parameters/DateRangeStartParam'
 *       - $ref: '#/components/parameters/DateRangeEndParam'
 *     responses:
 *       200:
 *         description: Referral history retrieved successfully
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
 *                   example: "Referral history retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     referrals:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Referral'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalReferrals:
 *                           type: integer
 *                           example: 150
 *                         convertedReferrals:
 *                           type: integer
 *                           example: 45
 *                         conversionRate:
 *                           type: number
 *                           example: 30.0
 *       403:
 *         description: Unauthorized access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 * 
 * /affiliates/{affiliateId}/dashboard/withdrawals:
 *   get:
 *     summary: Get withdrawal history
 *     description: Retrieve withdrawal history for affiliate dashboard
 *     tags: [Affiliate Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: affiliateId
 *         required: true
 *         schema:
 *           type: string
 *         description: Affiliate ID
 *         example: "60d5ec49f8c6a7001c8a1b2c"
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, processing, completed, failed, cancelled]
 *         description: Filter by withdrawal status
 *       - $ref: '#/components/parameters/DateRangeStartParam'
 *       - $ref: '#/components/parameters/DateRangeEndParam'
 *     responses:
 *       200:
 *         description: Withdrawal history retrieved successfully
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
 *                   example: "Withdrawal history retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     withdrawals:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Withdrawal'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalWithdrawals:
 *                           type: number
 *                           example: 40000.25
 *                         pendingWithdrawals:
 *                           type: number
 *                           example: 5000.00
 *                         completedWithdrawals:
 *                           type: number
 *                           example: 35000.25
 *       403:
 *         description: Unauthorized access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletError'
 *   post:
 *     summary: Request withdrawal
 *     description: Submit a withdrawal request from affiliate wallet
 *     tags: [Affiliate Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: affiliateId
 *         required: true
 *         schema:
 *           type: string
 *         description: Affiliate ID
 *         example: "60d5ec49f8c6a7001c8a1b2c"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WithdrawalRequest'
 *     responses:
 *       201:
 *         description: Withdrawal request submitted successfully
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
 *                   example: "Withdrawal request submitted successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Withdrawal'
 *       400:
 *         description: Validation error or insufficient balance
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletError'
 *       403:
 *         description: Unauthorized access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletError'
 * 
 * /affiliates/{affiliateId}/dashboard/qr-codes:
 *   get:
 *     summary: Get QR codes for affiliate
 *     description: Retrieve all QR codes associated with affiliate account
 *     tags: [Affiliate Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: affiliateId
 *         required: true
 *         schema:
 *           type: string
 *         description: Affiliate ID
 *         example: "60d5ec49f8c6a7001c8a1b2c"
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [affiliate, commission, withdrawal, referral]
 *         description: Filter by QR code type
 *     responses:
 *       200:
 *         description: QR codes retrieved successfully
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
 *                   example: "QR codes retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     qrCodes:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/QRCodeData'
 *                     affiliateQR:
 *                       type: object
 *                       properties:
 *                         data:
 *                           type: string
 *                           description: Base64 encoded QR code
 *                         url:
 *                           type: string
 *                           description: QR code access URL
 *       403:
 *         description: Unauthorized access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 */

/**
 * @openapi
 * /affiliates:
 *   get:
 *     summary: Get all affiliates (Admin only)
 *     description: Retrieve paginated list of all affiliate accounts with filtering options
 *     tags: [Admin - Affiliates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, active, suspended, inactive]
 *         description: Filter by affiliate status
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, approvedAt, businessName, totalReferrals, totalCommissionsEarned]
 *         description: Sort field
 *         default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Sort order
 *         default: desc
 *     responses:
 *       200:
 *         description: Affiliates retrieved successfully
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
 *                   example: "Affiliates retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     affiliates:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Affiliate'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalAffiliates:
 *                           type: integer
 *                           example: 250
 *                         activeAffiliates:
 *                           type: integer
 *                           example: 180
 *                         pendingAffiliates:
 *                           type: integer
 *                           example: 45
 *                         suspendedAffiliates:
 *                           type: integer
 *                           example: 25
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 * 
 * /affiliates/{affiliateId}/approve:
 *   patch:
 *     summary: Approve affiliate account (Admin only)
 *     description: Approve a pending affiliate account and activate it
 *     tags: [Admin - Affiliates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: affiliateId
 *         required: true
 *         schema:
 *           type: string
 *         description: Affiliate ID to approve
 *         example: "60d5ec49f8c6a7001c8a1b2c"
 *     responses:
 *       200:
 *         description: Affiliate approved successfully
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
 *                   example: "Affiliate approved successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Affiliate'
 *       400:
 *         description: Affiliate cannot be approved (already approved, suspended, etc.)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 *       404:
 *         description: Affiliate not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 * 
 * /affiliates/{affiliateId}/suspend:
 *   patch:
 *     summary: Suspend affiliate account (Admin only)
 *     description: Suspend an active affiliate account with reason
 *     tags: [Admin - Affiliates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: affiliateId
 *         required: true
 *         schema:
 *           type: string
 *         description: Affiliate ID to suspend
 *         example: "60d5ec49f8c6a7001c8a1b2c"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 500
 *                 description: Reason for suspension
 *                 example: "Fraudulent activity detected in referral patterns"
 *     responses:
 *       200:
 *         description: Affiliate suspended successfully
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
 *                   example: "Affiliate suspended successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Affiliate'
 *       400:
 *         description: Validation error or affiliate cannot be suspended
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 *       404:
 *         description: Affiliate not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 * 
 * /affiliates/{affiliateId}/reactivate:
 *   patch:
 *     summary: Reactivate affiliate account (Admin only)
 *     description: Reactivate a suspended or inactive affiliate account
 *     tags: [Admin - Affiliates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: affiliateId
 *         required: true
 *         schema:
 *           type: string
 *         description: Affiliate ID to reactivate
 *         example: "60d5ec49f8c6a7001c8a1b2c"
 *     responses:
 *       200:
 *         description: Affiliate reactivated successfully
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
 *                   example: "Affiliate reactivated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Affiliate'
 *       400:
 *         description: Affiliate cannot be reactivated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 *       404:
 *         description: Affiliate not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 * 
 * /affiliates/{affiliateId}/commission-rates:
 *   patch:
 *     summary: Update commission rates (Admin only)
 *     description: Update commission rates for specific affiliate
 *     tags: [Admin - Affiliates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: affiliateId
 *         required: true
 *         schema:
 *           type: string
 *         description: Affiliate ID
 *         example: "60d5ec49f8c6a7001c8a1b2c"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rates
 *             properties:
 *               rates:
 *                 type: object
 *                 properties:
 *                   flights:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 100
 *                     example: 2.5
 *                   hotels:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 100
 *                     example: 3.0
 *                   insurance:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 100
 *                     example: 5.0
 *                   visa:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 100
 *                     example: 10.0
 *                 description: At least one commission rate must be provided
 *     responses:
 *       200:
 *         description: Commission rates updated successfully
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
 *                   example: "Commission rates updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Affiliate'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 *       404:
 *         description: Affiliate not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 * 
 * /affiliates/health:
 *   get:
 *     summary: Get affiliate system health (Admin only)
 *     description: Check the health status of the affiliate system
 *     tags: [Admin - System]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System health status
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
 *                   example: "Affiliate system health check completed"
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [healthy, degraded, unhealthy]
 *                       example: "healthy"
 *                     services:
 *                       type: object
 *                       properties:
 *                         database:
 *                           type: object
 *                           properties:
 *                             status:
 *                               type: string
 *                               example: "healthy"
 *                             responseTime:
 *                               type: number
 *                               example: 15
 *                         qrCodeService:
 *                           type: object
 *                           properties:
 *                             status:
 *                               type: string
 *                               example: "healthy"
 *                             responseTime:
 *                               type: number
 *                               example: 25
 *                         paymentService:
 *                           type: object
 *                           properties:
 *                             status:
 *                               type: string
 *                               example: "healthy"
 *                             responseTime:
 *                               type: number
 *                               example: 120
 *                     metrics:
 *                       type: object
 *                       properties:
 *                         totalAffiliates:
 *                           type: integer
 *                           example: 250
 *                         activeAffiliates:
 *                           type: integer
 *                           example: 180
 *                         totalCommissions:
 *                           type: number
 *                           example: 2500000.00
 *                         pendingWithdrawals:
 *                           type: number
 *                           example: 150000.00
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 * 
 * /affiliates/health-check:
 *   post:
 *     summary: Perform comprehensive health check (Admin only)
 *     description: Run comprehensive health check on affiliate system
 *     tags: [Admin - System]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Health check completed
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
 *                   example: "Comprehensive health check completed"
 *                 data:
 *                   type: object
 *                   properties:
 *                     overallHealth:
 *                       type: string
 *                       example: "healthy"
 *                     checks:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                             example: "Database Connectivity"
 *                           status:
 *                             type: string
 *                             example: "passed"
 *                           duration:
 *                             type: number
 *                             example: 15
 *                           details:
 *                             type: string
 *                             example: "All database operations functioning normally"
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 * 
 * /affiliates/reset-service:
 *   post:
 *     summary: Reset affiliate service (Admin only)
 *     description: Reset affiliate service components (use with caution)
 *     tags: [Admin - System]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Service reset completed
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
 *                   example: "Affiliate service reset completed"
 *                 data:
 *                   type: object
 *                   properties:
 *                     resetComponents:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["cache", "qr-codes", "statistics"]
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 */

/**
 * @op
enapi
 * /wallets:
 *   post:
 *     summary: Create wallet (Admin only)
 *     description: Create a new wallet for an affiliate
 *     tags: [Admin - Wallets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - affiliateId
 *             properties:
 *               affiliateId:
 *                 type: string
 *                 description: Affiliate ID to create wallet for
 *                 example: "60d5ec49f8c6a7001c8a1b2c"
 *               currency:
 *                 type: string
 *                 description: Wallet currency
 *                 example: "NGN"
 *                 default: "NGN"
 *     responses:
 *       201:
 *         description: Wallet created successfully
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
 *                   example: "Wallet created successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Wallet'
 *       400:
 *         description: Validation error or wallet already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletError'
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletError'
 * 
 * /wallets/{affiliateId}/balance:
 *   get:
 *     summary: Get wallet balance
 *     description: Retrieve wallet balance and summary information
 *     tags: [Wallets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: affiliateId
 *         required: true
 *         schema:
 *           type: string
 *         description: Affiliate ID
 *         example: "60d5ec49f8c6a7001c8a1b2c"
 *     responses:
 *       200:
 *         description: Wallet balance retrieved successfully
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
 *                   example: "Wallet balance retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     balance:
 *                       type: number
 *                       example: 85000.25
 *                     totalEarned:
 *                       type: number
 *                       example: 125000.50
 *                     totalWithdrawn:
 *                       type: number
 *                       example: 40000.25
 *                     currency:
 *                       type: string
 *                       example: "NGN"
 *                     status:
 *                       type: string
 *                       example: "active"
 *                     lastTransaction:
 *                       type: object
 *                       properties:
 *                         type:
 *                           type: string
 *                           example: "commission_credit"
 *                         amount:
 *                           type: number
 *                           example: 2500.00
 *                         createdAt:
 *                           type: string
 *                           format: date-time
 *       403:
 *         description: Unauthorized access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletError'
 *       404:
 *         description: Wallet not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletError'
 * 
 * /wallets/{affiliateId}/credit:
 *   post:
 *     summary: Credit wallet (Admin only)
 *     description: Add funds to affiliate wallet
 *     tags: [Admin - Wallets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: affiliateId
 *         required: true
 *         schema:
 *           type: string
 *         description: Affiliate ID
 *         example: "60d5ec49f8c6a7001c8a1b2c"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - reference
 *             properties:
 *               amount:
 *                 type: number
 *                 minimum: 0.01
 *                 example: 5000.00
 *               reference:
 *                 type: string
 *                 description: Transaction reference
 *                 example: "ADMIN-CREDIT-1678888888888"
 *               description:
 *                 type: string
 *                 description: Credit description
 *                 example: "Manual credit adjustment"
 *               metadata:
 *                 type: object
 *                 description: Additional transaction metadata
 *     responses:
 *       200:
 *         description: Wallet credited successfully
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
 *                   example: "Wallet credited successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     transaction:
 *                       $ref: '#/components/schemas/WalletTransaction'
 *                     newBalance:
 *                       type: number
 *                       example: 90000.25
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletError'
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletError'
 *       404:
 *         description: Wallet not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletError'
 * 
 * /wallets/{affiliateId}/debit:
 *   post:
 *     summary: Debit wallet (Admin only)
 *     description: Deduct funds from affiliate wallet
 *     tags: [Admin - Wallets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: affiliateId
 *         required: true
 *         schema:
 *           type: string
 *         description: Affiliate ID
 *         example: "60d5ec49f8c6a7001c8a1b2c"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - reference
 *             properties:
 *               amount:
 *                 type: number
 *                 minimum: 0.01
 *                 example: 2000.00
 *               reference:
 *                 type: string
 *                 description: Transaction reference
 *                 example: "ADMIN-DEBIT-1678888888888"
 *               description:
 *                 type: string
 *                 description: Debit description
 *                 example: "Manual debit adjustment"
 *               metadata:
 *                 type: object
 *                 description: Additional transaction metadata
 *     responses:
 *       200:
 *         description: Wallet debited successfully
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
 *                   example: "Wallet debited successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     transaction:
 *                       $ref: '#/components/schemas/WalletTransaction'
 *                     newBalance:
 *                       type: number
 *                       example: 83000.25
 *       400:
 *         description: Validation error or insufficient balance
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletError'
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletError'
 *       404:
 *         description: Wallet not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletError'
 * 
 * /wallets/{affiliateId}/transactions:
 *   get:
 *     summary: Get wallet transaction history
 *     description: Retrieve paginated wallet transaction history
 *     tags: [Wallets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: affiliateId
 *         required: true
 *         schema:
 *           type: string
 *         description: Affiliate ID
 *         example: "60d5ec49f8c6a7001c8a1b2c"
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [commission_credit, withdrawal_debit, adjustment_credit, adjustment_debit, refund_credit]
 *         description: Filter by transaction type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, completed, failed, reversed]
 *         description: Filter by transaction status
 *       - $ref: '#/components/parameters/DateRangeStartParam'
 *       - $ref: '#/components/parameters/DateRangeEndParam'
 *     responses:
 *       200:
 *         description: Transaction history retrieved successfully
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
 *                   example: "Transaction history retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     transactions:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/WalletTransaction'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalCredits:
 *                           type: number
 *                           example: 125000.50
 *                         totalDebits:
 *                           type: number
 *                           example: 40000.25
 *                         netAmount:
 *                           type: number
 *                           example: 85000.25
 *       403:
 *         description: Unauthorized access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletError'
 *       404:
 *         description: Wallet not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletError'
 * 
 * /wallets/{affiliateId}/freeze:
 *   post:
 *     summary: Freeze wallet (Admin only)
 *     description: Freeze wallet to prevent transactions
 *     tags: [Admin - Wallets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: affiliateId
 *         required: true
 *         schema:
 *           type: string
 *         description: Affiliate ID
 *         example: "60d5ec49f8c6a7001c8a1b2c"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 500
 *                 description: Reason for freezing wallet
 *                 example: "Suspicious activity detected"
 *     responses:
 *       200:
 *         description: Wallet frozen successfully
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
 *                   example: "Wallet frozen successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Wallet'
 *       400:
 *         description: Validation error or wallet already frozen
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletError'
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletError'
 *       404:
 *         description: Wallet not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletError'
 * 
 * /wallets/{affiliateId}/unfreeze:
 *   post:
 *     summary: Unfreeze wallet (Admin only)
 *     description: Unfreeze wallet to allow transactions
 *     tags: [Admin - Wallets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: affiliateId
 *         required: true
 *         schema:
 *           type: string
 *         description: Affiliate ID
 *         example: "60d5ec49f8c6a7001c8a1b2c"
 *     responses:
 *       200:
 *         description: Wallet unfrozen successfully
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
 *                   example: "Wallet unfrozen successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Wallet'
 *       400:
 *         description: Wallet not frozen
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletError'
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletError'
 *       404:
 *         description: Wallet not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletError'
 * 
 * /wallets/{affiliateId}/suspend:
 *   post:
 *     summary: Suspend wallet (Admin only)
 *     description: Suspend wallet to prevent all operations
 *     tags: [Admin - Wallets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: affiliateId
 *         required: true
 *         schema:
 *           type: string
 *         description: Affiliate ID
 *         example: "60d5ec49f8c6a7001c8a1b2c"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 500
 *                 description: Reason for suspending wallet
 *                 example: "Policy violation detected"
 *     responses:
 *       200:
 *         description: Wallet suspended successfully
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
 *                   example: "Wallet suspended successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Wallet'
 *       400:
 *         description: Validation error or wallet already suspended
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletError'
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletError'
 *       404:
 *         description: Wallet not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletError'
 * 
 * /wallets/{affiliateId}/validate:
 *   get:
 *     summary: Validate wallet for operations
 *     description: Check if wallet is valid and can perform operations
 *     tags: [Wallets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: affiliateId
 *         required: true
 *         schema:
 *           type: string
 *         description: Affiliate ID
 *         example: "60d5ec49f8c6a7001c8a1b2c"
 *     responses:
 *       200:
 *         description: Wallet validation result
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
 *                   example: "Wallet validation completed"
 *                 data:
 *                   type: object
 *                   properties:
 *                     isValid:
 *                       type: boolean
 *                       example: true
 *                     canCredit:
 *                       type: boolean
 *                       example: true
 *                     canDebit:
 *                       type: boolean
 *                       example: true
 *                     canWithdraw:
 *                       type: boolean
 *                       example: true
 *                     status:
 *                       type: string
 *                       example: "active"
 *                     balance:
 *                       type: number
 *                       example: 85000.25
 *                     restrictions:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: []
 *       403:
 *         description: Unauthorized access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletError'
 *       404:
 *         description: Wallet not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletError'
 * 
 * /wallets/{affiliateId}/bank-details:
 *   put:
 *     summary: Update wallet bank details
 *     description: Update bank account information for withdrawals
 *     tags: [Wallets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: affiliateId
 *         required: true
 *         schema:
 *           type: string
 *         description: Affiliate ID
 *         example: "60d5ec49f8c6a7001c8a1b2c"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - accountName
 *               - accountNumber
 *               - bankCode
 *               - bankName
 *             properties:
 *               accountName:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *                 example: "Travel Partners Ltd"
 *               accountNumber:
 *                 type: string
 *                 pattern: "^\\d{10}$"
 *                 example: "0123456789"
 *               bankCode:
 *                 type: string
 *                 pattern: "^\\d{3}$"
 *                 example: "044"
 *               bankName:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *                 example: "Access Bank"
 *     responses:
 *       200:
 *         description: Bank details updated successfully
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
 *                   example: "Bank details updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Wallet'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletError'
 *       403:
 *         description: Unauthorized access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletError'
 *       404:
 *         description: Wallet not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletError'
 * 
 * /wallets/{affiliateId}/statistics:
 *   get:
 *     summary: Get wallet statistics
 *     description: Retrieve detailed wallet statistics and analytics
 *     tags: [Wallets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: affiliateId
 *         required: true
 *         schema:
 *           type: string
 *         description: Affiliate ID
 *         example: "60d5ec49f8c6a7001c8a1b2c"
 *       - $ref: '#/components/parameters/DateRangeStartParam'
 *       - $ref: '#/components/parameters/DateRangeEndParam'
 *     responses:
 *       200:
 *         description: Wallet statistics retrieved successfully
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
 *                   example: "Wallet statistics retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     currentBalance:
 *                       type: number
 *                       example: 85000.25
 *                     totalEarned:
 *                       type: number
 *                       example: 125000.50
 *                     totalWithdrawn:
 *                       type: number
 *                       example: 40000.25
 *                     transactionCounts:
 *                       type: object
 *                       properties:
 *                         credits:
 *                           type: integer
 *                           example: 45
 *                         debits:
 *                           type: integer
 *                           example: 12
 *                         withdrawals:
 *                           type: integer
 *                           example: 8
 *                     monthlyTrend:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           month:
 *                             type: string
 *                             example: "2024-01"
 *                           credits:
 *                             type: number
 *                             example: 25000.00
 *                           debits:
 *                             type: number
 *                             example: 5000.00
 *                           netChange:
 *                             type: number
 *                             example: 20000.00
 *                     averageTransactionValue:
 *                       type: number
 *                       example: 2777.78
 *       403:
 *         description: Unauthorized access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletError'
 *       404:
 *         description: Wallet not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletError'
 * 
 * /wallets/transactions/{transactionId}/reverse:
 *   post:
 *     summary: Reverse a wallet transaction (Admin only)
 *     description: Reverse a completed wallet transaction
 *     tags: [Admin - Wallets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Transaction ID to reverse
 *         example: "60d5ec49f8c6a7001c8a1b31"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 500
 *                 description: Reason for reversing transaction
 *                 example: "Fraudulent transaction detected"
 *     responses:
 *       200:
 *         description: Transaction reversed successfully
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
 *                   example: "Transaction reversed successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     originalTransaction:
 *                       $ref: '#/components/schemas/WalletTransaction'
 *                     reversalTransaction:
 *                       $ref: '#/components/schemas/WalletTransaction'
 *                     newBalance:
 *                       type: number
 *                       example: 82500.25
 *       400:
 *         description: Transaction cannot be reversed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletError'
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletError'
 *       404:
 *         description: Transaction not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletError'
 * 
 * /wallets/system/statistics:
 *   get:
 *     summary: Get system-wide wallet statistics (Admin only)
 *     description: Retrieve comprehensive wallet statistics across all affiliates
 *     tags: [Admin - Wallets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/DateRangeStartParam'
 *       - $ref: '#/components/parameters/DateRangeEndParam'
 *     responses:
 *       200:
 *         description: System wallet statistics retrieved successfully
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
 *                   example: "System wallet statistics retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalWallets:
 *                       type: integer
 *                       example: 150
 *                     activeWallets:
 *                       type: integer
 *                       example: 142
 *                     frozenWallets:
 *                       type: integer
 *                       example: 5
 *                     suspendedWallets:
 *                       type: integer
 *                       example: 3
 *                     totalBalance:
 *                       type: number
 *                       example: 12750000.50
 *                     totalEarned:
 *                       type: number
 *                       example: 18750000.75
 *                     totalWithdrawn:
 *                       type: number
 *                       example: 6000000.25
 *                     transactionVolume:
 *                       type: object
 *                       properties:
 *                         credits:
 *                           type: number
 *                           example: 15000000.00
 *                         debits:
 *                           type: number
 *                           example: 8250000.00
 *                         withdrawals:
 *                           type: number
 *                           example: 6000000.25
 *                     averageWalletBalance:
 *                       type: number
 *                       example: 85000.00
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletError'
 * 
 * /wallets/bulk-operations:
 *   post:
 *     summary: Perform bulk wallet operations (Admin only)
 *     description: Execute bulk operations on multiple wallets
 *     tags: [Admin - Wallets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - operation
 *               - wallets
 *             properties:
 *               operation:
 *                 type: string
 *                 enum: [credit, debit, freeze, unfreeze, suspend]
 *                 example: "credit"
 *               wallets:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - affiliateId
 *                   properties:
 *                     affiliateId:
 *                       type: string
 *                       example: "60d5ec49f8c6a7001c8a1b2c"
 *                     amount:
 *                       type: number
 *                       description: Required for credit/debit operations
 *                       example: 1000.00
 *                     reference:
 *                       type: string
 *                       description: Transaction reference
 *                       example: "BULK-CREDIT-1678888888888"
 *                     reason:
 *                       type: string
 *                       description: Required for freeze/suspend operations
 *                       example: "Monthly bonus payment"
 *               description:
 *                 type: string
 *                 description: Overall operation description
 *                 example: "Monthly bonus distribution"
 *     responses:
 *       200:
 *         description: Bulk operation completed successfully
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
 *                   example: "Bulk operation completed successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalProcessed:
 *                       type: integer
 *                       example: 25
 *                     successful:
 *                       type: integer
 *                       example: 23
 *                     failed:
 *                       type: integer
 *                       example: 2
 *                     results:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           affiliateId:
 *                             type: string
 *                             example: "60d5ec49f8c6a7001c8a1b2c"
 *                           success:
 *                             type: boolean
 *                             example: true
 *                           message:
 *                             type: string
 *                             example: "Operation completed successfully"
 *                           error:
 *                             type: string
 *                             description: Error message if operation failed
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletError'
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletError'
 * 
 * /wallets/{affiliateId}/health:
 *   get:
 *     summary: Check wallet health and integrity (Admin only)
 *     description: Perform health check on wallet data integrity
 *     tags: [Admin - Wallets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: affiliateId
 *         required: true
 *         schema:
 *           type: string
 *         description: Affiliate ID
 *         example: "60d5ec49f8c6a7001c8a1b2c"
 *     responses:
 *       200:
 *         description: Wallet health check completed
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
 *                   example: "Wallet health check completed"
 *                 data:
 *                   type: object
 *                   properties:
 *                     isHealthy:
 *                       type: boolean
 *                       example: true
 *                     balanceIntegrity:
 *                       type: boolean
 *                       example: true
 *                     transactionIntegrity:
 *                       type: boolean
 *                       example: true
 *                     issues:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: []
 *                     recommendations:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: []
 *                     lastHealthCheck:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T14:30:00Z"
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletError'
 *       404:
 *         description: Wallet not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletError'
 */
/**

 * @openapi
 * /affiliate-notifications/{affiliateId}/preferences:
 *   get:
 *     summary: Get notification preferences for an affiliate
 *     description: Retrieve notification preferences and settings for an affiliate
 *     tags: [Affiliate Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: affiliateId
 *         required: true
 *         schema:
 *           type: string
 *         description: Affiliate ID
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
 *                   type: object
 *                   properties:
 *                     affiliateId:
 *                       type: string
 *                       example: "60d5ec49f8c6a7001c8a1b2c"
 *                     emailNotifications:
 *                       type: object
 *                       properties:
 *                         commissionEarned:
 *                           type: boolean
 *                           example: true
 *                         monthlyStatement:
 *                           type: boolean
 *                           example: true
 *                         withdrawalProcessed:
 *                           type: boolean
 *                           example: true
 *                         accountUpdates:
 *                           type: boolean
 *                           example: false
 *                     smsNotifications:
 *                       type: object
 *                       properties:
 *                         commissionEarned:
 *                           type: boolean
 *                           example: false
 *                         withdrawalProcessed:
 *                           type: boolean
 *                           example: true
 *                     frequency:
 *                       type: object
 *                       properties:
 *                         monthlyStatement:
 *                           type: string
 *                           enum: [monthly, quarterly, disabled]
 *                           example: "monthly"
 *                         summaryReports:
 *                           type: string
 *                           enum: [weekly, monthly, quarterly, disabled]
 *                           example: "monthly"
 *                     timezone:
 *                       type: string
 *                       example: "Africa/Lagos"
 *                     language:
 *                       type: string
 *                       example: "en"
 *       403:
 *         description: Unauthorized access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 *       404:
 *         description: Affiliate not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 * 
 *   put:
 *     summary: Update notification preferences for an affiliate
 *     description: Update notification preferences and settings for an affiliate
 *     tags: [Affiliate Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: affiliateId
 *         required: true
 *         schema:
 *           type: string
 *         description: Affiliate ID
 *         example: "60d5ec49f8c6a7001c8a1b2c"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               emailNotifications:
 *                 type: object
 *                 properties:
 *                   commissionEarned:
 *                     type: boolean
 *                     example: true
 *                   monthlyStatement:
 *                     type: boolean
 *                     example: true
 *                   withdrawalProcessed:
 *                     type: boolean
 *                     example: true
 *                   accountUpdates:
 *                     type: boolean
 *                     example: false
 *               smsNotifications:
 *                 type: object
 *                 properties:
 *                   commissionEarned:
 *                     type: boolean
 *                     example: false
 *                   withdrawalProcessed:
 *                     type: boolean
 *                     example: true
 *               frequency:
 *                 type: object
 *                 properties:
 *                   monthlyStatement:
 *                     type: string
 *                     enum: [monthly, quarterly, disabled]
 *                     example: "monthly"
 *                   summaryReports:
 *                     type: string
 *                     enum: [weekly, monthly, quarterly, disabled]
 *                     example: "monthly"
 *               timezone:
 *                 type: string
 *                 example: "Africa/Lagos"
 *               language:
 *                 type: string
 *                 example: "en"
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
 *                   type: object
 *                   description: Updated notification preferences
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 *       403:
 *         description: Unauthorized access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 *       404:
 *         description: Affiliate not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 * 
 * /affiliate-notifications/{affiliateId}/statements:
 *   get:
 *     summary: Get monthly statement for an affiliate
 *     description: Retrieve monthly performance statement for an affiliate
 *     tags: [Affiliate Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: affiliateId
 *         required: true
 *         schema:
 *           type: string
 *         description: Affiliate ID
 *         example: "60d5ec49f8c6a7001c8a1b2c"
 *       - in: query
 *         name: month
 *         schema:
 *           type: string
 *           pattern: "^\\d{4}-\\d{2}$"
 *         description: Month in YYYY-MM format
 *         example: "2024-01"
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *           minimum: 2020
 *           maximum: 2030
 *         description: Year for statement
 *         example: 2024
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
 *                   type: object
 *                   properties:
 *                     affiliateId:
 *                       type: string
 *                       example: "60d5ec49f8c6a7001c8a1b2c"
 *                     period:
 *                       type: object
 *                       properties:
 *                         month:
 *                           type: string
 *                           example: "2024-01"
 *                         startDate:
 *                           type: string
 *                           format: date
 *                           example: "2024-01-01"
 *                         endDate:
 *                           type: string
 *                           format: date
 *                           example: "2024-01-31"
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalReferrals:
 *                           type: integer
 *                           example: 12
 *                         totalCommissions:
 *                           type: number
 *                           example: 25000.00
 *                         totalWithdrawals:
 *                           type: number
 *                           example: 15000.00
 *                         walletBalance:
 *                           type: number
 *                           example: 85000.25
 *                     commissionBreakdown:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           serviceType:
 *                             type: string
 *                             example: "flights"
 *                           referrals:
 *                             type: integer
 *                             example: 8
 *                           commissions:
 *                             type: number
 *                             example: 20000.00
 *                           averageCommission:
 *                             type: number
 *                             example: 2500.00
 *                     topReferrals:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           bookingReference:
 *                             type: string
 *                             example: "TTP-FL-1678888888888"
 *                           serviceType:
 *                             type: string
 *                             example: "flight"
 *                           bookingAmount:
 *                             type: number
 *                             example: 100000.00
 *                           commission:
 *                             type: number
 *                             example: 2500.00
 *                           date:
 *                             type: string
 *                             format: date
 *                             example: "2024-01-15"
 *                     generatedAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-02-01T09:00:00Z"
 *       403:
 *         description: Unauthorized access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 *       404:
 *         description: Affiliate or statement not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 * 
 * /affiliate-notifications/{affiliateId}/statements/available:
 *   get:
 *     summary: Get available statement months for an affiliate
 *     description: Retrieve list of months for which statements are available
 *     tags: [Affiliate Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: affiliateId
 *         required: true
 *         schema:
 *           type: string
 *         description: Affiliate ID
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
 *                   type: object
 *                   properties:
 *                     affiliateId:
 *                       type: string
 *                       example: "60d5ec49f8c6a7001c8a1b2c"
 *                     availableMonths:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           month:
 *                             type: string
 *                             example: "2024-01"
 *                           hasActivity:
 *                             type: boolean
 *                             example: true
 *                           totalCommissions:
 *                             type: number
 *                             example: 25000.00
 *                           totalReferrals:
 *                             type: integer
 *                             example: 12
 *                     totalAvailable:
 *                       type: integer
 *                       example: 6
 *                     earliestMonth:
 *                       type: string
 *                       example: "2023-08"
 *                     latestMonth:
 *                       type: string
 *                       example: "2024-01"
 *       403:
 *         description: Unauthorized access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 *       404:
 *         description: Affiliate not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 * 
 * /affiliate-notifications/{affiliateId}/statements/send:
 *   post:
 *     summary: Send monthly statement manually (Admin only)
 *     description: Manually trigger sending of monthly statement to affiliate
 *     tags: [Admin - Affiliate Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: affiliateId
 *         required: true
 *         schema:
 *           type: string
 *         description: Affiliate ID
 *         example: "60d5ec49f8c6a7001c8a1b2c"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - month
 *             properties:
 *               month:
 *                 type: string
 *                 pattern: "^\\d{4}-\\d{2}$"
 *                 description: Month in YYYY-MM format
 *                 example: "2024-01"
 *               forceResend:
 *                 type: boolean
 *                 description: Force resend even if already sent
 *                 example: false
 *               customMessage:
 *                 type: string
 *                 description: Custom message to include in statement
 *                 example: "Thank you for your continued partnership"
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
 *                   type: object
 *                   properties:
 *                     affiliateId:
 *                       type: string
 *                       example: "60d5ec49f8c6a7001c8a1b2c"
 *                     month:
 *                       type: string
 *                       example: "2024-01"
 *                     sentAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-02-01T09:00:00Z"
 *                     deliveryStatus:
 *                       type: string
 *                       enum: [sent, delivered, failed]
 *                       example: "sent"
 *       400:
 *         description: Validation error or statement already sent
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 *       404:
 *         description: Affiliate not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 * 
 * /affiliate-notifications/statements/send-all:
 *   post:
 *     summary: Send monthly statements to all affiliates (Admin only)
 *     description: Bulk send monthly statements to all active affiliates
 *     tags: [Admin - Affiliate Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - month
 *             properties:
 *               month:
 *                 type: string
 *                 pattern: "^\\d{4}-\\d{2}$"
 *                 description: Month in YYYY-MM format
 *                 example: "2024-01"
 *               affiliateStatus:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [active, pending, suspended, inactive]
 *                 description: Filter by affiliate status
 *                 example: ["active"]
 *               forceResend:
 *                 type: boolean
 *                 description: Force resend even if already sent
 *                 example: false
 *               customMessage:
 *                 type: string
 *                 description: Custom message to include in all statements
 *                 example: "Thank you for your continued partnership"
 *               batchSize:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 100
 *                 description: Number of statements to send per batch
 *                 example: 10
 *     responses:
 *       200:
 *         description: Bulk statement sending initiated successfully
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
 *                   example: "Bulk statement sending initiated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     month:
 *                       type: string
 *                       example: "2024-01"
 *                     totalAffiliates:
 *                       type: integer
 *                       example: 150
 *                     eligibleAffiliates:
 *                       type: integer
 *                       example: 142
 *                     batchSize:
 *                       type: integer
 *                       example: 10
 *                     estimatedBatches:
 *                       type: integer
 *                       example: 15
 *                     jobId:
 *                       type: string
 *                       description: Background job ID for tracking
 *                       example: "bulk-statement-job-1678888888888"
 *                     startedAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-02-01T09:00:00Z"
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 */

/**
 * @openapi
 * /affiliates:
 *   get:
 *     summary: Get all affiliates (Admin only)
 *     description: Retrieve paginated list of all affiliates with filtering options
 *     tags: [Admin - Affiliates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, active, suspended, inactive]
 *         description: Filter by affiliate status
 *         example: "active"
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, approvedAt, businessName, totalReferrals, totalCommissionsEarned]
 *         description: Sort field
 *         example: "createdAt"
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Sort order
 *         example: "desc"
 *     responses:
 *       200:
 *         description: Affiliates retrieved successfully
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
 *                   example: "Affiliates retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     affiliates:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Affiliate'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalAffiliates:
 *                           type: integer
 *                           example: 150
 *                         activeAffiliates:
 *                           type: integer
 *                           example: 142
 *                         pendingAffiliates:
 *                           type: integer
 *                           example: 5
 *                         suspendedAffiliates:
 *                           type: integer
 *                           example: 3
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 * 
 * /affiliates/{affiliateId}/approve:
 *   patch:
 *     summary: Approve affiliate (Admin only)
 *     description: Approve a pending affiliate application
 *     tags: [Admin - Affiliates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: affiliateId
 *         required: true
 *         schema:
 *           type: string
 *         description: Affiliate ID
 *         example: "60d5ec49f8c6a7001c8a1b2c"
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               commissionRates:
 *                 type: object
 *                 properties:
 *                   flights:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 100
 *                     example: 2.5
 *                   hotels:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 100
 *                     example: 3.0
 *                   insurance:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 100
 *                     example: 5.0
 *                   visa:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 100
 *                     example: 10.0
 *               notes:
 *                 type: string
 *                 description: Admin notes for approval
 *                 example: "Approved with standard commission rates"
 *     responses:
 *       200:
 *         description: Affiliate approved successfully
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
 *                   example: "Affiliate approved successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Affiliate'
 *       400:
 *         description: Affiliate already approved or invalid status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 *       404:
 *         description: Affiliate not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 * 
 * /affiliates/{affiliateId}/suspend:
 *   patch:
 *     summary: Suspend affiliate (Admin only)
 *     description: Suspend an active affiliate account
 *     tags: [Admin - Affiliates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: affiliateId
 *         required: true
 *         schema:
 *           type: string
 *         description: Affiliate ID
 *         example: "60d5ec49f8c6a7001c8a1b2c"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 500
 *                 description: Reason for suspension
 *                 example: "Violation of terms and conditions"
 *     responses:
 *       200:
 *         description: Affiliate suspended successfully
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
 *                   example: "Affiliate suspended successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Affiliate'
 *       400:
 *         description: Validation error or affiliate already suspended
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 *       404:
 *         description: Affiliate not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 * 
 * /affiliates/{affiliateId}/reactivate:
 *   patch:
 *     summary: Reactivate affiliate (Admin only)
 *     description: Reactivate a suspended or inactive affiliate account
 *     tags: [Admin - Affiliates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: affiliateId
 *         required: true
 *         schema:
 *           type: string
 *         description: Affiliate ID
 *         example: "60d5ec49f8c6a7001c8a1b2c"
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *                 description: Admin notes for reactivation
 *                 example: "Issues resolved, account reactivated"
 *     responses:
 *       200:
 *         description: Affiliate reactivated successfully
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
 *                   example: "Affiliate reactivated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Affiliate'
 *       400:
 *         description: Affiliate already active
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 *       404:
 *         description: Affiliate not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 * 
 * /affiliates/{affiliateId}/commission-rates:
 *   patch:
 *     summary: Update commission rates (Admin only)
 *     description: Update commission rates for an affiliate
 *     tags: [Admin - Affiliates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: affiliateId
 *         required: true
 *         schema:
 *           type: string
 *         description: Affiliate ID
 *         example: "60d5ec49f8c6a7001c8a1b2c"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rates
 *             properties:
 *               rates:
 *                 type: object
 *                 properties:
 *                   flights:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 100
 *                     example: 2.5
 *                   hotels:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 100
 *                     example: 3.0
 *                   insurance:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 100
 *                     example: 5.0
 *                   visa:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 100
 *                     example: 10.0
 *               reason:
 *                 type: string
 *                 description: Reason for rate change
 *                 example: "Performance-based rate adjustment"
 *     responses:
 *       200:
 *         description: Commission rates updated successfully
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
 *                   example: "Commission rates updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Affiliate'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 *       404:
 *         description: Affiliate not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 * 
 * /affiliates/{affiliateId}/dashboard/commissions:
 *   get:
 *     summary: Get affiliate commission history
 *     description: Retrieve paginated commission transaction history for affiliate dashboard
 *     tags: [Affiliate Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: affiliateId
 *         required: true
 *         schema:
 *           type: string
 *         description: Affiliate ID
 *         example: "60d5ec49f8c6a7001c8a1b2c"
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, paid, disputed]
 *         description: Filter by commission status
 *       - in: query
 *         name: serviceType
 *         schema:
 *           type: string
 *           enum: [flight, hotel, insurance, visa]
 *         description: Filter by service type
 *       - $ref: '#/components/parameters/DateRangeStartParam'
 *       - $ref: '#/components/parameters/DateRangeEndParam'
 *     responses:
 *       200:
 *         description: Commission history retrieved successfully
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
 *                   example: "Commission history retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     commissions:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/CommissionTransaction'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalCommissions:
 *                           type: number
 *                           example: 125000.50
 *                         pendingCommissions:
 *                           type: number
 *                           example: 15000.00
 *                         paidCommissions:
 *                           type: number
 *                           example: 110000.50
 *       403:
 *         description: Unauthorized access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 *       404:
 *         description: Affiliate not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 * 
 * /affiliates/{affiliateId}/dashboard/referrals:
 *   get:
 *     summary: Get affiliate referral history
 *     description: Retrieve paginated referral history for affiliate dashboard
 *     tags: [Affiliate Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: affiliateId
 *         required: true
 *         schema:
 *           type: string
 *         description: Affiliate ID
 *         example: "60d5ec49f8c6a7001c8a1b2c"
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, converted, inactive]
 *         description: Filter by referral status
 *       - $ref: '#/components/parameters/DateRangeStartParam'
 *       - $ref: '#/components/parameters/DateRangeEndParam'
 *     responses:
 *       200:
 *         description: Referral history retrieved successfully
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
 *                   example: "Referral history retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     referrals:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Referral'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalReferrals:
 *                           type: integer
 *                           example: 150
 *                         convertedReferrals:
 *                           type: integer
 *                           example: 125
 *                         conversionRate:
 *                           type: number
 *                           example: 83.33
 *       403:
 *         description: Unauthorized access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 *       404:
 *         description: Affiliate not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 * 
 * /affiliates/{affiliateId}/dashboard/qr-codes:
 *   get:
 *     summary: Get affiliate QR codes
 *     description: Retrieve QR codes for affiliate marketing materials
 *     tags: [Affiliate Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: affiliateId
 *         required: true
 *         schema:
 *           type: string
 *         description: Affiliate ID
 *         example: "60d5ec49f8c6a7001c8a1b2c"
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [referral, profile, contact]
 *         description: Type of QR code to generate
 *         example: "referral"
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *           minimum: 100
 *           maximum: 1000
 *         description: QR code size in pixels
 *         example: 300
 *     responses:
 *       200:
 *         description: QR codes retrieved successfully
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
 *                   example: "QR codes retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     qrCodes:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                             example: "referral"
 *                           data:
 *                             type: string
 *                             description: Base64 encoded QR code image
 *                             example: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
 *                           url:
 *                             type: string
 *                             description: URL encoded in QR code
 *                             example: "https://travelplace.com/book?ref=TRAVEL-PARTNER-123"
 *                           downloadUrl:
 *                             type: string
 *                             description: Direct download URL for QR code
 *                             example: "https://api.travelplace.com/qr/download/affiliate/AFF-001234"
 *                     affiliateInfo:
 *                       type: object
 *                       properties:
 *                         affiliateId:
 *                           type: string
 *                           example: "AFF-001234"
 *                         referralCode:
 *                           type: string
 *                           example: "TRAVEL-PARTNER-123"
 *                         businessName:
 *                           type: string
 *                           example: "Travel Partners Ltd"
 *       403:
 *         description: Unauthorized access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 *       404:
 *         description: Affiliate not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 * 
 * /affiliates/health:
 *   get:
 *     summary: Get affiliate service health status and monitoring metrics
 *     description: Comprehensive health check of the affiliate service including database connectivity, cache status, external service health, and key performance indicators for system monitoring
 *     tags: [Admin - System Health & Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Health status and monitoring metrics retrieved successfully
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
 *                   example: "Affiliate service health check completed"
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [healthy, degraded, unhealthy]
 *                       example: "healthy"
 *                       description: Overall service health status
 *                     uptime:
 *                       type: number
 *                       description: Service uptime in seconds
 *                       example: 86400
 *                     checks:
 *                       type: object
 *                       description: Individual component health checks
 *                       properties:
 *                         database:
 *                           type: object
 *                           properties:
 *                             status:
 *                               type: boolean
 *                               example: true
 *                             responseTime:
 *                               type: number
 *                               description: Database response time in milliseconds
 *                               example: 25
 *                             connectionPool:
 *                               type: object
 *                               properties:
 *                                 active:
 *                                   type: integer
 *                                   example: 5
 *                                 idle:
 *                                   type: integer
 *                                   example: 15
 *                         cache:
 *                           type: object
 *                           properties:
 *                             status:
 *                               type: boolean
 *                               example: true
 *                             hitRate:
 *                               type: number
 *                               description: Cache hit rate percentage
 *                               example: 85.5
 *                         qrService:
 *                           type: object
 *                           properties:
 *                             status:
 *                               type: boolean
 *                               example: true
 *                             generationRate:
 *                               type: number
 *                               description: QR codes generated per minute
 *                               example: 12.5
 *                         emailService:
 *                           type: object
 *                           properties:
 *                             status:
 *                               type: boolean
 *                               example: true
 *                             deliveryRate:
 *                               type: number
 *                               description: Email delivery success rate percentage
 *                               example: 98.2
 *                         paystackService:
 *                           type: object
 *                           properties:
 *                             status:
 *                               type: boolean
 *                               example: true
 *                             apiLatency:
 *                               type: number
 *                               description: Average API response time in milliseconds
 *                               example: 150
 *                     metrics:
 *                       type: object
 *                       description: Key performance indicators and system metrics
 *                       properties:
 *                         totalAffiliates:
 *                           type: integer
 *                           example: 150
 *                         activeAffiliates:
 *                           type: integer
 *                           example: 142
 *                         pendingAffiliates:
 *                           type: integer
 *                           example: 5
 *                         suspendedAffiliates:
 *                           type: integer
 *                           example: 3
 *                         totalCommissions:
 *                           type: number
 *                           example: 12750000.50
 *                         dailyTransactions:
 *                           type: integer
 *                           example: 245
 *                         systemLoad:
 *                           type: object
 *                           properties:
 *                             cpu:
 *                               type: number
 *                               description: CPU usage percentage
 *                               example: 45.2
 *                             memory:
 *                               type: number
 *                               description: Memory usage percentage
 *                               example: 62.8
 *                     alerts:
 *                       type: array
 *                       description: Active system alerts or warnings
 *                       items:
 *                         type: object
 *                         properties:
 *                           level:
 *                             type: string
 *                             enum: [info, warning, error, critical]
 *                             example: "warning"
 *                           component:
 *                             type: string
 *                             example: "cache"
 *                           message:
 *                             type: string
 *                             example: "Cache hit rate below optimal threshold"
 *                           timestamp:
 *                             type: string
 *                             format: date-time
 *                             example: "2024-01-15T14:25:00Z"
 *                     lastChecked:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T14:30:00Z"
 *       500:
 *         description: Health check failed or service unavailable
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 * 
 * /affiliates/health-check:
 *   post:
 *     summary: Perform comprehensive health check (Admin only)
 *     description: Run comprehensive health check on affiliate service
 *     tags: [Admin - System Health]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Health check completed successfully
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
 *                   example: "Comprehensive health check completed"
 *                 data:
 *                   type: object
 *                   properties:
 *                     overallHealth:
 *                       type: string
 *                       enum: [healthy, degraded, unhealthy]
 *                       example: "healthy"
 *                     detailedChecks:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           component:
 *                             type: string
 *                             example: "database"
 *                           status:
 *                             type: string
 *                             enum: [pass, fail, warn]
 *                             example: "pass"
 *                           responseTime:
 *                             type: number
 *                             description: Response time in milliseconds
 *                             example: 45
 *                           message:
 *                             type: string
 *                             example: "Database connection successful"
 *                     recommendations:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: []
 *                     checkedAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T14:30:00Z"
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 * 
 * /affiliates/reset-service:
 *   post:
 *     summary: Reset affiliate service (Admin only)
 *     description: Reset affiliate service caches and connections
 *     tags: [Admin - System Health]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               components:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [cache, connections, qr-service, email-service]
 *                 description: Specific components to reset
 *                 example: ["cache"]
 *               force:
 *                 type: boolean
 *                 description: Force reset even if service is healthy
 *                 example: false
 *     responses:
 *       200:
 *         description: Service reset completed successfully
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
 *                   example: "Affiliate service reset completed successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     resetComponents:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["cache", "connections"]
 *                     resetAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T14:30:00Z"
 *                     newStatus:
 *                       type: string
 *                       enum: [healthy, degraded, unhealthy]
 *                       example: "healthy"
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateError'
 */

/**
 * @openapi
 * components:
 *   parameters:
 *     PageParam:
 *       in: query
 *       name: page
 *       schema:
 *         type: integer
 *         minimum: 1
 *         default: 1
 *       description: Page number for pagination
 *       example: 1
 *     
 *     LimitParam:
 *       in: query
 *       name: limit
 *       schema:
 *         type: integer
 *         minimum: 1
 *         maximum: 100
 *         default: 20
 *       description: Number of items per page
 *       example: 20
 *     
 *     DateRangeStartParam:
 *       in: query
 *       name: startDate
 *       schema:
 *         type: string
 *         format: date-time
 *       description: Start date for filtering (ISO 8601 format)
 *       example: "2024-01-01T00:00:00.000Z"
 *     
 *     DateRangeEndParam:
 *       in: query
 *       name: endDate
 *       schema:
 *         type: string
 *         format: date-time
 *       description: End date for filtering (ISO 8601 format)
 *       example: "2024-12-31T23:59:59.999Z"
 *   
 *   schemas:
 *     Pagination:
 *       type: object
 *       properties:
 *         currentPage:
 *           type: integer
 *           example: 1
 *         totalPages:
 *           type: integer
 *           example: 10
 *         totalItems:
 *           type: integer
 *           example: 200
 *         itemsPerPage:
 *           type: integer
 *           example: 20
 *         hasNextPage:
 *           type: boolean
 *           example: true
 *         hasPreviousPage:
 *           type: boolean
 *           example: false
 *   
 *   responses:
 *     UnauthorizedError:
 *       description: Authentication required
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               success:
 *                 type: boolean
 *                 example: false
 *               message:
 *                 type: string
 *                 example: "Authentication required"
 *               errorCode:
 *                 type: string
 *                 example: "UNAUTHORIZED"
 *     
 *     ForbiddenError:
 *       description: Insufficient permissions
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               success:
 *                 type: boolean
 *                 example: false
 *               message:
 *                 type: string
 *                 example: "Insufficient permissions"
 *               errorCode:
 *                 type: string
 *                 example: "FORBIDDEN"
 *     
 *     ServerError:
 *       description: Internal server error
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               success:
 *                 type: boolean
 *                 example: false
 *               message:
 *                 type: string
 *                 example: "Internal server error"
 *               errorCode:
 *                 type: string
 *                 example: "SERVER_ERROR"
 */

module.exports = {};