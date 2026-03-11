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
const { authenticateUser, authorizeRoles } = require('../middleware/authMiddleware');

// Public routes
router.get('/', getTeamMembers);

// Admin routes
router.get('/all', authenticateUser, authorizeRoles('admin'), getAllTeamMembers);
router.post('/', authenticateUser, authorizeRoles('admin'), createTeamMember);
router.put('/:id', authenticateUser, authorizeRoles('admin'), updateTeamMember);
router.delete('/:id', authenticateUser, authorizeRoles('admin'), deleteTeamMember);

module.exports = router;
