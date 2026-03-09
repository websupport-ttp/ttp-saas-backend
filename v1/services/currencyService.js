// v1/services/currencyService.js
const axios = require('axios');
const Currency = require('../models/currencyModel');
const logger = require('../utils/logger');

/**
 * Frankfurter API - Free Currency Exchange Rates
 * No API key required, no rate limits
 * Docs: https://www.frankfurter.app/docs/
 * Base: EUR (European Central Bank rates)
 */

const FRANKFURTER_API_URL = 'https://api.frankfurter.app';
const BASE_CURRENCY = 'NGN'; // Nigerian Naira as base

/**
 * Fetch latest exchange rates from Frankfurter API
 * Since Frankfurter uses EUR as base, we need to convert to NGN base
 */
const fetchExchangeRates = async (baseCurrency = BASE_CURRENCY) => {
  try {
    // First, get EUR to all currencies
    const response = await axios.get(`${FRANKFURTER_API_URL}/latest`, {
      timeout: 10000,
    });

    if (response.data && response.data.rates) {
      const rates = response.data.rates;
      
      // Get NGN rate from EUR
      const ngnToEur = rates.NGN || 1700; // Fallback if NGN not available
      
      // Convert all rates to NGN base
      const ngnBasedRates = {
        NGN: 1, // Base currency
      };
      
      // Convert each rate from EUR base to NGN base
      for (const [currency, eurRate] of Object.entries(rates)) {
        if (currency !== 'NGN') {
          // Rate from NGN to currency = (EUR to currency) / (EUR to NGN)
          ngnBasedRates[currency] = eurRate / ngnToEur;
        }
      }
      
      return {
        success: true,
        rates: ngnBasedRates,
        lastUpdated: new Date(response.data.date),
      };
    }

    throw new Error('API returned invalid data');
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
          currency.apiSource = 'frankfurter-api';
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
