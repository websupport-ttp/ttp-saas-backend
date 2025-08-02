// v1/models/tokenModel.js
const mongoose = require('mongoose');

/**
 * @description Mongoose schema for the Token model.
 * Stores refresh tokens for JWT rotation and reuse detection.
 */
const TokenSchema = new mongoose.Schema({
  refreshToken: {
    type: String,
    required: true,
  },
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
  },
  isValid: {
    type: Boolean,
    default: true,
  },
  // IP address and user agent can be stored for additional security
  ip: String,
  userAgent: String,
}, {
  timestamps: true, // Adds createdAt and updatedAt timestamps
});

module.exports = mongoose.model('Token', TokenSchema);