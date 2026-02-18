// docs/swagger.js
// This file contains comprehensive OpenAPI schemas and components for The Travel Place API.
// It is referenced in app.js under swaggerJsdoc configuration.

// Import affiliate API documentation
require('../v1/docs/affiliate-api-documentation');

// Import wallet API documentation
require('../v1/docs/wallet-api-documentation');

// Import analytics API documentation
require('../v1/docs/analytics-api-documentation');

// Import notification API documentation
require('../v1/docs/notification-api-documentation');

// Visa API documentation removed - no visa routes implemented

/**
 * @openapi
 * info:
 *   title: The Travel Place API
 *   version: 2.0.0
 *   description: |
 *     The Travel Place API provides comprehensive travel booking and management services.
 *     
 *     ## Recent Updates (v2.0.0)
 *     
 *     ### Migration to AWS S3
 *     - File uploads now use AWS S3 instead of Cloudflare Images
 *     - Improved scalability, reliability, and cost efficiency
 *     - New file upload response format with S3-specific data
 *     - Support for signed URLs and private file access
 *     
 *     ### Amadeus XML Integration
 *     - Flight search and booking now use Amadeus XML SOAP API
 *     - Enhanced flight data and booking capabilities
 *     - Backward compatible API responses maintained
 *     
 *     ### Enhanced Error Handling
 *     - New error codes for XML processing and S3 operations
 *     - More detailed error responses with context information
 *     
 *     ## Active Services
 *     - **File Storage**: AWS S3 (migrated from Cloudflare Images)
 *     - **Flight Search**: Amadeus XML SOAP API
 *     - **Payments**: Paystack
 *     - **SMS**: Twilio
 *     - **WhatsApp**: WhatsApp Business API
 *     - **Email**: Nodemailer with Gmail SMTP
 *     
 *     ## Health Monitoring
 *     The API includes comprehensive health check endpoints to monitor:
 *     - Database connectivity
 *     - AWS S3 service
 *     - Amadeus XML service
 *     - Overall system health
 *   contact:
 *     name: The Travel Place API Support
 *     email: api-support@thetravelplace.com
 *   license:
 *     name: MIT
 *     url: https://opensource.org/licenses/MIT
 */

