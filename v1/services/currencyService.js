// v1/services/currencyService.js
const axios = require('axios');
const Currency = require('../models/currencyModel');
const logger = require('../utils/logger');

/**
 * Open Exchange Rates Alternative - Free API
 * Using api.exchangeratesapi.io (free, no key required)
 * Supports 170+ currencies including NGN
 * Note: Limited to EUR base on free tier, we'll convert to NGN
 */

const EXCHANGE_RATE_API_URL = 'https://open.er-api.com/v6/latest';
const BASE_CURRENCY = 'NGN'; // Nigerian Naira as base

/**
 * Fetch latest exchange rates
 * Using open.er-api.com which supports direct base currency
 */
const fetchExchangeRates = async (baseCurrency = BASE_CURRENCY) => {
  try {
    logger.info(`Fetching exchange rates with base ${baseCurrency}...`);
    
    // Open Exchange Rates API supports direct base currency
    const response = await axios.get(`${EXCHANGE_RATE_API_URL}/${baseCurrency}`, {
      timeout: 10000,
    });

    if (response.data && response.data.result === 'success' && response.data.rates) {
      logger.info(`Successfully fetched ${Object.keys(response.data.rates).length} exchange rates`);
      
      return {
        success: true,
        rates: response.data.rates,
        lastUpdated: new Date(response.data.time_last_update_unix * 1000),
      };
    }

    throw new Error('API returned unsuccessful result');
  } catch (error) {
    logger.error('Failed to fetch exchange rates:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Update all currency exchange rates
 */
const updateExchangeRates = async () => {
  try {
    logger.info('Updating exchange rates...');

    const ratesData = await fetchExchangeRates();

    if (!ratesData.success) {
      logger.warn('Using fallback rates due to API failure');
      return { success: false, message: 'API unavailable, using fallback rates' };
    }

    const currencies = await Currency.find({ isActive: true });
    let updated = 0;
    let failed = 0;

    for (const currency of currencies) {
      try {
        const rate = ratesData.rates[currency.code];

        if (rate) {
          currency.exchangeRate = rate;
          currency.lastUpdated = ratesData.lastUpdated;
          currency.apiSource = 'open-exchange-rates';
          await currency.save();
          updated++;
        } else {
          logger.warn(`No rate found for ${currency.code}, using fallback`);
          currency.exchangeRate = currency.fallbackRate;
          currency.apiSource = 'fallback';
          await currency.save();
          failed++;
        }
      } catch (error) {
        logger.error(`Failed to update ${currency.code}:`, error.message);
        failed++;
      }
    }

    logger.info(`Exchange rates updated: ${updated} successful, ${failed} failed`);

    return {
      success: true,
      updated,
      failed,
      lastUpdated: ratesData.lastUpdated,
    };
  } catch (error) {
    logger.error('Exchange rate update failed:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Convert amount between currencies
 */
const convertCurrency = async (amount, fromCurrency, toCurrency) => {
  try {
    if (fromCurrency === toCurrency) {
      return { success: true, amount, rate: 1 };
    }

    const targetCurrency = await Currency.findOne({ code: toCurrency, isActive: true });

    if (!targetCurrency) {
      throw new Error(`Currency ${toCurrency} not found or inactive`);
    }

    const effectiveRate = targetCurrency.getEffectiveRate();
    const convertedAmount = amount * effectiveRate;

    return {
      success: true,
      amount: convertedAmount,
      rate: effectiveRate,
      markup: targetCurrency.markup,
    };
  } catch (error) {
    logger.error('Currency conversion failed:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Get all active currencies with rates
 */
const getActiveCurrencies = async () => {
  try {
    const currencies = await Currency.getActiveCurrencies();
    return {
      success: true,
      currencies: currencies.map(c => ({
        code: c.code,
        name: c.name,
        symbol: c.symbol,
        rate: c.getEffectiveRate(),
        markup: c.markup,
        lastUpdated: c.lastUpdated,
      })),
    };
  } catch (error) {
    logger.error('Failed to get currencies:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Initialize default currencies
 */
const initializeDefaultCurrencies = async () => {
  try {
    const count = await Currency.countDocuments();

    if (count > 0) {
      logger.info('Currencies already initialized');
      return;
    }

    const defaultCurrencies = [
      { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', isBaseCurrency: true, exchangeRate: 1, fallbackRate: 1 },
      { code: 'USD', name: 'US Dollar', symbol: '$', exchangeRate: 0.0013, fallbackRate: 0.0013, markup: 2 },
      { code: 'EUR', name: 'Euro', symbol: '€', exchangeRate: 0.0012, fallbackRate: 0.0012, markup: 2 },
      { code: 'GBP', name: 'British Pound', symbol: '£', exchangeRate: 0.0010, fallbackRate: 0.0010, markup: 2 },
      { code: 'ZAR', name: 'South African Rand', symbol: 'R', exchangeRate: 0.024, fallbackRate: 0.024, markup: 1.5 },
    ];

    await Currency.insertMany(defaultCurrencies);
    logger.info('Default currencies initialized');

    // Update rates immediately
    await updateExchangeRates();
  } catch (error) {
    logger.error('Failed to initialize currencies:', error);
  }
};

module.exports = {
  fetchExchangeRates,
  updateExchangeRates,
  convertCurrency,
  getActiveCurrencies,
  initializeDefaultCurrencies,
};
