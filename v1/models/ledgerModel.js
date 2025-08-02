// v1/models/ledgerModel.js
const mongoose = require('mongoose');
const { TransactionStatus, PaymentMethod } = require('../utils/constants');

/**
 * @description Mongoose schema for the Ledger model.
 * Records all financial transactions for auditing and receipt generation.
 */
const LedgerSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: false, // Can be null for guest checkouts
  },
  guestEmail: {
    type: String,
    lowercase: true,
    trim: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email address',
    ],
    required: function() { return !this.userId; } // Required if no userId
  },
  guestPhoneNumber: {
    type: String,
    trim: true,
    match: [
      /^\+?[1-9]\d{1,14}$/, // E.164 format
      'Please add a valid phone number',
    ],
    required: function() { return !this.userId; } // Required if no userId
  },
  transactionReference: {
    type: String,
    required: [true, 'Transaction reference is required'],
    unique: true,
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: 0,
  },
  currency: {
    type: String,
    required: [true, 'Currency is required'],
    default: 'NGN', // Assuming Nigerian Naira as default
  },
  status: {
    type: String,
    enum: Object.values(TransactionStatus),
    default: TransactionStatus.PENDING,
  },
  paymentGateway: {
    type: String,
    enum: Object.values(PaymentMethod),
    required: [true, 'Payment gateway is required'],
  },
  paymentGatewayResponse: {
    type: Object, // Store the raw response from the payment gateway
    default: {},
  },
  productType: {
    type: String,
    required: [true, 'Product type is required'],
    enum: ['Flight Booking', 'Hotel Reservation', 'Travel Insurance', 'Visa Processing', 'Package'],
  },
  itemType: {
    type: String,
    required: [true, 'Item type is required'],
    enum: ['Flight', 'Hotel', 'Insurance', 'Visa', 'Package'],
  },
  packageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: function() {
      return this.itemType === 'Package' || this.productType === 'Package';
    },
  },
  productId: {
    type: String, // ID from the external API (e.g., Allianz policy ID, Amadeus booking ID)
    required: false, // Not required until successful purchase
  },
  markupApplied: {
    type: Number,
    default: 0,
  },
  profitMargin: {
    type: Number,
    required: [true, 'Profit margin is required'],
    min: 0,
    default: 0,
  },
  totalAmountPaid: {
    type: Number,
    required: [true, 'Total amount paid is required'],
    min: 0,
  },
  invoiceUrl: String, // URL to the generated invoice
  receiptUrl: String, // URL to the generated receipt
  // Additional analytics fields for business intelligence
  customerSegment: {
    type: String,
    enum: ['Individual', 'Business', 'Group', 'Corporate'],
    default: 'Individual',
  },
  bookingChannel: {
    type: String,
    enum: ['Web', 'Mobile', 'API', 'Admin'],
    default: 'Web',
  },
  seasonality: {
    type: String,
    enum: ['Peak', 'Off-Peak', 'Shoulder'],
    default: 'Off-Peak',
  },
  serviceCharge: {
    type: Number,
    required: [true, 'Service charge is required'],
    min: 0,
    default: 0,
  },
  // Referral tracking
  referralCode: {
    type: String,
    trim: true,
    uppercase: true,
    required: false,
  },
  // Additional fields for specific product details can be added here
  productDetails: {
    type: Object, // Flexible field to store details specific to the purchased product
    default: {},
  },
}, {
  timestamps: true, // Adds createdAt and updatedAt timestamps
});

// Indexes for analytics performance (removed duplicate index for transactionReference as it's already unique)
LedgerSchema.index({ userId: 1, createdAt: -1 });
LedgerSchema.index({ status: 1, createdAt: -1 });
LedgerSchema.index({ itemType: 1, status: 1 });
LedgerSchema.index({ customerSegment: 1, createdAt: -1 });
LedgerSchema.index({ bookingChannel: 1, createdAt: -1 });
LedgerSchema.index({ seasonality: 1, createdAt: -1 });
LedgerSchema.index({ packageId: 1, status: 1 });
LedgerSchema.index({ createdAt: -1, status: 1 });

// Compound indexes for analytics queries
LedgerSchema.index({ status: 1, itemType: 1, createdAt: -1 });
LedgerSchema.index({ status: 1, customerSegment: 1, createdAt: -1 });
LedgerSchema.index({ status: 1, bookingChannel: 1, createdAt: -1 });
LedgerSchema.index({ referralCode: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Ledger', LedgerSchema);