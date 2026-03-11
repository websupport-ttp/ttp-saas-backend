const mongoose = require('mongoose');

const serviceChargeSchema = new mongoose.Schema({
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
    enum: ['percentage', 'fixed'],
    required: true,
    default: 'percentage'
  },
  value: {
    type: Number,
    required: true,
    min: 0
  },
  appliesTo: [{
    type: String,
    enum: ['flights', 'hotels', 'car-hire', 'visa', 'insurance', 'packages', 'all'],
    required: true
  }],
  isActive: {
    type: Boolean,
    default: true
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
serviceChargeSchema.index({ isActive: 1, appliesTo: 1 });
serviceChargeSchema.index({ priority: -1 });

module.exports = mongoose.model('ServiceCharge', serviceChargeSchema);