/**
 * @openapi
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *       description: JWT token obtained from login endpoint. Include in Authorization header as "Bearer {token}"
 *     
 *     apiKeyAuth:
 *       type: apiKey
 *       in: header
 *       name: X-API-Key
 *       description: API key for service-to-service authentication
 *     
 *     affiliateAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *       description: JWT token with affiliate-specific claims for affiliate endpoints
 *     
 *     adminAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *       description: JWT token with admin privileges for administrative endpoints
 *   
 *   parameters:
 *     PageParam:
 *       in: query
 *       name: page
 *       schema:
 *         type: integer
 *         minimum: 1
 *         default: 1
 *       description: Page number for pagination
 *     
 *     LimitParam:
 *       in: query
 *       name: limit
 *       schema:
 *         type: integer
 *         minimum: 1
 *         maximum: 100
 *         default: 10
 *       description: Number of items per page
 *     
 *     DateRangeStartParam:
 *       in: query
 *       name: startDate
 *       schema:
 *         type: string
 *         format: date
 *       description: Start date for filtering (YYYY-MM-DD)
 *       example: "2024-01-01"
 *     
 *     DateRangeEndParam:
 *       in: query
 *       name: endDate
 *       schema:
 *         type: string
 *         format: date
 *       description: End date for filtering (YYYY-MM-DD)
 *       example: "2024-12-31"
 *     
 *     SortByParam:
 *       in: query
 *       name: sortBy
 *       schema:
 *         type: string
 *         default: "createdAt"
 *       description: Field to sort by
 *       example: "createdAt"
 *     
 *     SortOrderParam:
 *       in: query
 *       name: sortOrder
 *       schema:
 *         type: string
 *         enum: [asc, desc]
 *         default: "desc"
 *       description: Sort order (ascending or descending)
 *       example: "desc"
 *     
 *     StatusFilterParam:
 *       in: query
 *       name: status
 *       schema:
 *         type: string
 *       description: Filter by status
 *       example: "active"
 *     
 *     SearchParam:
 *       in: query
 *       name: search
 *       schema:
 *         type: string
 *       description: Search term for text-based filtering
 *       example: "travel"
 *     
 *     AffiliateIdParam:
 *       in: query
 *       name: affiliateId
 *       schema:
 *         type: string
 *       description: Filter by affiliate ID
 *       example: "AFF-001234"
 *     
 *     ServiceTypeParam:
 *       in: query
 *       name: serviceType
 *       schema:
 *         type: string
 *         enum: [Flight, Hotel, Insurance, Visa, Package]
 *       description: Filter by service type
 *       example: "Flight"
 *     
 *     ReferralSourceParam:
 *       in: query
 *       name: referralSource
 *       schema:
 *         type: string
 *         enum: [link, qr_code, email, social_media]
 *       description: Filter by referral source
 *       example: "qr_code"
 *     
 *     CurrencyParam:
 *       in: query
 *       name: currency
 *       schema:
 *         type: string
 *         enum: [NGN, USD, EUR, GBP]
 *         default: "NGN"
 *       description: Filter by currency
 *       example: "NGN"
 *     
 *     MinAmountParam:
 *       in: query
 *       name: minAmount
 *       schema:
 *         type: number
 *         minimum: 0
 *       description: Minimum amount filter
 *       example: 1000
 *     
 *     MaxAmountParam:
 *       in: query
 *       name: maxAmount
 *       schema:
 *         type: number
 *         minimum: 0
 *       description: Maximum amount filter
 *       example: 100000
 *     
 *     IncludeInactiveParam:
 *       in: query
 *       name: includeInactive
 *       schema:
 *         type: boolean
 *         default: false
 *       description: Include inactive records in results
 *       example: false
 *     
 *     GroupByParam:
 *       in: query
 *       name: groupBy
 *       schema:
 *         type: string
 *         enum: [day, week, month, year, serviceType, status]
 *       description: Group results by specified field (for analytics)
 *       example: "month"
 *   
 *   schemas:
 *     # Core User Schema
 *     User:
 *       type: object
 *       required:
 *         - firstName
 *         - lastName
 *         - email
 *         - role
 *       properties:
 *         _id:
 *           type: string
 *           description: The auto-generated ID of the user
 *           example: "60d5ec49f8c6a7001c8a1b2c"
 *         firstName:
 *           type: string
 *           description: User's first name
 *           example: "John"
 *           maxLength: 50
 *         lastName:
 *           type: string
 *           description: User's last name
 *           example: "Doe"
 *           maxLength: 50
 *         otherNames:
 *           type: string
 *           description: User's other names (optional)
 *           example: "Peter"
 *           maxLength: 100
 *         email:
 *           type: string
 *           format: email
 *           description: User's email address (unique)
 *           example: "john.doe@example.com"
 *         phoneNumber:
 *           type: string
 *           description: User's phone number (unique, E.164 format)
 *           example: "+2348012345678"
 *           pattern: "^\\+?[1-9]\\d{1,14}$"
 *         role:
 *           type: string
 *           enum: [User, Business, Staff, Manager, Executive, Admin]
 *           description: User's role in the system
 *           example: "User"
 *         isEmailVerified:
 *           type: boolean
 *           description: Whether the user's email is verified
 *           example: false
 *         isPhoneVerified:
 *           type: boolean
 *           description: Whether the user's phone number is verified
 *           example: false
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date and time the user was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The date and time the user was last updated
 *     
 *     # Authentication Schemas
 *     AuthLogin:
 *       type: object
 *       required:
 *         - emailOrPhone
 *         - password
 *       properties:
 *         emailOrPhone:
 *           type: string
 *           description: User's email or phone number
 *           example: "john.doe@example.com"
 *         password:
 *           type: string
 *           format: password
 *           description: User's password
 *           example: "password123"
 *           minLength: 8
 *     
 *     AuthRegister:
 *       type: object
 *       required:
 *         - firstName
 *         - lastName
 *         - email
 *         - password
 *       properties:
 *         firstName:
 *           type: string
 *           description: User's first name
 *           example: "Jane"
 *           maxLength: 50
 *         lastName:
 *           type: string
 *           description: User's last name
 *           example: "Doe"
 *           maxLength: 50
 *         otherNames:
 *           type: string
 *           description: User's other names (optional)
 *           example: "Mary"
 *           maxLength: 100
 *         email:
 *           type: string
 *           format: email
 *           description: User's email address (unique)
 *           example: "jane.doe@example.com"
 *         phoneNumber:
 *           type: string
 *           description: User's phone number (unique, E.164 format)
 *           example: "+2349012345678"
 *           pattern: "^\\+?[1-9]\\d{1,14}$"
 *         password:
 *           type: string
 *           format: password
 *           description: User's password
 *           example: "strongpassword"
 *           minLength: 8
 *         role:
 *           type: string
 *           enum: [User, Business, Staff, Manager, Executive, Admin]
 *           description: User's role
 *           example: "User"
 *           default: "User"
 *     
 *     ForgotPasswordRequest:
 *       type: object
 *       required:
 *         - emailOrPhone
 *       properties:
 *         emailOrPhone:
 *           type: string
 *           description: User's email or phone number
 *           example: "john.doe@example.com"
 *     
 *     ResetPasswordRequest:
 *       type: object
 *       required:
 *         - token
 *         - password
 *       properties:
 *         token:
 *           type: string
 *           description: Password reset token
 *           example: "abc123def456"
 *         password:
 *           type: string
 *           format: password
 *           description: New password
 *           example: "newstrongpassword"
 *           minLength: 8
 *     
 *     # Content Management Schemas
 *     Post:
 *       type: object
 *       required:
 *         - title
 *         - content
 *         - postType
 *         - author
 *       properties:
 *         _id:
 *           type: string
 *           description: Post ID
 *           example: "60d5ec49f8c6a7001c8a1b2d"
 *         title:
 *           type: string
 *           description: Post title
 *           example: "Amazing Safari Package in Kenya"
 *           maxLength: 200
 *         slug:
 *           type: string
 *           description: URL-friendly slug
 *           example: "amazing-safari-package-kenya"
 *           pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$"
 *         content:
 *           type: string
 *           description: Post content (HTML allowed)
 *           example: "<p>Experience the wildlife of Kenya...</p>"
 *         excerpt:
 *           type: string
 *           description: Short excerpt or summary
 *           example: "A 7-day safari adventure through Kenya's national parks"
 *           maxLength: 500
 *         postType:
 *           type: string
 *           enum: [Articles, Packages]
 *           description: Type of post
 *           example: "Packages"
 *         price:
 *           type: number
 *           description: Price (required for Packages)
 *           example: 250000
 *           minimum: 0
 *         currency:
 *           type: string
 *           enum: [NGN, USD, EUR, GBP]
 *           description: Currency code
 *           example: "NGN"
 *           default: "NGN"
 *         categories:
 *           type: array
 *           items:
 *             type: string
 *           description: Array of category IDs
 *           example: ["60d5ec49f8c6a7001c8a1b2e"]
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *           description: Array of tags
 *           example: ["safari", "kenya", "wildlife"]
 *         author:
 *           type: string
 *           description: Author user ID
 *           example: "60d5ec49f8c6a7001c8a1b2f"
 *         status:
 *           type: string
 *           enum: [Draft, Published, Archived]
 *           description: Post status
 *           example: "Published"
 *           default: "Draft"
 *         featuredImage:
 *           type: string
 *           description: URL to featured image
 *           example: "https://example.com/images/safari.jpg"
 *         gallery:
 *           type: array
 *           items:
 *             type: string
 *           description: Array of image URLs
 *           example: ["https://example.com/images/safari1.jpg"]
 *         metadata:
 *           type: object
 *           properties:
 *             seoTitle:
 *               type: string
 *               maxLength: 60
 *               example: "Kenya Safari Package - 7 Days Wildlife Adventure"
 *             seoDescription:
 *               type: string
 *               maxLength: 160
 *               example: "Book your 7-day Kenya safari package. Experience wildlife, luxury lodges, and unforgettable memories."
 *             duration:
 *               type: string
 *               description: Package duration (required for Packages)
 *               example: "7 days, 6 nights"
 *             location:
 *               type: string
 *               description: Package location (required for Packages)
 *               example: "Kenya - Masai Mara, Amboseli"
 *             inclusions:
 *               type: array
 *               items:
 *                 type: string
 *               description: What's included in the package
 *               example: ["Accommodation", "Meals", "Game drives", "Airport transfers"]
 *             exclusions:
 *               type: array
 *               items:
 *                 type: string
 *               description: What's not included
 *               example: ["International flights", "Visa fees", "Personal expenses"]
 *             maxParticipants:
 *               type: integer
 *               description: Maximum participants (required for Packages)
 *               example: 12
 *               minimum: 1
 *             difficulty:
 *               type: string
 *               enum: [Easy, Moderate, Challenging, Expert]
 *               description: Difficulty level (required for Packages)
 *               example: "Moderate"
 *             readingTime:
 *               type: integer
 *               description: Estimated reading time in minutes (for Articles)
 *               example: 5
 *             wordCount:
 *               type: integer
 *               description: Word count (for Articles)
 *               example: 1200
 *         publishedAt:
 *           type: string
 *           format: date-time
 *           description: Publication date
 *         viewCount:
 *           type: integer
 *           description: Number of views
 *           example: 150
 *           minimum: 0
 *         isActive:
 *           type: boolean
 *           description: Whether the post is active
 *           example: true
 *           default: true
 *         isFeatured:
 *           type: boolean
 *           description: Whether the post is featured
 *           example: false
 *           default: false
 *         availability:
 *           type: object
 *           description: Package availability (for Packages only)
 *           properties:
 *             startDate:
 *               type: string
 *               format: date
 *               description: Package start date
 *               example: "2024-06-01"
 *             endDate:
 *               type: string
 *               format: date
 *               description: Package end date
 *               example: "2024-12-31"
 *             isAvailable:
 *               type: boolean
 *               description: Whether the package is currently available
 *               example: true
 *               default: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *     
 *     CreatePostRequest:
 *       type: object
 *       required:
 *         - title
 *         - content
 *         - postType
 *       properties:
 *         title:
 *           type: string
 *           maxLength: 200
 *           example: "Amazing Safari Package in Kenya"
 *         content:
 *           type: string
 *           example: "<p>Experience the wildlife of Kenya...</p>"
 *         excerpt:
 *           type: string
 *           maxLength: 500
 *           example: "A 7-day safari adventure"
 *         postType:
 *           type: string
 *           enum: [Articles, Packages]
 *           example: "Packages"
 *         price:
 *           type: number
 *           minimum: 0
 *           example: 250000
 *         currency:
 *           type: string
 *           enum: [NGN, USD, EUR, GBP]
 *           example: "NGN"
 *         categories:
 *           type: array
 *           items:
 *             type: string
 *           example: ["60d5ec49f8c6a7001c8a1b2e"]
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *           example: ["safari", "kenya"]
 *         status:
 *           type: string
 *           enum: [Draft, Published, Archived]
 *           example: "Draft"
 *         featuredImage:
 *           type: string
 *           example: "https://example.com/images/safari.jpg"
 *         metadata:
 *           type: object
 *           properties:
 *             duration:
 *               type: string
 *               example: "7 days, 6 nights"
 *             location:
 *               type: string
 *               example: "Kenya - Masai Mara"
 *             inclusions:
 *               type: array
 *               items:
 *                 type: string
 *               example: ["Accommodation", "Meals"]
 *             exclusions:
 *               type: array
 *               items:
 *                 type: string
 *               example: ["International flights"]
 *             maxParticipants:
 *               type: integer
 *               minimum: 1
 *               example: 12
 *             difficulty:
 *               type: string
 *               enum: [Easy, Moderate, Challenging, Expert]
 *               example: "Moderate"
 *         availability:
 *           type: object
 *           properties:
 *             startDate:
 *               type: string
 *               format: date
 *               example: "2024-06-01"
 *             endDate:
 *               type: string
 *               format: date
 *               example: "2024-12-31"
 *             isAvailable:
 *               type: boolean
 *               example: true
 *     
 *     UpdatePostRequest:
 *       allOf:
 *         - $ref: '#/components/schemas/CreatePostRequest'
 *         - type: object
 *           properties:
 *             slug:
 *               type: string
 *               pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$"
 *               example: "amazing-safari-package-kenya"
 *     
 *     # Category Schemas
 *     Category:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         _id:
 *           type: string
 *           description: Category ID
 *           example: "60d5ec49f8c6a7001c8a1b2e"
 *         name:
 *           type: string
 *           description: Category name
 *           example: "Safari Packages"
 *           maxLength: 100
 *         slug:
 *           type: string
 *           description: URL-friendly slug
 *           example: "safari-packages"
 *           pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$"
 *         description:
 *           type: string
 *           description: Category description
 *           example: "Exciting safari packages across Africa"
 *           maxLength: 1000
 *         parentCategory:
 *           type: string
 *           description: Parent category ID (for hierarchical categories)
 *           example: "60d5ec49f8c6a7001c8a1b2d"
 *         isActive:
 *           type: boolean
 *           description: Whether the category is active
 *           example: true
 *           default: true
 *         sortOrder:
 *           type: integer
 *           description: Sort order for display
 *           example: 1
 *           minimum: 0
 *           default: 0
 *         metadata:
 *           type: object
 *           properties:
 *             seoTitle:
 *               type: string
 *               maxLength: 60
 *               example: "Safari Packages - African Wildlife Adventures"
 *             seoDescription:
 *               type: string
 *               maxLength: 160
 *               example: "Discover amazing safari packages across Africa. Book your wildlife adventure today."
 *             color:
 *               type: string
 *               pattern: "^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
 *               example: "#FF6B35"
 *             icon:
 *               type: string
 *               example: "safari-icon"
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     
 *     CreateCategoryRequest:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *           maxLength: 100
 *           example: "Safari Packages"
 *         description:
 *           type: string
 *           maxLength: 1000
 *           example: "Exciting safari packages across Africa"
 *         parentCategory:
 *           type: string
 *           example: "60d5ec49f8c6a7001c8a1b2d"
 *         sortOrder:
 *           type: integer
 *           minimum: 0
 *           example: 1
 *         metadata:
 *           type: object
 *           properties:
 *             seoTitle:
 *               type: string
 *               maxLength: 60
 *             seoDescription:
 *               type: string
 *               maxLength: 160
 *             color:
 *               type: string
 *               pattern: "^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
 *             icon:
 *               type: string
 *     
 *     UpdateCategoryRequest:
 *       allOf:
 *         - $ref: '#/components/schemas/CreateCategoryRequest'
 *         - type: object
 *           properties:
 *             slug:
 *               type: string
 *               pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$"
 *               example: "safari-packages"
 *             isActive:
 *               type: boolean
 *               example: true
 *     
 *     # Analytics Schemas
 *     AnalyticsSummary:
 *       type: object
 *       properties:
 *         totalRevenue:
 *           type: number
 *           description: Total revenue across all services
 *           example: 15750000
 *         totalProfit:
 *           type: number
 *           description: Total profit margin
 *           example: 3150000
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
 *         periodComparison:
 *           type: object
 *           properties:
 *             revenueGrowth:
 *               type: number
 *               description: Revenue growth percentage compared to previous period
 *               example: 15.5
 *             transactionGrowth:
 *               type: number
 *               description: Transaction count growth percentage
 *               example: 8.2
 *         topPerformingServices:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               itemType:
 *                 type: string
 *                 example: "Flight"
 *               revenue:
 *                 type: number
 *                 example: 8500000
 *               transactionCount:
 *                 type: integer
 *                 example: 450
 *     
 *     RevenueAnalytics:
 *       type: object
 *       properties:
 *         totalRevenue:
 *           type: number
 *           example: 15750000
 *         revenueByService:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               itemType:
 *                 type: string
 *                 example: "Flight"
 *               revenue:
 *                 type: number
 *                 example: 8500000
 *               percentage:
 *                 type: number
 *                 example: 54.0
 *         revenueByMonth:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               month:
 *                 type: string
 *                 example: "2024-01"
 *               revenue:
 *                 type: number
 *                 example: 1250000
 *         dateRange:
 *           type: object
 *           properties:
 *             startDate:
 *               type: string
 *               format: date
 *               example: "2024-01-01"
 *             endDate:
 *               type: string
 *               format: date
 *               example: "2024-12-31"
 *     
 *     CustomerAnalytics:
 *       type: object
 *       properties:
 *         totalCustomers:
 *           type: integer
 *           description: Total unique customers
 *           example: 850
 *         newCustomers:
 *           type: integer
 *           description: New customers in the period
 *           example: 125
 *         returningCustomers:
 *           type: integer
 *           description: Returning customers
 *           example: 725
 *         customerSegmentation:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               segment:
 *                 type: string
 *                 example: "Individual"
 *               count:
 *                 type: integer
 *                 example: 650
 *               revenue:
 *                 type: number
 *                 example: 8500000
 *         averageCustomerValue:
 *           type: number
 *           description: Average customer lifetime value
 *           example: 18529
 *         topSpendingCustomers:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               customerId:
 *                 type: string
 *                 example: "60d5ec49f8c6a7001c8a1b2c"
 *               totalSpent:
 *                 type: number
 *                 example: 450000
 *               transactionCount:
 *                 type: integer
 *                 example: 8
 *     
 *     # Transaction/Ledger Schemas
 *     Transaction:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: "60d5ec49f8c6a7001c8a1b30"
 *         userId:
 *           type: string
 *           description: User ID (null for guest transactions)
 *           example: "60d5ec49f8c6a7001c8a1b2c"
 *         guestEmail:
 *           type: string
 *           format: email
 *           description: Guest email (for non-authenticated purchases)
 *           example: "guest@example.com"
 *         guestPhoneNumber:
 *           type: string
 *           description: Guest phone number
 *           example: "+2348012345678"
 *         transactionReference:
 *           type: string
 *           description: Unique transaction reference
 *           example: "TTP-FL-1678888888888"
 *         amount:
 *           type: number
 *           description: Base amount before service charges
 *           example: 500000
 *         currency:
 *           type: string
 *           example: "NGN"
 *         status:
 *           type: string
 *           enum: [Pending, Completed, Failed, Cancelled, Refunded]
 *           example: "Completed"
 *         paymentGateway:
 *           type: string
 *           enum: [Paystack, Flutterwave, Stripe]
 *           example: "Paystack"
 *         productType:
 *           type: string
 *           enum: [Flight Booking, Hotel Reservation, Travel Insurance, Visa Processing, Package]
 *           example: "Flight Booking"
 *         itemType:
 *           type: string
 *           enum: [Flight, Hotel, Insurance, Visa, Package]
 *           example: "Flight"
 *         packageId:
 *           type: string
 *           description: Package ID (for package purchases)
 *           example: "60d5ec49f8c6a7001c8a1b2d"
 *         serviceCharge:
 *           type: number
 *           description: Service charge applied
 *           example: 5000
 *         profitMargin:
 *           type: number
 *           description: Profit margin earned
 *           example: 25000
 *         totalAmountPaid:
 *           type: number
 *           description: Total amount paid by customer
 *           example: 505000
 *         customerSegment:
 *           type: string
 *           enum: [Individual, Business, Group, Corporate]
 *           example: "Individual"
 *         bookingChannel:
 *           type: string
 *           enum: [Web, Mobile, API, Admin]
 *           example: "Web"
 *         seasonality:
 *           type: string
 *           enum: [Peak, Off-Peak, Shoulder]
 *           example: "Peak"
 *         productDetails:
 *           type: object
 *           description: Product-specific details
 *           example: {"flightNumber": "BA123", "route": "LOS-LHR"}
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     
 *     # Package Purchase Schemas
 *     PackagePurchaseRequest:
 *       type: object
 *       required:
 *         - participants
 *       properties:
 *         customerDetails:
 *           type: object
 *           properties:
 *             email:
 *               type: string
 *               format: email
 *               description: Required for guest checkout
 *               example: "customer@example.com"
 *             phoneNumber:
 *               type: string
 *               description: Required for guest checkout
 *               example: "+2348012345678"
 *             firstName:
 *               type: string
 *               example: "John"
 *             lastName:
 *               type: string
 *               example: "Doe"
 *         participants:
 *           type: integer
 *           minimum: 1
 *           description: Number of participants
 *           example: 2
 *         specialRequests:
 *           type: string
 *           description: Special requests or requirements
 *           example: "Vegetarian meals required"
 *     
 *     PackagePaymentVerification:
 *       type: object
 *       required:
 *         - reference
 *       properties:
 *         reference:
 *           type: string
 *           description: Payment reference from Paystack
 *           example: "TTP-PKG-1678888888888-abc123def"
 *     
 *     # Visa Application Schemas
 *     VisaDocumentUpload:
 *       type: object
 *       required:
 *         - destinationCountry
 *         - visaType
 *         - travelPurpose
 *       properties:
 *         destinationCountry:
 *           type: string
 *           description: Country for visa application
 *           example: "United Kingdom"
 *         visaType:
 *           type: string
 *           enum: [Tourist, Business, Student, Transit, Work]
 *           description: Type of visa
 *           example: "Tourist"
 *         travelPurpose:
 *           type: string
 *           description: Purpose of travel
 *           example: "Tourism and sightseeing"
 *         urgency:
 *           type: string
 *           enum: [Standard, Express, Super Express]
 *           description: Processing urgency
 *           example: "Standard"
 *           default: "Standard"
 *     
 *     # Pagination Schema
 *     Pagination:
 *       type: object
 *       properties:
 *         currentPage:
 *           type: integer
 *           description: Current page number
 *           example: 1
 *           minimum: 1
 *         totalPages:
 *           type: integer
 *           description: Total number of pages
 *           example: 10
 *           minimum: 0
 *         totalItems:
 *           type: integer
 *           description: Total number of items across all pages
 *           example: 95
 *           minimum: 0
 *         itemsPerPage:
 *           type: integer
 *           description: Number of items per page
 *           example: 10
 *           minimum: 1
 *           maximum: 100
 *         hasNext:
 *           type: boolean
 *           description: Whether there is a next page
 *           example: true
 *         hasPrev:
 *           type: boolean
 *           description: Whether there is a previous page
 *           example: false
 *         nextPage:
 *           type: integer
 *           description: Next page number (null if no next page)
 *           example: 2
 *           nullable: true
 *         prevPage:
 *           type: integer
 *           description: Previous page number (null if no previous page)
 *           example: null
 *           nullable: true
 *         startIndex:
 *           type: integer
 *           description: Starting index of items on current page
 *           example: 1
 *         endIndex:
 *           type: integer
 *           description: Ending index of items on current page
 *           example: 10
 *         links:
 *           type: object
 *           description: Navigation links
 *           properties:
 *             first:
 *               type: string
 *               description: Link to first page
 *               example: "/api/v1/affiliates?page=1&limit=10"
 *             last:
 *               type: string
 *               description: Link to last page
 *               example: "/api/v1/affiliates?page=10&limit=10"
 *             next:
 *               type: string
 *               description: Link to next page
 *               example: "/api/v1/affiliates?page=2&limit=10"
 *               nullable: true
 *             prev:
 *               type: string
 *               description: Link to previous page
 *               example: null
 *               nullable: true
 *     
 *     PaginatedResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/StandardSuccessResponse'
 *         - type: object
 *           properties:
 *             data:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   description: Array of items for current page
 *                   items:
 *                     type: object
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *                 filters:
 *                   type: object
 *                   description: Applied filters
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: "active"
 *                     dateRange:
 *                       type: object
 *                       properties:
 *                         startDate:
 *                           type: string
 *                           format: date
 *                           example: "2024-01-01"
 *                         endDate:
 *                           type: string
 *                           format: date
 *                           example: "2024-12-31"
 *                     search:
 *                       type: string
 *                       example: "travel"
 *                 sorting:
 *                   type: object
 *                   description: Applied sorting
 *                   properties:
 *                     sortBy:
 *                       type: string
 *                       example: "createdAt"
 *                     sortOrder:
 *                       type: string
 *                       enum: [asc, desc]
 *                       example: "desc"
 *     
 *     # Common Shared Schemas
 *     Address:
 *       type: object
 *       properties:
 *         street:
 *           type: string
 *           description: Street address
 *           example: "123 Business Street"
 *           maxLength: 200
 *         city:
 *           type: string
 *           description: City name
 *           example: "Lagos"
 *           maxLength: 100
 *         state:
 *           type: string
 *           description: State or province
 *           example: "Lagos State"
 *           maxLength: 100
 *         country:
 *           type: string
 *           description: Country name
 *           example: "Nigeria"
 *           maxLength: 100
 *         postalCode:
 *           type: string
 *           description: Postal or ZIP code
 *           example: "100001"
 *           maxLength: 20
 *         coordinates:
 *           type: object
 *           description: Geographic coordinates
 *           properties:
 *             latitude:
 *               type: number
 *               description: Latitude coordinate
 *               example: 6.5244
 *               minimum: -90
 *               maximum: 90
 *             longitude:
 *               type: number
 *               description: Longitude coordinate
 *               example: 3.3792
 *               minimum: -180
 *               maximum: 180
 *     
 *     ContactInfo:
 *       type: object
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           description: Email address
 *           example: "contact@example.com"
 *         phone:
 *           type: string
 *           description: Phone number in E.164 format
 *           example: "+2348012345678"
 *           pattern: "^\\+?[1-9]\\d{1,14}$"
 *         website:
 *           type: string
 *           format: uri
 *           description: Website URL
 *           example: "https://example.com"
 *         socialMedia:
 *           type: object
 *           description: Social media handles
 *           properties:
 *             facebook:
 *               type: string
 *               example: "facebook.com/example"
 *             twitter:
 *               type: string
 *               example: "@example"
 *             instagram:
 *               type: string
 *               example: "@example"
 *             linkedin:
 *               type: string
 *               example: "linkedin.com/company/example"
 *     
 *     AuditInfo:
 *       type: object
 *       properties:
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Record creation timestamp
 *           example: "2024-01-15T10:30:00.000Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *           example: "2024-01-15T10:30:00.000Z"
 *         createdBy:
 *           type: string
 *           description: ID of user who created the record
 *           example: "60d5ec49f8c6a7001c8a1b2c"
 *         updatedBy:
 *           type: string
 *           description: ID of user who last updated the record
 *           example: "60d5ec49f8c6a7001c8a1b2d"
 *         version:
 *           type: integer
 *           description: Record version for optimistic locking
 *           example: 1
 *           minimum: 1
 *     
 *     HealthCheckResponse:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           enum: [healthy, degraded, unhealthy]
 *           description: Overall health status
 *           example: "healthy"
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: Health check timestamp
 *           example: "2024-01-15T10:30:00.000Z"
 *         version:
 *           type: string
 *           description: API version
 *           example: "1.0.0"
 *         uptime:
 *           type: number
 *           description: Service uptime in seconds
 *           example: 86400
 *         services:
 *           type: object
 *           description: Individual service health status
 *           properties:
 *             database:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy, degraded, unhealthy]
 *                   example: "healthy"
 *                 responseTime:
 *                   type: number
 *                   description: Response time in milliseconds
 *                   example: 25
 *             qrCodeService:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy, degraded, unhealthy]
 *                   example: "healthy"
 *                 responseTime:
 *                   type: number
 *                   example: 15
 *             paymentGateway:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy, degraded, unhealthy]
 *                   example: "healthy"
 *                 responseTime:
 *                   type: number
 *                   example: 150
 *     
 *     # Standard Response Schemas
 *     StandardSuccessResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Operation completed successfully"
 *         data:
 *           type: object
 *           nullable: true
 *           description: Response data payload
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: Response timestamp
 *           example: "2024-01-15T10:30:00.000Z"
 *     
 *     StandardErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: "Operation failed"
 *         error:
 *           type: string
 *           description: Error details
 *           example: "Validation failed"
 *         errorCode:
 *           type: string
 *           description: Machine-readable error code
 *           example: "VALIDATION_ERROR"
 *         errors:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               field:
 *                 type: string
 *                 description: Field name that caused the error
 *                 example: "email"
 *               message:
 *                 type: string
 *                 description: Error message for the field
 *                 example: "Email is required"
 *               code:
 *                 type: string
 *                 description: Error code for the field
 *                 example: "REQUIRED_FIELD"
 *           description: Array of detailed error objects
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: Error timestamp
 *           example: "2024-01-15T10:30:00.000Z"
 *         requestId:
 *           type: string
 *           description: Unique request identifier for debugging
 *           example: "req_abc123def456"
 *     
 *     # QR Code Schemas
 *     QRCodeData:
 *       type: object
 *       required:
 *         - qrId
 *         - type
 *         - id
 *         - timestamp
 *         - url
 *       properties:
 *         qrId:
 *           type: string
 *           description: Unique QR code identifier
 *           example: "qr_550e8400-e29b-41d4-a716-446655440000"
 *         type:
 *           type: string
 *           enum: [affiliate, commission, withdrawal, referral]
 *           description: Type of QR code
 *           example: "affiliate"
 *         id:
 *           type: string
 *           description: Related record ID (affiliate ID, transaction ID, etc.)
 *           example: "60d5ec49f8c6a7001c8a1b2c"
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: QR code generation timestamp
 *           example: "2024-01-15T10:30:00.000Z"
 *         url:
 *           type: string
 *           format: uri
 *           description: QR code URL for scanning
 *           example: "https://app.travelplace.com/qr/qr_550e8400-e29b-41d4-a716-446655440000"
 *         metadata:
 *           $ref: '#/components/schemas/QRCodeMetadata'
 *     
 *     QRCodeMetadata:
 *       type: object
 *       required:
 *         - version
 *         - source
 *       properties:
 *         version:
 *           type: string
 *           description: QR code format version
 *           example: "1.0"
 *           pattern: "^\\d+\\.\\d+$"
 *         source:
 *           type: string
 *           description: Source system that generated the QR code
 *           example: "travel-place-api"
 *         expiresAt:
 *           type: string
 *           format: date-time
 *           description: QR code expiration timestamp (null for non-expiring codes)
 *           example: "2024-02-15T10:30:00.000Z"
 *           nullable: true
 *         affiliateId:
 *           type: string
 *           description: Associated affiliate ID (for affiliate/referral QR codes)
 *           example: "AFF-001234"
 *         referralCode:
 *           type: string
 *           description: Associated referral code
 *           example: "TRAVEL-PARTNER-123"
 *         businessName:
 *           type: string
 *           description: Business name (for affiliate QR codes)
 *           example: "Travel Partners Ltd"
 *         amount:
 *           type: number
 *           description: Associated amount (for commission/withdrawal QR codes)
 *           example: 25000
 *         currency:
 *           type: string
 *           description: Currency code
 *           example: "NGN"
 *         serviceType:
 *           type: string
 *           description: Service type (for commission QR codes)
 *           example: "Flight"
 *         bookingReference:
 *           type: string
 *           description: Booking reference (for commission QR codes)
 *           example: "TTP-FL-1678888888888"
 *         status:
 *           type: string
 *           description: Associated transaction status
 *           example: "completed"
 *         campaign:
 *           type: string
 *           description: Marketing campaign identifier
 *           example: "summer-2024"
 *         bankDetails:
 *           type: object
 *           description: Bank details (for withdrawal QR codes, sanitized)
 *           properties:
 *             accountName:
 *               type: string
 *               example: "Travel Partners Ltd"
 *             bankName:
 *               type: string
 *               example: "First Bank of Nigeria"
 *         environment:
 *           type: string
 *           description: Environment where QR code was generated
 *           example: "production"
 *         apiVersion:
 *           type: string
 *           description: API version used for generation
 *           example: "1.0"
 *         generatedFrom:
 *           type: object
 *           description: Generation context
 *           properties:
 *             userAgent:
 *               type: string
 *               example: "Mozilla/5.0..."
 *             ip:
 *               type: string
 *               description: Masked IP address for privacy
 *               example: "192.168.1.xxx"
 *     
 *     QRCodeResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/StandardSuccessResponse'
 *         - type: object
 *           properties:
 *             data:
 *               type: object
 *               properties:
 *                 qrCode:
 *                   type: string
 *                   description: Base64 encoded QR code image
 *                   example: "iVBORw0KGgoAAAANSUhEUgAAAQAAAAEA..."
 *                 url:
 *                   type: string
 *                   format: uri
 *                   description: QR code URL
 *                   example: "https://app.travelplace.com/qr/qr_550e8400-e29b-41d4-a716-446655440000"
 *                 metadata:
 *                   $ref: '#/components/schemas/QRCodeData'
 *     
 *     QRCodeValidationResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/StandardSuccessResponse'
 *         - type: object
 *           properties:
 *             data:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                   description: Whether the QR code is valid
 *                   example: true
 *                 reason:
 *                   type: string
 *                   description: Reason for validation failure (if invalid)
 *                   example: "QR code has expired"
 *                 qrData:
 *                   $ref: '#/components/schemas/QRCodeData'
 *     
 *     # Referral Tracking Schemas
 *     ReferralTracking:
 *       type: object
 *       required:
 *         - affiliateId
 *         - customerId
 *         - referralCode
 *         - referralSource
 *       properties:
 *         _id:
 *           type: string
 *           description: Referral tracking record ID
 *           example: "60d5ec49f8c6a7001c8a1b2c"
 *         affiliateId:
 *           type: string
 *           description: Reference to affiliate
 *           example: "60d5ec49f8c6a7001c8a1b2d"
 *         customerId:
 *           type: string
 *           description: Reference to customer
 *           example: "60d5ec49f8c6a7001c8a1b2e"
 *         referralCode:
 *           type: string
 *           description: Referral code used
 *           example: "TRAVEL-PARTNER-123"
 *         referralSource:
 *           type: string
 *           enum: [link, qr_code, email, social_media]
 *           description: Source of the referral
 *           example: "qr_code"
 *         status:
 *           type: string
 *           enum: [active, converted, blocked, expired]
 *           description: Referral status
 *           example: "active"
 *         ipAddress:
 *           type: string
 *           description: IP address when referral was tracked
 *           example: "192.168.1.100"
 *         userAgent:
 *           type: string
 *           description: User agent when referral was tracked
 *           example: "Mozilla/5.0..."
 *         referrerUrl:
 *           type: string
 *           description: Referrer URL
 *           example: "https://google.com"
 *         landingPage:
 *           type: string
 *           description: Landing page URL
 *           example: "https://travelplace.com/packages"
 *         deviceInfo:
 *           type: object
 *           properties:
 *             type:
 *               type: string
 *               enum: [desktop, mobile, tablet, unknown]
 *               example: "mobile"
 *             browser:
 *               type: string
 *               example: "Chrome"
 *             os:
 *               type: string
 *               example: "iOS"
 *         geolocation:
 *           type: object
 *           properties:
 *             country:
 *               type: string
 *               example: "Nigeria"
 *             region:
 *               type: string
 *               example: "Lagos"
 *             city:
 *               type: string
 *               example: "Lagos"
 *             coordinates:
 *               type: object
 *               properties:
 *                 latitude:
 *                   type: number
 *                   example: 6.5244
 *                 longitude:
 *                   type: number
 *                   example: 3.3792
 *         utmParameters:
 *           type: object
 *           properties:
 *             source:
 *               type: string
 *               example: "facebook"
 *             medium:
 *               type: string
 *               example: "social"
 *             campaign:
 *               type: string
 *               example: "summer-2024"
 *             term:
 *               type: string
 *               example: "travel-deals"
 *             content:
 *               type: string
 *               example: "banner-ad"
 *         totalBookings:
 *           type: integer
 *           description: Total bookings attributed to this referral
 *           example: 3
 *           minimum: 0
 *         totalValue:
 *           type: number
 *           description: Total value of attributed bookings
 *           example: 150000
 *           minimum: 0
 *         totalCommission:
 *           type: number
 *           description: Total commission generated
 *           example: 7500
 *           minimum: 0
 *         bookingHistory:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ReferralBooking'
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Referral creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *         convertedAt:
 *           type: string
 *           format: date-time
 *           description: Conversion timestamp
 *           nullable: true
 *         blockedAt:
 *           type: string
 *           format: date-time
 *           description: Block timestamp
 *           nullable: true
 *         blockReason:
 *           type: string
 *           description: Reason for blocking
 *           example: "Suspected fraud"
 *     
 *     ReferralBooking:
 *       type: object
 *       properties:
 *         bookingReference:
 *           type: string
 *           description: Booking reference number
 *           example: "TTP-FL-1678888888888"
 *         serviceType:
 *           type: string
 *           description: Type of service booked
 *           example: "Flight"
 *         bookingAmount:
 *           type: number
 *           description: Booking amount
 *           example: 50000
 *         commissionGenerated:
 *           type: number
 *           description: Commission generated from this booking
 *           example: 2500
 *         currency:
 *           type: string
 *           description: Currency code
 *           example: "NGN"
 *         bookedAt:
 *           type: string
 *           format: date-time
 *           description: Booking timestamp
 *     
 *     ReferralTrackingRequest:
 *       type: object
 *       required:
 *         - referralCode
 *         - customerData
 *       properties:
 *         referralCode:
 *           type: string
 *           description: Referral code to track
 *           example: "TRAVEL-PARTNER-123"
 *         customerData:
 *           type: object
 *           required:
 *             - customerId
 *             - customerEmail
 *           properties:
 *             customerId:
 *               type: string
 *               description: Customer ID
 *               example: "60d5ec49f8c6a7001c8a1b2e"
 *             customerEmail:
 *               type: string
 *               format: email
 *               description: Customer email
 *               example: "customer@example.com"
 *         requestData:
 *           type: object
 *           properties:
 *             ipAddress:
 *               type: string
 *               example: "192.168.1.100"
 *             userAgent:
 *               type: string
 *               example: "Mozilla/5.0..."
 *             referrerUrl:
 *               type: string
 *               example: "https://google.com"
 *             landingPage:
 *               type: string
 *               example: "https://travelplace.com/packages"
 *             deviceInfo:
 *               type: object
 *               properties:
 *                 type:
 *                   type: string
 *                   enum: [desktop, mobile, tablet, unknown]
 *                 browser:
 *                   type: string
 *                 os:
 *                   type: string
 *             geolocation:
 *               type: object
 *               properties:
 *                 country:
 *                   type: string
 *                 region:
 *                   type: string
 *                 city:
 *                   type: string
 *                 latitude:
 *                   type: number
 *                 longitude:
 *                   type: number
 *             utmParameters:
 *               type: object
 *               properties:
 *                 utm_source:
 *                   type: string
 *                 utm_medium:
 *                   type: string
 *                 utm_campaign:
 *                   type: string
 *                 utm_term:
 *                   type: string
 *                 utm_content:
 *                   type: string
 *     
 *     ReferralTrackingResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/StandardSuccessResponse'
 *         - type: object
 *           properties:
 *             data:
 *               type: object
 *               properties:
 *                 referral:
 *                   $ref: '#/components/schemas/ReferralTracking'
 *                 isNew:
 *                   type: boolean
 *                   description: Whether this is a new referral
 *                   example: true
 *                 affiliate:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "60d5ec49f8c6a7001c8a1b2d"
 *                     businessName:
 *                       type: string
 *                       example: "Travel Partners Ltd"
 *                     affiliateId:
 *                       type: string
 *                       example: "AFF-001234"
 *     
 *     ReferralStats:
 *       type: object
 *       properties:
 *         overview:
 *           type: object
 *           properties:
 *             totalReferrals:
 *               type: integer
 *               description: Total number of referrals
 *               example: 150
 *             convertedReferrals:
 *               type: integer
 *               description: Number of converted referrals
 *               example: 45
 *             totalBookings:
 *               type: integer
 *               description: Total bookings from referrals
 *               example: 120
 *             totalValue:
 *               type: number
 *               description: Total value of referral bookings
 *               example: 2500000
 *             conversionRate:
 *               type: number
 *               description: Conversion rate percentage
 *               example: 30.0
 *         sourceBreakdown:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               _id:
 *                 type: string
 *                 description: Referral source
 *                 example: "qr_code"
 *               count:
 *                 type: integer
 *                 description: Number of referrals from this source
 *                 example: 75
 *               totalValue:
 *                 type: number
 *                 description: Total value from this source
 *                 example: 1250000
 *               convertedCount:
 *                 type: integer
 *                 description: Number of conversions from this source
 *                 example: 25
 *               conversionRate:
 *                 type: number
 *                 description: Conversion rate for this source
 *                 example: 33.3
 *         monthlyPerformance:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               _id:
 *                 type: object
 *                 properties:
 *                   year:
 *                     type: integer
 *                     example: 2024
 *                   month:
 *                     type: integer
 *                     example: 1
 *               referrals:
 *                 type: integer
 *                 example: 25
 *               conversions:
 *                 type: integer
 *                 example: 8
 *               totalValue:
 *                 type: number
 *                 example: 400000
 *               totalBookings:
 *                 type: integer
 *                 example: 20
 *               conversionRate:
 *                 type: number
 *                 example: 32.0
 *         topPerformers:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ReferralTracking'
 *     
 *     # Payment Response Schema
 *     PaymentInitiationResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Payment initiated successfully"
 *         data:
 *           type: object
 *           properties:
 *             authorizationUrl:
 *               type: string
 *               description: Paystack authorization URL
 *               example: "https://checkout.paystack.com/abc123def456"
 *             reference:
 *               type: string
 *               description: Transaction reference
 *               example: "TTP-FL-1678888888888"
 *             amount:
 *               type: number
 *               description: Total amount to be paid
 *               example: 505000
 *             currency:
 *               type: string
 *               example: "NGN"
 *   
 *   responses:
 *     # Standard HTTP Error Responses
 *     BadRequest:
 *       description: Bad request - validation error or malformed request
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StandardErrorResponse'
 *           example:
 *             success: false
 *             message: "Bad request"
 *             error: "Request validation failed"
 *             errorCode: "BAD_REQUEST"
 *             timestamp: "2024-01-15T10:30:00.000Z"
 *     
 *     Unauthorized:
 *       description: Authentication required
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StandardErrorResponse'
 *           example:
 *             success: false
 *             message: "Authentication required"
 *             error: "No valid authentication token provided"
 *             errorCode: "UNAUTHORIZED"
 *             timestamp: "2024-01-15T10:30:00.000Z"
 *     
 *     Forbidden:
 *       description: Insufficient permissions
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StandardErrorResponse'
 *           example:
 *             success: false
 *             message: "Access denied"
 *             error: "Insufficient role permissions"
 *             errorCode: "FORBIDDEN"
 *             timestamp: "2024-01-15T10:30:00.000Z"
 *     
 *     InternalServerError:
 *       description: Internal server error
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StandardErrorResponse'
 *           example:
 *             success: false
 *             message: "Internal server error"
 *             error: "An unexpected error occurred"
 *             errorCode: "INTERNAL_SERVER_ERROR"
 *             timestamp: "2024-01-15T10:30:00.000Z"
 *     
 *     # Alternative naming conventions (for module compatibility)
 *     BadRequestError:
 *       description: Bad request - validation error or malformed request
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StandardErrorResponse'
 *           example:
 *             success: false
 *             message: "Bad request"
 *             error: "Request validation failed"
 *             errorCode: "BAD_REQUEST"
 *             timestamp: "2024-01-15T10:30:00.000Z"
 *     
 *     UnauthorizedError:
 *       description: Authentication required
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StandardErrorResponse'
 *           example:
 *             success: false
 *             message: "Authentication required"
 *             error: "No valid authentication token provided"
 *             errorCode: "UNAUTHORIZED"
 *             timestamp: "2024-01-15T10:30:00.000Z"
 *     
 *     ForbiddenError:
 *       description: Insufficient permissions
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StandardErrorResponse'
 *           example:
 *             success: false
 *             message: "Access denied"
 *             error: "Insufficient role permissions"
 *             errorCode: "FORBIDDEN"
 *             timestamp: "2024-01-15T10:30:00.000Z"
 *     
 *     ServerError:
 *       description: Internal server error
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StandardErrorResponse'
 *           example:
 *             success: false
 *             message: "Internal server error"
 *             error: "An unexpected error occurred"
 *             errorCode: "INTERNAL_SERVER_ERROR"
 *             timestamp: "2024-01-15T10:30:00.000Z"
 *     
 *     # Legacy response definitions removed to avoid duplicates
 *     
 *     # Affiliate-specific Error Responses
 *     AffiliateNotFoundError:
 *       description: Affiliate not found
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StandardErrorResponse'
 *           example:
 *             success: false
 *             message: "Affiliate not found"
 *             error: "No affiliate found with the provided ID"
 *             errorCode: "AFFILIATE_NOT_FOUND"
 *             timestamp: "2024-01-15T10:30:00.000Z"
 *             requestId: "req_abc123def456"
 *     
 *     AffiliateInactiveError:
 *       description: Affiliate account is inactive
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StandardErrorResponse'
 *           example:
 *             success: false
 *             message: "Affiliate account is inactive"
 *             error: "This affiliate account has been suspended or deactivated"
 *             errorCode: "AFFILIATE_INACTIVE"
 *             timestamp: "2024-01-15T10:30:00.000Z"
 *             requestId: "req_abc123def456"
 *     
 *     InvalidReferralCodeError:
 *       description: Invalid referral code
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StandardErrorResponse'
 *           example:
 *             success: false
 *             message: "Invalid referral code"
 *             error: "The provided referral code is invalid or expired"
 *             errorCode: "INVALID_REFERRAL_CODE"
 *             timestamp: "2024-01-15T10:30:00.000Z"
 *             requestId: "req_abc123def456"
 *     
 *     # Wallet-specific Error Responses
 *     InsufficientFundsError:
 *       description: Insufficient wallet funds
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StandardErrorResponse'
 *           example:
 *             success: false
 *             message: "Insufficient funds"
 *             error: "Wallet balance is insufficient for this transaction"
 *             errorCode: "INSUFFICIENT_FUNDS"
 *             timestamp: "2024-01-15T10:30:00.000Z"
 *             requestId: "req_abc123def456"
 *     
 *     WalletFrozenError:
 *       description: Wallet is frozen
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StandardErrorResponse'
 *           example:
 *             success: false
 *             message: "Wallet is frozen"
 *             error: "This wallet has been frozen and cannot perform transactions"
 *             errorCode: "WALLET_FROZEN"
 *             timestamp: "2024-01-15T10:30:00.000Z"
 *             requestId: "req_abc123def456"
 *     
 *     TransactionNotFoundError:
 *       description: Transaction not found
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StandardErrorResponse'
 *           example:
 *             success: false
 *             message: "Transaction not found"
 *             error: "No transaction found with the provided reference"
 *             errorCode: "TRANSACTION_NOT_FOUND"
 *             timestamp: "2024-01-15T10:30:00.000Z"
 *             requestId: "req_abc123def456"
 *     
 *     # QR Code-specific Error Responses
 *     QRCodeExpiredError:
 *       description: QR code has expired
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StandardErrorResponse'
 *           example:
 *             success: false
 *             message: "QR code has expired"
 *             error: "This QR code is no longer valid"
 *             errorCode: "QR_CODE_EXPIRED"
 *             timestamp: "2024-01-15T10:30:00.000Z"
 *             requestId: "req_abc123def456"
 *     
 *     InvalidQRCodeError:
 *       description: Invalid QR code format
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StandardErrorResponse'
 *           example:
 *             success: false
 *             message: "Invalid QR code"
 *             error: "QR code format is invalid or corrupted"
 *             errorCode: "INVALID_QR_CODE"
 *             timestamp: "2024-01-15T10:30:00.000Z"
 *             requestId: "req_abc123def456"
 *     
 *     # Analytics-specific Error Responses
 *     InvalidDateRangeError:
 *       description: Invalid date range
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StandardErrorResponse'
 *           example:
 *             success: false
 *             message: "Invalid date range"
 *             error: "Start date must be before end date"
 *             errorCode: "INVALID_DATE_RANGE"
 *             timestamp: "2024-01-15T10:30:00.000Z"
 *             requestId: "req_abc123def456"
 *     
 *     DataNotAvailableError:
 *       description: Analytics data not available
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StandardErrorResponse'
 *           example:
 *             success: false
 *             message: "Data not available"
 *             error: "Analytics data is not available for the requested period"
 *             errorCode: "DATA_NOT_AVAILABLE"
 *             timestamp: "2024-01-15T10:30:00.000Z"
 *             requestId: "req_abc123def456"
 *     
 *     # Rate Limiting Error Response
 *     RateLimitExceededError:
 *       description: Rate limit exceeded
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StandardErrorResponse'
 *           example:
 *             success: false
 *             message: "Rate limit exceeded"
 *             error: "Too many requests. Please try again later"
 *             errorCode: "RATE_LIMIT_EXCEEDED"
 *             timestamp: "2024-01-15T10:30:00.000Z"
 *             requestId: "req_abc123def456"
 *     
 *     # Business Logic Error Responses
 *     ConflictError:
 *       description: Resource conflict
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StandardErrorResponse'
 *           example:
 *             success: false
 *             message: "Resource conflict"
 *             error: "A resource with this identifier already exists"
 *             errorCode: "RESOURCE_CONFLICT"
 *             timestamp: "2024-01-15T10:30:00.000Z"
 *             requestId: "req_abc123def456"
 *     
 *     ServiceUnavailableError:
 *       description: Service temporarily unavailable
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StandardErrorResponse'
 *           example:
 *             success: false
 *             message: "Service unavailable"
 *             error: "The requested service is temporarily unavailable"
 *             errorCode: "SERVICE_UNAVAILABLE"
 *             timestamp: "2024-01-15T10:30:00.000Z"
 *             requestId: "req_abc123def456"
 */

