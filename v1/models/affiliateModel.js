// v1/models/affiliateModel.js
const mongoose = require('mongoose');

/**
 * @description Mongoose schema for the Affiliate model.
 * Manages affiliate partner accounts and their relationship with users.
 */
const AffiliateSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
  },
  businessName: {
    type: String,
    required: [true, 'Business name is required'],
    trim: true,
    maxlength: [100, 'Business name cannot exceed 100 characters'],
  },
  businessEmail: {
    type: String,
    required: [true, 'Business email is required'],
    lowercase: true,
    trim: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid business email address',
    ],
  },
  businessPhone: {
    type: String,
    required: [true, 'Business phone is required'],
    trim: true,
    match: [
      /^\+?[1-9]\d{1,14}$/,
      'Please provide a valid business phone number',
    ],
  },
  businessAddress: {
    street: {
      type: String,
      required: [true, 'Street address is required'],
      trim: true,
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true,
    },
    country: {
      type: String,
      required: [true, 'Country is required'],
      trim: true,
      default: 'Nigeria',
    },
    postalCode: {
      type: String,
      trim: true,
    },
  },
  affiliateId: {
    type: String,
    unique: true,
    required: [true, 'Affiliate ID is required'],
  },
  referralCode: {
    type: String,
    unique: true,
    required: [true, 'Referral code is required'],
    uppercase: true,
    trim: true,
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'active', 'suspended', 'inactive'],
      message: 'Status must be one of: pending, active, suspended, inactive',
    },
    default: 'pending',
  },
  commissionRates: {
    flights: {
      type: Number,
      min: [0, 'Flight commission rate cannot be negative'],
      max: [100, 'Flight commission rate cannot exceed 100%'],
      default: 2.5,
    },
    hotels: {
      type: Number,
      min: [0, 'Hotel commission rate cannot be negative'],
      max: [100, 'Hotel commission rate cannot exceed 100%'],
      default: 3.0,
    },
    insurance: {
      type: Number,
      min: [0, 'Insurance commission rate cannot be negative'],
      max: [100, 'Insurance commission rate cannot exceed 100%'],
      default: 5.0,
    },
    visa: {
      type: Number,
      min: [0, 'Visa commission rate cannot be negative'],
      max: [100, 'Visa commission rate cannot exceed 100%'],
      default: 4.0,
    },
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
  totalReferrals: {
    type: Number,
    default: 0,
    min: [0, 'Total referrals cannot be negative'],
  },
  totalCommissionsEarned: {
    type: Number,
    default: 0,
    min: [0, 'Total commissions earned cannot be negative'],
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
  suspensionReason: {
    type: String,
    trim: true,
    default: null,
  },
  suspendedAt: {
    type: Date,
    default: null,
  },
  notificationPreferences: {
    email: {
      type: Boolean,
      default: true,
    },
    sms: {
      type: Boolean,
      default: false,
    },
    monthlyStatements: {
      type: Boolean,
      default: true,
    },
  },
}, {
  timestamps: true,
});

// Pre-save middleware to generate affiliate ID and referral code
AffiliateSchema.pre('save', async function (next) {
  if (this.isNew) {
    // Generate unique affiliate ID
    if (!this.affiliateId) {
      this.affiliateId = await this.constructor.generateAffiliateId();
    }
    
    // Generate unique referral code
    if (!this.referralCode) {
      this.referralCode = await this.constructor.generateReferralCode(this.businessName);
    }
  }
  next();
});

// Pre-save middleware to set approval timestamp
AffiliateSchema.pre('save', function (next) {
  if (this.isModified('status') && this.status === 'active' && !this.approvedAt) {
    this.approvedAt = new Date();
  }
  
  if (this.isModified('status') && this.status === 'suspended' && !this.suspendedAt) {
    this.suspendedAt = new Date();
  }
  
  next();
});

// Static method to generate unique affiliate ID
AffiliateSchema.statics.generateAffiliateId = async function () {
  let affiliateId;
  let isUnique = false;
  
  while (!isUnique) {
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    affiliateId = `AFF-${randomNum}`;
    
    const existing = await this.findOne({ affiliateId });
    if (!existing) {
      isUnique = true;
    }
  }
  
  return affiliateId;
};

// Static method to generate unique referral code
AffiliateSchema.statics.generateReferralCode = async function (businessName) {
  let referralCode;
  let isUnique = false;
  
  // Create base code from business name
  const baseCode = businessName
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 8)
    .toUpperCase();
  
  while (!isUnique) {
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    referralCode = `${baseCode}-${randomSuffix}`;
    
    const existing = await this.findOne({ referralCode });
    if (!existing) {
      isUnique = true;
    }
  }
  
  return referralCode;
};

// Instance method to approve affiliate
AffiliateSchema.methods.approve = function (adminId) {
  this.status = 'active';
  this.approvedBy = adminId;
  this.approvedAt = new Date();
  return this.save();
};

// Instance method to suspend affiliate
AffiliateSchema.methods.suspend = function (reason) {
  this.status = 'suspended';
  this.suspensionReason = reason;
  this.suspendedAt = new Date();
  return this.save();
};

// Instance method to reactivate affiliate
AffiliateSchema.methods.reactivate = function () {
  this.status = 'active';
  this.suspensionReason = null;
  this.suspendedAt = null;
  return this.save();
};

// Instance method to update commission rates
AffiliateSchema.methods.updateCommissionRates = function (rates) {
  Object.keys(rates).forEach(serviceType => {
    if (this.commissionRates[serviceType] !== undefined) {
      this.commissionRates[serviceType] = rates[serviceType];
    }
  });
  return this.save();
};

// Instance method to increment referral count
AffiliateSchema.methods.incrementReferrals = function () {
  this.totalReferrals += 1;
  return this.save();
};

// Instance method to add commission earnings
AffiliateSchema.methods.addCommissionEarnings = function (amount) {
  this.totalCommissionsEarned += amount;
  return this.save();
};

// Static method to find active affiliates
AffiliateSchema.statics.findActive = function () {
  return this.find({ status: 'active' });
};

// Static method to find pending affiliates
AffiliateSchema.statics.findPending = function () {
  return this.find({ status: 'pending' });
};

// Static method to validate referral code
AffiliateSchema.statics.validateReferralCode = async function (code) {
  const affiliate = await this.findOne({ 
    referralCode: code.toUpperCase(),
    status: 'active'
  });
  return affiliate;
};

// Indexes for performance optimization
AffiliateSchema.index({ userId: 1 });
AffiliateSchema.index({ status: 1 });
AffiliateSchema.index({ approvedBy: 1 });
AffiliateSchema.index({ businessEmail: 1 });
AffiliateSchema.index({ createdAt: -1 });
AffiliateSchema.index({ approvedAt: -1 });

// Compound indexes
AffiliateSchema.index({ status: 1, createdAt: -1 });
AffiliateSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('Affiliate', AffiliateSchema);