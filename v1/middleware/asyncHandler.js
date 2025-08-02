// v1/middleware/asyncHandler.js
/**
 * @function asyncHandler
 * @description A higher-order function to wrap async route handlers.
 * It catches any errors and passes them to the Express error handling middleware.
 * This avoids repetitive try-catch blocks in every async controller function.
 * @param {Function} fn - The asynchronous function (Express route handler) to wrap.
 * @returns {Function} An Express middleware function.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;