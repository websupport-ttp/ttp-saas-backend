// v1/controllers/teamController.js
const TeamMember = require('../models/teamMemberModel');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Get active team members (public)
// @route   GET /api/v1/team
// @access  Public
exports.getTeamMembers = asyncHandler(async (req, res) => {
  const teamMembers = await TeamMember.find({ isActive: true })
    .sort({ order: 1, createdAt: 1 })
    .select('-createdBy -updatedBy');

  res.status(200).json(
    ApiResponse.success(teamMembers, 'Team members retrieved successfully')
  );
});

// @desc    Get all team members (admin)
// @route   GET /api/v1/team/all
// @access  Private/Admin
exports.getAllTeamMembers = asyncHandler(async (req, res) => {
  const teamMembers = await TeamMember.find()
    .sort({ order: 1, createdAt: 1 })
    .populate('createdBy', 'firstName lastName email')
    .populate('updatedBy', 'firstName lastName email');

  res.status(200).json(
    ApiResponse.success(teamMembers, 'All team members retrieved successfully')
  );
});

// @desc    Create team member
// @route   POST /api/v1/team
// @access  Private/Admin
exports.createTeamMember = asyncHandler(async (req, res) => {
  const { name, role, bio, image, email, linkedin, twitter, order, isActive } = req.body;

  // Validation
  if (!name || !role) {
    throw new ApiError('Name and role are required', 400);
  }

  const teamMember = await TeamMember.create({
    name,
    role,
    bio,
    image,
    email,
    linkedin,
    twitter,
    order: order || 0,
    isActive: isActive !== undefined ? isActive : true,
    createdBy: req.user._id,
    updatedBy: req.user._id,
  });

  res.status(201).json(
    ApiResponse.success(teamMember, 'Team member created successfully')
  );
});

// @desc    Update team member
// @route   PUT /api/v1/team/:id
// @access  Private/Admin
exports.updateTeamMember = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, role, bio, image, email, linkedin, twitter, order, isActive } = req.body;

  const teamMember = await TeamMember.findById(id);

  if (!teamMember) {
    throw new ApiError('Team member not found', 404);
  }

  // Update fields
  if (name !== undefined) teamMember.name = name;
  if (role !== undefined) teamMember.role = role;
  if (bio !== undefined) teamMember.bio = bio;
  if (image !== undefined) teamMember.image = image;
  if (email !== undefined) teamMember.email = email;
  if (linkedin !== undefined) teamMember.linkedin = linkedin;
  if (twitter !== undefined) teamMember.twitter = twitter;
  if (order !== undefined) teamMember.order = order;
  if (isActive !== undefined) teamMember.isActive = isActive;
  
  teamMember.updatedBy = req.user._id;

  await teamMember.save();

  res.status(200).json(
    ApiResponse.success(teamMember, 'Team member updated successfully')
  );
});

// @desc    Delete team member
// @route   DELETE /api/v1/team/:id
// @access  Private/Admin
exports.deleteTeamMember = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const teamMember = await TeamMember.findById(id);

  if (!teamMember) {
    throw new ApiError('Team member not found', 404);
  }

  await teamMember.deleteOne();

  res.status(200).json(
    ApiResponse.success(null, 'Team member deleted successfully')
  );
});
