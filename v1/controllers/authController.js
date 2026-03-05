// v1/controllers/authController.js
const { StatusCodes } = require('http-status-codes');
const User = require('../models/userModel');
const Token = require('../models/tokenModel');
const { ApiError } = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../middleware/asyncHandler');
const { attachCookiesToResponse, generateToken, verifyToken, clearAuthCookies, blacklistToken } = require('../utils/jwt');
const { sendEmail } = require('../utils/emailService');
const { sendSMS } = require('../utils/smsService');
const logger = require('../utils/logger');
const { createAuditMiddleware } = require('../middleware/auditMiddleware');
const crypto = require('crypto');

/**
 * @description Register a new user.
 * @route POST /api/v1/auth/register
 * @access Public
 */
const register = asyncHandler(async (req, res) => {
  const { firstName, lastName, otherNames, email, phoneNumber, password, role } = req.body;

  // Log registration attempt
  logger.logSecurityEvent('USER_REGISTRATION_ATTEMPT', {
    email: email || 'not_provided',
    phoneNumber: phoneNumber || 'not_provided',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    requestedRole: role || 'user',
  }, 'low');

  // Check if email or phone number already exists
  const existingUser = await User.findOne({ $or: [{ email }, { phoneNumber }] });
  if (existingUser) {
    logger.logSecurityEvent('USER_REGISTRATION_DUPLICATE', {
      email: email || 'not_provided',
      phoneNumber: phoneNumber || 'not_provided',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      duplicateField: existingUser.email === email ? 'email' : 'phoneNumber',
    }, 'medium');

    if (existingUser.email === email) {
      throw new ApiError('Email already registered', StatusCodes.CONFLICT);
    }
    if (existingUser.phoneNumber === phoneNumber) {
      throw new ApiError('Phone number already registered', StatusCodes.CONFLICT);
    }
  }

  const user = await User.create({ firstName, lastName, otherNames, email, phoneNumber, password, role });

  // Log successful registration
  logger.logSecurityEvent('USER_REGISTERED', {
    userId: user._id,
    email: user.email,
    phoneNumber: user.phoneNumber,
    role: user.role,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  }, 'low');

  // Generate email verification token and send email
  if (email) {
    const verificationToken = user.getEmailVerificationToken();
    await user.save({ validateBeforeSave: false }); // Save user with token

    const verificationUrl = `${req.protocol}://${req.get('host')}/api/v1/auth/verify-email?token=${verificationToken}`;
    const message = `Please verify your email by clicking on this link: <a href="${verificationUrl}">${verificationUrl}</a>`;

    try {
      await sendEmail({
        to: user.email,
        subject: 'Email Verification for The Travel Place',
        html: `<h4>Hello ${user.firstName},</h4><p>${message}</p>`,
      });
      logger.info(`Email verification link sent to ${user.email}`);
    } catch (err) {
      user.emailVerificationToken = undefined;
      await user.save({ validateBeforeSave: false });
      logger.error(`Error sending email verification to ${user.email}: ${err.message}`);
      // Don't throw error here, just log and continue
    }
  }

  // Generate phone verification OTP and send SMS
  if (phoneNumber) {
    const otp = user.getPhoneVerificationOtp();
    await user.save({ validateBeforeSave: false }); // Save user with OTP

    const message = `Your OTP for phone verification at The Travel Place is: ${otp}. It expires in 5 minutes.`;
    try {
      await sendSMS(user.phoneNumber, message);
      logger.info(`Phone verification OTP sent to ${user.phoneNumber}`);
    } catch (err) {
      user.phoneVerificationOtp = undefined;
      user.phoneVerificationOtpExpires = undefined;
      await user.save({ validateBeforeSave: false });
      logger.error(`Error sending SMS verification to ${user.phoneNumber}: ${err.message}`);
      // Don't throw error here, just log and continue
    }
  }

  // Enhanced session info for token generation
  const sessionInfo = {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    deviceId: req.get('X-Device-ID') || crypto.randomUUID(),
  };

  attachCookiesToResponse(res, { _id: user._id, role: user.role }, sessionInfo);

  ApiResponse.success(res, StatusCodes.CREATED, 'User registered successfully. Please check your email/phone for verification.', {
    user: {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
    },
  });
});

