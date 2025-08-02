// v1/models/referralModel.js
const mongoose = require('mongoose');

/**
 * @description Mongoose schema for the Referral model.
 * Tracks customer referrals and their attribution to affiliates.
 */
const ReferralSchema = new mongoose.Schema({
  affiliateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Affiliate',
    required: [true, 'Affiliate ID is required'],
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Customer ID is required'],
  },
  referralCode: {
    type: String,
    required: [true, 'Referral code is required'],
    uppercase: true,
    trim: true,
  },
  referralSource: {
    type: String,
    enum: {
      values: ['qr_code', 'link', 'manual', 'social_media', 'email', 'other'],
      message: 'Referral source must be one of: qr_code, link, manual, social_media, email, other',
    },
    default: 'link',
  },
  ipAddress: {
    type: String,
    required: [true, 'IP address is required'],
    trim: true,
    match: [
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/,
      'Please provide a valid IP address',
    ],
  },
  userAgent: {
    type: String,
    required: [true, 'User agent is required'],
    trim: true,
    maxlength: [500, 'User agent cannot exceed 500 characters'],
  },
  referrerUrl: {
    type: String,
    trim: true,
    default: null,
  },
  landingPage: {
    type: String,
    trim: true,
    default: null,
  },
  deviceInfo: {
    type: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet', 'unknown'],
      default: 'unknown',
    },
    browser: {
      type: String,
      trim: true,
      default: null,
    },
    os: {
      type: String,
      trim: true,
      default: null,
    },
  },
  firstBookingAt: {
    type: Date,
    default: null,
  },
  totalBookings: {
    type: Number,
    default: 0,
    min: [0, 'Total bookings cannot be negative'],
  },
  totalValue: {
    type: Number,
    default: 0,
    min: [0, 'Total value cannot be negative'],
    get: function(value) {
      return Math.round(value * 100) / 100;
    },
    set: function(value) {
      return Math.round(value * 100) / 100;
    },
  },
  currency: {
    type: String,
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
      values: ['active', 'converted', 'inactive', 'blocked'],
      message: 'Status must be one of: active, converted, inactive, blocked',
    },
    default: 'active',
  },
  conversionDate: {
    type: Date,
    default: null,
  },
  lastActivityAt: {
    type: Date,
    default: null,
  },
  bookingHistory: [{
    bookingReference: {
      type: String,
      required: true,
      trim: true,
    },
    serviceType: {
      type: String,
      required: true,
      enum: ['flight', 'hotel', 'insurance', 'visa'],
    },
    bookingAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    commissionGenerated: {
      type: Number,
      required: true,
      min: 0,
    },
    bookingDate: {
      type: Date,
      required: true,
    },
  }],
  geolocation: {
    country: {
      type: String,
      trim: true,
      default: null,
    },
    region: {
      type: String,
      trim: true,
      default: null,
    },
    city: {
      type: String,
      trim: true,
      default: null,
    },
    coordinates: {
      latitude: {
        type: Number,
        min: -90,
        max: 90,
        default: null,
      },
      longitude: {
        type: Number,
        min: -180,
        max: 180,
        default: null,
      },
    },
  },
  utmParameters: {
    source: {
      type: String,
      trim: true,
      default: null,
    },
    medium: {
      type: String,
      trim: true,
      default: null,
    },
    campaign: {
      type: String,
      trim: true,
      default: null,
    },
    term: {
      type: String,
      trim: true,
      default: null,
    },
    content: {
      type: String,
      trim: true,
      default: null,
    },
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

// Pre-save middleware to update activity timestamp
ReferralSchema.pre('save', function (next) {
  if (this.isModified('totalBookings') || this.isModified('totalValue')) {
    this.lastActivityAt = new Date();
  }
  
  if (this.isModified('status') && this.status === 'converted' && !this.conversionDate) {
    this.conversionDate = new Date();
  }
  
  next();
});

// Instance method to add booking
ReferralSchema.methods.addBooking = function (bookingData) {
  const { bookingReference, serviceType, bookingAmount, commissionGenerated } = bookingData;
  
  // Add to booking history
  this.bookingHistory.push({
    bookingReference,
    serviceType,
    bookingAmount,
    commissionGenerated,
    bookingDate: new Date(),
  });
  
  // Update totals
  this.totalBookings += 1;
  this.totalValue += bookingAmount;
  
  // Set first booking date if this is the first booking
  if (!this.firstBookingAt) {
    this.firstBookingAt = new Date();
    this.status = 'converted';
    this.conversionDate = new Date();
  }
  
  this.lastActivityAt = new Date();
  
  return this.save();
};

// Instance method to get conversion rate
ReferralSchema.methods.getConversionRate = function () {
  return this.totalBookings > 0 ? 1 : 0; // Simple conversion: has bookings or not
};

// Instance method to get average booking value
ReferralSchema.methods.getAverageBookingValue = function () {
  return this.totalBookings > 0 ? this.totalValue / this.totalBookings : 0;
};

// Instance method to get customer lifetime value
ReferralSchema.methods.getCustomerLifetimeValue = function () {
  return this.totalValue;
};

// Instance method to block referral
ReferralSchema.methods.block = function (reason) {
  this.status = 'blocked';
  this.notes = reason;
  return this.save();
};

// Instance method to reactivate referral
ReferralSchema.methods.reactivate = function () {
  this.status = this.totalBookings > 0 ? 'converted' : 'active';
  return this.save();
};

// Instance method to get referral summary
ReferralSchema.methods.getSummary = function () {
  return {
    id: this._id,
    affiliateId: this.affiliateId,
    customerId: this.customerId,
    referralCode: this.referralCode,
    referralSource: this.referralSource,
    status: this.status,
    totalBookings: this.totalBookings,
    totalValue: this.totalValue,
    averageBookingValue: this.getAverageBookingValue(),
    firstBookingAt: this.firstBookingAt,
    lastActivityAt: this.lastActivityAt,
    createdAt: this.createdAt,
  };
};

// Static method to find referrals by affiliate
ReferralSchema.statics.findByAffiliate = function (affiliateId, options = {}) {
  const { status, startDate, endDate, limit = 50, skip = 0 } = options;
  
  const query = { affiliateId };
  
  if (status) {
    query.status = status;
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
    .populate('customerId', 'firstName lastName email phoneNumber')
    .lean();
};

// Static method to find referrals by customer
ReferralSchema.statics.findByCustomer = function (customerId) {
  return this.find({ customerId })
    .populate('affiliateId', 'businessName affiliateId referralCode')
    .sort({ createdAt: -1 })
    .lean();
};

// Static method to validate referral code and get affiliate
ReferralSchema.statics.validateReferralCode = async function (code, customerId) {
  // Check if customer already has a referral with this code
  const existingReferral = await this.findOne({ 
    referralCode: code.toUpperCase(),
    customerId 
  });
  
  if (existingReferral) {
    return { valid: true, referral: existingReferral, isNew: false };
  }
  
  // Check if referral code exists and affiliate is active
  const Affiliate = mongoose.model('Affiliate');
  const affiliate = await Affiliate.findOne({ 
    referralCode: code.toUpperCase(),
    status: 'active'
  });
  
  if (!affiliate) {
    return { valid: false, error: 'Invalid or inactive referral code' };
  }
  
  return { valid: true, affiliate, isNew: true };
};

// Static method to get referral statistics for affiliate
ReferralSchema.statics.getAffiliateStats = function (affiliateId, dateRange = {}) {
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
        totalReferrals: { $sum: 1 },
        convertedReferrals: {
          $sum: { $cond: [{ $gt: ['$totalBookings', 0] }, 1, 0] }
        },
        totalBookings: { $sum: '$totalBookings' },
        totalValue: { $sum: '$totalValue' },
        averageBookingValue: { $avg: '$totalValue' },
        statusBreakdown: {
          $push: {
            status: '$status',
            count: 1
          }
        },
        sourceBreakdown: {
          $push: {
            source: '$referralSource',
            count: 1
          }
        }
      }
    },
    {
      $addFields: {
        conversionRate: {
          $multiply: [
            { $divide: ['$convertedReferrals', '$totalReferrals'] },
            100
          ]
        }
      }
    }
  ]);
};

