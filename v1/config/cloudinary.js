// v1/config/cloudinary.js
const cloudinary = require('cloudinary').v2;
const logger = require('../utils/logger');

/**
 * @function configureCloudinary
 * @description Configures Cloudinary with API credentials from environment variables.
 * Logs a message upon successful configuration.
 */
const configureCloudinary = () => {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  logger.info('Cloudinary configured successfully.');
};

module.exports = configureCloudinary;