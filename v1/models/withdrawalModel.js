// v1/models/withdrawalModel.js
const mongoose = require('mongoose');

/**
 * @description Mongoose schema for the Withdrawal model.
 * Manages withdrawal requests and processing for affiliate earnings.
 */
const WithdrawalSchema = new mongoose.Schema({
  affiliateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Affiliate',
    required: [true, 'Affiliate ID is required'],
  },
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    required: [true, 'Wallet ID is required'],
  },
  amount: {
    type: Number,
    required: [true, 'Withdrawal amount is required'],
    min: [1, 'Withdrawal amount must be at least 1'],
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
  bankDetails: {
    accountName: {
      type: String,
      required: [true, 'Account name is required'],
      trim: true,
      maxlength: [100, 'Account name cannot exceed 100 characters'],
    },
    accountNumber: {
      type: String,
      required: [true, 'Account number is required'],
      trim: true,
      match: [/^\d{10}$/, 'Account number must be exactly 10 digits'],
    },
    bankCode: {
      type: String,
      required: [true, 'Bank code is required'],
      trim: true,
      match: [/^\d{3}$/, 'Bank code must be exactly 3 digits'],
    },
    bankName: {
      type: String,
      required: [true, 'Bank name is required'],
      trim: true,
      maxlength: [100, 'Bank name cannot exceed 100 characters'],
    },
  },
  paystackReference: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
  },
  transferCode: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'reversed'],
      message: 'Status must be one of: pending, processing, completed, failed, cancelled, reversed',
    },
    default: 'pending',
  },
  qrCode: {
    data: {
      type: String,
      default: null,
    },
    url: {
      type: String,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  requestedAt: {
    type: Date,
    default: Date.now,
  },
  processedAt: {
    type: Date,
    default: null,
  },
  completedAt: {
    type: Date,
    default: null,
  },
  failedAt: {
    type: Date,
    default: null,
  },
  cancelledAt: {
    type: Date,
    default: null,
  },
  reversedAt: {
    type: Date,
    default: null,
  },
  failureReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Failure reason cannot exceed 500 characters'],
    default: null,
  },
  cancellationReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Cancellation reason cannot exceed 500 characters'],
    default: null,
  },
  reversalReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Reversal reason cannot exceed 500 characters'],
    default: null,
  },
  processingFee: {
    type: Number,
    default: 0,
    min: [0, 'Processing fee cannot be negative'],
    get: function(value) {
      return Math.round(value * 100) / 100;
    },
    set: function(value) {
      return Math.round(value * 100) / 100;
    },
  },
  netAmount: {
    type: Number,
    required: [true, 'Net amount is required'],
    min: [0, 'Net amount cannot be negative'],
    get: function(value) {
      return Math.round(value * 100) / 100;
    },
    set: function(value) {
      return Math.round(value * 100) / 100;
    },
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  reversedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  retryCount: {
    type: Number,
    default: 0,
    min: [0, 'Retry count cannot be negative'],
    max: [5, 'Maximum retry count is 5'],
  },
  lastRetryAt: {
    type: Date,
    default: null,
  },
  webhookData: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters'],
    default: null,
  },
}, {
  timestamps: true,
  toJSON: { getters: true },
  toObject: { getters: true },
});

// Pre-save middleware to calculate net amount
WithdrawalSchema.pre('save', function (next) {
  if (this.isModified('amount') || this.isModified('processingFee')) {
    this.netAmount = this.amount - this.processingFee;
  }
  
  // Set timestamps based on status changes
  const now = new Date();
  
  if (this.isModified('status')) {
    switch (this.status) {
      case 'processing':
        if (!this.processedAt) {
          this.processedAt = now;
        }
        break;
      case 'completed':
        if (!this.completedAt) {
          this.completedAt = now;
        }
        break;
      case 'failed':
        if (!this.failedAt) {
          this.failedAt = now;
        }
        break;
      case 'cancelled':
        if (!this.cancelledAt) {
          this.cancelledAt = now;
        }
        break;
      case 'reversed':
        if (!this.reversedAt) {
          this.reversedAt = now;
        }
        break;
    }
  }
  
  next();
});

// Pre-save middleware to validate net amount
WithdrawalSchema.pre('save', function (next) {
  if (this.netAmount < 0) {
    return next(new Error('Net amount cannot be negative after processing fees'));
  }
  next();
});

