const express = require('express');
const router = express.Router();
const {
  getAllServiceCharges,
  getServiceCharge,
  createServiceCharge,
  updateServiceCharge,
  deleteServiceCharge,
  getApplicableServiceCharges
} = require('../controllers/serviceChargeController');
const { authenticateUser, authorizeRoles } = require('../middleware/authMiddleware');
const { UserRoles } = require('../utils/constants');

// Public routes
router.get('/applicable/:serviceType', getApplicableServiceCharges);

// Read routes (authenticated users can view)
router.get('/', authenticateUser, getAllServiceCharges);
router.get('/:id', authenticateUser, getServiceCharge);

// Admin-only write routes
router.post('/', authenticateUser, authorizeRoles(UserRoles.ADMIN), createServiceCharge);
router.put('/:id', authenticateUser, authorizeRoles(UserRoles.ADMIN), updateServiceCharge);
router.delete('/:id', authenticateUser, authorizeRoles(UserRoles.ADMIN), deleteServiceCharge);

module.exports = router;