/**
 * @description Log in a user.
 * @route POST /api/v1/auth/login
 * @access Public
 */
const login = asyncHandler(async (req, res) => {
  const { emailOrPhone, password } = req.body;

  // Log login attempt
  logger.logSecurityEvent('USER_LOGIN_ATTEMPT', {
    emailOrPhone: emailOrPhone || 'not_provided',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  }, 'low');

  let query = {};
  if (emailOrPhone.includes('@')) {
    query = { email: emailOrPhone };
  } else {
    query = { phoneNumber: emailOrPhone };
  }

  const user = await User.findOne(query).select('+password');

  if (!user) {
    logger.logSecurityEvent('USER_LOGIN_FAILED', {
      emailOrPhone,
      reason: 'user_not_found',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    }, 'medium');
    throw new ApiError('Invalid credentials', StatusCodes.UNAUTHORIZED);
  }

  const isMatch = await user.matchPassword(password);
  if (!isMatch) {
    logger.logSecurityEvent('USER_LOGIN_FAILED', {
      userId: user._id,
      emailOrPhone,
      reason: 'invalid_password',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    }, 'medium');
    throw new ApiError('Invalid credentials', StatusCodes.UNAUTHORIZED);
  }

  // Check verification status based on login method
  if (emailOrPhone.includes('@')) {
    // Email login - check email verification
    if (!user.isEmailVerified) {
      logger.logSecurityEvent('USER_LOGIN_BLOCKED', {
        userId: user._id,
        emailOrPhone,
        reason: 'email_not_verified',
        ip: req.ip,
      }, 'low');
      
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: 'Please verify your email before logging in',
        requiresVerification: true,
        verificationType: 'email',
        email: user.email
      });
    }
  } else {
    // Phone login - check phone verification
    if (!user.isPhoneVerified) {
      logger.logSecurityEvent('USER_LOGIN_BLOCKED', {
        userId: user._id,
        emailOrPhone,
        reason: 'phone_not_verified',
        ip: req.ip,
      }, 'low');
      
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: 'Please verify your phone number before logging in',
        requiresVerification: true,
        verificationType: 'phone',
        phoneNumber: user.phoneNumber
      });
    }
  }

  // Enhanced session info for token generation
  const sessionInfo = {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    deviceId: req.get('X-Device-ID') || crypto.randomUUID(),
  };

  // Generate token pair with enhanced security
  const tokenPair = attachCookiesToResponse(res, { _id: user._id, role: user.role }, sessionInfo);

  // Update or create token record in database
  const existingToken = await Token.findOne({ user: user._id });

  if (existingToken) {
    existingToken.refreshToken = tokenPair.refreshToken;
    existingToken.isValid = true;
    existingToken.ip = req.ip;
    existingToken.userAgent = req.get('User-Agent');
    await existingToken.save();
  } else {
    await Token.create({
      refreshToken: tokenPair.refreshToken,
      user: user._id,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
  }

  // Update user login activity
  user.updateLoginActivity().catch(error => {
    logger.warn('Failed to update login activity:', error.message);
  });

  // Log successful login
  logger.logSecurityEvent('USER_LOGIN_SUCCESS', {
    userId: user._id,
    email: user.email,
    role: user.role,
    sessionId: tokenPair.sessionId,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  }, 'low');

  ApiResponse.success(res, StatusCodes.OK, 'Logged in successfully', {
    user: {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
    },
  });
});

/**
 * @description Log out a user with enhanced security.
 * @route POST /api/v1/auth/logout
 * @access Private
 */
const logout = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const sessionId = req.user.sessionId;
  const tokenId = req.user.tokenId;

  // Log logout attempt
  logger.logSecurityEvent('USER_LOGOUT_ATTEMPT', {
    userId,
    sessionId,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  }, 'low');

  // Blacklist the current access token
  if (tokenId) {
    const accessTokenExpiry = 15 * 60; // 15 minutes in seconds
    await blacklistToken(tokenId, accessTokenExpiry);
  }

  // Invalidate refresh token in DB
  await Token.findOneAndDelete({ user: userId });

  // Clear all authentication cookies
  clearAuthCookies(res);

  // Log successful logout
  logger.logSecurityEvent('USER_LOGOUT_SUCCESS', {
    userId,
    sessionId,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  }, 'low');

  ApiResponse.success(res, StatusCodes.OK, 'Logged out successfully');
});

