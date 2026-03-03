// v1/utils/emailService.js
const logger = require('./logger');
const https = require('https');

// Determine which email service to use
const USE_RESEND = process.env.RESEND_API_KEY ? true : false;

/**
 * @function sendEmailWithResend
 * @description Send email using Resend API (HTTP-based, not blocked by Railway)
 * @param {object} options - Email options
 * @returns {Promise<object>} Send result
 */
const sendEmailWithResend = async ({ to, subject, html }) => {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      from: process.env.EMAIL_FROM || 'The Travel Place <onboarding@resend.dev>',
      to: [to],
      subject: subject,
      html: html
    });

    const options = {
      hostname: 'api.resend.com',
      port: 443,
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          if (res.statusCode === 200) {
            logger.info(`Email sent successfully via Resend to ${to}`, {
              messageId: response.id,
              statusCode: res.statusCode
            });
            resolve({
              success: true,
              messageId: response.id,
              provider: 'resend'
            });
          } else {
            logger.error(`Resend API error for ${to}:`, {
              statusCode: res.statusCode,
              error: response.message || response.error,
              response: data
            });
            reject(new Error(response.message || response.error || 'Resend API error'));
          }
        } catch (parseError) {
          logger.error('Failed to parse Resend response:', {
            error: parseError.message,
            data: data
          });
          reject(parseError);
        }
      });
    });

    req.on('error', (error) => {
      logger.error('Resend API request failed:', {
        error: error.message,
        code: error.code
      });
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      const error = new Error('Resend API request timeout');
      logger.error('Resend API timeout:', { to, subject });
      reject(error);
    });

    req.setTimeout(30000); // 30 second timeout
    req.write(payload);
    req.end();
  });
};

// Create reusable transporter with connection pooling (for SMTP fallback)
let transporter = null;

/**
 * @function getTransporter
 * @description Creates or returns existing email transporter with optimized settings for Railway
 * Uses direct HTTPS connection to bypass Railway's SMTP port blocking
 */
const getTransporter = () => {
  if (transporter) {
    return transporter;
  }

  // Only initialize nodemailer if not using Resend
  if (USE_RESEND) {
    logger.info('Using Resend for email delivery (SMTP disabled)');
    return null;
  }

  const nodemailer = require('nodemailer');
  
  const port = parseInt(process.env.EMAIL_PORT) || 587;
  const secure = process.env.EMAIL_SECURE === 'true';
  
  // Log configuration (without sensitive data)
  logger.info('Initializing email transporter', {
    host: process.env.EMAIL_HOST,
    port: port,
    secure: secure,
    user: process.env.EMAIL_USERNAME ? '***configured***' : 'missing'
  });

  // Create custom HTTPS agent to bypass Railway's SMTP blocking
  const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
    keepAlive: true,
    keepAliveMsecs: 30000,
    maxSockets: 5,
    maxFreeSockets: 2,
    timeout: 60000,
    // Force IPv4 to avoid IPv6 routing issues on Railway
    family: 4
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
      ciphers: 'SSLv3', // Support older SSL versions if needed
      minVersion: 'TLSv1', // Minimum TLS version
      maxVersion: 'TLSv1.3' // Maximum TLS version
    },
    // Increased timeouts for Railway's network
    connectionTimeout: 60000, // 60 seconds (increased from 30)
    greetingTimeout: 60000, // 60 seconds (increased from 30)
    socketTimeout: 120000, // 120 seconds (increased from 60)
    // Custom socket options for Railway
    socket: {
      keepAlive: true,
      keepAliveInitialDelay: 30000
    },
    // Use custom HTTPS agent
    agent: httpsAgent,
    // Disable DNS caching to avoid stale connections
    dnsCache: false,
    // Force new connection for each email (workaround for Railway)
    newline: 'unix',
    // Debug mode (set to true if you need to troubleshoot)
    debug: process.env.NODE_ENV === 'development' || process.env.EMAIL_DEBUG === 'true',
    logger: process.env.NODE_ENV === 'development' || process.env.EMAIL_DEBUG === 'true'
  });

  // Verify transporter configuration (non-blocking)
  transporter.verify((error, success) => {
    if (error) {
      logger.error('Email transporter verification failed:', {
        error: error.message,
        code: error.code,
        command: error.command
      });
    } else {
      logger.info('Email transporter is ready to send messages');
    }
  });

  return transporter;
};

/**
 * @function sendEmail
 * @description Sends an email using Resend (preferred) or Nodemailer (fallback) with retry logic
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

  // Use Resend if API key is configured
  if (USE_RESEND) {
    if (!process.env.RESEND_API_KEY) {
      const error = 'Resend API key not configured';
      logger.error(error);
      return { success: false, error };
    }

    logger.info('Sending email via Resend', {
      to,
      subject,
      provider: 'resend'
    });

    let lastError = null;

    // Retry logic for Resend
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        logger.info(`Attempting to send email via Resend (attempt ${attempt}/${retries})`, {
          to,
          subject
        });

        const result = await sendEmailWithResend({ to, subject, html });
        
        logger.info(`Email sent successfully via Resend to ${to}`, {
          messageId: result.messageId,
          attempt
        });
        
        return result;

      } catch (error) {
        lastError = error;
        
        logger.error(`Resend email attempt ${attempt}/${retries} failed for ${to}:`, {
          error: error.message
        });

        // If this is not the last attempt, wait before retrying
        if (attempt < retries) {
          const waitTime = attempt * 1000; // 1s, 2s, 3s
          logger.info(`Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    // All Resend retries failed
    logger.error(`All ${retries} Resend email attempts failed for ${to}`, {
      finalError: lastError.message
    });

    return { 
      success: false, 
      error: lastError.message,
      provider: 'resend'
    };
  }

  // Fallback to SMTP (Nodemailer)
  logger.info('Sending email via SMTP', {
    to,
    subject,
    provider: 'smtp'
  });

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

  // Retry logic for SMTP
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      logger.info(`Attempting to send email via SMTP (attempt ${attempt}/${retries})`, {
        to,
        subject,
        from: mailOptions.from
      });

      const emailTransporter = getTransporter();
      const info = await emailTransporter.sendMail(mailOptions);
      
      logger.info(`Email sent successfully via SMTP to ${to}`, {
        messageId: info.messageId,
        response: info.response,
        attempt
      });
      
      return { 
        success: true, 
        messageId: info.messageId,
        attempt,
        provider: 'smtp'
      };

    } catch (error) {
      lastError = error;
      
      logger.error(`SMTP email attempt ${attempt}/${retries} failed for ${to}:`, {
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

  // All SMTP retries failed
  logger.error(`All ${retries} SMTP email attempts failed for ${to}`, {
    finalError: lastError.message,
    code: lastError.code
  });

  return { 
    success: false, 
    error: lastError.message,
    code: lastError.code,
    provider: 'smtp'
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