// v1/controllers/productController.js
const { StatusCodes } = require('http-status-codes');
const { ApiError } = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../middleware/asyncHandler');
const redisClient = require('../config/redis');
const logger = require('../utils/logger');
const { serviceChargeEnum } = require('../utils/constants');
const Post = require('../models/postModel');
const Ledger = require('../models/ledgerModel');
const paystackService = require('../services/paystackService');
const Queue = require('bull');
const mongoose = require('mongoose');
const fs = require('fs');

// Import visa processing dependencies
const VisaApplication = require('../models/visaApplicationModel');
const cloudinary = require('cloudinary').v2;

// Environment variable validation
const validateEnvironmentVariables = () => {
  const requiredVars = ['REDIS_URL', 'MONGO_URI'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    if (process.env.NODE_ENV !== 'test') {
      logger.warn(`Missing environment variables: ${missingVars.join(', ')}`);
    }
    return false;
  }
  return true;
};

// Initialize notification queues with error handling
let emailQueue, smsQueue, whatsappQueue;

if (validateEnvironmentVariables() && process.env.REDIS_URL) {
  try {
    emailQueue = new Queue('emailQueue', process.env.REDIS_URL);
    smsQueue = new Queue('smsQueue', process.env.REDIS_URL);
    whatsappQueue = new Queue('whatsappQueue', process.env.REDIS_URL);
    
    // Add error handlers for queues
    [emailQueue, smsQueue, whatsappQueue].forEach(queue => {
      queue.on('error', (error) => {
        logger.error(`Queue error for ${queue.name}:`, error.message);
      });
      
      queue.on('failed', (job, err) => {
        logger.error(`Queue job failed for ${queue.name}:`, err.message);
      });
    });
    
    logger.info('Notification queues initialized successfully');
    
  } catch (error) {
    logger.error('Failed to initialize notification queues:', error.message);
    logger.warn('Notification queues will be disabled. Messages will be sent directly.');
    
    // Set queues to null to indicate they're not available
    emailQueue = null;
    smsQueue = null;
    whatsappQueue = null;
  }
} else {
  logger.warn('Redis URL not configured. Notification queues will be disabled.');
  emailQueue = null;
  smsQueue = null;
  whatsappQueue = null;
}

// --- Service Charge Management (Admin Only) ---

/**
 * @description Get all service charges from Redis.
 * @route GET /api/v1/products/service-charges
 * @access Private/Admin
 */
const getServiceCharges = asyncHandler(async (req, res) => {
  const serviceCharges = await redisClient.hGetAll('serviceCharges');
  ApiResponse.success(res, StatusCodes.OK, 'Service charges fetched successfully', { serviceCharges });
});

/**
 * @description Update a specific service charge in Redis.
 * @route PUT /api/v1/products/service-charges/:chargeName
 * @access Private/Admin
 */
const updateServiceCharge = asyncHandler(async (req, res) => {
  const { chargeName } = req.params;
  const { value } = req.body;

  if (!chargeName || !value || isNaN(value)) {
    throw new ApiError('Invalid charge name or value provided', StatusCodes.BAD_REQUEST);
  }

  // Ensure the chargeName is one of the predefined enums (case-insensitive check)
  const validChargeKey = Object.keys(serviceChargeEnum).find(key =>
    key.replace(/([A-Z])/g, '_$1').toUpperCase() === chargeName.toUpperCase()
  );

  if (!validChargeKey) {
    throw new ApiError(`Invalid service charge name: ${chargeName}`, StatusCodes.BAD_REQUEST);
  }

  const field = validChargeKey.replace(/([A-Z])/g, '_$1').toUpperCase(); // Convert to SNAKE_CASE for Redis

  await redisClient.hSet('serviceCharges', field, value);
  logger.info(`Service charge updated in Redis: ${field} = ${value}`);

  const updatedServiceCharges = await redisClient.hGetAll('serviceCharges');
  ApiResponse.success(res, StatusCodes.OK, `Service charge '${chargeName}' updated successfully`, { updatedServiceCharges });
});

// --- Allianz Travel Insurance Integration (Placeholder) ---

/**
 * @description Get Allianz Travel Insurance lookup data (e.g., countries, travel plans).
 * @route GET /api/v1/products/travel-insurance/lookup/:type
 * @access Public
 * @remarks This is a placeholder. Actual implementation would involve calling Allianz API.
 */
const getTravelInsuranceLookup = asyncHandler(async (req, res) => {
  const { type } = req.params; // e.g., 'GetCountry', 'GetTravelPlan'
  // In a real scenario, you would call the Allianz API here
  // const allianzResponse = await allianzService.getLookup(type);
  // ApiResponse.success(res, StatusCodes.OK, `Allianz ${type} data fetched`, allianzResponse.data);

  // Mock data for demonstration
  let data = [];
  if (type === 'countries') {
    data = [{ id: 110, name: 'USA' }, { id: 4, name: 'Canada' }];
  } else if (type === 'travel-plans') {
    data = [{ id: 1, name: 'Standard' }, { id: 2, name: 'Premium' }];
  } else {
    throw new ApiError('Invalid lookup type', StatusCodes.BAD_REQUEST);
  }

  ApiResponse.success(res, StatusCodes.OK, `Allianz ${type} data fetched`, { data });
});

/**
 * @description Get a quote for Allianz Travel Insurance.
 * @route POST /api/v1/products/travel-insurance/quote
 * @access Public
 * @remarks This is a placeholder. Actual implementation would involve calling Allianz API.
 */
const getTravelInsuranceQuote = asyncHandler(async (req, res) => {
  const quoteDetails = req.body;
  // In a real scenario, you would call the Allianz API here
  // const allianzResponse = await allianzService.getQuote(quoteDetails);
  // ApiResponse.success(res, StatusCodes.OK, 'Travel insurance quote fetched successfully', allianzResponse.data);

  // Mock data for demonstration
  const mockQuote = {
    QuoteRequestId: Math.floor(Math.random() * 10000),
    ProductVariantId: 'NGN002FCG-Worldwide',
    Amount: 7467,
    AllianzPrice: '7467',
    // ... other quote details from Allianz
  };

  ApiResponse.success(res, StatusCodes.OK, 'Travel insurance quote fetched successfully', mockQuote);
});

/**
 * @description Purchase Allianz Travel Insurance (Individual).
 * @route POST /api/v1/products/travel-insurance/purchase/individual
 * @access Private
 * @remarks This is a placeholder. Actual implementation would involve calling Allianz API and Paystack.
 */
