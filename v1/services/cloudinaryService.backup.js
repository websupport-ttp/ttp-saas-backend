// v1/services/cloudinaryService.js
const cloudinary = require('cloudinary').v2;
const logger = require('../utils/logger');
const { ApiError } = require('../utils/apiError');
const { StatusCodes } = require('http-status-codes');
// Cloudflare service removed - migrated to AWS S3
// const migrationUtils = require('../utils/migrationUtils'); // Commented out - migration complete

// Ensure Cloudinary is configured (this happens in app.js or config/cloudinary.js)
// const configureCloudinary = require('../config/cloudinary');
// configureCloudinary(); // Call this if not already called globally

/**
 * @function uploadFile
 * @description Uploads a file to Cloudinary or Cloudflare based on feature flag.
 * Maintains backward compatibility with existing API contracts.
 * @param {string} filePath - The path to the file on the local filesystem.
 * @param {string} folder - The folder name to upload to.
 * @param {object} [options={}] - Additional upload options.
 * @returns {object} Upload result with backward compatible format.
 * @throws {ApiError} If the upload fails.
 */
const uploadFile = async (filePath, folder, options = {}) => {
  try {
    if (USE_CLOUDFLARE_SERVICE && cloudflareService) {
      logger.info('Using Cloudflare service for file upload', {
        filePath,
        folder,
        useCloudflare: true
      });
      
      // Upload to Cloudflare with metadata including folder information
      const metadata = {
        folder: folder,
        originalFolder: `the-travel-place/${folder}`,
        uploadedAt: new Date().toISOString(),
        ...options.metadata
      };
      
      const cloudflareResult = await cloudflareService.uploadFile(filePath, {
        filename: options.public_id || undefined,
        metadata,
        requireSignedURLs: options.requireSignedURLs || false
      });
      
      // Transform Cloudflare response to match Cloudinary format for backward compatibility
      const compatibleResult = {
        public_id: cloudflareResult.id,
        version: 1,
        signature: cloudflareResult.id, // Use ID as signature for compatibility
        width: options.width || null,
        height: options.height || null,
        format: cloudflareResult.filename?.split('.').pop() || 'jpg',
        resource_type: 'image',
        created_at: cloudflareResult.uploaded,
        tags: options.tags || [],
        bytes: null, // Cloudflare doesn't provide file size in upload response
        type: 'upload',
        etag: cloudflareResult.id,
        placeholder: false,
        url: cloudflareResult.url,
        secure_url: cloudflareResult.url,
        folder: folder,
        original_filename: cloudflareResult.filename,
        api_key: 'cloudflare', // Identifier for service used
        // Cloudflare-specific fields (for migration tracking)
        cloudflare_id: cloudflareResult.id,
        cloudflare_variants: cloudflareResult.variants,
        cloudflare_meta: cloudflareResult.meta
      };
      
      logger.info(`File uploaded to Cloudflare: ${compatibleResult.secure_url}`, {
        cloudflareId: cloudflareResult.id,
        folder
      });
      
      return compatibleResult;
      
    } else {
      logger.info('Using Cloudinary service for file upload', {
        filePath,
        folder,
        useCloudflare: false
      });
      
      // Fallback to Cloudinary
      const result = await cloudinary.uploader.upload(filePath, {
        folder: `the-travel-place/${folder}`, // Prefix with your main app folder
        resource_type: 'auto', // Automatically detect resource type (image, video, raw)
        quality: 'auto:low', // Optimize file size for faster delivery
        ...options,
      });
      
      logger.info(`File uploaded to Cloudinary: ${result.secure_url}`);
      return result;
    }
  } catch (error) {
    logger.error(`File upload failed for ${filePath}:`, {
      error: error.message,
      useCloudflare: USE_CLOUDFLARE_SERVICE && !!cloudflareService,
      folder
    });
    
    // If Cloudflare fails and we have Cloudinary configured, try fallback
    if (USE_CLOUDFLARE_SERVICE && cloudflareService && cloudinary.config().cloud_name) {
      logger.warn('Cloudflare upload failed, attempting Cloudinary fallback');
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
          cloudflareError: error.message,
          cloudinaryError: fallbackError.message
        });
        throw new ApiError('Failed to upload file to both Cloudflare and Cloudinary', StatusCodes.INTERNAL_SERVER_ERROR);
      }
    }
    
    throw new ApiError('Failed to upload file', StatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * @function deleteFile
 * @description Deletes a file from Cloudinary or Cloudflare based on the file's origin.
 * Automatically detects whether the file is stored in Cloudflare or Cloudinary.
 * @param {string} publicId - The public ID of the file to delete.
 * @param {string} resourceType - The resource type ('image', 'video', 'raw').
 * @returns {object} Deletion result with backward compatible format.
 * @throws {ApiError} If the deletion fails.
 */
const deleteFile = async (publicId, resourceType = 'image') => {
  try {
    // Determine if this is a Cloudflare ID or Cloudinary public_id
    const isCloudflareId = migrationUtils.isCloudflareId(publicId);
    
    if (isCloudflareId && USE_CLOUDFLARE_SERVICE && cloudflareService) {
      logger.info('Deleting file from Cloudflare', {
        publicId,
        resourceType,
        useCloudflare: true
      });
      
      const success = await cloudflareService.deleteFile(publicId);
      
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
      
      logger.info(`File deleted from Cloudflare: ${publicId}`, { success });
      return compatibleResult;
      
    } else {
      logger.info('Deleting file from Cloudinary', {
        publicId,
        resourceType,
        useCloudflare: false
      });
      
      // Use Cloudinary for deletion
      const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
      logger.info(`File deleted from Cloudinary: ${publicId}`);
      return result;
    }
  } catch (error) {
    logger.error(`File deletion failed for ${publicId}:`, {
      error: error.message,
      resourceType,
      isCloudflareId: migrationUtils.isCloudflareId(publicId)
    });
    
    // If Cloudflare deletion fails, try Cloudinary as fallback (for migrated files)
    if (migrationUtils.isCloudflareId(publicId) && cloudinary.config().cloud_name) {
      logger.warn('Cloudflare deletion failed, checking Cloudinary for backup');
      try {
        // Try to find and delete from Cloudinary using migration mapping
        const cloudinaryPublicId = await migrationUtils.getCloudinaryIdFromCloudflare(publicId);
        if (cloudinaryPublicId) {
          const result = await cloudinary.uploader.destroy(cloudinaryPublicId, { resource_type: resourceType });
          logger.info(`File deleted from Cloudinary (fallback): ${cloudinaryPublicId}`);
          return result;
        }
      } catch (fallbackError) {
        logger.error('Cloudinary fallback deletion also failed', {
          cloudflareError: error.message,
          cloudinaryError: fallbackError.message
        });
      }
    }
    
    throw new ApiError('Failed to delete file', StatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * @function getImageUrl
 * @description Generate optimized image URL with transformations.
 * Supports both Cloudinary and Cloudflare URLs.
 * @param {string} publicId - The public ID or Cloudflare image ID.
 * @param {object} transformations - Image transformation options.
 * @returns {string} Optimized image URL.
 */
const getImageUrl = (publicId, transformations = {}) => {
  try {
    const isCloudflareId = migrationUtils.isCloudflareId(publicId);
    
    if (isCloudflareId && USE_CLOUDFLARE_SERVICE && cloudflareService) {
      // Generate Cloudflare image URL with transformations
      const cloudflareTransformations = {
        width: transformations.width || transformations.w,
        height: transformations.height || transformations.h,
        fit: transformations.crop === 'fill' ? 'cover' : 'scale-down',
        format: transformations.format || transformations.f,
        quality: transformations.quality || transformations.q
      };
      
      return cloudflareService.getImageUrl(publicId, cloudflareTransformations);
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
    return migrationUtils.isCloudflareId(publicId) && cloudflareService
      ? cloudflareService.getImageUrl(publicId)
      : cloudinary.url(publicId, { secure: true });
  }
};

/**
 * @function migrateFileUrl
 * @description Migrate a Cloudinary URL to Cloudflare if needed.
 * @param {string} cloudinaryUrl - Original Cloudinary URL.
 * @returns {Promise<string>} Migrated Cloudflare URL or original URL.
 */
const migrateFileUrl = async (cloudinaryUrl) => {
  try {
    if (!USE_CLOUDFLARE_SERVICE || !cloudflareService) {
      return cloudinaryUrl;
    }
    
    // Check if URL is already migrated
    if (migrationUtils.isCloudflareUrl(cloudinaryUrl)) {
      return cloudinaryUrl;
    }
    
    // Attempt migration
    const migratedUrl = await migrationUtils.migrateFromCloudinary(cloudinaryUrl);
    return migratedUrl || cloudinaryUrl;
    
  } catch (error) {
    logger.error(`Failed to migrate URL ${cloudinaryUrl}:`, error.message);
    return cloudinaryUrl; // Return original URL on failure
  }
};

/**
 * @function getServiceInfo
 * @description Get information about which service backend is being used.
 * @returns {object} Service configuration information.
 */
const getServiceInfo = () => {
  return {
    useCloudflareService: USE_CLOUDFLARE_SERVICE,
    hasCloudinaryConfig: !!(cloudinary.config().cloud_name),
    hasCloudflareConfig: !!cloudflareService,
    activeService: USE_CLOUDFLARE_SERVICE && cloudflareService ? 'Cloudflare' : 'Cloudinary'
  };
};

/**
 * @function healthCheck
 * @description Perform health check on the active file storage service.
 * @returns {Promise<object>} Health status.
 */
const healthCheck = async () => {
  try {
    if (USE_CLOUDFLARE_SERVICE && cloudflareService) {
      // Test Cloudflare service by listing files (limited request)
      await cloudflareService.listFiles({ per_page: 1 });
      return {
        status: 'healthy',
        service: 'CloudflareService',
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
      service: USE_CLOUDFLARE_SERVICE && cloudflareService ? 'CloudflareService' : 'CloudinaryService',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * @function batchMigrateFiles
 * @description Migrate multiple files from Cloudinary to Cloudflare.
 * @param {Array<string>} cloudinaryUrls - Array of Cloudinary URLs to migrate.
 * @param {object} options - Migration options.
 * @returns {Promise<object>} Migration results.
 */
const batchMigrateFiles = async (cloudinaryUrls, options = {}) => {
  if (!USE_CLOUDFLARE_SERVICE || !cloudflareService) {
    throw new ApiError('Cloudflare service not enabled for migration', StatusCodes.BAD_REQUEST);
  }
  
  try {
    const results = await migrationUtils.batchMigrateFromCloudinary(cloudinaryUrls, options);
    
    logger.info('Batch file migration completed', {
      totalFiles: cloudinaryUrls.length,
      successful: results.successful.length,
      failed: results.failed.length
    });
    
    return results;
  } catch (error) {
    logger.error('Batch file migration failed:', error.message);
    throw new ApiError('Batch migration failed', StatusCodes.INTERNAL_SERVER_ERROR);
  }
};

module.exports = {
  uploadFile,
  deleteFile,
  getImageUrl,
  migrateFileUrl,
  getServiceInfo,
  healthCheck,
  batchMigrateFiles,
};