// Static method to get top performing referrals
ReferralSchema.statics.getTopPerformers = function (affiliateId, limit = 10) {
  return this.find({ affiliateId })
    .sort({ totalValue: -1, totalBookings: -1 })
    .limit(limit)
    .populate('customerId', 'firstName lastName email')
    .lean();
};

// Indexes for performance optimization
ReferralSchema.index({ affiliateId: 1 });
ReferralSchema.index({ customerId: 1 });
ReferralSchema.index({ referralCode: 1 });
ReferralSchema.index({ referralSource: 1 });
ReferralSchema.index({ status: 1 });
ReferralSchema.index({ firstBookingAt: -1 });
ReferralSchema.index({ lastActivityAt: -1 });
ReferralSchema.index({ createdAt: -1 });
ReferralSchema.index({ totalValue: -1 });
ReferralSchema.index({ totalBookings: -1 });

// Compound indexes
ReferralSchema.index({ affiliateId: 1, status: 1 });
ReferralSchema.index({ affiliateId: 1, createdAt: -1 });
ReferralSchema.index({ customerId: 1, affiliateId: 1 });
ReferralSchema.index({ referralCode: 1, customerId: 1 });
ReferralSchema.index({ status: 1, createdAt: -1 });
ReferralSchema.index({ affiliateId: 1, totalValue: -1 });

// Unique compound index to prevent duplicate referrals
ReferralSchema.index({ affiliateId: 1, customerId: 1 }, { unique: true });

module.exports = mongoose.model('Referral', ReferralSchema);