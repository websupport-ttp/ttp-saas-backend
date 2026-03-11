const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const asyncHandler = require('../middleware/asyncHandler');

// Get pricing analytics
router.get('/pricing', protect, authorize('admin', 'staff'), asyncHandler(async (req, res) => {
  const { range = '30d' } = req.query;

  // Calculate date range
  const now = new Date();
  let startDate = new Date();
  
  switch (range) {
    case '7d':
      startDate.setDate(now.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(now.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(now.getDate() - 90);
      break;
    case '1y':
      startDate.setFullYear(now.getFullYear() - 1);
      break;
    default:
      startDate.setDate(now.getDate() - 30);
  }

  // Mock data for now - replace with actual database queries
  const analytics = {
    revenue: {
      total: 125000,
      byService: [
        { service: 'flights', amount: 65000 },
        { service: 'hotels', amount: 35000 },
        { service: 'car-hire', amount: 15000 },
        { service: 'visa-assistance', amount: 10000 }
      ],
      trend: 12.5
    },
    bookings: {
      total: 450,
      byService: [
        { service: 'flights', count: 200 },
        { service: 'hotels', count: 150 },
        { service: 'car-hire', count: 75 },
        { service: 'visa-assistance', count: 25 }
      ],
      trend: 8.3
    },
    discounts: {
      totalApplied: 85,
      totalAmount: 12500,
      mostUsed: [
        { name: 'Early Bird 10%', count: 35 },
        { name: 'Agent Discount', count: 28 },
        { name: 'Summer Special', count: 22 }
      ]
    },
    taxes: {
      totalCollected: 18750,
      byType: [
        { type: 'VAT', amount: 15000 },
        { type: 'Service Tax', amount: 3750 }
      ]
    }
  };

  res.json({
    success: true,
    data: analytics
  });
}));

module.exports = router;