/**
 * @openapi
 * components:
 *   schemas:
 *     # Updated File Upload Schemas for AWS S3
 *     S3FileUploadResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "File uploaded successfully"
 *         data:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *               description: S3 object key
 *               example: "uploads/1678888888888-abc123-image.jpg"
 *             filename:
 *               type: string
 *               description: Original filename
 *               example: "sample_image.jpg"
 *             uploaded:
 *               type: string
 *               format: date-time
 *               description: Upload timestamp
 *               example: "2024-01-15T10:30:00.000Z"
 *             requireSignedURLs:
 *               type: boolean
 *               description: Whether the image requires signed URLs
 *               example: false
 *             bucket:
 *               type: string
 *               description: S3 bucket name
 *               example: "your-thetravelplace"
 *             region:
 *               type: string
 *               description: AWS region
 *               example: "eu-north-1"
 *             url:
 *               type: string
 *               description: Primary file URL (signed or public)
 *               example: "https://your-thetravelplace.s3.eu-north-1.amazonaws.com/uploads/1678888888888-abc123-image.jpg"
 *             signedUrl:
 *               type: string
 *               description: Signed URL for secure access
 *               example: "https://your-thetravelplace.s3.eu-north-1.amazonaws.com/uploads/1678888888888-abc123-image.jpg?X-Amz-Algorithm=..."
 *             publicUrl:
 *               type: string
 *               description: Public URL (if file is public)
 *               example: "https://your-thetravelplace.s3.eu-north-1.amazonaws.com/uploads/1678888888888-abc123-image.jpg"
 *             meta:
 *               type: object
 *               properties:
 *                 originalFilename:
 *                   type: string
 *                   example: "sample_image.jpg"
 *                 uploadedBy:
 *                   type: string
 *                   example: "user-id-123"
 *                 uploadedAt:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-15T10:30:00.000Z"

 *     
 *     # Enhanced Error Response Schema
 *     EnhancedErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         error:
 *           type: object
 *           properties:
 *             code:
 *               type: string
 *               description: Specific error code
 *               enum: [
 *                 "S3_UPLOAD_ERROR",
 *                 "S3_DELETE_ERROR", 
 *                 "S3_ACCESS_DENIED",
 *                 "S3_BUCKET_NOT_FOUND",
 *                 "AMADEUS_XML_PARSE_ERROR",
 *                 "AMADEUS_XML_TIMEOUT",
 *                 "AMADEUS_SOAP_FAULT",
 *                 "XML_VALIDATION_ERROR"
 *               ]
 *               example: "AMADEUS_XML_PARSE_ERROR"
 *             message:
 *               type: string
 *               description: Human-readable error message
 *               example: "Failed to parse XML response from Amadeus"
 *             details:
 *               type: object
 *               description: Additional error context
 *               properties:
 *                 xmlError:
 *                   type: string
 *                   example: "Invalid XML structure in SOAP response"
 *                 endpoint:
 *                   type: string
 *                   example: "/flight-search"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-15T10:30:00Z"
 *                 requestId:
 *                   type: string
 *                   example: "req-123-abc"
 *     
 *     # Health Check Schemas
 *     HealthCheckResponse:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           enum: [healthy, unhealthy, degraded]
 *           example: "healthy"
 *         timestamp:
 *           type: string
 *           format: date-time
 *           example: "2024-01-15T10:30:00Z"
 *         services:
 *           type: object
 *           properties:
 *             database:
 *               type: string
 *               enum: [healthy, unhealthy]
 *               example: "healthy"
 *             s3:
 *               type: string
 *               enum: [healthy, unhealthy]
 *               example: "healthy"
 *             amadeusXml:
 *               type: string
 *               enum: [healthy, unhealthy]
 *               example: "healthy"
 *         version:
 *           type: string
 *           example: "2.0.0"
 *         uptime:
 *           type: number
 *           description: Uptime in seconds
 *           example: 86400
 *     

 *     
 *     # Flight Booking Schemas
 *     FlightSearchRequest:
 *       type: object
 *       required:
 *         - originLocationCode
 *         - destinationLocationCode
 *         - departureDate
 *         - adults
 *       properties:
 *         originLocationCode:
 *           type: string
 *           pattern: "^[A-Z]{3}$"
 *           description: Origin airport IATA code (3 letters)
 *           example: "LOS"
 *         destinationLocationCode:
 *           type: string
 *           pattern: "^[A-Z]{3}$"
 *           description: Destination airport IATA code (3 letters)
 *           example: "JFK"
 *         departureDate:
 *           type: string
 *           format: date
 *           description: Departure date (YYYY-MM-DD)
 *           example: "2024-12-15"
 *         returnDate:
 *           type: string
 *           format: date
 *           description: Return date for round trip (optional)
 *           example: "2024-12-22"
 *         adults:
 *           type: integer
 *           minimum: 1
 *           maximum: 9
 *           description: Number of adult passengers
 *           example: 2
 *         children:
 *           type: integer
 *           minimum: 0
 *           maximum: 9
 *           description: Number of child passengers (2-11 years)
 *           example: 1
 *           default: 0
 *         travelClass:
 *           type: string
 *           enum: [ECONOMY, PREMIUM_ECONOMY, BUSINESS, FIRST]
 *           description: Preferred travel class
 *           example: "ECONOMY"
 *           default: "ECONOMY"
 *         currencyCode:
 *           type: string
 *           pattern: "^[A-Z]{3}$"
 *           description: Preferred currency for pricing
 *           example: "NGN"
 *           default: "NGN"
 *     
 *     FlightSearchResponse:
 *       type: object
 *       properties:
 *         meta:
 *           type: object
 *           properties:
 *             count:
 *               type: integer
 *               description: Number of flight offers returned
 *               example: 25
 *             currency:
 *               type: string
 *               example: "NGN"
 *             links:
 *               type: object
 *               properties:
 *                 self:
 *                   type: string
 *                   example: "https://api.amadeus.com/v2/shopping/flight-offers"
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/FlightOffer'
 *         dictionaries:
 *           type: object
 *           properties:
 *             locations:
 *               type: object
 *               additionalProperties:
 *                 type: object
 *                 properties:
 *                   cityCode:
 *                     type: string
 *                     example: "NYC"
 *                   countryCode:
 *                     type: string
 *                     example: "US"
 *             aircraft:
 *               type: object
 *               additionalProperties:
 *                 type: string
 *               example:
 *                 "763": "BOEING 767-300"
 *             currencies:
 *               type: object
 *               additionalProperties:
 *                 type: string
 *               example:
 *                 "NGN": "NIGERIAN NAIRA"
 *             carriers:
 *               type: object
 *               additionalProperties:
 *                 type: string
 *               example:
 *                 "DL": "DELTA AIR LINES"
 *     
 *     FlightOffer:
 *       type: object
 *       properties:
 *         type:
 *           type: string
 *           example: "flight-offer"
 *         id:
 *           type: string
 *           example: "1"
 *         source:
 *           type: string
 *           example: "GDS"
 *         instantTicketingRequired:
 *           type: boolean
 *           example: false
 *         nonHomogeneous:
 *           type: boolean
 *           example: false
 *         oneWay:
 *           type: boolean
 *           example: false
 *         lastTicketingDate:
 *           type: string
 *           format: date
 *           example: "2024-12-10"
 *         numberOfBookableSeats:
 *           type: integer
 *           example: 9
 *         itineraries:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/FlightItinerary'
 *         price:
 *           $ref: '#/components/schemas/FlightPrice'
 *         pricingOptions:
 *           type: object
 *           properties:
 *             fareType:
 *               type: array
 *               items:
 *                 type: string
 *               example: ["PUBLISHED"]
 *             includedCheckedBagsOnly:
 *               type: boolean
 *               example: true
 *         validatingAirlineCodes:
 *           type: array
 *           items:
 *             type: string
 *           example: ["DL"]
 *         travelerPricings:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/TravelerPricing'
 *     
 *     FlightItinerary:
 *       type: object
 *       properties:
 *         duration:
 *           type: string
 *           example: "PT15H30M"
 *         segments:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/FlightSegment'
 *     
 *     FlightSegment:
 *       type: object
 *       properties:
 *         departure:
 *           $ref: '#/components/schemas/FlightEndpoint'
 *         arrival:
 *           $ref: '#/components/schemas/FlightEndpoint'
 *         carrierCode:
 *           type: string
 *           example: "DL"
 *         number:
 *           type: string
 *           example: "156"
 *         aircraft:
 *           type: object
 *           properties:
 *             code:
 *               type: string
 *               example: "763"
 *         operating:
 *           type: object
 *           properties:
 *             carrierCode:
 *               type: string
 *               example: "DL"
 *         duration:
 *           type: string
 *           example: "PT10H30M"
 *         id:
 *           type: string
 *           example: "1"
 *         numberOfStops:
 *           type: integer
 *           example: 0
 *         blacklistedInEU:
 *           type: boolean
 *           example: false
 *     
 *     FlightEndpoint:
 *       type: object
 *       properties:
 *         iataCode:
 *           type: string
 *           example: "LOS"
 *         terminal:
 *           type: string
 *           example: "1"
 *         at:
 *           type: string
 *           format: date-time
 *           example: "2024-12-15T10:30:00"
 *     
 *     FlightPrice:
 *       type: object
 *       properties:
 *         currency:
 *           type: string
 *           example: "NGN"
 *         total:
 *           type: string
 *           example: "850000.00"
 *         base:
 *           type: string
 *           example: "750000.00"
 *         fees:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               amount:
 *                 type: string
 *                 example: "50000.00"
 *               type:
 *                 type: string
 *                 example: "SUPPLIER"
 *         grandTotal:
 *           type: string
 *           example: "855000.00"
 *     
 *     TravelerPricing:
 *       type: object
 *       properties:
 *         travelerId:
 *           type: string
 *           example: "1"
 *         fareOption:
 *           type: string
 *           example: "STANDARD"
 *         travelerType:
 *           type: string
 *           example: "ADULT"
 *         price:
 *           $ref: '#/components/schemas/FlightPrice'
 *         fareDetailsBySegment:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               segmentId:
 *                 type: string
 *                 example: "1"
 *               cabin:
 *                 type: string
 *                 example: "ECONOMY"
 *               fareBasis:
 *                 type: string
 *                 example: "UU1YXFII"
 *               class:
 *                 type: string
 *                 example: "U"
 *               includedCheckedBags:
 *                 type: object
 *                 properties:
 *                   quantity:
 *                     type: integer
 *                     example: 1
 *     
 *     FlightBookingRequest:
 *       type: object
 *       required:
 *         - flightDetails
 *         - passengerDetails
 *       properties:
 *         flightDetails:
 *           type: object
 *           required:
 *             - id
 *             - price
 *           properties:
 *             id:
 *               type: string
 *               description: Flight offer ID from search results
 *               example: "1"
 *             price:
 *               type: number
 *               description: Total flight price
 *               example: 855000
 *         passengerDetails:
 *           type: object
 *           required:
 *             - firstName
 *             - lastName
 *             - email
 *             - phoneNumber
 *           properties:
 *             firstName:
 *               type: string
 *               description: Passenger first name
 *               example: "John"
 *             lastName:
 *               type: string
 *               description: Passenger last name
 *               example: "Doe"
 *             email:
 *               type: string
 *               format: email
 *               description: Contact email address
 *               example: "john.doe@example.com"
 *             phoneNumber:
 *               type: string
 *               description: Contact phone number
 *               example: "+2348012345678"
 *             dateOfBirth:
 *               type: string
 *               format: date
 *               description: Passenger date of birth (optional)
 *               example: "1990-05-15"
 *             gender:
 *               type: string
 *               enum: [Male, Female, Other]
 *               description: Passenger gender (optional)
 *               example: "Male"
 *             passportNumber:
 *               type: string
 *               description: Passport number (optional)
 *               example: "A12345678"
 *         paymentDetails:
 *           type: object
 *           description: Payment information for Paystack integration
 *           properties:
 *             currency:
 *               type: string
 *               enum: [NGN, USD, GHS, ZAR, KES]
 *               description: Payment currency
 *               example: "NGN"
 *             callback_url:
 *               type: string
 *               format: uri
 *               description: URL to redirect after payment
 *               example: "https://yourapp.com/payment/callback"
 *         referralCode:
 *           type: string
 *           description: Optional referral code for affiliate tracking
 *           example: "REF123456"
 *     
 *     FlightBookingResponse:
 *       type: object
 *       properties:
 *         bookingReference:
 *           type: string
 *           description: Temporary booking reference
 *           example: "TTP-FL-1678888888888"
 *         authorizationUrl:
 *           type: string
 *           description: Paystack payment URL
 *           example: "https://checkout.paystack.com/mock_auth_url"
 *         paymentReference:
 *           type: string
 *           description: Payment transaction reference
 *           example: "TTP-FL-PAY-1678888888888"
 *         amount:
 *           type: number
 *           description: Total amount to be paid (including service charges)
 *           example: 860000
 *         currency:
 *           type: string
 *           description: Payment currency
 *           example: "NGN"
 *         expiresAt:
 *           type: string
 *           format: date-time
 *           description: Booking hold expiry time
 *           example: "2024-12-15T11:30:00Z"
 *         serviceCharges:
 *           type: object
 *           properties:
 *             flightBookingCharges:
 *               type: number
 *               example: 5000
 *         instructions:
 *           type: object
 *           properties:
 *             payment:
 *               type: string
 *               example: "Complete payment within 30 minutes to confirm booking"
 *             documents:
 *               type: string
 *               example: "Ensure passport is valid for at least 6 months from travel date"
 *     
 *     # Hotel Booking Schemas
 *     HotelSearchRequest:
 *       type: object
 *       required:
 *         - destination
 *         - checkInDate
 *         - checkOutDate
 *         - adults
 *       properties:
 *         destination:
 *           type: string
 *           description: Destination city or location
 *           example: "Lagos"
 *         checkInDate:
 *           type: string
 *           format: date
 *           description: Check-in date (YYYY-MM-DD)
 *           example: "2024-12-15"
 *         checkOutDate:
 *           type: string
 *           format: date
 *           description: Check-out date (YYYY-MM-DD)
 *           example: "2024-12-18"
 *         adults:
 *           type: integer
 *           minimum: 1
 *           maximum: 10
 *           description: Number of adult guests
 *           example: 2
 *         children:
 *           type: integer
 *           minimum: 0
 *           maximum: 10
 *           description: Number of child guests
 *           example: 0
 *           default: 0
 *         currency:
 *           type: string
 *           enum: [NGN, USD, EUR, GBP]
 *           description: Preferred currency for pricing
 *           example: "NGN"
 *           default: "NGN"
 *     
 *     HotelSearchResponse:
 *       type: object
 *       properties:
 *         searchId:
 *           type: string
 *           description: Search session ID for booking
 *           example: "search_abc123def456"
 *         hotels:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/HotelOffer'
 *         totalResults:
 *           type: integer
 *           description: Total number of hotels found
 *           example: 25
 *         searchCriteria:
 *           $ref: '#/components/schemas/HotelSearchRequest'
 *     
 *     HotelOffer:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Hotel ID
 *           example: "12345"
 *         name:
 *           type: string
 *           description: Hotel name
 *           example: "Eko Hotel & Suites"
 *         address:
 *           type: string
 *           description: Hotel address
 *           example: "1415 Adetokunbo Ademola Street, Victoria Island, Lagos"
 *         stars:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *           description: Hotel star rating
 *           example: 5
 *         rating:
 *           type: number
 *           minimum: 0
 *           maximum: 5
 *           description: Guest rating score
 *           example: 4.3
 *         reviewCount:
 *           type: integer
 *           description: Number of guest reviews
 *           example: 1250
 *         images:
 *           type: array
 *           items:
 *             type: string
 *           description: Array of hotel image URLs
 *           example: ["https://example.com/hotel1.jpg", "https://example.com/hotel2.jpg"]
 *         amenities:
 *           type: array
 *           items:
 *             type: string
 *           description: Hotel amenities
 *           example: ["WiFi", "Pool", "Gym", "Restaurant", "Spa"]
 *         rooms:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/HotelRoom'
 *         location:
 *           type: object
 *           properties:
 *             latitude:
 *               type: number
 *               example: 6.4281
 *             longitude:
 *               type: number
 *               example: 3.4219
 *     
 *     HotelRoom:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Room offer ID for booking
 *           example: "room_hash_abc123"
 *         name:
 *           type: string
 *           description: Room type name
 *           example: "Deluxe Room"
 *         price:
 *           type: number
 *           description: Room price per night
 *           example: 185000
 *         currency:
 *           type: string
 *           description: Price currency
 *           example: "NGN"
 *         cancellationPolicy:
 *           type: string
 *           description: Cancellation policy details
 *           example: "Free cancellation until 24 hours before check-in"
 *         breakfast:
 *           type: string
 *           description: Breakfast inclusion
 *           example: "Included"
 *         bedding:
 *           type: string
 *           description: Bed type
 *           example: "King Bed"
 *         maxOccupancy:
 *           type: integer
 *           description: Maximum number of guests
 *           example: 2
 *         roomSize:
 *           type: string
 *           description: Room size information
 *           example: "35 sqm"
 *         amenities:
 *           type: array
 *           items:
 *             type: string
 *           description: Room-specific amenities
 *           example: ["Air Conditioning", "Mini Bar", "Safe", "Balcony"]
 *     
 *     HotelBookingRequest:
 *       type: object
 *       required:
 *         - hotelDetails
 *         - guestDetails
 *         - searchId
 *         - roomId
 *       properties:
 *         hotelDetails:
 *           type: object
 *           required:
 *             - id
 *             - name
 *             - price
 *             - checkInDate
 *             - checkOutDate
 *           properties:
 *             id:
 *               type: string
 *               description: Hotel ID from search results
 *               example: "12345"
 *             name:
 *               type: string
 *               description: Hotel name
 *               example: "Eko Hotel & Suites"
 *             price:
 *               type: number
 *               description: Total room price
 *               example: 185000
 *             currency:
 *               type: string
 *               description: Price currency
 *               example: "NGN"
 *             checkInDate:
 *               type: string
 *               format: date
 *               description: Check-in date
 *               example: "2024-12-15"
 *             checkOutDate:
 *               type: string
 *               format: date
 *               description: Check-out date
 *               example: "2024-12-18"
 *             roomName:
 *               type: string
 *               description: Selected room type
 *               example: "Deluxe Room"
 *         guestDetails:
 *           type: object
 *           required:
 *             - firstName
 *             - lastName
 *             - email
 *             - phoneNumber
 *           properties:
 *             firstName:
 *               type: string
 *               description: Primary guest first name
 *               example: "John"
 *             lastName:
 *               type: string
 *               description: Primary guest last name
 *               example: "Doe"
 *             email:
 *               type: string
 *               format: email
 *               description: Contact email address
 *               example: "john.doe@example.com"
 *             phoneNumber:
 *               type: string
 *               description: Contact phone number
 *               example: "+2348012345678"
 *             specialRequests:
 *               type: string
 *               description: Special requests or preferences
 *               example: "Late check-in, non-smoking room"
 *         paymentDetails:
 *           type: object
 *           properties:
 *             email:
 *               type: string
 *               format: email
 *               description: Payment email (usually same as guest email)
 *               example: "john.doe@example.com"
 *             currency:
 *               type: string
 *               enum: [NGN, USD, GHS, ZAR, KES]
 *               description: Payment currency
 *               example: "NGN"
 *             callback_url:
 *               type: string
 *               format: uri
 *               description: URL to redirect after payment
 *               example: "https://yourapp.com/payment/callback"
 *         searchId:
 *           type: string
 *           description: Search session ID from hotel search
 *           example: "search_abc123def456"
 *         roomId:
 *           type: string
 *           description: Room offer ID from search results
 *           example: "room_hash_abc123"
 *         referralCode:
 *           type: string
 *           description: Optional referral code for affiliate tracking
 *           example: "HOTEL-REF123"
 *     
 *     HotelBookingResponse:
 *       type: object
 *       properties:
 *         bookingReference:
 *           type: string
 *           description: Temporary booking reference
 *           example: "TTP-HTL-1678888888888"
 *         authorizationUrl:
 *           type: string
 *           description: Paystack payment URL
 *           example: "https://checkout.paystack.com/abc123def456"
 *         paymentReference:
 *           type: string
 *           description: Payment transaction reference
 *           example: "TTP-HTL-PAY-1678888888888"
 *         amount:
 *           type: number
 *           description: Total amount to be paid (including service charges)
 *           example: 188000
 *         currency:
 *           type: string
 *           description: Payment currency
 *           example: "NGN"
 *         expiresAt:
 *           type: string
 *           format: date-time
 *           description: Booking hold expiry time
 *           example: "2024-12-15T11:30:00Z"
 *         hotelDetails:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *               example: "12345"
 *             name:
 *               type: string
 *               example: "Eko Hotel & Suites"
 *             checkIn:
 *               type: string
 *               format: date
 *               example: "2024-12-15"
 *             checkOut:
 *               type: string
 *               format: date
 *               example: "2024-12-18"
 *             roomType:
 *               type: string
 *               example: "Deluxe Room"
 *         guestDetails:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *               example: "John Doe"
 *             email:
 *               type: string
 *               example: "john.doe@example.com"
 *             phone:
 *               type: string
 *               example: "+2348012345678"
 *         serviceCharges:
 *           type: object
 *           properties:
 *             hotelReservationCharges:
 *               type: number
 *               example: 3000
 *         instructions:
 *           type: object
 *           properties:
 *             payment:
 *               type: string
 *               example: "Complete payment within 30 minutes to confirm hotel reservation"
 *             cancellation:
 *               type: string
 *               example: "Cancellation policy depends on hotel terms and conditions"
 *     
 *     HotelPaymentVerificationRequest:
 *       type: object
 *       required:
 *         - reference
 *       properties:
 *         reference:
 *           type: string
 *           description: Payment reference from Paystack
 *           example: "TTP-HTL-PAY-1678888888888"
 *     
 *     HotelPaymentVerificationResponse:
 *       type: object
 *       properties:
 *         paymentStatus:
 *           type: string
 *           enum: [success, failed]
 *           description: Payment verification status
 *           example: "success"
 *         transactionReference:
 *           type: string
 *           description: Original payment reference
 *           example: "TTP-HTL-PAY-1678888888888"
 *         amountPaid:
 *           type: number
 *           description: Amount paid by customer
 *           example: 188000
 *         currency:
 *           type: string
 *           description: Payment currency
 *           example: "NGN"
 *         paidAt:
 *           type: string
 *           format: date-time
 *           description: Payment completion timestamp
 *           example: "2024-12-15T10:45:00Z"
 *         applicationStatus:
 *           type: string
 *           enum: [Booking Confirmed, Payment Confirmed - Manual Booking Required]
 *           description: Booking status after payment
 *           example: "Booking Confirmed"
 *         bookingReference:
 *           type: string
 *           description: Final booking reference from Ratehawk
 *           example: "RATEHAWK-HTL-789012345"
 *         hotelDetails:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *               example: "Eko Hotel & Suites"
 *             checkIn:
 *               type: string
 *               format: date
 *               example: "2024-12-15"
 *             checkOut:
 *               type: string
 *               format: date
 *               example: "2024-12-18"
 *             guestName:
 *               type: string
 *               example: "John Doe"
 *         nextSteps:
 *           type: string
 *           description: Instructions for next steps
 *           example: "Your hotel reservation has been successfully confirmed. You will receive your booking confirmation via email shortly."
 *     
 *     # Visa Consultancy Schemas
 *     VisaApplicationRequest:
 *       type: object
 *       required:
 *         - destinationCountry
 *         - visaType
 *         - personalInformation
 *         - contactInformation
 *       properties:
 *         destinationCountry:
 *           type: string
 *           description: Country for which visa is required
 *           example: "United States"
 *         visaType:
 *           type: string
 *           enum: [Tourist, Business, Student, Transit, Work, Family Visit]
 *           description: Type of visa being applied for
 *           example: "Tourist"
 *         urgency:
 *           type: string
 *           enum: [Standard, Express]
 *           description: Processing urgency level
 *           example: "Standard"
 *           default: "Standard"
 *         personalInformation:
 *           $ref: '#/components/schemas/VisaPersonalInformation'
 *         contactInformation:
 *           $ref: '#/components/schemas/VisaContactInformation'
 *         travelInformation:
 *           $ref: '#/components/schemas/VisaTravelInformation'
 *         additionalNotes:
 *           type: string
 *           description: Any additional information or special requests
 *           example: "First time traveling to the US"
 *     
 *     VisaPersonalInformation:
 *       type: object
 *       required:
 *         - firstName
 *         - lastName
 *         - dateOfBirth
 *         - nationality
 *         - passportNumber
 *       properties:
 *         firstName:
 *           type: string
 *           description: Applicant's first name
 *           example: "John"
 *         lastName:
 *           type: string
 *           description: Applicant's last name
 *           example: "Doe"
 *         otherNames:
 *           type: string
 *           description: Applicant's middle name(s)
 *           example: "Michael"
 *         dateOfBirth:
 *           type: string
 *           format: date
 *           description: Date of birth (YYYY-MM-DD)
 *           example: "1990-05-15"
 *         gender:
 *           type: string
 *           enum: [Male, Female]
 *           description: Applicant's gender
 *           example: "Male"
 *         nationality:
 *           type: string
 *           description: Applicant's nationality
 *           example: "Nigerian"
 *         maritalStatus:
 *           type: string
 *           enum: [Single, Married, Divorced, Widowed]
 *           description: Marital status
 *           example: "Single"
 *         occupation:
 *           type: string
 *           description: Current occupation
 *           example: "Software Engineer"
 *         passportNumber:
 *           type: string
 *           description: International passport number
 *           example: "A12345678"
 *         passportExpiryDate:
 *           type: string
 *           format: date
 *           description: Passport expiry date
 *           example: "2030-05-15"
 *     
 *     VisaContactInformation:
 *       type: object
 *       required:
 *         - email
 *         - phoneNumber
 *         - address
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           description: Contact email address
 *           example: "john.doe@example.com"
 *         phoneNumber:
 *           type: string
 *           description: Contact phone number
 *           example: "+2348012345678"
 *         address:
 *           type: string
 *           description: Residential address
 *           example: "123 Main Street, Lagos, Nigeria"
 *         city:
 *           type: string
 *           description: City of residence
 *           example: "Lagos"
 *         state:
 *           type: string
 *           description: State of residence
 *           example: "Lagos State"
 *     
 *     VisaTravelInformation:
 *       type: object
 *       properties:
 *         purposeOfTravel:
 *           type: string
 *           description: Purpose of travel
 *           example: "Tourism and sightseeing"
 *         intendedTravelDate:
 *           type: string
 *           format: date
 *           description: Intended travel date
 *           example: "2024-12-15"
 *         durationOfStay:
 *           type: string
 *           description: Expected duration of stay
 *           example: "2 weeks"
 *     
 *     VisaApplicationResponse:
 *       type: object
 *       properties:
 *         applicationId:
 *           type: string
 *           description: Unique application ID
 *           example: "VISA-APP-1678888888888"
 *         status:
 *           type: string
 *           enum: [
 *             "Pending Document Upload",
 *             "Documents Under Review", 
 *             "Payment Pending",
 *             "In Progress",
 *             "Completed",
 *             "Rejected"
 *           ]
 *           example: "Pending Document Upload"
 *         consultancyFee:
 *           type: number
 *           description: Consultancy fee amount
 *           example: 25000
 *         currency:
 *           type: string
 *           description: Fee currency
 *           example: "NGN"
 *         requiredDocuments:
 *           type: array
 *           description: List of required documents to upload
 *           items:
 *             type: string
 *           example: [
 *             "International Passport Bio-data Page",
 *             "Passport Photograph",
 *             "Bank Statement (3 months)",
 *             "Employment Letter"
 *           ]
 *         nextSteps:
 *           type: string
 *           description: Instructions for next steps
 *           example: "Please upload the required documents and proceed to payment"
 *     
 *     VisaDocumentUploadResponse:
 *       type: object
 *       properties:
 *         documentId:
 *           type: string
 *           description: Unique document ID
 *           example: "DOC-1678888888888"
 *         fileName:
 *           type: string
 *           description: Original file name
 *           example: "passport_biodata.pdf"
 *         documentType:
 *           type: string
 *           description: Type of document uploaded
 *           example: "International Passport Bio-data Page"
 *         uploadedAt:
 *           type: string
 *           format: date-time
 *           description: Upload timestamp
 *           example: "2024-01-15T10:30:00Z"
 *         fileSize:
 *           type: number
 *           description: File size in bytes
 *           example: 1048576
 *         status:
 *           type: string
 *           enum: ["Pending Review", "Approved", "Rejected"]
 *           description: Document verification status
 *           example: "Pending Review"
 *         remainingDocuments:
 *           type: array
 *           description: List of remaining required documents
 *           items:
 *             type: string
 *           example: ["Passport Photograph", "Bank Statement"]
 *     
 *     VisaPaymentResponse:
 *       type: object
 *       properties:
 *         paymentReference:
 *           type: string
 *           description: Payment transaction reference
 *           example: "TTP-VISA-PAY-1678888888888"
 *         authorizationUrl:
 *           type: string
 *           description: Paystack payment URL
 *           example: "https://checkout.paystack.com/mock_auth_url"
 *         amount:
 *           type: number
 *           description: Total amount to be paid
 *           example: 25000
 *         currency:
 *           type: string
 *           description: Payment currency
 *           example: "NGN"
 *         consultancyFee:
 *           type: number
 *           description: Base consultancy fee
 *           example: 25000
 *         serviceCharges:
 *           type: object
 *           properties:
 *             visaProcessingCharges:
 *               type: number
 *               example: 0
 *         expiresAt:
 *           type: string
 *           format: date-time
 *           description: Payment link expiry time
 *           example: "2024-01-15T11:30:00Z"
 */

