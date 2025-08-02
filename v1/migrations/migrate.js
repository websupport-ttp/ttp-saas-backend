#!/usr/bin/env node
// v1/migrations/migrate.js
// Migration runner for affiliate system database setup

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Import migration modules
const { 
  createAffiliateIndexes, 
  dropAffiliateIndexes, 
  checkAffiliateIndexes 
} = require('./001-create-affiliate-indexes');

/**
 * Connect to MongoDB
 */
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI environment variable is not set');
    }

    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✓ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

/**
 * Disconnect from MongoDB
 */
const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    console.log('✓ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error disconnecting from MongoDB:', error.message);
  }
};

/**
 * Run migrations
 */
const runMigrations = async () => {
  try {
    console.log('🚀 Starting affiliate system migrations...\n');

    // Run index creation migration
    console.log('📋 Migration 001: Creating affiliate system indexes...');
    const indexResult = await createAffiliateIndexes();
    console.log('✅ Migration 001 completed successfully\n');

    console.log('🎉 All migrations completed successfully!');
    
    return {
      success: true,
      migrations: [
        { name: '001-create-affiliate-indexes', status: 'completed', result: indexResult }
      ]
    };

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
};

/**
 * Rollback migrations
 */
const rollbackMigrations = async () => {
  try {
    console.log('🔄 Starting affiliate system migration rollback...\n');

    // Rollback index creation
    console.log('📋 Rolling back Migration 001: Dropping affiliate system indexes...');
    const rollbackResult = await dropAffiliateIndexes();
    console.log('✅ Migration 001 rollback completed successfully\n');

    console.log('🎉 All migration rollbacks completed successfully!');
    
    return {
      success: true,
      rollbacks: [
        { name: '001-create-affiliate-indexes', status: 'rolled back', result: rollbackResult }
      ]
    };

  } catch (error) {
    console.error('❌ Migration rollback failed:', error.message);
    throw error;
  }
};

/**
 * Check migration status
 */
const checkMigrationStatus = async () => {
  try {
    console.log('🔍 Checking affiliate system migration status...\n');

    const indexStatus = await checkAffiliateIndexes();
    
    console.log('📊 Migration Status Report:');
    console.log('==========================');
    
    Object.entries(indexStatus).forEach(([collection, status]) => {
      if (status.exists) {
        console.log(`✅ ${collection}: ${status.indexCount} indexes`);
      } else {
        console.log(`❌ ${collection}: Not found`);
      }
    });

    console.log('\n📋 Detailed Index Information:');
    console.log('===============================');
    
    Object.entries(indexStatus).forEach(([collection, status]) => {
      if (status.exists && status.indexes) {
        console.log(`\n${collection.toUpperCase()}:`);
        status.indexes.forEach(idx => {
          const uniqueFlag = idx.unique ? ' (unique)' : '';
          console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}${uniqueFlag}`);
        });
      }
    });

    return indexStatus;

  } catch (error) {
    console.error('❌ Error checking migration status:', error.message);
    throw error;
  }
};

/**
 * Main function
 */
const main = async () => {
  const command = process.argv[2];
  
  try {
    await connectDB();

    switch (command) {
      case 'up':
      case 'migrate':
        await runMigrations();
        break;
        
      case 'down':
      case 'rollback':
        await rollbackMigrations();
        break;
        
      case 'status':
      case 'check':
        await checkMigrationStatus();
        break;
        
      default:
        console.log('Usage: node migrate.js [command]');
        console.log('');
        console.log('Commands:');
        console.log('  up, migrate    Run all pending migrations');
        console.log('  down, rollback Rollback all migrations');
        console.log('  status, check  Check migration status');
        console.log('');
        console.log('Examples:');
        console.log('  node migrate.js up');
        console.log('  node migrate.js status');
        console.log('  node migrate.js rollback');
        process.exit(1);
    }

  } catch (error) {
    console.error('❌ Migration script failed:', error.message);
    process.exit(1);
  } finally {
    await disconnectDB();
  }
};

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  runMigrations,
  rollbackMigrations,
  checkMigrationStatus,
  connectDB,
  disconnectDB
};