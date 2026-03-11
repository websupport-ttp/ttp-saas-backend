// v1/utils/smsService.js
const axios = require('axios');
const logger = require('./logger');

/**
 * SMS Provider Configuration
 * Supports multiple providers with automatic routing based on phone number
 */

// Twilio client (fallback)
let twilioClient = null;
try {
  const twilio = require('twilio');
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
} catch (error) {
  logger.warn('Twilio not configured or module not installed');
}

/**
 * @function detectCountry
 * @description Detects the country from a phone number
 * @param {string} phoneNumber - Phone number in international format (+234...)
 * @returns {string} Country code (NG, US, UK, etc.)
 */
const detectCountry = (phoneNumber) => {
  // Remove all non-numeric characters except +
  const cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  // Country code mapping
  const countryPrefixes = {
    '+234': 'NG', // Nigeria
    '+1': 'US',   // US/Canada
    '+44': 'UK',  // United Kingdom
    '+91': 'IN',  // India
    '+27': 'ZA',  // South Africa
    '+254': 'KE', // Kenya
    '+233': 'GH', // Ghana
    '+256': 'UG', // Uganda
    '+255': 'TZ', // Tanzania
  };
  
  // Check for country prefix
  for (const [prefix, country] of Object.entries(countryPrefixes)) {
    if (cleaned.startsWith(prefix)) {
      return country;
    }
  }
  
  // Default to international if unknown
  return 'INTL';
};

/**
 * @function normalizePhoneNumber
 * @description Normalizes phone number to E.164 format
 * @param {string} phoneNumber - Phone number
 * @returns {string} Normalized phone number
 */
const normalizePhoneNumber = (phoneNumber) => {
  // Remove all non-numeric characters except +
  let cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  // Add + if not present
  if (!cleaned.startsWith('+')) {
    // If starts with 234 (Nigeria without +), add +
    if (cleaned.startsWith('234')) {
      cleaned = '+' + cleaned;
    }
    // If starts with 0 (local Nigerian number), replace with +234
    else if (cleaned.startsWith('0') && cleaned.length === 11) {
      cleaned = '+234' + cleaned.substring(1);
    }
    // Otherwise assume it needs +
    else {
      cleaned = '+' + cleaned;
    }
  }
  
  return cleaned;
};

/**
 * @function sendViaTermii
 * @description Sends SMS via Termii (Nigerian provider)
 * @param {string} to - Recipient phone number
 * @param {string} message - Message body
 * @returns {Object} Send result
 */
