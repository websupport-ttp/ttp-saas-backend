// v1/controllers/visaAssistanceController.js
const asyncHandler = require('../middleware/asyncHandler');
const VisaApplication = require('../models/visaApplicationModel');
const NotificationQueue = require('../models/notificationQueueModel');
const { generatePaymentLink, sendPaymentLinkEmail } = require('../services/paymentLinkService');
const { StatusCodes } = require('http-status-codes');
const ApiResponse = require('../utils/apiResponse');
const { ApiError } = require('../utils/apiError');

/**
 * @desc    Create initial visa assistance request (from landing page)
 * @route   POST /api/v1/visa-assistance/request
 * @access  Public
 */
const createVisaRequest = asyncHandler(async (req, res) => {
  const {
    destinationCountry,
    visaType,
    travelDates,
    email,
    phone,
    fullName,
    nationality,
    travelPurpose,
    urgency
  } = req.body;

  // Create basic visa application
  const application = await VisaApplication.create({
    guestEmail: email,
    guestPhoneNumber: phone,
    destinationCountry,
    visaType,
    travelDates,
    travelPurpose: travelPurpose || 'Tourism',
    urgency: urgency || 'Standard',
    personalInformation: {
      firstName: fullName?.split(' ')[0],
      lastName: fullName?.split(' ').slice(1).join(' '),
    },
    status: 'Pending'
  });

  // Create notification for visa officers
  await NotificationQueue.create({
    type: 'Visa Request',
    priority: urgency === 'Super Express' ? 'Urgent' : urgency === 'Express' ? 'High' : 'Medium',
    title: `New Visa Application - ${destinationCountry}`,
    description: `New visa assistance request for ${destinationCountry} (${visaType})`,
    relatedEntity: {
      entityType: 'VisaApplication',
      entityId: application._id
    },
    status: 'Pending',
    metadata: {
      email,
      phone,
      destinationCountry,
      visaType
    }
  });

  ApiResponse.success(res, StatusCodes.CREATED, 'Visa assistance request created successfully', {
    applicationReference: application.applicationReference,
    redirectUrl: `/visa-assistance/apply/${application.applicationReference}`
  });
});

/**
 * @desc    Submit detailed visa application
 * @route   POST /api/v1/visa-assistance/applications
 * @access  Public
 */
const submitVisaApplication = asyncHandler(async (req, res) => {
  const {
    applicationReference,
    personalInformation,
    passportDetails,
    travelDates,
    documents
  } = req.body;

  const application = await VisaApplication.findOne({ applicationReference });

  if (!application) {
    throw new ApiError('Application not found', StatusCodes.NOT_FOUND);
  }

  // Update application with detailed information
  application.personalInformation = { ...application.personalInformation, ...personalInformation };
  application.passportDetails = passportDetails;
  application.travelDates = travelDates;
  application.documents = documents || [];
  application.status = 'Under Review';

  await application.save();

  ApiResponse.success(res, StatusCodes.OK, 'Application submitted successfully', {
    applicationReference: application.applicationReference,
    status: application.status
  });
});

/**
 * @desc    Get visa application by reference
 * @route   GET /api/v1/visa-assistance/applications/:reference
 * @access  Public
 */
const getApplicationByReference = asyncHandler(async (req, res) => {
  const { reference } = req.params;

  const application = await VisaApplication.findOne({ applicationReference: reference })
    .populate('assignedOfficer', 'firstName lastName email')
    .populate('paymentLink');

  if (!application) {
    throw new ApiError('Application not found', StatusCodes.NOT_FOUND);
  }

  ApiResponse.success(res, StatusCodes.OK, 'Application retrieved successfully', application);
});

/**
 * @desc    Get assigned visa applications (for visa officers)
 * @route   GET /api/v1/visa-assistance/officer/applications
 * @access  Private (Visa Officer only)
 */
const getOfficerApplications = asyncHandler(async (req, res) => {
  const { status, urgency } = req.query;
  const officerId = req.user._id;

  const query = { assignedOfficer: officerId };
  
  if (status) query.status = status;
  if (urgency) query.urgency = urgency;

  const applications = await VisaApplication.find(query)
    .sort({ createdAt: -1 })
    .populate('paymentLink')
    .select('-documents'); // Exclude documents for list view

  ApiResponse.success(res, StatusCodes.OK, 'Applications retrieved successfully', {
    count: applications.length,
    applications
  });
});

