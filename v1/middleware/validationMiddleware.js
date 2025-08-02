// v1/middleware/validationMiddleware.js
const asyncHandler = require('./asyncHandler');
const { ApiError } = require('../utils/apiError');
const { StatusCodes } = require('http-status-codes');

/**
 * @function validate
 * @description Middleware to validate request body, params, or query using Zod schemas.
 * @param {object} schema - The Zod schema to use for validation.
 * @returns {Function} An Express middleware function.
 */
const validate = (schema) =>
  asyncHandler(async (req, res, next) => {
    try {
      // Validate request body, params, and query based on the schema
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error.name === 'ZodError') {
        const messages = error.errors.map((err) => `${err.path.join('.')} - ${err.message}`);
        throw new ApiError(`Validation failed: ${messages.join(', ')}`, StatusCodes.BAD_REQUEST);
      }
      next(error); // Pass other errors to the global error handler
    }
  });

module.exports = validate;