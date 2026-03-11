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

// Admin routes
router.use(authenticateUser);
router.use(authorizeRoles(UserRoles.ADMIN));

router.route('/')
  .get(getAllServiceCharges)
  .post(createServiceCharge);

router.route('/:id')
  .get(getServiceCharge)
  .put(updateServiceCharge)
  .delete(deleteServiceCharge);

module.exports = router;