/**
 * @description Handle Google login/registration.
 * @route POST /api/v1/auth/google
 * @access Public
 * @remarks This is a simplified example. A real implementation would involve
 * Google OAuth 2.0 flow (client-side authentication, then sending
 * the ID token to the backend for verification).
 */
const googleLogin = asyncHandler(async (req, res) => {
  const { googleId, email, firstName, lastName, otherNames } = req.body;

  if (!googleId || !email || !firstName || !lastName) {
    throw new ApiError('Missing required Google user data', StatusCodes.BAD_REQUEST);
  }

  let user = await User.findOne({ googleId });

  if (!user) {
    // If user doesn't exist, check by email
    user = await User.findOne({ email });
    if (user) {
      // If email exists but not linked to Google, link it
      user.googleId = googleId;
      await user.save({ validateBeforeSave: false });
      logger.info(`Existing user ${user.email} linked to Google ID`);
    } else {
      // Register new user with Google ID
      user = await User.create({
        googleId,
        email,
        firstName,
        lastName,
        otherNames,
        isEmailVerified: true, // Google verified email
        // A dummy password is required by schema, but won't be used for Google login
        password: crypto.randomBytes(32).toString('hex'),
      });
      logger.info(`New user registered via Google: ${user.email}`);
    }
  }

  attachCookiesToResponse(res, { _id: user._id, role: user.role });

  ApiResponse.success(res, StatusCodes.OK, 'Google login successful', {
    user: {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
    },
  });
});

/**
 * @description Request password reset.
 * @route POST /api/v1/auth/forgot-password
 * @access Public
 */
const forgotPassword = asyncHandler(async (req, res) => {
  const { emailOrPhone } = req.body;

  let query = {};
  if (emailOrPhone.includes('@')) {
    query = { email: emailOrPhone };
  } else {
    query = { phoneNumber: emailOrPhone };
  }

  const user = await User.findOne(query);

  if (!user) {
    // For security, always return a success message even if user not found
    return ApiResponse.success(res, StatusCodes.OK, 'If a user with that email/phone exists, a password reset link/OTP has been sent.');
  }

  const resetToken = user.getResetPasswordToken();
  await user.save({ validateBeforeSave: false });

  const resetUrl = `${req.protocol}://${req.get('host')}/api/v1/auth/reset-password/${resetToken}`;

  const emailMessage = `You are receiving this because you (or someone else) has requested the reset of a password. Please make a PUT request to: \n\n ${resetUrl} with a JSON body containing { "token": "${resetToken}", "newPassword": "YOUR_NEW_PASSWORD" }. \n\n If you did not request this, please ignore this email and your password will remain unchanged.`;
  const smsMessage = `Your password reset token for The Travel Place is: ${resetToken}. This token is valid for 10 minutes.`;

  try {
    if (user.email) {
      await sendEmail({
        to: user.email,
        subject: 'Password Reset Request for The Travel Place',
        html: `<h4>Hello ${user.firstName},</h4><p>${emailMessage}</p>`,
      });
      logger.info(`Password reset email sent to ${user.email}`);
    } else if (user.phoneNumber) {
      await sendSMS(user.phoneNumber, smsMessage);
      logger.info(`Password reset SMS sent to ${user.phoneNumber}`);
    }
    ApiResponse.success(res, StatusCodes.OK, 'Password reset link/OTP sent successfully');
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    logger.error(`Error sending password reset to ${user.email || user.phoneNumber}: ${err.message}`);
    throw new ApiError('Error sending password reset. Please try again later.', StatusCodes.INTERNAL_SERVER_ERROR);
  }
});

/**
 * @description Reset user password.
 * @route PUT /api/v1/auth/reset-password/:token
 * @access Public
 */
