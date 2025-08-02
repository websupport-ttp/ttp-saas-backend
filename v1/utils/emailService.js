// v1/utils/emailService.js
const nodemailer = require('nodemailer');
const logger = require('./logger');

/**
 * @function sendEmail
 * @description Sends an email using Nodemailer.
 * @param {object} options - Email options including to, subject, and html content.
 */
const sendEmail = async ({ to, subject, html }) => {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.NODE_ENV === 'production', // Use 'true' for 465, 'false' for other ports
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info(`Email sent to ${to} with subject: ${subject}`);
  } catch (error) {
    logger.error(`Error sending email to ${to}: ${error.message}`);
    // In a real application, you might want to re-queue the email or alert an admin
  }
};

module.exports = { sendEmail };