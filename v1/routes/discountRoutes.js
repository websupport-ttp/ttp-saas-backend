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

// Admin routes
router.use(authenticateUser);
router.use(authorizeRoles(UserRoles.ADMIN));

router.route('/')
  .get(getAllDiscounts)
  .post(createDiscount);

router.route('/:id')
  .get(getDiscount)
  .put(updateDiscount)
  .delete(deleteDiscount);

module.exports = router;
