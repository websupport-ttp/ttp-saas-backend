/**
 * Seed script for test/dev/staging environments
 * Creates admin + customer users and default currencies
 * Usage: node seed-test-env.js [env]
 *   env: test (default), dev, staging
 */
require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ENV = process.argv[2] || 'test';
const DB_MAP = {
  test:    'ttp_test',
  dev:     'ttp_dev',
  staging: 'ttp_staging',
};

const dbName = DB_MAP[ENV];
if (!dbName) { console.error('Unknown env:', ENV); process.exit(1); }

// Build URI with correct database name
const baseUri = process.env.MONGO_URI.replace(/\/[^/?]+(\?|$)/, `/${dbName}$1`);
console.log(`Seeding ${dbName}...`);
console.log('URI:', baseUri.replace(/:([^@]+)@/, ':***@'));

mongoose.connect(baseUri).then(async () => {
  console.log('Connected to MongoDB\n');

  // ── Users ──────────────────────────────────────────────────────────────────
  const User = require('./v1/models/userModel');

  const users = [
    {
      firstName: 'Admin', lastName: 'TTP',
      email: 'admin@ttp.ng', password: 'Admin123!@#',
      role: 'Admin',
    },
    {
      firstName: 'Test', lastName: 'Customer',
      email: 'customer@ttp.ng', password: 'Customer123!',
      role: 'Customer',
    },
  ];

  for (const u of users) {
    try {
      const exists = await User.findOne({ email: u.email });
      if (exists) {
        console.log(`  ✓ User already exists: ${u.email}`);
        continue;
      }
      const hash = await bcrypt.hash(u.password, 12);
      await User.create({
        firstName: u.firstName,
        lastName:  u.lastName,
        email:     u.email,
        password:  hash,
        role:      u.role,
        isEmailVerified: true,
        isPhoneVerified: true,
        isActive:  true,
      });
      console.log(`  ✅ Created user: ${u.email} / ${u.password}`);
    } catch (e) {
      console.error(`  ❌ Failed to create ${u.email}:`, e.message);
    }
  }

  // ── Currencies ─────────────────────────────────────────────────────────────
  try {
    const Currency = require('./v1/models/currencyModel');
    const currencies = [
      { code: 'NGN', name: 'Nigerian Naira',   symbol: '₦', exchangeRate: 1,       isBaseCurrency: true,  isActive: true },
      { code: 'USD', name: 'US Dollar',         symbol: '$', exchangeRate: 0.00065, isBaseCurrency: false, isActive: true },
      { code: 'GBP', name: 'British Pound',     symbol: '£', exchangeRate: 0.00051, isBaseCurrency: false, isActive: true },
      { code: 'EUR', name: 'Euro',              symbol: '€', exchangeRate: 0.00060, isBaseCurrency: false, isActive: true },
    ];
    for (const c of currencies) {
      const exists = await Currency.findOne({ code: c.code });
      if (!exists) {
        await Currency.create(c);
        console.log(`  ✅ Created currency: ${c.code}`);
      } else {
        console.log(`  ✓ Currency exists: ${c.code}`);
      }
    }
  } catch (e) {
    console.error('  ❌ Currency seeding failed:', e.message);
  }

  // ── Site Settings ──────────────────────────────────────────────────────────
  try {
    const SiteSettings = require('./v1/models/siteSettingsModel');
    const exists = await SiteSettings.findOne({});
    if (!exists) {
      await SiteSettings.create({
        siteName: 'The Travel Place',
        siteUrl:  'https://ttp.ng',
        contactEmail: 'support@ttp.ng',
        isMaintenanceMode: false,
      });
      console.log('  ✅ Created site settings');
    } else {
      console.log('  ✓ Site settings exist');
    }
  } catch (e) {
    console.error('  ❌ Site settings seeding failed:', e.message);
  }

  await mongoose.disconnect();
  console.log('\nSeeding complete ✅');
}).catch(e => {
  console.error('Connection failed:', e.message);
  process.exit(1);
});
