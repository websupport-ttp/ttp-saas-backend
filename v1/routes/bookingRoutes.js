// v1/routes/bookingRoutes.js

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const rateLimitMiddleware = require('../middleware/rateLimitMiddleware');

const {
  searchFlights,
  bookFlight,
  searchHotels,
  bookHotel,
  applyVisa,
  getInsuranceQuote,
  purchaseInsurance,
  verifyPayment,
  getUserBookings,
  getBookingByReference
} = require('../controllers/bookingController');

// Flight routes
router.post('/flights/search',
  rateLimitMiddleware.apiLimiter,
  searchFlights
);

router.post('/flights/book',
  authMiddleware.authenticateUser,
  rateLimitMiddleware.paymentLimiter,
  bookFlight
);

// Hotel routes
router.post('/hotels/search',
  rateLimitMiddleware.apiLimiter,
  searchHotels
);

router.post('/hotels/book',
  authMiddleware.authenticateUser,
  rateLimitMiddleware.paymentLimiter,
  bookHotel
);

// Visa routes
router.post('/visa/apply',
  authMiddleware.authenticateUser,
  rateLimitMiddleware.paymentLimiter,
  applyVisa
);

// Insurance routes
router.post('/insurance/quote',
  rateLimitMiddleware.apiLimiter,
  getInsuranceQuote
);

router.post('/insurance/purchase',
  authMiddleware.authenticateUser,
  rateLimitMiddleware.paymentLimiter,
  purchaseInsurance
);

// Payment routes
router.post('/payment/verify',
  authMiddleware.authenticateUser,
  verifyPayment
);

// Booking management routes
router.get('/',
  authMiddleware.authenticateUser,
  getUserBookings
);

router.get('/:reference',
  authMiddleware.authenticateUser,
  getBookingByReference
);

module.exports = router;