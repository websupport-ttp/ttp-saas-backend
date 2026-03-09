// Manual script to update currency rates using Open Exchange Rates API
// Run this if automatic rate updates aren't working
// Usage: node update-currency-rates-manual.js

require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/the_travel_place';
const EXCHANGE_RATE_API_URL = 'https://open.er-api.com/v6/latest';
const BASE_CURRENCY = 'NGN';

// Currency schema (simplified)
const currencySchema = new mongoose.Schema({
  code: String,
  name: String,
  symbol: String,
  isActive: Boolean,
  isBaseCurrency: Boolean,
  markup: Number,
  exchangeRate: Number,
  lastUpdated: Date,
  apiSource: String,
  fallbackRate: Number,
}, { timestamps: true });

const Currency = mongoose.model('Currency', currencySchema);

async function fetchExchangeRates() {
  try {
    console.log('Fetching exchange rates from Open Exchange Rates API...');
    const response = await axios.get(`${EXCHANGE_RATE_API_URL}/${BASE_CURRENCY}`, {
      timeout: 10000,
    });

    if (response.data && response.data.result === 'success' && response.data.rates) {
      console.log('✅ Received rates from Open Exchange Rates API');
      console.log(`   Base currency: ${response.data.base_code}`);
      console.log(`   Date: ${new Date(response.data.time_last_update_unix * 1000).toISOString()}`);
      console.log(`   Currencies: ${Object.keys(response.data.rates).length}`);
      
      return {
        success: true,
        rates: response.data.rates,
        lastUpdated: new Date(response.data.time_last_update_unix * 1000),
      };
    }

    throw new Error('API returned invalid data');
  } catch (error) {
    console.error('❌ Failed to fetch exchange rates:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function updateCurrencyRates() {
  try {
    console.log('\n🚀 Starting currency rate update...\n');
    
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Fetch rates from API
    const ratesData = await fetchExchangeRates();

    if (!ratesData.success) {
      console.error('❌ Failed to fetch rates from API');
      process.exit(1);
    }

    // Get all currencies
    const currencies = await Currency.find({});
    console.log(`\nFound ${currencies.length} currencies in database\n`);

    let updated = 0;
    let failed = 0;

    for (const currency of currencies) {
      try {
        const rate = ratesData.rates[currency.code];

        if (rate) {
          const oldRate = currency.exchangeRate;
          currency.exchangeRate = rate;
          currency.lastUpdated = ratesData.lastUpdated;
          currency.apiSource = 'exchangerate-host';
          await currency.save();
          
          console.log(`✅ ${currency.code}: ${oldRate.toFixed(6)} → ${rate.toFixed(6)}`);
          updated++;
        } else {
          console.log(`⚠️  ${currency.code}: No rate found, using fallback (${currency.fallbackRate})`);
          currency.exchangeRate = currency.fallbackRate;
          currency.apiSource = 'fallback';
          await currency.save();
          failed++;
        }
      } catch (error) {
        console.error(`❌ ${currency.code}: Failed to update - ${error.message}`);
        failed++;
      }
    }

    console.log(`\n📊 Update Summary:`);
    console.log(`   ✅ Updated: ${updated}`);
    console.log(`   ⚠️  Failed: ${failed}`);
    console.log(`   📅 Last Updated: ${ratesData.lastUpdated.toISOString()}\n`);

    // Display final rates
    console.log('📋 Current Exchange Rates (NGN base):');
    console.log('─'.repeat(60));
    const finalCurrencies = await Currency.find({}).sort({ code: 1 });
    for (const curr of finalCurrencies) {
      const effectiveRate = curr.exchangeRate * (1 + curr.markup / 100);
      console.log(`${curr.code.padEnd(5)} ${curr.symbol.padEnd(3)} Rate: ${curr.exchangeRate.toFixed(6)}  Markup: ${curr.markup}%  Effective: ${effectiveRate.toFixed(6)}`);
    }
    console.log('─'.repeat(60));

    await mongoose.disconnect();
    console.log('\n✅ Done! Currency rates updated successfully.\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the update
updateCurrencyRates();
