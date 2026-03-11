const mongoose = require('mongoose');

const taxSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: ['VAT', 'GST', 'Sales Tax', 'Service Tax', 'Other'],
    required: true
  },
  rate: {
    type: Number,
    required: true,
    min: 0,
    max: 100 // Percentage
  },
  appliesTo: [{
    type: String,
    enum: ['flights', 'hotels', 'car-hire', 'visa', 'insurance', 'packages', 'all'],
    required: true
  }],
  country: {
    type: String,
    default: 'NG' // Nigeria
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isInclusive: {
    type: Boolean,
    default: false // false = tax added on top, true = tax included in price
  },
  priority: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
taxSchema.index({ isActive: 1, appliesTo: 1, country: 1 });
taxSchema.index({ priority: -1 });

module.exports = mongoose.model('Tax', taxSchema);
