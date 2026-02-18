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
const ratehawkService = require('../services/ratehawkService');
const allianzService = require('../services/allianzService');
const Queue = require('bull');
const mongoose = require('mongoose');
const fs = require('fs');

// Import visa processing dependencies
const VisaApplication = require('../models/visaApplicationModel');
const fileService = require('../services/fileService');
const visaProcessingService = require('../services/visaProcessingService');

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

// --- Visa Processing Helper Functions ---

/**
 * @function calculateVisaFees
 * @description Fallback function to calculate visa fees when external API is unavailable.
 * @param {string} destinationCountry - The destination country.
 * @param {string} visaType - The type of visa.
 * @param {string} urgency - Processing urgency.
 * @returns {object} Calculated fees.
 */
const calculateVisaFees = (destinationCountry, visaType, urgency) => {
  // Default fee structure (in NGN)
  const baseFees = {
    'US': { Tourist: 50000, Business: 60000, Student: 45000, Transit: 30000, Work: 80000 },
    'UK': { Tourist: 35000, Business: 45000, Student: 40000, Transit: 25000, Work: 70000 },
    'CA': { Tourist: 30000, Business: 40000, Student: 35000, Transit: 20000, Work: 65000 },
    'AU': { Tourist: 40000, Business: 50000, Student: 45000, Transit: 25000, Work: 75000 },
    'DE': { Tourist: 25000, Business: 35000, Student: 30000, Transit: 15000, Work: 55000 }
  };

  const urgencyMultipliers = {
    'Standard': 1.0,
    'Express': 1.5,
    'Super Express': 2.0
  };

  const countryCode = destinationCountry.toUpperCase();
  const baseVisaFee = baseFees[countryCode]?.[visaType] || 40000;
  const urgencyMultiplier = urgencyMultipliers[urgency] || 1.0;
  
  const visaFee = Math.round(baseVisaFee * urgencyMultiplier);
  const serviceFee = 15000;
  const urgencyFee = urgency !== 'Standard' ? Math.round(baseVisaFee * (urgencyMultiplier - 1)) : 0;
  
  return {
    visaFee,
    serviceFee,
    urgencyFee,
    biometricFee: 5000,
    courierFee: 3000,
    total: visaFee + serviceFee + urgencyFee + 5000 + 3000
  };
};

/**
 * @function getEstimatedProcessingTime
 * @description Gets estimated processing time based on urgency.
 * @param {string} urgency - Processing urgency.
 * @returns {string} Estimated processing time.
 */
const getEstimatedProcessingTime = (urgency) => {
  const processingTimes = {
    'Standard': '10-15 business days',
    'Express': '5-7 business days',
    'Super Express': '2-3 business days'
  };
  return processingTimes[urgency] || '10-15 business days';
};

// --- Allianz Travel Insurance Integration (Placeholder) ---

/**
 * @description Get Allianz Travel Insurance lookup data (e.g., countries, travel plans).
 * @route GET /api/v1/products/travel-insurance/lookup/:type
 * @access Public
 */
const getTravelInsuranceLookup = asyncHandler(async (req, res) => {
  const { type } = req.params;
  
  logger.info(`Fetching Allianz Travel Insurance lookup data for type: ${type}`);
  
  try {
    // Call real Allianz API
    const allianzResponse = await allianzService.getTravelInsuranceLookup(type);
    
    logger.info(`Successfully fetched ${type} data from Allianz API`);
    ApiResponse.success(res, StatusCodes.OK, `Allianz ${type} data fetched`, allianzResponse);
    
  } catch (error) {
    logger.error(`Failed to fetch ${type} from Allianz API:`, error.message);
    
    // Fallback to mock data if API fails (for development/testing)
    logger.warn(`Using fallback mock data for ${type}`);
    
    let data = [];
    if (type === 'countries') {
      data = [
        { id: 110, name: 'USA' }, 
        { id: 4, name: 'Canada' },
        { id: 1, name: 'United Kingdom' },
        { id: 2, name: 'Germany' },
        { id: 3, name: 'France' },
        { id: 5, name: 'Australia' },
        { id: 6, name: 'South Africa' },
        { id: 7, name: 'China' }
      ];
    } else if (type === 'travel-plans') {
      data = [
        { id: 1, name: 'Standard' }, 
        { id: 2, name: 'Premium' },
        { id: 3, name: 'Comprehensive' }
      ];
    } else if (type === 'State') {
      data = [
        { id: 1, name: 'Abia' },
        { id: 2, name: 'Adamawa' },
        { id: 3, name: 'Akwa Ibom' },
        { id: 4, name: 'Anambra' },
        { id: 5, name: 'Bauchi' },
        { id: 6, name: 'Bayelsa' },
        { id: 7, name: 'Benue' },
        { id: 8, name: 'Borno' },
        { id: 9, name: 'Cross River' },
        { id: 10, name: 'Delta' },
        { id: 11, name: 'Ebonyi' },
        { id: 12, name: 'Edo' },
        { id: 13, name: 'Ekiti' },
        { id: 14, name: 'Enugu' },
        { id: 15, name: 'FCT - Abuja' },
        { id: 16, name: 'Gombe' },
        { id: 17, name: 'Imo' },
        { id: 18, name: 'Jigawa' },
        { id: 19, name: 'Kaduna' },
        { id: 20, name: 'Kano' },
        { id: 21, name: 'Katsina' },
        { id: 22, name: 'Kebbi' },
        { id: 23, name: 'Kogi' },
        { id: 24, name: 'Kwara' },
        { id: 25, name: 'Lagos' },
        { id: 26, name: 'Nasarawa' },
        { id: 27, name: 'Niger' },
        { id: 28, name: 'Ogun' },
        { id: 29, name: 'Ondo' },
        { id: 30, name: 'Osun' },
        { id: 31, name: 'Oyo' },
        { id: 32, name: 'Plateau' },
        { id: 33, name: 'Rivers' },
        { id: 34, name: 'Sokoto' },
        { id: 35, name: 'Taraba' },
        { id: 36, name: 'Yobe' },
        { id: 37, name: 'Zamfara' }
      ];
    } else if (type === 'Title') {
      data = [
        { id: 1, name: 'Mr' },
        { id: 2, name: 'Mrs' },
        { id: 3, name: 'Ms' },
        { id: 4, name: 'Miss' }
      ];
    } else if (type === 'Marital Status') {
      data = [
        { id: 1, name: 'Single' },
        { id: 2, name: 'Married' },
        { id: 3, name: 'Divorced' },
        { id: 4, name: 'Widowed' }
      ];
    } else if (type === 'Gender') {
      data = [
        { id: 1, name: 'Male' },
        { id: 2, name: 'Female' }
      ];
    } else if (type === 'Booking Type') {
      data = [
        { id: 1, name: 'Individual' },
        { id: 2, name: 'Family' },
        { id: 3, name: 'Group' }
      ];
    } else {
      throw new ApiError('Invalid lookup type', StatusCodes.BAD_REQUEST);
    }

    ApiResponse.success(res, StatusCodes.OK, `Allianz ${type} data fetched (fallback)`, { data });
  }
});

/**
 * @description Get a quote for Allianz Travel Insurance.
 * @route POST /api/v1/products/travel-insurance/quote
 * @access Public
 */
const getTravelInsuranceQuote = asyncHandler(async (req, res) => {
  const quoteDetails = req.body;
  
  logger.info('Requesting travel insurance quote from Allianz API', { quoteDetails });
  
  try {
    // Call real Allianz API
    const allianzResponse = await allianzService.getTravelInsuranceQuote(quoteDetails);
    
    logger.info('Successfully received quote from Allianz API', { 
      quoteId: allianzResponse.QuoteRequestId,
      amount: allianzResponse.Amount 
    });
    
    ApiResponse.success(res, StatusCodes.OK, 'Travel insurance quote fetched successfully', allianzResponse);
    
  } catch (error) {
    logger.error('Failed to get quote from Allianz API:', error.message);
    
    // Fallback to mock data if API fails (for development/testing)
    logger.warn('Using fallback mock quote data');
    
    const mockQuote = {
      QuoteRequestId: Math.floor(Math.random() * 10000),
      ProductVariantId: 'NGN002FCG-Worldwide',
      Amount: 7467,
      AllianzPrice: '7467',
      CoverBegins: quoteDetails.CoverBegins,
      CoverEnds: quoteDetails.CoverEnds,
      Destination: quoteDetails.Destination,
      NoOfPeople: quoteDetails.NoOfPeople || 1,
    };

    ApiResponse.success(res, StatusCodes.OK, 'Travel insurance quote fetched successfully (fallback)', mockQuote);
  }
});

/**
 * @description Purchase Allianz Travel Insurance (Individual).
 * @route POST /api/v1/products/travel-insurance/purchase/individual
 * @access Private
 */
