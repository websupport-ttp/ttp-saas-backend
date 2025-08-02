// v1/services/qrCodeService.js
const QRCode = require('qrcode');
const crypto = require('crypto');
const logger = require('../utils/logger');
const { ApiError } = require('../utils/apiError');
const ServiceWrapper = require('../utils/serviceWrapper');
const { StatusCodes } = require('http-status-codes');

// Create service wrapper with fallback strategies
const qrCodeWrapper = new ServiceWrapper('QRCode', {
  failureThreshold: 3,
  recoveryTimeout: 15000, // 15 seconds
  maxRetries: 3,
  initialDelay: 200,
  fallbackStrategies: {
    generateQRCode: {
      type: 'degraded_response'
    },
    validateQRCode: {
      type: 'cache'
    }
  }
});

// QR Code types
const QR_CODE_TYPES = {
  AFFILIATE: 'affiliate',
  COMMISSION: 'commission',
  WITHDRAWAL: 'withdrawal',
  REFERRAL: 'referral'
};

// QR Code configuration
const QR_CODE_CONFIG = {
  errorCorrectionLevel: 'M',
  type: 'image/png',
  quality: 0.92,
  margin: 1,
  color: {
    dark: '#000000',
    light: '#FFFFFF'
  },
  width: 256
};

/**
 * @function generateQRCodeId
 * @description Generate unique QR code ID
 * @returns {string} Unique QR code ID
 */
const generateQRCodeId = () => {
  return `qr_${crypto.randomUUID()}`;
};

/**
 * @function createQRCodeData
 * @description Create QR code data structure
 * @param {string} type - QR code type
 * @param {string} id - Related record ID
 * @param {object} metadata - Additional metadata
 * @returns {object} QR code data structure
 */
const createQRCodeData = (type, id, metadata = {}) => {
  const qrId = generateQRCodeId();
  const timestamp = new Date();
  
  return {
    qrId,
    type,
    id,
    timestamp,
    metadata: {
      version: '1.0',
      source: metadata.source || 'travel-place-api',
      ...metadata
    },
    url: `${process.env.FRONTEND_URL || 'https://app.travelplace.com'}/qr/${qrId}`
  };
};

/**
 * @function encodeQRCodeData
 * @description Encode QR code data to JSON string
 * @param {object} qrData - QR code data object
 * @returns {string} Encoded QR code data
 */
