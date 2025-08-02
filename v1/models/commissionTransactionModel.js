// v1/models/commissionTransactionModel.js
const mongoose = require('mongoose');

/**
 * @description Mongoose schema for the CommissionTransaction model.
 * Records individual commission transactions for affiliate referrals.
 */
const CommissionTransactionSchema = new mongoose.Schema({
  affiliateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Affiliate',
    required: [true, 'Affiliate ID is required'],
  },
  referralId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Referral',
    required: [true, 'Referral ID is required'],
  },
  bookingReference: {
    type: String,
    required: [true, 'Booking reference is required'],
    trim: true,
  },
  serviceType: {
    type: String,
    required: [true, 'Service type is required'],
    enum: {
      values: ['flight', 'hotel', 'insurance', 'visa'],
      message: 'Service type must be one of: flight, hotel, insurance, visa',
    },
  },
  bookingAmount: {
    type: Number,
    required: [true, 'Booking amount is required'],
    min: [0, 'Booking amount cannot be negative'],
    get: function(value) {
      return Math.round(value * 100) / 100;
    },
    set: function(value) {
      return Math.round(value * 100) / 100;
    },
  },
  commissionRate: {
    type: Number,
    required: [true, 'Commission rate is required'],
    min: [0, 'Commission rate cannot be negative'],
    max: [100, 'Commission rate cannot exceed 100%'],
  },
  commissionAmount: {
    type: Number,
    required: [true, 'Commission amount is required'],
    min: [0, 'Commission amount cannot be negative'],
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
  status: {
    type: String,
    enum: {
      values: ['pending', 'approved', 'paid', 'disputed', 'cancelled'],
      message: 'Status must be one of: pending, approved, paid, disputed, cancelled',
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
  processedAt: {
    type: Date,
    default: null,
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  approvedAt: {
    type: Date,
    default: null,
  },
  paidAt: {
    type: Date,
    default: null,
  },
  disputeReason: {
    type: String,
    trim: true,
    default: null,
  },
  disputedAt: {
    type: Date,
    default: null,
  },
  disputedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  cancellationReason: {
    type: String,
    trim: true,
    default: null,
  },
  cancelledAt: {
    type: Date,
    default: null,
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters'],
    default: null,
  },
}, {
  timestamps: true,
  toJSON: { getters: true },
  toObject: { getters: true },
});

// Pre-save middleware to set timestamps based on status changes
CommissionTransactionSchema.pre('save', function (next) {
  const now = new Date();
  
  if (this.isModified('status')) {
    switch (this.status) {
      case 'approved':
        if (!this.approvedAt) {
          this.approvedAt = now;
        }
        break;
      case 'paid':
        if (!this.paidAt) {
          this.paidAt = now;
        }
        if (!this.processedAt) {
          this.processedAt = now;
        }
        break;
      case 'disputed':
        if (!this.disputedAt) {
          this.disputedAt = now;
        }
        break;
      case 'cancelled':
        if (!this.cancelledAt) {
          this.cancelledAt = now;
        }
        break;
    }
  }
  
  next();
});

// Pre-save middleware to validate commission calculation
CommissionTransactionSchema.pre('save', function (next) {
  const expectedCommission = Math.round((this.bookingAmount * this.commissionRate / 100) * 100) / 100;
  
  if (Math.abs(this.commissionAmount - expectedCommission) > 0.01) {
    return next(new Error('Commission amount does not match calculated value'));
  }
  
  next();
});

// Instance method to approve commission
CommissionTransactionSchema.methods.approve = function (adminId, notes = null) {
  this.status = 'approved';
  this.approvedBy = adminId;
  this.approvedAt = new Date();
  if (notes) {
    this.notes = notes;
  }
  return this.save();
};

// Instance method to mark as paid
CommissionTransactionSchema.methods.markAsPaid = function (notes = null) {
  this.status = 'paid';
  this.paidAt = new Date();
  this.processedAt = new Date();
  if (notes) {
    this.notes = notes;
  }
  return this.save();
};

// Instance method to dispute commission
CommissionTransactionSchema.methods.dispute = function (reason, disputedBy) {
  this.status = 'disputed';
  this.disputeReason = reason;
  this.disputedAt = new Date();
  this.disputedBy = disputedBy;
  return this.save();
};

// Instance method to cancel commission
CommissionTransactionSchema.methods.cancel = function (reason, cancelledBy) {
  this.status = 'cancelled';
  this.cancellationReason = reason;
  this.cancelledAt = new Date();
  this.cancelledBy = cancelledBy;
  return this.save();
};

// Instance method to calculate commission
CommissionTransactionSchema.methods.calculateCommission = function () {
  return Math.round((this.bookingAmount * this.commissionRate / 100) * 100) / 100;
};

// Instance method to get transaction summary
CommissionTransactionSchema.methods.getSummary = function () {
  return {
    id: this._id,
    affiliateId: this.affiliateId,
    bookingReference: this.bookingReference,
    serviceType: this.serviceType,
    bookingAmount: this.bookingAmount,
    commissionRate: this.commissionRate,
    commissionAmount: this.commissionAmount,
    currency: this.currency,
    status: this.status,
    createdAt: this.createdAt,
    processedAt: this.processedAt,
  };
};

// Static method to find transactions by affiliate
CommissionTransactionSchema.statics.findByAffiliate = function (affiliateId, options = {}) {
  const { status, serviceType, startDate, endDate, limit = 50, skip = 0 } = options;
  
  const query = { affiliateId };
  
  if (status) {
    query.status = status;
  }
  
  if (serviceType) {
    query.serviceType = serviceType;
  }
  
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .populate('affiliateId', 'businessName affiliateId')
    .populate('referralId', 'customerId')
    .lean();
};

// Static method to find transactions by status
CommissionTransactionSchema.statics.findByStatus = function (status, options = {}) {
  const { limit = 50, skip = 0 } = options;
  
  return this.find({ status })
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .populate('affiliateId', 'businessName affiliateId')
    .populate('approvedBy', 'firstName lastName')
    .lean();
};

// Static method to get commission statistics
CommissionTransactionSchema.statics.getCommissionStats = function (affiliateId, dateRange = {}) {
  const { startDate, endDate } = dateRange;
  
  const matchStage = { affiliateId: new mongoose.Types.ObjectId(affiliateId) };
  
  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt.$gte = new Date(startDate);
    if (endDate) matchStage.createdAt.$lte = new Date(endDate);
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalCommissions: { $sum: '$commissionAmount' },
        totalTransactions: { $sum: 1 },
        pendingCommissions: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$commissionAmount', 0] }
        },
        approvedCommissions: {
          $sum: { $cond: [{ $eq: ['$status', 'approved'] }, '$commissionAmount', 0] }
        },
        paidCommissions: {
          $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$commissionAmount', 0] }
        },
        averageCommission: { $avg: '$commissionAmount' },
        serviceTypeBreakdown: {
          $push: {
            serviceType: '$serviceType',
            commissionAmount: '$commissionAmount',
            status: '$status'
          }
        }
      }
    }
  ]);
};