const purchaseTravelInsuranceIndividual = asyncHandler(async (req, res) => {
  const { quoteId, customerDetails, paymentDetails, referralCode } = req.body;
  const userId = req.user ? req.user.userId : null; // Get user ID if logged in

  logger.info('Processing individual travel insurance purchase', { 
    quoteId, 
    email: customerDetails.Email,
    userId 
  });

  let contractNo;
  let allianzPurchaseResponse;
  
  try {
    // 1. Call real Allianz API to purchase policy
    allianzPurchaseResponse = await allianzService.purchaseTravelInsuranceIndividual(customerDetails);
    contractNo = allianzPurchaseResponse.ContractNo || allianzPurchaseResponse.contractNo;
    
    logger.info(`Allianz Individual Travel Insurance purchased successfully: ${contractNo}`);
    
  } catch (error) {
    logger.error('Failed to purchase from Allianz API:', error.message);
    
    // Fallback to mock for development/testing
    logger.warn('Using mock Allianz purchase response');
    contractNo = `AZNNG${Math.floor(Math.random() * 1000000000)}`;
    allianzPurchaseResponse = { ContractNo: contractNo, Status: 'Mock' };
  }

  // 2. Calculate TTP markup
  const basePrice = customerDetails.Amount || 7467; // Use amount from quote
  const travelInsuranceCharge = parseFloat(await redisClient.hGet('serviceCharges', 'TRAVEL_INSURANCE_CHARGES')) || 0;
  const finalAmount = basePrice + travelInsuranceCharge;

  // 3. Initiate Paystack payment
  const paystackInitResponse = await paystackService.initializePayment({
    email: customerDetails.Email,
    amount: finalAmount, // Paystack service will convert to kobo
    reference: `TTP-TI-${Date.now()}`,
    callback_url: paymentDetails?.callback_url,
    metadata: {
      productType: 'Travel Insurance',
      policyId: contractNo,
      userId: userId,
      guestEmail: customerDetails.Email,
      guestPhoneNumber: customerDetails.Telephone,
    },
  });
  logger.info(`Paystack payment initiated for ${finalAmount} - Reference: ${paystackInitResponse.data.reference}`);

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
    itemType: 'Insurance', // Fixed: Use 'Insurance' instead of 'Travel Insurance'
    productId: contractNo,
    markupApplied: travelInsuranceCharge,
    profitMargin: travelInsuranceCharge, // Required field - using service charge as profit margin
    totalAmountPaid: finalAmount,
    referralCode: referralCode || null,
    productDetails: {
      allianzContractNo: contractNo,
      allianzResponse: allianzPurchaseResponse,
      destination: customerDetails.Destination,
      coverBegins: customerDetails.CoverBegins,
      coverEnds: customerDetails.CoverEnds,
      noOfPeople: customerDetails.NoOfPeople || 1,
    },
  });

  // 5. Send confirmation email notification
  try {
    if (emailQueue && customerDetails.Email) {
      const emailSubject = `Travel Insurance Purchase Initiated - ${contractNo}`;
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #dc2626; color: white; padding: 20px; text-center; }
            .content { background-color: #f9fafb; padding: 30px; }
            .details { background-color: white; padding: 20px; margin: 20px 0; border-radius: 8px; }
            .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
            .detail-label { font-weight: bold; color: #6b7280; }
            .detail-value { color: #111827; }
            .button { display: inline-block; background-color: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Travel Insurance Purchase Initiated</h1>
            </div>
            <div class="content">
              <p>Dear ${customerDetails.FirstName} ${customerDetails.Surname},</p>
              <p>Your travel insurance purchase has been initiated successfully. Please complete your payment to activate your policy.</p>
              
              <div class="details">
                <h3>Policy Details</h3>
                <div class="detail-row">
                  <span class="detail-label">Contract Number:</span>
                  <span class="detail-value">${contractNo}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Destination:</span>
                  <span class="detail-value">${customerDetails.Destination || 'N/A'}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Coverage Period:</span>
                  <span class="detail-value">${customerDetails.CoverBegins || 'N/A'} to ${customerDetails.CoverEnds || 'N/A'}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Number of Travelers:</span>
                  <span class="detail-value">${customerDetails.NoOfPeople || 1}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Amount:</span>
                  <span class="detail-value">₦${finalAmount.toLocaleString()}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Payment Reference:</span>
                  <span class="detail-value">${paystackInitResponse.data.reference}</span>
                </div>
              </div>

              <div style="text-align: center;">
                <a href="${paystackInitResponse.data.authorization_url}" class="button">Complete Payment Now</a>
              </div>

              <p><strong>Important:</strong> Your policy will only be activated after successful payment. Please complete the payment within 24 hours.</p>
              
              <p>If you have any questions, please contact our support team.</p>
              
              <p>Best regards,<br>The Travel Place Team</p>
            </div>
            <div class="footer">
              <p>This is an automated email. Please do not reply to this message.</p>
              <p>&copy; ${new Date().getFullYear()} The Travel Place. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await emailQueue.add({
        to: customerDetails.Email,
        subject: emailSubject,
        html: emailHtml
      });
      logger.info(`Travel insurance confirmation email queued for ${customerDetails.Email}`);
    } else if (customerDetails.Email) {
      logger.warn('Email queue not available, confirmation email not sent');
    }
  } catch (error) {
    logger.error('Failed to queue travel insurance confirmation email:', error.message);
  }

  ApiResponse.success(res, StatusCodes.OK, 'Travel insurance purchase initiated. Redirect to payment gateway.', {
    authorizationUrl: paystackInitResponse.data.authorization_url,
    reference: paystackInitResponse.data.reference,
    amount: finalAmount,
    contractNo: contractNo,
  });
});

/**
 * @description Purchase Allianz Travel Insurance (Family).
 * @route POST /api/v1/products/travel-insurance/purchase/family
 * @access Private
 */
const purchaseTravelInsuranceFamily = asyncHandler(async (req, res) => {
  const { quoteId, familyMembersDetails, paymentDetails, referralCode } = req.body;
  const userId = req.user ? req.user.userId : null;

  logger.info('Processing family travel insurance purchase', { 
    quoteId, 
    familyCount: familyMembersDetails?.length,
    email: familyMembersDetails?.[0]?.Email,
    userId 
  });

  let contractNo;
  let allianzPurchaseResponse;
  
  try {
    // 1. Call real Allianz API to purchase family policy
    allianzPurchaseResponse = await allianzService.purchaseTravelInsuranceFamily(familyMembersDetails);
    contractNo = allianzPurchaseResponse.ContractNo || allianzPurchaseResponse.contractNo;
    
    logger.info(`Allianz Family Travel Insurance purchased successfully: ${contractNo}`);
    
  } catch (error) {
    logger.error('Failed to purchase family policy from Allianz API:', error.message);
    
    // Fallback to mock for development/testing
    logger.warn('Using mock Allianz family purchase response');
    contractNo = `AZNNG${Math.floor(Math.random() * 1000000000)}`;
    allianzPurchaseResponse = { ContractNo: contractNo, Status: 'Mock' };
  }

  // 2. Calculate TTP markup
  const basePrice = familyMembersDetails[0]?.Amount || 35259.00; // Use amount from quote
  const travelInsuranceCharge = parseFloat(await redisClient.hGet('serviceCharges', 'TRAVEL_INSURANCE_CHARGES')) || 0;
  const finalAmount = basePrice + travelInsuranceCharge;

  // 3. Initiate Paystack payment
  const paystackInitResponse = await paystackService.initializePayment({
    email: familyMembersDetails[0].Email,
    amount: finalAmount, // Paystack service will convert to kobo
    reference: `TTP-TIF-${Date.now()}`,
    callback_url: paymentDetails?.callback_url,
    metadata: {
      productType: 'Travel Insurance Family',
      policyId: contractNo,
      userId: userId,
      guestEmail: familyMembersDetails[0].Email,
      guestPhoneNumber: familyMembersDetails[0].Telephone,
      familyMemberCount: familyMembersDetails.length,
    },
  });
  logger.info(`Paystack payment initiated for ${finalAmount} - Reference: ${paystackInitResponse.data.reference}`);

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
    itemType: 'Insurance', // Fixed: Use 'Insurance' instead of 'Travel Insurance'
    productId: contractNo,
    markupApplied: travelInsuranceCharge,
    profitMargin: travelInsuranceCharge, // Required field - using service charge as profit margin
    totalAmountPaid: finalAmount,
    referralCode: referralCode || null,
    productDetails: {
      allianzContractNo: contractNo,
      allianzResponse: allianzPurchaseResponse,
      familyMemberCount: familyMembersDetails.length,
      destination: familyMembersDetails[0]?.Destination,
      coverBegins: familyMembersDetails[0]?.CoverBegins,
      coverEnds: familyMembersDetails[0]?.CoverEnds,
    },
  });

  ApiResponse.success(res, StatusCodes.OK, 'Family travel insurance purchase initiated. Redirect to payment gateway.', {
    authorizationUrl: paystackInitResponse.data.authorization_url,
    reference: paystackInitResponse.data.reference,
    amount: finalAmount,
    contractNo: contractNo,
  });
});








/**
 * @description Verify travel insurance payment and send confirmation email
 * @route POST /api/v1/products/travel-insurance/verify-payment
 * @access Public
 */
