// v1/models/walletTransactionModel.js
const mongoose = require('mongoose');

/**
 * @description Mongoose schema for the WalletTransaction model.
 * Tracks all wallet transactions for audit and history purposes.
 */
const WalletTransactionSchema = new mongoose.Schema({
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    required: [true, 'Wallet ID is required'],
    index: true,
  },
  affiliateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Affiliate',
    required: [true, 'Affiliate ID is required'],
    index: true,
  },
  type: {
    type: String,
    enum: {
      values: [
        'commission_credit',
        'withdrawal_debit',
        'adjustment_credit',
        'adjustment_debit',
        'refund_credit',
        'reversal_credit',
        'penalty_debit'
      ],
      message: 'Transaction type must be one of the allowed values',
    },
    required: [true, 'Transaction type is required'],
    index: true,
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0.01, 'Amount must be greater than 0'],
    get: function(value) {
      return Math.round(value * 100) / 100; // Round to 2 decimal places
    },
    set: function(value) {
      return Math.round(value * 100) / 100; // Round to 2 decimal places
    },
  },
  balanceBefore: {
    type: Number,
    required: [true, 'Balance before transaction is required'],
    min: [0, 'Balance before cannot be negative'],
    get: function(value) {
      return Math.round(value * 100) / 100;
    },
    set: function(value) {
      return Math.round(value * 100) / 100;
    },
  },
  balanceAfter: {
    type: Number,
    required: [true, 'Balance after transaction is required'],
    min: [0, 'Balance after cannot be negative'],
    get: function(value) {
      return Math.round(value * 100) / 100;
    },
    set: function(value) {
      return Math.round(value * 100) / 100;
    },
  },
  currency: {
    type: String,
    required: [true, 'Currency is required'],
    default: 'NGN',
    uppercase: true,
    enum: {
      values: ['NGN', 'USD', 'EUR', 'GBP'],
      message: 'Currency must be one of: NGN, USD, EUR, GBP',
    },
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters'],
  },
  reference: {
    type: String,
    trim: true,
    maxlength: [100, 'Reference cannot exceed 100 characters'],
    index: true,
  },
  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true,
  },
  relatedModel: {
    type: String,
    enum: ['CommissionTransaction', 'Withdrawal', 'Adjustment'],
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'completed', 'failed', 'reversed'],
      message: 'Status must be one of: pending, completed, failed, reversed',
    },
    default: 'completed',
    index: true,
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  processedAt: {
    type: Date,
    default: Date.now,
  },
  reversedAt: {
    type: Date,
  },
  reversalReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Reversal reason cannot exceed 500 characters'],
  },
}, {
  timestamps: true,
  toJSON: { getters: true },
  toObject: { getters: true },
});

// Pre-save middleware to generate reference if not provided
WalletTransactionSchema.pre('save', function (next) {
  if (!this.reference && this.isNew) {
    const timestamp = Date.now();
    const typePrefix = this.type.toUpperCase().replace('_', '');
    this.reference = `${typePrefix}_${timestamp}_${this.affiliateId.toString().slice(-6)}`;
  }
  next();
});

// Instance method to reverse transaction
WalletTransactionSchema.methods.reverse = function (reason, processedBy) {
  if (this.status === 'reversed') {
    throw new Error('Transaction is already reversed');
  }
  
  if (this.status !== 'completed') {
    throw new Error('Only completed transactions can be reversed');
  }
  
  this.status = 'reversed';
  this.reversedAt = new Date();
  this.reversalReason = reason;
  if (processedBy) {
    this.processedBy = processedBy;
  }
  
  return this.save();
};

// Instance method to get transaction summary
WalletTransactionSchema.methods.getSummary = function () {
  return {
    id: this._id,
    type: this.type,
    amount: this.amount,
    currency: this.currency,
    description: this.description,
    reference: this.reference,
    status: this.status,
    balanceBefore: this.balanceBefore,
    balanceAfter: this.balanceAfter,
    processedAt: this.processedAt,
    createdAt: this.createdAt,
  };
};

// Static method to find transactions by wallet
WalletTransactionSchema.statics.findByWallet = function (walletId, options = {}) {
  const query = this.find({ walletId });
  
  if (options.type) {
    query.where('type', options.type);
  }
  
  if (options.status) {
    query.where('status', options.status);
  }
  
  if (options.dateFrom) {
    query.where('createdAt').gte(options.dateFrom);
  }
  
  if (options.dateTo) {
    query.where('createdAt').lte(options.dateTo);
  }
  
  if (options.limit) {
    query.limit(options.limit);
  }
  
  if (options.skip) {
    query.skip(options.skip);
  }
  
  return query.sort({ createdAt: -1 });
};

// Static method to find transactions by affiliate
WalletTransactionSchema.statics.findByAffiliate = function (affiliateId, options = {}) {
  const query = this.find({ affiliateId });
  
  if (options.type) {
    query.where('type', options.type);
  }
  
  if (options.status) {
    query.where('status', options.status);
  }
  
  if (options.dateFrom) {
    query.where('createdAt').gte(options.dateFrom);
  }
  
  if (options.dateTo) {
    query.where('createdAt').lte(options.dateTo);
  }
  
  if (options.limit) {
    query.limit(options.limit);
  }
  
  if (options.skip) {
    query.skip(options.skip);
  }
  
  return query.sort({ createdAt: -1 });
};

// Static method to get transaction statistics
WalletTransactionSchema.statics.getStatistics = function (affiliateId, dateFrom, dateTo) {
  const matchStage = { affiliateId };
  
  if (dateFrom || dateTo) {
    matchStage.createdAt = {};
    if (dateFrom) matchStage.createdAt.$gte = dateFrom;
    if (dateTo) matchStage.createdAt.$lte = dateTo;
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        avgAmount: { $avg: '$amount' },
      },
    },
    {
      $group: {
        _id: null,
        totalTransactions: { $sum: '$count' },
        totalAmount: { $sum: '$totalAmount' },
        byType: {
          $push: {
            type: '$_id',
            count: '$count',
            totalAmount: '$totalAmount',
            avgAmount: '$avgAmount',
          },
        },
      },
    },
  ]);
};

// Indexes for performance optimization
WalletTransactionSchema.index({ walletId: 1, createdAt: -1 });
WalletTransactionSchema.index({ affiliateId: 1, createdAt: -1 });
WalletTransactionSchema.index({ type: 1, createdAt: -1 });
WalletTransactionSchema.index({ status: 1, createdAt: -1 });
WalletTransactionSchema.index({ reference: 1 });
WalletTransactionSchema.index({ relatedId: 1, relatedModel: 1 });

// Compound indexes for common queries
WalletTransactionSchema.index({ affiliateId: 1, type: 1, createdAt: -1 });
WalletTransactionSchema.index({ walletId: 1, status: 1, createdAt: -1 });
WalletTransactionSchema.index({ affiliateId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('WalletTransaction', WalletTransactionSchema);