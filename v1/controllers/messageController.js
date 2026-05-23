// v1/controllers/messageController.js
// Bull queues removed — they caused Redis reconnection loops that consumed
// 470MB+ heap and crashed the process. Messages are sent directly instead.
const { StatusCodes } = require('http-status-codes');
const ApiResponse = require('../utils/apiResponse');
const { ApiError } = require('../utils/apiError');
const asyncHandler = require('../middleware/asyncHandler');
const { sendEmail } = require('../utils/emailService');
const { sendSMS } = require('../utils/smsService');
const { sendWhatsAppMessage } = require('../utils/whatsappService');
const logger = require('../utils/logger');


const sendEmailMessage = asyncHandler(async (req, res) => {
  const { to, subject, html } = req.body;
  if (!to || !subject || !html) {
    throw new ApiError('To, Subject, and HTML content are required', StatusCodes.BAD_REQUEST);
  }
  await sendEmail({ to, subject, html });
  ApiResponse.success(res, StatusCodes.OK, 'Email sent successfully');
});

const sendSmsMessage = asyncHandler(async (req, res) => {
  const { to, body } = req.body;
  if (!to || !body) {
    throw new ApiError('To and Body content are required', StatusCodes.BAD_REQUEST);
  }
  await sendSMS(to, body);
  ApiResponse.success(res, StatusCodes.OK, 'SMS sent successfully');
});

const sendWhatsappMessageController = asyncHandler(async (req, res) => {
  const { to, body } = req.body;
  if (!to || !body) {
    throw new ApiError('To and Body content are required', StatusCodes.BAD_REQUEST);
  }
  await sendWhatsAppMessage(to, body);
  ApiResponse.success(res, StatusCodes.OK, 'WhatsApp message sent successfully');
});

module.exports = {
  sendEmailMessage,
  sendSmsMessage,
  sendWhatsappMessage: sendWhatsappMessageController,
};