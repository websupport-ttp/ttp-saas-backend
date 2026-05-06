require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');

const ENV = process.argv[2] || 'test';
const DB_MAP = { test: 'ttp_test', dev: 'ttp_dev', staging: 'ttp_staging', production: 'ttp_production' };
const dbName = DB_MAP[ENV] || 'ttp_test';

const uri = process.env.MONGO_URI.replace(/\/[^/?]+(\?|$)/, '/' + dbName + '$1');
console.log('Connecting to', dbName, '...');

mongoose.connect(uri).then(async () => {
  const coll = mongoose.connection.db.collection('users');
  const indexes = await coll.indexes();
  console.log('Existing indexes:', indexes.map(i => i.name).join(', '));

  const toDrop = [
    'staffEmployeeId_1',
    'staffDetails.employeeId_1',
    'staffDetails.managerId_1',
    'agentDetails.agentCode_1',
  ];

  for (const idx of toDrop) {
    try {
      await coll.dropIndex(idx);
      console.log('Dropped:', idx);
    } catch (e) {
      console.log('Skip:', idx, '-', e.message.split('\n')[0]);
    }
  }

  await mongoose.disconnect();
  console.log('Done');
}).catch(e => { console.error('Error:', e.message); process.exit(1); });