// Static method to get system-wide commission statistics
CommissionTransactionSchema.statics.getSystemStats = function (dateRange = {}) {
  const { startDate, endDate } = dateRange;
  
  const matchStage = {};
  
  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt.$gte = new Date(startDate);
    if (endDate) matchStage.createdAt.$lte = new Date(endDate);
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalCommissions: { $sum: '$commissionAmount' },
        totalTransactions: { $sum: 1 },
        totalBookingValue: { $sum: '$bookingAmount' },
        averageCommissionRate: { $avg: '$commissionRate' },
        statusBreakdown: {
          $push: {
            status: '$status',
            count: 1,
            amount: '$commissionAmount'
          }
        },
        serviceTypeBreakdown: {
          $push: {
            serviceType: '$serviceType',
            count: 1,
            amount: '$commissionAmount'
          }
        }
      }
    }
  ]);
};

// Indexes for performance optimization
CommissionTransactionSchema.index({ affiliateId: 1 });
CommissionTransactionSchema.index({ referralId: 1 });
CommissionTransactionSchema.index({ bookingReference: 1 });
CommissionTransactionSchema.index({ serviceType: 1 });
CommissionTransactionSchema.index({ status: 1 });
CommissionTransactionSchema.index({ approvedBy: 1 });
CommissionTransactionSchema.index({ createdAt: -1 });
CommissionTransactionSchema.index({ processedAt: -1 });

// Compound indexes
CommissionTransactionSchema.index({ affiliateId: 1, status: 1 });
CommissionTransactionSchema.index({ affiliateId: 1, createdAt: -1 });
CommissionTransactionSchema.index({ status: 1, createdAt: -1 });
CommissionTransactionSchema.index({ serviceType: 1, status: 1 });
CommissionTransactionSchema.index({ affiliateId: 1, serviceType: 1, status: 1 });

module.exports = mongoose.model('CommissionTransaction', CommissionTransactionSchema);