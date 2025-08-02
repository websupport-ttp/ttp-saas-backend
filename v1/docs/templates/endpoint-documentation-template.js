// v1/docs/templates/endpoint-documentation-template.js
// Template for consistent endpoint documentation across all API modules

/**
 * Standard endpoint documentation template
 * Use this template to ensure consistency across all API documentation
 */

/**
 * @openapi
 * /api/v1/[module]/[endpoint]:
 *   [method]:
 *     summary: [Brief description of what the endpoint does]
 *     description: [Detailed description including business logic and use cases]
 *     tags: [[Module Name]]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       # Path parameters
 *       - in: path
 *         name: [paramName]
 *         required: true
 *         schema:
 *           type: string
 *         description: [Parameter description]
 *         example: "[example value]"
 *       
 *       # Query parameters (use shared parameter references when possible)
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - $ref: '#/components/parameters/DateRangeStartParam'
 *       - $ref: '#/components/parameters/DateRangeEndParam'
 *       
 *       # Custom query parameters
 *       - in: query
 *         name: [paramName]
 *         schema:
 *           type: [type]
 *           enum: [value1, value2, value3] # if applicable
 *         description: [Parameter description]
 *         example: "[example value]"
 *     
 *     # For POST/PUT/PATCH requests
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/[RequestSchemaName]'
 *           examples:
 *             example1:
 *               summary: [Example summary]
 *               description: [Example description]
 *               value:
 *                 [field1]: "[example value]"
 *                 [field2]: "[example value]"
 *     
 *     responses:
 *       200:
 *         description: [Success response description]
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
 *                   example: "[Success message]"
 *                 data:
 *                   $ref: '#/components/schemas/[ResponseSchemaName]'
 *             examples:
 *               success:
 *                 summary: Successful response
 *                 value:
 *                   success: true
 *                   message: "[Success message]"
 *                   data:
 *                     [field1]: "[example value]"
 *                     [field2]: "[example value]"
 *       
 *       201:
 *         description: Resource created successfully
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
 *                   example: "[Creation success message]"
 *                 data:
 *                   $ref: '#/components/schemas/[CreatedResourceSchema]'
 *       
 *       400:
 *         description: Bad request - validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *             examples:
 *               validation_error:
 *                 summary: Validation error example
 *                 value:
 *                   success: false
 *                   message: "Validation failed"
 *                   errorCode: "VALIDATION_ERROR"
 *                   errors:
 *                     - field: "[fieldName]"
 *                       message: "[Validation error message]"
 *                   timestamp: "2024-01-15T14:30:00Z"
 *       
 *       401:
 *         description: Unauthorized - authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthenticationError'
 *       
 *       403:
 *         description: Forbidden - insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthorizationError'
 *       
 *       404:
 *         description: Resource not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *             examples:
 *               not_found:
 *                 summary: Resource not found example
 *                 value:
 *                   success: false
 *                   message: "[Resource] not found"
 *                   errorCode: "[MODULE]_NOT_FOUND"
 *                   timestamp: "2024-01-15T14:30:00Z"
 *       
 *       409:
 *         description: Conflict - resource already exists or business rule violation
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ConflictError'
 *       
 *       422:
 *         description: Unprocessable entity - business logic error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessLogicError'
 *       
 *       429:
 *         description: Too many requests - rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RateLimitError'
 *       
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ServerError'
 */

/**
 * DOCUMENTATION GUIDELINES:
 * 
 * 1. SUMMARY: Keep it concise (under 50 characters), action-oriented
 *    Good: "Get wallet balance and summary"
 *    Bad: "This endpoint retrieves the wallet balance information"
 * 
 * 2. DESCRIPTION: Provide context, business logic, and use cases
 *    - Explain what the endpoint does
 *    - Mention any side effects
 *    - Include business rules or constraints
 *    - Reference related endpoints if applicable
 * 
 * 3. TAGS: Use consistent tag names that match module structure
 *    - Use title case: "Wallet Management", "Analytics", "Affiliates"
 *    - Group related endpoints under the same tag
 * 
 * 4. PARAMETERS:
 *    - Always include examples
 *    - Use shared parameter references when possible
 *    - Document validation rules in schema
 *    - Include parameter constraints (min, max, pattern)
 * 
 * 5. REQUEST BODY:
 *    - Always reference schema components
 *    - Include multiple examples for complex requests
 *    - Document optional vs required fields clearly
 * 
 * 6. RESPONSES:
 *    - Document all possible HTTP status codes
 *    - Use consistent response structure
 *    - Include realistic examples
 *    - Reference shared error schemas
 * 
 * 7. SECURITY:
 *    - Always specify authentication requirements
 *    - Document role-based access control
 *    - Mention rate limiting if applicable
 * 
 * 8. EXAMPLES:
 *    - Use realistic data that matches your domain
 *    - Include edge cases in examples
 *    - Keep examples consistent across endpoints
 * 
 * 9. ERROR HANDLING:
 *    - Document all possible error scenarios
 *    - Use consistent error response format
 *    - Include helpful error messages
 *    - Reference shared error schemas
 * 
 * 10. CONSISTENCY:
 *     - Use the same terminology across all endpoints
 *     - Follow the same response structure pattern
 *     - Maintain consistent parameter naming
 *     - Use shared components wherever possible
 */

module.exports = {};