const purchaseTravelInsuranceIndividual = asyncHandler(async (req, res) => {
  const { quoteId, customerDetails, paymentDetails, referralCode } = req.body;
  const userId = req.user ? req.user.userId : null; // Get user ID if logged in

  // 1. Call Allianz API to purchase policy
  // const allianzPurchaseResponse = await allianzService.purchaseIndividual(quoteId, customerDetails);
  // const contractNo = allianzPurchaseResponse.ContractNo;

  // Mock Allianz response
  const contractNo = `AZNNG${Math.floor(Math.random() * 1000000000)}`;
  logger.info(`Mock Allianz Individual Travel Insurance purchased: ${contractNo}`);

  // 2. Calculate TTP markup
  const basePrice = 7467; // Assuming this comes from the quote
  const travelInsuranceCharge = parseFloat(await redisClient.hGet('serviceCharges', 'TRAVEL_INSURANCE_CHARGES'));
  const finalAmount = basePrice + travelInsuranceCharge;

  // 3. Initiate Paystack payment
  // const paystackInitResponse = await paystackService.initializePayment({
  //   email: customerDetails.Email,
  //   amount: finalAmount * 100, // Paystack amount is in kobo/cents
  //   reference: `TTP-TI-${Date.now()}`,
  //   metadata: {
  //     productType: 'Travel Insurance',
  //     policyId: contractNo,
  //     userId: userId,
  //     guestEmail: customerDetails.Email,
  //     guestPhoneNumber: customerDetails.Telephone,
  //   },
  // });

  // Mock Paystack initiation
  const paystackInitResponse = {
    status: true,
    message: 'Authorization URL created',
    data: {
      authorization_url: 'https://checkout.paystack.com/mock_auth_url',
      access_code: 'mock_access_code',
      reference: `TTP-TI-${Date.now()}`,
    },
  };
  logger.info(`Mock Paystack payment initiated for ${finalAmount}`);

  // 4. Record transaction in Ledger as PENDING
  const ledgerEntry = await Ledger.create({
    userId,
    guestEmail: customerDetails.Email,
    guestPhoneNumber: customerDetails.Telephone,
    transactionReference: paystackInitResponse.data.reference,
    amount: basePrice,
    currency: 'NGN',
    status: 'Pending',
    paymentGateway: 'Paystack',
    paymentGatewayResponse: paystackInitResponse.data,
    productType: 'Travel Insurance',
    productId: contractNo,
    markupApplied: travelInsuranceCharge,
    totalAmountPaid: finalAmount,
    referralCode: referralCode || null,
    productDetails: {
      // Store relevant Allianz policy details here
      allianzContractNo: contractNo,
      // ... other details
    },
  });

  ApiResponse.success(res, StatusCodes.OK, 'Travel insurance purchase initiated. Redirect to payment gateway.', {
    authorizationUrl: paystackInitResponse.data.authorization_url,
    reference: paystackInitResponse.data.reference,
    amount: finalAmount,
  });
});

/**
 * @description Purchase Allianz Travel Insurance (Family).
 * @route POST /api/v1/products/travel-insurance/purchase/family
 * @access Private
 * @remarks This is a placeholder. Actual implementation would involve calling Allianz API and Paystack.
 */
const purchaseTravelInsuranceFamily = asyncHandler(async (req, res) => {
  const { quoteId, familyMembersDetails, paymentDetails, referralCode } = req.body;
  const userId = req.user ? req.user.userId : null;

  // 1. Call Allianz API to purchase policy
  // const allianzPurchaseResponse = await allianzService.purchaseFamily(quoteId, familyMembersDetails);
  // const contractNo = allianzPurchaseResponse.ContractNo;

  // Mock Allianz response
  const contractNo = `AZNNG${Math.floor(Math.random() * 1000000000)}`;
  logger.info(`Mock Allianz Family Travel Insurance purchased: ${contractNo}`);

  // 2. Calculate TTP markup
  const basePrice = 35259.00; // Assuming this comes from the quote
  const travelInsuranceCharge = parseFloat(await redisClient.hGet('serviceCharges', 'TRAVEL_INSURANCE_CHARGES'));
  const finalAmount = basePrice + travelInsuranceCharge;

  // 3. Initiate Paystack payment
  // const paystackInitResponse = await paystackService.initializePayment({
  //   email: familyMembersDetails[0].Email, // Use lead family member's email
  //   amount: finalAmount * 100,
  //   reference: `TTP-TIF-${Date.now()}`,
  //   metadata: {
  //     productType: 'Travel Insurance (Family)',
  //     policyId: contractNo,
  //     userId: userId,
  //     guestEmail: familyMembersDetails[0].Email,
  //     guestPhoneNumber: familyMembersDetails[0].Telephone,
  //   },
  // });

  // Mock Paystack initiation
  const paystackInitResponse = {
    status: true,
    message: 'Authorization URL created',
    data: {
      authorization_url: 'https://checkout.paystack.com/mock_auth_url',
      access_code: 'mock_access_code',
      reference: `TTP-TIF-${Date.now()}`,
    },
  };
  logger.info(`Mock Paystack payment initiated for ${finalAmount}`);

  // 4. Record transaction in Ledger as PENDING
  const ledgerEntry = await Ledger.create({
    userId,
    guestEmail: familyMembersDetails[0].Email,
    guestPhoneNumber: familyMembersDetails[0].Telephone,
    transactionReference: paystackInitResponse.data.reference,
    amount: basePrice,
    currency: 'NGN',
    status: 'Pending',
    paymentGateway: 'Paystack',
    paymentGatewayResponse: paystackInitResponse.data,
    productType: 'Travel Insurance',
    productId: contractNo,
    markupApplied: travelInsuranceCharge,
    totalAmountPaid: finalAmount,
    referralCode: referralCode || null,
    productDetails: {
      allianzContractNo: contractNo,
      // ... other details
    },
  });

  ApiResponse.success(res, StatusCodes.OK, 'Family travel insurance purchase initiated. Redirect to payment gateway.', {
    authorizationUrl: paystackInitResponse.data.authorization_url,
    reference: paystackInitResponse.data.reference,
    amount: finalAmount,
  });
});


// --- Amadeus Flight Booking Integration (Placeholder) ---

/**
 * @description Search for flights using Amadeus API.
 * @route POST /api/v1/products/flights/search
 * @access Public
 * @remarks This is a placeholder. Actual implementation would involve calling Amadeus API.
 */
const searchFlights = asyncHandler(async (req, res) => {
  const flightSearchCriteria = req.body;
  // const amadeusResponse = await amadeusService.searchFlights(flightSearchCriteria);
  // ApiResponse.success(res, StatusCodes.OK, 'Flights fetched successfully', amadeusResponse.data);

  // Mock data
  const mockFlights = [
    { id: 'FL123', airline: 'MockAir', departure: 'LOS', arrival: 'JFK', price: 500000 },
    { id: 'FL456', airline: 'FakeWings', departure: 'LOS', arrival: 'JFK', price: 480000 },
  ];
  ApiResponse.success(res, StatusCodes.OK, 'Flights fetched successfully', { flights: mockFlights });
});

/**
 * @description Book a flight using Amadeus API.
 * @route POST /api/v1/products/flights/book
 * @access Private
 * @remarks This is a placeholder. Actual implementation would involve calling Amadeus API and Paystack.
 */