const sendViaTermii = async (to, message) => {
  if (!process.env.TERMII_API_KEY) {
    throw new Error('Termii API key not configured');
  }
  
  try {
    const termiiBaseUrl = process.env.TERMII_BASE_URL || 'https://v3.api.termii.com';
    const response = await axios.post(`${termiiBaseUrl}/api/sms/send`, {
      to: to.replace('+', ''), // Termii expects without +
      from: process.env.TERMII_SENDER_ID || 'TravelPlace',
      sms: message,
      type: 'plain',
      channel: 'generic',
      api_key: process.env.TERMII_API_KEY
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    logger.info(`SMS sent via Termii to ${to}`, {
      messageId: response.data.message_id,
      status: response.data.message,
      provider: 'termii'
    });
    
    return {
      success: true,
      provider: 'termii',
      messageId: response.data.message_id,
      status: response.data.message,
      cost: '₦2.50' // Approximate
    };
  } catch (error) {
    logger.error(`Termii SMS failed for ${to}: ${error.message}`, {
      provider: 'termii',
      error: error.response?.data || error.message
    });
    throw error;
  }
};

/**
 * @function sendOTPViaTermii
 * @description Sends OTP via Termii's OTP API (more secure and reliable)
 * @param {string} to - Recipient phone number
 * @param {Object} options - OTP options
 * @returns {Object} Send result with pinId for verification
 */
const sendOTPViaTermii = async (to, options = {}) => {
  if (!process.env.TERMII_API_KEY) {
    throw new Error('Termii API key not configured');
  }
  
  try {
    const termiiBaseUrl = process.env.TERMII_BASE_URL || 'https://v3.api.termii.com';
    
    // Generate OTP code if not provided
    const pinLength = options.pinLength || 6;
    const pinType = options.pinType || 'NUMERIC';
    const pinPlaceholder = '< ' + '1'.repeat(pinLength) + ' >';
    
    // Use configured sender ID from environment variable
    // For testing, use 'fastbeep' (test sender ID provided by Termii)
    const senderId = options.senderId || process.env.TERMII_SENDER_ID || 'fastbeep';
    
    const payload = {
      api_key: process.env.TERMII_API_KEY,
      pin_type: pinType,
      to: to.replace('+', ''), // Termii expects without +
      from: senderId,
      channel: 'generic',
      pin_attempts: options.pinAttempts || 3,
      pin_time_to_live: options.pinTimeToLive || 5, // minutes
      pin_length: pinLength,
      pin_placeholder: pinPlaceholder,
      message_text: options.messageText || `Your verification code is ${pinPlaceholder}. Valid for ${options.pinTimeToLive || 5} minutes.`,
      message_type: pinType
    };
    
    const response = await axios.post(`${termiiBaseUrl}/api/sms/otp/send`, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    logger.info(`OTP sent via Termii to ${to}`, {
      pinId: response.data.pinId || response.data.pin_id,
      status: response.data.smsStatus,
      provider: 'termii-otp'
    });
    
    return {
      success: true,
      provider: 'termii-otp',
      pinId: response.data.pinId || response.data.pin_id,
      messageId: response.data.message_id_str,
      status: response.data.smsStatus,
      phoneNumber: response.data.phone_number,
      cost: '₦2.50' // Approximate
    };
  } catch (error) {
    logger.error(`Termii OTP failed for ${to}: ${error.message}`, {
      provider: 'termii-otp',
      error: error.response?.data || error.message
    });
    throw error;
  }
};

/**
 * @function verifyOTPViaTermii
 * @description Verifies OTP sent via Termii's OTP API
 * @param {string} pinId - PIN ID returned from sendOTPViaTermii
 * @param {string} pin - OTP code entered by user
 * @returns {Object} Verification result
 */
const verifyOTPViaTermii = async (pinId, pin) => {
  if (!process.env.TERMII_API_KEY) {
    throw new Error('Termii API key not configured');
  }
  
  try {
    const termiiBaseUrl = process.env.TERMII_BASE_URL || 'https://v3.api.termii.com';
    
    const response = await axios.post(`${termiiBaseUrl}/api/sms/otp/verify`, {
      api_key: process.env.TERMII_API_KEY,
      pin_id: pinId,
      pin: pin
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    const verified = response.data.verified === true || response.data.verified === 'True';
    
    logger.info(`OTP verification via Termii`, {
      pinId,
      verified,
      msisdn: response.data.msisdn
    });
    
    return {
      success: true,
      verified,
      msisdn: response.data.msisdn,
      provider: 'termii-otp'
    };
  } catch (error) {
    logger.error(`Termii OTP verification failed: ${error.message}`, {
      pinId,
      error: error.response?.data || error.message
    });
    
    return {
      success: false,
      verified: false,
      error: error.response?.data?.message || error.message
    };
  }
};

/**
 * @function sendViaTelnyx
 * @description Sends SMS via Telnyx (International provider)
 * @param {string} to - Recipient phone number
 * @param {string} message - Message body
 * @returns {Object} Send result
 */
const sendViaTelnyx = async (to, message) => {
  if (!process.env.TELNYX_API_KEY) {
    throw new Error('Telnyx API key not configured');
  }
  
  try {
    const response = await axios.post('https://api.telnyx.com/v2/messages', {
      from: process.env.TELNYX_PHONE_NUMBER || 'TravelPlace',
      to: to,
      text: message
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.TELNYX_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    logger.info(`SMS sent via Telnyx to ${to}`, {
      messageId: response.data.data.id,
      status: response.data.data.status,
      provider: 'telnyx'
    });
    
    return {
      success: true,
      provider: 'telnyx',
      messageId: response.data.data.id,
      status: response.data.data.status,
      cost: '$0.04' // Approximate for Nigeria
    };
  } catch (error) {
    logger.error(`Telnyx SMS failed for ${to}: ${error.message}`, {
      provider: 'telnyx',
      error: error.response?.data || error.message
    });
    throw error;
  }
};

/**
 * @function sendViaTwilio
 * @description Sends SMS via Twilio (Fallback provider)
 * @param {string} to - Recipient phone number
 * @param {string} message - Message body
 * @returns {Object} Send result
 */
const sendViaTwilio = async (to, message) => {
  if (!twilioClient) {
    throw new Error('Twilio not configured');
  }
  
  try {
    const result = await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to,
    });
    
    logger.info(`SMS sent via Twilio to ${to}`, {
      messageSid: result.sid,
      status: result.status,
      provider: 'twilio'
    });
    
    return {
      success: true,
      provider: 'twilio',
      messageSid: result.sid,
      status: result.status,
      cost: '$0.12' // Approximate for Nigeria
    };
  } catch (error) {
    logger.error(`Twilio SMS failed for ${to}: ${error.message}`, {
      provider: 'twilio',
      errorCode: error.code,
      moreInfo: error.moreInfo
    });
    throw error;
  }
};

/**
 * @function sendSMS
 * @description Smart SMS sending with automatic provider routing
 * Routes Nigerian numbers to Termii, international to Telnyx, fallback to Twilio
 * @param {string} to - Recipient phone number
 * @param {string} body - Message body
 * @param {Object} options - Additional options
 * @returns {Object} Send result
 */
const sendSMS = async (to, body, options = {}) => {
  try {
    // Normalize phone number
    const normalizedPhone = normalizePhoneNumber(to);
    
    // Detect country
    const country = detectCountry(normalizedPhone);
    
    logger.info(`Sending SMS to ${normalizedPhone}`, {
      country,
      messageLength: body.length,
      forceProvider: options.provider
    });
    
    // If provider is forced, use it
    if (options.provider) {
      switch (options.provider.toLowerCase()) {
        case 'termii':
          return await sendViaTermii(normalizedPhone, body);
        case 'telnyx':
          return await sendViaTelnyx(normalizedPhone, body);
        case 'twilio':
          return await sendViaTwilio(normalizedPhone, body);
        default:
          throw new Error(`Unknown provider: ${options.provider}`);
      }
    }
    
    // Smart routing based on country
    let result;
    let errors = [];
    
    // Nigerian numbers -> Termii (cheapest)
    if (country === 'NG') {
      try {
        result = await sendViaTermii(normalizedPhone, body);
        return result;
      } catch (error) {
        errors.push({ provider: 'termii', error: error.message });
        logger.warn(`Termii failed, trying Telnyx for ${normalizedPhone}`);
        
        // Fallback to Telnyx
        try {
          result = await sendViaTelnyx(normalizedPhone, body);
          return result;
        } catch (telnyxError) {
          errors.push({ provider: 'telnyx', error: telnyxError.message });
          logger.warn(`Telnyx failed, trying Twilio for ${normalizedPhone}`);
        }
      }
    }
    // International numbers -> Telnyx (cheaper than Twilio)
    else {
      try {
        result = await sendViaTelnyx(normalizedPhone, body);
        return result;
      } catch (error) {
        errors.push({ provider: 'telnyx', error: error.message });
        logger.warn(`Telnyx failed, trying Twilio for ${normalizedPhone}`);
      }
    }
    
    // Final fallback to Twilio
    if (twilioClient) {
      try {
        result = await sendViaTwilio(normalizedPhone, body);
        return result;
      } catch (error) {
        errors.push({ provider: 'twilio', error: error.message });
      }
    }
    
    // All providers failed
    logger.error(`All SMS providers failed for ${normalizedPhone}`, { errors });
    throw new Error(`Failed to send SMS: ${errors.map(e => `${e.provider}: ${e.error}`).join(', ')}`);
    
  } catch (error) {
    logger.error(`SMS sending error: ${error.message}`);
    throw error;
  }
};

/**
 * @function validateSMSConfiguration
 * @description Validates SMS provider configurations
 * @returns {Object} Validation result
 */
const validateSMSConfiguration = () => {
  const providers = {
    termii: {
      configured: !!process.env.TERMII_API_KEY,
      required: ['TERMII_API_KEY'],
      optional: ['TERMII_SENDER_ID']
    },
    telnyx: {
      configured: !!process.env.TELNYX_API_KEY,
      required: ['TELNYX_API_KEY'],
      optional: ['TELNYX_PHONE_NUMBER']
    },
    twilio: {
      configured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
      required: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER']
    }
  };
  
  const configuredProviders = Object.entries(providers)
    .filter(([_, config]) => config.configured)
    .map(([name]) => name);
  
  return {
    valid: configuredProviders.length > 0,
    providers: configuredProviders,
    message: configuredProviders.length > 0
      ? `SMS configured with: ${configuredProviders.join(', ')}`
      : 'No SMS providers configured',
    details: providers
  };
};

/**
 * @function getProviderForCountry
 * @description Returns the recommended provider for a country
 * @param {string} phoneNumber - Phone number
 * @returns {string} Provider name
 */
const getProviderForCountry = (phoneNumber) => {
  const country = detectCountry(normalizePhoneNumber(phoneNumber));
  
  if (country === 'NG' && process.env.TERMII_API_KEY) {
    return 'termii';
  }
  
  if (process.env.TELNYX_API_KEY) {
    return 'telnyx';
  }
  
  if (twilioClient) {
    return 'twilio';
  }
  
  return 'none';
};

module.exports = { 
  sendSMS,
  sendViaTermii,
  sendOTPViaTermii,
  verifyOTPViaTermii,
  sendViaTelnyx,
  sendViaTwilio,
  validateSMSConfiguration,
  getProviderForCountry,
  detectCountry,
  normalizePhoneNumber,
  twilioClient 
};
