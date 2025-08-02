// v1/middleware/referralTrackingMiddleware.js
const ReferralTrackingService = require('../services/referralTrackingService');
const logger = require('../utils/logger');

/**
 * Middleware to track referrals during booking process
 */
const trackReferralMiddleware = async (req, res, next) => {
  try {
    const { referralCode } = req.body;
    const userId = req.user?.id;
    
    // Skip if no referral code provided
    if (!referralCode) {
      return next();
    }

    // Skip if user not authenticated (guest bookings handled separately)
    if (!userId) {
      logger.info('Referral code provided but user not authenticated - will track after user creation');
      return next();
    }

    // Extract request metadata
    const requestData = {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      referrerUrl: req.get('Referer'),
      landingPage: req.originalUrl,
      deviceInfo: extractDeviceInfo(req.get('User-Agent')),
      geolocation: req.geolocation || {}, // Assuming geolocation middleware sets this
      utmParameters: extractUtmParameters(req.query)
    };

    const customerData = {
      customerId: userId,
      customerEmail: req.user?.email
    };

    // Track the referral
    const trackingResult = await ReferralTrackingService.trackReferral(
      referralCode,
      customerData,
      requestData
    );

    // Attach referral info to request for use in booking process
    req.referralInfo = {
      tracked: trackingResult.success,
      referral: trackingResult.referral,
      affiliate: trackingResult.affiliate,
      isNew: trackingResult.isNew
    };

    logger.info(`Referral tracking ${trackingResult.success ? 'successful' : 'failed'} for user ${userId}`);

  } catch (error) {
    logger.error('Error in referral tracking middleware:', error);
    // Don't block the booking process if referral tracking fails
    req.referralInfo = { tracked: false, error: error.message };
  }

  next();
};

/**
 * Middleware to attribute completed bookings to referrals
 */
const attributeBookingMiddleware = async (req, res, next) => {
  // Store original res.json to intercept response
  const originalJson = res.json;
  
  res.json = async function(data) {
    try {
      // Check if this is a successful booking response
      if (isSuccessfulBookingResponse(data, req)) {
        const userId = req.user?.id;
        const bookingData = extractBookingData(data, req);
        
        if (userId && bookingData) {
          // Attribute booking to referral
          const attributionResult = await ReferralTrackingService.attributeBooking(
            bookingData,
            userId
          );
          
          if (attributionResult.attributed) {
            logger.info(`Booking ${bookingData.bookingReference} attributed to referral`);
            
            // Add referral info to response (optional)
            if (data.data && typeof data.data === 'object') {
              data.data.referralAttribution = {
                attributed: true,
                affiliateId: attributionResult.affiliate?.affiliateId,
                businessName: attributionResult.affiliate?.businessName
              };
            }
          }
        }
      }
    } catch (error) {
      logger.error('Error in booking attribution middleware:', error);
      // Don't affect the response if attribution fails
    }
    
    // Call original res.json with potentially modified data
    originalJson.call(this, data);
  };
  
  next();
};

/**
 * Middleware specifically for guest bookings where user is created during booking
 */
const trackGuestReferralMiddleware = async (req, res, next) => {
  try {
    const { referralCode, guestEmail } = req.body;
    
    if (!referralCode || !guestEmail) {
      return next();
    }

    // Store referral info for later processing after user creation
    req.pendingReferral = {
      referralCode,
      guestEmail,
      requestData: {
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        referrerUrl: req.get('Referer'),
        landingPage: req.originalUrl,
        deviceInfo: extractDeviceInfo(req.get('User-Agent')),
        geolocation: req.geolocation || {},
        utmParameters: extractUtmParameters(req.query)
      }
    };

    logger.info(`Pending referral stored for guest booking with email ${guestEmail}`);

  } catch (error) {
    logger.error('Error in guest referral tracking middleware:', error);
  }

  next();
};

/**
 * Process pending referral after user creation in guest booking
 */
const processPendingReferral = async (userId, pendingReferral) => {
  try {
    if (!pendingReferral) return null;

    const { referralCode, requestData } = pendingReferral;
    
    const customerData = {
      customerId: userId,
      customerEmail: pendingReferral.guestEmail
    };

    const trackingResult = await ReferralTrackingService.trackReferral(
      referralCode,
      customerData,
      requestData
    );

    logger.info(`Pending referral processed for user ${userId}: ${trackingResult.success}`);
    
    return trackingResult;

  } catch (error) {
    logger.error('Error processing pending referral:', error);
    return null;
  }
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
 * Check if response indicates successful booking
 * @private
 */
function isSuccessfulBookingResponse(data, req) {
  // Check if this is a booking endpoint
  const isBookingEndpoint = req.originalUrl.includes('/book') || 
                           req.originalUrl.includes('/purchase') ||
                           req.originalUrl.includes('/order');
  
  if (!isBookingEndpoint) return false;

  // Check if response indicates success
  const isSuccess = data.success === true || 
                   data.status === 'success' ||
                   (data.statusCode >= 200 && data.statusCode < 300);

  // Check if response contains booking reference
  const hasBookingRef = data.data?.bookingReference || 
                       data.data?.reference ||
                       data.data?.orderId ||
                       data.data?.transactionId;

  return isSuccess && hasBookingRef;
}

/**
 * Extract booking data from successful response
 * @private
 */
function extractBookingData(data, req) {
  const responseData = data.data || data;
  
  // Determine service type from endpoint
  let serviceType = 'unknown';
  if (req.originalUrl.includes('flight')) serviceType = 'flight';
  else if (req.originalUrl.includes('hotel')) serviceType = 'hotel';
  else if (req.originalUrl.includes('insurance')) serviceType = 'insurance';
  else if (req.originalUrl.includes('visa')) serviceType = 'visa';

  // Extract booking reference
  const bookingReference = responseData.bookingReference || 
                          responseData.reference ||
                          responseData.orderId ||
                          responseData.transactionId;

  // Extract amounts
  const bookingAmount = responseData.totalAmount || 
                       responseData.amount ||
                       responseData.totalAmountPaid ||
                       0;

  // Commission will be calculated by commission service
  const commissionGenerated = responseData.commissionAmount || 0;

  if (!bookingReference) {
    logger.warn('No booking reference found in response data');
    return null;
  }

  return {
    bookingReference,
    serviceType,
    bookingAmount,
    commissionGenerated,
    currency: responseData.currency || 'NGN'
  };
}

module.exports = {
  trackReferralMiddleware,
  attributeBookingMiddleware,
  trackGuestReferralMiddleware,
  processPendingReferral
};