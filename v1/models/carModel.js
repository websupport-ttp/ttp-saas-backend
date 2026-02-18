// v1/models/carModel.js
const mongoose = require('mongoose');

/**
 * @description Mongoose schema for Car inventory
 */
const CarSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Car name is required'],
    trim: true,
  },
  brand: {
    type: String,
    required: [true, 'Car brand is required'],
    trim: true,
  },
  model: {
    type: String,
    required: [true, 'Car model is required'],
    trim: true,
  },
  year: {
    type: Number,
    required: [true, 'Manufacturing year is required'],
    min: 2000,
    max: new Date().getFullYear() + 1,
  },
  type: {
    type: String,
    enum: ['economy', 'compact', 'midsize', 'fullsize', 'luxury', 'suv', 'minivan'],
    required: [true, 'Car type is required'],
  },
  capacity: {
    type: Number,
    required: [true, 'Passenger capacity is required'],
    min: 2,
    max: 15,
  },
  doors: {
    type: Number,
    required: [true, 'Number of doors is required'],
    min: 2,
    max: 5,
  },
  transmission: {
    type: String,
    enum: ['manual', 'automatic'],
    required: [true, 'Transmission type is required'],
  },
  fuelType: {
    type: String,
    enum: ['petrol', 'diesel', 'electric', 'hybrid'],
    default: 'petrol',
  },
  pricePerDay: {
    type: Number,
    required: [true, 'Price per day is required'],
    min: 0,
  },
  image: {
    type: String,
    default: null,
  },
  images: [{
    type: String,
  }],
  features: [{
    type: String,
  }],
  mileage: {
    type: String,
    enum: ['unlimited', 'limited'],
    default: 'unlimited',
  },
  fuelPolicy: {
    type: String,
    enum: ['full-to-full', 'same-to-same'],
    default: 'full-to-full',
  },
  location: {
    type: String,
    required: [true, 'Car location is required'],
    trim: true,
  },
  supplier: {
    name: {
      type: String,
      required: [true, 'Supplier name is required'],
    },
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 4.5,
    },
  },
  availability: {
    type: Boolean,
    default: true,
  },
  registrationNumber: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
  },
  insuranceDetails: {
    provider: String,
    policyNumber: String,
    expiryDate: Date,
  },
  maintenanceStatus: {
    type: String,
    enum: ['excellent', 'good', 'fair', 'needs-service'],
    default: 'good',
  },
  lastServiceDate: {
    type: Date,
    default: null,
  },
  nextServiceDate: {
    type: Date,
    default: null,
  },
  // Staff who added/manages this car
  managedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Indexes
CarSchema.index({ type: 1, availability: 1 });
CarSchema.index({ location: 1, availability: 1 });
CarSchema.index({ pricePerDay: 1 });
CarSchema.index({ registrationNumber: 1 });
CarSchema.index({ managedBy: 1 });
CarSchema.index({ isActive: 1 });

// Virtual for rating
CarSchema.virtual('rating').get(function() {
  return this.supplier.rating;
});

module.exports = mongoose.model('Car', CarSchema);
