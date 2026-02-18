// v1/test/utils/migrationUtils.test.js
const migrationUtils = require('../../utils/migrationUtils');
const CloudflareService = require('../../services/cloudflareService');

// Mock dependencies
jest.mock('../../services/cloudflareService');
// Note: Using built-in fetch API (Node.js 18+), no need to mock node-fetch

describe('MigrationUtils', () => {
  let mockCloudflareService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock CloudflareService
    mockCloudflareService = {
      uploadFile: jest.fn(),
      deleteFile: jest.fn(),
      getFileMetadata: jest.fn()
    };
    CloudflareService.mockImplementation(() => mockCloudflareService);

    // Reset migration logs
    migrationUtils.clearLogs();

    // Mock fetch for file downloads
    fetch.mockResolvedValue({
      ok: true,
      buffer: jest.fn().mockResolvedValue(Buffer.from('test file content'))
    });
  });

  describe('Single File Migration', () => {
    test('should migrate file from Cloudinary to Cloudflare successfully', async () => {
      const cloudinaryUrl = 'https://res.cloudinary.com/demo/image/upload/v1234567890/sample.jpg';
      const options = {
        filename: 'sample.jpg',
        metadata: { description: 'Test image' }
      };

      mockCloudflareService.uploadFile.mockResolvedValue({
        id: 'cloudflare-id-123',
        filename: 'sample.jpg',
        url: 'https://imagedelivery.net/hash/cloudflare-id-123/public'
      });

      const result = await migrationUtils.migrateFromCloudinary(cloudinaryUrl, options);

      expect(fetch).toHaveBeenCalledWith(cloudinaryUrl);
      expect(mockCloudflareService.uploadFile).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({
          filename: 'sample.jpg',
          metadata: expect.objectContaining({
            description: 'Test image',
            originalCloudinaryUrl: cloudinaryUrl,
            migratedAt: expect.any(String),
            originalPublicId: 'sample'
          })
        })
      );

      expect(result).toEqual({
        originalUrl: cloudinaryUrl,
        newUrl: 'https://imagedelivery.net/hash/cloudflare-id-123/public',
        cloudflareId: 'cloudflare-id-123',
        filename: 'sample.jpg',
        migratedAt: expect.any(String),
        status: 'success'
      });

      expect(migrationUtils.migrationLog).toHaveLength(1);
    });

    test('should handle migration failure and log error', async () => {
      const cloudinaryUrl = 'https://res.cloudinary.com/demo/image/upload/sample.jpg';
      const uploadError = new Error('Upload failed');

      mockCloudflareService.uploadFile.mockRejectedValue(uploadError);

      await expect(migrationUtils.migrateFromCloudinary(cloudinaryUrl)).rejects.toThrow('Migration failed');
      expect(migrationUtils.failedMigrations).toHaveLength(1);
      expect(migrationUtils.failedMigrations[0]).toEqual({
        originalUrl: cloudinaryUrl,
        error: 'Upload failed',
        migratedAt: expect.any(String),
        status: 'failed'
      });
    });

    test('should handle download failure', async () => {
      const cloudinaryUrl = 'https://res.cloudinary.com/demo/image/upload/sample.jpg';
      
      fetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(migrationUtils.migrateFromCloudinary(cloudinaryUrl)).rejects.toThrow('Download failed');
    });

    test('should parse Cloudinary URL correctly', () => {
      const cloudinaryUrl = 'https://res.cloudinary.com/demo/image/upload/v1234567890/folder/sample.jpg';
      
      const fileInfo = migrationUtils.parseCloudinaryUrl(cloudinaryUrl);

      expect(fileInfo).toEqual({
        publicId: 'sample',
        extension: 'jpg',
        filename: 'sample.jpg',
        cloudName: 'demo',
        resourceType: 'image',
        type: 'upload'
      });
    });

    test('should handle invalid Cloudinary URL', () => {
      const invalidUrl = 'not-a-valid-url';

      expect(() => migrationUtils.parseCloudinaryUrl(invalidUrl)).toThrow('Invalid Cloudinary URL format');
    });
  });

  describe('Batch Migration', () => {
    test('should migrate multiple files successfully', async () => {
      const fileList = [
        { url: 'https://res.cloudinary.com/demo/image/upload/image1.jpg', filename: 'image1.jpg' },
        { url: 'https://res.cloudinary.com/demo/image/upload/image2.jpg', filename: 'image2.jpg' }
      ];

      mockCloudflareService.uploadFile
        .mockResolvedValueOnce({
          id: 'cf-id-1',
          filename: 'image1.jpg',
          url: 'https://imagedelivery.net/hash/cf-id-1/public'
        })
        .mockResolvedValueOnce({
          id: 'cf-id-2',
          filename: 'image2.jpg',
          url: 'https://imagedelivery.net/hash/cf-id-2/public'
        });

      const result = await migrationUtils.batchMigrateFiles(fileList);

      expect(result).toEqual({
        total: 2,
        successful: 2,
        failed: 0,
        migrations: expect.arrayContaining([
          expect.objectContaining({ cloudflareId: 'cf-id-1' }),
          expect.objectContaining({ cloudflareId: 'cf-id-2' })
        ]),
        errors: []
      });
    });

    test('should handle partial failures in batch migration', async () => {
      const fileList = [
        { url: 'https://res.cloudinary.com/demo/image/upload/image1.jpg' },
        { url: 'https://res.cloudinary.com/demo/image/upload/image2.jpg' }
      ];

      mockCloudflareService.uploadFile
        .mockResolvedValueOnce({
          id: 'cf-id-1',
          filename: 'image1.jpg',
          url: 'https://imagedelivery.net/hash/cf-id-1/public'
        })
        .mockRejectedValueOnce(new Error('Upload failed'));

      const result = await migrationUtils.batchMigrateFiles(fileList, { continueOnError: true });

      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        url: 'https://res.cloudinary.com/demo/image/upload/image2.jpg',
        error: expect.stringContaining('Upload failed')
      });
    });

    test('should stop on first error when continueOnError is false', async () => {
      const fileList = [
        { url: 'https://res.cloudinary.com/demo/image/upload/image1.jpg' },
        { url: 'https://res.cloudinary.com/demo/image/upload/image2.jpg' }
      ];

      mockCloudflareService.uploadFile.mockRejectedValue(new Error('Upload failed'));

      await expect(migrationUtils.batchMigrateFiles(fileList, { continueOnError: false }))
        .rejects.toThrow('Upload failed');
    });

    test('should call progress callback during batch migration', async () => {
      const fileList = [
        { url: 'https://res.cloudinary.com/demo/image/upload/image1.jpg' },
        { url: 'https://res.cloudinary.com/demo/image/upload/image2.jpg' }
      ];

      mockCloudflareService.uploadFile.mockResolvedValue({
        id: 'cf-id',
        filename: 'image.jpg',
        url: 'https://imagedelivery.net/hash/cf-id/public'
      });

      const onProgress = jest.fn();

      await migrationUtils.batchMigrateFiles(fileList, { 
        batchSize: 1,
        onProgress 
      });

      expect(onProgress).toHaveBeenCalledWith({
        processed: 1,
        total: 2,
        successful: 1,
        failed: 0
      });

      expect(onProgress).toHaveBeenCalledWith({
        processed: 2,
        total: 2,
        successful: 2,
        failed: 0
      });
    });

    test('should process files in batches with delay', async () => {
      const fileList = Array.from({ length: 5 }, (_, i) => ({
        url: `https://res.cloudinary.com/demo/image/upload/image${i}.jpg`
      }));

      mockCloudflareService.uploadFile.mockResolvedValue({
        id: 'cf-id',
        filename: 'image.jpg',
        url: 'https://imagedelivery.net/hash/cf-id/public'
      });

      const startTime = Date.now();
      await migrationUtils.batchMigrateFiles(fileList, { batchSize: 2 });
      const endTime = Date.now();

      // Should have delays between batches (3 batches = 2 delays)
      expect(endTime - startTime).toBeGreaterThan(1000); // At least 1 second delay
    });
  });

  describe('Migration Validation', () => {
    test('should validate successful migrations', async () => {
      const migrationRecords = [
        {
          originalUrl: 'https://res.cloudinary.com/demo/image/upload/image1.jpg',
          newUrl: 'https://imagedelivery.net/hash/cf-id-1/public',
          cloudflareId: 'cf-id-1',
          status: 'success'
        }
      ];

      mockCloudflareService.getFileMetadata.mockResolvedValue({
        id: 'cf-id-1',
        filename: 'image1.jpg'
      });

      fetch.mockResolvedValue({
        ok: true,
        status: 200
      });

      const result = await migrationUtils.validateMigration(migrationRecords);

      expect(result).toEqual({
        total: 1,
        valid: 1,
        invalid: 0,
        errors: []
      });

      expect(mockCloudflareService.getFileMetadata).toHaveBeenCalledWith('cf-id-1');
      expect(fetch).toHaveBeenCalledWith(migrationRecords[0].newUrl, { method: 'HEAD' });
    });

    test('should detect invalid migrations', async () => {
      const migrationRecords = [
        {
          originalUrl: 'https://res.cloudinary.com/demo/image/upload/image1.jpg',
          newUrl: 'https://imagedelivery.net/hash/cf-id-1/public',
          cloudflareId: 'cf-id-1',
          status: 'success'
        }
      ];

      mockCloudflareService.getFileMetadata.mockRejectedValue(new Error('File not found'));

      const result = await migrationUtils.validateMigration(migrationRecords);

      expect(result).toEqual({
        total: 1,
        valid: 0,
        invalid: 1,
        errors: [{
          record: migrationRecords[0],
          error: 'File not found'
        }]
      });
    });

    test('should detect inaccessible URLs', async () => {
      const migrationRecords = [
        {
          originalUrl: 'https://res.cloudinary.com/demo/image/upload/image1.jpg',
          newUrl: 'https://imagedelivery.net/hash/cf-id-1/public',
          cloudflareId: 'cf-id-1',
          status: 'success'
        }
      ];

      mockCloudflareService.getFileMetadata.mockResolvedValue({
        id: 'cf-id-1',
        filename: 'image1.jpg'
      });

      fetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      const result = await migrationUtils.validateMigration(migrationRecords);

      expect(result.invalid).toBe(1);
      expect(result.errors[0].error).toContain('URL not accessible: 404 Not Found');
    });
  });

  describe('Rollback Operations', () => {
    test('should create rollback plan', () => {
      const migrationRecords = [
        {
          originalUrl: 'https://res.cloudinary.com/demo/image/upload/image1.jpg',
          newUrl: 'https://imagedelivery.net/hash/cf-id-1/public',
          cloudflareId: 'cf-id-1',
          filename: 'image1.jpg',
          status: 'success'
        },
        {
          originalUrl: 'https://res.cloudinary.com/demo/image/upload/image2.jpg',
          error: 'Upload failed',
          status: 'failed'
        }
      ];

      const rollbackPlan = migrationUtils.createRollbackPlan(migrationRecords);

      expect(rollbackPlan).toEqual({
        filesToDelete: [{
          cloudflareId: 'cf-id-1',
          originalUrl: 'https://res.cloudinary.com/demo/image/upload/image1.jpg'
        }],
        urlsToRevert: [{
          from: 'https://imagedelivery.net/hash/cf-id-1/public',
          to: 'https://res.cloudinary.com/demo/image/upload/image1.jpg'
        }],
        actions: [{
          type: 'delete_cloudflare_file',
          cloudflareId: 'cf-id-1',
          description: 'Delete image1.jpg from Cloudflare'
        }]
      });
    });

    test('should execute rollback plan', async () => {
      const rollbackPlan = {
        filesToDelete: [
          { cloudflareId: 'cf-id-1', originalUrl: 'https://cloudinary.com/image1.jpg' },
          { cloudflareId: 'cf-id-2', originalUrl: 'https://cloudinary.com/image2.jpg' }
        ],
        urlsToRevert: [],
        actions: []
      };

      mockCloudflareService.deleteFile
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      const result = await migrationUtils.executeRollback(rollbackPlan);

      expect(result).toEqual({
        total: 2,
        successful: 2,
        failed: 0,
        errors: []
      });

      expect(mockCloudflareService.deleteFile).toHaveBeenCalledWith('cf-id-1');
      expect(mockCloudflareService.deleteFile).toHaveBeenCalledWith('cf-id-2');
    });

    test('should handle rollback failures', async () => {
      const rollbackPlan = {
        filesToDelete: [
          { cloudflareId: 'cf-id-1', originalUrl: 'https://cloudinary.com/image1.jpg' }
        ],
        urlsToRevert: [],
        actions: []
      };

      mockCloudflareService.deleteFile.mockRejectedValue(new Error('Delete failed'));

      const result = await migrationUtils.executeRollback(rollbackPlan);

      expect(result).toEqual({
        total: 1,
        successful: 0,
        failed: 1,
        errors: [{
          cloudflareId: 'cf-id-1',
          originalUrl: 'https://cloudinary.com/image1.jpg',
          error: 'Delete failed'
        }]
      });
    });

    test('should perform dry run without executing actions', async () => {
      const rollbackPlan = {
        filesToDelete: [{ cloudflareId: 'cf-id-1', originalUrl: 'https://cloudinary.com/image1.jpg' }],
        urlsToRevert: [],
        actions: [{ description: 'Delete image1.jpg from Cloudflare' }]
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await migrationUtils.executeRollback(rollbackPlan, { dryRun: true });

      expect(result.total).toBe(1);
      expect(mockCloudflareService.deleteFile).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('DRY RUN: Would execute the following rollback actions:');

      consoleSpy.mockRestore();
    });

    test('should call progress callback during rollback', async () => {
      const rollbackPlan = {
        filesToDelete: [
          { cloudflareId: 'cf-id-1', originalUrl: 'https://cloudinary.com/image1.jpg' },
          { cloudflareId: 'cf-id-2', originalUrl: 'https://cloudinary.com/image2.jpg' }
        ],
        urlsToRevert: [],
        actions: []
      };

      mockCloudflareService.deleteFile.mockResolvedValue(true);
      const onProgress = jest.fn();

      await migrationUtils.executeRollback(rollbackPlan, { onProgress });

      expect(onProgress).toHaveBeenCalledWith({
        processed: 1,
        total: 2,
        successful: 1,
        failed: 0
      });

      expect(onProgress).toHaveBeenCalledWith({
        processed: 2,
        total: 2,
        successful: 2,
        failed: 0
      });
    });
  });

  describe('File Download', () => {
    test('should download file successfully', async () => {
      const url = 'https://example.com/image.jpg';
      const expectedBuffer = Buffer.from('image data');

      fetch.mockResolvedValue({
        ok: true,
        buffer: jest.fn().mockResolvedValue(expectedBuffer)
      });

      const result = await migrationUtils.downloadFile(url);

      expect(fetch).toHaveBeenCalledWith(url);
      expect(result).toEqual(expectedBuffer);
    });

    test('should handle download failure', async () => {
      const url = 'https://example.com/image.jpg';

      fetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(migrationUtils.downloadFile(url)).rejects.toThrow('Failed to download file: 404 Not Found');
    });

    test('should handle network errors during download', async () => {
      const url = 'https://example.com/image.jpg';

      fetch.mockRejectedValue(new Error('Network error'));

      await expect(migrationUtils.downloadFile(url)).rejects.toThrow('Download failed for https://example.com/image.jpg: Network error');
    });
  });

  describe('Statistics and Logging', () => {
    test('should calculate migration statistics', () => {
      // Add some test data
      migrationUtils.migrationLog.push(
        { status: 'success' },
        { status: 'success' }
      );
      migrationUtils.failedMigrations.push(
        { status: 'failed' }
      );

      const stats = migrationUtils.getMigrationStats();

      expect(stats).toEqual({
        totalAttempted: 3,
        successful: 2,
        failed: 1,
        successRate: (2 / 3) * 100
      });
    });

    test('should handle empty migration logs in statistics', () => {
      const stats = migrationUtils.getMigrationStats();

      expect(stats).toEqual({
        totalAttempted: 0,
        successful: 0,
        failed: 0,
        successRate: 0
      });
    });

    test('should export migration log as JSON', () => {
      migrationUtils.migrationLog.push({ status: 'success', id: 'test' });
      migrationUtils.failedMigrations.push({ status: 'failed', error: 'test error' });

      const exported = migrationUtils.exportMigrationLog();
      const parsed = JSON.parse(exported);

      expect(parsed).toHaveProperty('successful');
      expect(parsed).toHaveProperty('failed');
      expect(parsed).toHaveProperty('stats');
      expect(parsed).toHaveProperty('exportedAt');
      expect(parsed.successful).toHaveLength(1);
      expect(parsed.failed).toHaveLength(1);
    });

    test('should clear migration logs', () => {
      migrationUtils.migrationLog.push({ status: 'success' });
      migrationUtils.failedMigrations.push({ status: 'failed' });

      migrationUtils.clearLogs();

      expect(migrationUtils.migrationLog).toHaveLength(0);
      expect(migrationUtils.failedMigrations).toHaveLength(0);
    });
  });

  describe('Static Helper Methods', () => {
    test('should identify Cloudflare IDs', () => {
      expect(migrationUtils.isCloudflareId('abcd1234-5678-90ef-ghij-klmnopqrstuv')).toBe(true);
      expect(migrationUtils.isCloudflareId('cloudinary/public/id')).toBe(false);
      expect(migrationUtils.isCloudflareId('short')).toBe(false);
      expect(migrationUtils.isCloudflareId(null)).toBe(false);
    });

    test('should identify Cloudflare URLs', () => {
      expect(migrationUtils.isCloudflareUrl('https://imagedelivery.net/hash/id/public')).toBe(true);
      expect(migrationUtils.isCloudflareUrl('https://res.cloudinary.com/demo/image/upload/sample.jpg')).toBe(false);
      expect(migrationUtils.isCloudflareUrl(null)).toBe(false);
    });

    test('should get Cloudinary ID from Cloudflare metadata', async () => {
      const cloudflareId = 'cf-id-123';
      
      mockCloudflareService.getFileMetadata.mockResolvedValue({
        meta: {
          originalPublicId: 'original-cloudinary-id'
        }
      });

      const result = await migrationUtils.getCloudinaryIdFromCloudflare(cloudflareId);

      expect(result).toBe('original-cloudinary-id');
      expect(mockCloudflareService.getFileMetadata).toHaveBeenCalledWith(cloudflareId);
    });

    test('should return null when metadata retrieval fails', async () => {
      const cloudflareId = 'cf-id-123';
      
      mockCloudflareService.getFileMetadata.mockRejectedValue(new Error('Not found'));

      const result = await migrationUtils.getCloudinaryIdFromCloudflare(cloudflareId);

      expect(result).toBe(null);
    });

    test('should batch migrate from Cloudinary URLs', async () => {
      const cloudinaryUrls = [
        'https://res.cloudinary.com/demo/image/upload/image1.jpg',
        'https://res.cloudinary.com/demo/image/upload/image2.jpg'
      ];

      mockCloudflareService.uploadFile.mockResolvedValue({
        id: 'cf-id',
        filename: 'image.jpg',
        url: 'https://imagedelivery.net/hash/cf-id/public'
      });

      const result = await migrationUtils.batchMigrateFromCloudinary(cloudinaryUrls);

      expect(result.total).toBe(2);
      expect(result.successful).toBe(2);
    });
  });

  describe('Utility Methods', () => {
    test('should delay execution', async () => {
      const startTime = Date.now();
      await migrationUtils.delay(100);
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(90); // Allow some variance
    });
  });
});