// v1/models/userModel.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { UserRoles, StaffClearanceLevel } = require('../utils/constants');

/**
 * @description Mongoose schema for the User model.
 * Defines user properties, validation, and pre-save hooks for password hashing and token generation.
 */
const UserSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
  },
  otherNames: {
    type: String,
    trim: true,
    default: null,
  },
  email: {
    type: String,
    unique: true,
    sparse: true, // Allows null values to be unique
    lowercase: true,
    trim: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email address',
    ],
  },
  phoneNumber: {
    type: String,
    unique: true,
    sparse: true, // Allows null values to be unique
    trim: true,
    match: [
      /^\+?[1-9]\d{1,14}$/, // E.164 format
      'Please add a valid phone number',
    ],
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false, // Do not return password in queries by default
  },
  role: {
    type: String,
    enum: Object.values(UserRoles),
    default: UserRoles.USER,
  },
  // Staff clearance level (only applicable when role is 'Staff')
  staffClearanceLevel: {
    type: Number,
    enum: Object.values(StaffClearanceLevel),
    default: null,
    validate: {
      validator: function(value) {
        // If role is Staff, clearance level is required
        if (this.role === UserRoles.STAFF && !value) {
          return false;
        }
        // If role is not Staff, clearance level should be null
        if (this.role !== UserRoles.STAFF && value !== null) {
          return false;
        }
        return true;
      },
      message: 'Staff clearance level is required for staff members and should be null for non-staff users'
    }
  },
  // Staff department/position (optional, for additional context)
  staffDepartment: {
    type: String,
    trim: true,
    default: null,
  },
  // Staff employee ID (optional)
  staffEmployeeId: {
    type: String,
    trim: true,
    unique: true,
    sparse: true,
    default: null,
  },
  isEmailVerified: {
    type: Boolean,
    default: false,
  },
  isPhoneVerified: {
    type: Boolean,
    default: false,
  },
  passwordResetToken: String,
  passwordResetExpires: Date,
  emailVerificationToken: String,
  phoneVerificationOtp: String,
  phoneVerificationOtpExpires: Date,
  googleId: {
    type: String,
    unique: true,
    sparse: true,
  },
  // Customer behavior tracking fields for analytics
  lastLoginAt: {
    type: Date,
    default: null,
  },
  loginCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  totalSpent: {
    type: Number,
    default: 0,
    min: 0,
  },
  totalTransactions: {
    type: Number,
    default: 0,
    min: 0,
  },
  averageTransactionValue: {
    type: Number,
    default: 0,
    min: 0,
  },
  firstPurchaseAt: {
    type: Date,
    default: null,
  },
  lastPurchaseAt: {
    type: Date,
    default: null,
  },
  preferredBookingChannel: {
    type: String,
    enum: ['Web', 'Mobile', 'API', 'Admin'],
    default: 'Web',
  },
  customerSegment: {
    type: String,
    enum: ['Individual', 'Business', 'Group', 'Corporate'],
    default: 'Individual',
  },
  // Preferences and behavior
  preferredItemTypes: [{
    type: String,
    enum: ['Flight', 'Hotel', 'Insurance', 'Visa', 'Package'],
  }],
  marketingOptIn: {
    type: Boolean,
    default: false,
  },
  referralSource: {
    type: String,
    trim: true,
    default: null,
  },
  // Add any other user-specific properties here
}, {
  timestamps: true, // Adds createdAt and updatedAt timestamps
});

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Method to compare entered password with hashed password in DB
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Method to generate password reset token
UserSchema.methods.getResetPasswordToken = function () {
  // Generate token
  const resetToken = crypto.randomBytes(20).toString('hex');

  // Hash token and set to passwordResetToken field
  this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');

  // Set expire
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

  return resetToken;
};

// Method to generate email verification token
UserSchema.methods.getEmailVerificationToken = function () {
  const verificationToken = crypto.randomBytes(32).toString('hex');

  this.emailVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');

  return verificationToken;
};

