// v1/services/fileService.js
const cloudinary = require('cloudinary').v2;
const logger = require('../utils/logger');
const { ApiError } = require('../utils/apiError');
const { StatusCodes } = require('http-status-codes');
const S3Service = require('./s3Service');

// Initialize S3 service as primary file storage
let s3Service = null;

try {
  s3Service = new S3Service();
  logger.info('S3 service initialized successfully');
} catch (error) {
  logger.error('Failed to initialize S3 service', { error: error.message });
  logger.warn('Falling back to Cloudinary service');
}

/**
 * @function uploadFile
 * @description Uploads a file to the configured storage service (S3 or Cloudinary fallback).
 * Maintains backward compatibility with existing API contracts.
 * @param {string} filePath - The path to the file on the local filesystem.
 * @param {string} folder - The folder name to upload to.
 * @param {object} [options={}] - Additional upload options.
 * @returns {object} Upload result with backward compatible format.
 * @throws {ApiError} If the upload fails.
 */
const uploadFile = async (filePath, folder, options = {}) => {
  try {
    // Primary: S3, Fallback: Cloudinary
    if (s3Service) {
      logger.info('Using S3 service for file upload', {
        filePath,
        folder,
        useS3: true
      });
      
      // Upload to S3
      const s3Result = await s3Service.uploadFile(filePath, {
        folder: folder,
        filename: options.public_id || undefined,
        metadata: {
          originalFolder: `the-travel-place/${folder}`,
          uploadedAt: new Date().toISOString(),
          ...options.metadata
        },
        public: options.public || false,
        contentType: options.contentType
      });
      
      // Transform S3 response to match Cloudinary format for backward compatibility
      const compatibleResult = {
        public_id: s3Result.key,
        version: 1,
        signature: s3Result.etag?.replace(/"/g, '') || s3Result.key,
        width: options.width || null,
        height: options.height || null,
        format: s3Result.key?.split('.').pop() || 'jpg',
        resource_type: s3Result.contentType?.startsWith('image/') ? 'image' : 'raw',
        created_at: s3Result.uploaded,
        tags: options.tags || [],
        bytes: s3Result.size,
        type: 'upload',
        etag: s3Result.etag,
        placeholder: false,
        url: s3Result.url,
        secure_url: s3Result.url,
        folder: folder,
        original_filename: s3Result.filename,
        api_key: 's3', // Identifier for service used
        // S3-specific fields
        s3_key: s3Result.key,
        s3_bucket: s3Result.bucket,
        s3_region: s3Result.region,
        signed_url: s3Result.signedUrl,
        public_url: s3Result.publicUrl,
        is_public: s3Result.isPublic
      };
      
      logger.info(`File uploaded to S3: ${compatibleResult.secure_url}`, {
        s3Key: s3Result.key,
        folder
      });
      
      return compatibleResult;
      
    } else {
      logger.info('Using Cloudinary service for file upload (S3 not available)', {
        filePath,
        folder,
        useCloudinary: true
      });
      
      // Fallback to Cloudinary
      const result = await cloudinary.uploader.upload(filePath, {
        folder: `the-travel-place/${folder}`,
        resource_type: 'auto',
        quality: 'auto:low',
        ...options,
      });
      
      logger.info(`File uploaded to Cloudinary: ${result.secure_url}`);
      return result;
    }
  } catch (error) {
    logger.error(`File upload failed for ${filePath}:`, {
      error: error.message,
      useS3: !!s3Service,
      folder
    });
    
    // Try fallback to Cloudinary if S3 fails
    if (s3Service && error.message.includes('S3')) {
      logger.warn('S3 upload failed, attempting Cloudinary fallback');
      try {
        const result = await cloudinary.uploader.upload(filePath, {
          folder: `the-travel-place/${folder}`,
          resource_type: 'auto',
          quality: 'auto:low',
          ...options,
        });
        
        logger.info(`File uploaded to Cloudinary (fallback): ${result.secure_url}`);
        return result;
      } catch (fallbackError) {
        logger.error('Cloudinary fallback also failed', {
          s3Error: error.message,
          cloudinaryError: fallbackError.message
        });
        throw new ApiError('Failed to upload file to both S3 and Cloudinary', StatusCodes.INTERNAL_SERVER_ERROR);
      }
    }
    
    throw new ApiError('Failed to upload file', StatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * @function deleteFile
 * @description Deletes a file from the appropriate storage service.
 * Automatically detects the service based on the file identifier.
 * @param {string} publicId - The public ID/key of the file to delete.
 * @param {string} resourceType - The resource type ('image', 'video', 'raw').
 * @returns {object} Deletion result with backward compatible format.
 * @throws {ApiError} If the deletion fails.
 */
const deleteFile = async (publicId, resourceType = 'image') => {
  try {
    // Determine service based on publicId format
    const isS3Key = publicId.includes('/') && !publicId.startsWith('http');
    
    if (isS3Key && s3Service) {
      logger.info('Deleting file from S3', {
        publicId,
        resourceType,
        useS3: true
      });
      
      const success = await s3Service.deleteFile(publicId);
      
      // Return Cloudinary-compatible response format
      const compatibleResult = {
        result: success ? 'ok' : 'not found',
        public_id: publicId,
        resource_type: resourceType,
        type: 'upload',
        deleted: success ? [publicId] : [],
        partial: false,
        rate_limit_allowed: 500,
        rate_limit_reset_at: new Date(Date.now() + 3600000).toISOString(),
        rate_limit_remaining: 499
      };
      
      logger.info(`File deleted from S3: ${publicId}`, { success });
      return compatibleResult;
      
    } else {
      logger.info('Deleting file from Cloudinary', {
        publicId,
        resourceType,
        useCloudinary: true
      });
      
      const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
      logger.info(`File deleted from Cloudinary: ${publicId}`);
      return result;
    }
  } catch (error) {
    logger.error(`File deletion failed for ${publicId}:`, {
      error: error.message,
      resourceType
    });
    
    throw new ApiError('Failed to delete file', StatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * @function getImageUrl
 * @description Generate optimized image URL with transformations.
 * Supports S3 and Cloudinary URLs.
 * @param {string} publicId - The public ID or S3 key.
 * @param {object} transformations - Image transformation options.
 * @returns {string} Optimized image URL.
 */
const getImageUrl = (publicId, transformations = {}) => {
  try {
    const isS3Key = publicId.includes('/') && !publicId.startsWith('http');
    
    if (isS3Key && s3Service) {
      // For S3, we can't do real-time transformations like Cloudinary
      // Return signed URL or public URL
      if (transformations.signed !== false) {
        // Return signed URL (async operation, but we'll return the key for now)
        return s3Service.getPublicUrl(publicId);
      } else {
        return s3Service.getPublicUrl(publicId);
      }
    } else {
      // Generate Cloudinary URL with transformations
      return cloudinary.url(publicId, {
        secure: true,
        ...transformations
      });
    }
  } catch (error) {
    logger.error(`Failed to generate image URL for ${publicId}:`, error.message);
    // Return basic URL as fallback
    if (publicId.includes('/') && s3Service) {
      return s3Service.getPublicUrl(publicId);
    } else {
      return cloudinary.url(publicId, { secure: true });
    }
  }
};

/**
 * @function getServiceInfo
 * @description Get information about which service backend is being used.
 * @returns {object} Service configuration information.
 */
const getServiceInfo = () => {
  return {
    hasCloudinaryConfig: !!(cloudinary.config().cloud_name),
    hasS3Config: !!s3Service,
    activeService: s3Service ? 'S3' : 'Cloudinary'
  };
};

/**
 * @function healthCheck
 * @description Perform health check on the active file storage service.
 * @returns {Promise<object>} Health status.
 */
const healthCheck = async () => {
  try {
    if (s3Service) {
      // Test S3 service by listing files (limited request)
      await s3Service.listFiles({ maxKeys: 1 });
      return {
        status: 'healthy',
        service: 'S3Service',
        timestamp: new Date().toISOString()
      };
    } else {
      // Test Cloudinary service by getting account info
      const result = await cloudinary.api.ping();
      return {
        status: result.status === 'ok' ? 'healthy' : 'unhealthy',
        service: 'CloudinaryService',
        timestamp: new Date().toISOString()
      };
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      service: s3Service ? 'S3Service' : 'CloudinaryService',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

module.exports = {
  uploadFile,
  deleteFile,
  getImageUrl,
  getServiceInfo,
  healthCheck,
  // Export service instance for direct access if needed
  s3Service
};