// v1/services/cloudinaryService.js
const cloudinary = require('cloudinary').v2;
const logger = require('../utils/logger');
const { ApiError } = require('../utils/apiError');
const { StatusCodes } = require('http-status-codes');

/**
 * Upload file to Cloudinary
 * @param {string} filePath - Path to the file to upload
 * @param {string} folder - Folder to upload to
 * @param {object} options - Upload options
 * @returns {object} Upload result
 * @throws {ApiError} If the upload fails
 */
const uploadFile = async (filePath, folder, options = {}) => {
  try {
    logger.info('Using Cloudinary service for file upload', {
      filePath,
      folder,
      options
    });

    const result = await cloudinary.uploader.upload(filePath, {
      folder: folder,
      public_id: options.public_id,
      overwrite: options.overwrite !== false,
      resource_type: options.resource_type || 'auto',
      ...options
    });

    logger.info('File uploaded successfully to Cloudinary', {
      public_id: result.public_id,
      secure_url: result.secure_url
    });

    return result;
  } catch (error) {
    logger.error(`File upload failed for ${filePath}:`, {
      error: error.message,
      folder
    });
    
    throw new ApiError(`File upload failed: ${error.message}`, StatusCodes.INTERNAL_SERVER_ERROR, [], 'UPLOAD_FAILED');
  }
};

/**
 * Delete file from Cloudinary
 * @param {string} publicId - Public ID of the file to delete
 * @param {object} options - Delete options
 * @returns {object} Delete result
 */
const deleteFile = async (publicId, options = {}) => {
  try {
    logger.info('Deleting file from Cloudinary', {
      publicId,
      options
    });

    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: options.resource_type || 'image',
      ...options
    });

    logger.info('File deleted successfully from Cloudinary', {
      publicId,
      result: result.result
    });

    return result;
  } catch (error) {
    logger.error(`File deletion failed for ${publicId}:`, error.message);
    throw new ApiError(`File deletion failed: ${error.message}`, StatusCodes.INTERNAL_SERVER_ERROR, [], 'DELETE_FAILED');
  }
};

/**
 * Generate image URL with transformations
 * @param {string} publicId - Public ID of the image
 * @param {object} transformations - Image transformations
 * @returns {string} Generated URL
 */
const getImageUrl = (publicId, transformations = {}) => {
  try {
    return cloudinary.url(publicId, {
      secure: true,
      ...transformations
    });
  } catch (error) {
    logger.error(`Failed to generate image URL for ${publicId}:`, error.message);
    return cloudinary.url(publicId, { secure: true });
  }
};

/**
 * Get service information
 * @returns {object} Service info
 */
const getServiceInfo = () => {
  return {
    activeService: 'Cloudinary',
    hasCloudinaryConfig: !!(cloudinary.config().cloud_name),
    cloudflareRemoved: true
  };
};

/**
 * Health check for Cloudinary service
 * @returns {object} Health status
 */
const healthCheck = async () => {
  try {
    // Test Cloudinary by getting account info
    const result = await cloudinary.api.ping();
    
    return {
      status: 'healthy',
      service: 'CloudinaryService',
      result: result.status,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Cloudinary health check failed:', error.message);
    return {
      status: 'unhealthy',
      service: 'CloudinaryService',
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
  healthCheck
};