const bookFlight = asyncHandler(async (req, res) => {
  const { flightDetails, passengerDetails, paymentDetails, referralCode } = req.body;
  const userId = req.user ? req.user.userId : null;

  // 1. Call Amadeus API to book flight
  // const amadeusBookingResponse = await amadeusService.bookFlight(flightDetails, passengerDetails);
  // const bookingReference = amadeusBookingResponse.bookingReference;

  // Mock Amadeus response
  const bookingReference = `AMADEUS-${Date.now()}`;
  logger.info(`Mock Amadeus flight booked: ${bookingReference}`);

  // 2. Calculate TTP markup
  const basePrice = flightDetails.price; // Price from the selected flight
  const flightBookingCharge = parseFloat(await redisClient.hGet('serviceCharges', 'FLIGHT_BOOKING_CHARGES'));
  const finalAmount = basePrice + flightBookingCharge;

  // 3. Initiate Paystack payment
  // const paystackInitResponse = await paystackService.initializePayment({
  //   email: passengerDetails.email,
  //   amount: finalAmount * 100,
  //   reference: `TTP-FL-${Date.now()}`,
  //   metadata: {
  //     productType: 'Flight Booking',
  //     bookingRef: bookingReference,
  //     userId: userId,
  //     guestEmail: passengerDetails.email,
  //     guestPhoneNumber: passengerDetails.phoneNumber,
  //   },
  // });

  // Mock Paystack initiation
  const paystackInitResponse = {
    status: true,
    message: 'Authorization URL created',
    data: {
      authorization_url: 'https://checkout.paystack.com/mock_auth_url',
      access_code: 'mock_access_code',
      reference: `TTP-FL-${Date.now()}`,
    },
  };
  logger.info(`Mock Paystack payment initiated for ${finalAmount}`);

  // 4. Record transaction in Ledger as PENDING
  const ledgerEntry = await Ledger.create({
    userId,
    guestEmail: passengerDetails.email,
    guestPhoneNumber: passengerDetails.phoneNumber,
    transactionReference: paystackInitResponse.data.reference,
    amount: basePrice,
    currency: 'NGN',
    status: 'Pending',
    paymentGateway: 'Paystack',
    paymentGatewayResponse: paystackInitResponse.data,
    productType: 'Flight Booking',
    productId: bookingReference,
    markupApplied: flightBookingCharge,
    totalAmountPaid: finalAmount,
    referralCode: referralCode || null,
    productDetails: {
      amadeusBookingRef: bookingReference,
      // ... other flight details
    },
  });

  ApiResponse.success(res, StatusCodes.OK, 'Flight booking initiated. Redirect to payment gateway.', {
    authorizationUrl: paystackInitResponse.data.authorization_url,
    reference: paystackInitResponse.data.reference,
    amount: finalAmount,
  });
});


// --- Ratehawk Hotel Booking Integration (Placeholder) ---

/**
 * @description Search for hotels using Ratehawk API.
 * @route POST /api/v1/products/hotels/search
 * @access Public
 * @remarks This is a placeholder. Actual implementation would involve calling Ratehawk API.
 */
const searchHotels = asyncHandler(async (req, res) => {
  const hotelSearchCriteria = req.body;
  // const ratehawkResponse = await ratehawkService.searchHotels(hotelSearchCriteria);
  // ApiResponse.success(res, StatusCodes.OK, 'Hotels fetched successfully', ratehawkResponse.data);

  // Mock data
  const mockHotels = [
    { id: 'HTL001', name: 'Mock Hotel Lagos', price: 150000, currency: 'NGN' },
    { id: 'HTL002', name: 'Fake Inn Abuja', price: 120000, currency: 'NGN' },
  ];
  ApiResponse.success(res, StatusCodes.OK, 'Hotels fetched successfully', { hotels: mockHotels });
});

/**
 * @description Book a hotel using Ratehawk API.
 * @route POST /api/v1/products/hotels/book
 * @access Private
 * @remarks This is a placeholder. Actual implementation would involve calling Ratehawk API and Paystack.
 */
const bookHotel = asyncHandler(async (req, res) => {
  const { hotelDetails, guestDetails, paymentDetails, referralCode } = req.body;
  const userId = req.user ? req.user.userId : null;

  // 1. Call Ratehawk API to book hotel
  // const ratehawkBookingResponse = await ratehawkService.bookHotel(hotelDetails, guestDetails);
  // const bookingReference = ratehawkBookingResponse.bookingReference;

  // Mock Ratehawk response
  const bookingReference = `RATEHAWK-${Date.now()}`;
  logger.info(`Mock Ratehawk hotel booked: ${bookingReference}`);

  // 2. Calculate TTP markup
  const basePrice = hotelDetails.price; // Price from the selected hotel
  const hotelReservationCharge = parseFloat(await redisClient.hGet('serviceCharges', 'HOTEL_RESERVATION_CHARGES'));
  const finalAmount = basePrice + hotelReservationCharge;

  // 3. Initiate Paystack payment
  // const paystackInitResponse = await paystackService.initializePayment({
  //   email: guestDetails.email,
  //   amount: finalAmount * 100,
  //   reference: `TTP-HTL-${Date.now()}`,
  //   metadata: {
  //     productType: 'Hotel Reservation',
  //     bookingRef: bookingReference,
  //     userId: userId,
  //     guestEmail: guestDetails.email,
  //     guestPhoneNumber: guestDetails.phoneNumber,
  //   },
  // });

  // Mock Paystack initiation
  const paystackInitResponse = {
    status: true,
    message: 'Authorization URL created',
    data: {
      authorization_url: 'https://checkout.paystack.com/mock_auth_url',
      access_code: 'mock_access_code',
      reference: `TTP-HTL-${Date.now()}`,
    },
  };
  logger.info(`Mock Paystack payment initiated for ${finalAmount}`);

  // 4. Record transaction in Ledger as PENDING
  const ledgerEntry = await Ledger.create({
    userId,
    guestEmail: guestDetails.email,
    guestPhoneNumber: guestDetails.phoneNumber,
    transactionReference: paystackInitResponse.data.reference,
    amount: basePrice,
    currency: 'NGN',
    status: 'Pending',
    paymentGateway: 'Paystack',
    paymentGatewayResponse: paystackInitResponse.data,
    productType: 'Hotel Reservation',
    productId: bookingReference,
    markupApplied: hotelReservationCharge,
    totalAmountPaid: finalAmount,
    referralCode: referralCode || null,
    productDetails: {
      ratehawkBookingRef: bookingReference,
      // ... other hotel details
    },
  });

  ApiResponse.success(res, StatusCodes.OK, 'Hotel booking initiated. Redirect to payment gateway.', {
    authorizationUrl: paystackInitResponse.data.authorization_url,
    reference: paystackInitResponse.data.reference,
    amount: finalAmount,
  });
});


// --- Package Purchase System ---

/**
 * @description Get available packages for purchase.
 * @route GET /api/v1/products/packages
 * @access Public
 */
const getAvailablePackages = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, category, featured } = req.query;
  const skip = (page - 1) * limit;

  let query = {
    postType: 'Packages',
    status: 'Published',
    isActive: true,
    'availability.isAvailable': true,
  };

  // Add category filter if provided
  if (category) {
    query.categories = category;
  }

  // Add featured filter if provided
  if (featured === 'true') {
    query.isFeatured = true;
  }

  // Check availability dates
  const now = new Date();
  query['availability.startDate'] = { $lte: now };
  query['availability.endDate'] = { $gte: now };

  const packages = await Post.find(query)
    .populate('author', 'firstName lastName')
    .populate('categories', 'name slug')
    .sort({ publishedAt: -1 })
    .limit(parseInt(limit))
    .skip(skip);

  const total = await Post.countDocuments(query);

  ApiResponse.success(res, StatusCodes.OK, 'Available packages fetched successfully', {
    packages,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      totalPackages: total,
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  });
});

/**
 * @description Get a specific package by ID or slug.
 * @route GET /api/v1/products/packages/:identifier
 * @access Public
 */
const getPackageDetails = asyncHandler(async (req, res) => {
  const { identifier } = req.params;

  // Try to find by ID first, then by slug
  let packagePost = await Post.findOne({
    $or: [
      { _id: mongoose.Types.ObjectId.isValid(identifier) ? identifier : null },
      { slug: identifier }
    ],
    postType: 'Packages',
    status: 'Published',
    isActive: true,
  })
    .populate('author', 'firstName lastName email')
    .populate('categories', 'name slug description');

  if (!packagePost) {
    throw new ApiError('Package not found', StatusCodes.NOT_FOUND);
  }

  // Check if package is currently available
  if (!packagePost.isPackageAvailable()) {
    throw new ApiError('Package is currently not available for booking', StatusCodes.BAD_REQUEST);
  }

  // Increment view count
  packagePost.viewCount += 1;
  await packagePost.save();

  ApiResponse.success(res, StatusCodes.OK, 'Package details fetched successfully', { package: packagePost });
});