// Instance method to mark as processing
WithdrawalSchema.methods.markAsProcessing = function (paystackReference, transferCode, processedBy = null) {
  this.status = 'processing';
  this.paystackReference = paystackReference;
  this.transferCode = transferCode;
  this.processedAt = new Date();
  if (processedBy) {
    this.processedBy = processedBy;
  }
  return this.save();
};

// Instance method to mark as completed
WithdrawalSchema.methods.markAsCompleted = function (webhookData = null) {
  this.status = 'completed';
  this.completedAt = new Date();
  if (webhookData) {
    this.webhookData = webhookData;
  }
  return this.save();
};

// Instance method to mark as failed
WithdrawalSchema.methods.markAsFailed = function (reason, webhookData = null) {
  this.status = 'failed';
  this.failureReason = reason;
  this.failedAt = new Date();
  if (webhookData) {
    this.webhookData = webhookData;
  }
  return this.save();
};

// Instance method to cancel withdrawal
WithdrawalSchema.methods.cancel = function (reason, cancelledBy = null) {
  this.status = 'cancelled';
  this.cancellationReason = reason;
  this.cancelledAt = new Date();
  if (cancelledBy) {
    this.cancelledBy = cancelledBy;
  }
  return this.save();
};

// Instance method to reverse withdrawal
WithdrawalSchema.methods.reverse = function (reason, reversedBy = null) {
  this.status = 'reversed';
  this.reversalReason = reason;
  this.reversedAt = new Date();
  if (reversedBy) {
    this.reversedBy = reversedBy;
  }
  return this.save();
};

// Instance method to retry withdrawal
WithdrawalSchema.methods.retry = function () {
  if (this.retryCount >= 5) {
    throw new Error('Maximum retry count exceeded');
  }
  
  this.status = 'pending';
  this.retryCount += 1;
  this.lastRetryAt = new Date();
  this.failureReason = null;
  this.failedAt = null;
  
  return this.save();
};

// Instance method to calculate processing fee
WithdrawalSchema.methods.calculateProcessingFee = function (feeRate = 0.015, minFee = 50, maxFee = 2000) {
  let fee = this.amount * feeRate;
  fee = Math.max(fee, minFee);
  fee = Math.min(fee, maxFee);
  
  this.processingFee = Math.round(fee * 100) / 100;
  this.netAmount = this.amount - this.processingFee;
  
  return this.processingFee;
};

// Instance method to get withdrawal summary
WithdrawalSchema.methods.getSummary = function () {
  return {
    id: this._id,
    affiliateId: this.affiliateId,
    amount: this.amount,
    processingFee: this.processingFee,
    netAmount: this.netAmount,
    currency: this.currency,
    status: this.status,
    bankDetails: this.bankDetails,
    requestedAt: this.requestedAt,
    processedAt: this.processedAt,
    completedAt: this.completedAt,
    paystackReference: this.paystackReference,
  };
};

// Instance method to check if withdrawal can be cancelled
WithdrawalSchema.methods.canBeCancelled = function () {
  return ['pending', 'failed'].includes(this.status);
};

// Instance method to check if withdrawal can be retried
WithdrawalSchema.methods.canBeRetried = function () {
  return this.status === 'failed' && this.retryCount < 5;
};

// Static method to find withdrawals by affiliate
WithdrawalSchema.statics.findByAffiliate = function (affiliateId, options = {}) {
  const { status, startDate, endDate, limit = 50, skip = 0 } = options;
  
  const query = { affiliateId };
  
  if (status) {
    query.status = status;
  }
  
  if (startDate || endDate) {
    query.requestedAt = {};
    if (startDate) query.requestedAt.$gte = new Date(startDate);
    if (endDate) query.requestedAt.$lte = new Date(endDate);
  }
  
  return this.find(query)
    .sort({ requestedAt: -1 })
    .limit(limit)
    .skip(skip)
    .populate('affiliateId', 'businessName affiliateId')
    .lean();
};

// Static method to find withdrawals by status
WithdrawalSchema.statics.findByStatus = function (status, options = {}) {
  const { limit = 50, skip = 0 } = options;
  
  return this.find({ status })
    .sort({ requestedAt: -1 })
    .limit(limit)
    .skip(skip)
    .populate('affiliateId', 'businessName affiliateId')
    .populate('processedBy', 'firstName lastName')
    .lean();
};

