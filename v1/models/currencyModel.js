// v1/models/currencyModel.js
const mongoose = require('mongoose');

const currencySchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    minlength: 3,
    maxlength: 3,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  symbol: {
    type: String,
    required: true,
    trim: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  isBaseCurrency: {
    type: Boolean,
    default: false,
  },
  markup: {
    type: Number,
    default: 0,
    min: 0,
    max: 100, // Percentage
  },
  exchangeRate: {
    type: Number,
    required: true,
    default: 1,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
  apiSource: {
    type: String,
    enum: ['frankfurter-api', 'exchangerate-api', 'manual', 'fallback'],
    default: 'frankfurter-api',
  },
  fallbackRate: {
    type: Number,
    default: 1,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

// Indexes
currencySchema.index({ code: 1 });
currencySchema.index({ isActive: 1 });
currencySchema.index({ isBaseCurrency: 1 });

// Methods
currencySchema.methods.getEffectiveRate = function() {
  const markupMultiplier = 1 + (this.markup / 100);
  return this.exchangeRate * markupMultiplier;
};

currencySchema.methods.convertAmount = function(amount, fromCurrency = 'NGN') {
  if (this.code === fromCurrency) return amount;
  const effectiveRate = this.getEffectiveRate();
  return amount * effectiveRate;
};

// Static methods
currencySchema.statics.getBaseCurrency = async function() {
  return await this.findOne({ isBaseCurrency: true });
};

currencySchema.statics.getActiveCurrencies = async function() {
  return await this.find({ isActive: true }).sort({ code: 1 });
};

const Currency = mongoose.model('Currency', currencySchema);

module.exports = Currency;