/**
 * @description Initiate package purchase.
 * @route POST /api/v1/products/packages/:packageId/purchase
 * @access Public (supports both authenticated and guest checkout)
 */
const initiatePackagePurchase = asyncHandler(async (req, res) => {
  const { packageId } = req.params;
  const { customerDetails, participants = 1, specialRequests, referralCode } = req.body;
  const userId = req.user ? req.user.userId : null;

  // Validate package exists and is available
  const packagePost = await Post.findOne({
    _id: packageId,
    postType: 'Packages',
    status: 'Published',
    isActive: true,
  });

  if (!packagePost) {
    throw new ApiError('Package not found or not available', StatusCodes.NOT_FOUND);
  }

  if (!packagePost.isPackageAvailable()) {
    throw new ApiError('Package is currently not available for booking', StatusCodes.BAD_REQUEST);
  }

  // Validate participants count
  if (participants > packagePost.metadata.maxParticipants) {
    throw new ApiError(
      `Maximum ${packagePost.metadata.maxParticipants} participants allowed for this package`,
      StatusCodes.BAD_REQUEST
    );
  }

  // For guest checkout, validate customer details
  let guestEmail = null;
  let guestPhoneNumber = null;
  let customerEmail = null;
  let customerPhone = null;

  if (!userId) {
    if (!customerDetails || !customerDetails.email || !customerDetails.phoneNumber) {
      throw new ApiError(
        'Customer email and phone number are required for guest checkout',
        StatusCodes.BAD_REQUEST
      );
    }
    guestEmail = customerDetails.email;
    guestPhoneNumber = customerDetails.phoneNumber;
    customerEmail = customerDetails.email;
    customerPhone = customerDetails.phoneNumber;
  } else {
    // For authenticated users, get email from user or use provided details
    const User = require('../models/userModel');
    const user = await User.findById(userId);
    customerEmail = customerDetails?.email || user.email;
    customerPhone = customerDetails?.phoneNumber || user.phoneNumber;
  }

  // Calculate pricing
  const basePrice = packagePost.price * participants;
  const packageServiceCharge = parseFloat(await redisClient.hGet('serviceCharges', 'PACKAGE_CHARGES') || '2000');
  const totalAmount = basePrice + packageServiceCharge;

  // Generate unique transaction reference
  const transactionReference = `TTP-PKG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Initiate Paystack payment
  const paystackInitResponse = await paystackService.initializePayment({
    email: customerEmail,
    amount: totalAmount,
    reference: transactionReference,
    metadata: {
      productType: 'Package',
      packageId: packageId,
      packageTitle: packagePost.title,
      participants: participants,
      userId: userId,
      guestEmail: guestEmail,
      guestPhoneNumber: guestPhoneNumber,
      specialRequests: specialRequests,
    },
  });

  // Record transaction in Ledger as PENDING
  const ledgerEntry = await Ledger.create({
    userId,
    guestEmail,
    guestPhoneNumber,
    transactionReference,
    amount: basePrice,
    currency: packagePost.currency || 'NGN',
    status: 'Pending',
    paymentGateway: 'Paystack',
    paymentGatewayResponse: paystackInitResponse.data,
    productType: 'Package',
    itemType: 'Package',
    packageId: packageId,
    markupApplied: packageServiceCharge,
    profitMargin: packageServiceCharge,
    serviceCharge: packageServiceCharge,
    totalAmountPaid: totalAmount,
    customerSegment: participants > 1 ? 'Group' : 'Individual',
    bookingChannel: 'Web',
    referralCode: referralCode || null,
    productDetails: {
      packageTitle: packagePost.title,
      packageSlug: packagePost.slug,
      participants: participants,
      duration: packagePost.metadata.duration,
      location: packagePost.metadata.location,
      difficulty: packagePost.metadata.difficulty,
      specialRequests: specialRequests,
      customerDetails: customerDetails,
    },
  });

  logger.info(`Package purchase initiated: ${transactionReference} for package ${packagePost.title}`);

  ApiResponse.success(res, StatusCodes.OK, 'Package purchase initiated. Redirect to payment gateway.', {
    authorizationUrl: paystackInitResponse.data.authorization_url,
    reference: transactionReference,
    amount: totalAmount,
    packageDetails: {
      title: packagePost.title,
      price: basePrice,
      serviceCharge: packageServiceCharge,
      totalAmount: totalAmount,
      participants: participants,
    },
  });
});

/**
 * @description Verify package payment and complete purchase.
 * @route POST /api/v1/products/packages/verify-payment
 * @access Public
 */
const verifyPackagePayment = asyncHandler(async (req, res) => {
  const { reference } = req.body;

  if (!reference) {
    throw new ApiError('Payment reference is required', StatusCodes.BAD_REQUEST);
  }

  // Find the ledger entry
  const ledgerEntry = await Ledger.findOne({ transactionReference: reference });
  if (!ledgerEntry) {
    throw new ApiError('Transaction not found', StatusCodes.NOT_FOUND);
  }

  // Verify payment with Paystack
  const paystackVerification = await paystackService.verifyPayment(reference);

  if (paystackVerification.data.status === 'success') {
    // Update ledger entry
    ledgerEntry.status = 'Completed';
    ledgerEntry.paymentGatewayResponse = paystackVerification.data;
    await ledgerEntry.save();

    // Get package details
    const packagePost = await Post.findById(ledgerEntry.packageId);

    // Prepare notification data
    const notificationData = {
      customerEmail: ledgerEntry.guestEmail || (await require('../models/userModel').findById(ledgerEntry.userId))?.email,
      customerPhone: ledgerEntry.guestPhoneNumber || (await require('../models/userModel').findById(ledgerEntry.userId))?.phoneNumber,
      packageTitle: packagePost.title,
      packageLocation: packagePost.metadata.location,
      packageDuration: packagePost.metadata.duration,
      participants: ledgerEntry.productDetails.participants,
      totalAmount: ledgerEntry.totalAmountPaid,
      transactionReference: reference,
      bookingDate: new Date().toLocaleDateString(),
      specialRequests: ledgerEntry.productDetails.specialRequests,
    };

    // Send notifications
    await sendPackageNotifications(notificationData);

    logger.info(`Package purchase completed: ${reference} for package ${packagePost.title}`);

    ApiResponse.success(res, StatusCodes.OK, 'Package purchase completed successfully', {
      transactionReference: reference,
      status: 'Completed',
      packageDetails: {
        title: packagePost.title,
        location: packagePost.metadata.location,
        duration: packagePost.metadata.duration,
        participants: ledgerEntry.productDetails.participants,
      },
      amount: ledgerEntry.totalAmountPaid,
    });
  } else {
    // Update ledger entry as failed
    ledgerEntry.status = 'Failed';
    ledgerEntry.paymentGatewayResponse = paystackVerification.data;
    await ledgerEntry.save();

    throw new ApiError('Payment verification failed', StatusCodes.BAD_REQUEST);
  }
});

/**
 * @description Send package purchase notifications via email, SMS, and WhatsApp.
 * @param {object} notificationData - Data for notifications
 */
const sendPackageNotifications = async (notificationData) => {
  const {
    customerEmail,
    customerPhone,
    packageTitle,
    packageLocation,
    packageDuration,
    participants,
    totalAmount,
    transactionReference,
    bookingDate,
    specialRequests,
  } = notificationData;

  try {
    // Email notification
    const emailSubject = `Package Booking Confirmation - ${packageTitle}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2c3e50;">Package Booking Confirmation</h2>
        <p>Dear Valued Customer,</p>
        <p>Thank you for booking with The Travel Place! Your package booking has been confirmed.</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #2c3e50; margin-top: 0;">Booking Details</h3>
          <p><strong>Package:</strong> ${packageTitle}</p>
          <p><strong>Location:</strong> ${packageLocation}</p>
          <p><strong>Duration:</strong> ${packageDuration}</p>
          <p><strong>Participants:</strong> ${participants}</p>
          <p><strong>Total Amount:</strong> ₦${totalAmount.toLocaleString()}</p>
          <p><strong>Transaction Reference:</strong> ${transactionReference}</p>
          <p><strong>Booking Date:</strong> ${bookingDate}</p>
          ${specialRequests ? `<p><strong>Special Requests:</strong> ${specialRequests}</p>` : ''}
        </div>
        
        <div style="background-color: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h4 style="color: #2c3e50; margin-top: 0;">What's Next?</h4>
          <p>Our team will contact you within 24 hours to provide detailed itinerary and further instructions.</p>
          <p>Please keep this confirmation email for your records.</p>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 14px;">
            For any questions or concerns, please contact us at:<br>
            Email: support@thetravelplace.com<br>
            Phone: +234 800 123 4567
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
          <p style="color: #999; font-size: 12px;">
            © ${new Date().getFullYear()} The Travel Place. All rights reserved.
          </p>
        </div>
      </div>
    `;

    // SMS notification
    const smsMessage = `Package Booking Confirmed! ${packageTitle} for ${participants} participant(s). Amount: ₦${totalAmount.toLocaleString()}. Ref: ${transactionReference}. We'll contact you within 24hrs. - The Travel Place`;

    // WhatsApp notification
    const whatsappMessage = `🎉 *Package Booking Confirmed!*\n\n📦 *Package:* ${packageTitle}\n📍 *Location:* ${packageLocation}\n⏰ *Duration:* ${packageDuration}\n👥 *Participants:* ${participants}\n💰 *Total:* ₦${totalAmount.toLocaleString()}\n🔖 *Reference:* ${transactionReference}\n📅 *Booked:* ${bookingDate}\n\n${specialRequests ? `📝 *Special Requests:* ${specialRequests}\n\n` : ''}✅ Our team will contact you within 24 hours with detailed itinerary.\n\n*The Travel Place* - Your Journey Begins Here!`;

    // Send notifications using queues if available, otherwise send directly
    if (emailQueue && customerEmail) {
      await emailQueue.add('sendPackageConfirmationEmail', {
        to: customerEmail,
        subject: emailSubject,
        html: emailHtml,
      });
      logger.info(`Package confirmation email queued for ${customerEmail}`);
    } else if (customerEmail) {
      // Send directly if queue is not available
      try {
        const { sendEmail } = require('../utils/emailService');
        await sendEmail({
          to: customerEmail,
          subject: emailSubject,
          html: emailHtml,
        });
        logger.info(`Package confirmation email sent directly to ${customerEmail}`);
      } catch (emailError) {
        logger.error(`Failed to send email directly: ${emailError.message}`);
      }
    }

    if (smsQueue && customerPhone) {
      await smsQueue.add('sendPackageConfirmationSMS', {
        to: customerPhone,
        body: smsMessage,
      });
      logger.info(`Package confirmation SMS queued for ${customerPhone}`);
    } else if (customerPhone) {
      // Send directly if queue is not available
      try {
        const { sendSMS } = require('../utils/smsService');
        await sendSMS(customerPhone, smsMessage);
        logger.info(`Package confirmation SMS sent directly to ${customerPhone}`);
      } catch (smsError) {
        logger.error(`Failed to send SMS directly: ${smsError.message}`);
      }
    }

    if (whatsappQueue && customerPhone) {
      await whatsappQueue.add('sendPackageConfirmationWhatsApp', {
        to: customerPhone,
        body: whatsappMessage,
      });
      logger.info(`Package confirmation WhatsApp queued for ${customerPhone}`);
    } else if (customerPhone) {
      // Send directly if queue is not available
      try {
        const { sendWhatsAppMessage } = require('../utils/smsService');
        await sendWhatsAppMessage(customerPhone, whatsappMessage);
        logger.info(`Package confirmation WhatsApp sent directly to ${customerPhone}`);
      } catch (whatsappError) {
        logger.error(`Failed to send WhatsApp directly: ${whatsappError.message}`);
      }
    }

  } catch (error) {
    logger.error('Error sending package notifications:', error.message);
    // Don't throw error as this shouldn't fail the main transaction
  }
};

