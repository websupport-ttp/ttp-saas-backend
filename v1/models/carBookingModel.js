// v1/models/carBookingModel.js
const mongoose = require('mongoose');

/**
 * @description Mongoose schema for Car Bookings
 */
const CarBookingSchema = new mongoose.Schema({
  bookingReference: {
    type: String,
    required: true,
    unique: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // Optional for guest bookings
    default: null,
  },
  car: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Car',
    required: true,
  },
  pickupLocation: {
    type: String,
    required: [true, 'Pickup location is required'],
  },
  returnLocation: {
    type: String,
    required: [true, 'Return location is required'],
  },
  pickupDate: {
    type: Date,
    required: [true, 'Pickup date is required'],
  },
  returnDate: {
    type: Date,
    required: [true, 'Return date is required'],
  },
  driverInfo: {
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    dateOfBirth: {
      type: Date,
      required: true,
    },
    licenseNumber: {
      type: String,
      required: false, // Optional - user may not be the driver
      default: '',
    },
    licenseCountry: {
      type: String,
      required: false, // Optional - user may not be the driver
      default: '',
    },
    licenseExpiryDate: {
      type: Date,
      required: false, // Optional - user may not be the driver
      default: null,
    },
  },
  emergencyContact: {
    name: {
      type: String,
      required: true,
    },
    relationship: {
      type: String,
      required: true,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    email: String,
  },
  extras: [{
    type: String,
  }],
  specialRequests: {
    type: String,
    default: '',
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0,
  },
  currency: {
    type: String,
    default: 'NGN',
    uppercase: true,
    trim: true,
    minlength: 3,
    maxlength: 3,
  },
  originalAmount: {
    type: Number,
    default: null,
  },
  exchangeRate: {
    type: Number,
    default: 1,
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled'],
    default: 'pending',
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending',
  },
  paymentReference: {
    type: String,
    required: true,
  },
  // Staff who processed this booking
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  processedAt: {
    type: Date,
    default: null,
  },
  notes: {
    type: String,
    default: '',
  },
}, {
  timestamps: true,
});

// Indexes
CarBookingSchema.index({ bookingReference: 1 });
CarBookingSchema.index({ user: 1 });
CarBookingSchema.index({ car: 1 });
CarBookingSchema.index({ status: 1 });
CarBookingSchema.index({ paymentStatus: 1 });
CarBookingSchema.index({ pickupDate: 1 });
CarBookingSchema.index({ processedBy: 1 });
CarBookingSchema.index({ createdAt: -1 });

// Compound indexes
CarBookingSchema.index({ user: 1, status: 1 });
CarBookingSchema.index({ car: 1, pickupDate: 1, returnDate: 1 });
CarBookingSchema.index({ currency: 1 });
CarBookingSchema.index({ status: 1, currency: 1 });

module.exports = mongoose.model('CarBooking', CarBookingSchema);
