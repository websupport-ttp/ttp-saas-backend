const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const { ApiError } = require('../utils/apiError');
const logger = require('../utils/logger');

/**
 * S3 Service for file storage operations
 * AWS S3 storage service for file operations
 */
class S3Service {
  constructor() {
    this.contextLogger = logger.createContextualLogger('S3Service');

    // AWS S3 Configuration
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.bucketName = process.env.AWS_S3_BUCKET_NAME;
    this.accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    this.secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    // Validate required environment variables
    this.validateConfig();

    // Initialize S3 client
    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      },
    });

    // Default configuration
    this.defaultACL = process.env.AWS_S3_DEFAULT_ACL || 'private';
    this.signedUrlExpiration = parseInt(process.env.AWS_S3_SIGNED_URL_EXPIRATION) || 3600; // 1 hour
    this.maxFileSize = parseInt(process.env.AWS_S3_MAX_FILE_SIZE) || 10 * 1024 * 1024; // 10MB

    // Retry configuration
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000, // 1 second
      maxDelay: 10000  // 10 seconds
    };
  }

  /**
   * Validate required configuration
   * @throws {Error} If required environment variables are missing
   */
  validateConfig() {
    const required = ['AWS_S3_BUCKET_NAME', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'];
    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(`Missing required AWS S3 environment variables: ${missing.join(', ')}`);
    }
  }

  /**
   * Upload file to S3
   * @param {Buffer|string} file - File data to upload (Buffer or file path)
   * @param {Object} options - Upload options
   * @param {string} options.filename - Original filename
   * @param {string} options.folder - Folder path in S3
   * @param {Object} options.metadata - Additional metadata
   * @param {string} options.contentType - Content type of the file
   * @param {boolean} options.public - Whether file should be publicly accessible
   * @returns {Promise<Object>} Upload result with S3 key and URLs
   */
  async uploadFile(file, options = {}) {
    const { filename, folder = '', metadata = {}, contentType, public: isPublic = false } = options;

    const uploadStartTime = performance.now();
    let actualFilename = filename;
    let actualContentType = contentType;

    try {
      let fileBuffer;

      // Handle different file input types
      if (Buffer.isBuffer(file)) {
        fileBuffer = file;
      } else if (typeof file === 'string') {
        // Assume it's a file path
        fileBuffer = fs.readFileSync(file);
        if (!actualFilename) {
          actualFilename = path.basename(file);
        }
        if (!actualContentType) {
          actualContentType = this.getContentType(file);
        }
      } else {
        throw new Error('File must be a Buffer or file path string');
      }

      // Validate file size
      if (fileBuffer.length > this.maxFileSize) {
        throw new Error(`File size ${fileBuffer.length} exceeds maximum allowed size ${this.maxFileSize}`);
      }

      // Generate S3 key
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const fileExtension = path.extname(actualFilename || '');
      const baseName = path.basename(actualFilename || 'file', fileExtension);
      const s3Key = folder
        ? `${folder}/${timestamp}-${randomString}-${baseName}${fileExtension}`
        : `${timestamp}-${randomString}-${baseName}${fileExtension}`;

      // Prepare upload parameters
      const uploadParams = {
        Bucket: this.bucketName,
        Key: s3Key,
        Body: fileBuffer,
        ContentType: actualContentType || 'application/octet-stream',
        Metadata: {
          originalName: actualFilename || 'unknown',
          uploadedAt: new Date().toISOString(),
          ...metadata
        },
        // Note: ACL parameter removed as bucket has ACLs disabled
        // Public access should be configured via bucket policy instead
      };

      // Upload to S3
      const command = new PutObjectCommand(uploadParams);
      const response = await this.s3Client.send(command);

      const uploadDuration = performance.now() - uploadStartTime;

      // Generate URLs
      // For public buckets, use direct public URL
      // For private buckets, use signed URL (max 7 days for AWS S3)
      const publicUrl = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${s3Key}`;
      const signedUrl = await this.getSignedUrl(s3Key, 'getObject', 604800); // 7 days (max allowed)

      const result = {
        id: s3Key,
        key: s3Key,
        filename: actualFilename,
        bucket: this.bucketName,
        region: this.region,
        size: fileBuffer.length,
        contentType: actualContentType,
        etag: response.ETag,
        uploaded: new Date().toISOString(),
        metadata: uploadParams.Metadata,
        // Use public URL as primary (works if bucket policy allows public read)
        // Falls back to signed URL if public access is not configured
        url: publicUrl,
        signedUrl: signedUrl,
        publicUrl: publicUrl,
        isPublic: isPublic
      };

      this.contextLogger.info('File uploaded to S3 successfully', {
        key: s3Key,
        size: fileBuffer.length,
        duration: uploadDuration,
        bucket: this.bucketName
      });

      return result;

    } catch (error) {
      this.contextLogger.error('S3 upload failed', {
        error: error.message,
        filename: actualFilename,
        folder
      });

      throw new ApiError(`S3 upload failed: ${error.message}`, 500);
    }
  }

  /**
   * Delete file from S3
   * @param {string} key - S3 key of the file to delete
   * @returns {Promise<boolean>} True if deletion was successful
   */
  async deleteFile(key) {
    if (!key) {
      throw new Error('S3 key is required for deletion');
    }

    try {
      const deleteParams = {
        Bucket: this.bucketName,
        Key: key,
      };

      const command = new DeleteObjectCommand(deleteParams);
      await this.s3Client.send(command);

      this.contextLogger.info('File deleted from S3 successfully', {
        key,
        bucket: this.bucketName
      });

      return true;

    } catch (error) {
      this.contextLogger.error('S3 deletion failed', {
        error: error.message,
        key
      });

      throw new ApiError(`S3 deletion failed: ${error.message}`, 500);
    }
  }

  /**
   * Get signed URL for S3 object
   * @param {string} key - S3 key
   * @param {string} operation - Operation type ('getObject', 'putObject')
   * @param {number} expiresIn - URL expiration time in seconds
   * @returns {Promise<string>} Signed URL
   */
  async getSignedUrl(key, operation = 'getObject', expiresIn = null) {
    try {
      const expiration = expiresIn || this.signedUrlExpiration;

      let command;
      switch (operation) {
        case 'getObject':
          command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: key,
          });
          break;
        case 'putObject':
          command = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
          });
          break;
        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }

      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: expiration,
      });

      return signedUrl;

    } catch (error) {
      this.contextLogger.error('Failed to generate signed URL', {
        error: error.message,
        key,
        operation
      });

      throw new ApiError(`Failed to generate signed URL: ${error.message}`, 500);
    }
  }

  /**
   * Get file metadata from S3
   * @param {string} key - S3 key
   * @returns {Promise<Object>} File metadata
   */
  async getFileMetadata(key) {
    if (!key) {
      throw new Error('S3 key is required to get metadata');
    }

    try {
      const headParams = {
        Bucket: this.bucketName,
        Key: key,
      };

      const command = new HeadObjectCommand(headParams);
      const response = await this.s3Client.send(command);

      return {
        key: key,
        size: response.ContentLength,
        contentType: response.ContentType,
        etag: response.ETag,
        lastModified: response.LastModified,
        metadata: response.Metadata || {},
        bucket: this.bucketName
      };

    } catch (error) {
      if (error.name === 'NotFound') {
        throw new ApiError('File not found in S3', 404);
      }

      this.contextLogger.error('Failed to get S3 file metadata', {
        error: error.message,
        key
      });

      throw new ApiError(`Failed to get file metadata: ${error.message}`, 500);
    }
  }

  /**
   * Check if file exists in S3
   * @param {string} key - S3 key
   * @returns {Promise<boolean>} True if file exists
   */
  async fileExists(key) {
    try {
      await this.getFileMetadata(key);
      return true;
    } catch (error) {
      if (error.statusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Generate public URL for S3 object (if bucket allows public access)
   * @param {string} key - S3 key
   * @returns {string} Public URL
   */
  getPublicUrl(key) {
    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
  }

  /**
   * Get content type based on file extension
   * @param {string} filename - File name or path
   * @returns {string} Content type
   */
  getContentType(filename) {
    const ext = path.extname(filename).toLowerCase();
    const contentTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.txt': 'text/plain',
      '.json': 'application/json',
      '.xml': 'application/xml',
    };

    return contentTypes[ext] || 'application/octet-stream';
  }

  /**
   * List files in S3 bucket with optional prefix
   * @param {Object} options - Listing options
   * @param {string} options.prefix - Key prefix to filter by
   * @param {number} options.maxKeys - Maximum number of keys to return
   * @returns {Promise<Object>} List of files
   */
  async listFiles(options = {}) {
    const { prefix = '', maxKeys = 1000 } = options;

    try {
      const { ListObjectsV2Command } = require('@aws-sdk/client-s3');

      const listParams = {
        Bucket: this.bucketName,
        Prefix: prefix,
        MaxKeys: maxKeys,
      };

      const command = new ListObjectsV2Command(listParams);
      const response = await this.s3Client.send(command);

      const files = (response.Contents || []).map(object => ({
        key: object.Key,
        size: object.Size,
        lastModified: object.LastModified,
        etag: object.ETag,
        url: this.getPublicUrl(object.Key)
      }));

      return {
        files,
        count: files.length,
        isTruncated: response.IsTruncated,
        nextContinuationToken: response.NextContinuationToken
      };

    } catch (error) {
      this.contextLogger.error('Failed to list S3 files', {
        error: error.message,
        prefix,
        maxKeys
      });

      throw new ApiError(`Failed to list files: ${error.message}`, 500);
    }
  }

  /**
   * Copy file within S3 bucket
   * @param {string} sourceKey - Source S3 key
   * @param {string} destinationKey - Destination S3 key
   * @returns {Promise<Object>} Copy result
   */
  async copyFile(sourceKey, destinationKey) {
    try {
      const { CopyObjectCommand } = require('@aws-sdk/client-s3');

      const copyParams = {
        Bucket: this.bucketName,
        CopySource: `${this.bucketName}/${sourceKey}`,
        Key: destinationKey,
      };

      const command = new CopyObjectCommand(copyParams);
      const response = await this.s3Client.send(command);

      this.contextLogger.info('File copied in S3 successfully', {
        sourceKey,
        destinationKey,
        bucket: this.bucketName
      });

      return {
        sourceKey,
        destinationKey,
        etag: response.CopyObjectResult.ETag,
        lastModified: response.CopyObjectResult.LastModified
      };

    } catch (error) {
      this.contextLogger.error('S3 file copy failed', {
        error: error.message,
        sourceKey,
        destinationKey
      });

      throw new ApiError(`S3 file copy failed: ${error.message}`, 500);
    }
  }
}

module.exports = S3Service;