// --- Visa Processing ---

/**
 * Calculate visa fees based on destination country, visa type, and urgency
 */
const calculateVisaFees = (destinationCountry, visaType, urgency) => {
  // Base visa fees by country and type (in kobo - NGN * 100)
  const baseFees = {
    'United States': { Tourist: 16000000, Business: 16000000, Student: 35000000, Transit: 16000000, Work: 19000000 }, // $160, $160, $350, $160, $190
    'United Kingdom': { Tourist: 9500000, Business: 9500000, Student: 34800000, Transit: 6400000, Work: 61000000 }, // £95, £95, £348, £64, £610
    'Canada': { Tourist: 10000000, Business: 10000000, Student: 15000000, Transit: 7500000, Work: 15500000 }, // CAD $100, $100, $150, $75, $155
    'Germany': { Tourist: 8000000, Business: 8000000, Student: 7500000, Transit: 8000000, Work: 7500000 }, // €80, €80, €75, €80, €75
    'France': { Tourist: 8000000, Business: 8000000, Student: 9900000, Transit: 8000000, Work: 9900000 }, // €80, €80, €99, €80, €99
    'Australia': { Tourist: 14500000, Business: 14500000, Student: 62000000, Transit: 14500000, Work: 31000000 }, // AUD $145, $145, $620, $145, $310
    'Dubai': { Tourist: 35000000, Business: 35000000, Student: 120000000, Transit: 10000000, Work: 120000000 }, // AED 350, 350, 1200, 100, 1200
    'South Africa': { Tourist: 9300000, Business: 9300000, Student: 42500000, Transit: 9300000, Work: 42500000 } // ZAR 930, 930, 4250, 930, 4250
  };

  // Service fees (in kobo)
  const serviceFee = 1500000; // NGN 15,000 service fee

  // Urgency fees (in kobo)
  const urgencyFees = {
    'Standard': 0,
    'Express': 2500000, // NGN 25,000 additional
    'Super Express': 5000000 // NGN 50,000 additional
  };

  const visaFee = baseFees[destinationCountry]?.[visaType] || 5000000; // Default NGN 50,000
  const urgencyFee = urgencyFees[urgency] || 0;

  return {
    visaFee,
    serviceFee,
    urgencyFee,
    total: visaFee + serviceFee + urgencyFee
  };
};

/**
 * Get estimated processing time based on urgency
 */
const getEstimatedProcessingTime = (urgency) => {
  const processingTimes = {
    'Standard': '10-15 business days',
    'Express': '5-7 business days',
    'Super Express': '2-3 business days'
  };
  return processingTimes[urgency] || '10-15 business days';
};

/**
 * @description Process payment for visa application.
 * @route POST /api/v1/products/visa/:id/payment
 * @access Private
 */
