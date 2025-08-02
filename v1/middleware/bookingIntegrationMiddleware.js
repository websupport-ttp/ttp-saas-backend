// v1/middleware/bookingIntegrationMiddleware.js
const BookingIntegrationService = require('../services/bookingIntegrationService');
const logger = require('../utils/logger');

/**
 * Middleware to handle referral tracking during booking initiation
 */
const trackBookingReferralMiddleware = async (req, res, next) => {
  try {
    const { referralCode } = req.body;
    
    // Skip if no referral code provided
    if (!referralCode) {
      return next();
    }

    const userId = req.user?.userId;
    const guestEmail = req.body.customerDetails?.Email || 
                      req.body.customerDetails?.email ||
                      req.body.passengerDetails?.email ||
                      req.body.guestDetails?.email ||
                      req.body.familyMembersDetails?.[0]?.Email ||
                      req.body.guestEmail;

    // Extract request metadata
    const requestData = {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      referrerUrl: req.get('Referer'),
      landingPage: req.originalUrl,
      deviceInfo: extractDeviceInfo(req.get('User-Agent')),
      geolocation: req.geolocation || {},
      utmParameters: extractUtmParameters(req.query)
    };

    const customerData = {
      customerId: userId || guestEmail, // Use email as fallback for guests
      customerEmail: guestEmail
    };

    const bookingData = {
      referralCode,
      serviceType: determineServiceType(req.originalUrl),
      bookingAmount: 0, // Will be set during payment processing
      currency: 'NGN'
    };

    // Track the referral
    const trackingResult = await BookingIntegrationService.processReferralTracking(
      bookingData,
      customerData,
      requestData
    );

    // Attach referral info to request for use in booking process
    req.referralInfo = trackingResult;

    if (trackingResult.tracked) {
      logger.info(`Referral tracking successful for code ${referralCode}`);
    } else if (trackingResult.error) {
      logger.warn(`Referral tracking failed for code ${referralCode}: ${trackingResult.error}`);
    }

  } catch (error) {
    logger.error('Error in booking referral tracking middleware:', error);
    // Don't block the booking process if referral tracking fails
    req.referralInfo = { tracked: false, error: error.message };
  }

  next();
};

/**
 * Middleware to process commission after successful payment verification
 */
const processBookingCommissionMiddleware = async (req, res, next) => {
  // Store original res.json to intercept response
  const originalJson = res.json;
  
  res.json = async function(data) {
    try {
      // Check if this is a successful payment verification response
      if (isSuccessfulPaymentVerification(data, req)) {
        const transactionReference = extractTransactionReference(data, req);
        
        if (transactionReference) {
          // Process booking completion (commission and QR code)
          const completionResult = await BookingIntegrationService.processBookingCompletion(
            transactionReference
          );
          
          if (completionResult.processed) {
            logger.info(`Booking completion processed for transaction ${transactionReference}`);
            
            // Enhance response with referral information
            if (data.data && typeof data.data === 'object') {
              data.data.referralInfo = {
                commissionProcessed: true,
                commissionAmount: completionResult.commission?.commissionAmount,
                affiliateBusinessName: completionResult.commission?.affiliate?.businessName
              };

              // Add QR code if generated
              if (completionResult.qrCode) {
                data.data.referralInfo.qrCode = completionResult.qrCode;
              }
            }
          }
        }
      }
    } catch (error) {
      logger.error('Error in booking commission processing middleware:', error);
      // Don't affect the response if commission processing fails
    }
    
    // Call original res.json with potentially modified data
    originalJson.call(this, data);
  };
  
  next();
};

/**
 * Middleware to enhance booking confirmation with referral information
 */
