const CloudflareService = require('../services/cloudflareService');
const cloudflareMonitoring = require('./cloudflareMonitoring');
const logger = require('./logger');

/**
 * Migration utilities for transitioning from Cloudinary to Cloudflare
 * Handles batch file migration, validation, and rollback operations
 */
class MigrationUtils {
  constructor() {
    this.contextLogger = logger.createContextualLogger('MigrationUtils');
    this.cloudflareService = null; // Initialize lazily when needed
    this.migrationLog = [];
    this.failedMigrations = [];
    this.currentMigrationId = null;

    // Migration configuration
    this.config = {
      batchSize: 10, // Number of files to process in parallel
      retryAttempts: 3,
      delayBetweenBatches: 1000, // 1 second delay between batches
      validateAfterMigration: true
    };
  }

  /**
   * Get CloudflareService instance (lazy initialization)
   * @returns {CloudflareService}
   */
  getCloudflareService() {
    if (!this.cloudflareService) {
      try {
        this.cloudflareService = new CloudflareService();
      } catch (error) {
        throw new Error(`Failed to initialize Cloudflare service: ${error.message}`);
      }
    }
    return this.cloudflareService;
  }

  /**
   * Migrate a single file from Cloudinary to Cloudflare
   * @param {string} cloudinaryUrl - Original Cloudinary URL
   * @param {Object} options - Migration options
   * @param {string} options.filename - Original filename
   * @param {Object} options.metadata - File metadata
   * @returns {Promise<Object>} Migration result
   */
  async migrateFromCloudinary(cloudinaryUrl, options = {}) {
    const { filename, metadata = {} } = options;

    try {
      // Extract file info from Cloudinary URL
      const fileInfo = this.parseCloudinaryUrl(cloudinaryUrl);
      const actualFilename = filename || fileInfo.filename;

      // Download file from Cloudinary
      const fileBuffer = await this.downloadFile(cloudinaryUrl);

      // Upload to Cloudflare
      const uploadResult = await this.getCloudflareService().uploadFile(fileBuffer, {
        filename: actualFilename,
        metadata: {
          ...metadata,
          originalCloudinaryUrl: cloudinaryUrl,
          migratedAt: new Date().toISOString(),
          originalPublicId: fileInfo.publicId
        }
      });

      // Record migration progress if we have an active migration
      if (this.currentMigrationId) {
        cloudflareMonitoring.recordMigrationProgress(
          this.currentMigrationId,
          actualFilename,
          true,
          null,
          uploadResult
        );
      }

      // Log successful migration
      const migrationRecord = {
        originalUrl: cloudinaryUrl,
        newUrl: uploadResult.url,
        cloudflareId: uploadResult.id,
        filename: uploadResult.filename,
        migratedAt: new Date().toISOString(),
        status: 'success'
      };

      this.migrationLog.push(migrationRecord);

      return migrationRecord;

    } catch (error) {
      const failureRecord = {
        originalUrl: cloudinaryUrl,
        error: error.message,
        migratedAt: new Date().toISOString(),
        status: 'failed'
      };

      this.failedMigrations.push(failureRecord);
      throw new Error(`Migration failed for ${cloudinaryUrl}: ${error.message}`);
    }
  }