const verifyTravelInsurancePayment = asyncHandler(async (req, res) => {
  const { reference } = req.body;

  if (!reference) {
    throw new ApiError('Payment reference is required', StatusCodes.BAD_REQUEST);
  }

  logger.info(`Verifying travel insurance payment for reference: ${reference}`);

  // 1. Verify payment with Paystack
  const paymentVerification = await paystackService.verifyPayment(reference);
  
  logger.info(`Paystack verification response:`, {
    status: paymentVerification?.status,
    hasData: !!paymentVerification?.data,
    dataStatus: paymentVerification?.data?.status,
    fullResponse: JSON.stringify(paymentVerification, null, 2)
  });

  // Paystack response structure: { status: true, data: { status: 'success' } }
  if (!paymentVerification || !paymentVerification.status || !paymentVerification.data) {
    logger.error('Payment verification failed - invalid response structure', paymentVerification);
    throw new ApiError('Payment verification failed', StatusCodes.BAD_REQUEST);
  }

  // Check the actual transaction status in the data object
  const transactionStatus = paymentVerification.data.status;
  
  // In development/test mode, accept both 'success' and test payment statuses
  const validStatuses = ['success'];
  if (process.env.NODE_ENV === 'development') {
    validStatuses.push('pending', 'ongoing'); // Accept test payments in development
    logger.info(`Development mode: accepting statuses: ${validStatuses.join(', ')}`);
  }

  if (!validStatuses.includes(transactionStatus)) {
    logger.warn(`Payment verification returned status: ${transactionStatus} for reference: ${reference}`);
    throw new ApiError(`Payment verification failed. Transaction status: ${transactionStatus}`, StatusCodes.BAD_REQUEST);
  }

  logger.info(`Payment verification successful with status: ${transactionStatus}`);

  // 2. Find ledger entry
  const ledgerEntry = await Ledger.findOne({ transactionReference: reference });

  if (!ledgerEntry) {
    logger.error(`Ledger entry not found for reference: ${reference}`);
    throw new ApiError('Transaction not found', StatusCodes.NOT_FOUND);
  }

  logger.info(`Found ledger entry:`, {
    id: ledgerEntry._id,
    productId: ledgerEntry.productId,
    guestEmail: ledgerEntry.guestEmail,
    status: ledgerEntry.status
  });

  // 3. Update ledger status to Completed
  ledgerEntry.status = 'Completed';
  ledgerEntry.paymentGatewayResponse = paymentVerification;
  await ledgerEntry.save();

  logger.info(`Travel insurance payment verified successfully: ${reference}`);

  // 4. Send confirmation email with policy details
  try {
    const customerEmail = ledgerEntry.guestEmail;
    const contractNo = ledgerEntry.productId;
    const productDetails = ledgerEntry.productDetails || {};

    if (!customerEmail) {
      logger.warn('No customer email found in ledger entry');
    } else {
      const { getTravelInsuranceConfirmationEmail } = require('../utils/emailTemplates');
      
      const emailSubject = `Travel Insurance Policy Confirmed - ${contractNo}`;
      const emailHtml = getTravelInsuranceConfirmationEmail({
        contractNo,
        customerEmail,
        destination: productDetails.destination,
        coverBegins: productDetails.coverBegins,
        coverEnds: productDetails.coverEnds,
        noOfPeople: productDetails.noOfPeople,
        totalAmount: ledgerEntry.totalAmountPaid,
        paymentReference: reference,
        paymentDate: new Date().toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' })
      });

      // Try to send email via queue first, fallback to direct send
      if (emailQueue) {
        await emailQueue.add({
          to: customerEmail,
          subject: emailSubject,
          html: emailHtml
        });
        logger.info(`Travel insurance confirmation email queued for ${customerEmail}`);
      } else {
        // Fallback: Send email directly if queue is not available
        const { sendEmail } = require('../utils/emailService');
        const emailResult = await sendEmail({
          to: customerEmail,
          subject: emailSubject,
          html: emailHtml
        });
        
        if (emailResult.success) {
          logger.info(`Travel insurance confirmation email sent directly to ${customerEmail}`);
        } else {
          logger.error(`Failed to send email directly: ${emailResult.error}`);
        }
      }
    }
  } catch (error) {
    logger.error('Failed to send travel insurance confirmation email:', error.message);
    // Don't throw error - payment is already verified
  }

  ApiResponse.success(res, StatusCodes.OK, 'Travel insurance payment verified successfully', {
    contractNo: ledgerEntry.productId,
    status: 'Completed',
    amount: ledgerEntry.totalAmountPaid,
    reference: reference
  });
});

// --- Amadeus XML Flight Booking Integration ---

/**
 * @description Search for flights using Amadeus XML SOAP API.
 * @route POST /api/v1/products/flights/search
 * @access Public
 */
const searchFlights = asyncHandler(async (req, res) => {
  const flightSearchCriteria = req.body;
  
  try {
    // Import Amadeus XML service
    const AmadeusXmlService = require('../services/amadeusXmlService');
    const amadeusService = global.amadeusXmlService || new AmadeusXmlService();
    
    logger.info('Searching flights via Amadeus XML', {
      origin: flightSearchCriteria.originLocationCode,
      destination: flightSearchCriteria.destinationLocationCode,
      departureDate: flightSearchCriteria.departureDate,
      returnDate: flightSearchCriteria.returnDate,
      isRoundTrip: !!flightSearchCriteria.returnDate,
      passengers: flightSearchCriteria.adults || 1,
      fullCriteria: flightSearchCriteria
    });

    // Call Amadeus XML service to search flights
    const amadeusResponse = await amadeusService.searchFlightsXml(flightSearchCriteria);
    
    logger.info('Flight search completed successfully', {
      resultsCount: amadeusResponse.meta?.count || 0,
      processingTime: amadeusResponse.meta?.processingTime
    });

    ApiResponse.success(res, StatusCodes.OK, 'Flights fetched successfully', amadeusResponse);
    
  } catch (error) {
    logger.error('Flight search failed', {
      error: error.message,
      searchCriteria: flightSearchCriteria,
      stack: error.stack
    });

    // Handle specific Amadeus XML errors
    if (error.code === 'AMADEUS_XML_PARSE_ERROR') {
      return ApiResponse.error(res, StatusCodes.BAD_GATEWAY, 'Flight search service temporarily unavailable', {
        errorCode: 'FLIGHT_SEARCH_UNAVAILABLE',
        details: 'Unable to process flight search request at this time'
      });
    }

    if (error.code === 'AMADEUS_SOAP_FAULT') {
      return ApiResponse.error(res, StatusCodes.BAD_REQUEST, 'Invalid flight search parameters', {
        errorCode: 'INVALID_SEARCH_CRITERIA',
        details: error.message
      });
    }

    // Log detailed error information for debugging
    logger.error('Detailed Amadeus error information', {
      errorMessage: error.message,
      errorCode: error.code,
      errorStack: error.stack,
      amadeusConfig: {
        endpoint: process.env.AMADEUS_XML_ENDPOINT ? 'SET' : 'NOT SET',
        username: process.env.AMADEUS_XML_USERNAME ? 'SET' : 'NOT SET',
        password: process.env.AMADEUS_XML_PASSWORD ? 'SET' : 'NOT SET',
        officeId: process.env.AMADEUS_XML_OFFICE_ID ? 'SET' : 'NOT SET'
      }
    });

    // Fallback to mock data if Amadeus service is unavailable
    logger.warn('Falling back to mock flight data due to service error');
    
    const itineraries = [{
      duration: 'PT15H30M',
      segments: [{
        departure: {
          iataCode: flightSearchCriteria.originLocationCode,
          at: `${flightSearchCriteria.departureDate}T10:30:00`
        },
        arrival: {
          iataCode: flightSearchCriteria.destinationLocationCode,
          at: `${flightSearchCriteria.departureDate}T18:00:00`
        },
        carrierCode: 'MOCK',
        number: '123'
      }]
    }];

    // Add return itinerary for round-trip flights
    if (flightSearchCriteria.returnDate) {
      itineraries.push({
        duration: 'PT16H45M',
        segments: [{
          departure: {
            iataCode: flightSearchCriteria.destinationLocationCode,
            at: `${flightSearchCriteria.returnDate}T11:15:00`
          },
          arrival: {
            iataCode: flightSearchCriteria.originLocationCode,
            at: `${flightSearchCriteria.returnDate}T20:00:00`
          },
          carrierCode: 'MOCK',
          number: '456'
        }]
      });
    }

    logger.info('Generated mock flight data with round-trip support', {
      isRoundTrip: !!flightSearchCriteria.returnDate,
      itinerariesCount: itineraries.length,
      departureDate: flightSearchCriteria.departureDate,
      returnDate: flightSearchCriteria.returnDate
    });

    const mockFlights = {
      meta: {
        count: 2,
        currency: flightSearchCriteria.currencyCode || 'NGN',
        processingTime: 150
      },
      data: [
        {
          type: 'flight-offer',
          id: 'MOCK-FL-001',
          source: 'MOCK',
          validatingAirlineCodes: ['MOCK'],
          price: {
            currency: flightSearchCriteria.currencyCode || 'NGN',
            total: '850000.00',
            base: '750000.00',
            grandTotal: '855000.00'
          },
          itineraries: itineraries
        }
      ],
      dictionaries: {
        carriers: {
          'MOCK': 'Mock Airlines (Service Unavailable)'
        }
      }
    };
    
    ApiResponse.success(res, StatusCodes.OK, 'Flights fetched successfully (mock data)', mockFlights);
  }
});

/**
 * @description Book a flight using Amadeus XML SOAP API.
 * @route POST /api/v1/products/flights/book
 * @access Private
 */
