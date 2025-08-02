// v1/migrations/001-create-affiliate-indexes.js
// Database migration script for affiliate system indexes

const mongoose = require('mongoose');

/**
 * Create indexes for affiliate system collections
 * This migration should be run after deploying the affiliate system models
 */
const createAffiliateIndexes = async () => {
  try {
    console.log('Starting affiliate system index creation...');

    // Affiliate collection indexes
    const affiliateCollection = mongoose.connection.collection('affiliates');
    
    // Unique indexes
    await affiliateCollection.createIndex({ userId: 1 }, { unique: true });
    await affiliateCollection.createIndex({ affiliateId: 1 }, { unique: true });
    await affiliateCollection.createIndex({ referralCode: 1 }, { unique: true });
    await affiliateCollection.createIndex({ businessEmail: 1 }, { unique: true });
    
    // Query optimization indexes
    await affiliateCollection.createIndex({ status: 1 });
    await affiliateCollection.createIndex({ createdAt: -1 });
    await affiliateCollection.createIndex({ approvedAt: -1 });
    await affiliateCollection.createIndex({ businessName: 1 });
    
    // Compound indexes for common queries
    await affiliateCollection.createIndex({ status: 1, createdAt: -1 });
    await affiliateCollection.createIndex({ status: 1, totalReferrals: -1 });
    await affiliateCollection.createIndex({ status: 1, totalCommissionsEarned: -1 });
    
    console.log('✓ Affiliate collection indexes created');

    // Wallet collection indexes
    const walletCollection = mongoose.connection.collection('wallets');
    
    // Unique indexes
    await walletCollection.createIndex({ affiliateId: 1 }, { unique: true });
    
    // Query optimization indexes
    await walletCollection.createIndex({ status: 1 });
    await walletCollection.createIndex({ balance: -1 });
    await walletCollection.createIndex({ totalEarned: -1 });
    await walletCollection.createIndex({ createdAt: -1 });
    
    // Compound indexes
    await walletCollection.createIndex({ affiliateId: 1, status: 1 });
    
    console.log('✓ Wallet collection indexes created');

    // WalletTransaction collection indexes
    const walletTransactionCollection = mongoose.connection.collection('wallettransactions');
    
    // Query optimization indexes
    await walletTransactionCollection.createIndex({ walletId: 1 });
    await walletTransactionCollection.createIndex({ affiliateId: 1 });
    await walletTransactionCollection.createIndex({ type: 1 });
    await walletTransactionCollection.createIndex({ status: 1 });
    await walletTransactionCollection.createIndex({ createdAt: -1 });
    await walletTransactionCollection.createIndex({ reference: 1 });
    
    // Compound indexes for common queries
    await walletTransactionCollection.createIndex({ affiliateId: 1, createdAt: -1 });
    await walletTransactionCollection.createIndex({ walletId: 1, type: 1 });
    await walletTransactionCollection.createIndex({ affiliateId: 1, type: 1, createdAt: -1 });
    await walletTransactionCollection.createIndex({ status: 1, createdAt: -1 });
    
    console.log('✓ WalletTransaction collection indexes created');

    // CommissionTransaction collection indexes
    const commissionTransactionCollection = mongoose.connection.collection('commissiontransactions');
    
    // Query optimization indexes
    await commissionTransactionCollection.createIndex({ affiliateId: 1 });
    await commissionTransactionCollection.createIndex({ referralId: 1 });
    await commissionTransactionCollection.createIndex({ bookingReference: 1 });
    await commissionTransactionCollection.createIndex({ serviceType: 1 });
    await commissionTransactionCollection.createIndex({ status: 1 });
    await commissionTransactionCollection.createIndex({ createdAt: -1 });
    await commissionTransactionCollection.createIndex({ processedAt: -1 });
    
    // Compound indexes for common queries
    await commissionTransactionCollection.createIndex({ affiliateId: 1, createdAt: -1 });
    await commissionTransactionCollection.createIndex({ affiliateId: 1, status: 1 });
    await commissionTransactionCollection.createIndex({ affiliateId: 1, serviceType: 1, createdAt: -1 });
    await commissionTransactionCollection.createIndex({ status: 1, createdAt: -1 });
    await commissionTransactionCollection.createIndex({ serviceType: 1, status: 1 });
    
    console.log('✓ CommissionTransaction collection indexes created');

    // Referral collection indexes
    const referralCollection = mongoose.connection.collection('referrals');
    
    // Query optimization indexes
    await referralCollection.createIndex({ affiliateId: 1 });
    await referralCollection.createIndex({ customerId: 1 });
    await referralCollection.createIndex({ referralCode: 1 });
    await referralCollection.createIndex({ referralSource: 1 });
    await referralCollection.createIndex({ status: 1 });
    await referralCollection.createIndex({ createdAt: -1 });
    await referralCollection.createIndex({ firstBookingAt: -1 });
    
    // Compound indexes for common queries
    await referralCollection.createIndex({ affiliateId: 1, createdAt: -1 });
    await referralCollection.createIndex({ affiliateId: 1, status: 1 });
    await referralCollection.createIndex({ customerId: 1, status: 1 });
    await referralCollection.createIndex({ referralCode: 1, status: 1 });
    await referralCollection.createIndex({ status: 1, createdAt: -1 });
    
    console.log('✓ Referral collection indexes created');

    // Withdrawal collection indexes
    const withdrawalCollection = mongoose.connection.collection('withdrawals');
    
    // Query optimization indexes
    await withdrawalCollection.createIndex({ affiliateId: 1 });
    await withdrawalCollection.createIndex({ walletId: 1 });
    await withdrawalCollection.createIndex({ status: 1 });
    await withdrawalCollection.createIndex({ createdAt: -1 });
    await withdrawalCollection.createIndex({ processedAt: -1 });
    await withdrawalCollection.createIndex({ paystackReference: 1 });
    
    // Compound indexes for common queries
    await withdrawalCollection.createIndex({ affiliateId: 1, createdAt: -1 });
    await withdrawalCollection.createIndex({ affiliateId: 1, status: 1 });
    await withdrawalCollection.createIndex({ status: 1, createdAt: -1 });
    await withdrawalCollection.createIndex({ walletId: 1, status: 1 });
    
    console.log('✓ Withdrawal collection indexes created');

    console.log('🎉 All affiliate system indexes created successfully!');
    
    return {
      success: true,
      message: 'Affiliate system indexes created successfully',
      collections: [
        'affiliates',
        'wallets', 
        'wallettransactions',
        'commissiontransactions',
        'referrals',
        'withdrawals'
      ]
    };

  } catch (error) {
    console.error('❌ Error creating affiliate system indexes:', error);
    throw error;
  }
};