  /**
   * Batch migrate multiple files from Cloudinary to Cloudflare
   * @param {Array} fileList - Array of file objects with url and metadata
   * @param {Object} options - Batch migration options
   * @returns {Promise<Object>} Batch migration results
   */
  async batchMigrateFiles(fileList, options = {}) {
    const {
      batchSize = this.config.batchSize,
      onProgress,
      continueOnError = true
    } = options;

    // Start migration monitoring
    this.currentMigrationId = cloudflareMonitoring.startMigration(fileList.length);

    this.contextLogger.info('Starting batch migration', {
      migrationId: this.currentMigrationId,
      totalFiles: fileList.length,
      batchSize
    });

    const results = {
      total: fileList.length,
      successful: 0,
      failed: 0,
      migrations: [],
      errors: []
    };

    try {
      // Process files in batches
      for (let i = 0; i < fileList.length; i += batchSize) {
        const batch = fileList.slice(i, i + batchSize);

        this.contextLogger.debug('Processing batch', {
          migrationId: this.currentMigrationId,
          batchNumber: Math.floor(i / batchSize) + 1,
          batchSize: batch.length
        });

        // Process batch in parallel
        const batchPromises = batch.map(async (fileItem) => {
          try {
            const migration = await this.migrateFromCloudinary(fileItem.url, {
              filename: fileItem.filename,
              metadata: fileItem.metadata
            });

            results.successful++;
            results.migrations.push(migration);

            return migration;

          } catch (error) {
            results.failed++;
            results.errors.push({
              url: fileItem.url,
              error: error.message
            });

            // Record failed migration
            if (this.currentMigrationId) {
              cloudflareMonitoring.recordMigrationProgress(
                this.currentMigrationId,
                fileItem.filename || fileItem.url,
                false,
                error
              );
            }

            if (!continueOnError) {
              throw error;
            }

            return null;
          }
        });

        await Promise.allSettled(batchPromises);

        // Report progress
        if (onProgress) {
          onProgress({
            processed: Math.min(i + batchSize, fileList.length),
            total: fileList.length,
            successful: results.successful,
            failed: results.failed
          });
        }

        // Delay between batches to avoid rate limiting
        if (i + batchSize < fileList.length) {
          await this.delay(this.config.delayBetweenBatches);
        }
      }

      // Complete migration monitoring
      const migrationSummary = cloudflareMonitoring.completeMigration(this.currentMigrationId, true);

      this.contextLogger.info('Batch migration completed', {
        migrationId: this.currentMigrationId,
        ...migrationSummary,
        results
      });

      return results;

    } catch (error) {
      // Complete migration monitoring with failure
      cloudflareMonitoring.completeMigration(this.currentMigrationId, false);

      this.contextLogger.error('Batch migration failed', {
        migrationId: this.currentMigrationId,
        error: error.message,
        results
      });

      throw error;
    } finally {
      this.currentMigrationId = null;
    }
  }

  /**
   * Validate migration completeness and integrity
   * @param {Array} migrationRecords - Array of migration records to validate
   * @returns {Promise<Object>} Validation results
   */
  async validateMigration(migrationRecords = this.migrationLog) {
    const validationResults = {
      total: migrationRecords.length,
      valid: 0,
      invalid: 0,
      errors: []
    };

    for (const record of migrationRecords) {
      try {
        // Check if Cloudflare file exists and is accessible
        const metadata = await this.getCloudflareService().getFileMetadata(record.cloudflareId);

        if (metadata && metadata.id === record.cloudflareId) {
          // Verify URL accessibility
          const response = await fetch(record.newUrl, { method: 'HEAD' });

          if (response.ok) {
            validationResults.valid++;
          } else {
            validationResults.invalid++;
            validationResults.errors.push({
              record,
              error: `URL not accessible: ${response.status} ${response.statusText}`
            });
          }
        } else {
          validationResults.invalid++;
          validationResults.errors.push({
            record,
            error: 'File not found in Cloudflare'
          });
        }

      } catch (error) {
        validationResults.invalid++;
        validationResults.errors.push({
          record,
          error: error.message
        });
      }
    }

    return validationResults;
  }

  /**
   * Create rollback plan for failed or problematic migrations
   * @param {Array} migrationRecords - Migration records to analyze
   * @returns {Object} Rollback plan with cleanup actions
   */
  createRollbackPlan(migrationRecords = this.migrationLog) {
    const rollbackPlan = {
      filesToDelete: [],
      urlsToRevert: [],
      actions: []
    };

    migrationRecords.forEach(record => {
      if (record.status === 'success' && record.cloudflareId) {
        rollbackPlan.filesToDelete.push({
          cloudflareId: record.cloudflareId,
          originalUrl: record.originalUrl
        });

        rollbackPlan.urlsToRevert.push({
          from: record.newUrl,
          to: record.originalUrl
        });

        rollbackPlan.actions.push({
          type: 'delete_cloudflare_file',
          cloudflareId: record.cloudflareId,
          description: `Delete ${record.filename} from Cloudflare`
        });
      }
    });

    return rollbackPlan;
  }