const bookFlight = asyncHandler(async (req, res) => {
  const { flightDetails, passengerDetails, paymentDetails, referralCode, isGuestBooking, guestContactInfo } = req.body;
  const userId = req.user ? req.user.userId : null;
  const isGuest = isGuestBooking || !userId;

  // Extract contact information (prioritize guestContactInfo for guest bookings)
  const contactEmail = isGuest && guestContactInfo?.email 
    ? guestContactInfo.email 
    : passengerDetails[0]?.contact?.emailAddress;
  
  // Format phone number to E.164 format
  let contactPhone = null;
  if (isGuest && guestContactInfo?.phone) {
    // For guest bookings, ensure phone is in E.164 format
    let phone = guestContactInfo.phone.replace(/\D/g, ''); // Remove non-digits
    if (phone.startsWith('0')) {
      phone = phone.substring(1); // Remove leading 0
    }
    // Add country code if not present
    if (!phone.startsWith('234') && guestContactInfo.dialCode === '+234') {
      phone = '234' + phone;
    }
    contactPhone = '+' + phone;
  } else if (passengerDetails[0]?.contact?.phones?.[0]) {
    // For registered users, combine country code and number
    const countryCode = passengerDetails[0].contact.phones[0].countryCallingCode;
    let number = passengerDetails[0].contact.phones[0].number.replace(/\D/g, '');
    if (number.startsWith('0')) {
      number = number.substring(1); // Remove leading 0
    }
    contactPhone = `+${countryCode}${number}`;
  }

  // Debug logging for phone number validation
  logger.info('Phone number debug info', {
    isGuest: isGuest,
    guestContactInfo: guestContactInfo,
    formattedContactPhone: contactPhone,
    contactEmail: contactEmail,
    passengerPhones: passengerDetails[0]?.contact?.phones,
    phoneValidation: {
      regex: '/^\\+?[1-9]\\d{1,14}$/',
      isValid: contactPhone ? /^\+?[1-9]\d{1,14}$/.test(contactPhone) : false
    }
  });

  try {
    // Import required services
    const AmadeusXmlService = require('../services/amadeusXmlService');
    const paystackService = require('../services/paystackService');
    const amadeusService = global.amadeusXmlService || new AmadeusXmlService();

    logger.info('Initiating flight booking via Amadeus XML', {
      flightId: flightDetails.id,
      passengerEmail: contactEmail,
      userId: userId,
      isGuest: isGuest,
      passengerCount: passengerDetails.length
    });

    // 1. Prepare traveler data for Amadeus XML (use the array structure from frontend)
    const travelers = passengerDetails.map((passenger, index) => ({
      id: passenger.id || `${index + 1}`,
      dateOfBirth: passenger.dateOfBirth || "1990-01-01",
      name: {
        firstName: passenger.name.firstName,
        lastName: passenger.name.lastName
      },
      gender: passenger.gender,
      contact: {
        emailAddress: passenger.contact.emailAddress,
        phones: passenger.contact.phones || [{
          deviceType: "MOBILE",
          countryCallingCode: "234",
          number: "8012345678"
        }]
      },
      documents: passenger.documents || [{
        documentType: "PASSPORT",
        number: "TEMP123456",
        expiryDate: "2030-12-31",
        issuanceCountry: "NG",
        nationality: "NG",
        holder: true
      }]
    }));

    // 2. Calculate TTP markup and final amount
    const basePrice = parseFloat(flightDetails.price?.total || flightDetails.price?.base || flightDetails.price || 0);
    const flightBookingCharge = parseFloat(await redisClient.hGet('serviceCharges', 'FLIGHT_BOOKING_CHARGES')) || 5000;
    const finalAmount = basePrice + flightBookingCharge;

    // 3. Create payment reference
    const paymentReference = `TTP-FL-${Date.now()}`;

    // 4. Initiate Paystack payment first (before Amadeus booking)
    const paystackInitResponse = await paystackService.initializePayment({
      email: contactEmail,
      amount: finalAmount, // Amount in Naira, Paystack service will convert to kobo
      reference: paymentReference,
      currency: paymentDetails?.currency || 'NGN',
      callback_url: paymentDetails?.callback_url,
      metadata: {
        productType: 'Flight Booking',
        flightId: flightDetails.id,
        userId: userId,
        guestEmail: contactEmail,
        guestPhoneNumber: contactPhone,
        basePrice: basePrice,
        serviceCharge: flightBookingCharge,
        referralCode: referralCode || null,
        isGuestBooking: isGuest
      },
    });

    if (!paystackInitResponse.status) {
      throw new Error(`Paystack initialization failed: ${paystackInitResponse.message}`);
    }

    logger.info('Paystack payment initialized successfully', {
      reference: paymentReference,
      amount: finalAmount,
      authUrl: paystackInitResponse.data.authorization_url
    });

    // 5. Create a temporary booking hold (will be confirmed after payment)
    // Note: For now, we'll create the booking after payment verification
    // This is safer as we don't want to hold seats without confirmed payment
    
    // 6. Record transaction in Ledger as PENDING
    const ledgerEntry = await Ledger.create({
      userId: isGuest ? null : userId, // Set userId to null for guest bookings
      usertype: isGuest ? 'guest' : 'registered', // Add usertype field
      guestEmail: contactEmail,
      guestPhoneNumber: contactPhone,
      transactionReference: paymentReference,
      amount: basePrice,
      currency: paymentDetails?.currency || 'NGN',
      status: 'Pending',
      paymentGateway: 'Paystack',
      paymentGatewayResponse: paystackInitResponse.data,
      productType: 'Flight Booking',
      itemType: 'Flight', // Required field
      productId: flightDetails.id,
      markupApplied: flightBookingCharge,
      profitMargin: flightBookingCharge, // Required field - using service charge as profit margin
      totalAmountPaid: finalAmount,
      referralCode: referralCode || null,
      productDetails: {
        flightDetails: flightDetails,
        passengerDetails: passengerDetails.map(p => ({
          firstName: p.name.firstName,
          lastName: p.name.lastName,
          email: p.contact.emailAddress,
          phone: p.contact.phones?.[0]?.number,
          gender: p.gender,
          dateOfBirth: p.dateOfBirth
        })),
        guestContactInfo: isGuest ? guestContactInfo : null,
        travelers: travelers,
        bookingStatus: 'Payment Pending'
      },
    });

    logger.info('Flight booking transaction recorded', {
      ledgerId: ledgerEntry._id,
      reference: paymentReference,
      status: 'Pending'
    });

    // 7. Return payment details to frontend
    ApiResponse.success(res, StatusCodes.OK, 'Flight booking initiated. Complete payment to confirm booking.', {
      bookingReference: paymentReference,
      authorizationUrl: paystackInitResponse.data.authorization_url,
      paymentReference: paymentReference,
      amount: finalAmount,
      currency: paymentDetails?.currency || 'NGN',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
      passengers: travelers.map(t => ({
        id: t.id,
        name: t.name
      })),
      flightDetails: {
        id: flightDetails.id,
        price: {
          total: basePrice.toString(),
          currency: paymentDetails?.currency || 'NGN'
        }
      },
      serviceCharges: {
        flightBookingCharges: flightBookingCharge
      },
      instructions: {
        payment: "Complete payment within 30 minutes to confirm booking",
        documents: "Ensure passport is valid for at least 6 months from travel date"
      }
    });

  } catch (error) {
    logger.error('Flight booking failed', {
      error: error.message,
      flightId: flightDetails?.id,
      contactEmail: contactEmail,
      isGuest: isGuest,
      stack: error.stack
    });

    // Handle specific errors
    if (error.message.includes('Paystack')) {
      return ApiResponse.error(res, StatusCodes.BAD_GATEWAY, 'Payment service temporarily unavailable', {
        errorCode: 'PAYMENT_SERVICE_ERROR',
        details: 'Unable to initialize payment at this time'
      });
    }

    if (error.code === 'AMADEUS_XML_PARSE_ERROR') {
      return ApiResponse.error(res, StatusCodes.BAD_GATEWAY, 'Flight booking service temporarily unavailable', {
        errorCode: 'BOOKING_SERVICE_ERROR',
        details: 'Unable to process flight booking request at this time'
      });
    }

    return ApiResponse.error(res, StatusCodes.INTERNAL_SERVER_ERROR, 'Flight booking failed', {
      errorCode: 'BOOKING_FAILED',
      details: error.message
    });
  }
});

/**
 * @description Verify flight payment and complete Amadeus booking.
 * @route POST /api/v1/products/flights/verify-payment
 * @access Public (webhook-style endpoint)
 */
