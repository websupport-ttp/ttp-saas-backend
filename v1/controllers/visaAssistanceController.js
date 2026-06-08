// v1/controllers/visaAssistanceController.js
const asyncHandler = require('../middleware/asyncHandler');
const VisaApplication = require('../models/visaApplicationModel');
const VisaPrice = require('../models/visaPriceModel');
const NotificationQueue = require('../models/notificationQueueModel');
const { StatusCodes } = require('http-status-codes');
const ApiResponse = require('../utils/apiResponse');
const { ApiError } = require('../utils/apiError');
const { sendEmail } = require('../utils/emailService');
const logger = require('../utils/logger');

// ─── PRICE INVENTORY (Public) ─────────────────────────────────────────────────

/**
 * @desc    Get all active visa destination prices (client-facing)
 * @route   GET /api/v1/visa-assistance/prices
 * @access  Public
 */
const getVisaPrices = asyncHandler(async (req, res) => {
  const prices = await VisaPrice.find({ isActive: true })
    .select('-updatedBy -createdAt -updatedAt')
    .sort({ isOthers: 1, sortOrder: 1, country: 1 })
    .lean();

  ApiResponse.success(res, StatusCodes.OK, 'Visa prices retrieved successfully', {
    count: prices.length,
    prices,
  });
});

/**
 * @desc    Get price for a specific country and visa type
 * @route   GET /api/v1/visa-assistance/prices/:country/:visaType
 * @access  Public
 */
const getVisaPrice = asyncHandler(async (req, res) => {
  const { country, visaType } = req.params;

  const entry = await VisaPrice.findOne({
    country: { $regex: new RegExp(`^${country}$`, 'i') },
    isActive: true,
  }).lean();

  if (!entry) {
    // Return "Others" pricing instead of 404
    const others = await VisaPrice.findOne({ isOthers: true, isActive: true }).lean();
    return ApiResponse.success(res, StatusCodes.OK, 'Country not listed — Others pricing returned', {
      isOthers: true,
      entry: others,
    });
  }

  const typeEntry = entry.visaTypes.find(
    v => v.type.toLowerCase() === visaType.toLowerCase() && v.isAvailable
  );

  if (!typeEntry) {
    throw new ApiError(`Visa type "${visaType}" is not available for ${country}`, StatusCodes.NOT_FOUND);
  }

  ApiResponse.success(res, StatusCodes.OK, 'Visa price retrieved', {
    country: entry.country,
    countryCode: entry.countryCode,
    visaType: typeEntry.type,
    price: typeEntry.price,
    currency: typeEntry.currency,
    processingTime: typeEntry.processingTime,
    description: typeEntry.description,
  });
});

// ─── PRICE INVENTORY (Admin) ──────────────────────────────────────────────────

/**
 * @desc    Get all visa prices including inactive (admin)
 * @route   GET /api/v1/visa-assistance/admin/prices
 * @access  Private (Staff/Admin)
 */
const getAllVisaPricesAdmin = asyncHandler(async (req, res) => {
  const prices = await VisaPrice.find()
    .populate('updatedBy', 'firstName lastName')
    .sort({ isOthers: 1, sortOrder: 1, country: 1 })
    .lean();

  ApiResponse.success(res, StatusCodes.OK, 'All visa prices retrieved', { count: prices.length, prices });
});

/**
 * @desc    Create a visa price entry
 * @route   POST /api/v1/visa-assistance/admin/prices
 * @access  Private (Staff/Admin)
 */
const createVisaPrice = asyncHandler(async (req, res) => {
  const { country, countryCode, visaTypes, isActive, sortOrder, isOthers } = req.body;

  if (!country || !visaTypes?.length) {
    throw new ApiError('Country and at least one visa type are required', StatusCodes.BAD_REQUEST);
  }

  const existing = await VisaPrice.findOne({ country: { $regex: new RegExp(`^${country}$`, 'i') } });
  if (existing) {
    throw new ApiError(`Price entry for "${country}" already exists`, StatusCodes.CONFLICT);
  }

  const entry = await VisaPrice.create({
    country,
    countryCode: countryCode || 'XX',
    visaTypes,
    isActive: isActive !== undefined ? isActive : true,
    sortOrder: sortOrder || 100,
    isOthers: isOthers || false,
    updatedBy: req.user.userId,
  });

  logger.info(`Visa price created for ${country} by ${req.user.userId}`);
  ApiResponse.success(res, StatusCodes.CREATED, 'Visa price entry created', entry);
});