  /**
   * Execute rollback plan to undo migrations
   * @param {Object} rollbackPlan - Rollback plan from createRollbackPlan
   * @param {Object} options - Rollback options
   * @returns {Promise<Object>} Rollback execution results
   */
  async executeRollback(rollbackPlan, options = {}) {
    const { dryRun = false, onProgress } = options;

    const results = {
      total: rollbackPlan.filesToDelete.length,
      successful: 0,
      failed: 0,
      errors: []
    };

    if (dryRun) {
      console.log('DRY RUN: Would execute the following rollback actions:');
      rollbackPlan.actions.forEach(action => {
        console.log(`- ${action.description}`);
      });
      return results;
    }

    // Delete files from Cloudflare
    for (const fileToDelete of rollbackPlan.filesToDelete) {
      try {
        await this.getCloudflareService().deleteFile(fileToDelete.cloudflareId);
        results.successful++;

        if (onProgress) {
          onProgress({
            processed: results.successful + results.failed,
            total: results.total,
            successful: results.successful,
            failed: results.failed
          });
        }

      } catch (error) {
        results.failed++;
        results.errors.push({
          cloudflareId: fileToDelete.cloudflareId,
          originalUrl: fileToDelete.originalUrl,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Parse Cloudinary URL to extract file information
   * @param {string} cloudinaryUrl - Cloudinary URL to parse
   * @returns {Object} Parsed file information
   */
  parseCloudinaryUrl(cloudinaryUrl) {
    try {
      const url = new URL(cloudinaryUrl);
      const pathParts = url.pathname.split('/');

      // Typical Cloudinary URL structure: /cloudname/image/upload/version/publicId.extension
      const publicIdWithExt = pathParts[pathParts.length - 1];
      const publicId = publicIdWithExt.split('.')[0];
      const extension = publicIdWithExt.split('.')[1] || '';

      return {
        publicId,
        extension,
        filename: publicIdWithExt,
        cloudName: pathParts[1] || '',
        resourceType: pathParts[2] || 'image',
        type: pathParts[3] || 'upload'
      };

    } catch (error) {
      throw new Error(`Invalid Cloudinary URL format: ${cloudinaryUrl}`);
    }
  }

  /**
   * Download file from URL
   * @param {string} url - File URL to download
   * @returns {Promise<Buffer>} File data as Buffer
   */
  async downloadFile(url) {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
      }

      return await response.buffer();

    } catch (error) {
      throw new Error(`Download failed for ${url}: ${error.message}`);
    }
  }

  /**
   * Get migration statistics
   * @returns {Object} Migration statistics
   */
  getMigrationStats() {
    return {
      totalAttempted: this.migrationLog.length + this.failedMigrations.length,
      successful: this.migrationLog.length,
      failed: this.failedMigrations.length,
      successRate: this.migrationLog.length > 0
        ? (this.migrationLog.length / (this.migrationLog.length + this.failedMigrations.length)) * 100
        : 0
    };
  }

  /**
   * Export migration log to JSON
   * @returns {string} JSON string of migration log
   */
  exportMigrationLog() {
    return JSON.stringify({
      successful: this.migrationLog,
      failed: this.failedMigrations,
      stats: this.getMigrationStats(),
      exportedAt: new Date().toISOString()
    }, null, 2);
  }

  /**
   * Clear migration logs
   */
  clearLogs() {
    this.migrationLog = [];
    this.failedMigrations = [];
  }

  /**
   * Delay execution for specified milliseconds
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Create singleton instance
const migrationUtils = new MigrationUtils();

// Add static helper methods for backward compatibility
migrationUtils.isCloudflareId = (id) => {
  // Cloudflare image IDs are typically UUIDs or similar format
  // They don't contain slashes like Cloudinary public_ids
  return id && typeof id === 'string' && !id.includes('/') && id.length > 20;
};

migrationUtils.isCloudflareUrl = (url) => {
  return url && typeof url === 'string' && url.includes('imagedelivery.net');
};

migrationUtils.getCloudinaryIdFromCloudflare = async (cloudflareId) => {
  try {
    // Try to get metadata from Cloudflare to find original Cloudinary public_id
    const metadata = await migrationUtils.cloudflareService.getFileMetadata(cloudflareId);
    return metadata?.meta?.originalPublicId || null;
  } catch (error) {
    return null;
  }
};

migrationUtils.batchMigrateFromCloudinary = async (cloudinaryUrls, options = {}) => {
  const fileList = cloudinaryUrls.map(url => ({ url }));
  return await migrationUtils.batchMigrateFiles(fileList, options);
};

module.exports = migrationUtils;