// v1/routes/bookingRoutes.js

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const rateLimitMiddleware = require('../middleware/rateLimitMiddleware');

const {
  searchFlights,
  bookFlight,
  searchHotels,
  getHotelPage,
  prebookRate,
  createHotelBookingForm,
  startHotelBooking,
  checkHotelBookingStatus,
  getHotelStaticContent,
  getHotelDump,
  getHotelIncrementalDump,
  cancelHotelBooking,
  getHotelOrderInfo,
  bookHotel,
  applyVisa,
  getInsuranceQuote,
  purchaseInsurance,
  verifyPayment,
  getUserBookings,
  getBookingByReference
} = require('../controllers/bookingController');

// ── Flight routes ─────────────────────────────────────────────────────────────
router.post('/flights/search', rateLimitMiddleware.apiLimiter, searchFlights);
router.post('/flights/book', authMiddleware.authenticateUser, rateLimitMiddleware.paymentLimiter, bookFlight);

// ── Hotel search (ETG 3-step flow) ────────────────────────────────────────────
// Step 1: Search by region
router.post('/hotels/search', rateLimitMiddleware.apiLimiter, searchHotels);
// Step 2a: Retrieve hotelpage (all rates for selected hotel)
router.post('/hotels/hotelpage', rateLimitMiddleware.apiLimiter, getHotelPage);
// Step 2b: Prebook rate (confirm availability, get p-... hash)
router.post('/hotels/prebook', rateLimitMiddleware.apiLimiter, prebookRate);

// ── Hotel booking (ETG booking flow) ─────────────────────────────────────────
// Step 3a: Create booking form
router.post('/hotels/booking-form', authMiddleware.authenticateUser, rateLimitMiddleware.paymentLimiter, createHotelBookingForm);
// Step 3b: Start booking + poll for final status
router.post('/hotels/start-booking', authMiddleware.authenticateUser, rateLimitMiddleware.paymentLimiter, startHotelBooking);
// Step 3c: Manual status check
router.post('/hotels/booking-status', authMiddleware.authenticateUser, checkHotelBookingStatus);

// ── Hotel post-booking ────────────────────────────────────────────────────────
router.post('/hotels/cancel', authMiddleware.authenticateUser, cancelHotelBooking);
router.post('/hotels/order-info', authMiddleware.authenticateUser, getHotelOrderInfo);

// ── Hotel static data ─────────────────────────────────────────────────────────
router.get('/hotels/static/:hotelId', getHotelStaticContent);
router.get('/hotels/dump', authMiddleware.authenticateUser, getHotelDump);
router.get('/hotels/dump/incremental', authMiddleware.authenticateUser, getHotelIncrementalDump);

// ── Legacy hotel book (kept for compatibility) ────────────────────────────────
router.post('/hotels/book', authMiddleware.authenticateUser, rateLimitMiddleware.paymentLimiter, bookHotel);

// ── Visa routes ───────────────────────────────────────────────────────────────
router.post('/visa/apply', authMiddleware.authenticateUser, rateLimitMiddleware.paymentLimiter, applyVisa);

// ── Insurance routes ──────────────────────────────────────────────────────────
router.post('/insurance/quote', rateLimitMiddleware.apiLimiter, getInsuranceQuote);
router.post('/insurance/purchase', authMiddleware.authenticateUser, rateLimitMiddleware.paymentLimiter, purchaseInsurance);

// ── Payment routes ────────────────────────────────────────────────────────────
router.post('/payment/verify', authMiddleware.authenticateUser, verifyPayment);

// ── Booking management ────────────────────────────────────────────────────────
router.get('/', authMiddleware.authenticateUser, getUserBookings);
router.get('/:reference', authMiddleware.authenticateUser, getBookingByReference);

module.exports = router;