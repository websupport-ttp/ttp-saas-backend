const express = require('express');
const router = express.Router();
const {
  getAllDiscounts,
  getDiscount,
  createDiscount,
  updateDiscount,
  deleteDiscount,
  validateDiscountCode,
  getApplicableDiscounts,
  incrementDiscountUsage
} = require('../controllers/discountController');
const { authenticateUser, authorizeRoles } = require('../middleware/authMiddleware');
const { UserRoles } = require('../utils/constants');

// Public routes
router.post('/validate', validateDiscountCode);
router.get('/applicable/:serviceType', getApplicableDiscounts);

// Protected routes
router.post('/:id/use', authenticateUser, incrementDiscountUsage);

// Read routes (authenticated users can view)
router.get('/', authenticateUser, getAllDiscounts);
router.get('/:id', authenticateUser, getDiscount);

// Admin-only write routes
router.post('/', authenticateUser, authorizeRoles(UserRoles.ADMIN), createDiscount);
router.put('/:id', authenticateUser, authorizeRoles(UserRoles.ADMIN), updateDiscount);
router.delete('/:id', authenticateUser, authorizeRoles(UserRoles.ADMIN), deleteDiscount);

module.exports = router;