const verifyFlightPayment = asyncHandler(async (req, res) => {
  const { reference } = req.body;

  if (!reference) {
    throw new ApiError('Payment reference is required', StatusCodes.BAD_REQUEST);
  }

  try {
    // Find the ledger entry
    const ledgerEntry = await Ledger.findOne({ transactionReference: reference });
    if (!ledgerEntry) {
      throw new ApiError('Transaction not found', StatusCodes.NOT_FOUND);
    }

    // Check if already processed
    if (ledgerEntry.status === 'Completed') {
      logger.info('Payment already verified, skipping duplicate processing', {
        reference: reference,
        bookingReference: ledgerEntry.productDetails?.amadeusBookingRef
      });
      return ApiResponse.success(res, StatusCodes.OK, 'Payment already verified', {
        transactionReference: reference,
        status: 'Completed',
        bookingReference: ledgerEntry.productDetails?.amadeusBookingRef,
        amountPaid: ledgerEntry.totalAmountPaid,
        currency: ledgerEntry.currency
      });
    }

    // Import required services
    const paystackService = require('../services/paystackService');
    const AmadeusXmlService = require('../services/amadeusXmlService');
    const amadeusService = global.amadeusXmlService || new AmadeusXmlService();

    // Verify payment with Paystack
    const paystackVerification = await paystackService.verifyPayment(reference);

    if (paystackVerification.data.status === 'success') {
      logger.info('Payment verified successfully, proceeding with Amadeus booking', {
        reference: reference,
        amount: paystackVerification.data.amount / 100
      });

      let amadeusBookingRef = null;
      let bookingStatus = 'Payment Confirmed';

      try {
        // Extract flight and passenger details from ledger
        const { flightDetails, travelers } = ledgerEntry.productDetails;

        // Create Amadeus booking options
        const bookingOptions = {
          contactEmail: ledgerEntry.guestEmail,
          contactPhone: ledgerEntry.guestPhoneNumber
        };

        // Attempt to book with Amadeus XML
        const amadeusBookingResponse = await amadeusService.bookFlightXml(
          flightDetails,
          travelers,
          bookingOptions
        );

        amadeusBookingRef = amadeusBookingResponse.data?.id || `AMADEUS-${Date.now()}`;
        bookingStatus = 'Booking Confirmed';

        logger.info('Amadeus booking completed successfully', {
          reference: reference,
          amadeusRef: amadeusBookingRef
        });

      } catch (amadeusError) {
        logger.error('Amadeus booking failed after payment confirmation', {
          reference: reference,
          error: amadeusError.message,
          stack: amadeusError.stack
        });

        // Even if Amadeus booking fails, we still mark payment as successful
        // and will handle the booking manually
        amadeusBookingRef = `MANUAL-${Date.now()}`;
        bookingStatus = 'Payment Confirmed - Manual Booking Required';
      }

      // Check if notification was already sent (before updating)
      const notificationAlreadySent = ledgerEntry.productDetails?.notificationSent === true;

      // Update ledger entry
      ledgerEntry.status = 'Completed';
      ledgerEntry.paymentGatewayResponse = paystackVerification.data;
      ledgerEntry.productDetails = {
        ...ledgerEntry.productDetails,
        amadeusBookingRef: amadeusBookingRef,
        bookingStatus: bookingStatus,
        paymentConfirmedAt: new Date(),
        amadeusBookingCompletedAt: bookingStatus === 'Booking Confirmed' ? new Date() : null
      };
      await ledgerEntry.save();

      // Send confirmation notifications only if not already sent
      if (!notificationAlreadySent) {
        try {
          await sendFlightBookingNotifications({
            customerEmail: ledgerEntry.guestEmail,
            customerPhone: ledgerEntry.guestPhoneNumber,
            bookingReference: amadeusBookingRef,
            paymentReference: reference,
            flightDetails: ledgerEntry.productDetails.flightDetails,
            passengerDetails: ledgerEntry.productDetails.passengerDetails,
            totalAmount: ledgerEntry.totalAmountPaid,
            currency: ledgerEntry.currency,
            bookingStatus: bookingStatus
          });
          
          // Mark notification as sent
          ledgerEntry.productDetails.notificationSent = true;
          ledgerEntry.productDetails.notificationSentAt = new Date();
          await ledgerEntry.save();
          
          logger.info('Flight booking notifications sent successfully', { reference });
        } catch (notificationError) {
          logger.error('Failed to send flight booking notifications', {
            reference: reference,
            error: notificationError.message
          });
          // Don't fail the entire process if notifications fail
        }
      } else {
        logger.info('Notification already sent, skipping duplicate send', { reference });
      }

      logger.info(`Flight booking completed: ${reference} with Amadeus ref: ${amadeusBookingRef}`);

      ApiResponse.success(res, StatusCodes.OK, 'Flight payment verified and booking confirmed', {
        paymentStatus: 'success',
        transactionReference: reference,
        amountPaid: paystackVerification.data.amount / 100,
        currency: ledgerEntry.currency,
        paidAt: new Date(paystackVerification.data.paid_at).toISOString(),
        applicationStatus: bookingStatus,
        bookingReference: amadeusBookingRef,
        nextSteps: bookingStatus === 'Booking Confirmed' 
          ? "Your flight has been successfully booked. You will receive your e-ticket via email shortly."
          : "Your payment has been confirmed. Our team will complete your booking manually and send you the confirmation within 24 hours."
      });

    } else {
      // Update ledger entry as failed
      ledgerEntry.status = 'Failed';
      ledgerEntry.paymentGatewayResponse = paystackVerification.data;
      await ledgerEntry.save();

      logger.warn('Flight payment verification failed', {
        reference: reference,
        paystackStatus: paystackVerification.data.status
      });

      throw new ApiError('Payment verification failed', StatusCodes.BAD_REQUEST);
    }

  } catch (error) {
    logger.error('Flight payment verification error', {
      reference: reference,
      error: error.message,
      stack: error.stack
    });

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Failed to verify flight payment. Please contact support.', StatusCodes.INTERNAL_SERVER_ERROR);
  }
});

/**
 * @description Send flight booking confirmation notifications.
 * @param {object} notificationData - Data for notifications
 */
const sendFlightBookingNotifications = async (notificationData) => {
  const {
    customerEmail,
    customerPhone,
    bookingReference,
    paymentReference,
    flightDetails,
    passengerDetails,
    totalAmount,
    currency,
    bookingStatus
  } = notificationData;

  try {
    // Import notification services
    const { sendEmail } = require('../utils/emailService');
    const { getFlightConfirmationEmail } = require('../utils/emailTemplates');
    const smsService = require('../utils/smsService');

    // Prepare passenger data
    const firstPassenger = Array.isArray(passengerDetails) ? passengerDetails[0] : passengerDetails;
    const passengerName = firstPassenger?.firstName && firstPassenger?.lastName 
      ? `${firstPassenger.firstName} ${firstPassenger.lastName}`
      : 'Valued Customer';
    
    const passengerCount = Array.isArray(passengerDetails) ? passengerDetails.length : 1;
    
    // Extract flight information
    const firstItinerary = flightDetails?.itineraries?.[0];
    const firstSegment = firstItinerary?.segments?.[0];
    const lastSegment = firstItinerary?.segments?.[firstItinerary.segments.length - 1];
    
    const airline = flightDetails?.validatingAirlineCodes?.[0] || 'Airline';
    const flightNumber = firstSegment ? `${firstSegment.carrierCode}${firstSegment.number}` : 'N/A';
    const departure = firstSegment?.departure?.iataCode || 'DEP';
    const arrival = lastSegment?.arrival?.iataCode || 'ARR';
    const departureTime = firstSegment?.departure?.at ? new Date(firstSegment.departure.at).toLocaleString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) : 'N/A';
    const arrivalTime = lastSegment?.arrival?.at ? new Date(lastSegment.arrival.at).toLocaleString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) : 'N/A';
    
    const emailSubject = `✈️ Flight Booking Confirmed - ${bookingReference}`;
    const emailHtml = getFlightConfirmationEmail({
      bookingReference,
      pnr: bookingReference,
      airline,
      flightNumber,
      departure,
      arrival,
      departureTime,
      arrivalTime,
      passengers: passengerCount,
      totalAmount,
      passengerName
    });

    // Send email notification
    if (customerEmail) {
      await sendEmail({
        to: customerEmail,
        subject: emailSubject,
        html: emailHtml
      });
      logger.info('Flight booking confirmation email sent', { email: customerEmail, reference: bookingReference });
    }

    // Send SMS notification
    if (customerPhone) {
      const smsMessage = `Flight booking confirmed! Reference: ${bookingReference}. Amount: ${currency} ${totalAmount.toLocaleString()}. Status: ${bookingStatus}. Thank you for choosing The Travel Place!`;
      
      await smsService.sendSMS({
        to: customerPhone,
        message: smsMessage
      });
      logger.info('Flight booking confirmation SMS sent', { phone: customerPhone, reference: bookingReference });
    }

  } catch (error) {
    logger.error('Failed to send flight booking notifications', {
      error: error.message,
      bookingReference: bookingReference
    });
    throw error;
  }
};


// --- Ratehawk Hotel Booking Integration (Placeholder) ---

/**
 * @description Search for hotels using Ratehawk API.
 * @route POST /api/v1/products/hotels/search
 * @access Public
 */
const searchHotels = asyncHandler(async (req, res) => {
  const hotelSearchCriteria = req.body;
  
  try {
    logger.info('Hotel search request received:', hotelSearchCriteria);
    
    // Call Ratehawk API for hotel search
    const ratehawkResponse = await ratehawkService.searchHotels(hotelSearchCriteria);
    
    logger.info(`Found ${ratehawkResponse.totalResults} hotels`);
    
    ApiResponse.success(res, StatusCodes.OK, 'Hotels fetched successfully', {
      searchId: ratehawkResponse.searchId,
      hotels: ratehawkResponse.hotels,
      totalResults: ratehawkResponse.totalResults,
      searchCriteria: hotelSearchCriteria
    });
  } catch (error) {
    logger.error('Hotel search failed:', error.message);
    
    // Fallback to mock data if API fails (for development)
    if (process.env.NODE_ENV === 'development') {
      logger.warn('Falling back to mock hotel data due to API error');
      const mockHotels = [
        { 
          id: 'HTL001', 
          name: 'Mock Hotel Lagos', 
          price: 150000, 
          currency: 'NGN',
          address: 'Victoria Island, Lagos',
          stars: 4,
          rating: 4.2,
          reviewCount: 156
        },
        { 
          id: 'HTL002', 
          name: 'Fake Inn Abuja', 
          price: 120000, 
          currency: 'NGN',
          address: 'Maitama, Abuja',
          stars: 3,
          rating: 3.8,
          reviewCount: 89
        },
      ];
      ApiResponse.success(res, StatusCodes.OK, 'Hotels fetched successfully (mock data)', { 
        hotels: mockHotels,
        totalResults: mockHotels.length,
        searchCriteria: hotelSearchCriteria,
        isMockData: true
      });
    } else {
      throw error;
    }
  }
});

