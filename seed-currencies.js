// Seed script to initialize currencies with Open Exchange Rates API
// Run this to populate the database with default currencies
// Usage: node seed-currencies.js

require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');

const MONGO_URI = process.env.MONGO_URI;
const EXCHANGE_RATE_API_URL = 'https://open.er-api.com/v6/latest';
const BASE_CURRENCY = 'NGN';

console.log('🌍 Currency Seeding Script');
console.log('═'.repeat(60));
console.log(`MongoDB URI: ${MONGO_URI?.substring(0, 30)}...`);
console.log('═'.repeat(60));
console.log('');

// Currency schema
const currencySchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true },
  name: { type: String, required: true },
  symbol: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  isBaseCurrency: { type: Boolean, default: false },
  markup: { type: Number, default: 0 },
  exchangeRate: { type: Number, required: true, default: 1 },
  lastUpdated: { type: Date, default: Date.now },
  apiSource: { type: String, default: 'frankfurter-api' },
  fallbackRate: { type: Number, default: 1 },
}, { timestamps: true });

const Currency = mongoose.model('Currency', currencySchema);

async function fetchExchangeRates() {
  try {
    console.log('📡 Fetching exchange rates from Open Exchange Rates API...');
    const response = await axios.get(`${EXCHANGE_RATE_API_URL}/${BASE_CURRENCY}`, {
      timeout: 10000,
    });

    if (response.data && response.data.result === 'success' && response.data.rates) {
      const rates = response.data.rates;
      console.log(`✅ Received ${Object.keys(rates).length} exchange rates`);
      console.log(`   Base currency: ${response.data.base_code}`);
      console.log(`   Last updated: ${new Date(response.data.time_last_update_unix * 1000).toISOString()}`);
      
      return {
        success: true,
        rates: rates,
        lastUpdated: new Date(response.data.time_last_update_unix * 1000),
      };
    }

    throw new Error('API returned invalid data');
  } catch (error) {
    console.error('❌ Failed to fetch exchange rates:', error.message);
    return { success: false, error: error.message };
  }
}

async function seedCurrencies() {
  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Check if currencies already exist
    const existingCount = await Currency.countDocuments();
    if (existingCount > 0) {
      console.log(`⚠️  Database already has ${existingCount} currencies`);
      console.log('   Do you want to delete and reseed? (This will delete existing data)');
      console.log('   To proceed, run: node seed-currencies.js --force\n');
      
      if (!process.argv.includes('--force')) {
        console.log('❌ Aborted. Use --force flag to reseed.\n');
        await mongoose.disconnect();
        process.exit(0);
      }
      
      console.log('🗑️  Deleting existing currencies...');
      await Currency.deleteMany({});
      console.log('✅ Deleted existing currencies\n');
    }

    // Fetch current rates
    const ratesData = await fetchExchangeRates();
    
    if (!ratesData.success) {
      console.error('❌ Cannot seed without exchange rates');
      console.log('   Using fallback rates instead...\n');
    }

    // Default currencies to seed
    const defaultCurrencies = [
      {
        code: 'NGN',
        name: 'Nigerian Naira',
        symbol: '₦',
        isBaseCurrency: true,
        exchangeRate: 1,
        fallbackRate: 1,
        markup: 0,
      },
      {
        code: 'USD',
        name: 'US Dollar',
        symbol: '$',
        exchangeRate: ratesData.rates?.USD || 0.0013,
        fallbackRate: 0.0013,
        markup: 2,
      },
      {
        code: 'EUR',
        name: 'Euro',
        symbol: '€',
        exchangeRate: ratesData.rates?.EUR || 0.0012,
        fallbackRate: 0.0012,
        markup: 2,
      },
      {
        code: 'GBP',
        name: 'British Pound',
        symbol: '£',
        exchangeRate: ratesData.rates?.GBP || 0.0010,
        fallbackRate: 0.0010,
        markup: 2,
      },
      {
        code: 'ZAR',
        name: 'South African Rand',
        symbol: 'R',
        exchangeRate: ratesData.rates?.ZAR || 0.024,
        fallbackRate: 0.024,
        markup: 1.5,
      },
    ];

    console.log('💾 Seeding currencies...\n');
    
    for (const currencyData of defaultCurrencies) {
      const currency = new Currency({
        ...currencyData,
        lastUpdated: ratesData.lastUpdated || new Date(),
        apiSource: ratesData.success ? 'open-exchange-rates' : 'fallback',
      });
      
      await currency.save();
      
      const effectiveRate = currency.exchangeRate * (1 + currency.markup / 100);
      console.log(`✅ ${currency.code.padEnd(5)} ${currency.symbol.padEnd(3)} Rate: ${currency.exchangeRate.toFixed(6)}  Markup: ${currency.markup}%  Effective: ${effectiveRate.toFixed(6)}`);
    }

    console.log('\n📊 Summary:');
    console.log(`   ✅ Seeded ${defaultCurrencies.length} currencies`);
    console.log(`   📅 Last Updated: ${ratesData.lastUpdated?.toISOString() || 'N/A'}`);
    console.log(`   🔗 API Source: ${ratesData.success ? 'Open Exchange Rates API' : 'Fallback rates'}\n`);

    // Display final currencies
    console.log('📋 Currencies in Database:');
    console.log('─'.repeat(80));
    const currencies = await Currency.find({}).sort({ code: 1 });
    for (const curr of currencies) {
      const effectiveRate = curr.exchangeRate * (1 + curr.markup / 100);
      const status = curr.isActive ? '✓' : '✗';
      const base = curr.isBaseCurrency ? '(BASE)' : '';
      console.log(`${status} ${curr.code.padEnd(5)} ${curr.name.padEnd(20)} ${curr.symbol.padEnd(3)} ${effectiveRate.toFixed(6)} ${base}`);
    }
    console.log('─'.repeat(80));

    await mongoose.disconnect();
    console.log('\n✅ Done! Currencies seeded successfully.\n');
    console.log('🎉 You can now use the currency system!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the seeding
seedCurrencies();
