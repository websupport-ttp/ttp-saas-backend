// v1/utils/analyticsIndexes.js

/**
 * @description Utility for creating and managing analytics-specific database indexes
 * Ensures optimal performance for analytics queries across all models
 */

const mongoose = require('mongoose');
const logger = require('./logger');

/**
 * Create analytics indexes for the Ledger collection
 * @param {mongoose.Connection} connection - MongoDB connection
 */
async function createLedgerAnalyticsIndexes(connection) {
  try {
    const Ledger = connection.model('Ledger');
    
    // Single field indexes for analytics
    const singleIndexes = [
      { status: 1 },
      { itemType: 1 },
      { customerSegment: 1 },
      { bookingChannel: 1 },
      { seasonality: 1 },
      { packageId: 1 },
      { createdAt: -1 },
      { totalAmountPaid: -1 },
      { profitMargin: -1 },
      { serviceCharge: -1 },
    ];

    // Compound indexes for complex analytics queries
    const compoundIndexes = [
      { status: 1, createdAt: -1 },
      { status: 1, itemType: 1, createdAt: -1 },
      { status: 1, customerSegment: 1, createdAt: -1 },
      { status: 1, bookingChannel: 1, createdAt: -1 },
      { status: 1, seasonality: 1, createdAt: -1 },
      { itemType: 1, status: 1, createdAt: -1 },
      { customerSegment: 1, itemType: 1, createdAt: -1 },
      { bookingChannel: 1, itemType: 1, createdAt: -1 },
      { packageId: 1, status: 1, createdAt: -1 },
      { userId: 1, status: 1, createdAt: -1 },
      { createdAt: -1, status: 1, itemType: 1 },
      // Date range queries with filters
      { createdAt: 1, status: 1, itemType: 1 },
      { createdAt: 1, status: 1, customerSegment: 1 },
      { createdAt: 1, status: 1, bookingChannel: 1 },
      // Revenue analysis indexes
      { totalAmountPaid: -1, status: 1, createdAt: -1 },
      { profitMargin: -1, status: 1, createdAt: -1 },
      { serviceCharge: -1, status: 1, createdAt: -1 },
    ];

    // Create single field indexes
    for (const index of singleIndexes) {
      try {
        await Ledger.collection.createIndex(index, { background: true });
        logger.info(`Created Ledger index: ${JSON.stringify(index)}`);
      } catch (error) {
        if (error.code !== 85) { // Index already exists
          logger.warn(`Failed to create Ledger index ${JSON.stringify(index)}: ${error.message}`);
        }
      }
    }

    // Create compound indexes
    for (const index of compoundIndexes) {
      try {
        await Ledger.collection.createIndex(index, { background: true });
        logger.info(`Created Ledger compound index: ${JSON.stringify(index)}`);
      } catch (error) {
        if (error.code !== 85) { // Index already exists
          logger.warn(`Failed to create Ledger compound index ${JSON.stringify(index)}: ${error.message}`);
        }
      }
    }

    logger.info('Ledger analytics indexes creation completed');
  } catch (error) {
    logger.error(`Error creating Ledger analytics indexes: ${error.message}`);
  }
}

/**
 * Create analytics indexes for the User collection
 * @param {mongoose.Connection} connection - MongoDB connection
 */
async function createUserAnalyticsIndexes(connection) {
  try {
    const User = connection.model('User');
    
    // Analytics-specific indexes for user behavior tracking
    const analyticsIndexes = [
      { totalSpent: -1 },
      { totalTransactions: -1 },
      { averageTransactionValue: -1 },
      { lastLoginAt: -1 },
      { firstPurchaseAt: -1 },
      { lastPurchaseAt: -1 },
      { customerSegment: 1 },
      { preferredBookingChannel: 1 },
      { loginCount: -1 },
      // Compound indexes for customer analytics
      { customerSegment: 1, totalSpent: -1 },
      { customerSegment: 1, totalTransactions: -1 },
      { preferredBookingChannel: 1, totalSpent: -1 },
      { role: 1, customerSegment: 1 },
      { createdAt: -1, customerSegment: 1 },
      { firstPurchaseAt: -1, totalSpent: -1 },
      { lastPurchaseAt: -1, totalTransactions: -1 },
      // Customer lifetime value indexes
      { totalSpent: -1, totalTransactions: -1, createdAt: -1 },
      { customerSegment: 1, totalSpent: -1, createdAt: -1 },
    ];

    for (const index of analyticsIndexes) {
      try {
        await User.collection.createIndex(index, { background: true });
        logger.info(`Created User analytics index: ${JSON.stringify(index)}`);
      } catch (error) {
        if (error.code !== 85) { // Index already exists
          logger.warn(`Failed to create User analytics index ${JSON.stringify(index)}: ${error.message}`);
        }
      }
    }

    logger.info('User analytics indexes creation completed');
  } catch (error) {
    logger.error(`Error creating User analytics indexes: ${error.message}`);
  }
}