/**
 * @description Book a hotel using Ratehawk API.
 * @route POST /api/v1/products/hotels/book
 * @access Private
 */
const bookHotel = asyncHandler(async (req, res) => {
  const { hotelDetails, guestDetails, paymentDetails, referralCode, searchId, roomId } = req.body;
  const userId = req.user ? req.user.userId : null;

  try {
    logger.info('Hotel booking request received:', { hotelDetails, guestDetails });

    // 1. Get service charges
    const hotelReservationCharge = parseFloat(await redisClient.hGet('serviceCharges', 'HOTEL_RESERVATION_CHARGES')) || 3000;
    
    // 2. Calculate pricing
    const basePrice = parseFloat(hotelDetails.price);
    const finalAmount = basePrice + hotelReservationCharge;

    // 3. Create booking reference
    const bookingReference = `TTP-HTL-${Date.now()}`;
    const paystackReference = `TTP-HTL-PAY-${Date.now()}`;

    // 4. Initiate Paystack payment
    const paystackInitResponse = await paystackService.initializePayment({
      email: guestDetails.email,
      amount: finalAmount, // Amount in Naira, Paystack service will convert to kobo
      reference: paystackReference,
      callback_url: paymentDetails.callback_url,
      metadata: {
        productType: 'Hotel Reservation',
        bookingRef: bookingReference,
        userId: userId,
        guestEmail: guestDetails.email,
        guestPhoneNumber: guestDetails.phoneNumber,
        hotelId: hotelDetails.id,
        hotelName: hotelDetails.name,
        searchId: searchId,
        roomId: roomId,
        checkIn: hotelDetails.checkInDate,
        checkOut: hotelDetails.checkOutDate,
        referralCode: referralCode || null
      },
    });

    if (!paystackInitResponse.status) {
      throw new ApiError('Failed to initialize payment', StatusCodes.BAD_REQUEST);
    }

    logger.info(`Paystack payment initiated for hotel booking: ${paystackReference}`);

    // 5. Record transaction in Ledger as PENDING
    const ledgerEntry = await Ledger.create({
      userId,
      guestEmail: guestDetails.email,
      guestPhoneNumber: guestDetails.phoneNumber,
      transactionReference: paystackReference,
      amount: basePrice,
      currency: hotelDetails.currency || 'NGN',
      status: 'Pending',
      paymentGateway: 'Paystack',
      paymentGatewayResponse: paystackInitResponse.data,
      productType: 'Hotel Reservation',
      itemType: 'Hotel', // Required field for Ledger model
      productId: bookingReference,
      markupApplied: hotelReservationCharge,
      profitMargin: hotelReservationCharge, // Required field - using service charge as profit margin
      totalAmountPaid: finalAmount,
      referralCode: referralCode || null,
      productDetails: {
        hotelId: hotelDetails.id,
        hotelName: hotelDetails.name,
        searchId: searchId,
        roomId: roomId,
        checkInDate: hotelDetails.checkInDate,
        checkOutDate: hotelDetails.checkOutDate,
        guestName: `${guestDetails.firstName} ${guestDetails.lastName}`,
        roomType: hotelDetails.roomName || 'Standard Room',
        // Note: Actual Ratehawk booking will be made after payment confirmation
        pendingRatehawkBooking: true
      },
    });

    logger.info(`Ledger entry created for hotel booking: ${ledgerEntry._id}`);

    ApiResponse.success(res, StatusCodes.OK, 'Hotel booking initiated. Please complete payment to confirm reservation.', {
      bookingReference: bookingReference,
      authorizationUrl: paystackInitResponse.data.authorization_url,
      paymentReference: paystackReference,
      amount: finalAmount,
      currency: hotelDetails.currency || 'NGN',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
      hotelDetails: {
        id: hotelDetails.id,
        name: hotelDetails.name,
        checkIn: hotelDetails.checkInDate,
        checkOut: hotelDetails.checkOutDate,
        roomType: hotelDetails.roomName || 'Standard Room'
      },
      guestDetails: {
        name: `${guestDetails.firstName} ${guestDetails.lastName}`,
        email: guestDetails.email,
        phone: guestDetails.phoneNumber
      },
      serviceCharges: {
        hotelReservationCharges: hotelReservationCharge
      },
      instructions: {
        payment: 'Complete payment within 30 minutes to confirm hotel reservation',
        cancellation: 'Cancellation policy depends on hotel terms and conditions'
      }
    });

  } catch (error) {
    logger.error('Hotel booking failed:', error.message);
    throw error;
  }
});

/**
 * @description Verify hotel payment and complete Ratehawk booking.
 * @route POST /api/v1/products/hotels/verify-payment
 * @access Public (webhook-style endpoint)
 */
const verifyHotelPayment = asyncHandler(async (req, res) => {
  const { reference } = req.body;

  if (!reference) {
    throw new ApiError('Payment reference is required', StatusCodes.BAD_REQUEST);
  }

  try {
    // Find the ledger entry
    const ledgerEntry = await Ledger.findOne({ transactionReference: reference });
    if (!ledgerEntry) {
      throw new ApiError('Transaction not found', StatusCodes.NOT_FOUND);
    }

    // Check if already processed
    if (ledgerEntry.status === 'Completed') {
      return ApiResponse.success(res, StatusCodes.OK, 'Payment already verified', {
        transactionReference: reference,
        status: 'Completed',
        bookingReference: ledgerEntry.productDetails?.ratehawkBookingRef
      });
    }

    // Verify payment with Paystack
    const paystackVerification = await paystackService.verifyPayment(reference);

    if (paystackVerification.data.status === 'success') {
      logger.info('Hotel payment verified successfully, proceeding with Ratehawk booking', {
        reference: reference,
        amount: paystackVerification.data.amount / 100
      });

      let ratehawkBookingRef = null;
      let bookingStatus = 'Payment Confirmed';

      try {
        // Extract hotel booking details from ledger
        const { searchId, roomId, hotelId, hotelName, checkInDate, checkOutDate, guestName } = ledgerEntry.productDetails;

        // Prepare guest details for Ratehawk
        const guestDetails = {
          firstName: guestName.split(' ')[0],
          lastName: guestName.split(' ').slice(1).join(' '),
          email: ledgerEntry.guestEmail,
          phoneNumber: ledgerEntry.guestPhoneNumber
        };

        const hotelDetails = {
          id: hotelId,
          name: hotelName,
          checkInDate: checkInDate,
          checkOutDate: checkOutDate
        };

        // Attempt to book with Ratehawk
        const ratehawkBookingResponse = await ratehawkService.bookHotel({
          searchId: searchId,
          roomId: roomId,
          guestDetails: guestDetails,
          hotelDetails: hotelDetails
        });

        ratehawkBookingRef = ratehawkBookingResponse.bookingReference;
        bookingStatus = 'Booking Confirmed';

        logger.info('Ratehawk hotel booking completed successfully', {
          reference: reference,
          ratehawkRef: ratehawkBookingRef
        });

      } catch (ratehawkError) {
        logger.error('Ratehawk booking failed after payment confirmation', {
          reference: reference,
          error: ratehawkError.message,
          stack: ratehawkError.stack
        });

        // Even if Ratehawk booking fails, we still mark payment as successful
        // and will handle the booking manually
        ratehawkBookingRef = `MANUAL-HTL-${Date.now()}`;
        bookingStatus = 'Payment Confirmed - Manual Booking Required';
      }

      // Update ledger entry
      ledgerEntry.status = 'Completed';
      ledgerEntry.paymentGatewayResponse = paystackVerification.data;
      ledgerEntry.productDetails = {
        ...ledgerEntry.productDetails,
        ratehawkBookingRef: ratehawkBookingRef,
        bookingStatus: bookingStatus,
        paymentConfirmedAt: new Date(),
        ratehawkBookingCompletedAt: bookingStatus === 'Booking Confirmed' ? new Date() : null
      };
      await ledgerEntry.save();

      // Send confirmation notifications
      try {
        await sendHotelBookingNotifications({
          customerEmail: ledgerEntry.guestEmail,
          customerPhone: ledgerEntry.guestPhoneNumber,
          bookingReference: ratehawkBookingRef,
          paymentReference: reference,
          hotelDetails: ledgerEntry.productDetails,
          totalAmount: ledgerEntry.totalAmountPaid,
          currency: ledgerEntry.currency,
          bookingStatus: bookingStatus
        });
      } catch (notificationError) {
        logger.error('Failed to send hotel booking notifications', {
          reference: reference,
          error: notificationError.message
        });
        // Don't fail the entire process if notifications fail
      }

      logger.info(`Hotel booking completed: ${reference} with Ratehawk ref: ${ratehawkBookingRef}`);

      ApiResponse.success(res, StatusCodes.OK, 'Hotel payment verified and booking confirmed', {
        paymentStatus: 'success',
        transactionReference: reference,
        amountPaid: paystackVerification.data.amount / 100,
        currency: ledgerEntry.currency,
        paidAt: new Date(paystackVerification.data.paid_at).toISOString(),
        applicationStatus: bookingStatus,
        bookingReference: ratehawkBookingRef,
        hotelDetails: {
          name: ledgerEntry.productDetails.hotelName,
          checkIn: ledgerEntry.productDetails.checkInDate,
          checkOut: ledgerEntry.productDetails.checkOutDate,
          guestName: ledgerEntry.productDetails.guestName
        },
        nextSteps: bookingStatus === 'Booking Confirmed' 
          ? "Your hotel reservation has been successfully confirmed. You will receive your booking confirmation via email shortly."
          : "Your payment has been confirmed. Our team will complete your hotel reservation manually and send you the confirmation within 24 hours."
      });

    } else {
      // Update ledger entry as failed
      ledgerEntry.status = 'Failed';
      ledgerEntry.paymentGatewayResponse = paystackVerification.data;
      await ledgerEntry.save();

      logger.warn('Hotel payment verification failed', {
        reference: reference,
        paystackStatus: paystackVerification.data.status
      });

      throw new ApiError('Payment verification failed', StatusCodes.BAD_REQUEST);
    }

  } catch (error) {
    logger.error('Hotel payment verification error', {
      reference: reference,
      error: error.message,
      stack: error.stack
    });

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Failed to verify hotel payment. Please contact support.', StatusCodes.INTERNAL_SERVER_ERROR);
  }
});

