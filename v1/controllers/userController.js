// v1/controllers/userController.js
const { StatusCodes } = require('http-status-codes');
const User = require('../models/userModel');
const { ApiError } = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @description Get current logged in user profile.
 * @route GET /api/v1/users/me
 * @access Private
 */
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.userId).select('-password'); // Exclude password

  if (!user) {
    throw new ApiError('User not found', StatusCodes.NOT_FOUND);
  }

  ApiResponse.success(res, StatusCodes.OK, 'User profile fetched successfully', { user });
});

/**
 * @description Update current logged in user profile.
 * @route PUT /api/v1/users/me
 * @access Private
 */
const updateMe = asyncHandler(async (req, res) => {
  const { firstName, lastName, otherNames, email, phoneNumber } = req.body;

  const user = await User.findById(req.user.userId);

  if (!user) {
    throw new ApiError('User not found', StatusCodes.NOT_FOUND);
  }

  // Prevent updating sensitive fields like role or googleId here
  user.firstName = firstName || user.firstName;
  user.lastName = lastName || user.lastName;
  user.otherNames = otherNames || user.otherNames;

  // Handle email update: if changed, mark as unverified
  if (email && user.email !== email) {
    const existingEmailUser = await User.findOne({ email });
    if (existingEmailUser && existingEmailUser._id.toString() !== user._id.toString()) {
      throw new ApiError('Email already in use by another account', StatusCodes.CONFLICT);
    }
    user.email = email;
    user.isEmailVerified = false; // Mark as unverified
    // TODO: Send new verification email
  }

  // Handle phone number update: if changed, mark as unverified
  if (phoneNumber && user.phoneNumber !== phoneNumber) {
    const existingPhoneUser = await User.findOne({ phoneNumber });
    if (existingPhoneUser && existingPhoneUser._id.toString() !== user._id.toString()) {
      throw new ApiError('Phone number already in use by another account', StatusCodes.CONFLICT);
    }
    user.phoneNumber = phoneNumber;
    user.isPhoneVerified = false; // Mark as unverified
    // TODO: Send new verification OTP
  }

  await user.save();

  ApiResponse.success(res, StatusCodes.OK, 'User profile updated successfully', {
    user: {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
    },
  });
});

/**
 * @description Get all users (Admin only).
 * @route GET /api/v1/users
 * @access Private/Admin
 */
const getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.find({}).select('-password');
  ApiResponse.success(res, StatusCodes.OK, 'Users fetched successfully', { count: users.length, users });
});

/**
 * @description Get a single user by ID (Admin only).
 * @route GET /api/v1/users/:id
 * @access Private/Admin
 */
const getSingleUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');

  if (!user) {
    throw new ApiError(`No user with id of ${req.params.id}`, StatusCodes.NOT_FOUND);
  }

  ApiResponse.success(res, StatusCodes.OK, 'User fetched successfully', { user });
});

/**
 * @description Update user role (Admin only).
 * @route PUT /api/v1/users/:id/role
 * @access Private/Admin
 */
const updateUserRole = asyncHandler(async (req, res) => {
  const { role } = req.body;

  if (!Object.values(UserRoles).includes(role)) {
    throw new ApiError('Invalid role provided', StatusCodes.BAD_REQUEST);
  }

  const user = await User.findById(req.params.id);

  if (!user) {
    throw new ApiError(`No user with id of ${req.params.id}`, StatusCodes.NOT_FOUND);
  }

  user.role = role;
  await user.save();

  ApiResponse.success(res, StatusCodes.OK, 'User role updated successfully', { user });
});

/**
 * @description Delete a user (Admin only).
 * @route DELETE /api/v1/users/:id
 * @access Private/Admin
 */
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    throw new ApiError(`No user with id of ${req.params.id}`, StatusCodes.NOT_FOUND);
  }

  await user.deleteOne(); // Use deleteOne() for Mongoose 6+

  ApiResponse.success(res, StatusCodes.OK, 'User deleted successfully');
});

module.exports = {
  getMe,
  updateMe,
  getAllUsers,
  getSingleUser,
  updateUserRole,
  deleteUser,
};