/**
 * Create analytics indexes for the Post collection (for package analytics)
 * @param {mongoose.Connection} connection - MongoDB connection
 */
async function createPostAnalyticsIndexes(connection) {
  try {
    const Post = connection.model('Post');
    
    // Package analytics indexes
    const packageIndexes = [
      { postType: 1, status: 1 },
      { postType: 1, isActive: 1 },
      { price: -1, postType: 1 },
      { viewCount: -1, postType: 1 },
      { publishedAt: -1, postType: 1 },
      { categories: 1, postType: 1 },
      { tags: 1, postType: 1 },
      // Compound indexes for package performance
      { postType: 1, status: 1, publishedAt: -1 },
      { postType: 1, isActive: 1, price: -1 },
      { postType: 1, categories: 1, status: 1 },
      { postType: 1, viewCount: -1, publishedAt: -1 },
    ];

    for (const index of packageIndexes) {
      try {
        await Post.collection.createIndex(index, { background: true });
        logger.info(`Created Post analytics index: ${JSON.stringify(index)}`);
      } catch (error) {
        if (error.code !== 85) { // Index already exists
          logger.warn(`Failed to create Post analytics index ${JSON.stringify(index)}: ${error.message}`);
        }
      }
    }

    logger.info('Post analytics indexes creation completed');
  } catch (error) {
    logger.error(`Error creating Post analytics indexes: ${error.message}`);
  }
}

/**
 * Create analytics indexes for the AnalyticsCache collection
 * @param {mongoose.Connection} connection - MongoDB connection
 */
async function createAnalyticsCacheIndexes(connection) {
  try {
    const AnalyticsCache = connection.model('AnalyticsCache');
    
    // Cache performance indexes
    const cacheIndexes = [
      { key: 1 },
      { category: 1 },
      { expiresAt: 1 },
      { lastUpdated: -1 },
      // Compound indexes for cache management
      { key: 1, category: 1 },
      { category: 1, lastUpdated: -1 },
      { category: 1, expiresAt: 1 },
      { key: 1, expiresAt: 1 },
    ];

    for (const index of cacheIndexes) {
      try {
        await AnalyticsCache.collection.createIndex(index, { background: true });
        logger.info(`Created AnalyticsCache index: ${JSON.stringify(index)}`);
      } catch (error) {
        if (error.code !== 85) { // Index already exists
          logger.warn(`Failed to create AnalyticsCache index ${JSON.stringify(index)}: ${error.message}`);
        }
      }
    }

    // TTL index for automatic cache expiration
    try {
      await AnalyticsCache.collection.createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 0, background: true }
      );
      logger.info('Created AnalyticsCache TTL index');
    } catch (error) {
      if (error.code !== 85) {
        logger.warn(`Failed to create AnalyticsCache TTL index: ${error.message}`);
      }
    }

    logger.info('AnalyticsCache indexes creation completed');
  } catch (error) {
    logger.error(`Error creating AnalyticsCache indexes: ${error.message}`);
  }
}

/**
 * Create analytics indexes for the AnalyticsSummary collection
 * @param {mongoose.Connection} connection - MongoDB connection
 */
async function createAnalyticsSummaryIndexes(connection) {
  try {
    const AnalyticsSummary = connection.model('AnalyticsSummary');
    
    // Summary performance indexes
    const summaryIndexes = [
      { summaryType: 1 },
      { isActive: 1 },
      { computedAt: -1 },
      { 'period.startDate': 1 },
      { 'period.endDate': 1 },
      { 'filters.itemType': 1 },
      { 'filters.customerSegment': 1 },
      { 'filters.bookingChannel': 1 },
      // Compound indexes for summary queries
      { summaryType: 1, isActive: 1, computedAt: -1 },
      { summaryType: 1, 'period.startDate': 1, 'period.endDate': 1 },
      { summaryType: 1, 'filters.itemType': 1, isActive: 1 },
      { summaryType: 1, 'filters.customerSegment': 1, isActive: 1 },
      { summaryType: 1, 'filters.bookingChannel': 1, isActive: 1 },
      { isActive: 1, computedAt: -1, summaryType: 1 },
    ];

    for (const index of summaryIndexes) {
      try {
        await AnalyticsSummary.collection.createIndex(index, { background: true });
        logger.info(`Created AnalyticsSummary index: ${JSON.stringify(index)}`);
      } catch (error) {
        if (error.code !== 85) { // Index already exists
          logger.warn(`Failed to create AnalyticsSummary index ${JSON.stringify(index)}: ${error.message}`);
        }
      }
    }

    // TTL index for automatic summary cleanup (90 days)
    try {
      await AnalyticsSummary.collection.createIndex(
        { computedAt: 1 },
        { expireAfterSeconds: 90 * 24 * 60 * 60, background: true }
      );
      logger.info('Created AnalyticsSummary TTL index');
    } catch (error) {
      if (error.code !== 85) {
        logger.warn(`Failed to create AnalyticsSummary TTL index: ${error.message}`);
      }
    }

    logger.info('AnalyticsSummary indexes creation completed');
  } catch (error) {
    logger.error(`Error creating AnalyticsSummary indexes: ${error.message}`);
  }
}