// Method to generate phone verification OTP
UserSchema.methods.getPhoneVerificationOtp = function () {
  // Generate a 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Hash OTP (optional, but good practice if sensitive)
  this.phoneVerificationOtp = crypto.createHash('sha256').update(otp).digest('hex');

  // Set expire (e.g., 5 minutes)
  this.phoneVerificationOtpExpires = Date.now() + 5 * 60 * 1000;

  return otp;
};

// Ensure either email or phoneNumber is present for new users
UserSchema.pre('validate', function (next) {
  if (!this.email && !this.phoneNumber) {
    this.invalidate('email', 'Either email or phone number must be provided.');
    this.invalidate('phoneNumber', 'Either email or phone number must be provided.');
  }
  next();
});

// Indexes for analytics performance (removed duplicate indexes for email and phoneNumber as they're already unique)
UserSchema.index({ role: 1 });
UserSchema.index({ customerSegment: 1 });
UserSchema.index({ preferredBookingChannel: 1 });
UserSchema.index({ totalSpent: -1 });
UserSchema.index({ totalTransactions: -1 });
UserSchema.index({ lastLoginAt: -1 });
UserSchema.index({ createdAt: -1 });
UserSchema.index({ firstPurchaseAt: -1 });
UserSchema.index({ lastPurchaseAt: -1 });
UserSchema.index({ staffClearanceLevel: 1 });
UserSchema.index({ staffEmployeeId: 1 });

// Compound indexes for analytics
UserSchema.index({ customerSegment: 1, totalSpent: -1 });
UserSchema.index({ role: 1, createdAt: -1 });
UserSchema.index({ role: 1, staffClearanceLevel: 1 });

// Method to update customer behavior after login
UserSchema.methods.updateLoginActivity = function() {
  this.lastLoginAt = new Date();
  this.loginCount += 1;
  return this.save();
};

// Method to update customer behavior after purchase
UserSchema.methods.updatePurchaseActivity = function(transactionAmount) {
  const now = new Date();
  
  if (!this.firstPurchaseAt) {
    this.firstPurchaseAt = now;
  }
  
  this.lastPurchaseAt = now;
  this.totalSpent += transactionAmount;
  this.totalTransactions += 1;
  this.averageTransactionValue = this.totalSpent / this.totalTransactions;
  
  return this.save();
};

// Method to update preferred item types based on purchase history
UserSchema.methods.updatePreferredItemTypes = function(itemType) {
  if (!this.preferredItemTypes.includes(itemType)) {
    this.preferredItemTypes.push(itemType);
    // Keep only the last 5 preferred types
    if (this.preferredItemTypes.length > 5) {
      this.preferredItemTypes = this.preferredItemTypes.slice(-5);
    }
  }
  return this.save();
};

// Method to check if user has minimum clearance level
UserSchema.methods.hasMinimumClearance = function(requiredLevel) {
  if (this.role !== UserRoles.STAFF) {
    return false;
  }
  return this.staffClearanceLevel >= requiredLevel;
};

// Method to check if user is staff
UserSchema.methods.isStaff = function() {
  return this.role === UserRoles.STAFF;
};

// Method to get clearance level description
UserSchema.methods.getClearanceDescription = function() {
  if (this.role !== UserRoles.STAFF || !this.staffClearanceLevel) {
    return null;
  }
  const { StaffClearanceDescription } = require('../utils/constants');
  return StaffClearanceDescription[this.staffClearanceLevel];
};

// Static method to get customer analytics
UserSchema.statics.getCustomerAnalytics = function(startDate, endDate) {
  const matchStage = {};
  if (startDate && endDate) {
    matchStage.createdAt = { $gte: startDate, $lte: endDate };
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalCustomers: { $sum: 1 },
        averageTotalSpent: { $avg: '$totalSpent' },
        averageTransactionCount: { $avg: '$totalTransactions' },
        customersBySegment: {
          $push: {
            segment: '$customerSegment',
            totalSpent: '$totalSpent',
            transactionCount: '$totalTransactions'
          }
        }
      }
    }
  ]);
};

module.exports = mongoose.model('User', UserSchema);