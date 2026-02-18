// v1/utils/emailService.js
const nodemailer = require('nodemailer');
const logger = require('./logger');

/**
 * @function sendEmail
 * @description Sends an email using Nodemailer.
 * @param {object} options - Email options including to, subject, and html content.
 */
const sendEmail = async ({ to, subject, html }) => {
  const port = parseInt(process.env.EMAIL_PORT) || 587;
  const secure = process.env.EMAIL_SECURE === 'true' || port === 465;
  
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: port,
    secure: secure, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
    tls: {
      // Do not fail on invalid certs
      rejectUnauthorized: false
    },
    connectionTimeout: 10000, // 10 seconds connection timeout
    greetingTimeout: 10000, // 10 seconds greeting timeout
    socketTimeout: 15000 // 15 seconds socket timeout
  });

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email sent successfully to ${to} with subject: ${subject}`, {
      messageId: info.messageId,
      response: info.response
    });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error(`Error sending email to ${to}:`, {
      error: error.message,
      code: error.code,
      command: error.command,
      stack: error.stack
    });
    // In a real application, you might want to re-queue the email or alert an admin
    return { success: false, error: error.message };
  }
};

module.exports = { sendEmail };