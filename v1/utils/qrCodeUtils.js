// v1/utils/qrCodeUtils.js
const crypto = require('crypto');
const logger = require('./logger');
const { ApiError } = require('./apiError');
const { StatusCodes } = require('http-status-codes');

/**
 * @function generateQRCodeHash
 * @description Generate hash for QR code data for caching/indexing
 * @param {object} qrData - QR code data object
 * @returns {string} SHA-256 hash of QR code data
 */
const generateQRCodeHash = (qrData) => {
  try {
    const dataString = JSON.stringify(qrData, Object.keys(qrData).sort());
    return crypto.createHash('sha256').update(dataString).digest('hex');
  } catch (error) {
    logger.error('Failed to generate QR code hash:', error);
    throw new ApiError('Failed to generate QR code hash', StatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * @function validateQRCodeMetadata
 * @description Validate QR code metadata structure
 * @param {object} metadata - QR code metadata object
 * @returns {object} Validation result
 */
const validateQRCodeMetadata = (metadata) => {
  const errors = [];
  
  // Check required fields
  if (!metadata.version) {
    errors.push('Version is required in metadata');
  }
  
  if (!metadata.source) {
    errors.push('Source is required in metadata');
  }
  
  // Validate version format
  if (metadata.version && !/^\d+\.\d+$/.test(metadata.version)) {
    errors.push('Version must be in format "x.y"');
  }
  
  // Validate expiration date if present
  if (metadata.expiresAt) {
    const expirationDate = new Date(metadata.expiresAt);
    if (isNaN(expirationDate.getTime())) {
      errors.push('Invalid expiration date format');
    } else if (expirationDate <= new Date()) {
      errors.push('Expiration date must be in the future');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * @function sanitizeQRCodeMetadata
 * @description Sanitize QR code metadata by removing sensitive information
 * @param {object} metadata - QR code metadata object
 * @param {string} qrType - Type of QR code
 * @returns {object} Sanitized metadata
 */
const sanitizeQRCodeMetadata = (metadata, qrType) => {
  const sanitized = { ...metadata };
  
  // Remove sensitive fields based on QR code type
  switch (qrType) {
    case 'withdrawal':
      // Remove sensitive bank details
      if (sanitized.bankDetails) {
        delete sanitized.bankDetails.accountNumber;
        delete sanitized.bankDetails.bankCode;
      }
      break;
      
    case 'commission':
      // Keep commission data but remove internal processing details
      delete sanitized.internalProcessingId;
      delete sanitized.adminNotes;
      break;
      
    case 'affiliate':
      // Remove internal affiliate management data
      delete sanitized.internalAffiliateId;
      delete sanitized.approvalNotes;
      break;
      
    case 'referral':
      // Remove tracking data that shouldn't be in QR code
      delete sanitized.trackingPixel;
      delete sanitized.internalCampaignId;
      break;
  }
  
  return sanitized;
};

/**
 * @function enrichQRCodeMetadata
 * @description Enrich QR code metadata with additional context
 * @param {object} metadata - Base QR code metadata
 * @param {object} context - Additional context data
 * @returns {object} Enriched metadata
 */
const enrichQRCodeMetadata = (metadata, context = {}) => {
  const enriched = { ...metadata };
  
  // Add timestamp if not present
  if (!enriched.createdAt) {
    enriched.createdAt = new Date();
  }
  
  // Add environment information
  enriched.environment = process.env.NODE_ENV || 'development';
  
  // Add API version
  enriched.apiVersion = process.env.API_VERSION || '1.0';
  
  // Add context-specific enrichments
  if (context.userAgent) {
    enriched.generatedFrom = {
      userAgent: context.userAgent,
      ip: context.ip ? context.ip.replace(/\d+$/, 'xxx') : undefined // Mask last octet for privacy
    };
  }
  
  if (context.campaign) {
    enriched.campaign = context.campaign;
  }
  
  if (context.source) {
    enriched.generationSource = context.source;
  }
  
  return enriched;
};

/**
 * @function extractQRCodeInfo
 * @description Extract key information from QR code data for logging/analytics
 * @param {object} qrData - Complete QR code data object
 * @returns {object} Extracted key information
 */
const extractQRCodeInfo = (qrData) => {
  return {
    qrId: qrData.qrId,
    type: qrData.type,
    relatedId: qrData.id,
    createdAt: qrData.timestamp,
    expiresAt: qrData.metadata?.expiresAt,
    version: qrData.metadata?.version,
    source: qrData.metadata?.source,
    hasExpiration: !!qrData.metadata?.expiresAt,
    isExpired: qrData.metadata?.expiresAt ? new Date(qrData.metadata.expiresAt) <= new Date() : false
  };
};

/**
 * @function generateQRCodeAnalytics
 * @description Generate analytics data for QR code usage
 * @param {object} qrData - QR code data object
 * @param {string} action - Action performed (generated, scanned, validated)
 * @param {object} context - Additional context
 * @returns {object} Analytics data
 */
const generateQRCodeAnalytics = (qrData, action, context = {}) => {
  const info = extractQRCodeInfo(qrData);
  
  return {
    event: 'qr_code_event',
    action,
    qrCodeType: info.type,
    qrId: info.qrId,
    relatedId: info.relatedId,
    timestamp: new Date(),
    metadata: {
      ...info,
      userAgent: context.userAgent,
      ip: context.ip,
      source: context.source,
      campaign: context.campaign
    }
  };
};

/**
 * @function formatQRCodeForStorage
 * @description Format QR code data for database storage
 * @param {object} qrData - QR code data object
 * @param {string} imageData - Base64 image data
 * @returns {object} Formatted data for storage
 */
const formatQRCodeForStorage = (qrData, imageData) => {
  return {
    qrId: qrData.qrId,
    type: qrData.type,
    relatedId: qrData.id,
    imageData,
    url: qrData.url,
    metadata: qrData.metadata,
    hash: generateQRCodeHash(qrData),
    createdAt: qrData.timestamp,
    expiresAt: qrData.metadata?.expiresAt,
    isActive: true
  };
};

/**
 * @function parseQRCodeUrl
 * @description Parse QR code URL to extract QR ID
 * @param {string} url - QR code URL
 * @returns {object} Parsed URL information
 */
const parseQRCodeUrl = (url) => {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const qrIndex = pathParts.indexOf('qr');
    
    if (qrIndex === -1 || qrIndex === pathParts.length - 1) {
      throw new Error('Invalid QR code URL format');
    }
    
    const qrId = pathParts[qrIndex + 1];
    
    return {
      qrId,
      baseUrl: `${urlObj.protocol}//${urlObj.host}`,
      fullPath: urlObj.pathname,
      queryParams: Object.fromEntries(urlObj.searchParams)
    };
  } catch (error) {
    logger.error('Failed to parse QR code URL:', error);
    throw new ApiError('Invalid QR code URL format', StatusCodes.BAD_REQUEST);
  }
};

/**
 * @function generateQRCodeStats
 * @description Generate statistics for QR code usage
 * @param {Array} qrCodes - Array of QR code data
 * @returns {object} QR code statistics
 */
const generateQRCodeStats = (qrCodes) => {
  const stats = {
    total: qrCodes.length,
    byType: {},
    active: 0,
    expired: 0,
    expiringIn24Hours: 0,
    averageAge: 0
  };
  
  const now = new Date();
  const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  let totalAge = 0;
  
  qrCodes.forEach(qr => {
    // Count by type
    stats.byType[qr.type] = (stats.byType[qr.type] || 0) + 1;
    
    // Check expiration status
    if (qr.metadata?.expiresAt) {
      const expirationDate = new Date(qr.metadata.expiresAt);
      if (expirationDate <= now) {
        stats.expired++;
      } else if (expirationDate <= twentyFourHoursFromNow) {
        stats.expiringIn24Hours++;
        stats.active++;
      } else {
        stats.active++;
      }
    } else {
      stats.active++; // No expiration means active
    }
    
    // Calculate age
    const createdAt = new Date(qr.timestamp || qr.createdAt);
    totalAge += now.getTime() - createdAt.getTime();
  });
  
  // Calculate average age in hours
  if (qrCodes.length > 0) {
    stats.averageAge = Math.round(totalAge / qrCodes.length / (1000 * 60 * 60));
  }
  
  return stats;
};

module.exports = {
  generateQRCodeHash,
  validateQRCodeMetadata,
  sanitizeQRCodeMetadata,
  enrichQRCodeMetadata,
  extractQRCodeInfo,
  generateQRCodeAnalytics,
  formatQRCodeForStorage,
  parseQRCodeUrl,
  generateQRCodeStats
};