// v1/models/bookingModel.js

const mongoose = require('mongoose');

/**
 * @description Mongoose schema for the Booking model.
 * Unified booking model for all travel services (flights, hotels, visas, insurance).
 */

const BookingSchema = new mongoose.Schema({
  bookingReference: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['flight', 'hotel', 'visa', 'insurance', 'package'],
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed', 'failed'],
    default: 'pending',
    index: true
  },
  // Reference to specific booking models
  flightBooking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FlightBooking'
  },
  hotelBooking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'HotelBooking'
  },
  visaApplication: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VisaApplication'
  },
  insurancePolicy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InsurancePolicy'
  },
  // Common booking information
  contactInfo: {
    email: {
      type: String,
      required: true,
      lowercase: true
    },
    phone: {
      type: String,
      required: true
    },
    firstName: {
      type: String,
      required: true,
      trim: true
    },
    lastName: {
      type: String,
      required: true,
      trim: true
    }
  },
  pricing: {
    subtotal: {
      type: Number,
      required: true
    },
    taxes: {
      type: Number,
      default: 0
    },
    fees: {
      type: Number,
      default: 0
    },
    discount: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'NGN'
    }
  },
  payment: {
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded', 'partially_refunded'],
      default: 'pending',
      index: true
    },
    method: {
      type: String,
      enum: ['paystack', 'wallet', 'bank_transfer', 'card']
    },
    reference: {
      type: String,
      index: true
    },
    transactionId: {
      type: String
    },
    paidAt: {
      type: Date
    },
    refunds: [{
      amount: { type: Number },
      reason: { type: String },
      processedAt: { type: Date },
      reference: { type: String }
    }]
  },
  // Affiliate tracking
  affiliate: {
    referralCode: {
      type: String,
      index: true
    },
    affiliateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Affiliate'
    },
    commission: {
      rate: { type: Number },
      amount: { type: Number },
      status: {
        type: String,
        enum: ['pending', 'approved', 'paid'],
        default: 'pending'
      }
    }
  },
  // Notifications and communication
  notifications: [{
    type: {
      type: String,
      enum: ['email', 'sms', 'push']
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'failed']
    },
    sentAt: { type: Date },
    content: { type: String }
  }],
  // Customer service
  support: {
    tickets: [{
      ticketId: { type: String },
      subject: { type: String },
      status: {
        type: String,
        enum: ['open', 'in_progress', 'resolved', 'closed']
      },
      createdAt: { type: Date, default: Date.now }
    }],
    notes: [{
      note: { type: String },
      addedBy: { type: String },
      addedAt: { type: Date, default: Date.now }
    }]
  },
  // Cancellation and modifications
  cancellation: {
    reason: { type: String },
    cancelledAt: { type: Date },
    cancelledBy: {
      type: String,
      enum: ['customer', 'admin', 'system']
    },
    refundAmount: { type: Number },
    refundStatus: {
      type: String,
      enum: ['pending', 'processed', 'failed']
    }
  },
  modifications: [{
    type: {
      type: String,
      enum: ['date_change', 'passenger_change', 'upgrade', 'downgrade']
    },
    oldValue: { type: mongoose.Schema.Types.Mixed },
    newValue: { type: mongoose.Schema.Types.Mixed },
    fee: { type: Number, default: 0 },
    modifiedAt: { type: Date, default: Date.now },
    modifiedBy: { type: String }
  }],
  // Metadata
  metadata: {
    source: {
      type: String,
      enum: ['web', 'mobile', 'api', 'admin'],
      default: 'web'
    },
    userAgent: { type: String },
    ipAddress: { type: String },
    sessionId: { type: String }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
BookingSchema.index({ userId: 1, type: 1, status: 1 });
BookingSchema.index({ bookingReference: 1 });
BookingSchema.index({ 'payment.reference': 1 });
BookingSchema.index({ 'payment.status': 1 });
BookingSchema.index({ 'affiliate.referralCode': 1 });
BookingSchema.index({ createdAt: -1 });
BookingSchema.index({ type: 1, createdAt: -1 });

// Virtual for booking age
BookingSchema.virtual('bookingAge').get(function() {
  return Date.now() - this.createdAt;
});

// Methods
BookingSchema.methods.generateBookingReference = function() {
  const typePrefix = {
    flight: 'FLT',
    hotel: 'HTL',
    visa: 'VSA',
    insurance: 'INS',
    package: 'PKG'
  };
  
  const prefix = typePrefix[this.type] || 'BKG';
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `${prefix}-${timestamp}-${random}`.toUpperCase();
};

BookingSchema.methods.calculateTotal = function() {
  return this.pricing.subtotal + this.pricing.taxes + this.pricing.fees - this.pricing.discount;
};

BookingSchema.methods.addNotification = function(type, content) {
  this.notifications.push({
    type,
    content,
    status: 'pending'
  });
};

BookingSchema.methods.addSupportNote = function(note, addedBy) {
  this.support.notes.push({
    note,
    addedBy
  });
};

BookingSchema.methods.canCancel = function() {
  return ['pending', 'confirmed'].includes(this.status);
};

BookingSchema.methods.canModify = function() {
  return ['confirmed'].includes(this.status);
};

// Pre-save middleware
BookingSchema.pre('save', function(next) {
  if (!this.bookingReference) {
    this.bookingReference = this.generateBookingReference();
  }
  
  if (this.pricing) {
    this.pricing.total = this.calculateTotal();
  }
  
  next();
});

// Static methods
BookingSchema.statics.findByReference = function(reference) {
  return this.findOne({ bookingReference: reference });
};

BookingSchema.statics.findByUser = function(userId, type = null) {
  const query = { userId };
  if (type) query.type = type;
  return this.find(query).sort({ createdAt: -1 });
};

BookingSchema.statics.getBookingStats = function(userId) {
  return this.aggregate([
    { $match: { userId: mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        totalSpent: { $sum: '$pricing.total' },
        lastBooking: { $max: '$createdAt' }
      }
    }
  ]);
};

module.exports = mongoose.model('Booking', BookingSchema);