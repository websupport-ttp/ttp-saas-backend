// v1/models/analyticsCacheModel.js
const mongoose = require('mongoose');

/**
 * @description Mongoose schema for the Analytics Cache model.
 * Stores pre-computed analytics data for improved dashboard performance.
 */
const AnalyticsCacheSchema = new mongoose.Schema({
  key: {
    type: String,
    unique: true,
    required: [true, 'Cache key is required'],
    trim: true,
    index: true,
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: [true, 'Cache data is required'],
  },
  expiresAt: {
    type: Date,
    required: [true, 'Expiration date is required'],
    index: { expireAfterSeconds: 0 }, // MongoDB TTL index
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
    required: true,
  },
  category: {
    type: String,
    enum: ['revenue', 'customer', 'product', 'performance', 'general'],
    required: [true, 'Cache category is required'],
    index: true,
  },
  metadata: {
    type: Object,
    default: {},
  },
}, {
  timestamps: true,
});

// Indexes for performance (removed duplicate expiresAt index as it's already defined with TTL)
AnalyticsCacheSchema.index({ key: 1, category: 1 });
AnalyticsCacheSchema.index({ category: 1, lastUpdated: -1 });

// Static methods for cache management
AnalyticsCacheSchema.statics.setCache = async function(key, data, expirationMinutes = 60, category = 'general', metadata = {}) {
  const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000);
  
  return await this.findOneAndUpdate(
    { key },
    {
      key,
      data,
      expiresAt,
      category,
      metadata,
      lastUpdated: new Date(),
    },
    {
      upsert: true,
      new: true,
    }
  );
};

AnalyticsCacheSchema.statics.getCache = async function(key) {
  const cached = await this.findOne({ 
    key, 
    expiresAt: { $gt: new Date() } 
  });
  
  return cached ? cached.data : null;
};

AnalyticsCacheSchema.statics.invalidateCache = async function(keyPattern) {
  if (typeof keyPattern === 'string') {
    // Exact match
    return await this.deleteOne({ key: keyPattern });
  } else {
    // Regex pattern
    return await this.deleteMany({ key: keyPattern });
  }
};

AnalyticsCacheSchema.statics.invalidateCacheByCategory = async function(category) {
  return await this.deleteMany({ category });
};

AnalyticsCacheSchema.statics.cleanExpiredCache = async function() {
  return await this.deleteMany({ expiresAt: { $lt: new Date() } });
};

module.exports = mongoose.model('AnalyticsCache', AnalyticsCacheSchema);