require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ENV   = process.argv[2] || 'test';
const EMAIL = process.argv[3] || 'admin@ttp.ng';
const PASS  = process.argv[4] || 'Admin123!@#';

const DB_MAP = { test: 'ttp_test', dev: 'ttp_dev', staging: 'ttp_staging', production: 'ttp_production' };
const uri = process.env.MONGO_URI.replace(/\/[^/?]+(\?|$)/, '/' + DB_MAP[ENV] + '$1');

mongoose.connect(uri).then(async () => {
  const User = require('./v1/models/userModel');
  const hash = await bcrypt.hash(PASS, 12);
  const result = await User.updateOne({ email: EMAIL }, {
    $set: {
      password: hash,
      isEmailVerified: true,
      isPhoneVerified: true,
      isActive: true,
    }
  });
  console.log(result.matchedCount ? `✅ Password reset for ${EMAIL}` : `❌ User not found: ${EMAIL}`);
  await mongoose.disconnect();
}).catch(e => { console.error(e.message); process.exit(1); });
