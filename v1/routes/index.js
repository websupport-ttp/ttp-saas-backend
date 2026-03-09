// v1/routes/index.js
const express = require('express');
const authRoutes = require('./authRoutes');
const preRegistrationRoutes = require('./preRegistrationRoutes');
const userRoutes = require('./userRoutes');
const userProfileRoutes = require('./userProfileRoutes');
const productRoutes = require('./productRoutes');
const bookingRoutes = require('./bookingRoutes');
const messageRoutes = require('./messageRoutes');
const postRoutes = require('./postRoutes');
const categoryRoutes = require('./categoryRoutes');
const analyticsRoutes = require('./analyticsRoutes');
const affiliateRoutes = require('./affiliateRoutes');
const affiliateNotificationRoutes = require('./affiliateNotificationRoutes');
const walletRoutes = require('./walletRoutes');
const qrCodeRoutes = require('./qrCodeRoutes');
const referenceDataRoutes = require('./referenceDataRoutes');
const airportDbRoutes = require('./airportDbRoutes');
const carHireRoutes = require('./carHireRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const visaAssistanceRoutes = require('./visaAssistanceRoutes');
const cmsRoutes = require('./cmsRoutes');
const currencyRoutes = require('./currencyRoutes');
const transactionDashboardRoutes = require('./transactionDashboardRoutes');

// Import security middleware
const { 
  apiLimiter, 
  authLimiter, 
  strictAuthLimiter, 
  paymentLimiter,
  uploadLimiter,
  affiliateLimiter,
  affiliateNotificationLimiter,
  suspiciousActivityLimiter,
  createAdvancedRateLimiter 
} = require('../middleware/rateLimitMiddleware');
const { 
  sanitizeInput, 
  validateCommonInputs, 
  preventParameterPollution,
  detectBruteForce,
  logFailedAttempt 
} = require('../middleware/securityMiddleware');

const router = express.Router();

// Create QR code specific rate limiter
const qrCodeLimiter = createAdvancedRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxPerIP: 30,
  maxPerUser: 60,
  keyPrefix: 'qr_code',
  message: 'Too many QR code requests, please try again after 15 minutes',
});

// Apply global security middleware to all routes
router.use(suspiciousActivityLimiter);
router.use(detectBruteForce);
router.use(logFailedAttempt);
router.use(sanitizeInput);
router.use(validateCommonInputs);
router.use(preventParameterPollution);

// Apply rate limiting based on route sensitivity
router.use('/auth', authLimiter);
router.use('/users', apiLimiter);
router.use('/user', uploadLimiter); // User profile with upload rate limiting
router.use('/products', paymentLimiter); // Products involve payments
router.use('/bookings', paymentLimiter); // Bookings involve payments
router.use('/messages', apiLimiter);
router.use('/posts', apiLimiter);
router.use('/categories', apiLimiter);
router.use('/analytics', apiLimiter);
router.use('/affiliates', affiliateLimiter); // Affiliate-specific rate limiting
router.use('/affiliate-notifications', affiliateNotificationLimiter); // Notification-specific rate limiting
router.use('/wallets', paymentLimiter); // Wallets involve financial operations
router.use('/qr-codes', qrCodeLimiter); // QR code specific rate limiting
router.use('/reference', apiLimiter); // Reference data with standard rate limiting
router.use('/car-hire', paymentLimiter); // Car hire involves payments
router.use('/dashboard', apiLimiter); // Dashboard stats with standard rate limiting
router.use('/visa-assistance', paymentLimiter); // Visa assistance involves payments
router.use('/cms', apiLimiter); // CMS with standard rate limiting
router.use('/currencies', apiLimiter); // Currency with standard rate limiting
router.use('/dashboard/transactions', apiLimiter); // Transaction dashboard with standard rate limiting

// Define base routes for each module
router.use('/auth', authRoutes);
router.use('/auth', preRegistrationRoutes); // Pre-registration verification routes
router.use('/users', userRoutes);
router.use('/user', userProfileRoutes); // User profile endpoints
router.use('/products', productRoutes);
router.use('/bookings', bookingRoutes);
router.use('/messages', messageRoutes);
router.use('/posts', postRoutes);
router.use('/categories', categoryRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/affiliates', affiliateRoutes);
router.use('/affiliate-notifications', affiliateNotificationRoutes);
router.use('/wallets', walletRoutes);
router.use('/qr-codes', qrCodeRoutes);
router.use('/reference', referenceDataRoutes);
router.use('/airportdb', airportDbRoutes); // AirportDB endpoints for autocomplete
router.use('/car-hire', carHireRoutes); // Car hire endpoints
router.use('/dashboard', dashboardRoutes); // Dashboard statistics endpoints
router.use('/visa-assistance', visaAssistanceRoutes); // Visa assistance endpoints
router.use('/cms', cmsRoutes); // CMS endpoints for content management
router.use('/currencies', currencyRoutes); // Currency management endpoints
router.use('/dashboard/transactions', transactionDashboardRoutes); // Transaction dashboard endpoints
router.use('/health', require('./healthRoutes')); // Health check endpoints

module.exports = router;