/**
 * @desc    Add follow-up note to application
 * @route   POST /api/v1/visa-assistance/applications/:id/follow-up
 * @access  Private (Visa Officer only)
 */
const addFollowUpNote = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { note, contactMethod, nextAction, nextActionDate } = req.body;

  const application = await VisaApplication.findById(id);

  if (!application) {
    throw new ApiError('Application not found', StatusCodes.NOT_FOUND);
  }

  application.followUpHistory.push({
    note,
    contactMethod,
    nextAction,
    nextActionDate,
    addedBy: req.user._id,
    contactedAt: new Date()
  });

  await application.save();

  ApiResponse.success(res, StatusCodes.OK, 'Follow-up note added successfully', application);
});

/**
 * @desc    Generate payment link for visa application
 * @route   POST /api/v1/visa-assistance/applications/:id/generate-payment-link
 * @access  Private (Visa Officer only)
 */
const generateApplicationPaymentLink = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { amount, description, dueDate } = req.body;

  const application = await VisaApplication.findById(id);

  if (!application) {
    throw new ApiError('Application not found', StatusCodes.NOT_FOUND);
  }

  // Generate payment link
  const paymentLink = await generatePaymentLink({
    applicationId: application._id,
    applicationType: 'VisaApplication',
    amount,
    customerEmail: application.guestEmail || application.userId?.email,
    customerPhone: application.guestPhoneNumber || application.userId?.phoneNumber,
    description: description || `Visa Application Payment - ${application.destinationCountry}`,
    dueDate,
    createdBy: req.user._id,
    metadata: {
      applicationReference: application.applicationReference,
      destinationCountry: application.destinationCountry,
      visaType: application.visaType
    }
  });

  // Update application
  application.paymentLink = paymentLink._id;
  application.fees.total = amount;
  await application.save();

  // Send payment link email
  await sendPaymentLinkEmail(paymentLink._id);

  ApiResponse.success(res, StatusCodes.CREATED, 'Payment link generated and sent successfully', {
    paymentLink: {
      id: paymentLink._id,
      url: paymentLink.paystackPageUrl,
      amount: paymentLink.amount,
      expiresAt: paymentLink.expiresAt
    }
  });
});

/**
 * @desc    Update application status
 * @route   PUT /api/v1/visa-assistance/applications/:id/status
 * @access  Private (Visa Officer only)
 */
const updateApplicationStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  const application = await VisaApplication.findById(id);

  if (!application) {
    throw new ApiError('Application not found', StatusCodes.NOT_FOUND);
  }

  // Add to status history
  application.statusHistory.push({
    status,
    updatedBy: req.user._id,
    updatedAt: new Date(),
    notes
  });

  application.status = status;
  await application.save();

  ApiResponse.success(res, StatusCodes.OK, 'Application status updated successfully', application);
});

/**
 * @desc    Assign application to visa officer
 * @route   PUT /api/v1/visa-assistance/applications/:id/assign
 * @access  Private (Head of Operations only)
 */
const assignApplication = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { officerId } = req.body;

  const application = await VisaApplication.findById(id);

  if (!application) {
    throw new ApiError('Application not found', StatusCodes.NOT_FOUND);
  }

  application.assignedOfficer = officerId;
  application.assignedAt = new Date();
  await application.save();

  // Update notification queue
  await NotificationQueue.updateOne(
    {
      'relatedEntity.entityType': 'VisaApplication',
      'relatedEntity.entityId': application._id
    },
    {
      assignedTo: officerId,
      assignedBy: req.user._id,
      assignedAt: new Date(),
      status: 'Assigned'
    }
  );

  ApiResponse.success(res, StatusCodes.OK, 'Application assigned successfully', application);
});

module.exports = {
  createVisaRequest,
  submitVisaApplication,
  getApplicationByReference,
  getOfficerApplications,
  addFollowUpNote,
  generateApplicationPaymentLink,
  updateApplicationStatus,
  assignApplication
};
