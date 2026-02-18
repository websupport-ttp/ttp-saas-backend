// v1/models/insuranceModel.js

const mongoose = require('mongoose');

/**
 * @description Mongoose schema for the Insurance model.
 * Stores travel insurance policies and claims.
 */

const BeneficiarySchema = new mongoose.Schema({
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
  relationship: {
    type: String,
    enum: ['spouse', 'child', 'parent', 'sibling', 'other'],
    required: true
  },
  dateOfBirth: {
    type: Date,
    required: true
  },
  percentage: {
    type: Number,
    min: 0,
    max: 100,
    required: true
  }
});

const CoverageSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  limit: {
    type: Number,
    required: true
  },
  deductible: {
    type: Number,
    default: 0
  }
});

const ClaimSchema = new mongoose.Schema({
  claimNumber: {
    type: String,
    required: true,
    unique: true
  },
  type: {
    type: String,
    enum: ['medical', 'trip_cancellation', 'baggage_loss', 'flight_delay', 'other'],
    required: true
  },
  description: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['submitted', 'under_review', 'approved', 'rejected', 'paid'],
    default: 'submitted'
  },
  documents: [{
    name: { type: String, required: true },
    url: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now }
  }],
  submittedAt: {
    type: Date,
    default: Date.now
  },
  processedAt: {
    type: Date
  },
  notes: [{
    note: { type: String },
    addedBy: { type: String },
    addedAt: { type: Date, default: Date.now }
  }]
});

const InsurancePolicySchema = new mongoose.Schema({
  policyNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  provider: {
    name: {
      type: String,
      required: true
    },
    code: {
      type: String,
      required: true
    },
    contact: {
      phone: { type: String },
      email: { type: String },
      website: { type: String }
    }
  },
  policyHolder: {
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
    email: {
      type: String,
      required: true,
      lowercase: true
    },
    phone: {
      type: String,
      required: true
    },
    address: {
      street: { type: String },
      city: { type: String, required: true },
      state: { type: String },
      country: { type: String, required: true },
      postalCode: { type: String }
    }
  },
  trip: {
    destination: {
      type: String,
      required: true
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    purpose: {
      type: String,
      enum: ['leisure', 'business', 'study', 'medical', 'other'],
      default: 'leisure'
    }
  },
  coverage: [CoverageSchema],
  beneficiaries: [BeneficiarySchema],
  premium: {
    amount: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'NGN'
    },
    frequency: {
      type: String,
      enum: ['one-time', 'monthly', 'quarterly', 'annually'],
      default: 'one-time'
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
    enum: ['pending', 'active', 'expired', 'cancelled', 'suspended'],
    default: 'pending',
    index: true
  },
  effectiveDate: {
    type: Date,
    required: true
  },
  expiryDate: {
    type: Date,
    required: true
  },
  claims: [ClaimSchema],
  documents: [{
    type: {
      type: String,
      enum: ['policy_certificate', 'terms_conditions', 'claim_form', 'other'],
      required: true
    },
    name: { type: String, required: true },
    url: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now }
  }],
  sanlamAllianzData: {
    policyId: { type: String },
    quoteId: { type: String },
    rawResponse: { type: mongoose.Schema.Types.Mixed }
  },
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
InsurancePolicySchema.index({ userId: 1, status: 1 });
InsurancePolicySchema.index({ policyNumber: 1 });
InsurancePolicySchema.index({ 'payment.reference': 1 });
InsurancePolicySchema.index({ effectiveDate: 1, expiryDate: 1 });
InsurancePolicySchema.index({ 'trip.startDate': 1 });

// Virtual for policy duration
InsurancePolicySchema.virtual('duration').get(function() {
  if (this.effectiveDate && this.expiryDate) {
    const diffTime = Math.abs(this.expiryDate - this.effectiveDate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  return 0;
});

// Virtual for total coverage
InsurancePolicySchema.virtual('totalCoverage').get(function() {
  return this.coverage.reduce((total, cover) => total + cover.limit, 0);
});

// Virtual for active claims
InsurancePolicySchema.virtual('activeClaims').get(function() {
  return this.claims.filter(claim => 
    ['submitted', 'under_review', 'approved'].includes(claim.status)
  );
});

// Methods
InsurancePolicySchema.methods.generatePolicyNumber = function() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `INS-${timestamp}-${random}`.toUpperCase();
};

InsurancePolicySchema.methods.isActive = function() {
  const now = new Date();
  return this.status === 'active' && 
         this.effectiveDate <= now && 
         this.expiryDate > now;
};

InsurancePolicySchema.methods.isExpired = function() {
  return new Date() > this.expiryDate;
};

InsurancePolicySchema.methods.addClaim = function(claimData) {
  const claimNumber = `CLM-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 3)}`.toUpperCase();
  
  this.claims.push({
    claimNumber,
    ...claimData
  });
  
  return claimNumber;
};

InsurancePolicySchema.methods.getCoverageByType = function(type) {
  return this.coverage.find(cover => cover.type === type);
};

// Pre-save middleware
InsurancePolicySchema.pre('save', function(next) {
  if (!this.policyNumber) {
    this.policyNumber = this.generatePolicyNumber();
  }
  
  // Auto-expire if past expiry date
  if (this.isExpired() && this.status === 'active') {
    this.status = 'expired';
  }
  
  // Validate beneficiary percentages
  const totalPercentage = this.beneficiaries.reduce((sum, ben) => sum + ben.percentage, 0);
  if (totalPercentage > 100) {
    return next(new Error('Total beneficiary percentage cannot exceed 100%'));
  }
  
  next();
});

// Static methods
InsurancePolicySchema.statics.findByPolicyNumber = function(policyNumber) {
  return this.findOne({ policyNumber });
};

InsurancePolicySchema.statics.findActiveByUser = function(userId) {
  return this.find({ 
    userId, 
    status: 'active',
    effectiveDate: { $lte: new Date() },
    expiryDate: { $gt: new Date() }
  });
};

InsurancePolicySchema.statics.findExpiringPolicies = function(days = 30) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  return this.find({
    status: 'active',
    expiryDate: { $lte: futureDate, $gt: new Date() }
  });
};

module.exports = mongoose.model('InsurancePolicy', InsurancePolicySchema);