/**
 * @desc    Update a visa price entry
 * @route   PUT /api/v1/visa-assistance/admin/prices/:id
 * @access  Private (Staff/Admin)
 */
const updateVisaPrice = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = { ...req.body, updatedBy: req.user.userId };

  const entry = await VisaPrice.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
  if (!entry) throw new ApiError('Visa price entry not found', StatusCodes.NOT_FOUND);

  logger.info(`Visa price updated for ${entry.country} by ${req.user.userId}`);
  ApiResponse.success(res, StatusCodes.OK, 'Visa price entry updated', entry);
});

/**
 * @desc    Delete a visa price entry
 * @route   DELETE /api/v1/visa-assistance/admin/prices/:id
 * @access  Private (Admin only)
 */
const deleteVisaPrice = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const entry = await VisaPrice.findByIdAndDelete(id);
  if (!entry) throw new ApiError('Visa price entry not found', StatusCodes.NOT_FOUND);

  logger.info(`Visa price deleted for ${entry.country} by ${req.user.userId}`);
  ApiResponse.success(res, StatusCodes.OK, 'Visa price entry deleted');
});

// ─── CLIENT APPLICATION FLOW ──────────────────────────────────────────────────

/**
 * @desc    Submit a visa assistance application
 *          Client picks country → selects visa type → fills details → sees price → submits
 * @route   POST /api/v1/visa-assistance/apply
 * @access  Public (guest or logged-in)
 */
const submitApplication = asyncHandler(async (req, res) => {
  const {
    destinationCountry,
    visaType,
    fullName,
    email,
    phone,
    nationality,
    travelPurpose,
    travelDates,
    passportNumber,
    passportExpiry,
    dateOfBirth,
    isOthersRequest,   // true when client selects "Others"
    otherCountryNote,  // free-text country name when "Others" is selected
  } = req.body;

  if (!destinationCountry || !visaType || !email || !phone || !fullName) {
    throw new ApiError('Destination country, visa type, full name, email and phone are required', StatusCodes.BAD_REQUEST);
  }

  // Look up pricing
  let feeTotal = 0;
  let processingTime = 'To be confirmed';
  let requiresManualPricing = false;

  if (isOthersRequest) {
    requiresManualPricing = true;
    processingTime = 'To be confirmed — our team will reach out';
  } else {
    const priceEntry = await VisaPrice.findOne({
      country: { $regex: new RegExp(`^${destinationCountry}$`, 'i') },
      isActive: true,
    }).lean();

    if (priceEntry) {
      const typeEntry = priceEntry.visaTypes.find(
        v => v.type.toLowerCase() === visaType.toLowerCase() && v.isAvailable
      );
      if (typeEntry) {
        feeTotal = typeEntry.price;
        processingTime = typeEntry.processingTime;
      }
    } else {
      // Country exists in request but not in our inventory — treat as Others
      requiresManualPricing = true;
      processingTime = 'To be confirmed — our team will reach out';
    }
  }

  // Create the application
  const nameParts = fullName.trim().split(' ');
  const application = await VisaApplication.create({
    guestEmail: req.user ? undefined : email,
    guestPhoneNumber: req.user ? undefined : phone,
    userId: req.user ? req.user.userId : undefined,
    destinationCountry: isOthersRequest ? (otherCountryNote || 'Others') : destinationCountry,
    visaType,
    travelPurpose: travelPurpose || 'Tourism',
    travelDates: travelDates || {},
    personalInformation: {
      firstName: nameParts[0],
      lastName: nameParts.slice(1).join(' ') || nameParts[0],
      nationality: nationality || '',
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
    },
    passportDetails: {
      passportNumber: passportNumber || '',
      expiryDate: passportExpiry ? new Date(passportExpiry) : undefined,
    },
    fees: {
      serviceFee: feeTotal,
      total: feeTotal,
    },
    paymentStatus: feeTotal > 0 ? 'Pending' : 'Pending',
    status: 'Pending',
  });

  // Notify visa officers via NotificationQueue
  await NotificationQueue.create({
    type: 'Visa Request',
    priority: requiresManualPricing ? 'High' : 'Medium',
    title: `New Visa Application — ${application.destinationCountry} (${visaType})`,
    description: requiresManualPricing
      ? `UNLISTED COUNTRY: ${application.destinationCountry}. Client: ${fullName} (${email}). Contact required.`
      : `Client: ${fullName} (${email}). Fee: ₦${feeTotal.toLocaleString()}`,
    relatedEntity: { entityType: 'VisaApplication', entityId: application._id },
    status: 'Pending',
    metadata: { email, phone, destinationCountry: application.destinationCountry, visaType, requiresManualPricing },
  });

  // Send confirmation email to client
  try {
    await sendEmail({
      to: email,
      subject: `Visa Application Received — ${application.destinationCountry}`,
      html: `
        <h3>Hi ${nameParts[0]},</h3>
        <p>We've received your visa assistance request for <strong>${application.destinationCountry} (${visaType})</strong>.</p>
        <p><strong>Reference:</strong> ${application.applicationReference}</p>
        ${feeTotal > 0
          ? `<p><strong>Our service fee:</strong> ₦${feeTotal.toLocaleString()} — our team will send you a payment link shortly.</p>`
          : '<p>Our team will review your request and contact you with pricing shortly.</p>'
        }
        <p><strong>Estimated processing time:</strong> ${processingTime}</p>
        <p>We'll be in touch soon. Please keep this reference number safe.</p>
        <p>— The Travel Place Visa Team</p>
      `,
    });
  } catch (emailErr) {
    logger.warn(`Failed to send visa confirmation email to ${email}:`, emailErr.message);
  }

  ApiResponse.success(res, StatusCodes.CREATED, 'Visa application submitted successfully', {
    applicationReference: application.applicationReference,
    destinationCountry: application.destinationCountry,
    visaType,
    fee: feeTotal,
    currency: 'NGN',
    processingTime,
    requiresManualPricing,
    message: requiresManualPricing
      ? 'Our team will contact you with pricing for this destination.'
      : 'A payment link will be sent to your email shortly.',
  });
});

