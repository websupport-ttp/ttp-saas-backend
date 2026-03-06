// v1/controllers/preRegistrationController.js
const { StatusCodes } = require('http-status-codes');
const crypto = require('crypto');
const PendingVerification = require('../models/pendingVerificationModel');
const User = require('../models/userModel');
const { ApiError } = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../middleware/asyncHandler');
const { sendEmail } = require('../utils/emailService');
const { sendSMS } = require('../utils/smsService');
const logger = require('../utils/logger');

/**
 * @description Send verification codes to email and phone before registration
 * @route POST /api/v1/auth/send-verification-codes
 * @access Public
 */
const sendVerificationCodes = asyncHandler(async (req, res) => {
  const { email, phoneNumber } = req.body;

  if (!email || !phoneNumber) {
    throw new ApiError('Email and phone number are required', StatusCodes.BAD_REQUEST);
  }

  // Check if email or phone already exists in User collection
  const existingUser = await User.findOne({ 
    $or: [{ email }, { phoneNumber }] 
  });

  if (existingUser) {
    if (existingUser.email === email) {
      throw new ApiError('An account with this email already exists', StatusCodes.CONFLICT);
    }
    if (existingUser.phoneNumber === phoneNumber) {
      throw new ApiError('An account with this phone number already exists', StatusCodes.CONFLICT);
    }
  }

  // Find or create pending verification
  let pending = await PendingVerification.findOne({ email, phoneNumber });

  if (!pending) {
    pending = new PendingVerification({ email, phoneNumber });
  } else {
    // Check rate limiting
    if (!pending.canResendEmailOtp() || !pending.canResendPhoneOtp()) {
      throw new ApiError('Please wait before requesting new codes', StatusCodes.TOO_MANY_REQUESTS);
    }
  }

  // Generate new OTPs
  const emailOtp = pending.generateEmailOtp();
  const phoneOtp = pending.generatePhoneOtp();

  // Update last resent times
  pending.lastResent = {
    email: new Date(),
    phone: new Date(),
  };

  // Reset verification status and attempts
  pending.isEmailVerified = false;
  pending.isPhoneVerified = false;
  pending.attempts = { email: 0, phone: 0 };
  pending.verificationToken = undefined;

  await pending.save();

  // Send email OTP
  try {
    await sendEmail({
      to: email,
      subject: 'Verify Your Email - The Travel Place',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Email Verification</h2>
          <p>Your verification code is:</p>
          <div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${emailOtp}
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">The Travel Place - Your trusted travel partner</p>
        </div>
      `,
    });
    logger.info(`Email OTP sent to ${email}`);
  } catch (error) {
    logger.error(`Failed to send email OTP to ${email}:`, error);
    // Don't throw error, continue with phone OTP
  }

  // Send phone OTP via SMS
  try {
    const smsMessage = `Your Travel Place verification code is: ${phoneOtp}. Valid for 10 minutes.`;
    await sendSMS(phoneNumber, smsMessage);
    logger.info(`Phone OTP sent to ${phoneNumber}`);
  } catch (error) {
    logger.error(`Failed to send phone OTP to ${phoneNumber}:`, error);
    // Don't throw error, at least one method should work
  }

  ApiResponse.success(
    res,
    StatusCodes.OK,
    'Verification codes sent successfully. Please check your email and phone.',
    {
      email,
      phoneNumber: phoneNumber.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'), // Mask middle digits
      expiresIn: 600, // 10 minutes in seconds
    }
  );
});

/**
 * @description Verify email and phone OTPs (supports partial verification)
 * @route POST /api/v1/auth/verify-registration-codes
 * @access Public
 */
const verifyRegistrationCodes = asyncHandler(async (req, res) => {
  const { email, phoneNumber, emailOtp, phoneOtp } = req.body;

  if (!email || !phoneNumber) {
    throw new ApiError('Email and phone number are required', StatusCodes.BAD_REQUEST);
  }

  // Find pending verification
  const pending = await PendingVerification.findOne({ email, phoneNumber });

  if (!pending) {
    throw new ApiError('No verification request found. Please request new codes.', StatusCodes.NOT_FOUND);
  }

  let emailVerified = pending.isEmailVerified;
  let phoneVerified = pending.isPhoneVerified;

  // Verify email OTP if provided and not already verified
  if (emailOtp && emailOtp !== '000000' && !pending.isEmailVerified) {
    const emailResult = pending.verifyEmailOtp(emailOtp);
    if (!emailResult.valid) {
      await pending.save(); // Save attempt count
      
      if (emailResult.reason === 'expired') {
        throw new ApiError('Email verification code has expired. Please request a new one.', StatusCodes.BAD_REQUEST);
      }
      if (emailResult.reason === 'max_attempts') {
        throw new ApiError('Maximum verification attempts exceeded. Please request new codes.', StatusCodes.TOO_MANY_REQUESTS);
      }
      throw new ApiError('Invalid email verification code', StatusCodes.BAD_REQUEST);
    }
    emailVerified = true;
  }

  // Verify phone OTP if provided and not already verified
  if (phoneOtp && phoneOtp !== '000000' && !pending.isPhoneVerified) {
    const phoneResult = pending.verifyPhoneOtp(phoneOtp);
    if (!phoneResult.valid) {
      await pending.save(); // Save attempt count
      
      if (phoneResult.reason === 'expired') {
        throw new ApiError('Phone verification code has expired. Please request a new one.', StatusCodes.BAD_REQUEST);
      }
      if (phoneResult.reason === 'max_attempts') {
        throw new ApiError('Maximum verification attempts exceeded. Please request new codes.', StatusCodes.TOO_MANY_REQUESTS);
      }
      throw new ApiError('Invalid phone verification code', StatusCodes.BAD_REQUEST);
    }
    phoneVerified = true;
  }

  // Generate verification token only when both are verified
  let verificationToken = pending.verificationToken;
  if (emailVerified && phoneVerified && !verificationToken) {
    verificationToken = pending.generateVerificationToken();
  }

  await pending.save();

  logger.info(`Verification progress for ${email}: email=${emailVerified}, phone=${phoneVerified}`);

  // Return appropriate response based on verification status
  if (emailVerified && phoneVerified) {
    ApiResponse.success(
      res,
      StatusCodes.OK,
      'Verification successful! You can now complete your registration.',
      {
        verificationToken,
        email,
        phoneNumber,
        emailVerified: true,
        phoneVerified: true,
      }
    );
  } else if (emailVerified) {
    ApiResponse.success(
      res,
      StatusCodes.OK,
      'Email verified successfully! Please verify your phone number.',
      {
        email,
        phoneNumber,
        emailVerified: true,
        phoneVerified: false,
      }
    );
  } else {
    throw new ApiError('Please provide valid verification codes', StatusCodes.BAD_REQUEST);
  }
});

/**
 * @description Resend email OTP
 * @route POST /api/v1/auth/resend-email-otp
 * @access Public
 */
const resendEmailOtp = asyncHandler(async (req, res) => {
  const { email, phoneNumber } = req.body;

  if (!email || !phoneNumber) {
    throw new ApiError('Email and phone number are required', StatusCodes.BAD_REQUEST);
  }

  const pending = await PendingVerification.findOne({ email, phoneNumber });

  if (!pending) {
    throw new ApiError('No verification request found', StatusCodes.NOT_FOUND);
  }

  if (!pending.canResendEmailOtp()) {
    throw new ApiError('Please wait before requesting a new code', StatusCodes.TOO_MANY_REQUESTS);
  }

  // Generate new email OTP
  const emailOtp = pending.generateEmailOtp();
  pending.lastResent.email = new Date();
  pending.attempts.email = 0; // Reset attempts
  await pending.save();

  // Send email
  try {
    await sendEmail({
      to: email,
      subject: 'Verify Your Email - The Travel Place',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Email Verification</h2>
          <p>Your new verification code is:</p>
          <div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${emailOtp}
          </div>
          <p>This code will expire in 10 minutes.</p>
        </div>
      `,
    });
    logger.info(`Email OTP resent to ${email}`);
  } catch (error) {
    logger.error(`Failed to resend email OTP to ${email}:`, error);
    throw new ApiError('Failed to send email. Please try again.', StatusCodes.INTERNAL_SERVER_ERROR);
  }

  ApiResponse.success(res, StatusCodes.OK, 'Email verification code resent successfully');
});

