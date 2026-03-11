// v1/routes/emailTemplateRoutes.js
const express = require('express');
const {
  getAllEmailTemplates,
  getEmailTemplateById,
  getEmailTemplateByName,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
  previewEmailTemplate,
} = require('../controllers/emailTemplateController');
const { authenticateUser, authorizeRoles } = require('../middleware/authMiddleware');
const { UserRoles } = require('../utils/constants');

const router = express.Router();

// All routes require authentication
router.use(authenticateUser);

// Get all templates (Admin/Staff)
router.get('/', authorizeRoles(UserRoles.ADMIN, UserRoles.STAFF), getAllEmailTemplates);

// Get template by name (Admin/Staff)
router.get('/name/:name', authorizeRoles(UserRoles.ADMIN, UserRoles.STAFF), getEmailTemplateByName);

// Preview template (Admin/Staff)
router.post('/:id/preview', authorizeRoles(UserRoles.ADMIN, UserRoles.STAFF), previewEmailTemplate);

// Get template by ID (Admin/Staff)
router.get('/:id', authorizeRoles(UserRoles.ADMIN, UserRoles.STAFF), getEmailTemplateById);

// Create template (Admin only)
router.post('/', authorizeRoles(UserRoles.ADMIN), createEmailTemplate);

// Update template (Admin only)
router.put('/:id', authorizeRoles(UserRoles.ADMIN), updateEmailTemplate);

// Delete template (Admin only)
router.delete('/:id', authorizeRoles(UserRoles.ADMIN), deleteEmailTemplate);

module.exports = router;
