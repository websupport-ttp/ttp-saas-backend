// v1/utils/smsService.js
const twilio = require('twilio');
const logger = require('./logger');

/**
 * @constant twilioClient
 * @description Initializes and exports a Twilio client.
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
    await twilioClient.messages.create({
      body,
      from: process.env.TWILIO_PHONE_NUMBER,
      to,
    });
    logger.info(`SMS sent to ${to}: ${body}`);
  } catch (error) {
    logger.error(`Error sending SMS to ${to}: ${error.message}`);
    // In a real application, you might want to re-queue the SMS or alert an admin
  }
};

// Placeholder for WhatsApp service - Twilio can also handle WhatsApp
const sendWhatsAppMessage = async (to, body) => {
  try {
    await twilioClient.messages.create({
      body,
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`, // Twilio WhatsApp number
      to: `whatsapp:${to}`, // Recipient's WhatsApp number
    });
    logger.info(`WhatsApp message sent to ${to}: ${body}`);
  } catch (error) {
    logger.error(`Error sending WhatsApp message to ${to}: ${error.message}`);
    // In a real application, you might want to re-queue the message or alert an admin
  }
};


module.exports = { sendSMS, sendWhatsAppMessage };