const enhanceBookingConfirmationMiddleware = async (req, res, next) => {
  // Store original res.json to intercept response
  const originalJson = res.json;
  
  res.json = async function(data) {
    try {
      // Check if this is a successful booking initiation response
      if (isSuccessfulBookingInitiation(data, req)) {
        const referralCode = req.body.referralCode;
        
        if (referralCode && req.referralInfo?.tracked) {
          // Enhance booking confirmation with referral information
          if (data.data && typeof data.data === 'object') {
            data.data.referralInfo = {
              referralCode,
              affiliateBusinessName: req.referralInfo.affiliate?.businessName,
              tracked: true,
              message: 'Your booking will generate commission for the referring partner'
            };
          }
        }
      }
    } catch (error) {
      logger.error('Error in booking confirmation enhancement middleware:', error);
      // Don't affect the response if enhancement fails
    }
    
    // Call original res.json with potentially modified data
    originalJson.call(this, data);
  };
  
  next();
};

/**
 * Extract device information from user agent
 * @private
 */
function extractDeviceInfo(userAgent) {
  if (!userAgent) return { type: 'unknown' };

  const ua = userAgent.toLowerCase();
  
  let type = 'desktop';
  if (ua.includes('mobile')) type = 'mobile';
  else if (ua.includes('tablet') || ua.includes('ipad')) type = 'tablet';

  let browser = 'unknown';
  if (ua.includes('chrome')) browser = 'Chrome';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('safari')) browser = 'Safari';
  else if (ua.includes('edge')) browser = 'Edge';

  let os = 'unknown';
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) os = 'iOS';
  else if (ua.includes('mac')) os = 'macOS';
  else if (ua.includes('linux')) os = 'Linux';

  return { type, browser, os };
}

/**
 * Extract UTM parameters from query string
 * @private
 */
function extractUtmParameters(query) {
  return {
    utm_source: query.utm_source,
    utm_medium: query.utm_medium,
    utm_campaign: query.utm_campaign,
    utm_term: query.utm_term,
    utm_content: query.utm_content
  };
}

/**
 * Determine service type from URL
 * @private
 */
function determineServiceType(url) {
  if (url.includes('flight')) return 'flight';
  if (url.includes('hotel')) return 'hotel';
  if (url.includes('insurance')) return 'insurance';
  if (url.includes('visa')) return 'visa';
  if (url.includes('package')) return 'package';
  return 'unknown';
}

/**
 * Check if response indicates successful booking initiation
 * @private
 */
function isSuccessfulBookingInitiation(data, req) {
  // Check if this is a booking initiation endpoint
  const isBookingEndpoint = req.originalUrl.includes('/book') || 
                           req.originalUrl.includes('/purchase') ||
                           req.originalUrl.includes('/apply');
  
  if (!isBookingEndpoint) return false;

  // Check if response indicates success
  const isSuccess = data.success === true || 
                   data.status === 'success' ||
                   (data.statusCode >= 200 && data.statusCode < 300);

  // Check if response contains authorization URL (payment initiation)
  const hasAuthUrl = data.data?.authorizationUrl || 
                    data.data?.authorization_url ||
                    data.data?.paymentUrl;

  return isSuccess && hasAuthUrl;
}

/**
 * Check if response indicates successful payment verification
 * @private
 */
function isSuccessfulPaymentVerification(data, req) {
  // Check if this is a payment verification endpoint
  const isVerificationEndpoint = req.originalUrl.includes('/verify') || 
                                req.originalUrl.includes('/callback');
  
  if (!isVerificationEndpoint) return false;

  // Check if response indicates success
  const isSuccess = data.success === true || 
                   data.status === 'success' ||
                   (data.statusCode >= 200 && data.statusCode < 300);

  // Check if response contains transaction reference
  const hasTransactionRef = data.data?.transactionReference || 
                           data.data?.reference ||
                           data.data?.paymentReference;

  return isSuccess && hasTransactionRef;
}

/**
 * Extract transaction reference from response
 * @private
 */
function extractTransactionReference(data, req) {
  const responseData = data.data || data;
  
  return responseData.transactionReference || 
         responseData.reference ||
         responseData.paymentReference ||
         req.body.reference;
}

module.exports = {
  trackBookingReferralMiddleware,
  processBookingCommissionMiddleware,
  enhanceBookingConfirmationMiddleware
};