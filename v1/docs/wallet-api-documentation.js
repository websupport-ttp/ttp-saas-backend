// v1/docs/wallet-api-documentation.js
// Comprehensive OpenAPI documentation for wallet management system endpoints

/**
 * @openapi
 * components:
 *   schemas:
 *     # Wallet Schemas
 *     Wallet:
 *       type: object
 *       required:
 *         - affiliateId
 *         - balance
 *         - totalEarned
 *         - totalWithdrawn
 *         - currency
 *         - status
 *       properties:
 *         _id:
 *           type: string
 *           description: Wallet record ID
 *           example: "60d5ec49f8c6a7001c8a1b2c"
 *         affiliateId:
 *           type: string
 *           description: Reference to Affiliate model
 *           example: "60d5ec49f8c6a7001c8a1b2d"
 *         balance:
 *           type: number
 *           description: Current wallet balance
 *           example: 15750.50
 *           minimum: 0
 *         totalEarned:
 *           type: number
 *           description: Total amount earned
 *           example: 25000.75
 *           minimum: 0
 *         totalWithdrawn:
 *           type: number
 *           description: Total amount withdrawn
 *           example: 9250.25
 *           minimum: 0
 *         currency:
 *           type: string
 *           enum: [NGN, USD, EUR, GBP]
 *           description: Wallet currency
 *           example: "NGN"
 *         status:
 *           type: string
 *           enum: [active, frozen, suspended]
 *           description: Wallet status
 *           example: "active"
 *         bankDetails:
 *           $ref: '#/components/schemas/BankDetails'
 *         freezeReason:
 *           type: string
 *           description: Reason for wallet freeze/suspension
 *           example: "Pending verification"
 *         frozenAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp when wallet was frozen
 *         lastTransactionAt:
 *           type: string
 *           format: date-time
 *           description: Last transaction timestamp
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *     
 *     BankDetails:
 *       type: object
 *       properties:
 *         accountName:
 *           type: string
 *           description: Bank account holder name
 *           example: "John Doe Travel Services"
 *           maxLength: 100
 *         accountNumber:
 *           type: string
 *           description: Bank account number (10 digits)
 *           example: "0123456789"
 *           pattern: "^\\d{10}$"
 *         bankCode:
 *           type: string
 *           description: Bank code (3 digits)
 *           example: "058"
 *           pattern: "^\\d{3}$"
 *         bankName:
 *           type: string
 *           description: Bank name
 *           example: "Guaranty Trust Bank"
 *           maxLength: 100
 *     
 *     WalletTransaction:
 *       type: object
 *       required:
 *         - walletId
 *         - affiliateId
 *         - type
 *         - amount
 *         - balanceBefore
 *         - balanceAfter
 *         - currency
 *         - description
 *       properties:
 *         _id:
 *           type: string
 *           description: Transaction record ID
 *           example: "60d5ec49f8c6a7001c8a1b2c"
 *         walletId:
 *           type: string
 *           description: Reference to Wallet model
 *           example: "60d5ec49f8c6a7001c8a1b2d"
 *         affiliateId:
 *           type: string
 *           description: Reference to Affiliate model
 *           example: "60d5ec49f8c6a7001c8a1b2e"
 *         type:
 *           type: string
 *           enum: [commission_credit, withdrawal_debit, adjustment_credit, adjustment_debit, refund_credit, reversal_credit, penalty_debit]
 *           description: Transaction type
 *           example: "commission_credit"
 *         amount:
 *           type: number
 *           description: Transaction amount
 *           example: 500.00
 *           minimum: 0.01
 *         balanceBefore:
 *           type: number
 *           description: Wallet balance before transaction
 *           example: 1250.50
 *           minimum: 0
 *         balanceAfter:
 *           type: number
 *           description: Wallet balance after transaction
 *           example: 1750.50
 *           minimum: 0
 *         currency:
 *           type: string
 *           enum: [NGN, USD, EUR, GBP]
 *           description: Transaction currency
 *           example: "NGN"
 *         description:
 *           type: string
 *           description: Transaction description
 *           example: "Commission earned from flight booking"
 *           maxLength: 500
 *         reference:
 *           type: string
 *           description: Transaction reference
 *           example: "COMMISSIONCREDIT_1640995200000_1b2c3d"
 *           maxLength: 100
 *         relatedId:
 *           type: string
 *           description: Related entity ID
 *           example: "60d5ec49f8c6a7001c8a1b2f"
 *         relatedModel:
 *           type: string
 *           enum: [CommissionTransaction, Withdrawal, Adjustment]
 *           description: Related entity model
 *           example: "CommissionTransaction"
 *         metadata:
 *           type: object
 *           description: Additional transaction metadata
 *           example: { "bookingId": "BK123456", "serviceType": "flight" }
 *         status:
 *           type: string
 *           enum: [pending, completed, failed, reversed]
 *           description: Transaction status
 *           example: "completed"
 *         processedBy:
 *           type: string
 *           description: User who processed the transaction
 *           example: "60d5ec49f8c6a7001c8a1b30"
 *         processedAt:
 *           type: string
 *           format: date-time
 *           description: Processing timestamp
 *         reversedAt:
 *           type: string
 *           format: date-time
 *           description: Reversal timestamp
 *         reversalReason:
 *           type: string
 *           description: Reason for transaction reversal
 *           example: "Booking cancelled by customer"
 *           maxLength: 500
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *     
 *     WalletBalance:
 *       type: object
 *       properties:
 *         balance:
 *           type: number
 *           description: Current wallet balance
 *           example: 15750.50
 *         totalEarned:
 *           type: number
 *           description: Total amount earned
 *           example: 25000.75
 *         totalWithdrawn:
 *           type: number
 *           description: Total amount withdrawn
 *           example: 9250.25
 *         currency:
 *           type: string
 *           description: Wallet currency
 *           example: "NGN"
 *         status:
 *           type: string
 *           description: Wallet status
 *           example: "active"
 *         lastTransactionAt:
 *           type: string
 *           format: date-time
 *           description: Last transaction timestamp
 *         hasBankDetails:
 *           type: boolean
 *           description: Whether bank details are configured
 *           example: true
 *     
 *     WalletStatistics:
 *       type: object
 *       properties:
 *         totalTransactions:
 *           type: integer
 *           description: Total number of transactions
 *           example: 45
 *         totalAmount:
 *           type: number
 *           description: Total transaction amount
 *           example: 25000.75
 *         byType:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 example: "commission_credit"
 *               count:
 *                 type: integer
 *                 example: 30
 *               totalAmount:
 *                 type: number
 *                 example: 15000.50
 *               avgAmount:
 *                 type: number
 *                 example: 500.02
 *         dateRange:
 *           type: object
 *           properties:
 *             from:
 *               type: string
 *               format: date
 *               example: "2024-01-01"
 *             to:
 *               type: string
 *               format: date
 *               example: "2024-12-31"
 *     
 *     SystemWalletStatistics:
 *       type: object
 *       properties:
 *         totalBalance:
 *           type: number
 *           description: Total system balance across all wallets
 *           example: 1250000.75
 *         totalEarned:
 *           type: number
 *           description: Total earned across all wallets
 *           example: 2500000.50
 *         totalWithdrawn:
 *           type: number
 *           description: Total withdrawn across all wallets
 *           example: 1250000.25
 *         activeWallets:
 *           type: integer
 *           description: Number of active wallets
 *           example: 150
 *         frozenWallets:
 *           type: integer
 *           description: Number of frozen wallets
 *           example: 5
 *         suspendedWallets:
 *           type: integer
 *           description: Number of suspended wallets
 *           example: 2
 *     
 *     WalletValidation:
 *       type: object
 *       properties:
 *         valid:
 *           type: boolean
 *           description: Whether wallet is valid for operation
 *           example: true
 *         canWithdraw:
 *           type: boolean
 *           description: Whether withdrawal is allowed
 *           example: true
 *         canCredit:
 *           type: boolean
 *           description: Whether credit is allowed
 *           example: true
 *         canDebit:
 *           type: boolean
 *           description: Whether debit is allowed
 *           example: true
 *         issues:
 *           type: array
 *           items:
 *             type: string
 *           description: List of validation issues
 *           example: []
 *         recommendations:
 *           type: array
 *           items:
 *             type: string
 *           description: List of recommendations
 *           example: ["Update bank details for faster withdrawals"]
 *     
 *     WalletHealthCheck:
 *       type: object
 *       properties:
 *         healthy:
 *           type: boolean
 *           description: Overall wallet health status
 *           example: true
 *         balanceIntegrity:
 *           type: boolean
 *           description: Balance calculation integrity
 *           example: true
 *         transactionConsistency:
 *           type: boolean
 *           description: Transaction history consistency
 *           example: true
 *         bankDetailsValid:
 *           type: boolean
 *           description: Bank details validation status
 *           example: true
 *         issues:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 example: "balance_mismatch"
 *               severity:
 *                 type: string
 *                 enum: [low, medium, high, critical]
 *                 example: "medium"
 *               description:
 *                 type: string
 *                 example: "Balance calculation discrepancy detected"
 *               recommendation:
 *                 type: string
 *                 example: "Recalculate balance from transaction history"
 *         lastChecked:
 *           type: string
 *           format: date-time
 *           description: Last health check timestamp
 *     
 *     # Request Schemas
 *     CreateWalletRequest:
 *       type: object
 *       required:
 *         - affiliateId
 *       properties:
 *         affiliateId:
 *           type: string
 *           description: Affiliate ID to create wallet for
 *           example: "60d5ec49f8c6a7001c8a1b2d"
 *         currency:
 *           type: string
 *           enum: [NGN, USD, EUR, GBP]
 *           description: Wallet currency
 *           example: "NGN"
 *           default: "NGN"
 *         bankDetails:
 *           $ref: '#/components/schemas/BankDetails'
 *     
 *     CreditWalletRequest:
 *       type: object
 *       required:
 *         - amount
 *         - transactionRef
 *       properties:
 *         amount:
 *           type: number
 *           description: Amount to credit
 *           example: 500.00
 *           minimum: 0.01
 *         transactionRef:
 *           type: string
 *           description: Transaction reference
 *           example: "COMM_REF_123456"
 *           maxLength: 100
 *         description:
 *           type: string
 *           description: Transaction description
 *           example: "Commission earned from flight booking"
 *           maxLength: 500
 *         type:
 *           type: string
 *           enum: [commission_credit, adjustment_credit, refund_credit, reversal_credit]
 *           description: Credit transaction type
 *           example: "commission_credit"
 *           default: "commission_credit"
 *         relatedId:
 *           type: string
 *           description: Related entity ID
 *           example: "60d5ec49f8c6a7001c8a1b2f"
 *         relatedModel:
 *           type: string
 *           enum: [CommissionTransaction, Withdrawal, Adjustment]
 *           description: Related entity model
 *           example: "CommissionTransaction"
 *         metadata:
 *           type: object
 *           description: Additional transaction metadata
 *           example: { "bookingId": "BK123456", "serviceType": "flight" }
 *     
 *     DebitWalletRequest:
 *       type: object
 *       required:
 *         - amount
 *         - transactionRef
 *       properties:
 *         amount:
 *           type: number
 *           description: Amount to debit
 *           example: 1000.00
 *           minimum: 0.01
 *         transactionRef:
 *           type: string
 *           description: Transaction reference
 *           example: "WITHDRAW_REF_123456"
 *           maxLength: 100
 *         description:
 *           type: string
 *           description: Transaction description
 *           example: "Withdrawal to bank account"
 *           maxLength: 500
 *         type:
 *           type: string
 *           enum: [withdrawal_debit, adjustment_debit, penalty_debit]
 *           description: Debit transaction type
 *           example: "withdrawal_debit"
 *           default: "withdrawal_debit"
 *         relatedId:
 *           type: string
 *           description: Related entity ID
 *           example: "60d5ec49f8c6a7001c8a1b2f"
 *         relatedModel:
 *           type: string
 *           enum: [CommissionTransaction, Withdrawal, Adjustment]
 *           description: Related entity model
 *           example: "Withdrawal"
 *         metadata:
 *           type: object
 *           description: Additional transaction metadata
 *           example: { "withdrawalMethod": "bank_transfer", "bankAccount": "0123456789" }
 *     
 *     FreezeWalletRequest:
 *       type: object
 *       required:
 *         - reason
 *       properties:
 *         reason:
 *           type: string
 *           description: Reason for freezing wallet
 *           example: "Pending verification of business documents"
 *           maxLength: 500
 *     
 *     SuspendWalletRequest:
 *       type: object
 *       required:
 *         - reason
 *       properties:
 *         reason:
 *           type: string
 *           description: Reason for suspending wallet
 *           example: "Violation of terms and conditions"
 *           maxLength: 500
 *     
 *     UpdateBankDetailsRequest:
 *       type: object
 *       required:
 *         - accountName
 *         - accountNumber
 *         - bankCode
 *         - bankName
 *       properties:
 *         accountName:
 *           type: string
 *           description: Bank account holder name
 *           example: "John Doe Travel Services"
 *           maxLength: 100
 *         accountNumber:
 *           type: string
 *           description: Bank account number (10 digits)
 *           example: "0123456789"
 *           pattern: "^\\d{10}$"
 *         bankCode:
 *           type: string
 *           description: Bank code (3 digits)
 *           example: "058"
 *           pattern: "^\\d{3}$"
 *         bankName:
 *           type: string
 *           description: Bank name
 *           example: "Guaranty Trust Bank"
 *           maxLength: 100
 *     
 *     ReverseTransactionRequest:
 *       type: object
 *       required:
 *         - reason
 *       properties:
 *         reason:
 *           type: string
 *           description: Reason for transaction reversal
 *           example: "Booking cancelled by customer"
 *           maxLength: 500
 *     
 *     BulkWalletOperation:
 *       type: object
 *       required:
 *         - operations
 *       properties:
 *         operations:
 *           type: array
 *           items:
 *             type: object
 *             required:
 *               - affiliateId
 *               - operation
 *               - amount
 *             properties:
 *               affiliateId:
 *                 type: string
 *                 description: Affiliate ID
 *                 example: "60d5ec49f8c6a7001c8a1b2d"
 *               operation:
 *                 type: string
 *                 enum: [credit, debit, freeze, unfreeze, suspend]
 *                 description: Operation type
 *                 example: "credit"
 *               amount:
 *                 type: number
 *                 description: Operation amount (for credit/debit)
 *                 example: 500.00
 *                 minimum: 0.01
 *               transactionRef:
 *                 type: string
 *                 description: Transaction reference
 *                 example: "BULK_CREDIT_123456"
 *               description:
 *                 type: string
 *                 description: Operation description
 *                 example: "Bulk commission credit"
 *               reason:
 *                 type: string
 *                 description: Reason (for freeze/suspend operations)
 *                 example: "Bulk verification pending"
 *               metadata:
 *                 type: object
 *                 description: Additional operation metadata
 *           minItems: 1
 *           maxItems: 100
 *     
 *     BulkOperationResult:
 *       type: object
 *       properties:
 *         totalOperations:
 *           type: integer
 *           description: Total number of operations
 *           example: 50
 *         successfulOperations:
 *           type: integer
 *           description: Number of successful operations
 *           example: 48
 *         failedOperations:
 *           type: integer
 *           description: Number of failed operations
 *           example: 2
 *         results:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               affiliateId:
 *                 type: string
 *                 example: "60d5ec49f8c6a7001c8a1b2d"
 *               operation:
 *                 type: string
 *                 example: "credit"
 *               success:
 *                 type: boolean
 *                 example: true
 *               transactionId:
 *                 type: string
 *                 example: "60d5ec49f8c6a7001c8a1b2c"
 *               error:
 *                 type: string
 *                 example: "Insufficient balance for debit operation"
 *         processingTime:
 *           type: number
 *           description: Processing time in milliseconds
 *           example: 1250.5
 *     
 *     # Response Schemas
 *     WalletResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/StandardSuccessResponse'
 *         - type: object
 *           properties:
 *             data:
 *               $ref: '#/components/schemas/Wallet'
 *     
 *     WalletBalanceResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/StandardSuccessResponse'
 *         - type: object
 *           properties:
 *             data:
 *               $ref: '#/components/schemas/WalletBalance'
 *     
 *     WalletTransactionResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/StandardSuccessResponse'
 *         - type: object
 *           properties:
 *             data:
 *               $ref: '#/components/schemas/WalletTransaction'
 *     
 *     WalletTransactionListResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/PaginatedResponse'
 *         - type: object
 *           properties:
 *             data:
 *               type: object
 *               properties:
 *                 transactions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/WalletTransaction'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *     
 *     WalletStatisticsResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/StandardSuccessResponse'
 *         - type: object
 *           properties:
 *             data:
 *               $ref: '#/components/schemas/WalletStatistics'
 *     
 *     SystemWalletStatisticsResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/StandardSuccessResponse'
 *         - type: object
 *           properties:
 *             data:
 *               $ref: '#/components/schemas/SystemWalletStatistics'
 *     
 *     WalletValidationResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/StandardSuccessResponse'
 *         - type: object
 *           properties:
 *             data:
 *               $ref: '#/components/schemas/WalletValidation'
 *     
 *     WalletHealthResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/StandardSuccessResponse'
 *         - type: object
 *           properties:
 *             data:
 *               $ref: '#/components/schemas/WalletHealthCheck'
 *     
 *     BulkOperationResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/StandardSuccessResponse'
 *         - type: object
 *           properties:
 *             data:
 *               $ref: '#/components/schemas/BulkOperationResult'
 * 
 * # Wallet Management Endpoints
 * /api/v1/wallets:
 *   post:
 *     tags:
 *       - Wallet Management
 *     summary: Create a new wallet for an affiliate
 *     description: Creates a new wallet for an affiliate with optional initial configuration
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateWalletRequest'
 *           examples:
 *             basic:
 *               summary: Basic wallet creation
 *               value:
 *                 affiliateId: "60d5ec49f8c6a7001c8a1b2d"
 *                 currency: "NGN"
 *             withBankDetails:
 *               summary: Wallet with bank details
 *               value:
 *                 affiliateId: "60d5ec49f8c6a7001c8a1b2d"
 *                 currency: "NGN"
 *                 bankDetails:
 *                   accountName: "John Doe Travel Services"
 *                   accountNumber: "0123456789"
 *                   bankCode: "058"
 *                   bankName: "Guaranty Trust Bank"
 *     responses:
 *       201:
 *         description: Wallet created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletResponse'
 *             example:
 *               success: true
 *               message: "Wallet created successfully"
 *               data:
 *                 _id: "60d5ec49f8c6a7001c8a1b2c"
 *                 affiliateId: "60d5ec49f8c6a7001c8a1b2d"
 *                 balance: 0
 *                 totalEarned: 0
 *                 totalWithdrawn: 0
 *                 currency: "NGN"
 *                 status: "active"
 *                 bankDetails:
 *                   accountName: "John Doe Travel Services"
 *                   accountNumber: "0123456789"
 *                   bankCode: "058"
 *                   bankName: "Guaranty Trust Bank"
 *                 createdAt: "2024-01-15T10:30:00.000Z"
 *                 updatedAt: "2024-01-15T10:30:00.000Z"
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       409:
 *         description: Wallet already exists for affiliate
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *             example:
 *               success: false
 *               message: "Wallet already exists for this affiliate"
 *               errorCode: "WALLET_EXISTS"
 *               timestamp: "2024-01-15T10:30:00.000Z"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 * 
 * /api/v1/wallets/{affiliateId}/balance:
 *   get:
 *     tags:
 *       - Wallet Management
 *     summary: Get wallet balance and summary
 *     description: Retrieves current wallet balance and summary information for an affiliate
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: affiliateId
 *         in: path
 *         required: true
 *         description: Affiliate ID
 *         schema:
 *           type: string
 *           example: "60d5ec49f8c6a7001c8a1b2d"
 *     responses:
 *       200:
 *         description: Wallet balance retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletBalanceResponse'
 *             example:
 *               success: true
 *               message: "Wallet balance retrieved successfully"
 *               data:
 *                 balance: 15750.50
 *                 totalEarned: 25000.75
 *                 totalWithdrawn: 9250.25
 *                 currency: "NGN"
 *                 status: "active"
 *                 lastTransactionAt: "2024-01-15T10:30:00.000Z"
 *                 hasBankDetails: true
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: Wallet not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *             example:
 *               success: false
 *               message: "Wallet not found for this affiliate"
 *               errorCode: "WALLET_NOT_FOUND"
 *               timestamp: "2024-01-15T10:30:00.000Z"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 * 
 * /api/v1/wallets/{affiliateId}/credit:
 *   post:
 *     tags:
 *       - Wallet Operations
 *     summary: Credit amount to wallet
 *     description: Credits a specified amount to an affiliate's wallet
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: affiliateId
 *         in: path
 *         required: true
 *         description: Affiliate ID
 *         schema:
 *           type: string
 *           example: "60d5ec49f8c6a7001c8a1b2d"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreditWalletRequest'
 *           examples:
 *             commission:
 *               summary: Commission credit
 *               value:
 *                 amount: 500.00
 *                 transactionRef: "COMM_REF_123456"
 *                 description: "Commission earned from flight booking"
 *                 type: "commission_credit"
 *                 relatedId: "60d5ec49f8c6a7001c8a1b2f"
 *                 relatedModel: "CommissionTransaction"
 *                 metadata:
 *                   bookingId: "BK123456"
 *                   serviceType: "flight"
 *             adjustment:
 *               summary: Adjustment credit
 *               value:
 *                 amount: 100.00
 *                 transactionRef: "ADJ_REF_789012"
 *                 description: "Balance adjustment - correction"
 *                 type: "adjustment_credit"
 *     responses:
 *       200:
 *         description: Wallet credited successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletTransactionResponse'
 *             example:
 *               success: true
 *               message: "Wallet credited successfully"
 *               data:
 *                 _id: "60d5ec49f8c6a7001c8a1b2c"
 *                 walletId: "60d5ec49f8c6a7001c8a1b2d"
 *                 affiliateId: "60d5ec49f8c6a7001c8a1b2e"
 *                 type: "commission_credit"
 *                 amount: 500.00
 *                 balanceBefore: 1250.50
 *                 balanceAfter: 1750.50
 *                 currency: "NGN"
 *                 description: "Commission earned from flight booking"
 *                 reference: "COMMISSIONCREDIT_1640995200000_1b2c3d"
 *                 status: "completed"
 *                 processedAt: "2024-01-15T10:30:00.000Z"
 *                 createdAt: "2024-01-15T10:30:00.000Z"
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: Wallet not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *       409:
 *         description: Wallet not active
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *             example:
 *               success: false
 *               message: "Cannot credit inactive wallet"
 *               errorCode: "WALLET_INACTIVE"
 *               timestamp: "2024-01-15T10:30:00.000Z"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 * 
 * /api/v1/wallets/{affiliateId}/debit:
 *   post:
 *     tags:
 *       - Wallet Operations
 *     summary: Debit amount from wallet
 *     description: Debits a specified amount from an affiliate's wallet
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: affiliateId
 *         in: path
 *         required: true
 *         description: Affiliate ID
 *         schema:
 *           type: string
 *           example: "60d5ec49f8c6a7001c8a1b2d"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DebitWalletRequest'
 *           examples:
 *             withdrawal:
 *               summary: Withdrawal debit
 *               value:
 *                 amount: 1000.00
 *                 transactionRef: "WITHDRAW_REF_123456"
 *                 description: "Withdrawal to bank account"
 *                 type: "withdrawal_debit"
 *                 relatedId: "60d5ec49f8c6a7001c8a1b2f"
 *                 relatedModel: "Withdrawal"
 *                 metadata:
 *                   withdrawalMethod: "bank_transfer"
 *                   bankAccount: "0123456789"
 *             penalty:
 *               summary: Penalty debit
 *               value:
 *                 amount: 50.00
 *                 transactionRef: "PENALTY_REF_789012"
 *                 description: "Penalty for policy violation"
 *                 type: "penalty_debit"
 *     responses:
 *       200:
 *         description: Wallet debited successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletTransactionResponse'
 *             example:
 *               success: true
 *               message: "Wallet debited successfully"
 *               data:
 *                 _id: "60d5ec49f8c6a7001c8a1b2c"
 *                 walletId: "60d5ec49f8c6a7001c8a1b2d"
 *                 affiliateId: "60d5ec49f8c6a7001c8a1b2e"
 *                 type: "withdrawal_debit"
 *                 amount: 1000.00
 *                 balanceBefore: 2750.50
 *                 balanceAfter: 1750.50
 *                 currency: "NGN"
 *                 description: "Withdrawal to bank account"
 *                 reference: "WITHDRAWALDEBIT_1640995200000_1b2c3d"
 *                 status: "completed"
 *                 processedAt: "2024-01-15T10:30:00.000Z"
 *                 createdAt: "2024-01-15T10:30:00.000Z"
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: Wallet not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *       409:
 *         description: Insufficient balance or wallet inactive
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *             examples:
 *               insufficientBalance:
 *                 summary: Insufficient balance
 *                 value:
 *                   success: false
 *                   message: "Insufficient balance"
 *                   errorCode: "INSUFFICIENT_BALANCE"
 *                   timestamp: "2024-01-15T10:30:00.000Z"
 *               walletInactive:
 *                 summary: Wallet inactive
 *                 value:
 *                   success: false
 *                   message: "Cannot debit inactive wallet"
 *                   errorCode: "WALLET_INACTIVE"
 *                   timestamp: "2024-01-15T10:30:00.000Z"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 * 
 * /api/v1/wallets/{affiliateId}/transactions:
 *   get:
 *     tags:
 *       - Wallet Transactions
 *     summary: Get wallet transaction history with pagination
 *     description: Retrieves paginated transaction history for an affiliate's wallet with filtering options
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: affiliateId
 *         in: path
 *         required: true
 *         description: Affiliate ID
 *         schema:
 *           type: string
 *           example: "60d5ec49f8c6a7001c8a1b2d"
 *       - name: page
 *         in: query
 *         description: Page number
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *           example: 1
 *       - name: limit
 *         in: query
 *         description: Number of items per page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *           example: 20
 *       - name: type
 *         in: query
 *         description: Filter by transaction type
 *         schema:
 *           type: string
 *           enum: [commission_credit, withdrawal_debit, adjustment_credit, adjustment_debit, refund_credit, reversal_credit, penalty_debit]
 *           example: "commission_credit"
 *       - name: status
 *         in: query
 *         description: Filter by transaction status
 *         schema:
 *           type: string
 *           enum: [pending, completed, failed, reversed]
 *           example: "completed"
 *       - name: dateFrom
 *         in: query
 *         description: Start date for filtering (ISO 8601)
 *         schema:
 *           type: string
 *           format: date-time
 *           example: "2024-01-01T00:00:00.000Z"
 *       - name: dateTo
 *         in: query
 *         description: End date for filtering (ISO 8601)
 *         schema:
 *           type: string
 *           format: date-time
 *           example: "2024-12-31T23:59:59.999Z"
 *       - name: sortBy
 *         in: query
 *         description: Field to sort by
 *         schema:
 *           type: string
 *           enum: [createdAt, amount, type, status]
 *           default: "createdAt"
 *           example: "createdAt"
 *       - name: sortOrder
 *         in: query
 *         description: Sort order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: "desc"
 *           example: "desc"
 *     responses:
 *       200:
 *         description: Transaction history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletTransactionListResponse'
 *             example:
 *               success: true
 *               message: "Transaction history retrieved successfully"
 *               data:
 *                 transactions:
 *                   - _id: "60d5ec49f8c6a7001c8a1b2c"
 *                     walletId: "60d5ec49f8c6a7001c8a1b2d"
 *                     affiliateId: "60d5ec49f8c6a7001c8a1b2e"
 *                     type: "commission_credit"
 *                     amount: 500.00
 *                     balanceBefore: 1250.50
 *                     balanceAfter: 1750.50
 *                     currency: "NGN"
 *                     description: "Commission earned from flight booking"
 *                     reference: "COMMISSIONCREDIT_1640995200000_1b2c3d"
 *                     status: "completed"
 *                     processedAt: "2024-01-15T10:30:00.000Z"
 *                     createdAt: "2024-01-15T10:30:00.000Z"
 *                   - _id: "60d5ec49f8c6a7001c8a1b2f"
 *                     walletId: "60d5ec49f8c6a7001c8a1b2d"
 *                     affiliateId: "60d5ec49f8c6a7001c8a1b2e"
 *                     type: "withdrawal_debit"
 *                     amount: 1000.00
 *                     balanceBefore: 2750.50
 *                     balanceAfter: 1750.50
 *                     currency: "NGN"
 *                     description: "Withdrawal to bank account"
 *                     reference: "WITHDRAWALDEBIT_1640995200000_1b2c3d"
 *                     status: "completed"
 *                     processedAt: "2024-01-14T15:20:00.000Z"
 *                     createdAt: "2024-01-14T15:20:00.000Z"
 *                 pagination:
 *                   page: 1
 *                   limit: 20
 *                   total: 45
 *                   pages: 3
 *                   hasNext: true
 *                   hasPrev: false
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: Wallet not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 * 
 * /api/v1/wallets/{affiliateId}/freeze:
 *   post:
 *     tags:
 *       - Wallet Status Management
 *     summary: Freeze wallet
 *     description: Freezes an affiliate's wallet, preventing all transactions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: affiliateId
 *         in: path
 *         required: true
 *         description: Affiliate ID
 *         schema:
 *           type: string
 *           example: "60d5ec49f8c6a7001c8a1b2d"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FreezeWalletRequest'
 *           example:
 *             reason: "Pending verification of business documents"
 *     responses:
 *       200:
 *         description: Wallet frozen successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletResponse'
 *             example:
 *               success: true
 *               message: "Wallet frozen successfully"
 *               data:
 *                 _id: "60d5ec49f8c6a7001c8a1b2c"
 *                 affiliateId: "60d5ec49f8c6a7001c8a1b2d"
 *                 balance: 1750.50
 *                 totalEarned: 25000.75
 *                 totalWithdrawn: 9250.25
 *                 currency: "NGN"
 *                 status: "frozen"
 *                 freezeReason: "Pending verification of business documents"
 *                 frozenAt: "2024-01-15T10:30:00.000Z"
 *                 updatedAt: "2024-01-15T10:30:00.000Z"
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: Wallet not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 * 
 * /api/v1/wallets/{affiliateId}/unfreeze:
 *   post:
 *     tags:
 *       - Wallet Status Management
 *     summary: Unfreeze wallet
 *     description: Unfreezes an affiliate's wallet, allowing transactions to resume
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: affiliateId
 *         in: path
 *         required: true
 *         description: Affiliate ID
 *         schema:
 *           type: string
 *           example: "60d5ec49f8c6a7001c8a1b2d"
 *     responses:
 *       200:
 *         description: Wallet unfrozen successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletResponse'
 *             example:
 *               success: true
 *               message: "Wallet unfrozen successfully"
 *               data:
 *                 _id: "60d5ec49f8c6a7001c8a1b2c"
 *                 affiliateId: "60d5ec49f8c6a7001c8a1b2d"
 *                 balance: 1750.50
 *                 totalEarned: 25000.75
 *                 totalWithdrawn: 9250.25
 *                 currency: "NGN"
 *                 status: "active"
 *                 freezeReason: null
 *                 frozenAt: null
 *                 updatedAt: "2024-01-15T10:35:00.000Z"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: Wallet not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 * 
 * /api/v1/wallets/{affiliateId}/suspend:
 *   post:
 *     tags:
 *       - Wallet Status Management
 *     summary: Suspend wallet
 *     description: Suspends an affiliate's wallet, preventing all transactions (more severe than freeze)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: affiliateId
 *         in: path
 *         required: true
 *         description: Affiliate ID
 *         schema:
 *           type: string
 *           example: "60d5ec49f8c6a7001c8a1b2d"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SuspendWalletRequest'
 *           example:
 *             reason: "Violation of terms and conditions"
 *     responses:
 *       200:
 *         description: Wallet suspended successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletResponse'
 *             example:
 *               success: true
 *               message: "Wallet suspended successfully"
 *               data:
 *                 _id: "60d5ec49f8c6a7001c8a1b2c"
 *                 affiliateId: "60d5ec49f8c6a7001c8a1b2d"
 *                 balance: 1750.50
 *                 totalEarned: 25000.75
 *                 totalWithdrawn: 9250.25
 *                 currency: "NGN"
 *                 status: "suspended"
 *                 freezeReason: "Violation of terms and conditions"
 *                 frozenAt: "2024-01-15T10:30:00.000Z"
 *                 updatedAt: "2024-01-15T10:30:00.000Z"
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: Wallet not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 * 
 * /api/v1/wallets/{affiliateId}/validate:
 *   get:
 *     tags:
 *       - Wallet Validation
 *     summary: Validate wallet for operations
 *     description: Validates wallet status and capabilities for specific operations
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: affiliateId
 *         in: path
 *         required: true
 *         description: Affiliate ID
 *         schema:
 *           type: string
 *           example: "60d5ec49f8c6a7001c8a1b2d"
 *       - name: operation
 *         in: query
 *         description: Operation to validate
 *         schema:
 *           type: string
 *           enum: [credit, debit, withdrawal]
 *           example: "withdrawal"
 *       - name: amount
 *         in: query
 *         description: Amount for validation (required for debit/withdrawal operations)
 *         schema:
 *           type: number
 *           minimum: 0.01
 *           example: 1000.00
 *     responses:
 *       200:
 *         description: Wallet validation completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletValidationResponse'
 *             examples:
 *               valid:
 *                 summary: Valid wallet
 *                 value:
 *                   success: true
 *                   message: "Wallet validation completed"
 *                   data:
 *                     valid: true
 *                     canWithdraw: true
 *                     canCredit: true
 *                     canDebit: true
 *                     issues: []
 *                     recommendations: []
 *               invalid:
 *                 summary: Invalid wallet
 *                 value:
 *                   success: true
 *                   message: "Wallet validation completed"
 *                   data:
 *                     valid: false
 *                     canWithdraw: false
 *                     canCredit: true
 *                     canDebit: false
 *                     issues:
 *                       - "Insufficient balance for withdrawal"
 *                       - "Bank details not configured"
 *                     recommendations:
 *                       - "Update bank details for withdrawals"
 *                       - "Ensure sufficient balance before withdrawal"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: Wallet not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 * 
 * /api/v1/wallets/{affiliateId}/bank-details:
 *   put:
 *     tags:
 *       - Wallet Management
 *     summary: Update wallet bank details
 *     description: Updates bank account details for an affiliate's wallet
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: affiliateId
 *         in: path
 *         required: true
 *         description: Affiliate ID
 *         schema:
 *           type: string
 *           example: "60d5ec49f8c6a7001c8a1b2d"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateBankDetailsRequest'
 *           example:
 *             accountName: "John Doe Travel Services"
 *             accountNumber: "0123456789"
 *             bankCode: "058"
 *             bankName: "Guaranty Trust Bank"
 *     responses:
 *       200:
 *         description: Bank details updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletResponse'
 *             example:
 *               success: true
 *               message: "Bank details updated successfully"
 *               data:
 *                 _id: "60d5ec49f8c6a7001c8a1b2c"
 *                 affiliateId: "60d5ec49f8c6a7001c8a1b2d"
 *                 balance: 1750.50
 *                 totalEarned: 25000.75
 *                 totalWithdrawn: 9250.25
 *                 currency: "NGN"
 *                 status: "active"
 *                 bankDetails:
 *                   accountName: "John Doe Travel Services"
 *                   accountNumber: "0123456789"
 *                   bankCode: "058"
 *                   bankName: "Guaranty Trust Bank"
 *                 updatedAt: "2024-01-15T10:30:00.000Z"
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: Wallet not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 * 
 * /api/v1/wallets/{affiliateId}/statistics:
 *   get:
 *     tags:
 *       - Wallet Analytics
 *     summary: Get wallet statistics
 *     description: Retrieves detailed statistics for an affiliate's wallet transactions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: affiliateId
 *         in: path
 *         required: true
 *         description: Affiliate ID
 *         schema:
 *           type: string
 *           example: "60d5ec49f8c6a7001c8a1b2d"
 *       - name: dateFrom
 *         in: query
 *         description: Start date for statistics (ISO 8601)
 *         schema:
 *           type: string
 *           format: date-time
 *           example: "2024-01-01T00:00:00.000Z"
 *       - name: dateTo
 *         in: query
 *         description: End date for statistics (ISO 8601)
 *         schema:
 *           type: string
 *           format: date-time
 *           example: "2024-12-31T23:59:59.999Z"
 *     responses:
 *       200:
 *         description: Wallet statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletStatisticsResponse'
 *             example:
 *               success: true
 *               message: "Wallet statistics retrieved successfully"
 *               data:
 *                 totalTransactions: 45
 *                 totalAmount: 25000.75
 *                 byType:
 *                   - type: "commission_credit"
 *                     count: 30
 *                     totalAmount: 15000.50
 *                     avgAmount: 500.02
 *                   - type: "withdrawal_debit"
 *                     count: 10
 *                     totalAmount: 8000.25
 *                     avgAmount: 800.03
 *                   - type: "adjustment_credit"
 *                     count: 5
 *                     totalAmount: 2000.00
 *                     avgAmount: 400.00
 *                 dateRange:
 *                   from: "2024-01-01"
 *                   to: "2024-12-31"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: Wallet not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 * 
 * /api/v1/wallets/transactions/{transactionId}/reverse:
 *   post:
 *     tags:
 *       - Wallet Transactions
 *     summary: Reverse a wallet transaction
 *     description: Reverses a completed wallet transaction and creates a compensating transaction
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: transactionId
 *         in: path
 *         required: true
 *         description: Transaction ID to reverse
 *         schema:
 *           type: string
 *           example: "60d5ec49f8c6a7001c8a1b2c"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReverseTransactionRequest'
 *           example:
 *             reason: "Booking cancelled by customer"
 *     responses:
 *       200:
 *         description: Transaction reversed successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/StandardSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         originalTransaction:
 *                           $ref: '#/components/schemas/WalletTransaction'
 *                         reversalTransaction:
 *                           $ref: '#/components/schemas/WalletTransaction'
 *             example:
 *               success: true
 *               message: "Transaction reversed successfully"
 *               data:
 *                 originalTransaction:
 *                   _id: "60d5ec49f8c6a7001c8a1b2c"
 *                   type: "commission_credit"
 *                   amount: 500.00
 *                   status: "reversed"
 *                   reversedAt: "2024-01-15T10:30:00.000Z"
 *                   reversalReason: "Booking cancelled by customer"
 *                 reversalTransaction:
 *                   _id: "60d5ec49f8c6a7001c8a1b2f"
 *                   type: "reversal_credit"
 *                   amount: 500.00
 *                   status: "completed"
 *                   description: "Reversal of commission credit - Booking cancelled by customer"
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: Transaction not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *       409:
 *         description: Transaction cannot be reversed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *             examples:
 *               alreadyReversed:
 *                 summary: Already reversed
 *                 value:
 *                   success: false
 *                   message: "Transaction is already reversed"
 *                   errorCode: "TRANSACTION_ALREADY_REVERSED"
 *                   timestamp: "2024-01-15T10:30:00.000Z"
 *               notCompleted:
 *                 summary: Not completed
 *                 value:
 *                   success: false
 *                   message: "Only completed transactions can be reversed"
 *                   errorCode: "TRANSACTION_NOT_COMPLETED"
 *                   timestamp: "2024-01-15T10:30:00.000Z"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 * 
 * /api/v1/wallets/system/statistics:
 *   get:
 *     tags:
 *       - System Statistics
 *     summary: Get system-wide wallet statistics
 *     description: Retrieves aggregated statistics across all wallets in the system
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System wallet statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SystemWalletStatisticsResponse'
 *             example:
 *               success: true
 *               message: "System wallet statistics retrieved successfully"
 *               data:
 *                 totalBalance: 1250000.75
 *                 totalEarned: 2500000.50
 *                 totalWithdrawn: 1250000.25
 *                 activeWallets: 150
 *                 frozenWallets: 5
 *                 suspendedWallets: 2
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 * 
 * /api/v1/wallets/bulk-operations:
 *   post:
 *     tags:
 *       - Bulk Operations
 *     summary: Perform bulk wallet operations
 *     description: Executes multiple wallet operations in a single request for efficiency
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BulkWalletOperation'
 *           example:
 *             operations:
 *               - affiliateId: "60d5ec49f8c6a7001c8a1b2d"
 *                 operation: "credit"
 *                 amount: 500.00
 *                 transactionRef: "BULK_CREDIT_001"
 *                 description: "Bulk commission credit"
 *                 metadata:
 *                   batchId: "BATCH_001"
 *               - affiliateId: "60d5ec49f8c6a7001c8a1b2e"
 *                 operation: "credit"
 *                 amount: 750.00
 *                 transactionRef: "BULK_CREDIT_002"
 *                 description: "Bulk commission credit"
 *                 metadata:
 *                   batchId: "BATCH_001"
 *               - affiliateId: "60d5ec49f8c6a7001c8a1b2f"
 *                 operation: "freeze"
 *                 reason: "Bulk verification pending"
 *     responses:
 *       200:
 *         description: Bulk operations completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BulkOperationResponse'
 *             example:
 *               success: true
 *               message: "Bulk operations completed"
 *               data:
 *                 totalOperations: 3
 *                 successfulOperations: 2
 *                 failedOperations: 1
 *                 results:
 *                   - affiliateId: "60d5ec49f8c6a7001c8a1b2d"
 *                     operation: "credit"
 *                     success: true
 *                     transactionId: "60d5ec49f8c6a7001c8a1b30"
 *                   - affiliateId: "60d5ec49f8c6a7001c8a1b2e"
 *                     operation: "credit"
 *                     success: true
 *                     transactionId: "60d5ec49f8c6a7001c8a1b31"
 *                   - affiliateId: "60d5ec49f8c6a7001c8a1b2f"
 *                     operation: "freeze"
 *                     success: false
 *                     error: "Wallet not found"
 *                 processingTime: 1250.5
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 * 
 * /api/v1/wallets/{affiliateId}/health:
 *   get:
 *     tags:
 *       - Wallet Health
 *     summary: Check wallet health and integrity
 *     description: Performs comprehensive health checks on wallet data integrity and consistency
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: affiliateId
 *         in: path
 *         required: true
 *         description: Affiliate ID
 *         schema:
 *           type: string
 *           example: "60d5ec49f8c6a7001c8a1b2d"
 *     responses:
 *       200:
 *         description: Wallet health check completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletHealthResponse'
 *             examples:
 *               healthy:
 *                 summary: Healthy wallet
 *                 value:
 *                   success: true
 *                   message: "Wallet health check completed"
 *                   data:
 *                     healthy: true
 *                     balanceIntegrity: true
 *                     transactionConsistency: true
 *                     bankDetailsValid: true
 *                     issues: []
 *                     lastChecked: "2024-01-15T10:30:00.000Z"
 *               unhealthy:
 *                 summary: Unhealthy wallet
 *                 value:
 *                   success: true
 *                   message: "Wallet health check completed"
 *                   data:
 *                     healthy: false
 *                     balanceIntegrity: false
 *                     transactionConsistency: true
 *                     bankDetailsValid: false
 *                     issues:
 *                       - type: "balance_mismatch"
 *                         severity: "medium"
 *                         description: "Balance calculation discrepancy detected"
 *                         recommendation: "Recalculate balance from transaction history"
 *                       - type: "invalid_bank_details"
 *                         severity: "low"
 *                         description: "Bank account number format is invalid"
 *                         recommendation: "Update bank details with correct format"
 *                     lastChecked: "2024-01-15T10:30:00.000Z"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: Wallet not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

module.exports = {};