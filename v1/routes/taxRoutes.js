const express = require('express');
const router = express.Router();
const {
  getAllTaxes,
  getTax,
  createTax,
  updateTax,
  deleteTax,
  getApplicableTaxes
} = require('../controllers/taxController');
const { authenticateUser, authorizeRoles } = require('../middleware/authMiddleware');
const { UserRoles } = require('../utils/constants');

// Public routes
router.get('/applicable/:serviceType', getApplicableTaxes);

// Admin routes
router.use(authenticateUser);
router.use(authorizeRoles(UserRoles.ADMIN));

router.route('/')
  .get(getAllTaxes)
  .post(createTax);

router.route('/:id')
  .get(getTax)
  .put(updateTax)
  .delete(deleteTax);

module.exports = router;