/**
 * @description Send hotel booking confirmation notifications.
 * @param {object} notificationData - Data for notifications
 */
const sendHotelBookingNotifications = async (notificationData) => {
  const {
    customerEmail,
    customerPhone,
    bookingReference,
    paymentReference,
    hotelDetails,
    totalAmount,
    currency,
    bookingStatus
  } = notificationData;

  try {
    // Import notification services
    const { sendEmail } = require('../utils/emailService');
    const { getHotelConfirmationEmail } = require('../utils/emailTemplates');
    const smsService = require('../utils/smsService');

    // Prepare email content using new template
    const emailSubject = `Hotel Booking Confirmation - ${bookingReference}`;
    const emailHtml = getHotelConfirmationEmail({
      bookingReference,
      hotelName: hotelDetails.hotelName,
      location: hotelDetails.location || `${hotelDetails.city || ''}, ${hotelDetails.country || ''}`.trim(),
      checkIn: hotelDetails.checkInDate,
      checkOut: hotelDetails.checkOutDate,
      nights: hotelDetails.nights || 1,
      rooms: hotelDetails.rooms || 1,
      guests: hotelDetails.guests || 1,
      totalAmount,
      guestName: hotelDetails.guestName,
      guestEmail: customerEmail
    });

    // Send email notification
    await sendEmail({
      to: customerEmail,
      subject: emailSubject,
      html: emailHtml
    });

    // Prepare SMS content
    const smsMessage = `Hotel booking ${bookingStatus === 'Booking Confirmed' ? 'confirmed' : 'received'}! Ref: ${bookingReference}. Hotel: ${hotelDetails.hotelName}. Check-in: ${hotelDetails.checkInDate}. Amount: ${currency} ${totalAmount.toLocaleString()}. - The Travel Place`;

    // Send SMS notification
    await smsService.sendSMS(customerPhone, smsMessage);

    logger.info('Hotel booking notifications sent successfully', {
      email: customerEmail,
      phone: customerPhone,
      bookingRef: bookingReference
    });

  } catch (error) {
    logger.error('Failed to send hotel booking notifications:', error.message);
    throw error;
  }
};


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
        const { sendWhatsAppMessage } = require('../utils/whatsappService');
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

  // Get visa requirements and calculate fees from external API
  let fees, requirements;
  try {
    const nationality = personalInformation?.nationality || 'Nigeria';
    
    // Get visa requirements from external API
    const requirementsResponse = await visaProcessingService.getVisaRequirements(
      destinationCountry, 
      visaType, 
      nationality
    );
    requirements = requirementsResponse.data;

    // Calculate fees using external API
    const feesResponse = await visaProcessingService.calculateVisaFees(
      destinationCountry, 
      visaType, 
      urgency, 
      nationality
    );
    fees = feesResponse.data;
  } catch (error) {
    logger.error('Failed to get visa requirements or fees from external API:', error.message);
    // Fallback to local calculation
    fees = calculateVisaFees(destinationCountry, visaType, urgency);
    requirements = null;
  }

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
    referralCode: referralCode || null,
    // Store external API requirements if available
    ...(requirements && { 
      externalRequirements: requirements,
      documentTypes: requirements.documentTypes || []
    })
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
      paymentStatus: visaApplication.paymentStatus,
      ...(requirements && {
        requirements: {
          documentTypes: requirements.documentTypes,
          additionalInfo: requirements.additionalInfo,
          processingTime: requirements.processingTime
        }
      })
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
    // Upload file using fileService (supports S3, Cloudflare, or Cloudinary)
    const result = await fileService.uploadFile(req.file.path, `visa-documents/${id}`, {
      quality: 'auto:good',
      width: 1200,
      height: 1600,
      crop: 'limit',
      contentType: req.file.mimetype
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

    // Perform automated document verification
    let verificationResult = null;
    try {
      const verificationResponse = await visaProcessingService.verifyDocuments(
        [documentData], 
        visaApplication.visaType, 
        visaApplication.destinationCountry
      );
      verificationResult = verificationResponse.data;
      
      // Update document with verification results
      const docIndex = visaApplication.documents.length - 1;
      visaApplication.documents[docIndex].verification = {
        status: verificationResult.documents[0]?.status || 'requires_review',
        confidence: verificationResult.documents[0]?.confidence || 0,
        issues: verificationResult.documents[0]?.issues || [],
        suggestions: verificationResult.documents[0]?.suggestions || [],
        verifiedAt: new Date()
      };
      await visaApplication.save();
    } catch (verificationError) {
      logger.error('Document verification failed:', verificationError.message);
      // Continue without verification - it's not critical for upload success
    }

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
        uploadedAt: documentData.uploadedAt,
        ...(verificationResult && {
          verification: {
            status: verificationResult.documents[0]?.status,
            confidence: verificationResult.documents[0]?.confidence,
            issues: verificationResult.documents[0]?.issues,
            suggestions: verificationResult.documents[0]?.suggestions
          }
        })
      },
      visaApplication: {
        id: visaApplication._id,
        status: visaApplication.status,
        totalDocuments: visaApplication.documents.length,
        applicationReference: visaApplication.applicationReference
      },
      ...(verificationResult && {
        overallVerification: {
          status: verificationResult.overallStatus,
          score: verificationResult.verificationScore,
          missingDocuments: verificationResult.missingDocuments
        }
      })
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

  // Check for real-time status updates from external API if we have an external reference
  let externalStatus = null;
  if (visaApplication.externalReference) {
    try {
      const statusResponse = await visaProcessingService.checkVisaStatus(
        visaApplication.externalReference,
        visaApplication.applicationReference
      );
      externalStatus = statusResponse.data;
      
      // Update local status if external status has changed
      if (externalStatus.status !== visaApplication.externalStatus) {
        visaApplication.externalStatus = externalStatus.status;
        visaApplication.lastExternalStatusCheck = new Date();
        
        // Map external status to internal status if needed
        const statusMapping = {
          'Submitted': 'Under Review',
          'In Review': 'Under Review',
          'Documents Required': 'Additional Documents Required',
          'Approved': 'Approved',
          'Rejected': 'Rejected'
        };
        
        const mappedStatus = statusMapping[externalStatus.status];
        if (mappedStatus && mappedStatus !== visaApplication.status) {
          visaApplication.status = mappedStatus;
          visaApplication.statusHistory.push({
            status: mappedStatus,
            updatedAt: new Date(),
            notes: `Status updated from external processor: ${externalStatus.statusDescription}`
          });
        }
        
        await visaApplication.save();
      }
    } catch (statusError) {
      logger.error('Failed to check external visa status:', statusError.message);
      // Continue without external status - not critical for viewing application
    }
  }

  ApiResponse.success(res, StatusCodes.OK, 'Visa application details fetched successfully', { 
    visaApplication,
    ...(externalStatus && {
      externalStatus: {
        status: externalStatus.status,
        statusDescription: externalStatus.statusDescription,
        currentStage: externalStatus.currentStage,
        estimatedCompletion: externalStatus.estimatedCompletion,
        nextSteps: externalStatus.nextSteps,
        trackingUrl: visaApplication.trackingUrl
      }
    })
  });
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

  // Submit to external API when status changes to "Under Review" and has sufficient documents
  if (status === 'Under Review' && oldStatus === 'Pending' && visaApplication.documents.length > 0) {
    try {
      const submissionResponse = await visaProcessingService.submitVisaApplication(visaApplication);
      if (submissionResponse.success) {
        visaApplication.externalReference = submissionResponse.data.externalReference;
        visaApplication.externalStatus = submissionResponse.data.status;
        visaApplication.trackingUrl = submissionResponse.data.trackingUrl;
        
        // Add note about external submission
        visaApplication.applicationNotes.push({
          note: `Application submitted to external processor. Reference: ${submissionResponse.data.externalReference}`,
          addedBy: req.user.userId,
          timestamp: new Date()
        });
      }
    } catch (submissionError) {
      logger.error('Failed to submit to external visa processor:', submissionError.message);
      // Don't fail the status update if external submission fails
      visaApplication.applicationNotes.push({
        note: 'External submission failed - will retry later',
        addedBy: req.user.userId,
        timestamp: new Date()
      });
    }
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

/**
 * @description Get visa requirements for a specific country and visa type.
 * @route GET /api/v1/products/visa/requirements
 * @access Public
 */
const getVisaRequirements = asyncHandler(async (req, res) => {
  const { destinationCountry, visaType, nationality = 'Nigeria' } = req.query;

  if (!destinationCountry || !visaType) {
    throw new ApiError('Destination country and visa type are required', StatusCodes.BAD_REQUEST);
  }

  try {
    const requirementsResponse = await visaProcessingService.getVisaRequirements(
      destinationCountry,
      visaType,
      nationality
    );

    ApiResponse.success(res, StatusCodes.OK, 'Visa requirements fetched successfully', {
      requirements: requirementsResponse.data
    });
  } catch (error) {
    logger.error('Failed to get visa requirements:', error.message);
    throw new ApiError('Failed to retrieve visa requirements', StatusCodes.INTERNAL_SERVER_ERROR);
  }
});

/**
 * @description Calculate visa fees for a specific application.
 * @route POST /api/v1/products/visa/calculate-fees
 * @access Public
 */
const calculateVisaApplicationFees = asyncHandler(async (req, res) => {
  const { destinationCountry, visaType, urgency = 'Standard', nationality = 'Nigeria' } = req.body;

  if (!destinationCountry || !visaType) {
    throw new ApiError('Destination country and visa type are required', StatusCodes.BAD_REQUEST);
  }

  try {
    const feesResponse = await visaProcessingService.calculateVisaFees(
      destinationCountry,
      visaType,
      urgency,
      nationality
    );

    ApiResponse.success(res, StatusCodes.OK, 'Visa fees calculated successfully', {
      fees: feesResponse.data
    });
  } catch (error) {
    logger.error('Failed to calculate visa fees:', error.message);
    // Return fallback calculation
    const fallbackFees = calculateVisaFees(destinationCountry, visaType, urgency);
    ApiResponse.success(res, StatusCodes.OK, 'Visa fees calculated successfully (fallback)', {
      fees: { ...fallbackFees, fallback: true }
    });
  }
});

/**
 * @description Get available visa processing centers.
 * @route GET /api/v1/products/visa/processing-centers
 * @access Public
 */
const getVisaProcessingCenters = asyncHandler(async (req, res) => {
  const { destinationCountry, applicantLocation } = req.query;

  if (!destinationCountry) {
    throw new ApiError('Destination country is required', StatusCodes.BAD_REQUEST);
  }

  try {
    const centersResponse = await visaProcessingService.getProcessingCenters(
      destinationCountry,
      applicantLocation || 'Lagos'
    );

    ApiResponse.success(res, StatusCodes.OK, 'Processing centers fetched successfully', {
      centers: centersResponse.data.centers
    });
  } catch (error) {
    logger.error('Failed to get processing centers:', error.message);
    throw new ApiError('Failed to retrieve processing centers', StatusCodes.INTERNAL_SERVER_ERROR);
  }
});

/**
 * @description Schedule a biometric appointment for visa application.
 * @route POST /api/v1/products/visa/:id/schedule-appointment
 * @access Private
 */
const scheduleVisaAppointment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { preferredDate, preferredTime, location, type = 'biometric', specialRequirements } = req.body;

  const visaApplication = await VisaApplication.findById(id);

  if (!visaApplication) {
    throw new ApiError('Visa application not found', StatusCodes.NOT_FOUND);
  }

  // Ensure user is authorized
  if (req.user && visaApplication.userId && visaApplication.userId.toString() !== req.user.userId) {
    throw new ApiError('Unauthorized to schedule appointment for this application', StatusCodes.FORBIDDEN);
  }

  if (!visaApplication.externalReference) {
    throw new ApiError('Application must be submitted to external processor first', StatusCodes.BAD_REQUEST);
  }

  try {
    const appointmentResponse = await visaProcessingService.scheduleAppointment(
      visaApplication.externalReference,
      {
        preferredDate,
        preferredTime,
        location,
        type,
        contactPhone: visaApplication.guestPhoneNumber || req.user?.phoneNumber,
        specialRequirements: specialRequirements || []
      }
    );

    // Update visa application with appointment details
    visaApplication.appointmentDetails = appointmentResponse.data;
    visaApplication.applicationNotes.push({
      note: `Appointment scheduled for ${appointmentResponse.data.scheduledDate} at ${appointmentResponse.data.scheduledTime}`,
      addedBy: req.user?.userId,
      timestamp: new Date()
    });

    await visaApplication.save();

    ApiResponse.success(res, StatusCodes.OK, 'Appointment scheduled successfully', {
      appointment: appointmentResponse.data
    });
  } catch (error) {
    logger.error('Failed to schedule appointment:', error.message);
    throw new ApiError('Failed to schedule visa appointment', StatusCodes.INTERNAL_SERVER_ERROR);
  }
});

