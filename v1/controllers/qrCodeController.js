// v1/controllers/qrCodeController.js
const { StatusCodes } = require('http-status-codes');
const { ApiError } = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../middleware/asyncHandler');
const qrCodeService = require('../services/qrCodeService');
const logger = require('../utils/logger');

/**
 * @description Generate QR code for different purposes
 * @route POST /api/v1/qr-codes/generate
 * @access Private (authenticated users)
 */
const generateQRCode = asyncHandler(async (req, res) => {
  const { type, data, options = {} } = req.body;

  // Log QR code generation attempt
  logger.info('QR code generation attempt', {
    userId: req.user?.id,
    type,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  let qrResult;

  try {
    // Generate QR code based on type
    switch (type) {
      case qrCodeService.QR_CODE_TYPES.AFFILIATE:
        qrResult = await qrCodeService.generateAffiliateQR(data);
        break;
      case qrCodeService.QR_CODE_TYPES.COMMISSION:
        qrResult = await qrCodeService.generateCommissionQR(data);
        break;
      case qrCodeService.QR_CODE_TYPES.WITHDRAWAL:
        qrResult = await qrCodeService.generateWithdrawalQR(data);
        break;
      case qrCodeService.QR_CODE_TYPES.REFERRAL:
        qrResult = await qrCodeService.generateReferralQR(data);
        break;
      default:
        throw new ApiError(`Invalid QR code type: ${type}`, StatusCodes.BAD_REQUEST);
    }

    // Format response data
    const responseData = {
      qrId: qrResult.metadata.qrId,
      type: qrResult.metadata.type,
      imageData: qrResult.data,
      url: qrResult.url,
      downloadUrl: `${req.protocol}://${req.get('host')}/api/v1/qr-codes/${qrResult.metadata.qrId}/download`,
      metadata: {
        version: qrResult.metadata.metadata.version,
        source: qrResult.metadata.metadata.source,
        expiresAt: qrResult.metadata.metadata.expiresAt,
        ...getTypeSpecificMetadata(type, qrResult.metadata.metadata)
      }
    };

    logger.info('QR code generated successfully', {
      userId: req.user?.id,
      qrId: qrResult.metadata.qrId,
      type
    });

    return ApiResponse.created(
      res,
      'QR code generated successfully',
      responseData
    );

  } catch (error) {
    logger.error('QR code generation failed', {
      userId: req.user?.id,
      type,
      error: error.message,
      stack: error.stack
    });

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      'Failed to generate QR code',
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
});

/**
 * @description Validate QR code data
 * @route POST /api/v1/qr-codes/validate
 * @access Public
 */
const validateQRCode = asyncHandler(async (req, res) => {
  const { qrData } = req.body;

  if (!qrData) {
    throw new ApiError('QR data is required', StatusCodes.BAD_REQUEST);
  }

  // Log validation attempt
  logger.info('QR code validation attempt', {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  try {
    const validationResult = await qrCodeService.validateQRCode(qrData);

    const responseData = {
      valid: validationResult.valid,
      reason: validationResult.reason || null,
      qrData: validationResult.valid ? {
        qrId: validationResult.data.qrId,
        type: validationResult.data.type,
        id: validationResult.data.id,
        timestamp: validationResult.data.timestamp,
        metadata: sanitizeMetadata(validationResult.data.metadata)
      } : null
    };

    logger.info('QR code validation completed', {
      valid: validationResult.valid,
      reason: validationResult.reason,
      qrId: validationResult.data?.qrId
    });

    return ApiResponse.success(
      res,
      StatusCodes.OK,
      'QR code validation completed',
      responseData
    );

  } catch (error) {
    logger.error('QR code validation failed', {
      error: error.message,
      stack: error.stack
    });

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      'Failed to validate QR code',
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
});

/**
 * @description Get QR code metadata by QR ID
 * @route GET /api/v1/qr-codes/:qrId
 * @access Private (authenticated users with proper authorization)
 */
const getQRCodeMetadata = asyncHandler(async (req, res) => {
  const { qrId } = req.params;

  if (!qrId) {
    throw new ApiError('QR code ID is required', StatusCodes.BAD_REQUEST);
  }

  // Log metadata retrieval attempt
  logger.info('QR code metadata retrieval attempt', {
    userId: req.user?.id,
    qrId,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  try {
    // Note: This would typically query a database for stored QR code metadata
    // For now, we'll return a placeholder response as the service method is not fully implemented
    const metadata = await qrCodeService.getQRCodeMetadata(qrId);

    const responseData = {
      qrId,
      ...sanitizeMetadata(metadata)
    };

    logger.info('QR code metadata retrieved successfully', {
      userId: req.user?.id,
      qrId
    });

    return ApiResponse.success(
      res,
      StatusCodes.OK,
      'QR code metadata retrieved successfully',
      responseData
    );

  } catch (error) {
    logger.error('QR code metadata retrieval failed', {
      userId: req.user?.id,
      qrId,
      error: error.message,
      stack: error.stack
    });

    if (error instanceof ApiError) {
      // Handle specific error cases
      if (error.statusCode === StatusCodes.NOT_IMPLEMENTED) {
        throw new ApiError('QR code metadata retrieval is not yet available', StatusCodes.SERVICE_UNAVAILABLE);
      }
      throw error;
    }

    throw new ApiError(
      'Failed to retrieve QR code metadata',
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
});

/**
 * @description Download QR code image
 * @route GET /api/v1/qr-codes/:qrId/download
 * @access Public (may be protected based on QR type)
 */
const downloadQRCode = asyncHandler(async (req, res) => {
  const { qrId } = req.params;
  const { format = 'png', size } = req.query;

  if (!qrId) {
    throw new ApiError('QR code ID is required', StatusCodes.BAD_REQUEST);
  }

  // Validate format parameter
  if (format && !['png', 'svg'].includes(format.toLowerCase())) {
    throw new ApiError('Invalid format. Supported formats: png, svg', StatusCodes.BAD_REQUEST);
  }

  // Validate size parameter if provided
  if (size && (isNaN(size) || size < 64 || size > 1024)) {
    throw new ApiError('Invalid size. Size must be between 64 and 1024 pixels', StatusCodes.BAD_REQUEST);
  }

  // Log download attempt
  logger.info('QR code download attempt', {
    qrId,
    format,
    size,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  try {
    // Note: This would typically retrieve the QR code image from storage
    // For now, we'll return an error as the full implementation requires database integration
    throw new ApiError('QR code download is not yet available', StatusCodes.SERVICE_UNAVAILABLE);

    // Future implementation would look like:
    // const qrCodeData = await qrCodeService.getQRCodeById(qrId);
    // if (!qrCodeData) {
    //   throw new ApiError('QR code not found', StatusCodes.NOT_FOUND);
    // }
    // 
    // const imageBuffer = Buffer.from(qrCodeData.imageData, 'base64');
    // 
    // res.set({
    //   'Content-Type': `image/${format}`,
    //   'Content-Disposition': `attachment; filename="qr-${qrId}.${format}"`,
    //   'Content-Length': imageBuffer.length,
    //   'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
    // });
    // 
    // logger.info('QR code downloaded successfully', { qrId, format, size });
    // return res.send(imageBuffer);

  } catch (error) {
    logger.error('QR code download failed', {
      qrId,
      format,
      size,
      error: error.message,
      stack: error.stack
    });

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      'Failed to download QR code',
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
});

/**
 * @description Get QR code service health status
 * @route GET /api/v1/qr-codes/health
 * @access Public
 */
const getQRCodeHealth = asyncHandler(async (req, res) => {
  try {
    const healthStatus = qrCodeService.getQRCodeHealth();
    
    // Perform additional health checks
    const performanceCheck = await qrCodeService.performHealthCheck();
    
    const responseData = {
      status: healthStatus.isHealthy ? 'healthy' : 'unhealthy',
      service: 'QR Code Service',
      timestamp: new Date().toISOString(),
      checks: {
        serviceWrapper: {
          status: healthStatus.isHealthy ? 'pass' : 'fail',
          failures: healthStatus.failures,
          lastFailure: healthStatus.lastFailure,
          circuitBreakerOpen: healthStatus.circuitBreakerOpen
        },
        performanceCheck: {
          status: performanceCheck ? 'pass' : 'fail',
          description: 'QR code generation performance test'
        }
      },
      metrics: {
        totalRequests: healthStatus.totalRequests || 0,
        successfulRequests: healthStatus.successfulRequests || 0,
        failedRequests: healthStatus.failures || 0,
        averageResponseTime: healthStatus.averageResponseTime || 0
      }
    };

    const statusCode = healthStatus.isHealthy && performanceCheck 
      ? StatusCodes.OK 
      : StatusCodes.SERVICE_UNAVAILABLE;

    logger.info('QR code health check completed', {
      status: responseData.status,
      isHealthy: healthStatus.isHealthy,
      performanceCheck
    });

    return ApiResponse.success(
      res,
      statusCode,
      `QR code service is ${responseData.status}`,
      responseData
    );

  } catch (error) {
    logger.error('QR code health check failed', {
      error: error.message,
      stack: error.stack
    });

    const responseData = {
      status: 'unhealthy',
      service: 'QR Code Service',
      timestamp: new Date().toISOString(),
      error: error.message
    };

    return ApiResponse.success(
      res,
      StatusCodes.SERVICE_UNAVAILABLE,
      'QR code service is unhealthy',
      responseData
    );
  }
});

/**
 * Helper function to get type-specific metadata
 * @param {string} type - QR code type
 * @param {object} metadata - Full metadata object
 * @returns {object} Type-specific metadata
 */
const getTypeSpecificMetadata = (type, metadata) => {
  switch (type) {
    case qrCodeService.QR_CODE_TYPES.AFFILIATE:
      return {
        affiliateId: metadata.affiliateId,
        referralCode: metadata.referralCode,
        businessName: metadata.businessName
      };
    case qrCodeService.QR_CODE_TYPES.COMMISSION:
      return {
        affiliateId: metadata.affiliateId,
        amount: metadata.amount,
        currency: metadata.currency,
        serviceType: metadata.serviceType,
        bookingReference: metadata.bookingReference,
        status: metadata.status
      };
    case qrCodeService.QR_CODE_TYPES.WITHDRAWAL:
      return {
        affiliateId: metadata.affiliateId,
        amount: metadata.amount,
        currency: metadata.currency,
        status: metadata.status,
        bankDetails: metadata.bankDetails
      };
    case qrCodeService.QR_CODE_TYPES.REFERRAL:
      return {
        affiliateId: metadata.affiliateId,
        referralCode: metadata.referralCode,
        campaign: metadata.campaign,
        source: metadata.source
      };
    default:
      return {};
  }
};

/**
 * Helper function to sanitize metadata for public exposure
 * @param {object} metadata - Raw metadata object
 * @returns {object} Sanitized metadata
 */
const sanitizeMetadata = (metadata) => {
  if (!metadata) return {};

  // Remove sensitive information
  const sanitized = { ...metadata };
  
  // Remove any potential sensitive fields
  delete sanitized.internalId;
  delete sanitized.secretKey;
  delete sanitized.privateData;
  
  // Sanitize bank details if present
  if (sanitized.bankDetails) {
    delete sanitized.bankDetails.accountNumber;
    delete sanitized.bankDetails.routingNumber;
  }

  return sanitized;
};

module.exports = {
  generateQRCode,
  validateQRCode,
  getQRCodeMetadata,
  downloadQRCode,
  getQRCodeHealth
};