// v1/services/cloudinaryService.js
const cloudinary = require('cloudinary').v2;
const logger = require('../utils/logger');
const { ApiError } = require('../utils/apiError');
const { StatusCodes } = require('http-status-codes');

// Ensure Cloudinary is configured (this happens in app.js or config/cloudinary.js)
// const configureCloudinary = require('../config/cloudinary');
// configureCloudinary(); // Call this if not already called globally

/**
 * @function uploadFile
 * @description Uploads a file to Cloudinary.
 * @param {string} filePath - The path to the file on the local filesystem.
 * @param {string} folder - The folder name in Cloudinary to upload to.
 * @param {object} [options={}] - Additional Cloudinary upload options.
 * @returns {object} Cloudinary upload result.
 * @throws {ApiError} If the upload fails.
 */
const uploadFile = async (filePath, folder, options = {}) => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: `the-travel-place/${folder}`, // Prefix with your main app folder
      resource_type: 'auto', // Automatically detect resource type (image, video, raw)
      quality: 'auto:low', // Optimize file size for faster delivery
      ...options,
    });
    logger.info(`File uploaded to Cloudinary: ${result.secure_url}`);
    return result;
  } catch (error) {
    logger.error(`Cloudinary upload failed for ${filePath}:`, error.message);
    throw new ApiError('Failed to upload file to Cloudinary', StatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * @function deleteFile
 * @description Deletes a file from Cloudinary by its public ID.
 * @param {string} publicId - The public ID of the file to delete.
 * @param {string} resourceType - The resource type ('image', 'video', 'raw').
 * @returns {object} Cloudinary deletion result.
 * @throws {ApiError} If the deletion fails.
 */
const deleteFile = async (publicId, resourceType = 'image') => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    logger.info(`File deleted from Cloudinary: ${publicId}`);
    return result;
  } catch (error) {
    logger.error(`Cloudinary deletion failed for ${publicId}:`, error.message);
    throw new ApiError('Failed to delete file from Cloudinary', StatusCodes.INTERNAL_SERVER_ERROR);
  }
};

module.exports = {
  uploadFile,
  deleteFile,
};