/**
 * @description Check real-time visa application status.
 * @route GET /api/v1/products/visa/:id/status
 * @access Private
 */
const checkVisaApplicationStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const visaApplication = await VisaApplication.findById(id);

  if (!visaApplication) {
    throw new ApiError('Visa application not found', StatusCodes.NOT_FOUND);
  }

  // Ensure user is authorized
  if (req.user && visaApplication.userId && visaApplication.userId.toString() !== req.user.userId) {
    throw new ApiError('Unauthorized to check status for this application', StatusCodes.FORBIDDEN);
  }

  if (!visaApplication.externalReference) {
    ApiResponse.success(res, StatusCodes.OK, 'Visa application status retrieved', {
      status: {
        internalStatus: visaApplication.status,
        lastUpdated: visaApplication.updatedAt,
        statusHistory: visaApplication.statusHistory,
        externalSubmitted: false
      }
    });
    return;
  }

  try {
    const statusResponse = await visaProcessingService.checkVisaStatus(
      visaApplication.externalReference,
      visaApplication.applicationReference
    );

    // Update local status if needed
    if (statusResponse.data.status !== visaApplication.externalStatus) {
      visaApplication.externalStatus = statusResponse.data.status;
      visaApplication.lastExternalStatusCheck = new Date();
      await visaApplication.save();
    }

    ApiResponse.success(res, StatusCodes.OK, 'Visa application status retrieved', {
      status: {
        internalStatus: visaApplication.status,
        externalStatus: statusResponse.data.status,
        statusDescription: statusResponse.data.statusDescription,
        currentStage: statusResponse.data.currentStage,
        estimatedCompletion: statusResponse.data.estimatedCompletion,
        nextSteps: statusResponse.data.nextSteps,
        lastUpdated: statusResponse.data.lastUpdated,
        biometric: statusResponse.data.biometric,
        decision: statusResponse.data.decision,
        trackingUrl: visaApplication.trackingUrl
      }
    });
  } catch (error) {
    logger.error('Failed to check visa status:', error.message);
    throw new ApiError('Failed to retrieve visa application status', StatusCodes.INTERNAL_SERVER_ERROR);
  }
});

/**
 * @function checkSanlamAllianzApiHealth
 * @description Checks the health and connectivity of SanlamAllianz API endpoints
 * @route GET /api/v1/products/health/sanlam-allianz
 * @access Private (Admin only)
 */
const checkSanlamAllianzApiHealth = asyncHandler(async (req, res) => {
  const { validateApiConnection } = require('../services/allianzService');
  
  try {
    logger.info('Checking SanlamAllianz API health...');
    const connectionStatus = await validateApiConnection();
    
    // Determine overall health status
    const services = Object.keys(connectionStatus);
    const connectedServices = services.filter(service => connectionStatus[service].status === 'connected');
    const failedServices = services.filter(service => connectionStatus[service].status === 'failed');
    const notConfiguredServices = services.filter(service => connectionStatus[service].status === 'not_configured');
    
    const overallStatus = failedServices.length === 0 ? 'healthy' : 'degraded';
    const statusCode = overallStatus === 'healthy' ? StatusCodes.OK : StatusCodes.SERVICE_UNAVAILABLE;
    
    const healthReport = {
      overall: overallStatus,
      timestamp: new Date().toISOString(),
      services: connectionStatus,
      summary: {
        total: services.length,
        connected: connectedServices.length,
        failed: failedServices.length,
        notConfigured: notConfiguredServices.length
      }
    };
    
    logger.info(`SanlamAllianz API health check completed: ${overallStatus}`);
    
    ApiResponse.success(res, statusCode, 'SanlamAllianz API health check completed', healthReport);
  } catch (error) {
    logger.error('SanlamAllianz API health check failed:', error.message);
    
    const healthReport = {
      overall: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      services: {},
      summary: {
        total: 0,
        connected: 0,
        failed: 0,
        notConfigured: 0
      }
    };
    
    ApiResponse.success(res, StatusCodes.SERVICE_UNAVAILABLE, 'SanlamAllianz API health check failed', healthReport);
  }
});


module.exports = {
  getServiceCharges,
  updateServiceCharge,
  getTravelInsuranceLookup,
  getTravelInsuranceQuote,
  purchaseTravelInsuranceIndividual,
  purchaseTravelInsuranceFamily,
  verifyTravelInsurancePayment,
  searchFlights,
  bookFlight,
  verifyFlightPayment,
  searchHotels,
  bookHotel,
  verifyHotelPayment,
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
  getVisaRequirements,
  calculateVisaApplicationFees,
  getVisaProcessingCenters,
  scheduleVisaAppointment,
  checkVisaApplicationStatus,
  checkSanlamAllianzApiHealth,
};