/**
 * @desc    Get application by reference (client tracking)
 * @route   GET /api/v1/visa-assistance/track/:reference
 * @access  Public
 */
const trackApplication = asyncHandler(async (req, res) => {
  const { reference } = req.params;

  const application = await VisaApplication.findOne({ applicationReference: reference })
    .populate('assignedOfficer', 'firstName lastName')
    .select('-documents -statusHistory -followUpHistory')
    .lean();

  if (!application) throw new ApiError('Application not found', StatusCodes.NOT_FOUND);

  ApiResponse.success(res, StatusCodes.OK, 'Application retrieved', {
    reference: application.applicationReference,
    status: application.status,
    paymentStatus: application.paymentStatus,
    destinationCountry: application.destinationCountry,
    visaType: application.visaType,
    fee: application.fees.total,
    assignedOfficer: application.assignedOfficer
      ? `${application.assignedOfficer.firstName} ${application.assignedOfficer.lastName}`
      : null,
    createdAt: application.createdAt,
  });
});

// ─── OFFICER DASHBOARD ────────────────────────────────────────────────────────

/**
 * @desc    Get all applications (officer/admin view with filters)
 * @route   GET /api/v1/visa-assistance/officer/applications
 * @access  Private (Staff/Admin)
 */
const getOfficerApplications = asyncHandler(async (req, res) => {
  const { status, paymentStatus, assignedToMe, page = 1, limit = 20 } = req.query;
  const query = {};

  if (status) query.status = status;
  if (paymentStatus) query.paymentStatus = paymentStatus;
  if (assignedToMe === 'true') query.assignedOfficer = req.user.userId;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [applications, total] = await Promise.all([
    VisaApplication.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('assignedOfficer', 'firstName lastName')
      .select('-documents')
      .lean(),
    VisaApplication.countDocuments(query),
  ]);

  ApiResponse.success(res, StatusCodes.OK, 'Applications retrieved', {
    total,
    page: parseInt(page),
    pages: Math.ceil(total / parseInt(limit)),
    applications,
  });
});

/**
 * @desc    Get single application (full details for officer)
 * @route   GET /api/v1/visa-assistance/officer/applications/:id
 * @access  Private (Staff/Admin)
 */
const getApplicationDetails = asyncHandler(async (req, res) => {
  const application = await VisaApplication.findById(req.params.id)
    .populate('assignedOfficer', 'firstName lastName email')
    .populate('paymentLink');

  if (!application) throw new ApiError('Application not found', StatusCodes.NOT_FOUND);
  ApiResponse.success(res, StatusCodes.OK, 'Application retrieved', application);
});

