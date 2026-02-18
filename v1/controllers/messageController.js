// v1/controllers/messageController.js
const { StatusCodes } = require('http-status-codes');
const ApiResponse = require('../utils/apiResponse');
const { ApiError } = require('../utils/apiError');
const asyncHandler = require('../middleware/asyncHandler');
const { sendEmail } = require('../utils/emailService');
const { sendSMS } = require('../utils/smsService');
const { sendWhatsAppMessage } = require('../utils/whatsappService');
const logger = require('../utils/logger');
const Queue = require('bull'); // For message queueing

// Initialize separate queues for emails, SMS, and WhatsApp with error handling
let emailQueue, smsQueue, whatsappQueue;

try {
  emailQueue = new Queue('emailQueue', process.env.REDIS_URL);
  smsQueue = new Queue('smsQueue', process.env.REDIS_URL);
  whatsappQueue = new Queue('whatsappQueue', process.env.REDIS_URL);
  
  // Add error handlers for queues
  [emailQueue, smsQueue, whatsappQueue].forEach(queue => {
    queue.on('error', (error) => {
      logger.error(`Queue error for ${queue.name}:`, error.message);
    });
  });
  
} catch (error) {
  logger.error('Failed to initialize message queues:', error.message);
  logger.warn('Message queues will be disabled. Messages will be sent directly.');
  
  // Set queues to null to indicate they're not available
  emailQueue = null;
  smsQueue = null;
  whatsappQueue = null;
}

// Process queues only if they were successfully initialized
if (emailQueue) {
  emailQueue.process(async (job) => {
    const { to, subject, html } = job.data;
    await sendEmail({ to, subject, html });
    logger.info(`Processed email to ${to}`);
  });
}

if (smsQueue) {
  smsQueue.process(async (job) => {
    const { to, body } = job.data;
    await sendSMS(to, body);
    logger.info(`Processed SMS to ${to}`);
  });
}

if (whatsappQueue) {
  whatsappQueue.process(async (job) => {
    const { to, body } = job.data;
    await sendWhatsAppMessage(to, body);
    logger.info(`Processed WhatsApp message to ${to}`);
  });
}


/**
 * @description Send an email.
 * @route POST /api/v1/messages/send-email
 * @access Private/Admin,Staff
 */
const sendEmailMessage = asyncHandler(async (req, res) => {
  const { to, subject, html } = req.body;

  if (!to || !subject || !html) {
    throw new ApiError('To, Subject, and HTML content are required', StatusCodes.BAD_REQUEST);
  }

  if (emailQueue) {
    // Add email to queue
    await emailQueue.add({ to, subject, html });
    ApiResponse.success(res, StatusCodes.OK, 'Email added to queue for sending');
  } else {
    // Send email directly if queue is not available
    await sendEmail({ to, subject, html });
    ApiResponse.success(res, StatusCodes.OK, 'Email sent successfully');
  }
});

/**
 * @description Send an SMS message.
 * @route POST /api/v1/messages/send-sms
 * @access Private/Admin,Staff
 */
const sendSmsMessage = asyncHandler(async (req, res) => {
  const { to, body } = req.body;

  if (!to || !body) {
    throw new ApiError('To and Body content are required', StatusCodes.BAD_REQUEST);
  }

  if (smsQueue) {
    // Add SMS to queue
    await smsQueue.add({ to, body });
    ApiResponse.success(res, StatusCodes.OK, 'SMS added to queue for sending');
  } else {
    // Send SMS directly if queue is not available
    await sendSMS(to, body);
    ApiResponse.success(res, StatusCodes.OK, 'SMS sent successfully');
  }
});

/**
 * @description Send a WhatsApp message.
 * @route POST /api/v1/messages/send-whatsapp
 * @access Private/Admin,Staff
 */
const sendWhatsappMessageController = asyncHandler(async (req, res) => {
  const { to, body } = req.body;

  if (!to || !body) {
    throw new ApiError('To and Body content are required', StatusCodes.BAD_REQUEST);
  }

  if (whatsappQueue) {
    // Add WhatsApp message to queue
    await whatsappQueue.add({ to, body });
    ApiResponse.success(res, StatusCodes.OK, 'WhatsApp message added to queue for sending');
  } else {
    // Send WhatsApp message directly if queue is not available
    await sendWhatsAppMessage(to, body);
    ApiResponse.success(res, StatusCodes.OK, 'WhatsApp message sent successfully');
  }
});

module.exports = {
  sendEmailMessage,
  sendSmsMessage,
  sendWhatsappMessage: sendWhatsappMessageController,
};