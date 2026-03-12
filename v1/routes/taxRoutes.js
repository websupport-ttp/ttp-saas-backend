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

// Read routes (authenticated users can view)
router.get('/', authenticateUser, getAllTaxes);
router.get('/:id', authenticateUser, getTax);

// Admin-only write routes
router.post('/', authenticateUser, authorizeRoles(UserRoles.ADMIN), createTax);
router.put('/:id', authenticateUser, authorizeRoles(UserRoles.ADMIN), updateTax);
router.delete('/:id', authenticateUser, authorizeRoles(UserRoles.ADMIN), deleteTax);

module.exports = router;
