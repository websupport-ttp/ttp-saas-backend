// v1/controllers/vendorAgentApplicationController.js
const VendorAgentApplication = require('../models/vendorAgentApplicationModel');
const User = require('../models/userModel');
const asyncHandler = require('../middleware/asyncHandler');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const { StatusCodes } = require('http-status-codes');
const logger = require('../utils/logger');

/**
 * @desc    Submit vendor or agent application
 * @route   POST /api/v1/vendor-agent-applications
 * @access  Private
 */
exports.submitApplication = asyncHandler(async (req, res) => {
  const {
    applicationType,
    businessName,
    businessEmail,
    businessPhone,
    businessAddress,
    businessRegistrationNumber,
    bankDetails,
  } = req.body;

  // Validate application type
  if (!['Vendor', 'Agent'].includes(applicationType)) {
    throw new ApiError('Invalid application type', StatusCodes.BAD_REQUEST);
  }

  // Check if user already has a pending application
  const existingApplication = await VendorAgentApplication.findOne({
    applicant: req.user._id,
    applicationType,
    status: { $in: ['Pending', 'Under Review'] },
  });

  if (existingApplication) {
    throw new ApiError(
      `You already have a pending ${applicationType.toLowerCase()} application`,
      StatusCodes.CONFLICT
    );
  }

  // Create application
  const application = await VendorAgentApplication.create({
    applicant: req.user._id,
    applicationType,
    businessName,
    businessEmail,
    businessPhone,
    businessAddress,
    businessRegistrationNumber,
    bankDetails,
  });

  logger.logSecurityEvent('VENDOR_AGENT_APPLICATION_SUBMITTED', {
    userId: req.user._id,
    applicationType,
    applicationId: application._id,
  }, 'low');

  return ApiResponse.success(
    res,
    StatusCodes.CREATED,
    `${applicationType} application submitted successfully`,
    { application }
  );
});

/**
 * @desc    Upload application documents
 * @route   POST /api/v1/vendor-agent-applications/:id/upload-documents
 * @access  Private
 */
exports.uploadDocuments = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const application = await VendorAgentApplication.findById(id);

  if (!application) {
    throw new ApiError('Application not found', StatusCodes.NOT_FOUND);
  }

  // Verify ownership
  if (application.applicant.toString() !== req.user._id.toString()) {
    throw new ApiError('Unauthorized', StatusCodes.FORBIDDEN);
  }

  // Check if application is still editable
  if (!['Pending', 'Under Review'].includes(application.status)) {
    throw new ApiError('Cannot upload documents for this application', StatusCodes.BAD_REQUEST);
  }

  // Update documents from request body (documents should be uploaded separately)
  if (req.body.registrationDocument) {
    application.documents.registrationDocument = req.body.registrationDocument;
  }
  if (req.body.identificationDocument) {
    application.documents.identificationDocument = req.body.identificationDocument;
  }
  if (req.body.proofOfAddress) {
    application.documents.proofOfAddress = req.body.proofOfAddress;
  }

  await application.save();

  return ApiResponse.success(
    res,
    StatusCodes.OK,
    'Documents uploaded successfully',
    { application }
  );
});

/**
 * @desc    Get user's applications
 * @route   GET /api/v1/vendor-agent-applications/my-applications
 * @access  Private
 */
exports.getMyApplications = asyncHandler(async (req, res) => {
  const applications = await VendorAgentApplication.find({
    applicant: req.user._id,
  }).sort({ createdAt: -1 });

  return ApiResponse.success(
    res,
    StatusCodes.OK,
    'Applications retrieved successfully',
    {
      count: applications.length,
      applications,
    }
  );
});

/**
 * @desc    Get single application
 * @route   GET /api/v1/vendor-agent-applications/:id
 * @access  Private
 */
exports.getApplication = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const application = await VendorAgentApplication.findById(id)
    .populate('applicant', 'firstName lastName email phoneNumber')
    .populate('reviewedBy', 'firstName lastName email');

  if (!application) {
    throw new ApiError('Application not found', StatusCodes.NOT_FOUND);
  }

  // Verify ownership or staff access
  if (
    application.applicant._id.toString() !== req.user._id.toString() &&
    !req.user.staffDetails?.tier
  ) {
    throw new ApiError('Unauthorized', StatusCodes.FORBIDDEN);
  }

  return ApiResponse.success(
    res,
    StatusCodes.OK,
    'Application retrieved successfully',
    { application }
  );
});

