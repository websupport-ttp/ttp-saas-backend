// v1/models/walletModel.js
const mongoose = require('mongoose');

/**
 * @description Mongoose schema for the Wallet model.
 * Manages affiliate earnings and withdrawal history.
 */
const WalletSchema = new mongoose.Schema({
  affiliateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Affiliate',
    required: [true, 'Affiliate ID is required'],
    unique: true,
  },
  balance: {
    type: Number,
    required: [true, 'Balance is required'],
    default: 0,
    min: [0, 'Balance cannot be negative'],
    get: function(value) {
      return Math.round(value * 100) / 100; // Round to 2 decimal places
    },
    set: function(value) {
      return Math.round(value * 100) / 100; // Round to 2 decimal places
    },
  },
  totalEarned: {
    type: Number,
    default: 0,
    min: [0, 'Total earned cannot be negative'],
    get: function(value) {
      return Math.round(value * 100) / 100;
    },
    set: function(value) {
      return Math.round(value * 100) / 100;
    },
  },
  totalWithdrawn: {
    type: Number,
    default: 0,
    min: [0, 'Total withdrawn cannot be negative'],
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
      values: ['active', 'frozen', 'suspended'],
      message: 'Status must be one of: active, frozen, suspended',
    },
    default: 'active',
  },
  bankDetails: {
    accountName: {
      type: String,
      trim: true,
      maxlength: [100, 'Account name cannot exceed 100 characters'],
    },
    accountNumber: {
      type: String,
      trim: true,
      match: [/^\d{10}$/, 'Account number must be exactly 10 digits'],
    },
    bankCode: {
      type: String,
      trim: true,
      match: [/^\d{3}$/, 'Bank code must be exactly 3 digits'],
    },
    bankName: {
      type: String,
      trim: true,
      maxlength: [100, 'Bank name cannot exceed 100 characters'],
    },
  },
  freezeReason: {
    type: String,
    trim: true,
    default: null,
  },
  frozenAt: {
    type: Date,
    default: null,
  },
  lastTransactionAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
  toJSON: { getters: true },
  toObject: { getters: true },
});

// Pre-save middleware to update last transaction timestamp
WalletSchema.pre('save', function (next) {
  if (this.isModified('balance') || this.isModified('totalEarned') || this.isModified('totalWithdrawn')) {
    this.lastTransactionAt = new Date();
  }
  
  if (this.isModified('status') && this.status === 'frozen' && !this.frozenAt) {
    this.frozenAt = new Date();
  }
  
  if (this.isModified('status') && this.status === 'active') {
    this.frozenAt = null;
    this.freezeReason = null;
  }
  
  next();
});

// Instance method to credit wallet
WalletSchema.methods.credit = function (amount, description = 'Commission earned') {
  if (amount <= 0) {
    throw new Error('Credit amount must be positive');
  }
  
  if (this.status !== 'active') {
    throw new Error('Cannot credit inactive wallet');
  }
  
  this.balance += amount;
  this.totalEarned += amount;
  this.lastTransactionAt = new Date();
  
  return this.save();
};

// Instance method to debit wallet
WalletSchema.methods.debit = function (amount, description = 'Withdrawal processed') {
  if (amount <= 0) {
    throw new Error('Debit amount must be positive');
  }
  
  if (this.status !== 'active') {
    throw new Error('Cannot debit inactive wallet');
  }
  
  if (this.balance < amount) {
    throw new Error('Insufficient balance');
  }
  
  this.balance -= amount;
  this.totalWithdrawn += amount;
  this.lastTransactionAt = new Date();
  
  return this.save();
};

// Instance method to freeze wallet
WalletSchema.methods.freeze = function (reason) {
  this.status = 'frozen';
  this.freezeReason = reason;
  this.frozenAt = new Date();
  return this.save();
};

// Instance method to unfreeze wallet
WalletSchema.methods.unfreeze = function () {
  this.status = 'active';
  this.freezeReason = null;
  this.frozenAt = null;
  return this.save();
};

// Instance method to suspend wallet
WalletSchema.methods.suspend = function (reason) {
  this.status = 'suspended';
  this.freezeReason = reason;
  this.frozenAt = new Date();
  return this.save();
};

// Instance method to check if withdrawal is allowed
WalletSchema.methods.canWithdraw = function (amount) {
  if (this.status !== 'active') {
    return { allowed: false, reason: 'Wallet is not active' };
  }
  
  if (this.balance < amount) {
    return { allowed: false, reason: 'Insufficient balance' };
  }
  
  if (!this.bankDetails.accountNumber || !this.bankDetails.bankCode) {
    return { allowed: false, reason: 'Bank details not configured' };
  }
  
  return { allowed: true };
};

// Instance method to update bank details
WalletSchema.methods.updateBankDetails = function (bankDetails) {
  const { accountName, accountNumber, bankCode, bankName } = bankDetails;
  
  if (accountName) this.bankDetails.accountName = accountName;
  if (accountNumber) this.bankDetails.accountNumber = accountNumber;
  if (bankCode) this.bankDetails.bankCode = bankCode;
  if (bankName) this.bankDetails.bankName = bankName;
  
  return this.save();
};

// Instance method to get wallet summary
WalletSchema.methods.getSummary = function () {
  return {
    balance: this.balance,
    totalEarned: this.totalEarned,
    totalWithdrawn: this.totalWithdrawn,
    currency: this.currency,
    status: this.status,
    lastTransactionAt: this.lastTransactionAt,
    hasBankDetails: !!(this.bankDetails.accountNumber && this.bankDetails.bankCode),
  };
};

// Static method to find wallets by status
WalletSchema.statics.findByStatus = function (status) {
  return this.find({ status });
};

// Static method to find wallets with balance above threshold
WalletSchema.statics.findWithBalanceAbove = function (threshold) {
  return this.find({ balance: { $gte: threshold } });
};

// Static method to get total system balance
WalletSchema.statics.getTotalSystemBalance = function () {
  return this.aggregate([
    {
      $group: {
        _id: null,
        totalBalance: { $sum: '$balance' },
        totalEarned: { $sum: '$totalEarned' },
        totalWithdrawn: { $sum: '$totalWithdrawn' },
        activeWallets: {
          $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
        },
        frozenWallets: {
          $sum: { $cond: [{ $eq: ['$status', 'frozen'] }, 1, 0] }
        },
        suspendedWallets: {
          $sum: { $cond: [{ $eq: ['$status', 'suspended'] }, 1, 0] }
        },
      },
    },
  ]);
};

// Validation for bank details completeness
WalletSchema.pre('validate', function (next) {
  const { accountName, accountNumber, bankCode, bankName } = this.bankDetails;
  
  // If any bank detail is provided, require all essential fields
  if (accountNumber || bankCode || accountName || bankName) {
    if (!accountNumber) {
      this.invalidate('bankDetails.accountNumber', 'Account number is required when bank details are provided');
    }
    if (!bankCode) {
      this.invalidate('bankDetails.bankCode', 'Bank code is required when bank details are provided');
    }
    if (!accountName) {
      this.invalidate('bankDetails.accountName', 'Account name is required when bank details are provided');
    }
  }
  
  next();
});

// Indexes for performance optimization
WalletSchema.index({ status: 1 });
WalletSchema.index({ balance: -1 });
WalletSchema.index({ totalEarned: -1 });
WalletSchema.index({ lastTransactionAt: -1 });
WalletSchema.index({ createdAt: -1 });

// Compound indexes
WalletSchema.index({ status: 1, balance: -1 });
WalletSchema.index({ affiliateId: 1, status: 1 });

module.exports = mongoose.model('Wallet', WalletSchema);