/**
 * @openapi
 * paths:
 *   /api/v1/health:
 *     get:
 *       tags:
 *         - Health Check
 *       summary: Get overall system health status
 *       description: Returns the health status of all system components including database, AWS S3, and Amadeus XML services
 *       responses:
 *         '200':
 *           description: System health status
 *           content:
 *             application/json:
 *               schema:
 *                 $ref: '#/components/schemas/HealthCheckResponse'
 *         '503':
 *           description: System is unhealthy
 *           content:
 *             application/json:
 *               schema:
 *                 $ref: '#/components/schemas/HealthCheckResponse'
 *   
 *   /api/v1/health/s3:
 *     get:
 *       tags:
 *         - Health Check
 *       summary: Check AWS S3 service health
 *       description: Specifically checks the health and connectivity of AWS S3 storage service
 *       responses:
 *         '200':
 *           description: S3 service is healthy
 *           content:
 *             application/json:
 *               schema:
 *                 type: object
 *                 properties:
 *                   status:
 *                     type: string
 *                     example: "healthy"
 *                   service:
 *                     type: string
 *                     example: "s3"
 *                   responseTime:
 *                     type: number
 *                     description: Response time in milliseconds
 *                     example: 150
 *                   lastChecked:
 *                     type: string
 *                     format: date-time
 *                     example: "2024-01-15T10:30:00Z"
 *         '503':
 *           description: S3 service is unhealthy
 *   
 *   /api/v1/health/amadeus-xml:
 *     get:
 *       tags:
 *         - Health Check
 *       summary: Check Amadeus XML service health
 *       description: Specifically checks the health and connectivity of Amadeus XML SOAP service
 *       responses:
 *         '200':
 *           description: Amadeus XML service is healthy
 *           content:
 *             application/json:
 *               schema:
 *                 type: object
 *                 properties:
 *                   status:
 *                     type: string
 *                     example: "healthy"
 *                   service:
 *                     type: string
 *                     example: "amadeus-xml"
 *                   responseTime:
 *                     type: number
 *                     description: Response time in milliseconds
 *                     example: 250
 *                   lastChecked:
 *                     type: string
 *                     format: date-time
 *                     example: "2024-01-15T10:30:00Z"
 *         '503':
 *           description: Amadeus XML service is unhealthy
 *   

 *   
 *   /api/v1/upload:
 *     post:
 *       tags:
 *         - File Management
 *       summary: Upload file to AWS S3
 *       description: |
 *         Upload a file to AWS S3 storage service. 
 *         
 *         Files are stored using AWS S3 for scalable and reliable storage.
 *       security:
 *         - bearerAuth: []
 *       requestBody:
 *         required: true
 *         content:
 *           multipart/form-data:
 *             schema:
 *               type: object
 *               properties:
 *                 file:
 *                   type: string
 *                   format: binary
 *                   description: File to upload
 *                 metadata:
 *                   type: string
 *                   description: JSON string of additional metadata
 *                   example: '{"category": "profile", "userId": "123"}'
 *       responses:
 *         '200':
 *           description: File uploaded successfully
 *           content:
 *             application/json:
 *               schema:
 *                 $ref: '#/components/schemas/S3FileUploadResponse'
 *         '400':
 *           description: Invalid file or request
 *           content:
 *             application/json:
 *               schema:
 *                 $ref: '#/components/schemas/EnhancedErrorResponse'
 *         '401':
 *           description: Unauthorized - Authentication required
 *         '413':
 *           description: File too large
 *         '429':
 *           description: Rate limit exceeded
 *           content:
 *             application/json:
 *               schema:
 *                 $ref: '#/components/schemas/EnhancedErrorResponse'
 *         '500':
 *           description: Upload failed
 *           content:
 *             application/json:
 *               schema:
 *                 $ref: '#/components/schemas/EnhancedErrorResponse'
 *   
 *   /api/v1/files/{fileId}:
 *     delete:
 *       tags:
 *         - File Management
 *       summary: Delete file from AWS S3
 *       description: |
 *         Delete a file from AWS S3 storage service.
 *         
 *         Provide the S3 object key to delete the file from storage.
 *       security:
 *         - bearerAuth: []
 *       parameters:
 *         - in: path
 *           name: fileId
 *           required: true
 *           schema:
 *             type: string
 *           description: Cloudflare image ID
 *           example: "cloudflare-image-id-xyz789"
 *       responses:
 *         '200':
 *           description: File deleted successfully
 *           content:
 *             application/json:
 *               schema:
 *                 type: object
 *                 properties:
 *                   success:
 *                     type: boolean
 *                     example: true
 *                   message:
 *                     type: string
 *                     example: "File deleted successfully"
 *                   data:
 *                     type: object
 *                     properties:
 *                       deletedId:
 *                         type: string
 *                         example: "cloudflare-image-id-xyz789"
 *                       deletedAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2024-01-15T10:30:00Z"
 *         '400':
 *           description: Invalid file ID
 *         '401':
 *           description: Unauthorized - Authentication required
 *         '404':
 *           description: File not found
 *         '500':
 *           description: Deletion failed
 *           content:
 *             application/json:
 *               schema:
 *                 $ref: '#/components/schemas/EnhancedErrorResponse'
 *     
 *     get:
 *       tags:
 *         - File Management
 *       summary: Get file metadata
 *       description: Retrieve metadata for a file stored in Cloudflare Images
 *       security:
 *         - bearerAuth: []
 *       parameters:
 *         - in: path
 *           name: fileId
 *           required: true
 *           schema:
 *             type: string
 *           description: Cloudflare image ID
 *           example: "cloudflare-image-id-xyz789"
 *       responses:
 *         '200':
 *           description: File metadata retrieved successfully
 *           content:
 *             application/json:
 *               schema:
 *                 type: object
 *                 properties:
 *                   success:
 *                     type: boolean
 *                     example: true
 *                   data:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "cloudflare-image-id-xyz789"
 *                       filename:
 *                         type: string
 *                         example: "sample_image.jpg"
 *                       uploaded:
 *                         type: string
 *                         format: date-time
 *                         example: "2024-01-15T10:30:00.000Z"
 *                       requireSignedURLs:
 *                         type: boolean
 *                         example: false
 *                       variants:
 *                         type: array
 *                         items:
 *                           type: string
 *                         example: [
 *                           "https://imagedelivery.net/your-hash/cloudflare-image-id-xyz789/public"
 *                         ]
 *                       meta:
 *                         type: object
 *                         description: Custom metadata
 *         '401':
 *           description: Unauthorized - Authentication required
 *         '404':
 *           description: File not found
 *         '500':
 *           description: Internal server error
 */

// Export empty object to make this a valid Node.js module
module.exports = {};