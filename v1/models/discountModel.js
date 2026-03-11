const mongoose = require('mongoose');

const discountSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  code: {
    type: String,
    unique: true,
    sparse: true,
    uppercase: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['percentage', 'fixed', 'role-based', 'provider-specific'],
    required: true
  },
  value: {
    type: Number,
    min: 0
  },
  // Role-based discounts
  roleDiscounts: {
    user: { type: Number, default: 0, min: 0, max: 100 },
    staff: { type: Number, default: 10, min: 0, max: 100 },
    agent: { type: Number, default: 15, min: 0, max: 100 },
    business: { type: Number, default: 20, min: 0, max: 100 }
  },
  // Provider-specific discounts
  provider: {
    type: {
      type: String,
      enum: ['airline', 'hotel', 'car-rental', 'insurance']
    },
    name: String,
    code: String
  },
  appliesTo: [{
    type: String,
    enum: ['flights', 'hotels', 'car-hire', 'visa', 'insurance', 'packages', 'all'],
    required: true
  }],
  minPurchaseAmount: {
    type: Number,
    default: 0
  },
  maxDiscountAmount: {
    type: Number
  },
  usageLimit: {
    type: Number
  },
  usageCount: {
    type: Number,
    default: 0
  },
  validFrom: {
    type: Date,
    default: Date.now
  },
  validUntil: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isStackable: {
    type: Boolean,
    default: false
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
discountSchema.index({ code: 1 });
discountSchema.index({ isActive: 1, appliesTo: 1 });
discountSchema.index({ validFrom: 1, validUntil: 1 });
discountSchema.index({ 'provider.type': 1, 'provider.code': 1 });
discountSchema.index({ priority: -1 });

// Methods
discountSchema.methods.isValid = function() {
  const now = new Date();
  return this.isActive &&
         (!this.validFrom || this.validFrom <= now) &&
         (!this.validUntil || this.validUntil >= now) &&
         (!this.usageLimit || this.usageCount < this.usageLimit);
};

discountSchema.methods.canApplyToService = function(serviceType) {
  return this.appliesTo.includes('all') || this.appliesTo.includes(serviceType);
};

discountSchema.methods.getDiscountForRole = function(userRole) {
  if (this.type !== 'role-based') return this.value || 0;
  
  const roleMap = {
    'User': 'user',
    'Staff': 'staff',
    'Agent': 'agent',
    'Business': 'business'
  };
  
  const role = roleMap[userRole] || 'user';
  return this.roleDiscounts[role] || 0;
};

module.exports = mongoose.model('Discount', discountSchema);
