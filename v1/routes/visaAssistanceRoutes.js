// v1/routes/visaAssistanceRoutes.js
const express = require('express');
const router = express.Router();
const {
  // Price inventory — public
  getVisaPrices,
  getVisaPrice,
  // Price inventory — admin
  getAllVisaPricesAdmin,
  createVisaPrice,
  updateVisaPrice,
  deleteVisaPrice,
  // Client flow
  submitApplication,
  trackApplication,
  // Officer dashboard
  getOfficerApplications,
  getApplicationDetails,
  assignApplication,
  updateApplicationStatus,
  addFollowUpNote,
  generateApplicationPaymentLink,
} = require('../controllers/visaAssistanceController');
const { authenticateUser, authorizeRoles, optionalAuthenticateUser } = require('../middleware/authMiddleware');

// ─── PUBLIC — Price Inventory ─────────────────────────────────────────────────

// Get all active visa destination prices (client-facing dropdown + pricing page)
router.get('/prices', getVisaPrices);

// Get price for a specific country + visa type (called when client selects destination)
router.get('/prices/:country/:visaType', getVisaPrice);

// ─── PUBLIC — Client Application Flow ────────────────────────────────────────

// Submit a visa assistance application (client-facing form)
router.post('/apply', optionalAuthenticateUser, submitApplication);

// Track application by reference number
router.get('/track/:reference', trackApplication);

// ─── PRIVATE — Admin Price Management ────────────────────────────────────────

// Get all prices including inactive (admin view)
router.get('/admin/prices', authenticateUser, authorizeRoles('Staff', 'Manager', 'Executive', 'Admin'), getAllVisaPricesAdmin);

// Create new price entry
router.post('/admin/prices', authenticateUser, authorizeRoles('Staff', 'Manager', 'Executive', 'Admin'), createVisaPrice);

// Update price entry
router.put('/admin/prices/:id', authenticateUser, authorizeRoles('Staff', 'Manager', 'Executive', 'Admin'), updateVisaPrice);

// Delete price entry (Admin only)
router.delete('/admin/prices/:id', authenticateUser, authorizeRoles('Admin'), deleteVisaPrice);

// ─── PRIVATE — Officer Dashboard ─────────────────────────────────────────────

// Get all applications with filters
router.get('/officer/applications', authenticateUser, authorizeRoles('Staff', 'Manager', 'Executive', 'Admin'), getOfficerApplications);

// Get single application details
router.get('/officer/applications/:id', authenticateUser, authorizeRoles('Staff', 'Manager', 'Executive', 'Admin'), getApplicationDetails);

// Assign application to officer
router.put('/officer/applications/:id/assign', authenticateUser, authorizeRoles('Staff', 'Manager', 'Executive', 'Admin'), assignApplication);

// Update application status
router.put('/officer/applications/:id/status', authenticateUser, authorizeRoles('Staff', 'Manager', 'Executive', 'Admin'), updateApplicationStatus);

// Add follow-up note
router.post('/officer/applications/:id/follow-up', authenticateUser, authorizeRoles('Staff', 'Manager', 'Executive', 'Admin'), addFollowUpNote);

// Generate and send payment link to client
router.post('/officer/applications/:id/payment-link', authenticateUser, authorizeRoles('Staff', 'Manager', 'Executive', 'Admin'), generateApplicationPaymentLink);

module.exports = router;
