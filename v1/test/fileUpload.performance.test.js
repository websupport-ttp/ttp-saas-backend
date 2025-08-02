// v1/test/fileUpload.performance.test.js
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../../app');
const VisaApplication = require('../models/visaApplicationModel');
const User = require('../models/userModel');
const { setupTestEnvironment, teardownTestEnvironment } = require('./utils/testEnvironmentManager');

// Mock Cloudinary service
jest.mock('../services/cloudinaryService');
const { uploadFile } = require('../services/cloudinaryService');

describe('File Upload Performance Tests', () => {
  let mongoServer;
  let testUser;
  let visaApplication;
  let testFilesDir;

  beforeAll(async () => {
    mongoServer = await setupTestEnvironment();
    
    testFilesDir = path.join(__dirname, 'performance-test-files');
    if (!fs.existsSync(testFilesDir)) {
      fs.mkdirSync(testFilesDir, { recursive: true });
    }
  });

  afterAll(async () => {
    if (fs.existsSync(testFilesDir)) {
      fs.rmSync(testFilesDir, { recursive: true, force: true });
    }
    await teardownTestEnvironment(mongoServer);
  });

  beforeEach(async () => {
    testUser = await User.create({
      firstName: 'Performance',
      lastName: 'Tester',
      email: 'performance@example.com',
      password: 'password123',
      phoneNumber: '+2348123456789',
      role: 'User',
      isEmailVerified: true
    });

    visaApplication = await VisaApplication.create({
      userId: testUser._id,
      destinationCountry: 'United States',
      visaType: 'Tourist',
      travelPurpose: 'Tourism',
      urgency: 'Standard',
      personalInformation: {
        firstName: 'Performance',
        lastName: 'Tester',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'Male',
        nationality: 'Nigerian',
        maritalStatus: 'Single',
        occupation: 'Tester',
        address: '123 Performance Street'
      }
    });

    jest.clearAllMocks();
    
    // Mock successful upload with realistic delay
    uploadFile.mockImplementation(() => 
      new Promise(resolve => 
        setTimeout(() => resolve({
          secure_url: `https://res.cloudinary.com/test/image/upload/v${Date.now()}/test-document.jpg`,
          public_id: `test-document-${Date.now()}`,
          bytes: Math.floor(Math.random() * 2000000) + 500000 // 500KB - 2.5MB
        }), Math.floor(Math.random() * 500) + 100) // 100-600ms delay
      )
    );
  });

  afterEach(async () => {
    const files = fs.readdirSync(testFilesDir);
    files.forEach(file => {
      const filePath = path.join(testFilesDir, file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
  });

  describe('Upload Speed Tests', () => {
    it('should complete small file upload within 2 seconds', async () => {
      const smallPdfContent = '%PDF-1.4\nSmall test content\n%%EOF';
      const filePath = path.join(testFilesDir, 'small.pdf');
      fs.writeFileSync(filePath, smallPdfContent);

      const startTime = Date.now();
      
      const response = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'International Passport')
        .attach('document', filePath);

      const endTime = Date.now();
      const uploadTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(uploadTime).toBeLessThan(2000);
    });

    it('should complete medium file upload within 5 seconds', async () => {
      // Create a 2MB file
      const mediumFileSize = 2 * 1024 * 1024;
      const pdfHeader = '%PDF-1.4\n';
      const content = Buffer.alloc(mediumFileSize - pdfHeader.length, 'M');
      const pdfContent = Buffer.concat([Buffer.from(pdfHeader), content]);
      
      const filePath = path.join(testFilesDir, 'medium.pdf');
      fs.writeFileSync(filePath, pdfContent);

      const startTime = Date.now();
      
      const response = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'Bank Statement')
        .attach('document', filePath);

      const endTime = Date.now();
      const uploadTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(uploadTime).toBeLessThan(5000);
    });

    it('should complete large file upload within 10 seconds', async () => {
      // Create a 8MB file (near the limit)
      const largeFileSize = 8 * 1024 * 1024;
      const pdfHeader = '%PDF-1.4\n';
      const content = Buffer.alloc(largeFileSize - pdfHeader.length, 'L');
      const pdfContent = Buffer.concat([Buffer.from(pdfHeader), content]);
      
      const filePath = path.join(testFilesDir, 'large.pdf');
      fs.writeFileSync(filePath, pdfContent);

      const startTime = Date.now();
      
      const response = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'Flight Itinerary')
        .attach('document', filePath);

      const endTime = Date.now();
      const uploadTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(uploadTime).toBeLessThan(10000);
    });
  });

  describe('Concurrent Upload Tests', () => {
    it('should handle 5 concurrent uploads efficiently', async () => {
      const concurrentUploads = 5;
      const uploadPromises = [];
      const startTime = Date.now();

      for (let i = 0; i < concurrentUploads; i++) {
        const pdfContent = `%PDF-1.4\nConcurrent test content ${i}\n%%EOF`;
        const filePath = path.join(testFilesDir, `concurrent-${i}.pdf`);
        fs.writeFileSync(filePath, pdfContent);

        const uploadPromise = request(app)
          .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
          .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
          .field('documentType', 'Other')
          .attach('document', filePath);

        uploadPromises.push(uploadPromise);
      }

      const responses = await Promise.all(uploadPromises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Check that at least some uploads succeeded
      const successfulUploads = responses.filter(res => res.status === 200);
      expect(successfulUploads.length).toBeGreaterThan(0);

      // Total time should be reasonable for concurrent uploads
      expect(totalTime).toBeLessThan(15000); // 15 seconds for 5 concurrent uploads
    });

    it('should handle 10 concurrent uploads with proper throttling', async () => {
      const concurrentUploads = 10;
      const uploadPromises = [];

      for (let i = 0; i < concurrentUploads; i++) {
        const pdfContent = `%PDF-1.4\nThrottle test content ${i}\n%%EOF`;
        const filePath = path.join(testFilesDir, `throttle-${i}.pdf`);
        fs.writeFileSync(filePath, pdfContent);

        const uploadPromise = request(app)
          .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
          .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
          .field('documentType', 'Other')
          .attach('document', filePath);

        uploadPromises.push(uploadPromise);
      }

      const responses = await Promise.allSettled(uploadPromises);

      // Some requests should be throttled or rate limited
      const successfulUploads = responses.filter(result => 
        result.status === 'fulfilled' && result.value.status === 200
      );
      const rateLimitedUploads = responses.filter(result => 
        result.status === 'fulfilled' && result.value.status === 429
      );

      expect(successfulUploads.length + rateLimitedUploads.length).toBe(concurrentUploads);
      expect(rateLimitedUploads.length).toBeGreaterThan(0); // Some should be rate limited
    });

    it('should maintain performance under sustained load', async () => {
      const batchSize = 3;
      const numberOfBatches = 3;
      const batchResults = [];

      for (let batch = 0; batch < numberOfBatches; batch++) {
        const batchStartTime = Date.now();
        const batchPromises = [];

        for (let i = 0; i < batchSize; i++) {
          const pdfContent = `%PDF-1.4\nSustained load batch ${batch} item ${i}\n%%EOF`;
          const filePath = path.join(testFilesDir, `sustained-${batch}-${i}.pdf`);
          fs.writeFileSync(filePath, pdfContent);

          const uploadPromise = request(app)
            .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
            .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
            .field('documentType', 'Other')
            .attach('document', filePath);

          batchPromises.push(uploadPromise);
        }

        const batchResponses = await Promise.all(batchPromises);
        const batchEndTime = Date.now();
        const batchTime = batchEndTime - batchStartTime;

        batchResults.push({
          batch,
          time: batchTime,
          successCount: batchResponses.filter(res => res.status === 200).length
        });

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Performance should not degrade significantly across batches
      const averageTime = batchResults.reduce((sum, result) => sum + result.time, 0) / numberOfBatches;
      const maxTime = Math.max(...batchResults.map(result => result.time));
      const minTime = Math.min(...batchResults.map(result => result.time));

      expect(maxTime - minTime).toBeLessThan(averageTime * 0.5); // Variance should be reasonable
    });
  });

  describe('Memory Usage Tests', () => {
    it('should handle multiple large file uploads without memory leaks', async () => {
      const initialMemory = process.memoryUsage();
      const fileSize = 5 * 1024 * 1024; // 5MB each
      const numberOfFiles = 3;

      for (let i = 0; i < numberOfFiles; i++) {
        const pdfHeader = '%PDF-1.4\n';
        const content = Buffer.alloc(fileSize - pdfHeader.length, `${i}`);
        const pdfContent = Buffer.concat([Buffer.from(pdfHeader), content]);
        
        const filePath = path.join(testFilesDir, `memory-test-${i}.pdf`);
        fs.writeFileSync(filePath, pdfContent);

        const response = await request(app)
          .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
          .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
          .field('documentType', 'Other')
          .attach('document', filePath);

        expect(response.status).toBe(200);

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable (less than 50MB for 15MB of uploads)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should clean up temporary files efficiently', async () => {
      const uploadsDir = path.join(__dirname, '../../uploads');
      let initialFileCount = 0;
      
      if (fs.existsSync(uploadsDir)) {
        initialFileCount = fs.readdirSync(uploadsDir).length;
      }

      // Perform multiple uploads
      for (let i = 0; i < 5; i++) {
        const pdfContent = `%PDF-1.4\nCleanup test ${i}\n%%EOF`;
        const filePath = path.join(testFilesDir, `cleanup-${i}.pdf`);
        fs.writeFileSync(filePath, pdfContent);

        await request(app)
          .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
          .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
          .field('documentType', 'Other')
          .attach('document', filePath);
      }

      // Check that temporary files are cleaned up
      if (fs.existsSync(uploadsDir)) {
        const finalFileCount = fs.readdirSync(uploadsDir).length;
        expect(finalFileCount).toBeLessThanOrEqual(initialFileCount + 1); // Allow for some temporary files
      }
    });
  });

  describe('Error Recovery Performance', () => {
    it('should recover quickly from Cloudinary failures', async () => {
      // Mock Cloudinary failure for first few attempts
      let attemptCount = 0;
      uploadFile.mockImplementation(() => {
        attemptCount++;
        if (attemptCount <= 2) {
          return Promise.reject(new Error('Temporary service unavailable'));
        }
        return Promise.resolve({
          secure_url: 'https://res.cloudinary.com/test/image/upload/v123456789/recovered.jpg',
          public_id: 'recovered',
          bytes: 1024000
        });
      });

      const pdfContent = '%PDF-1.4\nRecovery test\n%%EOF';
      const filePath = path.join(testFilesDir, 'recovery.pdf');
      fs.writeFileSync(filePath, pdfContent);

      const startTime = Date.now();

      // First attempt should fail
      const response1 = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'International Passport')
        .attach('document', filePath);

      expect(response1.status).toBe(500);

      // Second attempt should also fail
      const response2 = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'International Passport')
        .attach('document', filePath);

      expect(response2.status).toBe(500);

      // Third attempt should succeed
      const response3 = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'International Passport')
        .attach('document', filePath);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      expect(response3.status).toBe(200);
      expect(totalTime).toBeLessThan(10000); // Should recover within 10 seconds
    });

    it('should handle timeout scenarios gracefully', async () => {
      // Mock slow Cloudinary response
      uploadFile.mockImplementation(() => 
        new Promise((resolve, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 3000)
        )
      );

      const pdfContent = '%PDF-1.4\nTimeout test\n%%EOF';
      const filePath = path.join(testFilesDir, 'timeout.pdf');
      fs.writeFileSync(filePath, pdfContent);

      const startTime = Date.now();

      const response = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'Bank Statement')
        .attach('document', filePath);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(500);
      expect(response.body.message).toContain('timeout');
      expect(responseTime).toBeGreaterThan(2500); // Should wait for timeout
      expect(responseTime).toBeLessThan(5000); // But not hang indefinitely
    });
  });

  describe('Throughput Tests', () => {
    it('should maintain reasonable throughput under normal load', async () => {
      const numberOfUploads = 10;
      const startTime = Date.now();
      const results = [];

      for (let i = 0; i < numberOfUploads; i++) {
        const uploadStartTime = Date.now();
        const pdfContent = `%PDF-1.4\nThroughput test ${i}\n%%EOF`;
        const filePath = path.join(testFilesDir, `throughput-${i}.pdf`);
        fs.writeFileSync(filePath, pdfContent);

        const response = await request(app)
          .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
          .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
          .field('documentType', 'Other')
          .attach('document', filePath);

        const uploadEndTime = Date.now();
        results.push({
          index: i,
          time: uploadEndTime - uploadStartTime,
          status: response.status
        });

        // Small delay to simulate realistic usage
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const successfulUploads = results.filter(r => r.status === 200);
      const averageUploadTime = results.reduce((sum, r) => sum + r.time, 0) / results.length;

      expect(successfulUploads.length).toBeGreaterThan(numberOfUploads * 0.8); // At least 80% success
      expect(averageUploadTime).toBeLessThan(2000); // Average under 2 seconds
      expect(totalTime / numberOfUploads).toBeLessThan(1000); // Good throughput
    });

    it('should scale performance with file size appropriately', async () => {
      const fileSizes = [
        { size: 100 * 1024, name: 'small' },      // 100KB
        { size: 1024 * 1024, name: 'medium' },    // 1MB
        { size: 5 * 1024 * 1024, name: 'large' }  // 5MB
      ];

      const results = [];

      for (const fileConfig of fileSizes) {
        const pdfHeader = '%PDF-1.4\n';
        const content = Buffer.alloc(fileConfig.size - pdfHeader.length, 'X');
        const pdfContent = Buffer.concat([Buffer.from(pdfHeader), content]);
        
        const filePath = path.join(testFilesDir, `${fileConfig.name}.pdf`);
        fs.writeFileSync(filePath, pdfContent);

        const startTime = Date.now();

        const response = await request(app)
          .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
          .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
          .field('documentType', 'Other')
          .attach('document', filePath);

        const endTime = Date.now();
        const uploadTime = endTime - startTime;

        results.push({
          size: fileConfig.size,
          name: fileConfig.name,
          time: uploadTime,
          status: response.status
        });
      }

      // Verify that upload time scales reasonably with file size
      const smallTime = results.find(r => r.name === 'small').time;
      const mediumTime = results.find(r => r.name === 'medium').time;
      const largeTime = results.find(r => r.name === 'large').time;

      expect(mediumTime).toBeGreaterThan(smallTime);
      expect(largeTime).toBeGreaterThan(mediumTime);
      
      // But not excessively so
      expect(mediumTime / smallTime).toBeLessThan(5);
      expect(largeTime / mediumTime).toBeLessThan(3);
    });
  });
});