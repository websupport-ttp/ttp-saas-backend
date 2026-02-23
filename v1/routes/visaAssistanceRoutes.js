// v1/routes/visaAssistanceRoutes.js
const express = require('express');
const router = express.Router();
const {
  createVisaRequest,
  submitVisaApplication,
  getApplicationByReference,
  getOfficerApplications,
  addFollowUpNote,
  generateApplicationPaymentLink,
  updateApplicationStatus,
  assignApplication
} = require('../controllers/visaAssistanceController');
const { authenticateUser, authorizeRoles } = require('../middleware/authMiddleware');

// Public routes
router.post('/request', createVisaRequest);
router.post('/applications', submitVisaApplication);
router.get('/applications/:reference', getApplicationByReference);

// Visa Officer routes
router.get('/officer/applications', authenticateUser, authorizeRoles('Staff', 'Admin'), getOfficerApplications);
router.post('/applications/:id/follow-up', authenticateUser, authorizeRoles('Staff', 'Admin'), addFollowUpNote);
router.post('/applications/:id/generate-payment-link', authenticateUser, authorizeRoles('Staff', 'Admin'), generateApplicationPaymentLink);
router.put('/applications/:id/status', authenticateUser, authorizeRoles('Staff', 'Admin'), updateApplicationStatus);

// Head of Operations routes
router.put('/applications/:id/assign', authenticateUser, authorizeRoles('Staff', 'Admin'), assignApplication);

module.exports = router;
