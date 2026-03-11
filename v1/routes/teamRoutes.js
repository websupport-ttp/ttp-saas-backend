// v1/routes/teamRoutes.js
const express = require('express');
const router = express.Router();
const {
  getTeamMembers,
  getAllTeamMembers,
  createTeamMember,
  updateTeamMember,
  deleteTeamMember,
} = require('../controllers/teamController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Public routes
router.get('/', getTeamMembers);

// Admin routes
router.get('/all', protect, authorize('admin'), getAllTeamMembers);
router.post('/', protect, authorize('admin'), createTeamMember);
router.put('/:id', protect, authorize('admin'), updateTeamMember);
router.delete('/:id', protect, authorize('admin'), deleteTeamMember);

module.exports = router;