const processVisaPayment = asyncHandler(async (req, res) => {
  if (!VisaApplication) {
    throw new ApiError('Visa application service is currently unavailable', StatusCodes.SERVICE_UNAVAILABLE);
  }

  const { id } = req.params;
  const { paymentMethod = 'paystack' } = req.body;

  const visaApplication = await VisaApplication.findById(id);

  if (!visaApplication) {
    throw new ApiError('Visa application not found', StatusCodes.NOT_FOUND);
  }

  // Ensure user is authorized to pay for this application
  if (req.user && visaApplication.userId && visaApplication.userId.toString() !== req.user.userId) {
    throw new ApiError('Unauthorized to pay for this application', StatusCodes.FORBIDDEN);
  }
  
  // For guest applications, allow access if no user is authenticated and application has guestEmail
  if (!req.user && !visaApplication.guestEmail) {
    throw new ApiError('Unauthorized to pay for this application', StatusCodes.FORBIDDEN);
  }

  if (visaApplication.paymentStatus === 'Paid') {
    throw new ApiError('Payment has already been completed for this application', StatusCodes.BAD_REQUEST);
  }

  if (visaApplication.fees.total <= 0) {
    throw new ApiError('Invalid payment amount', StatusCodes.BAD_REQUEST);
  }

  try {
    // Generate payment reference
    const paymentReference = `VISA-${visaApplication.applicationReference}-${Date.now()}`;

    // Initialize payment with Paystack
    const paymentData = {
      email: visaApplication.userId ? req.user.email : visaApplication.guestEmail,
      amount: visaApplication.fees.total, // Amount in kobo
      reference: paymentReference,
      callback_url: `${process.env.FRONTEND_URL}/visa/payment/callback`,
      metadata: {
        visaApplicationId: visaApplication._id.toString(),
        destinationCountry: visaApplication.destinationCountry,
        visaType: visaApplication.visaType,
        urgency: visaApplication.urgency,
        userId: visaApplication.userId?.toString() || null,
        guestEmail: visaApplication.guestEmail || null
      }
    };

    const paymentResponse = await paystackService.initializeTransaction(paymentData);

    if (!paymentResponse.status) {
      throw new ApiError('Failed to initialize payment', StatusCodes.INTERNAL_SERVER_ERROR);
    }

    // Update visa application with payment reference
    visaApplication.paymentReference = paymentReference;
    visaApplication.paymentStatus = 'Pending';
    await visaApplication.save();

    // Create ledger entry for payment tracking
    await Ledger.create({
      userId: visaApplication.userId || null,
      guestEmail: visaApplication.guestEmail || null,
      transactionType: 'VISA_PAYMENT',
      amount: visaApplication.fees.total,
      currency: 'NGN',
      status: 'PENDING',
      reference: paymentReference,
      paymentGateway: 'paystack',
      metadata: {
        visaApplicationId: visaApplication._id,
        destinationCountry: visaApplication.destinationCountry,
        visaType: visaApplication.visaType,
        urgency: visaApplication.urgency,
        fees: visaApplication.fees
      }
    });

    ApiResponse.success(res, StatusCodes.OK, 'Payment initialized successfully', {
      paymentUrl: paymentResponse.data.authorization_url,
      paymentReference,
      amount: visaApplication.fees.total,
      fees: visaApplication.fees,
      visaApplication: {
        id: visaApplication._id,
        applicationReference: visaApplication.applicationReference,
        status: visaApplication.status,
        paymentStatus: visaApplication.paymentStatus
      }
    });
  } catch (error) {
    logger.error('Visa payment initialization error:', error.message);
    throw new ApiError('Failed to process payment. Please try again.', StatusCodes.INTERNAL_SERVER_ERROR);
  }
});

/**
 * @description Verify visa application payment.
 * @route POST /api/v1/products/visa/:id/verify-payment
 * @access Private
 */
const verifyVisaPayment = asyncHandler(async (req, res) => {
  if (!VisaApplication) {
    throw new ApiError('Visa application service is currently unavailable', StatusCodes.SERVICE_UNAVAILABLE);
  }

  const { id } = req.params;
  const { reference } = req.body;

  if (!reference) {
    throw new ApiError('Payment reference is required', StatusCodes.BAD_REQUEST);
  }

  const visaApplication = await VisaApplication.findById(id);

  if (!visaApplication) {
    throw new ApiError('Visa application not found', StatusCodes.NOT_FOUND);
  }

  // Ensure user is authorized to verify payment for this application
  if (req.user && visaApplication.userId && visaApplication.userId.toString() !== req.user.userId) {
    throw new ApiError('Unauthorized to verify payment for this application', StatusCodes.FORBIDDEN);
  }
  
  // For guest applications, allow access if no user is authenticated and application has guestEmail
  if (!req.user && !visaApplication.guestEmail) {
    throw new ApiError('Unauthorized to verify payment for this application', StatusCodes.FORBIDDEN);
  }

  if (visaApplication.paymentReference !== reference) {
    throw new ApiError('Invalid payment reference', StatusCodes.BAD_REQUEST);
  }

  try {
    // Verify payment with Paystack
    const verificationResponse = await paystackService.verifyTransaction(reference);

    if (!verificationResponse.status) {
      throw new ApiError('Payment verification failed', StatusCodes.BAD_REQUEST);
    }

    const paymentData = verificationResponse.data;

    if (paymentData.status === 'success' && paymentData.amount === visaApplication.fees.total) {
      // Update visa application payment status
      visaApplication.paymentStatus = 'Paid';
      
      // Update status to Under Review if still pending
      if (visaApplication.status === 'Pending') {
        visaApplication.status = 'Under Review';
        visaApplication.statusHistory.push({
          status: 'Under Review',
          updatedAt: new Date(),
          notes: 'Payment completed - application under review'
        });
      }

      await visaApplication.save();

      // Update ledger entry
      await Ledger.findOneAndUpdate(
        { reference },
        { 
          status: 'COMPLETED',
          completedAt: new Date(),
          gatewayResponse: paymentData
        }
      );

      // Send payment confirmation notification
      try {
        if (visaApplication.userId && emailQueue) {
          await emailQueue.add('visa-payment-confirmed', {
            userId: visaApplication.userId,
            visaApplicationId: visaApplication._id,
            applicationReference: visaApplication.applicationReference,
            amount: visaApplication.fees.total,
            paymentReference: reference
          });
        } else if (visaApplication.guestEmail && emailQueue) {
          await emailQueue.add('visa-payment-confirmed-guest', {
            guestEmail: visaApplication.guestEmail,
            visaApplicationId: visaApplication._id,
            applicationReference: visaApplication.applicationReference,
            amount: visaApplication.fees.total,
            paymentReference: reference
          });
        }
      } catch (notificationError) {
        logger.error('Failed to send payment confirmation notification:', notificationError.message);
      }

      ApiResponse.success(res, StatusCodes.OK, 'Payment verified successfully', {
        visaApplication: {
          id: visaApplication._id,
          applicationReference: visaApplication.applicationReference,
          status: visaApplication.status,
          paymentStatus: visaApplication.paymentStatus,
          paymentReference: reference,
          amount: visaApplication.fees.total
        }
      });
    } else {
      // Payment failed
      visaApplication.paymentStatus = 'Failed';
      await visaApplication.save();

      // Update ledger entry
      await Ledger.findOneAndUpdate(
        { reference },
        { 
          status: 'FAILED',
          gatewayResponse: paymentData
        }
      );

      throw new ApiError('Payment verification failed. Please try again.', StatusCodes.BAD_REQUEST);
    }
  } catch (error) {
    logger.error('Visa payment verification error:', error.message);
    throw new ApiError('Failed to verify payment. Please try again.', StatusCodes.INTERNAL_SERVER_ERROR);
  }
});

