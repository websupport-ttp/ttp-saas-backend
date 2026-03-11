// v1/controllers/siteSettingsController.js
const SiteSettings = require('../models/siteSettingsModel');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Get site settings
// @route   GET /api/v1/settings
// @access  Public
exports.getSiteSettings = asyncHandler(async (req, res) => {
  const settings = await SiteSettings.getSettings();
  
  return ApiResponse.success(res, 200, 'Site settings retrieved successfully', settings);
});

// @desc    Update site settings
// @route   PUT /api/v1/settings
// @access  Private/Admin
exports.updateSiteSettings = asyncHandler(async (req, res) => {
  const {
    phone,
    phoneDescription,
    email,
    emailDescription,
    address,
    addressDescription,
    tagline,
    foundedYear,
    companyName,
    socialLinks,
  } = req.body;

  const updates = {};
  
  if (phone !== undefined) updates.phone = phone;
  if (phoneDescription !== undefined) updates.phoneDescription = phoneDescription;
  if (email !== undefined) updates.email = email;
  if (emailDescription !== undefined) updates.emailDescription = emailDescription;
  if (address !== undefined) updates.address = address;
  if (addressDescription !== undefined) updates.addressDescription = addressDescription;
  if (tagline !== undefined) updates.tagline = tagline;
  if (foundedYear !== undefined) updates.foundedYear = foundedYear;
  if (companyName !== undefined) updates.companyName = companyName;
  if (socialLinks !== undefined) updates.socialLinks = socialLinks;

  const settings = await SiteSettings.updateSettings(updates, req.user._id);

  return ApiResponse.success(res, 200, 'Site settings updated successfully', settings);
});
