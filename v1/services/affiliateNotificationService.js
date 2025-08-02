// v1/services/affiliateNotificationService.js
const { sendEmail } = require('../utils/emailService');
const { sendSMS } = require('../utils/smsService');
const logger = require('../utils/logger');
const Affiliate = require('../models/affiliateModel');
const User = require('../models/userModel');

/**
 * @class AffiliateNotificationService
 * @description Service for managing affiliate notifications including email and SMS alerts
 */
class AffiliateNotificationService {
  /**
   * Send commission earned notification
   * @param {Object} commissionData - Commission transaction data
   * @param {Object} affiliate - Affiliate document
   */
  static async sendCommissionEarnedNotification(commissionData, affiliate) {
    try {
      const user = await User.findById(affiliate.userId);
      if (!user) {
        throw new Error('User not found for affiliate');
      }

      const preferences = affiliate.notificationPreferences || {};
      
      // Send email notification if enabled
      if (preferences.email !== false && user.email) {
        const emailTemplate = this.getCommissionEarnedEmailTemplate(commissionData, affiliate);
        await sendEmail({
          to: user.email,
          subject: emailTemplate.subject,
          html: emailTemplate.html
        });
      }

      // Send SMS notification if enabled
      if (preferences.sms === true && user.phoneNumber) {
        const smsMessage = this.getCommissionEarnedSMSTemplate(commissionData, affiliate);
        await sendSMS(user.phoneNumber, smsMessage);
      }

      logger.info(`Commission earned notification sent to affiliate ${affiliate.affiliateId}`);
    } catch (error) {
      logger.error(`Error sending commission earned notification: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send withdrawal processed notification
   * @param {Object} withdrawalData - Withdrawal transaction data
   * @param {Object} affiliate - Affiliate document
   */
  static async sendWithdrawalProcessedNotification(withdrawalData, affiliate) {
    try {
      const user = await User.findById(affiliate.userId);
      if (!user) {
        throw new Error('User not found for affiliate');
      }

      const preferences = affiliate.notificationPreferences || {};
      
      // Send email notification if enabled
      if (preferences.email !== false && user.email) {
        const emailTemplate = this.getWithdrawalProcessedEmailTemplate(withdrawalData, affiliate);
        await sendEmail({
          to: user.email,
          subject: emailTemplate.subject,
          html: emailTemplate.html
        });
      }

      // Send SMS notification if enabled
      if (preferences.sms === true && user.phoneNumber) {
        const smsMessage = this.getWithdrawalProcessedSMSTemplate(withdrawalData, affiliate);
        await sendSMS(user.phoneNumber, smsMessage);
      }

      logger.info(`Withdrawal processed notification sent to affiliate ${affiliate.affiliateId}`);
    } catch (error) {
      logger.error(`Error sending withdrawal processed notification: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send account status change notification
   * @param {Object} affiliate - Affiliate document
   * @param {string} previousStatus - Previous status
   * @param {string} newStatus - New status
   */
  static async sendAccountStatusChangeNotification(affiliate, previousStatus, newStatus) {
    try {
      const user = await User.findById(affiliate.userId);
      if (!user) {
        throw new Error('User not found for affiliate');
      }

      const preferences = affiliate.notificationPreferences || {};
      
      // Send email notification if enabled
      if (preferences.email !== false && user.email) {
        const emailTemplate = this.getAccountStatusChangeEmailTemplate(affiliate, previousStatus, newStatus);
        await sendEmail({
          to: user.email,
          subject: emailTemplate.subject,
          html: emailTemplate.html
        });
      }

      // Send SMS notification if enabled
      if (preferences.sms === true && user.phoneNumber) {
        const smsMessage = this.getAccountStatusChangeSMSTemplate(affiliate, previousStatus, newStatus);
        await sendSMS(user.phoneNumber, smsMessage);
      }

      logger.info(`Account status change notification sent to affiliate ${affiliate.affiliateId}`);
    } catch (error) {
      logger.error(`Error sending account status change notification: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate and send monthly statement
   * @param {Object} affiliate - Affiliate document
   * @param {Object} statementData - Monthly statement data
   */
  static async sendMonthlyStatement(affiliate, statementData) {
    try {
      const user = await User.findById(affiliate.userId);
      if (!user) {
        throw new Error('User not found for affiliate');
      }

      const preferences = affiliate.notificationPreferences || {};
      
      // Send email statement if enabled (monthly statements are typically email-only)
      if (preferences.monthlyStatements !== false && user.email) {
        const emailTemplate = this.getMonthlyStatementEmailTemplate(affiliate, statementData);
        await sendEmail({
          to: user.email,
          subject: emailTemplate.subject,
          html: emailTemplate.html
        });
      }

      logger.info(`Monthly statement sent to affiliate ${affiliate.affiliateId}`);
    } catch (error) {
      logger.error(`Error sending monthly statement: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get commission earned email template
   * @param {Object} commissionData - Commission data
   * @param {Object} affiliate - Affiliate data
   * @returns {Object} Email template with subject and html
   */
  static getCommissionEarnedEmailTemplate(commissionData, affiliate) {
    const subject = `Commission Earned - ₦${commissionData.commissionAmount.toLocaleString()}`;
    
    // Generate QR code access URL if QR code exists
    const qrCodeSection = commissionData.qrCode ? `
      <div style="background-color: #e9ecef; padding: 15px; border-radius: 5px; margin: 15px 0; text-align: center;">
        <h4>Transaction QR Code</h4>
        <p>Access your commission transaction QR code:</p>
        <a href="${commissionData.qrCode.url}" style="display: inline-block; background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View QR Code</a>
        <p style="font-size: 12px; color: #666; margin-top: 10px;">Use this QR code to quickly access transaction details or share with customers.</p>
      </div>
    ` : '';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Commission Earned</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #007bff; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .commission-details { background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .amount { font-size: 24px; font-weight: bold; color: #28a745; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Commission Earned!</h1>
          </div>
          <div class="content">
            <p>Dear ${affiliate.businessName},</p>
            <p>Great news! You've earned a new commission from a successful referral.</p>
            
            <div class="commission-details">
              <h3>Commission Details</h3>
              <p><strong>Amount:</strong> <span class="amount">₦${commissionData.commissionAmount.toLocaleString()}</span></p>
              <p><strong>Service Type:</strong> ${commissionData.serviceType}</p>
              <p><strong>Booking Reference:</strong> ${commissionData.bookingReference}</p>
              <p><strong>Commission Rate:</strong> ${commissionData.commissionRate}%</p>
              <p><strong>Booking Amount:</strong> ₦${commissionData.bookingAmount.toLocaleString()}</p>
              <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
            </div>
            
            ${qrCodeSection}
            
            <p>This commission has been credited to your affiliate wallet and will be available for withdrawal once approved.</p>
            
            <p>Keep up the great work promoting The Travel Place services!</p>
            
            <p>Best regards,<br>The Travel Place Team</p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return { subject, html };
  }

  /**
   * Get withdrawal processed email template
   * @param {Object} withdrawalData - Withdrawal data
   * @param {Object} affiliate - Affiliate data
   * @returns {Object} Email template with subject and html
   */
  static getWithdrawalProcessedEmailTemplate(withdrawalData, affiliate) {
    const subject = `Withdrawal ${withdrawalData.status === 'completed' ? 'Completed' : 'Update'} - ₦${withdrawalData.amount.toLocaleString()}`;
    
    // Generate QR code access URL if QR code exists
    const qrCodeSection = withdrawalData.qrCode ? `
      <div style="background-color: #e9ecef; padding: 15px; border-radius: 5px; margin: 15px 0; text-align: center;">
        <h4>Withdrawal QR Code</h4>
        <p>Access your withdrawal transaction QR code:</p>
        <a href="${withdrawalData.qrCode.url}" style="display: inline-block; background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View QR Code</a>
        <p style="font-size: 12px; color: #666; margin-top: 10px;">Use this QR code to quickly access withdrawal details or for record keeping.</p>
      </div>
    ` : '';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Withdrawal ${withdrawalData.status === 'completed' ? 'Completed' : 'Update'}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #007bff; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .withdrawal-details { background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .amount { font-size: 24px; font-weight: bold; color: #28a745; }
          .status { padding: 5px 10px; border-radius: 3px; font-weight: bold; }
          .status.completed { background-color: #d4edda; color: #155724; }
          .status.failed { background-color: #f8d7da; color: #721c24; }
          .status.processing { background-color: #fff3cd; color: #856404; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Withdrawal ${withdrawalData.status === 'completed' ? 'Completed' : 'Update'}</h1>
          </div>
          <div class="content">
            <p>Dear ${affiliate.businessName},</p>
            <p>Your withdrawal request has been ${withdrawalData.status}.</p>
            
            <div class="withdrawal-details">
              <h3>Withdrawal Details</h3>
              <p><strong>Amount:</strong> <span class="amount">₦${withdrawalData.amount.toLocaleString()}</span></p>
              <p><strong>Status:</strong> <span class="status ${withdrawalData.status}">${withdrawalData.status.toUpperCase()}</span></p>
              <p><strong>Bank Account:</strong> ${withdrawalData.bankDetails.accountName} - ${withdrawalData.bankDetails.accountNumber}</p>
              <p><strong>Bank:</strong> ${withdrawalData.bankDetails.bankName}</p>
              <p><strong>Request Date:</strong> ${new Date(withdrawalData.createdAt).toLocaleDateString()}</p>
              ${withdrawalData.processedAt ? `<p><strong>Processed Date:</strong> ${new Date(withdrawalData.processedAt).toLocaleDateString()}</p>` : ''}
              ${withdrawalData.paystackReference ? `<p><strong>Reference:</strong> ${withdrawalData.paystackReference}</p>` : ''}
            </div>
            
            ${qrCodeSection}
            
            ${withdrawalData.status === 'completed' ? 
              '<p>The funds should reflect in your bank account within 1-3 business days.</p>' :
              withdrawalData.status === 'failed' ? 
                `<p>Unfortunately, your withdrawal failed. ${withdrawalData.failureReason ? `Reason: ${withdrawalData.failureReason}` : ''} Please contact support for assistance.</p>` :
                '<p>Your withdrawal is being processed. You will receive another notification once completed.</p>'
            }
            
            <p>Best regards,<br>The Travel Place Team</p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return { subject, html };
  }

  /**
   * Get account status change email template
   * @param {Object} affiliate - Affiliate data
   * @param {string} previousStatus - Previous status
   * @param {string} newStatus - New status
   * @returns {Object} Email template with subject and html
   */
  static getAccountStatusChangeEmailTemplate(affiliate, previousStatus, newStatus) {
    const subject = `Account Status Update - ${newStatus.toUpperCase()}`;
    
    // Generate QR code access URL if QR code exists and account is active
    const qrCodeSection = (affiliate.qrCode && newStatus === 'active') ? `
      <div style="background-color: #e9ecef; padding: 15px; border-radius: 5px; margin: 15px 0; text-align: center;">
        <h4>Your Affiliate QR Code</h4>
        <p>Access your affiliate referral QR code:</p>
        <a href="${affiliate.qrCode.url}" style="display: inline-block; background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View QR Code</a>
        <p style="font-size: 12px; color: #666; margin-top: 10px;">Share this QR code with customers to track referrals and earn commissions.</p>
      </div>
    ` : '';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Account Status Update</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #007bff; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .status-details { background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .status { padding: 5px 10px; border-radius: 3px; font-weight: bold; }
          .status.active { background-color: #d4edda; color: #155724; }
          .status.suspended { background-color: #f8d7da; color: #721c24; }
          .status.pending { background-color: #fff3cd; color: #856404; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Account Status Update</h1>
          </div>
          <div class="content">
            <p>Dear ${affiliate.businessName},</p>
            <p>Your affiliate account status has been updated.</p>
            
            <div class="status-details">
              <h3>Status Change Details</h3>
              <p><strong>Previous Status:</strong> <span class="status ${previousStatus}">${previousStatus.toUpperCase()}</span></p>
              <p><strong>New Status:</strong> <span class="status ${newStatus}">${newStatus.toUpperCase()}</span></p>
              <p><strong>Affiliate ID:</strong> ${affiliate.affiliateId}</p>
              <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
              ${affiliate.suspensionReason ? `<p><strong>Reason:</strong> ${affiliate.suspensionReason}</p>` : ''}
            </div>
            
            ${qrCodeSection}
            
            ${newStatus === 'active' ? 
              '<p>Congratulations! Your affiliate account is now active. You can start earning commissions from referrals.</p>' :
              newStatus === 'suspended' ? 
                '<p>Your affiliate account has been suspended. Please contact support for more information.</p>' :
                newStatus === 'pending' ?
                  '<p>Your affiliate account is pending approval. We will notify you once it has been reviewed.</p>' :
                  '<p>Your affiliate account status has been updated. Please contact support if you have any questions.</p>'
            }
            
            <p>Best regards,<br>The Travel Place Team</p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return { subject, html };
  }

  /**
   * Get monthly statement email template
   * @param {Object} affiliate - Affiliate data
   * @param {Object} statementData - Statement data
   * @returns {Object} Email template with subject and html
   */
  static getMonthlyStatementEmailTemplate(affiliate, statementData) {
    const subject = `Monthly Affiliate Statement - ${statementData.month} ${statementData.year}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Monthly Affiliate Statement</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #007bff; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .statement-details { background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 15px 0; }
          .summary-item { background-color: #f8f9fa; padding: 10px; border-radius: 3px; text-align: center; }
          .amount { font-size: 18px; font-weight: bold; color: #28a745; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Monthly Statement</h1>
            <p>${statementData.month} ${statementData.year}</p>
          </div>
          <div class="content">
            <p>Dear ${affiliate.businessName},</p>
            <p>Here's your monthly affiliate performance summary for ${statementData.month} ${statementData.year}.</p>
            
            <div class="statement-details">
              <h3>Performance Summary</h3>
              <div class="summary-grid">
                <div class="summary-item">
                  <p><strong>Total Referrals</strong></p>
                  <p class="amount">${statementData.totalReferrals}</p>
                </div>
                <div class="summary-item">
                  <p><strong>Successful Bookings</strong></p>
                  <p class="amount">${statementData.successfulBookings}</p>
                </div>
                <div class="summary-item">
                  <p><strong>Total Commissions</strong></p>
                  <p class="amount">₦${statementData.totalCommissions.toLocaleString()}</p>
                </div>
                <div class="summary-item">
                  <p><strong>Withdrawals</strong></p>
                  <p class="amount">₦${statementData.totalWithdrawals.toLocaleString()}</p>
                </div>
              </div>
              
              <h4>Commission Breakdown by Service</h4>
              <ul>
                <li>Flights: ₦${(statementData.commissionsByService.flights || 0).toLocaleString()}</li>
                <li>Hotels: ₦${(statementData.commissionsByService.hotels || 0).toLocaleString()}</li>
                <li>Insurance: ₦${(statementData.commissionsByService.insurance || 0).toLocaleString()}</li>
                <li>Visa: ₦${(statementData.commissionsByService.visa || 0).toLocaleString()}</li>
              </ul>
              
              <p><strong>Current Wallet Balance:</strong> ₦${statementData.currentBalance.toLocaleString()}</p>
            </div>
            
            <p>Thank you for your continued partnership with The Travel Place!</p>
            
            <p>Best regards,<br>The Travel Place Team</p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return { subject, html };
  }

  /**
   * Get commission earned SMS template
   * @param {Object} commissionData - Commission data
   * @param {Object} affiliate - Affiliate data
   * @returns {string} SMS message
   */
  static getCommissionEarnedSMSTemplate(commissionData, affiliate) {
    const qrCodeText = commissionData.qrCode ? ` QR code: ${commissionData.qrCode.url}` : '';
    return `Commission Earned! ₦${commissionData.commissionAmount.toLocaleString()} from ${commissionData.serviceType} booking (${commissionData.bookingReference}). Check your affiliate dashboard for details.${qrCodeText} - The Travel Place`;
  }

  /**
   * Get withdrawal processed SMS template
   * @param {Object} withdrawalData - Withdrawal data
   * @param {Object} affiliate - Affiliate data
   * @returns {string} SMS message
   */
  static getWithdrawalProcessedSMSTemplate(withdrawalData, affiliate) {
    const statusMessage = withdrawalData.status === 'completed' ? 
      'completed. Funds will reflect in 1-3 business days.' :
      withdrawalData.status === 'failed' ?
        'failed. Please contact support.' :
        'is being processed.';
    
    const qrCodeText = withdrawalData.qrCode ? ` QR: ${withdrawalData.qrCode.url}` : '';
    return `Withdrawal Update: Your ₦${withdrawalData.amount.toLocaleString()} withdrawal ${statusMessage}${qrCodeText} - The Travel Place`;
  }

  /**
   * Get account status change SMS template
   * @param {Object} affiliate - Affiliate data
   * @param {string} previousStatus - Previous status
   * @param {string} newStatus - New status
   * @returns {string} SMS message
   */
  static getAccountStatusChangeSMSTemplate(affiliate, previousStatus, newStatus) {
    const statusMessage = newStatus === 'active' ? 
      'Your affiliate account is now active!' :
      newStatus === 'suspended' ?
        'Your affiliate account has been suspended.' :
        `Your affiliate account status: ${newStatus.toUpperCase()}`;
    
    const qrCodeText = (affiliate.qrCode && newStatus === 'active') ? ` QR: ${affiliate.qrCode.url}` : '';
    return `${statusMessage} Check your email for details.${qrCodeText} - The Travel Place`;
  }

  /**
   * Update notification preferences for an affiliate
   * @param {string} affiliateId - Affiliate ID
   * @param {Object} preferences - Notification preferences
   */
  static async updateNotificationPreferences(affiliateId, preferences) {
    try {
      const affiliate = await Affiliate.findById(affiliateId);
      if (!affiliate) {
        throw new Error('Affiliate not found');
      }

      affiliate.notificationPreferences = {
        ...affiliate.notificationPreferences,
        ...preferences
      };

      await affiliate.save();
      logger.info(`Notification preferences updated for affiliate ${affiliate.affiliateId}`);
      
      return affiliate.notificationPreferences;
    } catch (error) {
      logger.error(`Error updating notification preferences: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get notification preferences for an affiliate
   * @param {string} affiliateId - Affiliate ID
   * @returns {Object} Notification preferences
   */
  static async getNotificationPreferences(affiliateId) {
    try {
      const affiliate = await Affiliate.findById(affiliateId);
      if (!affiliate) {
        throw new Error('Affiliate not found');
      }

      return affiliate.notificationPreferences || {
        email: true,
        sms: false,
        monthlyStatements: true
      };
    } catch (error) {
      logger.error(`Error getting notification preferences: ${error.message}`);
      throw error;
    }
  }
}

module.exports = AffiliateNotificationService;