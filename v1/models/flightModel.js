// v1/models/flightModel.js

const mongoose = require('mongoose');

/**
 * @description Mongoose schema for the Flight model.
 * Stores flight search results and booking information.
 */

const PassengerSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['adult', 'child', 'infant'],
    required: true
  },
  title: {
    type: String,
    enum: ['Mr', 'Mrs', 'Ms', 'Miss', 'Dr'],
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
  },
  dateOfBirth: {
    type: Date,
    required: true
  },
  passportNumber: {
    type: String,
    trim: true
  },
  passportExpiry: {
    type: Date
  },
  nationality: {
    type: String,
    trim: true
  }
});

const FlightSegmentSchema = new mongoose.Schema({
  airline: {
    code: { type: String, required: true },
    name: { type: String, required: true }
  },
  flightNumber: {
    type: String,
    required: true
  },
  aircraft: {
    type: String
  },
  departure: {
    airport: {
      code: { type: String, required: true },
      name: { type: String, required: true },
      city: { type: String, required: true },
      country: { type: String, required: true }
    },
    dateTime: { type: Date, required: true },
    terminal: { type: String }
  },
  arrival: {
    airport: {
      code: { type: String, required: true },
      name: { type: String, required: true },
      city: { type: String, required: true },
      country: { type: String, required: true }
    },
    dateTime: { type: Date, required: true },
    terminal: { type: String }
  },
  duration: {
    type: Number, // in minutes
    required: true
  },
  class: {
    type: String,
    enum: ['economy', 'premium_economy', 'business', 'first'],
    default: 'economy'
  },
  baggage: {
    cabin: { type: String },
    checked: { type: String }
  }
});

const FlightBookingSchema = new mongoose.Schema({
  bookingReference: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  pnr: {
    type: String,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  contactInfo: {
    email: {
      type: String,
      required: true,
      lowercase: true
    },
    phone: {
      type: String,
      required: true
    }
  },
  passengers: [PassengerSchema],
  itinerary: {
    outbound: [FlightSegmentSchema],
    return: [FlightSegmentSchema]
  },
  tripType: {
    type: String,
    enum: ['one-way', 'round-trip', 'multi-city'],
    required: true
  },
  pricing: {
    baseFare: {
      type: Number,
      required: true
    },
    taxes: {
      type: Number,
      required: true
    },
    fees: {
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
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending'
    },
    method: {
      type: String,
      enum: ['paystack', 'wallet', 'bank_transfer']
    },
    reference: {
      type: String,
      index: true
    },
    paidAt: {
      type: Date
    }
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed'],
    default: 'pending',
    index: true
  },
  amadeusData: {
    offerId: { type: String },
    sessionId: { type: String },
    rawResponse: { type: mongoose.Schema.Types.Mixed }
  },
  tickets: [{
    ticketNumber: { type: String },
    passengerIndex: { type: Number },
    issuedAt: { type: Date }
  }],
  cancellation: {
    reason: { type: String },
    cancelledAt: { type: Date },
    refundAmount: { type: Number },
    refundStatus: {
      type: String,
      enum: ['pending', 'processed', 'failed']
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
FlightBookingSchema.index({ userId: 1, status: 1 });
FlightBookingSchema.index({ bookingReference: 1 });
FlightBookingSchema.index({ 'payment.reference': 1 });
FlightBookingSchema.index({ createdAt: -1 });
FlightBookingSchema.index({ 'itinerary.outbound.departure.dateTime': 1 });

// Virtual for total passengers
FlightBookingSchema.virtual('totalPassengers').get(function() {
  return this.passengers.length;
});

// Methods
FlightBookingSchema.methods.generateBookingReference = function() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `TTP-${timestamp}-${random}`.toUpperCase();
};

FlightBookingSchema.methods.calculateTotal = function() {
  return this.pricing.baseFare + this.pricing.taxes + this.pricing.fees;
};

// Pre-save middleware
FlightBookingSchema.pre('save', function(next) {
  if (!this.bookingReference) {
    this.bookingReference = this.generateBookingReference();
  }
  
  if (this.pricing) {
    this.pricing.total = this.calculateTotal();
  }
  
  next();
});

module.exports = mongoose.model('FlightBooking', FlightBookingSchema);