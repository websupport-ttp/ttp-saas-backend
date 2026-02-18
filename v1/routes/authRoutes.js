// v1/routes/authRoutes.js
const express = require('express');
const {
  register,
  login,
  logout,
  googleLogin,
  forgotPassword,
  resetPassword,
  verifyEmail,
  verifyPhone,
  resendEmailVerification,
  resendPhoneVerification,
} = require('../controllers/authController');
const { authenticateUser } = require('../middleware/authMiddleware');
const { authLimiter, strictAuthLimiter } = require('../middleware/rateLimitMiddleware');
const { createAuditMiddleware } = require('../middleware/auditMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  verifyPhoneSchema,
  googleLoginSchema,
} = require('../utils/validationSchemas');

const router = express.Router();

/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AuthRegister'
 *     responses:
 *       201:
 *         description: User registered successfully. Email/phone verification sent.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardSuccessResponse'
 *       400:
 *         description: Bad request (e.g., validation error, missing fields)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *       409:
 *         description: Conflict (email or phone number already registered)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 */
router.post('/register',
  authLimiter,
  validate(registerSchema),
  createAuditMiddleware.auth('USER_REGISTRATION'),
  register
);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Log in a user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AuthLogin'
 *     responses:
 *       200:
 *         description: User logged in successfully
 *         headers:
 *           Set-Cookie:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 *               example: accessToken=jwttoken; HttpOnly; Secure; SameSite=Lax
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardSuccessResponse'
 *       401:
 *         description: Unauthorized (invalid credentials)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 */
router.post('/login',
  authLimiter,
  validate(loginSchema),
  createAuditMiddleware.auth('USER_LOGIN'),
  login
);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Log out a user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User logged out successfully
 *         headers:
 *           Set-Cookie:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 *               example: accessToken=; HttpOnly; Secure; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardSuccessResponse'
 *       401:
 *         description: Unauthorized (no valid token)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 */
router.post('/logout',
  authenticateUser,
  createAuditMiddleware.auth('USER_LOGOUT'),
  logout
);

/**
 * @openapi
 * /auth/google:
 *   post:
 *     summary: Handle Google login/registration
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - googleId
 *               - email
 *               - firstName
 *               - lastName
 *             properties:
 *               googleId:
 *                 type: string
 *                 description: The Google user ID.
 *                 example: "101234567890123456789"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email from Google.
 *                 example: "user@gmail.com"
 *               firstName:
 *                 type: string
 *                 description: User's first name from Google.
 *                 example: "Google"
 *               lastName:
 *                 type: string
 *                 description: User's last name from Google.
 *                 example: "User"
 *               otherNames:
 *                 type: string
 *                 description: User's other names from Google (optional).
 *                 example: "Account"
 *     responses:
 *       200:
 *         description: Google login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardSuccessResponse'
 *       400:
 *         description: Bad request (missing Google data)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 */
router.post('/google',
  authLimiter,
  validate(googleLoginSchema),
  createAuditMiddleware.auth('GOOGLE_LOGIN'),
  googleLogin
);

/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     summary: Request a password reset
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ForgotPasswordRequest'
 *     responses:
 *       200:
 *         description: Password reset link/OTP sent successfully (if user exists)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardSuccessResponse'
 *       500:
 *         description: Error sending reset email/SMS
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 */
router.post('/forgot-password',
  strictAuthLimiter,
  validate(forgotPasswordSchema),
  createAuditMiddleware.auth('PASSWORD_RESET_REQUEST'),
  forgotPassword
);

/**
 * @openapi
 * /auth/reset-password:
 *   put:
 *     summary: Reset user password using a token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResetPasswordRequest'
 *     responses:
 *       200:
 *         description: Password reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardSuccessResponse'
 *       400:
 *         description: Invalid or expired token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 */
router.put('/reset-password',
  strictAuthLimiter,
  validate(resetPasswordSchema),
  createAuditMiddleware.auth('PASSWORD_RESET'),
  resetPassword
);

/**
 * @openapi
 * /auth/verify-email:
 *   get:
 *     summary: Verify user email address
 *     tags: [Auth]
 *     parameters:
 *       - in: query
 *         name: token
 *         schema:
 *           type: string
 *         required: true
 *         description: The email verification token.
 *     responses:
 *       200:
 *         description: Email verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardSuccessResponse'
 *       400:
 *         description: Invalid or expired verification token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 */
router.get('/verify-email', validate(verifyEmailSchema), verifyEmail);

/**
 * @openapi
 * /auth/verify-phone:
 *   post:
 *     summary: Verify user phone number with OTP
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phoneNumber
 *               - otp
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 example: "+2348012345678"
 *               otp:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Phone number verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardSuccessResponse'
 *       400:
 *         description: Invalid or expired OTP
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 */
router.post('/verify-phone', validate(verifyPhoneSchema), verifyPhone);

/**
 * @openapi
 * /auth/resend-email-verification:
 *   post:
 *     summary: Resend email verification link
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Email verification link resent
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardSuccessResponse'
 *       400:
 *         description: Email already verified or no email to verify
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 */
router.post('/resend-email-verification', authenticateUser, resendEmailVerification);

/**
 * @openapi
 * /auth/resend-phone-verification:
 *   post:
 *     summary: Resend phone verification OTP
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Phone verification OTP resent
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardSuccessResponse'
 *       400:
 *         description: Phone already verified or no phone to verify
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 */
router.post('/resend-phone-verification', authenticateUser, resendPhoneVerification);

module.exports = router;