const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;

  // Hash the incoming token to compare with the hashed token in DB
  const resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    passwordResetToken: resetPasswordToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) {
    throw new ApiError('Invalid or expired reset token', StatusCodes.BAD_REQUEST);
  }

  user.password = newPassword;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save(); // Pre-save hook will hash the new password

  attachCookiesToResponse(res, { _id: user._id, role: user.role });

  ApiResponse.success(res, StatusCodes.OK, 'Password reset successfully', {
    user: {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
    },
  });
});

/**
 * @description Verify user email.
 * @route GET /api/v1/auth/verify-email
 * @access Public
 */
const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.query;

  const verificationToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({ emailVerificationToken: verificationToken });

  if (!user) {
    throw new ApiError('Invalid or expired email verification token', StatusCodes.BAD_REQUEST);
  }

  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  await user.save({ validateBeforeSave: false });

  ApiResponse.success(res, StatusCodes.OK, 'Email verified successfully');
});

/**
 * @description Verify user phone number with OTP.
 * @route POST /api/v1/auth/verify-phone
 * @access Public
 */
const verifyPhone = asyncHandler(async (req, res) => {
  const { otp, phoneNumber } = req.body;

  const user = await User.findOne({ phoneNumber });

  if (!user) {
    throw new ApiError('User not found', StatusCodes.NOT_FOUND);
  }

  // Hash the incoming OTP to compare with the hashed OTP in DB
  const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

  if (user.phoneVerificationOtp !== hashedOtp || user.phoneVerificationOtpExpires < Date.now()) {
    throw new ApiError('Invalid or expired OTP', StatusCodes.BAD_REQUEST);
  }

  user.isPhoneVerified = true;
  user.phoneVerificationOtp = undefined;
  user.phoneVerificationOtpExpires = undefined;
  await user.save({ validateBeforeSave: false });

  ApiResponse.success(res, StatusCodes.OK, 'Phone number verified successfully');
});

/**
 * @description Resend verification (email or phone) - Public endpoint for login flow
 * @route POST /api/v1/auth/resend-verification
 * @access Public
 */
const resendVerification = asyncHandler(async (req, res) => {
  const { emailOrPhone, type } = req.body;

  if (!emailOrPhone || !type) {
    throw new ApiError('Email/phone and verification type are required', StatusCodes.BAD_REQUEST);
  }

  // Find user by email or phone
  let query = {};
  if (emailOrPhone.includes('@')) {
    query = { email: emailOrPhone };
  } else {
    query = { phoneNumber: emailOrPhone };
  }

  const user = await User.findOne(query);

  if (!user) {
    // For security, don't reveal if user exists
    return ApiResponse.success(res, StatusCodes.OK, 'If a user with that contact exists, verification has been resent.');
  }

  if (type === 'email') {
    if (user.isEmailVerified) {
      throw new ApiError('Email is already verified', StatusCodes.BAD_REQUEST);
    }
    if (!user.email) {
      throw new ApiError('User does not have an email to verify', StatusCodes.BAD_REQUEST);
    }

    const verificationToken = user.getEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    const verificationUrl = `${req.protocol}://${req.get('host')}/api/v1/auth/verify-email?token=${verificationToken}`;
    const message = `Please verify your email by clicking on this link: <a href="${verificationUrl}">${verificationUrl}</a>`;

    try {
      await sendEmail({
        to: user.email,
        subject: 'Email Verification for The Travel Place',
        html: `<h4>Hello ${user.firstName},</h4><p>${message}</p>`,
      });
      logger.info(`Email verification link resent to ${user.email}`);
    } catch (err) {
      user.emailVerificationToken = undefined;
      await user.save({ validateBeforeSave: false });
      logger.error(`Error resending email verification to ${user.email}: ${err.message}`);
      throw new ApiError('Failed to resend email verification. Please try again later.', StatusCodes.INTERNAL_SERVER_ERROR);
    }
  } else if (type === 'phone') {
    if (user.isPhoneVerified) {
      throw new ApiError('Phone number is already verified', StatusCodes.BAD_REQUEST);
    }
    if (!user.phoneNumber) {
      throw new ApiError('User does not have a phone number to verify', StatusCodes.BAD_REQUEST);
    }

    const otp = user.getPhoneVerificationOtp();
    await user.save({ validateBeforeSave: false });

    const message = `Your OTP for phone verification at The Travel Place is: ${otp}. It expires in 5 minutes.`;
    try {
      await sendSMS(user.phoneNumber, message);
      logger.info(`Phone verification OTP resent to ${user.phoneNumber}`);
    } catch (err) {
      user.phoneVerificationOtp = undefined;
      user.phoneVerificationOtpExpires = undefined;
      await user.save({ validateBeforeSave: false });
      logger.error(`Error resending SMS verification to ${user.phoneNumber}: ${err.message}`);
      throw new ApiError('Failed to resend phone verification. Please try again later.', StatusCodes.INTERNAL_SERVER_ERROR);
    }
  } else {
    throw new ApiError('Invalid verification type. Must be "email" or "phone"', StatusCodes.BAD_REQUEST);
  }

  ApiResponse.success(res, StatusCodes.OK, 'Verification sent successfully. Please check your email or phone.');
});

