// v1/models/pendingVerificationModel.js
const mongoose = require('mongoose');
const crypto = require('crypto');

const pendingVerificationSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  phoneNumber: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  emailOtp: {
    type: String,
    required: true,
  },
  phoneOtp: {
    type: String,
    required: true,
  },
  emailOtpExpires: {
    type: Date,
    required: true,
  },
  phoneOtpExpires: {
    type: Date,
    required: true,
  },
  isEmailVerified: {
    type: Boolean,
    default: false,
  },
  isPhoneVerified: {
    type: Boolean,
    default: false,
  },
  verificationToken: {
    type: String,
    unique: true,
    sparse: true, // Only unique if not null
  },
  attempts: {
    email: {
      type: Number,
      default: 0,
    },
    phone: {
      type: Number,
      default: 0,
    },
  },
  lastResent: {
    email: Date,
    phone: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 900, // Auto-delete after 15 minutes (900 seconds)
  },
}, {
  timestamps: true,
});

// Index for faster lookups
pendingVerificationSchema.index({ email: 1, phoneNumber: 1 });
// verificationToken already has unique: true in schema, no need for separate index
pendingVerificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 900 });

/**
 * Generate a 6-digit OTP
 */
pendingVerificationSchema.methods.generateOtp = function() {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Generate email OTP and set expiry
 */
pendingVerificationSchema.methods.generateEmailOtp = function() {
  const otp = this.generateOtp();
  this.emailOtp = crypto.createHash('sha256').update(otp).digest('hex');
  this.emailOtpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  return otp; // Return plain OTP for sending
};

/**
 * Generate phone OTP and set expiry
 */
pendingVerificationSchema.methods.generatePhoneOtp = function() {
  const otp = this.generateOtp();
  this.phoneOtp = crypto.createHash('sha256').update(otp).digest('hex');
  this.phoneOtpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  return otp; // Return plain OTP for sending
};

/**
 * Verify email OTP
 */
pendingVerificationSchema.methods.verifyEmailOtp = function(otp) {
  const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
  
  if (this.emailOtpExpires < Date.now()) {
    return { valid: false, reason: 'expired' };
  }
  
  if (this.attempts.email >= 5) {
    return { valid: false, reason: 'max_attempts' };
  }
  
  this.attempts.email += 1;
  
  if (this.emailOtp === hashedOtp) {
    this.isEmailVerified = true;
    return { valid: true };
  }
  
  return { valid: false, reason: 'invalid' };
};

/**
 * Verify phone OTP
 */
pendingVerificationSchema.methods.verifyPhoneOtp = function(otp) {
  const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
  
  if (this.phoneOtpExpires < Date.now()) {
    return { valid: false, reason: 'expired' };
  }
  
  if (this.attempts.phone >= 5) {
    return { valid: false, reason: 'max_attempts' };
  }
  
  this.attempts.phone += 1;
  
  if (this.phoneOtp === hashedOtp) {
    this.isPhoneVerified = true;
    return { valid: true };
  }
  
  return { valid: false, reason: 'invalid' };
};

/**
 * Generate verification token after both email and phone are verified
 */
pendingVerificationSchema.methods.generateVerificationToken = function() {
  if (!this.isEmailVerified || !this.isPhoneVerified) {
    throw new Error('Both email and phone must be verified first');
  }
  
  const token = crypto.randomBytes(32).toString('hex');
  this.verificationToken = crypto.createHash('sha256').update(token).digest('hex');
  return token; // Return plain token for frontend
};

/**
 * Check if can resend OTP (rate limiting)
 */
pendingVerificationSchema.methods.canResendEmailOtp = function() {
  if (!this.lastResent.email) return true;
  const timeSinceLastResend = Date.now() - this.lastResent.email.getTime();
  return timeSinceLastResend > 60000; // 1 minute
};

pendingVerificationSchema.methods.canResendPhoneOtp = function() {
  if (!this.lastResent.phone) return true;
  const timeSinceLastResend = Date.now() - this.lastResent.phone.getTime();
  return timeSinceLastResend > 60000; // 1 minute
};

const PendingVerification = mongoose.model('PendingVerification', pendingVerificationSchema);

module.exports = PendingVerification;
