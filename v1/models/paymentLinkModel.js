// v1/models/paymentLinkModel.js
const mongoose = require('mongoose');

/**
 * @description Schema for payment links
 * Used for generating payment links for visa applications and other services
 */
const PaymentLinkSchema = new mongoose.Schema({
  applicationId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'applicationType',
    required: true,
  },
  applicationType: {
    type: String,
    enum: ['VisaApplication', 'CarBooking', 'FlightBooking', 'HotelBooking'],
    required: true,
  },
  paystackPageId: {
    type: String,
    required: true,
  },
  paystackPageUrl: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  currency: {
    type: String,
    default: 'NGN',
  },
  description: {
    type: String,
    trim: true,
  },
  status: {
    type: String,
    enum: ['active', 'paid', 'expired', 'cancelled'],
    default: 'active',
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  paidAt: Date,
  paymentReference: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  customerEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  customerPhone: {
    type: String,
    trim: true,
  },
  sentVia: [{
    type: String,
    enum: ['email', 'sms', 'whatsapp'],
  }],
  sentAt: Date,
  metadata: {
    type: mongoose.Schema.Types.Mixed,
  },
}, {
  timestamps: true,
});

// Indexes
PaymentLinkSchema.index({ applicationId: 1, applicationType: 1 });
PaymentLinkSchema.index({ status: 1, expiresAt: 1 });
PaymentLinkSchema.index({ paymentReference: 1 });
PaymentLinkSchema.index({ createdBy: 1 });
PaymentLinkSchema.index({ customerEmail: 1 });

// Method to check if link is expired
PaymentLinkSchema.methods.isExpired = function() {
  return new Date() > this.expiresAt;
};

// Method to mark as paid
PaymentLinkSchema.methods.markAsPaid = function(paymentReference) {
  this.status = 'paid';
  this.paidAt = new Date();
  this.paymentReference = paymentReference;
  return this.save();
};

module.exports = mongoose.model('PaymentLink', PaymentLinkSchema);
