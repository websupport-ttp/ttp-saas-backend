// v1/utils/whatsappService.js
const axios = require('axios');
const logger = require('./logger');

/**
 * WhatsApp Business API Service
 * @description Service for sending WhatsApp messages using the official WhatsApp Business API
 */
class WhatsAppService {
  constructor() {
    this.baseURL = process.env.WHATSAPP_API_BASE_URL || 'https://graph.facebook.com/v18.0';
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    this.apiVersion = process.env.WHATSAPP_API_VERSION || 'v18.0';
  }

  /**
   * @function sendTextMessage
   * @description Sends a text message via WhatsApp Business API
   * @param {string} to - Recipient's phone number (with country code, no + sign)
   * @param {string} message - Message text
   * @returns {Promise<Object>} API response
   */
  async sendTextMessage(to, message) {
    try {
      // Remove any non-numeric characters except for the leading country code
      const cleanPhoneNumber = to.replace(/[^\d]/g, '');
      
      const payload = {
        messaging_product: 'whatsapp',
        to: cleanPhoneNumber,
        type: 'text',
        text: {
          body: message
        }
      };

      const response = await axios.post(
        `${this.baseURL}/${this.phoneNumberId}/messages`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info(`WhatsApp message sent successfully to ${to}`, {
        messageId: response.data.messages?.[0]?.id,
        recipient: cleanPhoneNumber
      });

      return {
        success: true,
        messageId: response.data.messages?.[0]?.id,
        data: response.data
      };

    } catch (error) {
      logger.error(`Error sending WhatsApp message to ${to}:`, {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status
      });

      throw new Error(`WhatsApp API Error: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * @function sendTemplateMessage
   * @description Sends a template message via WhatsApp Business API
   * @param {string} to - Recipient's phone number
   * @param {string} templateName - Name of the approved template
   * @param {string} languageCode - Language code (e.g., 'en_US')
   * @param {Array} parameters - Template parameters
   * @returns {Promise<Object>} API response
   */
  async sendTemplateMessage(to, templateName, languageCode = 'en_US', parameters = []) {
    try {
      const cleanPhoneNumber = to.replace(/[^\d]/g, '');
      
      const payload = {
        messaging_product: 'whatsapp',
        to: cleanPhoneNumber,
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: languageCode
          }
        }
      };

      // Add parameters if provided
      if (parameters.length > 0) {
        payload.template.components = [
          {
            type: 'body',
            parameters: parameters.map(param => ({
              type: 'text',
              text: param
            }))
          }
        ];
      }

      const response = await axios.post(
        `${this.baseURL}/${this.phoneNumberId}/messages`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info(`WhatsApp template message sent successfully to ${to}`, {
        messageId: response.data.messages?.[0]?.id,
        template: templateName,
        recipient: cleanPhoneNumber
      });

      return {
        success: true,
        messageId: response.data.messages?.[0]?.id,
        data: response.data
      };

    } catch (error) {
      logger.error(`Error sending WhatsApp template message to ${to}:`, {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status,
        template: templateName
      });

      throw new Error(`WhatsApp Template API Error: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * @function sendMediaMessage
   * @description Sends a media message (image, document, etc.) via WhatsApp Business API
   * @param {string} to - Recipient's phone number
   * @param {string} mediaType - Type of media ('image', 'document', 'audio', 'video')
   * @param {string} mediaUrl - URL of the media file
   * @param {string} caption - Optional caption for the media
   * @returns {Promise<Object>} API response
   */
  async sendMediaMessage(to, mediaType, mediaUrl, caption = '') {
    try {
      const cleanPhoneNumber = to.replace(/[^\d]/g, '');
      
      const payload = {
        messaging_product: 'whatsapp',
        to: cleanPhoneNumber,
        type: mediaType,
        [mediaType]: {
          link: mediaUrl
        }
      };

      // Add caption if provided and media type supports it
      if (caption && ['image', 'document', 'video'].includes(mediaType)) {
        payload[mediaType].caption = caption;
      }

      const response = await axios.post(
        `${this.baseURL}/${this.phoneNumberId}/messages`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info(`WhatsApp media message sent successfully to ${to}`, {
        messageId: response.data.messages?.[0]?.id,
        mediaType,
        recipient: cleanPhoneNumber
      });

      return {
        success: true,
        messageId: response.data.messages?.[0]?.id,
        data: response.data
      };

    } catch (error) {
      logger.error(`Error sending WhatsApp media message to ${to}:`, {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status,
        mediaType
      });

      throw new Error(`WhatsApp Media API Error: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * @function validateConfiguration
   * @description Validates that all required environment variables are set
   * @returns {Object} Validation result
   */
  validateConfiguration() {
    const requiredVars = [
      'WHATSAPP_PHONE_NUMBER_ID',
      'WHATSAPP_ACCESS_TOKEN'
    ];

    const missing = requiredVars.filter(varName => !process.env[varName]);

    if (missing.length > 0) {
      return {
        valid: false,
        missing,
        message: `Missing required WhatsApp environment variables: ${missing.join(', ')}`
      };
    }

    return {
      valid: true,
      message: 'WhatsApp configuration is valid'
    };
  }
}

// Create singleton instance
const whatsappService = new WhatsAppService();

/**
 * @function sendWhatsAppMessage
 * @description Wrapper function for sending WhatsApp text messages (maintains compatibility)
 * @param {string} to - Recipient's phone number
 * @param {string} body - Message text
 * @returns {Promise<void>}
 */
const sendWhatsAppMessage = async (to, body) => {
  try {
    await whatsappService.sendTextMessage(to, body);
    logger.info(`WhatsApp message sent to ${to}: ${body}`);
  } catch (error) {
    logger.error(`Error sending WhatsApp message to ${to}: ${error.message}`);
    throw error;
  }
};

module.exports = {
  whatsappService,
  sendWhatsAppMessage,
  WhatsAppService
};