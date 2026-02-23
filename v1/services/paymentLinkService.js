// v1/services/paymentLinkService.js
const PaymentLink = require('../models/paymentLinkModel');
const { initializePayment } = require('./paystackService');
const { sendEmail } = require('../utils/emailService');
const logger = require('../utils/logger');

/**
 * Generate a payment link for an application
 */
const generatePaymentLink = async ({
  applicationId,
  applicationType,
  amount,
  customerEmail,
  customerPhone,
  description,
  dueDate,
  createdBy,
  metadata = {}
}) => {
  try {
    // Set expiry date (default 7 days if not provided)
    const expiresAt = dueDate ? new Date(dueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Generate unique reference
    const reference = `LINK-${Date.now()}-${Math.random().toString(36).substring(2, 11).toUpperCase()}`;

    // Initialize Paystack payment page
    const paystackResponse = await initializePayment({
      email: customerEmail,
      amount: amount * 100, // Convert to kobo
      reference,
      callback_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/verify?reference=${reference}`,
      metadata: {
        applicationId,
        applicationType,
        ...metadata
      }
    });

    // Create payment link record
    const paymentLink = await PaymentLink.create({
      applicationId,
      applicationType,
      paystackPageId: reference,
      paystackPageUrl: paystackResponse.data.authorization_url,
      amount,
      description,
      expiresAt,
      createdBy,
      customerEmail,
      customerPhone,
      metadata
    });

    logger.info(`Payment link generated: ${paymentLink._id} for ${applicationType} ${applicationId}`);

    return paymentLink;
  } catch (error) {
    logger.error('Error generating payment link:', error);
    throw error;
  }
};

/**
 * Send payment link via email
 */
const sendPaymentLinkEmail = async (paymentLinkId) => {
  try {
    const paymentLink = await PaymentLink.findById(paymentLinkId)
      .populate('createdBy', 'firstName lastName email');

    if (!paymentLink) {
      throw new Error('Payment link not found');
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #dc2626; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; background-color: #f9fafb; }
          .button { display: inline-block; padding: 12px 30px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
          .amount { font-size: 24px; font-weight: bold; color: #dc2626; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Payment Request</h1>
          </div>
          <div class="content">
            <p>Dear Customer,</p>
            <p>${paymentLink.description || 'You have a pending payment for your application.'}</p>
            <p>Amount to pay: <span class="amount">₦${paymentLink.amount.toLocaleString()}</span></p>
            <p>This payment link expires on: <strong>${paymentLink.expiresAt.toLocaleDateString()}</strong></p>
            <center>
              <a href="${paymentLink.paystackPageUrl}" class="button">Pay Now</a>
            </center>
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #dc2626;">${paymentLink.paystackPageUrl}</p>
            <p>If you have any questions, please contact us.</p>
            <p>Best regards,<br>The Travel Place Team</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} The Travel Place. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await sendEmail({
      to: paymentLink.customerEmail,
      subject: 'Payment Request - The Travel Place',
      html: emailHtml
    });

    // Update payment link
    paymentLink.sentVia.push('email');
    paymentLink.sentAt = new Date();
    await paymentLink.save();

    logger.info(`Payment link email sent to ${paymentLink.customerEmail}`);

    return { success: true };
  } catch (error) {
    logger.error('Error sending payment link email:', error);
    throw error;
  }
};

/**
 * Verify payment and update link status
 */
const verifyPaymentLink = async (reference) => {
  try {
    const { verifyPayment } = require('./paystackService');
    
    // Verify with Paystack
    const paymentData = await verifyPayment(reference);

    if (!paymentData || !paymentData.data) {
      throw new Error('Payment verification failed');
    }

    const { status } = paymentData.data;

    // Find payment link
    const paymentLink = await PaymentLink.findOne({ paystackPageId: reference });

    if (!paymentLink) {
      throw new Error('Payment link not found');
    }

    if (status === 'success') {
      await paymentLink.markAsPaid(reference);
      return { success: true, paymentLink };
    } else {
      return { success: false, message: 'Payment was not successful' };
    }
  } catch (error) {
    logger.error('Error verifying payment link:', error);
    throw error;
  }
};

/**
 * Get payment link by ID
 */
const getPaymentLink = async (paymentLinkId) => {
  return await PaymentLink.findById(paymentLinkId)
    .populate('createdBy', 'firstName lastName email')
    .populate('applicationId');
};

/**
 * Cancel payment link
 */
const cancelPaymentLink = async (paymentLinkId) => {
  const paymentLink = await PaymentLink.findById(paymentLinkId);
  
  if (!paymentLink) {
    throw new Error('Payment link not found');
  }

  if (paymentLink.status === 'paid') {
    throw new Error('Cannot cancel a paid payment link');
  }

  paymentLink.status = 'cancelled';
  await paymentLink.save();

  return paymentLink;
};

module.exports = {
  generatePaymentLink,
  sendPaymentLinkEmail,
  verifyPaymentLink,
  getPaymentLink,
  cancelPaymentLink
};
