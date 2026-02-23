// v1/models/abandonedBookingModel.js
const mongoose = require('mongoose');
const { AbandonedBookingStatus } = require('../utils/constants');

/**
 * @description Schema for tracking abandoned bookings
 * Tracks when users start but don't complete bookings
 */
const AbandonedBookingSchema = new mongoose.Schema({
  bookingType: {
    type: String,
    enum: ['car_hire', 'flight', 'hotel', 'visa', 'insurance', 'package'],
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  customerEmail: {
    type: String,
    trim: true,
    lowercase: true,
  },
  customerPhone: {
    type: String,
    trim: true,
  },
  customerName: {
    type: String,
    trim: true,
  },
  formData: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  completionPercentage: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
  },
  lastActivity: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: Object.values(AbandonedBookingStatus),
    default: AbandonedBookingStatus.ABANDONED,
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  assignedAt: Date,
  followUpNotes: [{
    note: String,
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
    contactMethod: {
      type: String,
      enum: ['email', 'phone', 'sms', 'whatsapp'],
    },
  }],
  convertedBookingId: {
    type: mongoose.Schema.Types.ObjectId,
  },
  convertedAt: Date,
  estimatedValue: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

// Indexes
AbandonedBookingSchema.index({ bookingType: 1, status: 1 });
AbandonedBookingSchema.index({ customerEmail: 1 });
AbandonedBookingSchema.index({ customerPhone: 1 });
AbandonedBookingSchema.index({ assignedTo: 1, status: 1 });
AbandonedBookingSchema.index({ lastActivity: -1 });
AbandonedBookingSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AbandonedBooking', AbandonedBookingSchema);