/**
 * @desc    Get all pending applications (Staff/Admin only)
 * @route   GET /api/v1/vendor-agent-applications
 * @access  Private/Staff
 */
exports.getAllApplications = asyncHandler(async (req, res) => {
  const { status, applicationType, page = 1, limit = 10 } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (applicationType) filter.applicationType = applicationType;

  const skip = (page - 1) * limit;

  const applications = await VendorAgentApplication.find(filter)
    .populate('applicant', 'firstName lastName email phoneNumber')
    .populate('reviewedBy', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await VendorAgentApplication.countDocuments(filter);

  return ApiResponse.success(
    res,
    StatusCodes.OK,
    'Applications retrieved successfully',
    {
      count: applications.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      applications,
    }
  );
});

/**
 * @desc    Approve application (Staff/Admin only)
 * @route   PUT /api/v1/vendor-agent-applications/:id/approve
 * @access  Private/Staff
 */
exports.approveApplication = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { commissionRate, approvalNotes } = req.body;

  const application = await VendorAgentApplication.findById(id);

  if (!application) {
    throw new ApiError('Application not found', StatusCodes.NOT_FOUND);
  }

  if (application.status === 'Approved') {
    throw new ApiError('Application already approved', StatusCodes.BAD_REQUEST);
  }

  // Update application
  application.status = 'Approved';
  application.reviewedBy = req.user._id;
  application.reviewedAt = new Date();
  application.commissionRate = commissionRate || (application.applicationType === 'Vendor' ? 15 : 10);
  application.approvalNotes = approvalNotes;

  await application.save();

  // Update user role
  const user = await User.findById(application.applicant);
  if (application.applicationType === 'Vendor') {
    user.role = 'Vendor';
    user.vendorDetails = {
      businessName: application.businessName,
      businessRegistration: application.businessRegistrationNumber,
      bankDetails: application.bankDetails,
      commissionRate: application.commissionRate,
      isApproved: true,
      approvedBy: req.user._id,
      approvedAt: new Date(),
    };
  } else if (application.applicationType === 'Agent') {
    user.role = 'Agent';
    user.agentDetails = {
      agencyName: application.businessName,
      agentCode: `AGT-${Date.now()}`,
      commissionRate: application.commissionRate,
      isApproved: true,
      approvedBy: req.user._id,
      approvedAt: new Date(),
    };
  }

  await user.save();

  logger.logSecurityEvent('VENDOR_AGENT_APPLICATION_APPROVED', {
    applicationId: id,
    applicationType: application.applicationType,
    userId: application.applicant,
    approvedBy: req.user._id,
  }, 'medium');

  return ApiResponse.success(
    res,
    StatusCodes.OK,
    `${application.applicationType} application approved successfully`,
    { application }
  );
});

/**
 * @desc    Reject application (Staff/Admin only)
 * @route   PUT /api/v1/vendor-agent-applications/:id/reject
 * @access  Private/Staff
 */
exports.rejectApplication = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rejectionReason } = req.body;

  if (!rejectionReason) {
    throw new ApiError('Rejection reason is required', StatusCodes.BAD_REQUEST);
  }

  const application = await VendorAgentApplication.findById(id);

  if (!application) {
    throw new ApiError('Application not found', StatusCodes.NOT_FOUND);
  }

  if (application.status === 'Rejected') {
    throw new ApiError('Application already rejected', StatusCodes.BAD_REQUEST);
  }

  // Update application
  application.status = 'Rejected';
  application.reviewedBy = req.user._id;
  application.reviewedAt = new Date();
  application.rejectionReason = rejectionReason;

  await application.save();

  logger.logSecurityEvent('VENDOR_AGENT_APPLICATION_REJECTED', {
    applicationId: id,
    applicationType: application.applicationType,
    userId: application.applicant,
    rejectedBy: req.user._id,
  }, 'medium');

  return ApiResponse.success(
    res,
    StatusCodes.OK,
    `${application.applicationType} application rejected`,
    { application }
  );
});
