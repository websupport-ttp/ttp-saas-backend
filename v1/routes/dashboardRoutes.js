const express = require('express');
const router = express.Router();
const {
  getUserStats,
  getStaffStats,
  getAdminStats,
  getManagerStats
} = require('../controllers/dashboardController');
const { authenticateUser, authorizeRoles } = require('../middleware/authMiddleware');

// User dashboard stats
router.get('/stats', authenticateUser, getUserStats);

// Staff dashboard stats
router.get('/staff/stats', authenticateUser, authorizeRoles('Staff', 'Admin'), getStaffStats);

// Admin dashboard stats
router.get('/admin/stats', authenticateUser, authorizeRoles('Admin'), getAdminStats);

// Manager dashboard stats
router.get('/manager/stats', authenticateUser, authorizeRoles('Manager', 'Executive', 'Admin'), getManagerStats);

module.exports = router;
