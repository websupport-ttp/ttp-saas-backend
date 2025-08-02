// v1/examples/referralIntegrationExample.js
// Example of how to integrate referral tracking middleware with existing booking routes

const express = require('express');
const { 
  trackReferralMiddleware, 
  attributeBookingMiddleware,
  trackGuestReferralMiddleware 
} = require('../middleware/referralTrackingMiddleware');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * Example: Flight booking with referral tracking for authenticated users
 * 
 * The middleware will:
 * 1. Track referral if referralCode is provided in request body
 * 2. Attribute successful bookings to the referral
 */
router.post('/book-flight', 
  authenticateToken, // Authenticate user first
  trackReferralMiddleware, // Track referral if code provided
  attributeBookingMiddleware, // Attribute booking on success
  async (req, res) => {
    try {
      const { flightDetails, passengerDetails, referralCode } = req.body;
      const userId = req.user.id;

      // Your existing booking logic here
      const bookingReference = `FLIGHT-${Date.now()}`;
      const totalAmount = flightDetails.price + 5000; // Add service charge

      // Simulate successful booking
      const bookingResult = {
        success: true,
        bookingReference,
        totalAmount,
        currency: 'NGN',
        serviceType: 'flight'
      };

      // The attributeBookingMiddleware will automatically attribute this booking
      // to any active referral for this user
      res.json({
        success: true,
        statusCode: 200,
        message: 'Flight booked successfully',
        data: bookingResult
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Booking failed',
        error: error.message
      });
    }
  }
);

/**
 * Example: Guest booking with referral tracking
 * 
 * For guest bookings where user account is created during the process:
 * 1. Store pending referral info
 * 2. Process referral after user creation
 */
router.post('/book-flight-guest',
  trackGuestReferralMiddleware, // Store referral info for later processing
  attributeBookingMiddleware, // Attribute booking on success
  async (req, res) => {
    try {
      const { flightDetails, passengerDetails, referralCode, guestEmail } = req.body;

      // Create user account (your existing logic)
      const newUser = await createGuestUser(passengerDetails);

      // Process pending referral if exists
      if (req.pendingReferral) {
        const { processPendingReferral } = require('../middleware/referralTrackingMiddleware');
        await processPendingReferral(newUser._id, req.pendingReferral);
      }

      // Continue with booking logic
      const bookingReference = `FLIGHT-${Date.now()}`;
      const totalAmount = flightDetails.price + 5000;

      // Set user in request for attribution middleware
      req.user = { id: newUser._id };

      const bookingResult = {
        success: true,
        bookingReference,
        totalAmount,
        currency: 'NGN',
        serviceType: 'flight'
      };

      res.json({
        success: true,
        statusCode: 200,
        message: 'Flight booked successfully',
        data: bookingResult
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Booking failed',
        error: error.message
      });
    }
  }
);

/**
 * Example: Hotel booking with referral tracking
 */
router.post('/book-hotel',
  authenticateToken,
  trackReferralMiddleware,
  attributeBookingMiddleware,
  async (req, res) => {
    try {
      const { hotelDetails, guestDetails, referralCode } = req.body;
      const userId = req.user.id;

      // Your existing hotel booking logic
      const bookingReference = `HOTEL-${Date.now()}`;
      const totalAmount = hotelDetails.price + 2000; // Add service charge

      const bookingResult = {
        success: true,
        bookingReference,
        totalAmount,
        currency: 'NGN',
        serviceType: 'hotel'
      };

      res.json({
        success: true,
        statusCode: 200,
        message: 'Hotel booked successfully',
        data: bookingResult
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Booking failed',
        error: error.message
      });
    }
  }
);

/**
 * Example: Insurance purchase with referral tracking
 */
router.post('/purchase-insurance',
  authenticateToken,
  trackReferralMiddleware,
  attributeBookingMiddleware,
  async (req, res) => {
    try {
      const { insuranceDetails, customerDetails, referralCode } = req.body;
      const userId = req.user.id;

      // Your existing insurance purchase logic
      const reference = `INS-${Date.now()}`;
      const amount = insuranceDetails.premium;

      const purchaseResult = {
        success: true,
        reference, // Note: using 'reference' instead of 'bookingReference'
        amount, // Note: using 'amount' instead of 'totalAmount'
        currency: 'NGN',
        serviceType: 'insurance'
      };

      res.json({
        success: true,
        statusCode: 200,
        message: 'Insurance purchased successfully',
        data: purchaseResult
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Purchase failed',
        error: error.message
      });
    }
  }
);

// Mock function for creating guest user
async function createGuestUser(passengerDetails) {
  // Your existing user creation logic
  return {
    _id: 'new-user-id',
    email: passengerDetails.email,
    firstName: passengerDetails.firstName,
    lastName: passengerDetails.lastName
  };
}

module.exports = router;

/**
 * Integration Notes:
 * 
 * 1. Middleware Order:
 *    - Authentication middleware first (if required)
 *    - trackReferralMiddleware to track referrals
 *    - attributeBookingMiddleware to attribute successful bookings
 *    - Your booking controller last
 * 
 * 2. Request Body Requirements:
 *    - Include 'referralCode' field in request body for tracking
 *    - For guest bookings, include 'guestEmail' field
 * 
 * 3. Response Format:
 *    - Ensure successful responses include:
 *      - success: true
 *      - statusCode: 200-299
 *      - data.bookingReference (or reference/orderId/transactionId)
 *      - data.totalAmount (or amount)
 *      - data.currency (optional, defaults to 'NGN')
 * 
 * 4. Error Handling:
 *    - Referral tracking failures won't block booking process
 *    - Check req.referralInfo for tracking status if needed
 * 
 * 5. Service Type Detection:
 *    - Automatically detected from URL path
 *    - /flight -> 'flight'
 *    - /hotel -> 'hotel'
 *    - /insurance -> 'insurance'
 *    - /visa -> 'visa'
 * 
 * 6. Commission Calculation:
 *    - Commission amounts should be calculated by CommissionService
 *    - Attribution middleware handles the booking-to-referral linking
 *    - Commission processing happens separately
 */