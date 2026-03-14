// v1/models/vendorAgentApplicationModel.js
const mongoose = require('mongoose');
const { UserRoles } = require('../utils/constants');

const VendorAgentApplicationSchema = new mongoose.Schema({
  // Applicant Information
  applicant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  applicationType: {
    type: String,
    enum: ['Vendor', 'Agent'],
    required: true,
  },
  
  // Business Information
  businessName: {
    type: String,
    required: [true, 'Business name is required'],
    trim: true,
  },
  businessEmail: {
    type: String,
    required: [true, 'Business email is required'],
    lowercase: true,
    trim: true,
  },
  businessPhone: {
    type: String,
    required: [true, 'Business phone is required'],
    trim: true,
  },
  businessAddress: {
    street: String,
    city: String,
    state: String,
    country: String,
    zipCode: String,
  },
  businessRegistrationNumber: {
    type: String,
    required: [true, 'Business registration number is required'],
    trim: true,
  },
  
  // Documents
  documents: {
    registrationDocument: {
      url: String,
      s3Key: String,
      uploadedAt: Date,
      fileName: String,
    },
    identificationDocument: {
      url: String,
      s3Key: String,
      uploadedAt: Date,
      fileName: String,
      type: {
        type: String,
        enum: ['Passport', 'National ID', 'Driver License', 'International Passport'],
      },
    },
    proofOfAddress: {
      url: String,
      s3Key: String,
      uploadedAt: Date,
      fileName: String,
    },
  },
  
  // Bank Details (for vendors/agents)
  bankDetails: {
    bankName: String,
    accountNumber: String,
    accountName: String,
    accountType: {
      type: String,
      enum: ['Savings', 'Checking', 'Business'],
    },
    swiftCode: String,
  },
  
  // Application Status
  status: {
    type: String,
    enum: ['Pending', 'Under Review', 'Approved', 'Rejected'],
    default: 'Pending',
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  reviewedAt: Date,
  rejectionReason: String,
  approvalNotes: String,
  
  // Commission Rate (set during approval)
  commissionRate: {
    type: Number,
    min: 0,
    max: 100,
  },
  
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Index for faster queries
VendorAgentApplicationSchema.index({ applicant: 1, applicationType: 1 });
VendorAgentApplicationSchema.index({ status: 1 });
VendorAgentApplicationSchema.index({ createdAt: -1 });
VendorAgentApplicationSchema.index({ reviewedBy: 1 });

module.exports = mongoose.model('VendorAgentApplication', VendorAgentApplicationSchema);
