// v1/routes/siteSettingsRoutes.js
const express = require('express');
const router = express.Router();
const { getSiteSettings, updateSiteSettings } = require('../controllers/siteSettingsController');
const { authenticateUser, authorizeRoles } = require('../middleware/authMiddleware');

// Public route
router.get('/', getSiteSettings);

// Admin only route
router.put('/', authenticateUser, authorizeRoles('admin'), updateSiteSettings);

module.exports = router;
