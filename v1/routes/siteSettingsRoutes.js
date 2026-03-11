// v1/routes/siteSettingsRoutes.js
const express = require('express');
const router = express.Router();
const { getSiteSettings, updateSiteSettings } = require('../controllers/siteSettingsController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Public route
router.get('/', getSiteSettings);

// Admin only route
router.put('/', protect, authorize('admin'), updateSiteSettings);

module.exports = router;