// Static method to find pending withdrawals for processing
WithdrawalSchema.statics.findPendingForProcessing = function (limit = 10) {
  return this.find({ 
    status: 'pending',
    retryCount: { $lt: 5 }
  })
    .sort({ requestedAt: 1 })
    .limit(limit)
    .populate('affiliateId', 'businessName affiliateId status')
    .populate('walletId', 'balance status');
};

// Static method to find failed withdrawals for retry
WithdrawalSchema.statics.findFailedForRetry = function (retryAfterHours = 24) {
  const retryAfter = new Date(Date.now() - (retryAfterHours * 60 * 60 * 1000));
  
  return this.find({
    status: 'failed',
    retryCount: { $lt: 5 },
    $or: [
      { lastRetryAt: { $lte: retryAfter } },
      { lastRetryAt: null }
    ]
  })
    .sort({ failedAt: 1 })
    .limit(10);
};

// Static method to get withdrawal statistics
WithdrawalSchema.statics.getWithdrawalStats = function (affiliateId, dateRange = {}) {
  const { startDate, endDate } = dateRange;
  
  const matchStage = { affiliateId: new mongoose.Types.ObjectId(affiliateId) };
  
  if (startDate || endDate) {
    matchStage.requestedAt = {};
    if (startDate) matchStage.requestedAt.$gte = new Date(startDate);
    if (endDate) matchStage.requestedAt.$lte = new Date(endDate);
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalWithdrawals: { $sum: '$amount' },
        totalProcessingFees: { $sum: '$processingFee' },
        totalNetAmount: { $sum: '$netAmount' },
        totalRequests: { $sum: 1 },
        completedWithdrawals: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$amount', 0] }
        },
        pendingWithdrawals: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0] }
        },
        failedWithdrawals: {
          $sum: { $cond: [{ $eq: ['$status', 'failed'] }, '$amount', 0] }
        },
        averageWithdrawalAmount: { $avg: '$amount' },
        statusBreakdown: {
          $push: {
            status: '$status',
            count: 1,
            amount: '$amount'
          }
        }
      }
    }
  ]);
};

// Static method to get system-wide withdrawal statistics
WithdrawalSchema.statics.getSystemStats = function (dateRange = {}) {
  const { startDate, endDate } = dateRange;
  
  const matchStage = {};
  
  if (startDate || endDate) {
    matchStage.requestedAt = {};
    if (startDate) matchStage.requestedAt.$gte = new Date(startDate);
    if (endDate) matchStage.requestedAt.$lte = new Date(endDate);
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalWithdrawals: { $sum: '$amount' },
        totalProcessingFees: { $sum: '$processingFee' },
        totalNetAmount: { $sum: '$netAmount' },
        totalRequests: { $sum: 1 },
        averageProcessingTime: {
          $avg: {
            $cond: [
              { $and: [{ $ne: ['$requestedAt', null] }, { $ne: ['$completedAt', null] }] },
              { $subtract: ['$completedAt', '$requestedAt'] },
              null
            ]
          }
        },
        statusBreakdown: {
          $push: {
            status: '$status',
            count: 1,
            amount: '$amount'
          }
        }
      }
    }
  ]);
};

// Indexes for performance optimization
WithdrawalSchema.index({ affiliateId: 1 });
WithdrawalSchema.index({ walletId: 1 });
WithdrawalSchema.index({ status: 1 });
WithdrawalSchema.index({ requestedAt: -1 });
WithdrawalSchema.index({ processedAt: -1 });
WithdrawalSchema.index({ completedAt: -1 });
WithdrawalSchema.index({ retryCount: 1 });

// Compound indexes
WithdrawalSchema.index({ affiliateId: 1, status: 1 });
WithdrawalSchema.index({ affiliateId: 1, requestedAt: -1 });
WithdrawalSchema.index({ status: 1, requestedAt: -1 });
WithdrawalSchema.index({ status: 1, retryCount: 1 });
WithdrawalSchema.index({ status: 1, lastRetryAt: 1 });

module.exports = mongoose.model('Withdrawal', WithdrawalSchema);