const encodeQRCodeData = (qrData) => {
  try {
    return JSON.stringify(qrData);
  } catch (error) {
    logger.error('Failed to encode QR code data:', error);
    throw new ApiError('Failed to encode QR code data', StatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * @function decodeQRCodeData
 * @description Decode QR code data from JSON string
 * @param {string} encodedData - Encoded QR code data
 * @returns {object} Decoded QR code data
 */
const decodeQRCodeData = (encodedData) => {
  try {
    const decoded = JSON.parse(encodedData);
    
    // Validate required fields
    if (!decoded.qrId || !decoded.type || !decoded.id) {
      throw new Error('Invalid QR code data structure');
    }
    
    return decoded;
  } catch (error) {
    logger.error('Failed to decode QR code data:', error);
    throw new ApiError('Invalid QR code data', StatusCodes.BAD_REQUEST);
  }
};

/**
 * @function generateQRCodeImage
 * @description Generate QR code image from data
 * @param {string} data - Data to encode in QR code
 * @param {object} options - QR code generation options
 * @returns {Promise<string>} Base64 encoded QR code image
 */
const generateQRCodeImage = async (data, options = {}) => {
  const config = { ...QR_CODE_CONFIG, ...options };
  
  try {
    const qrCodeDataURL = await QRCode.toDataURL(data, config);
    // Remove data URL prefix to get just the base64 data
    return qrCodeDataURL.replace(/^data:image\/png;base64,/, '');
  } catch (error) {
    logger.error('Failed to generate QR code image:', error);
    throw new ApiError('Failed to generate QR code image', StatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * @function generateAffiliateQR
 * @description Generate QR code for affiliate account
 * @param {object} affiliateData - Affiliate data
 * @returns {Promise<object>} QR code object with data and image
 */
const generateAffiliateQR = async (affiliateData) => {
  if (!affiliateData.affiliateId || !affiliateData.referralCode) {
    throw new ApiError('Affiliate ID and referral code are required', StatusCodes.BAD_REQUEST);
  }

  return await qrCodeWrapper.execute(
    async () => {
      const qrData = createQRCodeData(QR_CODE_TYPES.AFFILIATE, affiliateData.affiliateId, {
        affiliateId: affiliateData.affiliateId,
        referralCode: affiliateData.referralCode,
        businessName: affiliateData.businessName,
        expiresAt: null // Affiliate QR codes don't expire
      });

      const encodedData = encodeQRCodeData(qrData);
      const imageData = await generateQRCodeImage(encodedData);

      return {
        data: imageData,
        url: qrData.url,
        metadata: qrData
      };
    },
    'generateAffiliateQR',
    { affiliateId: affiliateData.affiliateId }
  );
};

/**
 * @function generateCommissionQR
 * @description Generate QR code for commission transaction
 * @param {object} commissionData - Commission transaction data
 * @returns {Promise<object>} QR code object with data and image
 */
const generateCommissionQR = async (commissionData) => {
  if (!commissionData.transactionId || !commissionData.affiliateId) {
    throw new ApiError('Transaction ID and affiliate ID are required', StatusCodes.BAD_REQUEST);
  }

  return await qrCodeWrapper.execute(
    async () => {
      const qrData = createQRCodeData(QR_CODE_TYPES.COMMISSION, commissionData.transactionId, {
        affiliateId: commissionData.affiliateId,
        amount: commissionData.commissionAmount,
        currency: commissionData.currency || 'NGN',
        serviceType: commissionData.serviceType,
        bookingReference: commissionData.bookingReference,
        status: commissionData.status
      });

      const encodedData = encodeQRCodeData(qrData);
      const imageData = await generateQRCodeImage(encodedData);

      return {
        data: imageData,
        url: qrData.url,
        metadata: qrData
      };
    },
    'generateCommissionQR',
    { transactionId: commissionData.transactionId }
  );
};

/**
 * @function generateWithdrawalQR
 * @description Generate QR code for withdrawal transaction
 * @param {object} withdrawalData - Withdrawal transaction data
 * @returns {Promise<object>} QR code object with data and image
 */
const generateWithdrawalQR = async (withdrawalData) => {
  if (!withdrawalData.withdrawalId || !withdrawalData.affiliateId) {
    throw new ApiError('Withdrawal ID and affiliate ID are required', StatusCodes.BAD_REQUEST);
  }

  return await qrCodeWrapper.execute(
    async () => {
      const qrData = createQRCodeData(QR_CODE_TYPES.WITHDRAWAL, withdrawalData.withdrawalId, {
        affiliateId: withdrawalData.affiliateId,
        amount: withdrawalData.amount,
        currency: withdrawalData.currency || 'NGN',
        status: withdrawalData.status,
        bankDetails: {
          accountName: withdrawalData.bankDetails?.accountName,
          bankName: withdrawalData.bankDetails?.bankName
          // Don't include sensitive account number in QR code
        }
      });

      const encodedData = encodeQRCodeData(qrData);
      const imageData = await generateQRCodeImage(encodedData);

      return {
        data: imageData,
        url: qrData.url,
        metadata: qrData
      };
    },
    'generateWithdrawalQR',
    { withdrawalId: withdrawalData.withdrawalId }
  );
};

/**
 * @function generateReferralQR
 * @description Generate QR code for referral link
 * @param {object} referralData - Referral data
 * @returns {Promise<object>} QR code object with data and image
 */
const generateReferralQR = async (referralData) => {
  if (!referralData.affiliateId || !referralData.referralCode) {
    throw new ApiError('Affiliate ID and referral code are required', StatusCodes.BAD_REQUEST);
  }

  return await qrCodeWrapper.execute(
    async () => {
      const expiresAt = referralData.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days default
      
      const qrData = createQRCodeData(QR_CODE_TYPES.REFERRAL, referralData.affiliateId, {
        affiliateId: referralData.affiliateId,
        referralCode: referralData.referralCode,
        expiresAt,
        campaign: referralData.campaign,
        source: referralData.source || 'qr_code'
      });

      const encodedData = encodeQRCodeData(qrData);
      const imageData = await generateQRCodeImage(encodedData);

      return {
        data: imageData,
        url: qrData.url,
        metadata: qrData
      };
    },
    'generateReferralQR',
    { affiliateId: referralData.affiliateId }
  );
};

/**
 * @function validateQRCode
 * @description Validate QR code data and check expiration
 * @param {string} encodedData - Encoded QR code data
 * @returns {Promise<object>} Validation result with decoded data
 */
const validateQRCode = async (encodedData) => {
  if (!encodedData) {
    throw new ApiError('QR code data is required', StatusCodes.BAD_REQUEST);
  }

  return await qrCodeWrapper.execute(
    async () => {
      const qrData = decodeQRCodeData(encodedData);
      
      // Check if QR code has expired
      if (qrData.metadata.expiresAt) {
        const expirationDate = new Date(qrData.metadata.expiresAt);
        if (expirationDate < new Date()) {
          return {
            valid: false,
            reason: 'QR code has expired',
            data: qrData
          };
        }
      }
      
      // Validate QR code type
      if (!Object.values(QR_CODE_TYPES).includes(qrData.type)) {
        return {
          valid: false,
          reason: 'Invalid QR code type',
          data: qrData
        };
      }
      
      return {
        valid: true,
        data: qrData
      };
    },
    'validateQRCode',
    { cacheKey: `qr_validate_${crypto.createHash('md5').update(encodedData).digest('hex')}` }
  );
};

/**
 * @function getQRCodeMetadata
 * @description Get QR code metadata by QR ID
 * @param {string} qrId - QR code ID
 * @returns {Promise<object>} QR code metadata
 */
const getQRCodeMetadata = async (qrId) => {
  if (!qrId) {
    throw new ApiError('QR code ID is required', StatusCodes.BAD_REQUEST);
  }

  // This would typically query a database for stored QR code metadata
  // For now, we'll return a placeholder response
  logger.info(`Retrieving metadata for QR code: ${qrId}`);
  
  // In a real implementation, this would query the database
  // return await QRCodeModel.findOne({ qrId });
  
  throw new ApiError('QR code metadata retrieval not yet implemented', StatusCodes.NOT_IMPLEMENTED);
};

/**
 * @function getQRCodeHealth
 * @description Get QR code service health status
 * @returns {object} Health status
 */
const getQRCodeHealth = () => {
  return qrCodeWrapper.getHealthStatus();
};

/**
 * @function performHealthCheck
 * @description Perform health check on QR code service
 * @returns {Promise<boolean>} Health check result
 */
const performHealthCheck = async () => {
  return await qrCodeWrapper.performHealthCheck(async () => {
    // Simple health check - generate a test QR code
    const testData = { test: 'health_check', timestamp: new Date() };
    await generateQRCodeImage(JSON.stringify(testData));
  });
};

/**
 * @function resetQRCodeService
 * @description Reset QR code service wrapper (for admin use)
 */
const resetQRCodeService = () => {
  qrCodeWrapper.reset();
  logger.info('QR code service wrapper has been reset');
};

module.exports = {
  // QR Code generation methods
  generateAffiliateQR,
  generateCommissionQR,
  generateWithdrawalQR,
  generateReferralQR,
  
  // QR Code validation and utility methods
  validateQRCode,
  getQRCodeMetadata,
  
  // Utility functions
  encodeQRCodeData,
  decodeQRCodeData,
  createQRCodeData,
  generateQRCodeImage,
  
  // Health and monitoring
  getQRCodeHealth,
  performHealthCheck,
  resetQRCodeService,
  
  // Constants
  QR_CODE_TYPES
};