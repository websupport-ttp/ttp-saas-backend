// v1/models/hotelModel.js

const mongoose = require('mongoose');

/**
 * @description Mongoose schema for the Hotel model.
 * Stores hotel search results and booking information.
 */

const GuestSchema = new mongoose.Schema({
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
  age: {
    type: Number,
    min: 0,
    max: 120
  }
});

const RoomSchema = new mongoose.Schema({
  roomType: {
    type: String,
    required: true
  },
  bedType: {
    type: String
  },
  guests: [GuestSchema],
  maxOccupancy: {
    type: Number,
    required: true
  },
  amenities: [String],
  pricing: {
    baseRate: { type: Number, required: true },
    taxes: { type: Number, default: 0 },
    fees: { type: Number, default: 0 },
    total: { type: Number, required: true }
  }
});

const HotelBookingSchema = new mongoose.Schema({
  bookingReference: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  confirmationNumber: {
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
  hotel: {
    id: { type: String, required: true },
    name: { type: String, required: true },
    address: {
      street: { type: String },
      city: { type: String, required: true },
      state: { type: String },
      country: { type: String, required: true },
      postalCode: { type: String },
      coordinates: {
        latitude: { type: Number },
        longitude: { type: Number }
      }
    },
    rating: {
      stars: { type: Number, min: 1, max: 5 },
      score: { type: Number, min: 0, max: 10 },
      reviewCount: { type: Number, default: 0 }
    },
    amenities: [String],
    images: [String],
    description: { type: String }
  },
  stay: {
    checkIn: {
      type: Date,
      required: true
    },
    checkOut: {
      type: Date,
      required: true
    },
    nights: {
      type: Number,
      required: true
    }
  },
  rooms: [RoomSchema],
  guests: {
    adults: { type: Number, required: true, min: 1 },
    children: { type: Number, default: 0, min: 0 },
    infants: { type: Number, default: 0, min: 0 }
  },
  pricing: {
    subtotal: {
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
    enum: ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'],
    default: 'pending',
    index: true
  },
  ratehawkData: {
    searchId: { type: String },
    hotelId: { type: String },
    rateId: { type: String },
    rawResponse: { type: mongoose.Schema.Types.Mixed }
  },
  specialRequests: {
    type: String,
    maxlength: 500
  },
  cancellation: {
    policy: {
      type: String
    },
    deadline: {
      type: Date
    },
    fee: {
      type: Number,
      default: 0
    },
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
HotelBookingSchema.index({ userId: 1, status: 1 });
HotelBookingSchema.index({ bookingReference: 1 });
HotelBookingSchema.index({ 'payment.reference': 1 });
HotelBookingSchema.index({ createdAt: -1 });
HotelBookingSchema.index({ 'stay.checkIn': 1 });
HotelBookingSchema.index({ 'hotel.address.city': 1 });

// Virtual for total guests
HotelBookingSchema.virtual('totalGuests').get(function() {
  return this.guests.adults + this.guests.children + this.guests.infants;
});

// Virtual for total rooms
HotelBookingSchema.virtual('totalRooms').get(function() {
  return this.rooms.length;
});

// Methods
HotelBookingSchema.methods.generateBookingReference = function() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `HTL-${timestamp}-${random}`.toUpperCase();
};

HotelBookingSchema.methods.calculateTotal = function() {
  return this.pricing.subtotal + this.pricing.taxes + this.pricing.fees;
};

HotelBookingSchema.methods.calculateNights = function() {
  if (this.stay.checkIn && this.stay.checkOut) {
    const diffTime = Math.abs(this.stay.checkOut - this.stay.checkIn);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  return 0;
};

// Pre-save middleware
HotelBookingSchema.pre('save', function(next) {
  if (!this.bookingReference) {
    this.bookingReference = this.generateBookingReference();
  }
  
  if (this.stay.checkIn && this.stay.checkOut) {
    this.stay.nights = this.calculateNights();
  }
  
  if (this.pricing) {
    this.pricing.total = this.calculateTotal();
  }
  
  next();
});

// Validation
HotelBookingSchema.pre('validate', function(next) {
  if (this.stay.checkIn && this.stay.checkOut && this.stay.checkIn >= this.stay.checkOut) {
    next(new Error('Check-out date must be after check-in date'));
  } else {
    next();
  }
});

module.exports = mongoose.model('HotelBooking', HotelBookingSchema);