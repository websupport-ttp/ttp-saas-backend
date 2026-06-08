// v1/models/visaPriceModel.js
const mongoose = require('mongoose');

/**
 * Visa Price Inventory
 * Admin-managed table of visa costs per destination + type.
 * Clients see this pricing before submitting an application.
 * Mitigates financial risk by ensuring fixed, pre-approved prices.
 */
const VisaPriceSchema = new mongoose.Schema({
  // Country name shown to the client e.g. "United States", "United Kingdom"
  // Use "Others" as a catch-all for unlisted countries
  country: {
    type: String,
    required: [true, 'Country name is required'],
    trim: true,
  },

  // ISO 3166-1 alpha-2 code for flag display e.g. "US", "GB"
  // Set to "XX" for the "Others" entry
  countryCode: {
    type: String,
    trim: true,
    uppercase: true,
    default: 'XX',
  },

  // Visa types available for this country
  visaTypes: [
    {
      type: {
        type: String,
        enum: ['Tourist', 'Business', 'Student', 'Transit', 'Work', 'Family Visit', 'Medical'],
        required: true,
      },
      // Our service fee (what client pays us, not embassy fee)
      price: {
        type: Number,
        required: true,
        min: 0,
      },
      currency: {
        type: String,
        default: 'NGN',
      },
      // Estimated processing time shown to client
      processingTime: {
        type: String,
        default: '5-10 business days',
      },
      // Brief description shown on the pricing card
      description: {
        type: String,
        trim: true,
        default: '',
      },
      isAvailable: {
        type: Boolean,
        default: true,
      },
    },
  ],

  // Show/hide this country in the client-facing list
  isActive: {
    type: Boolean,
    default: true,
  },

  // Sort order — lower number appears first
  sortOrder: {
    type: Number,
    default: 100,
  },

  // Whether this is the "Others" catch-all entry
  isOthers: {
    type: Boolean,
    default: false,
  },

  // Who last updated this entry
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

// Compound index for fast lookups
VisaPriceSchema.index({ country: 1, isActive: 1 });
VisaPriceSchema.index({ isActive: 1, sortOrder: 1 });
VisaPriceSchema.index({ isOthers: 1 });

module.exports = mongoose.model('VisaPrice', VisaPriceSchema);
