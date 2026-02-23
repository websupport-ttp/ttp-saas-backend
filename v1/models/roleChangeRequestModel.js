// v1/models/roleChangeRequestModel.js
const mongoose = require('mongoose');
const { RoleChangeStatus, UserRoles } = require('../utils/constants');

/**
 * @description Schema for role change requests
 * All role changes require admin approval
 */
const RoleChangeRequestSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  currentRole: {
    type: String,
    enum: Object.values(UserRoles),
    required: true,
  },
  requestedRole: {
    type: String,
    enum: Object.values(UserRoles),
    required: true,
  },
  requestedDetails: {
    // For Staff role
    staffDetails: {
      department: String,
      tier: Number,
      designation: String,
      employeeId: String,
    },
    // For Vendor role
    vendorDetails: {
      businessName: String,
      businessRegistration: String,
      bankDetails: {
        bankName: String,
        accountNumber: String,
        accountName: String,
      },
      commissionRate: Number,
    },
    // For Agent role
    agentDetails: {
      agencyName: String,
      agentCode: String,
      commissionRate: Number,
    },
  },
  reason: {
    type: String,
    required: true,
    trim: true,
  },
  supportingDocuments: [{
    name: String,
    url: String,
    uploadedAt: Date,
  }],
  status: {
    type: String,
    enum: Object.values(RoleChangeStatus),
    default: RoleChangeStatus.PENDING,
  },
  requestedAt: {
    type: Date,
    default: Date.now,
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  reviewedAt: Date,
  reviewNotes: {
    type: String,
    trim: true,
  },
}, {
  timestamps: true,
});

// Indexes
RoleChangeRequestSchema.index({ user: 1, status: 1 });
RoleChangeRequestSchema.index({ status: 1, requestedAt: -1 });
RoleChangeRequestSchema.index({ reviewedBy: 1 });

module.exports = mongoose.model('RoleChangeRequest', RoleChangeRequestSchema);
