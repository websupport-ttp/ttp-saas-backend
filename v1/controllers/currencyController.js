// v1/controllers/currencyController.js
const { StatusCodes } = require('http-status-codes');
const Currency = require('../models/currencyModel');
const { ApiError } = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../middleware/asyncHandler');
const { updateExchangeRates, convertCurrency } = require('../services/currencyService');
const logger = require('../utils/logger');

/**
 * @desc    Get all active currencies
 * @route   GET /api/v1/currencies
 * @access  Public
 */
const getAllCurrencies = asyncHandler(async (req, res) => {
  const currencies = await Currency.find({ isActive: true })
    .select('-createdBy -updatedBy')
    .sort({ code: 1 });

  ApiResponse.success(res, StatusCodes.OK, 'Currencies fetched successfully', {
    count: currencies.length,
    currencies: currencies.map(c => ({
      code: c.code,
      name: c.name,
      symbol: c.symbol,
      rate: c.getEffectiveRate(),
      markup: c.markup,
      lastUpdated: c.lastUpdated,
      isBaseCurrency: c.isBaseCurrency,
    })),
  });
});

/**
 * @desc    Get all currencies (including inactive) - Admin/Staff Tier 3+
 * @route   GET /api/v1/currencies/all
 * @access  Private/Staff (Tier 3+)
 */
const getAllCurrenciesAdmin = asyncHandler(async (req, res) => {
  const currencies = await Currency.find()
    .populate('createdBy', 'firstName lastName')
    .populate('updatedBy', 'firstName lastName')
    .sort({ code: 1 });

  ApiResponse.success(res, StatusCodes.OK, 'All currencies fetched successfully', {
    count: currencies.length,
    currencies,
  });
});

/**
 * @desc    Create new currency - Staff Tier 3+
 * @route   POST /api/v1/currencies
 * @access  Private/Staff (Tier 3+)
 */
const createCurrency = asyncHandler(async (req, res) => {
  const { code, name, symbol, markup, fallbackRate, isActive } = req.body;

  // Check if currency already exists
  const existingCurrency = await Currency.findOne({ code: code.toUpperCase() });

  if (existingCurrency) {
    throw new ApiError('Currency already exists', StatusCodes.CONFLICT);
  }

  const currency = await Currency.create({
    code: code.toUpperCase(),
    name,
    symbol,
    markup: markup || 0,
    fallbackRate: fallbackRate || 1,
    exchangeRate: fallbackRate || 1,
    isActive: isActive !== undefined ? isActive : true,
    apiSource: 'manual',
    createdBy: req.user.userId,
  });

  logger.info(`Currency ${code} created by user ${req.user.userId}`);

  ApiResponse.success(res, StatusCodes.CREATED, 'Currency created successfully', { currency });
});

/**
 * @desc    Update currency - Staff Tier 3+
 * @route   PUT /api/v1/currencies/:code
 * @access  Private/Staff (Tier 3+)
 */
const updateCurrency = asyncHandler(async (req, res) => {
  const { code } = req.params;
  const { name, symbol, markup, fallbackRate, isActive, exchangeRate } = req.body;

  const currency = await Currency.findOne({ code: code.toUpperCase() });

  if (!currency) {
    throw new ApiError('Currency not found', StatusCodes.NOT_FOUND);
  }

  // Prevent disabling base currency
  if (currency.isBaseCurrency && isActive === false) {
    throw new ApiError('Cannot disable base currency', StatusCodes.BAD_REQUEST);
  }

  // Update fields
  if (name) currency.name = name;
  if (symbol) currency.symbol = symbol;
  if (markup !== undefined) currency.markup = markup;
  if (fallbackRate !== undefined) currency.fallbackRate = fallbackRate;
  if (isActive !== undefined) currency.isActive = isActive;
  if (exchangeRate !== undefined) {
    currency.exchangeRate = exchangeRate;
    currency.apiSource = 'manual';
  }

  currency.updatedBy = req.user.userId;
  await currency.save();

  logger.info(`Currency ${code} updated by user ${req.user.userId}`);

  ApiResponse.success(res, StatusCodes.OK, 'Currency updated successfully', { currency });
});

/**
 * @desc    Delete currency - Staff Tier 3+
 * @route   DELETE /api/v1/currencies/:code
 * @access  Private/Staff (Tier 3+)
 */
const deleteCurrency = asyncHandler(async (req, res) => {
  const { code } = req.params;

  const currency = await Currency.findOne({ code: code.toUpperCase() });

  if (!currency) {
    throw new ApiError('Currency not found', StatusCodes.NOT_FOUND);
  }

  // Prevent deleting base currency
  if (currency.isBaseCurrency) {
    throw new ApiError('Cannot delete base currency', StatusCodes.BAD_REQUEST);
  }

  await currency.deleteOne();

  logger.info(`Currency ${code} deleted by user ${req.user.userId}`);

  ApiResponse.success(res, StatusCodes.OK, 'Currency deleted successfully');
});

/**
 * @desc    Update exchange rates from API - Staff Tier 3+
 * @route   POST /api/v1/currencies/update-rates
 * @access  Private/Staff (Tier 3+)
 */
const updateRates = asyncHandler(async (req, res) => {
  const result = await updateExchangeRates();

  if (!result.success) {
    throw new ApiError(result.message || 'Failed to update rates', StatusCodes.INTERNAL_SERVER_ERROR);
  }

  logger.info(`Exchange rates updated by user ${req.user.userId}`);

  ApiResponse.success(res, StatusCodes.OK, 'Exchange rates updated successfully', result);
});

/**
 * @desc    Convert amount between currencies
 * @route   POST /api/v1/currencies/convert
 * @access  Public
 */
const convert = asyncHandler(async (req, res) => {
  const { amount, from, to } = req.body;

  if (!amount || !from || !to) {
    throw new ApiError('Amount, from, and to currencies are required', StatusCodes.BAD_REQUEST);
  }

  const result = await convertCurrency(amount, from.toUpperCase(), to.toUpperCase());

  if (!result.success) {
    throw new ApiError(result.error, StatusCodes.BAD_REQUEST);
  }

  ApiResponse.success(res, StatusCodes.OK, 'Conversion successful', result);
});

module.exports = {
  getAllCurrencies,
  getAllCurrenciesAdmin,
  createCurrency,
  updateCurrency,
  deleteCurrency,
  updateRates,
  convert,
};