/**
 * @desc    Assign application to visa officer
 * @route   PUT /api/v1/visa-assistance/officer/applications/:id/assign
 * @access  Private (Staff/Admin)
 */
const assignApplication = asyncHandler(async (req, res) => {
  const { officerId } = req.body;
  const application = await VisaApplication.findById(req.params.id);
  if (!application) throw new ApiError('Application not found', StatusCodes.NOT_FOUND);

  application.assignedOfficer = officerId;
  application.assignedAt = new Date();
  await application.save();

  await NotificationQueue.updateOne(
    { 'relatedEntity.entityType': 'VisaApplication', 'relatedEntity.entityId': application._id },
    { assignedTo: officerId, assignedBy: req.user.userId, assignedAt: new Date(), status: 'Assigned' }
  );

  ApiResponse.success(res, StatusCodes.OK, 'Application assigned', application);
});

/**
 * @desc    Update application status
 * @route   PUT /api/v1/visa-assistance/officer/applications/:id/status
 * @access  Private (Staff/Admin)
 */
const updateApplicationStatus = asyncHandler(async (req, res) => {
  const { status, notes } = req.body;
  const application = await VisaApplication.findById(req.params.id);
  if (!application) throw new ApiError('Application not found', StatusCodes.NOT_FOUND);

  application.statusHistory.push({ status, updatedBy: req.user.userId, updatedAt: new Date(), notes });
  application.status = status;
  await application.save();

  ApiResponse.success(res, StatusCodes.OK, 'Status updated', application);
});

/**
 * @desc    Add follow-up note
 * @route   POST /api/v1/visa-assistance/officer/applications/:id/follow-up
 * @access  Private (Staff/Admin)
 */
const addFollowUpNote = asyncHandler(async (req, res) => {
  const { note, contactMethod, nextAction, nextActionDate } = req.body;
  const application = await VisaApplication.findById(req.params.id);
  if (!application) throw new ApiError('Application not found', StatusCodes.NOT_FOUND);

  application.followUpHistory.push({
    note, contactMethod, nextAction, nextActionDate,
    addedBy: req.user.userId, contactedAt: new Date(),
  });
  await application.save();

  ApiResponse.success(res, StatusCodes.OK, 'Follow-up note added', application);
});

/**
 * @desc    Generate and send payment link to client
 * @route   POST /api/v1/visa-assistance/officer/applications/:id/payment-link
 * @access  Private (Staff/Admin)
 */
const generateApplicationPaymentLink = asyncHandler(async (req, res) => {
  const { amount, description, dueDate } = req.body;
  const application = await VisaApplication.findById(req.params.id);
  if (!application) throw new ApiError('Application not found', StatusCodes.NOT_FOUND);

  const { generatePaymentLink, sendPaymentLinkEmail } = require('../services/paymentLinkService');

  const paymentLink = await generatePaymentLink({
    applicationId: application._id,
    applicationType: 'VisaApplication',
    amount,
    customerEmail: application.guestEmail,
    customerPhone: application.guestPhoneNumber,
    description: description || `Visa Assistance — ${application.destinationCountry}`,
    dueDate,
    createdBy: req.user.userId,
    metadata: {
      applicationReference: application.applicationReference,
      destinationCountry: application.destinationCountry,
      visaType: application.visaType,
    },
  });

  application.paymentLink = paymentLink._id;
  application.fees.total = amount;
  await application.save();

  await sendPaymentLinkEmail(paymentLink._id);

  ApiResponse.success(res, StatusCodes.CREATED, 'Payment link generated and sent', {
    url: paymentLink.paystackPageUrl,
    amount: paymentLink.amount,
    expiresAt: paymentLink.expiresAt,
  });
});

module.exports = {
  // Price inventory — public
  getVisaPrices,
  getVisaPrice,
  // Price inventory — admin
  getAllVisaPricesAdmin,
  createVisaPrice,
  updateVisaPrice,
  deleteVisaPrice,
  // Client flow
  submitApplication,
  trackApplication,
  // Officer dashboard
  getOfficerApplications,
  getApplicationDetails,
  assignApplication,
  updateApplicationStatus,
  addFollowUpNote,
  generateApplicationPaymentLink,
};
