// v1/routes/preRegistrationRoutes.js
const express = require('express');
const {
  sendVerificationCodes,
  verifyRegistrationCodes,
  resendEmailOtp,
  resendPhoneOtp,
} = require('../controllers/preRegistrationController');
const { authLimiter, strictAuthLimiter } = require('../middleware/rateLimitMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const Joi = require('joi');

const router = express.Router();

// Validation schemas
const sendCodesSchema = Joi.object({
  email: Joi.string().email().required(),
  phoneNumber: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
});

const verifyCodesSchema = Joi.object({
  email: Joi.string().email().required(),
  phoneNumber: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
  emailOtp: Joi.string().length(6).pattern(/^\d+$/).required(),
  phoneOtp: Joi.string().length(6).pattern(/^\d+$/).required(),
});

const resendEmailSchema = Joi.object({
  email: Joi.string().email().required(),
  phoneNumber: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
});

const resendPhoneSchema = Joi.object({
  email: Joi.string().email().required(),
  phoneNumber: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
  method: Joi.string().valid('sms', 'whatsapp', 'call').default('sms'),
});

/**
 * @openapi
 * /auth/send-verification-codes:
 *   post:
 *     summary: Send verification codes to email and phone before registration
 *     tags: [Pre-Registration]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - phoneNumber
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "user@example.com"
 *               phoneNumber:
 *                 type: string
 *                 example: "+2348012345678"
 *     responses:
 *       200:
 *         description: Verification codes sent successfully
 *       409:
 *         description: Email or phone already registered
 *       429:
 *         description: Too many requests
 */
router.post('/send-verification-codes',
  strictAuthLimiter,
  validate(sendCodesSchema),
  sendVerificationCodes
);

/**
 * @openapi
 * /auth/verify-registration-codes:
 *   post:
 *     summary: Verify email and phone OTPs before registration
 *     tags: [Pre-Registration]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - phoneNumber
 *               - emailOtp
 *               - phoneOtp
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "user@example.com"
 *               phoneNumber:
 *                 type: string
 *                 example: "+2348012345678"
 *               emailOtp:
 *                 type: string
 *                 example: "123456"
 *               phoneOtp:
 *                 type: string
 *                 example: "654321"
 *     responses:
 *       200:
 *         description: Verification successful, returns verification token
 *       400:
 *         description: Invalid or expired OTP
 *       404:
 *         description: No verification request found
 */
router.post('/verify-registration-codes',
  authLimiter,
  validate(verifyCodesSchema),
  verifyRegistrationCodes
);

/**
 * @openapi
 * /auth/resend-email-otp:
 *   post:
 *     summary: Resend email OTP during registration
 *     tags: [Pre-Registration]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - phoneNumber
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               phoneNumber:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email OTP resent successfully
 *       404:
 *         description: No verification request found
 *       429:
 *         description: Too many requests
 */
router.post('/resend-email-otp',
  strictAuthLimiter,
  validate(resendEmailSchema),
  resendEmailOtp
);

/**
 * @openapi
 * /auth/resend-phone-otp:
 *   post:
 *     summary: Resend phone OTP via SMS, WhatsApp, or call
 *     tags: [Pre-Registration]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - phoneNumber
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               phoneNumber:
 *                 type: string
 *               method:
 *                 type: string
 *                 enum: [sms, whatsapp, call]
 *                 default: sms
 *     responses:
 *       200:
 *         description: Phone OTP resent successfully
 *       404:
 *         description: No verification request found
 *       429:
 *         description: Too many requests
 */
router.post('/resend-phone-otp',
  strictAuthLimiter,
  validate(resendPhoneSchema),
  resendPhoneOtp
);

module.exports = router;