/**
 * Drop affiliate system indexes (for rollback)
 */
const dropAffiliateIndexes = async () => {
  try {
    console.log('Dropping affiliate system indexes...');

    const collections = [
      'affiliates',
      'wallets',
      'wallettransactions', 
      'commissiontransactions',
      'referrals',
      'withdrawals'
    ];

    for (const collectionName of collections) {
      try {
        const collection = mongoose.connection.collection(collectionName);
        await collection.dropIndexes();
        console.log(`✓ Dropped indexes for ${collectionName}`);
      } catch (error) {
        if (error.code === 26) {
          console.log(`⚠ Collection ${collectionName} does not exist, skipping...`);
        } else {
          console.error(`❌ Error dropping indexes for ${collectionName}:`, error.message);
        }
      }
    }

    console.log('🎉 Affiliate system indexes dropped successfully!');
    
    return {
      success: true,
      message: 'Affiliate system indexes dropped successfully'
    };

  } catch (error) {
    console.error('❌ Error dropping affiliate system indexes:', error);
    throw error;
  }
};

/**
 * Check if affiliate indexes exist
 */
const checkAffiliateIndexes = async () => {
  try {
    const results = {};
    
    const collections = [
      'affiliates',
      'wallets',
      'wallettransactions',
      'commissiontransactions', 
      'referrals',
      'withdrawals'
    ];

    for (const collectionName of collections) {
      try {
        const collection = mongoose.connection.collection(collectionName);
        const indexes = await collection.listIndexes().toArray();
        results[collectionName] = {
          exists: true,
          indexCount: indexes.length,
          indexes: indexes.map(idx => ({
            name: idx.name,
            key: idx.key,
            unique: idx.unique || false
          }))
        };
      } catch (error) {
        results[collectionName] = {
          exists: false,
          error: error.message
        };
      }
    }

    return results;

  } catch (error) {
    console.error('❌ Error checking affiliate indexes:', error);
    throw error;
  }
};

module.exports = {
  createAffiliateIndexes,
  dropAffiliateIndexes,
  checkAffiliateIndexes
};