/**
 * @description Resend email verification link.
 * @route POST /api/v1/auth/resend-email-verification
 * @access Private (User must be logged in to resend for their own account)
 */
const resendEmailVerification = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.userId);

  if (!user) {
    throw new ApiError('User not found', StatusCodes.NOT_FOUND);
  }
  if (user.isEmailVerified) {
    throw new ApiError('Email is already verified', StatusCodes.BAD_REQUEST);
  }
  if (!user.email) {
    throw new ApiError('User does not have an email to verify', StatusCodes.BAD_REQUEST);
  }

  const verificationToken = user.getEmailVerificationToken();
  await user.save({ validateBeforeSave: false });

  const verificationUrl = `${req.protocol}://${req.get('host')}/api/v1/auth/verify-email?token=${verificationToken}`;
  const message = `Please verify your email by clicking on this link: <a href="${verificationUrl}">${verificationUrl}</a>`;

  try {
    await sendEmail({
      to: user.email,
      subject: 'Email Verification for The Travel Place',
      html: `<h4>Hello ${user.firstName},</h4><p>${message}</p>`,
    });
    ApiResponse.success(res, StatusCodes.OK, 'Email verification link resent. Please check your inbox.');
  } catch (err) {
    user.emailVerificationToken = undefined;
    await user.save({ validateBeforeSave: false });
    logger.error(`Error resending email verification to ${user.email}: ${err.message}`);
    throw new ApiError('Failed to resend email verification. Please try again later.', StatusCodes.INTERNAL_SERVER_ERROR);
  }
});

/**
 * @description Resend phone verification OTP.
 * @route POST /api/v1/auth/resend-phone-verification
 * @access Private (User must be logged in to resend for their own account)
 */
const resendPhoneVerification = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.userId);

  if (!user) {
    throw new ApiError('User not found', StatusCodes.NOT_FOUND);
  }
  if (user.isPhoneVerified) {
    throw new ApiError('Phone number is already verified', StatusCodes.BAD_REQUEST);
  }
  if (!user.phoneNumber) {
    throw new ApiError('User does not have a phone number to verify', StatusCodes.BAD_REQUEST);
  }

  const otp = user.getPhoneVerificationOtp();
  await user.save({ validateBeforeSave: false });

  const message = `Your OTP for phone verification at The Travel Place is: ${otp}. It expires in 5 minutes.`;
  try {
    await sendSMS(user.phoneNumber, message);
    ApiResponse.success(res, StatusCodes.OK, 'Phone verification OTP resent. Please check your phone.');
  } catch (err) {
    user.phoneVerificationOtp = undefined;
    user.phoneVerificationOtpExpires = undefined;
    await user.save({ validateBeforeSave: false });
    logger.error(`Error resending SMS verification to ${user.phoneNumber}: ${err.message}`);
    throw new ApiError('Failed to resend phone verification. Please try again later.', StatusCodes.INTERNAL_SERVER_ERROR);
  }
});


module.exports = {
  register,
  login,
  logout,
  googleLogin,
  forgotPassword,
  resetPassword,
  verifyEmail,
  verifyPhone,
  resendVerification,
  resendEmailVerification,
  resendPhoneVerification,
};