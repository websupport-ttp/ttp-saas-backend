// v1/utils/smsService.js
const twilio = require('twilio');
const logger = require('./logger');

/**
 * @constant twilioClient
 * @description Initializes and exports a Twilio client for SMS messaging.
 */
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

/**
 * @function sendSMS
 * @description Sends an SMS message using Twilio.
 * @param {string} to - The recipient's phone number.
 * @param {string} body - The message body.
 */
const sendSMS = async (to, body) => {
  try {
    const result = await twilioClient.messages.create({
      body,
      from: process.env.TWILIO_PHONE_NUMBER,
      to,
    });
    
    logger.info(`SMS sent successfully to ${to}`, {
      messageSid: result.sid,
      status: result.status
    });
    
    return {
      success: true,
      messageSid: result.sid,
      status: result.status
    };
  } catch (error) {
    logger.error(`Error sending SMS to ${to}: ${error.message}`, {
      errorCode: error.code,
      moreInfo: error.moreInfo
    });
    throw error;
  }
};

/**
 * @function validateTwilioConfiguration
 * @description Validates that all required Twilio environment variables are set
 * @returns {Object} Validation result
 */
const validateTwilioConfiguration = () => {
  const requiredVars = [
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_PHONE_NUMBER'
  ];

  const missing = requiredVars.filter(varName => !process.env[varName]);

  if (missing.length > 0) {
    return {
      valid: false,
      missing,
      message: `Missing required Twilio environment variables: ${missing.join(', ')}`
    };
  }

  return {
    valid: true,
    message: 'Twilio SMS configuration is valid'
  };
};

module.exports = { 
  sendSMS, 
  validateTwilioConfiguration,
  twilioClient 
};