/**
 * @description Resend phone OTP with method selection
 * @route POST /api/v1/auth/resend-phone-otp
 * @access Public
 */
const resendPhoneOtp = asyncHandler(async (req, res) => {
  const { email, phoneNumber, method = 'sms' } = req.body; // method: 'sms', 'whatsapp', 'call'

  if (!email || !phoneNumber) {
    throw new ApiError('Email and phone number are required', StatusCodes.BAD_REQUEST);
  }

  if (!['sms', 'whatsapp', 'call'].includes(method)) {
    throw new ApiError('Invalid verification method. Use: sms, whatsapp, or call', StatusCodes.BAD_REQUEST);
  }

  const pending = await PendingVerification.findOne({ email, phoneNumber });

  if (!pending) {
    throw new ApiError('No verification request found', StatusCodes.NOT_FOUND);
  }

  if (!pending.canResendPhoneOtp()) {
    throw new ApiError('Please wait before requesting a new code', StatusCodes.TOO_MANY_REQUESTS);
  }

  // Generate new phone OTP
  const phoneOtp = pending.generatePhoneOtp();
  pending.lastResent.phone = new Date();
  pending.attempts.phone = 0; // Reset attempts
  await pending.save();

  // Send via selected method
  try {
    let message;
    
    switch (method) {
      case 'sms':
        message = `Your Travel Place verification code is: ${phoneOtp}. Valid for 10 minutes.`;
        await sendSMS(phoneNumber, message);
        logger.info(`Phone OTP sent via SMS to ${phoneNumber}`);
        break;
        
      case 'whatsapp':
        message = `Your Travel Place verification code is: ${phoneOtp}. Valid for 10 minutes.`;
        // Check if WhatsApp is configured
        if (process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN) {
          const { sendWhatsAppMessage } = require('../utils/whatsappService');
          await sendWhatsAppMessage(phoneNumber, message);
          logger.info(`Phone OTP sent via WhatsApp to ${phoneNumber}`);
        } else {
          // Fall back to SMS if WhatsApp not configured
          logger.warn(`WhatsApp not configured, falling back to SMS for ${phoneNumber}`);
          await sendSMS(phoneNumber, message);
        }
        break;
        
      case 'call':
        // TODO: Implement voice call when API is set up
        // For now, fall back to SMS
        logger.info(`Voice call not yet implemented, using SMS for ${phoneNumber}`);
        message = `Your Travel Place verification code is: ${phoneOtp}. Valid for 10 minutes.`;
        await sendSMS(phoneNumber, message);
        break;
    }
  } catch (error) {
    logger.error(`Failed to resend phone OTP to ${phoneNumber} via ${method}:`, error);
    throw new ApiError('Failed to send verification code. Please try again.', StatusCodes.INTERNAL_SERVER_ERROR);
  }

  ApiResponse.success(
    res,
    StatusCodes.OK,
    `Phone verification code sent via ${method} successfully`
  );
});

module.exports = {
  sendVerificationCodes,
  verifyRegistrationCodes,
  resendEmailOtp,
  resendPhoneOtp,
};