/**
 * @description Initiate a visa application with fee calculation and payment integration.
 * @route POST /api/v1/products/visa/apply
 * @access Private/Optional
 */
const initiateVisaApplication = asyncHandler(async (req, res) => {

  const { 
    destinationCountry, 
    visaType, 
    travelPurpose, 
    urgency = 'Standard',
    travelDates, 
    personalInformation,
    passportDetails,
    referralCode
  } = req.body;
  
  const userId = req.user ? req.user.userId : null;

  // For guest applications, email and phone number are required
  let guestEmail = null;
  let guestPhoneNumber = null;
  if (!userId) {
    guestEmail = req.body.guestEmail;
    guestPhoneNumber = req.body.guestPhoneNumber;
    if (!guestEmail || !guestPhoneNumber) {
      throw new ApiError('Guest email and phone number are required for visa application without login', StatusCodes.BAD_REQUEST);
    }
  }

  // Calculate fees based on destination country, visa type, and urgency
  const fees = calculateVisaFees(destinationCountry, visaType, urgency);

  // Create visa application
  const visaApplicationData = {
    userId,
    guestEmail,
    guestPhoneNumber,
    destinationCountry,
    visaType,
    travelPurpose,
    urgency,
    fees,
    status: 'Pending', // Initial status
    estimatedProcessingTime: getEstimatedProcessingTime(urgency),
    referralCode: referralCode || null
  };

  // Add optional fields if provided
  if (travelDates) {
    visaApplicationData.travelDates = travelDates;
  }
  if (personalInformation) {
    visaApplicationData.personalInformation = personalInformation;
  }
  if (passportDetails) {
    visaApplicationData.passportDetails = passportDetails;
  }

  const visaApplication = await VisaApplication.create(visaApplicationData);

  // Add initial status to history
  visaApplication.statusHistory.push({
    status: 'Pending',
    updatedAt: new Date(),
    notes: 'Visa application initiated'
  });
  await visaApplication.save();

  // Send notification
  try {
    if (userId) {
      // Send notification to registered user
      if (emailQueue) {
        await emailQueue.add('visa-application-initiated', {
          userId,
          visaApplicationId: visaApplication._id,
          applicationReference: visaApplication.applicationReference,
          destinationCountry,
          visaType
        });
      }
    } else if (guestEmail) {
      // Send notification to guest user
      if (emailQueue) {
        await emailQueue.add('visa-application-initiated-guest', {
          guestEmail,
          visaApplicationId: visaApplication._id,
          applicationReference: visaApplication.applicationReference,
          destinationCountry,
          visaType
        });
      }
    }
  } catch (notificationError) {
    logger.error('Failed to send visa application notification:', notificationError.message);
    // Don't fail the request if notification fails
  }

  ApiResponse.success(res, StatusCodes.CREATED, 'Visa application initiated successfully. Please proceed to upload documents and complete payment.', {
    visaApplication: {
      id: visaApplication._id,
      applicationReference: visaApplication.applicationReference,
      destinationCountry: visaApplication.destinationCountry,
      visaType: visaApplication.visaType,
      urgency: visaApplication.urgency,
      status: visaApplication.status,
      fees: visaApplication.fees,
      estimatedProcessingTime: visaApplication.estimatedProcessingTime,
      paymentStatus: visaApplication.paymentStatus
    }
  });
});

/**
 * @description Upload documents for a visa application with enhanced security and validation.
 * @route POST /api/v1/products/visa/:id/upload-document
 * @access Private
 * @remarks Uses multer for file upload and cloudinary for storage.
 */
const uploadVisaDocument = asyncHandler(async (req, res) => {
  if (!VisaApplication) {
    throw new ApiError('Visa application service is currently unavailable', StatusCodes.SERVICE_UNAVAILABLE);
  }

  if (!cloudinary) {
    throw new ApiError('File upload service is currently unavailable', StatusCodes.SERVICE_UNAVAILABLE);
  }

  const { id } = req.params;
  const { documentType } = req.body;

  if (!req.file) {
    throw new ApiError('No file uploaded', StatusCodes.BAD_REQUEST);
  }
  if (!documentType) {
    throw new ApiError('Document type is required', StatusCodes.BAD_REQUEST);
  }

  // Validate file type and size
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
  const maxFileSize = 5 * 1024 * 1024; // 5MB

  if (!allowedMimeTypes.includes(req.file.mimetype)) {
    throw new ApiError('Invalid file type. Only JPEG, PNG, and PDF files are allowed', StatusCodes.BAD_REQUEST);
  }

  if (req.file.size > maxFileSize) {
    throw new ApiError('File size too large. Maximum size is 5MB', StatusCodes.BAD_REQUEST);
  }

  const visaApplication = await VisaApplication.findById(id);

  if (!visaApplication) {
    throw new ApiError('Visa application not found', StatusCodes.NOT_FOUND);
  }

  // Ensure user is authorized to upload for this application
  if (req.user && visaApplication.userId && visaApplication.userId.toString() !== req.user.userId) {
    throw new ApiError('Unauthorized to upload documents for this application', StatusCodes.FORBIDDEN);
  }
  
  // For guest applications, allow access if no user is authenticated and application has guestEmail
  if (!req.user && !visaApplication.guestEmail) {
    throw new ApiError('Unauthorized to upload documents for this application', StatusCodes.FORBIDDEN);
  }

  // Check if document type already exists (allow replacement)
  const existingDocIndex = visaApplication.documents.findIndex(doc => doc.documentType === documentType);

  try {
    // Upload file to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: `the-travel-place/visa-documents/${id}`,
      resource_type: 'auto',
      quality: 'auto:good',
      transformation: [
        { width: 1200, height: 1600, crop: 'limit' }, // Limit max dimensions
        { quality: 'auto:good' }
      ]
    });

    const documentData = {
      documentType,
      filename: result.public_id,
      originalName: req.file.originalname,
      cloudinaryUrl: result.secure_url,
      mimetype: req.file.mimetype,
      size: result.bytes,
      uploadedAt: new Date()
    };

    if (existingDocIndex >= 0) {
      // Replace existing document
      visaApplication.documents[existingDocIndex] = documentData;
    } else {
      // Add new document
      visaApplication.documents.push(documentData);
    }

    // Update status if this is the first document upload
    if (visaApplication.status === 'Pending' && visaApplication.documents.length === 1) {
      visaApplication.status = 'Under Review';
      visaApplication.statusHistory.push({
        status: 'Under Review',
        updatedAt: new Date(),
        notes: 'First document uploaded - application under review'
      });
    }

    await visaApplication.save();

    // Clean up local file after upload
    fs.unlink(req.file.path, (err) => {
      if (err) logger.error(`Error deleting local file: ${err.message}`);
    });

    // Send notification about document upload
    try {
      if (visaApplication.userId && emailQueue) {
        await emailQueue.add('visa-document-uploaded', {
          userId: visaApplication.userId,
          visaApplicationId: visaApplication._id,
          applicationReference: visaApplication.applicationReference,
          documentType,
          totalDocuments: visaApplication.documents.length
        });
      }
    } catch (notificationError) {
      logger.error('Failed to send document upload notification:', notificationError.message);
    }

    ApiResponse.success(res, StatusCodes.OK, 'Document uploaded successfully', {
      document: {
        documentType,
        filename: result.public_id,
        originalName: req.file.originalname,
        cloudinaryUrl: result.secure_url,
        size: result.bytes,
        uploadedAt: documentData.uploadedAt
      },
      visaApplication: {
        id: visaApplication._id,
        status: visaApplication.status,
        totalDocuments: visaApplication.documents.length,
        applicationReference: visaApplication.applicationReference
      }
    });
  } catch (uploadError) {
    logger.error('Error uploading document to Cloudinary:', uploadError.message);
    
    // Clean up local file on error
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, (err) => {
        if (err) logger.error(`Error deleting local file after upload failure: ${err.message}`);
      });
    }
    
    throw new ApiError('Failed to upload document. Please try again.', StatusCodes.INTERNAL_SERVER_ERROR);
  }
});