/**
 * Create all analytics indexes
 * @param {mongoose.Connection} connection - MongoDB connection (optional, uses default if not provided)
 */
async function createAllAnalyticsIndexes(connection = null) {
  try {
    const conn = connection || mongoose.connection;
    
    if (conn.readyState !== 1) {
      logger.warn('Database connection not ready. Skipping analytics index creation.');
      return;
    }

    logger.info('Starting analytics indexes creation...');

    await Promise.all([
      createLedgerAnalyticsIndexes(conn),
      createUserAnalyticsIndexes(conn),
      createPostAnalyticsIndexes(conn),
      createAnalyticsCacheIndexes(conn),
      createAnalyticsSummaryIndexes(conn),
    ]);

    logger.info('All analytics indexes creation completed successfully');
  } catch (error) {
    logger.error(`Error creating analytics indexes: ${error.message}`);
    throw error;
  }
}

/**
 * Drop and recreate analytics indexes (use with caution)
 * @param {mongoose.Connection} connection - MongoDB connection
 */
async function recreateAnalyticsIndexes(connection = null) {
  try {
    const conn = connection || mongoose.connection;
    
    if (conn.readyState !== 1) {
      logger.warn('Database connection not ready. Cannot recreate indexes.');
      return;
    }

    logger.info('Recreating analytics indexes...');

    // Get all collections
    const collections = ['ledgers', 'users', 'posts', 'analyticscaches', 'analyticssummaries'];
    
    // Drop existing indexes (except _id)
    for (const collectionName of collections) {
      try {
        const collection = conn.db.collection(collectionName);
        const indexes = await collection.indexes();
        
        for (const index of indexes) {
          if (index.name !== '_id_') {
            try {
              await collection.dropIndex(index.name);
              logger.info(`Dropped index ${index.name} from ${collectionName}`);
            } catch (error) {
              logger.warn(`Failed to drop index ${index.name} from ${collectionName}: ${error.message}`);
            }
          }
        }
      } catch (error) {
        logger.warn(`Failed to process collection ${collectionName}: ${error.message}`);
      }
    }

    // Recreate all analytics indexes
    await createAllAnalyticsIndexes(conn);
    
    logger.info('Analytics indexes recreation completed');
  } catch (error) {
    logger.error(`Error recreating analytics indexes: ${error.message}`);
    throw error;
  }
}

/**
 * Get analytics index statistics
 * @param {mongoose.Connection} connection - MongoDB connection
 * @returns {Object} Index statistics
 */
async function getAnalyticsIndexStats(connection = null) {
  try {
    const conn = connection || mongoose.connection;
    
    if (conn.readyState !== 1) {
      logger.warn('Database connection not ready. Cannot get index stats.');
      return {};
    }

    const collections = ['ledgers', 'users', 'posts', 'analyticscaches', 'analyticssummaries'];
    const stats = {};

    for (const collectionName of collections) {
      try {
        const collection = conn.db.collection(collectionName);
        const indexes = await collection.indexes();
        const indexStats = await collection.aggregate([
          { $indexStats: {} }
        ]).toArray();

        stats[collectionName] = {
          totalIndexes: indexes.length,
          indexes: indexes.map(idx => ({
            name: idx.name,
            key: idx.key,
            unique: idx.unique || false,
            sparse: idx.sparse || false,
            background: idx.background || false,
          })),
          usage: indexStats,
        };
      } catch (error) {
        logger.warn(`Failed to get stats for collection ${collectionName}: ${error.message}`);
        stats[collectionName] = { error: error.message };
      }
    }

    return stats;
  } catch (error) {
    logger.error(`Error getting analytics index stats: ${error.message}`);
    throw error;
  }
}

module.exports = {
  createLedgerAnalyticsIndexes,
  createUserAnalyticsIndexes,
  createPostAnalyticsIndexes,
  createAnalyticsCacheIndexes,
  createAnalyticsSummaryIndexes,
  createAllAnalyticsIndexes,
  recreateAnalyticsIndexes,
  getAnalyticsIndexStats,
};