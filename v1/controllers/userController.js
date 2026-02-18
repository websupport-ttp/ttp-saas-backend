// v1/controllers/userController.js
const { StatusCodes } = require('http-status-codes');
const User = require('../models/userModel');
const { ApiError } = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../middleware/asyncHandler');
const { UserRoles, StaffClearanceLevel, StaffClearanceDescription } = require('../utils/constants');

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

  // If changing from Staff to another role, clear staff-specific fields
  if (user.role === UserRoles.STAFF && role !== UserRoles.STAFF) {
    user.staffClearanceLevel = null;
    user.staffDepartment = null;
    user.staffEmployeeId = null;
  }

  user.role = role;
  await user.save();

  ApiResponse.success(res, StatusCodes.OK, 'User role updated successfully', { user });
});

/**
 * @description Make a user a staff member with clearance level (Admin only).
 * @route PUT /api/v1/users/:id/make-staff
 * @access Private/Admin
 */
const makeUserStaff = asyncHandler(async (req, res) => {
  const { clearanceLevel, department, employeeId } = req.body;

  // Validate clearance level
  if (!Object.values(StaffClearanceLevel).includes(clearanceLevel)) {
    throw new ApiError(
      `Invalid clearance level. Must be one of: ${Object.values(StaffClearanceLevel).join(', ')}`,
      StatusCodes.BAD_REQUEST
    );
  }

  const user = await User.findById(req.params.id);

  if (!user) {
    throw new ApiError(`No user with id of ${req.params.id}`, StatusCodes.NOT_FOUND);
  }

  // Check if employeeId is already in use
  if (employeeId) {
    const existingStaff = await User.findOne({ staffEmployeeId: employeeId });
    if (existingStaff && existingStaff._id.toString() !== user._id.toString()) {
      throw new ApiError('Employee ID already in use', StatusCodes.CONFLICT);
    }
  }

  // Update user to staff
  user.role = UserRoles.STAFF;
  user.staffClearanceLevel = clearanceLevel;
  user.staffDepartment = department || null;
  user.staffEmployeeId = employeeId || null;

  await user.save();

  ApiResponse.success(res, StatusCodes.OK, 'User successfully made staff member', {
    user: {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      staffClearanceLevel: user.staffClearanceLevel,
      clearanceDescription: StaffClearanceDescription[user.staffClearanceLevel],
      staffDepartment: user.staffDepartment,
      staffEmployeeId: user.staffEmployeeId,
    },
  });
});

/**
 * @description Update staff clearance level (Admin only).
 * @route PUT /api/v1/users/:id/clearance
 * @access Private/Admin
 */
const updateStaffClearance = asyncHandler(async (req, res) => {
  const { clearanceLevel, department, employeeId } = req.body;

  const user = await User.findById(req.params.id);

  if (!user) {
    throw new ApiError(`No user with id of ${req.params.id}`, StatusCodes.NOT_FOUND);
  }

  if (user.role !== UserRoles.STAFF) {
    throw new ApiError('User is not a staff member', StatusCodes.BAD_REQUEST);
  }

  // Validate clearance level if provided
  if (clearanceLevel !== undefined) {
    if (!Object.values(StaffClearanceLevel).includes(clearanceLevel)) {
      throw new ApiError(
        `Invalid clearance level. Must be one of: ${Object.values(StaffClearanceLevel).join(', ')}`,
        StatusCodes.BAD_REQUEST
      );
    }
    user.staffClearanceLevel = clearanceLevel;
  }

  // Update department if provided
  if (department !== undefined) {
    user.staffDepartment = department;
  }

  // Update employee ID if provided
  if (employeeId !== undefined) {
    // Check if employeeId is already in use
    const existingStaff = await User.findOne({ staffEmployeeId: employeeId });
    if (existingStaff && existingStaff._id.toString() !== user._id.toString()) {
      throw new ApiError('Employee ID already in use', StatusCodes.CONFLICT);
    }
    user.staffEmployeeId = employeeId;
  }

  await user.save();

  ApiResponse.success(res, StatusCodes.OK, 'Staff clearance updated successfully', {
    user: {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      staffClearanceLevel: user.staffClearanceLevel,
      clearanceDescription: StaffClearanceDescription[user.staffClearanceLevel],
      staffDepartment: user.staffDepartment,
      staffEmployeeId: user.staffEmployeeId,
    },
  });
});

/**
 * @description Get all staff members (Admin only).
 * @route GET /api/v1/users/staff
 * @access Private/Admin
 */
const getAllStaff = asyncHandler(async (req, res) => {
  const { clearanceLevel, department } = req.query;

  const query = { role: UserRoles.STAFF };

  if (clearanceLevel) {
    query.staffClearanceLevel = parseInt(clearanceLevel);
  }

  if (department) {
    query.staffDepartment = department;
  }

  const staff = await User.find(query).select('-password').sort({ staffClearanceLevel: -1, createdAt: -1 });

  // Add clearance descriptions
  const staffWithDescriptions = staff.map(member => ({
    ...member.toObject(),
    clearanceDescription: StaffClearanceDescription[member.staffClearanceLevel],
  }));

  ApiResponse.success(res, StatusCodes.OK, 'Staff members fetched successfully', {
    count: staffWithDescriptions.length,
    staff: staffWithDescriptions,
  });
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
  makeUserStaff,
  updateStaffClearance,
  getAllStaff,
  deleteUser,
};