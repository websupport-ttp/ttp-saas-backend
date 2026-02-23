const express = require('express');
const router = express.Router();
const {
  getProfile,
  updateProfile,
  uploadProfilePicture,
  deleteProfilePicture
} = require('../controllers/userProfileController');
const { protect } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(protect);

// Profile routes
router.route('/profile')
  .get(getProfile)
  .put(updateProfile);

// Profile picture routes
router.route('/profile/picture')
  .post(uploadProfilePicture)
  .delete(deleteProfilePicture);

module.exports = router;
