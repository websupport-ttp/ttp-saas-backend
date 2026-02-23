const User = require('../models/userModel');
const { uploadFile, deleteFile } = require('../services/cloudinaryService');
const asyncHandler = require('../middleware/asyncHandler');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');

/**
 * @desc    Get user profile
 * @route   GET /api/v1/users/profile
 * @access  Private
 */
exports.getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('-password');
  
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  res.status(200).json(ApiResponse.success(user, 'Profile retrieved successfully'));
});

/**
 * @desc    Update user profile
 * @route   PUT /api/v1/users/profile
 * @access  Private
 */
exports.updateProfile = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, phoneNumber } = req.body;

  const user = await User.findById(req.user._id);
  
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Check if email is being changed and if it's already taken
  if (email && email !== user.email) {
    const emailExists = await User.findOne({ email });
    if (emailExists) {
      throw new ApiError(400, 'Email already in use');
    }
  }

  // Update fields
  if (firstName) user.firstName = firstName;
  if (lastName) user.lastName = lastName;
  if (email) user.email = email;
  if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;

  await user.save();

  // Return user without password
  const updatedUser = user.toObject();
  delete updatedUser.password;

  res.status(200).json(ApiResponse.success(updatedUser, 'Profile updated successfully'));
});

/**
 * @desc    Upload profile picture
 * @route   POST /api/v1/users/profile/picture
 * @access  Private
 */
exports.uploadProfilePicture = asyncHandler(async (req, res) => {
  if (!req.files || !req.files.profilePicture) {
    throw new ApiError(400, 'Please upload an image');
  }

  const file = req.files.profilePicture;

  // Validate file type
  if (!file.mimetype.startsWith('image')) {
    throw new ApiError(400, 'Please upload an image file');
  }

  // Validate file size (5MB)
  if (file.size > 5 * 1024 * 1024) {
    throw new ApiError(400, 'Image size must be less than 5MB');
  }

  const user = await User.findById(req.user._id);
  
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  try {
    // Delete old profile picture from Cloudinary if exists
    if (user.profilePicture && user.profilePicture.publicId) {
      await deleteFile(user.profilePicture.publicId);
    }

    // Upload new image to Cloudinary
    const result = await uploadFile(file.tempFilePath, 'profile_pictures', {
      width: 500,
      height: 500,
      crop: 'fill',
      quality: 'auto',
      fetch_format: 'auto'
    });

    // Update user profile picture
    user.profilePicture = {
      url: result.secure_url,
      publicId: result.public_id
    };
    await user.save();

    res.status(200).json(ApiResponse.success(
      { profilePicture: user.profilePicture.url },
      'Profile picture uploaded successfully'
    ));
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new ApiError(500, 'Failed to upload image');
  }
});

/**
 * @desc    Delete profile picture
 * @route   DELETE /api/v1/users/profile/picture
 * @access  Private
 */
exports.deleteProfilePicture = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Delete from Cloudinary if exists
  if (user.profilePicture && user.profilePicture.publicId) {
    try {
      await deleteFile(user.profilePicture.publicId);
    } catch (error) {
      console.error('Cloudinary delete error:', error);
    }
  }

  // Remove profile picture from user
  user.profilePicture = undefined;
  await user.save();

  res.status(200).json(ApiResponse.success(null, 'Profile picture deleted successfully'));
});
