// v1/docs/templates/schema-definition-template.js
// Template for consistent schema definitions across all API modules

/**
 * Standard schema definition template
 * Use this template to ensure consistency across all API schema definitions
 */

/**
 * @openapi
 * components:
 *   schemas:
 *     # Main Resource Schema
 *     [ResourceName]:
 *       type: object
 *       required:
 *         - [requiredField1]
 *         - [requiredField2]
 *       properties:
 *         _id:
 *           type: string
 *           description: Unique identifier for the [resource]
 *           example: "60d5ec49f8c6a7001c8a1b2c"
 *           readOnly: true
 *         
 *         # String fields
 *         [stringField]:
 *           type: string
 *           description: [Field description]
 *           example: "[Example value]"
 *           minLength: [min]
 *           maxLength: [max]
 *           pattern: "[regex pattern if applicable]"
 *         
 *         # Number fields
 *         [numberField]:
 *           type: number
 *           description: [Field description]
 *           example: 12345.67
 *           minimum: [min value]
 *           maximum: [max value]
 *           multipleOf: [if applicable]
 *         
 *         # Integer fields
 *         [integerField]:
 *           type: integer
 *           description: [Field description]
 *           example: 42
 *           minimum: [min value]
 *           maximum: [max value]
 *         
 *         # Boolean fields
 *         [booleanField]:
 *           type: boolean
 *           description: [Field description]
 *           example: true
 *           default: [default value if applicable]
 *         
 *         # Enum fields
 *         [enumField]:
 *           type: string
 *           enum: [value1, value2, value3]
 *           description: [Field description with possible values]
 *           example: "value1"
 *           default: "[default value if applicable]"
 *         
 *         # Date/DateTime fields
 *         [dateField]:
 *           type: string
 *           format: date
 *           description: [Field description]
 *           example: "2024-01-15"
 *         
 *         [dateTimeField]:
 *           type: string
 *           format: date-time
 *           description: [Field description]
 *           example: "2024-01-15T14:30:00Z"
 *           readOnly: true
 *         
 *         # Array fields
 *         [arrayField]:
 *           type: array
 *           description: [Field description]
 *           items:
 *             type: [item type]
 *             # OR reference to another schema
 *             # $ref: '#/components/schemas/[ItemSchema]'
 *           example: ["item1", "item2", "item3"]
 *           minItems: [min]
 *           maxItems: [max]
 *         
 *         # Object fields (nested)
 *         [objectField]:
 *           type: object
 *           description: [Field description]
 *           properties:
 *             [nestedField1]:
 *               type: string
 *               example: "nested value"
 *             [nestedField2]:
 *               type: number
 *               example: 123
 *           required:
 *             - [nestedField1]
 *         
 *         # Reference to another schema
 *         [referenceField]:
 *           $ref: '#/components/schemas/[ReferencedSchema]'
 *         
 *         # Timestamps (standard pattern)
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp when the [resource] was created
 *           example: "2024-01-15T10:30:00Z"
 *           readOnly: true
 *         
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp when the [resource] was last updated
 *           example: "2024-01-15T14:30:00Z"
 *           readOnly: true
 *     
 *     # Request Schema (for POST/PUT operations)
 *     [ResourceName]CreateRequest:
 *       type: object
 *       required:
 *         - [requiredField1]
 *         - [requiredField2]
 *       properties:
 *         # Include only fields that can be set during creation
 *         # Exclude: _id, createdAt, updatedAt, and other system-generated fields
 *         [field1]:
 *           type: string
 *           description: [Field description]
 *           example: "[Example value]"
 *           minLength: [min]
 *           maxLength: [max]
 *         
 *         [field2]:
 *           type: number
 *           description: [Field description]
 *           example: 123.45
 *           minimum: [min]
 *           maximum: [max]
 *     
 *     # Update Request Schema
 *     [ResourceName]UpdateRequest:
 *       type: object
 *       properties:
 *         # Usually all fields are optional for updates
 *         # Include fields that can be updated
 *         [field1]:
 *           type: string
 *           description: [Field description]
 *           example: "[Example value]"
 *           minLength: [min]
 *           maxLength: [max]
 *         
 *         [field2]:
 *           type: number
 *           description: [Field description]
 *           example: 123.45
 *           minimum: [min]
 *           maximum: [max]
 *     
 *     # List Response Schema (for paginated endpoints)
 *     [ResourceName]ListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "[Resources] retrieved successfully"
 *         data:
 *           type: object
 *           properties:
 *             items:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/[ResourceName]'
 *             pagination:
 *               $ref: '#/components/schemas/Pagination'
 *     
 *     # Statistics/Analytics Schema
 *     [ResourceName]Statistics:
 *       type: object
 *       properties:
 *         total[ResourceName]s:
 *           type: integer
 *           description: Total number of [resources]
 *           example: 150
 *           minimum: 0
 *         
 *         active[ResourceName]s:
 *           type: integer
 *           description: Number of active [resources]
 *           example: 125
 *           minimum: 0
 *         
 *         [metricField]:
 *           type: number
 *           description: [Metric description]
 *           example: 12345.67
 *         
 *         dateRange:
 *           type: object
 *           properties:
 *             startDate:
 *               type: string
 *               format: date-time
 *               example: "2024-01-01T00:00:00Z"
 *             endDate:
 *               type: string
 *               format: date-time
 *               example: "2024-12-31T23:59:59Z"
 *         
 *         lastUpdated:
 *           type: string
 *           format: date-time
 *           description: When the statistics were last calculated
 *           example: "2024-01-15T14:30:00Z"
 *     
 *     # Error Schemas (module-specific)
 *     [ModuleName]Error:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           description: Human-readable error message
 *           example: "[Module] operation failed"
 *         errorCode:
 *           type: string
 *           description: Machine-readable error code
 *           example: "[MODULE]_ERROR"
 *           enum:
 *             - "[MODULE]_NOT_FOUND"
 *             - "[MODULE]_VALIDATION_ERROR"
 *             - "[MODULE]_BUSINESS_RULE_VIOLATION"
 *             - "[MODULE]_INSUFFICIENT_PERMISSIONS"
 *         errors:
 *           type: array
 *           description: Detailed error information (for validation errors)
 *           items:
 *             type: object
 *             properties:
 *               field:
 *                 type: string
 *                 description: Field that caused the error
 *                 example: "[fieldName]"
 *               message:
 *                 type: string
 *                 description: Field-specific error message
 *                 example: "[Field] is required"
 *               code:
 *                 type: string
 *                 description: Field-specific error code
 *                 example: "REQUIRED_FIELD"
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
 * SCHEMA DEFINITION GUIDELINES:
 * 
 * 1. NAMING CONVENTIONS:
 *    - Use PascalCase for schema names: "WalletTransaction", "AffiliateStats"
 *    - Use descriptive names that clearly indicate the schema purpose
 *    - Add suffixes for different schema types: "Request", "Response", "Error"
 * 
 * 2. REQUIRED FIELDS:
 *    - Always specify required fields array
 *    - Be conservative - only mark truly required fields
 *    - Consider business logic requirements, not just database constraints
 * 
 * 3. FIELD DESCRIPTIONS:
 *    - Write clear, concise descriptions
 *    - Explain business meaning, not just technical details
 *    - Include units for numeric fields (currency, percentages, etc.)
 * 
 * 4. EXAMPLES:
 *    - Use realistic, domain-appropriate examples
 *    - Keep examples consistent across related schemas
 *    - Include edge cases where helpful
 * 
 * 5. VALIDATION:
 *    - Include all validation constraints (min, max, pattern)
 *    - Use appropriate string formats (email, date, date-time, uri)
 *    - Specify enum values where applicable
 * 
 * 6. RELATIONSHIPS:
 *    - Use $ref for complex nested objects
 *    - Keep inline objects simple (max 2-3 properties)
 *    - Document foreign key relationships clearly
 * 
 * 7. TIMESTAMPS:
 *    - Always use ISO 8601 format (date-time)
 *    - Mark system-generated timestamps as readOnly
 *    - Use consistent field names (createdAt, updatedAt)
 * 
 * 8. ARRAYS:
 *    - Specify item types clearly
 *    - Include minItems/maxItems where applicable
 *    - Use $ref for complex array items
 * 
 * 9. ENUMS:
 *    - List all possible values
 *    - Use consistent naming (lowercase, UPPERCASE, or camelCase)
 *    - Include default values where appropriate
 * 
 * 10. ERROR SCHEMAS:
 *     - Follow consistent error response structure
 *     - Include module-specific error codes
 *     - Provide helpful error messages
 *     - Include timestamp and request ID for debugging
 * 
 * 11. REUSABILITY:
 *     - Create shared schemas for common patterns
 *     - Use composition (allOf) for extending base schemas
 *     - Avoid duplication across modules
 * 
 * 12. DOCUMENTATION:
 *     - Include business context in descriptions
 *     - Document any side effects or special behavior
 *     - Reference related endpoints or schemas
 *     - Explain complex validation rules
 */

module.exports = {};