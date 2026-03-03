// v1/utils/emailService.js
const nodemailer = require('nodemailer');
const logger = require('./logger');

// Create reusable transporter with connection pooling
let transporter = null;

/**
 * @function getTransporter
 * @description Creates or returns existing email transporter with optimized settings for Railway
 */
const getTransporter = () => {
  if (transporter) {
    return transporter;
  }

  const port = parseInt(process.env.EMAIL_PORT) || 587;
  const secure = process.env.EMAIL_SECURE === 'true';
  
  // Log configuration (without sensitive data)
  logger.info('Initializing email transporter', {
    host: process.env.EMAIL_HOST,
    port: port,
    secure: secure,
    user: process.env.EMAIL_USERNAME ? '***configured***' : 'missing'
  });

  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: port,
    secure: secure, // false for 587 (STARTTLS), true for 465 (SSL/TLS)
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
    // Optimized settings for Railway
    pool: true, // Use connection pooling
    maxConnections: 5, // Max concurrent connections
    maxMessages: 100, // Max messages per connection
    rateDelta: 1000, // Time between messages (ms)
    rateLimit: 5, // Max messages per rateDelta
    tls: {
      rejectUnauthorized: false, // Don't fail on invalid certs
      ciphers: 'SSLv3' // Support older SSL versions if needed
    },
    // Increased timeouts for Railway's network
    connectionTimeout: 30000, // 30 seconds
    greetingTimeout: 30000, // 30 seconds
    socketTimeout: 60000, // 60 seconds
    // Debug mode (set to true if you need to troubleshoot)
    debug: process.env.NODE_ENV === 'development',
    logger: process.env.NODE_ENV === 'development'
  });

  // Verify transporter configuration
  transporter.verify((error, success) => {
    if (error) {
      logger.error('Email transporter verification failed:', {
        error: error.message,
        code: error.code
      });
    } else {
      logger.info('Email transporter is ready to send messages');
    }
  });

  return transporter;
};

/**
 * @function sendEmail
 * @description Sends an email using Nodemailer with retry logic
 * @param {object} options - Email options including to, subject, and html content.
 * @param {number} retries - Number of retry attempts (default: 3)
 */
const sendEmail = async ({ to, subject, html }, retries = 3) => {
  // Validate required fields
  if (!to || !subject || !html) {
    const error = 'Missing required email fields: to, subject, or html';
    logger.error(error);
    return { success: false, error };
  }

  // Validate email configuration
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USERNAME || !process.env.EMAIL_PASSWORD) {
    const error = 'Email service not configured. Missing EMAIL_HOST, EMAIL_USERNAME, or EMAIL_PASSWORD';
    logger.error(error);
    return { success: false, error };
  }

  const mailOptions = {
    from: process.env.EMAIL_FROM || `The Travel Place <${process.env.EMAIL_USERNAME}>`,
    to,
    subject,
    html,
  };

  let lastError = null;

  // Retry logic
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      logger.info(`Attempting to send email (attempt ${attempt}/${retries})`, {
        to,
        subject,
        from: mailOptions.from
      });

      const emailTransporter = getTransporter();
      const info = await emailTransporter.sendMail(mailOptions);
      
      logger.info(`Email sent successfully to ${to}`, {
        messageId: info.messageId,
        response: info.response,
        attempt
      });
      
      return { 
        success: true, 
        messageId: info.messageId,
        attempt
      };

    } catch (error) {
      lastError = error;
      
      logger.error(`Email send attempt ${attempt}/${retries} failed for ${to}:`, {
        error: error.message,
        code: error.code,
        command: error.command,
        responseCode: error.responseCode,
        response: error.response
      });

      // If this is not the last attempt, wait before retrying
      if (attempt < retries) {
        const waitTime = attempt * 2000; // Exponential backoff: 2s, 4s, 6s
        logger.info(`Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  // All retries failed
  logger.error(`All ${retries} email send attempts failed for ${to}`, {
    finalError: lastError.message,
    code: lastError.code
  });

  return { 
    success: false, 
    error: lastError.message,
    code: lastError.code
  };
};

/**
 * @function closeTransporter
 * @description Closes the email transporter connection pool
 */
const closeTransporter = () => {
  if (transporter) {
    transporter.close();
    transporter = null;
    logger.info('Email transporter closed');
  }
};

module.exports = { 
  sendEmail,
  closeTransporter
};