/**
 * @description Get details of a visa application.
 * @route GET /api/v1/products/visa/:id
 * @access Private
 */
const getVisaApplicationDetails = asyncHandler(async (req, res) => {
  if (!VisaApplication) {
    throw new ApiError('Visa application service is currently unavailable', StatusCodes.SERVICE_UNAVAILABLE);
  }

  const { id } = req.params;

  const visaApplication = await VisaApplication.findById(id);

  if (!visaApplication) {
    throw new ApiError('Visa application not found', StatusCodes.NOT_FOUND);
  }

  // Ensure user is authorized to view this application
  if (req.user && visaApplication.userId && visaApplication.userId.toString() !== req.user.userId) {
    throw new ApiError('Unauthorized to view this application', StatusCodes.FORBIDDEN);
  }
  
  // For guest applications, allow access if no user is authenticated and application has guestEmail
  if (!req.user && !visaApplication.guestEmail) {
    throw new ApiError('Unauthorized to view this application', StatusCodes.FORBIDDEN);
  }

  ApiResponse.success(res, StatusCodes.OK, 'Visa application details fetched successfully', { visaApplication });
});

/**
 * @description Update visa application status with workflow management (Staff/Admin only).
 * @route PUT /api/v1/products/visa/:id/status
 * @access Private/Staff,Manager,Executive,Admin
 */
const updateVisaApplicationStatus = asyncHandler(async (req, res) => {
  if (!VisaApplication) {
    throw new ApiError('Visa application service is currently unavailable', StatusCodes.SERVICE_UNAVAILABLE);
  }

  const { id } = req.params;
  const { status, note } = req.body;

  const visaApplication = await VisaApplication.findById(id).populate('userId', 'firstName lastName email');

  if (!visaApplication) {
    throw new ApiError('Visa application not found', StatusCodes.NOT_FOUND);
  }

  // Validate status transition
  const validStatuses = ['Pending', 'Under Review', 'Additional Documents Required', 'Approved', 'Rejected'];
  if (!validStatuses.includes(status)) {
    throw new ApiError('Invalid status provided', StatusCodes.BAD_REQUEST);
  }

  // Validate status transition logic
  const currentStatus = visaApplication.status;
  const validTransitions = {
    'Pending': ['Under Review', 'Additional Documents Required', 'Rejected'],
    'Under Review': ['Additional Documents Required', 'Approved', 'Rejected'],
    'Additional Documents Required': ['Under Review', 'Approved', 'Rejected'],
    'Approved': [], // Final status
    'Rejected': [] // Final status
  };

  if (!validTransitions[currentStatus].includes(status) && currentStatus !== status) {
    throw new ApiError(`Cannot transition from ${currentStatus} to ${status}`, StatusCodes.BAD_REQUEST);
  }

  const oldStatus = visaApplication.status;
  visaApplication.status = status;

  // Add to status history
  visaApplication.statusHistory.push({
    status,
    updatedBy: req.user.userId,
    updatedAt: new Date(),
    notes: note || `Status updated from ${oldStatus} to ${status}`
  });

  // Add application note if provided
  if (note) {
    visaApplication.applicationNotes.push({ 
      note, 
      addedBy: req.user.userId,
      timestamp: new Date()
    });
  }

  // Handle status-specific actions
  if (status === 'Approved') {
    visaApplication.actualProcessingTime = Math.ceil(
      (new Date() - visaApplication.createdAt) / (1000 * 60 * 60 * 24)
    );
  }

  await visaApplication.save();

  // Send status update notifications
  try {
    const notificationData = {
      visaApplicationId: visaApplication._id,
      applicationReference: visaApplication.applicationReference,
      oldStatus,
      newStatus: status,
      destinationCountry: visaApplication.destinationCountry,
      visaType: visaApplication.visaType,
      note
    };

    if (visaApplication.userId && emailQueue) {
      await emailQueue.add('visa-status-updated', {
        ...notificationData,
        userId: visaApplication.userId._id,
        userEmail: visaApplication.userId.email,
        userName: `${visaApplication.userId.firstName} ${visaApplication.userId.lastName}`
      });
    } else if (visaApplication.guestEmail && emailQueue) {
      await emailQueue.add('visa-status-updated-guest', {
        ...notificationData,
        guestEmail: visaApplication.guestEmail
      });
    }

    // Send SMS notification for critical status updates
    if (['Approved', 'Rejected'].includes(status) && smsQueue) {
      const phoneNumber = visaApplication.userId?.phoneNumber || visaApplication.guestPhoneNumber;
      if (phoneNumber) {
        await smsQueue.add('visa-status-sms', {
          phoneNumber,
          applicationReference: visaApplication.applicationReference,
          status,
          destinationCountry: visaApplication.destinationCountry
        });
      }
    }
  } catch (notificationError) {
    logger.error('Failed to send status update notification:', notificationError.message);
  }

  // Create ledger entry for approved applications (for analytics)
  if (status === 'Approved' && visaApplication.paymentStatus === 'Paid') {
    try {
      await Ledger.create({
        userId: visaApplication.userId || null,
        guestEmail: visaApplication.guestEmail || null,
        transactionType: 'VISA_PROCESSING',
        amount: visaApplication.fees.total,
        currency: 'NGN',
        status: 'COMPLETED',
        reference: visaApplication.paymentReference,
        metadata: {
          visaApplicationId: visaApplication._id,
          destinationCountry: visaApplication.destinationCountry,
          visaType: visaApplication.visaType,
          urgency: visaApplication.urgency
        }
      });
    } catch (ledgerError) {
      logger.error('Failed to create ledger entry for approved visa:', ledgerError.message);
    }
  }

  ApiResponse.success(res, StatusCodes.OK, 'Visa application status updated successfully', {
    visaApplication: {
      id: visaApplication._id,
      applicationReference: visaApplication.applicationReference,
      status: visaApplication.status,
      previousStatus: oldStatus,
      updatedAt: new Date(),
      updatedBy: req.user.userId,
      statusHistory: visaApplication.statusHistory,
      actualProcessingTime: visaApplication.actualProcessingTime
    }
  });
});


module.exports = {
  getServiceCharges,
  updateServiceCharge,
  getTravelInsuranceLookup,
  getTravelInsuranceQuote,
  purchaseTravelInsuranceIndividual,
  purchaseTravelInsuranceFamily,
  searchFlights,
  bookFlight,
  searchHotels,
  bookHotel,
  getAvailablePackages,
  getPackageDetails,
  initiatePackagePurchase,
  verifyPackagePayment,
  initiateVisaApplication,
  uploadVisaDocument,
  getVisaApplicationDetails,
  updateVisaApplicationStatus,
  processVisaPayment,
  verifyVisaPayment,
};