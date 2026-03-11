const express = require('express');
const router = express.Router();
const pricingService = require('../services/pricingService');
const { protect } = require('../middleware/authMiddleware');
const asyncHandler = require('../middleware/asyncHandler');

// Calculate price with breakdown
router.post('/calculate', asyncHandler(async (req, res) => {
  const { basePrice, serviceType, userRole, discountCode, providerCode, country } = req.body;

  if (!basePrice || !serviceType) {
    return res.status(400).json({
      success: false,
      message: 'Base price and service type are required'
    });
  }

  const breakdown = await pricingService.calculatePrice({
    basePrice,
    serviceType,
    userRole,
    discountCode,
    providerCode,
    country
  });

  res.json({
    success: true,
    data: breakdown
  });
}));

// Validate discount code
router.post('/validate-discount', asyncHandler(async (req, res) => {
  const { code, serviceType, amount, userRole } = req.body;

  if (!code || !serviceType || !amount) {
    return res.status(400).json({
      success: false,
      message: 'Code, service type, and amount are required'
    });
  }

  const discount = await pricingService.validateDiscountCode(
    code,
    serviceType,
    amount,
    userRole || 'user'
  );

  res.json({
    success: true,
    data: discount
  });
}));

module.exports = router;
