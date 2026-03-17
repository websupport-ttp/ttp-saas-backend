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
    // provider-role-based: tied to a specific provider AND has per-role amounts
    enum: ['percentage', 'fixed', 'role-based', 'provider-specific', 'provider-role-based'],
    required: true
  },
  value: {
    type: Number,
    min: 0
  },
  // Role-based discounts (used by 'role-based' and 'provider-role-based')
  roleDiscounts: {
    customer:  { type: Number, default: 0,  min: 0, max: 100 },
    business:  { type: Number, default: 0,  min: 0, max: 100 },
    staff:     { type: Number, default: 0,  min: 0, max: 100 },
    vendor:    { type: Number, default: 0,  min: 0, max: 100 },
    agent:     { type: Number, default: 0,  min: 0, max: 100 },
    manager:   { type: Number, default: 0,  min: 0, max: 100 },
    executive: { type: Number, default: 0,  min: 0, max: 100 },
    admin:     { type: Number, default: 0,  min: 0, max: 100 }
  },
  // Provider info (used by 'provider-specific' and 'provider-role-based')
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
  if (this.type !== 'role-based' && this.type !== 'provider-role-based') return this.value || 0;

  // Normalise role string — handle both capitalised and lowercase
  const roleMap = {
    'customer':  'customer',
    'Customer':  'customer',
    'user':      'customer', // legacy alias
    'User':      'customer', // legacy alias
    'business':  'business',
    'Business':  'business',
    'staff':     'staff',
    'Staff':     'staff',
    'vendor':    'vendor',
    'Vendor':    'vendor',
    'agent':     'agent',
    'Agent':     'agent',
    'manager':   'manager',
    'Manager':   'manager',
    'executive': 'executive',
    'Executive': 'executive',
    'admin':     'admin',
    'Admin':     'admin',
  };

  const key = roleMap[userRole] || 'customer';
  return this.roleDiscounts?.[key] ?? 0;
};

module.exports = mongoose.model('Discount', discountSchema);
