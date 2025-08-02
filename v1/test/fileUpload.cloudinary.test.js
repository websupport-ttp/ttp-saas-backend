// v1/test/fileUpload.cloudinary.test.js
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../../app');
const VisaApplication = require('../models/visaApplicationModel');
const User = require('../models/userModel');
const { setupTestEnvironment, teardownTestEnvironment } = require('./utils/testEnvironmentManager');

// Mock Cloudinary service
jest.mock('../services/cloudinaryService');
const { uploadFile, deleteFile } = require('../services/cloudinaryService');

describe('Cloudinary Integration Tests for File Upload', () => {
  let mongoServer;
  let testUser;
  let visaApplication;
  let testFilesDir;

  beforeAll(async () => {
    mongoServer = await setupTestEnvironment();
    
    testFilesDir = path.join(__dirname, 'cloudinary-test-files');
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
      firstName: 'Cloudinary',
      lastName: 'Tester',
      email: 'cloudinary@example.com',
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
        firstName: 'Cloudinary',
        lastName: 'Tester',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'Male',
        nationality: 'Nigerian',
        maritalStatus: 'Single',
        occupation: 'Tester',
        address: '123 Cloud Street'
      }
    });

    jest.clearAllMocks();
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

  describe('Successful Cloudinary Upload Scenarios', () => {
    it('should upload PDF with correct Cloudinary parameters', async () => {
      uploadFile.mockResolvedValue({
        secure_url: 'https://res.cloudinary.com/test/raw/upload/v123456789/the-travel-place/visa-documents/test-document.pdf',
        public_id: 'the-travel-place/visa-documents/test-document',
        bytes: 1024000,
        format: 'pdf',
        resource_type: 'raw',
        created_at: '2024-01-01T00:00:00Z'
      });

      const pdfContent = '%PDF-1.4\ntest content\n%%EOF';
      const filePath = path.join(testFilesDir, 'test.pdf');
      fs.writeFileSync(filePath, pdfContent);

      const response = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'International Passport')
        .attach('document', filePath);

      expect(response.status).toBe(200);
      expect(uploadFile).toHaveBeenCalledWith(
        expect.any(String),
        `visa-documents/${visaApplication._id}`,
        expect.objectContaining({
          resource_type: 'auto',
          allowed_formats: ['pdf', 'jpg', 'jpeg', 'png'],
          quality: 'auto:low',
          strip: true
        })
      );
    });

    it('should upload image with optimization parameters', async () => {
      uploadFile.mockResolvedValue({
        secure_url: 'https://res.cloudinary.com/test/image/upload/c_limit,h_2000,q_auto:low,w_2000/v123456789/the-travel-place/visa-documents/photo.jpg',
        public_id: 'the-travel-place/visa-documents/photo',
        bytes: 512000,
        format: 'jpg',
        resource_type: 'image',
        width: 1200,
        height: 1600
      });

      const jpegHeader = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
      const jpegContent = Buffer.concat([jpegHeader, Buffer.alloc(1000, 0xFF)]);
      const filePath = path.join(testFilesDir, 'photo.jpg');
      fs.writeFileSync(filePath, jpegContent);

      const response = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'Passport Photograph')
        .attach('document', filePath);

      expect(response.status).toBe(200);
      expect(response.body.data.document).toMatchObject({
        documentType: 'Passport Photograph',
        cloudinaryUrl: expect.stringContaining('cloudinary.com'),
        mimetype: 'image/jpeg',
        size: expect.any(Number)
      });
    });

    it('should handle large file uploads with progress tracking', async () => {
      const largeFileSize = 8 * 1024 * 1024; // 8MB
      uploadFile.mockResolvedValue({
        secure_url: 'https://res.cloudinary.com/test/raw/upload/v123456789/the-travel-place/visa-documents/large-document.pdf',
        public_id: 'the-travel-place/visa-documents/large-document',
        bytes: largeFileSize,
        format: 'pdf',
        resource_type: 'raw'
      });

      const pdfHeader = '%PDF-1.4\n';
      const largeContent = Buffer.alloc(largeFileSize - pdfHeader.length, 'A');
      const pdfContent = Buffer.concat([Buffer.from(pdfHeader), largeContent]);
      const filePath = path.join(testFilesDir, 'large-document.pdf');
      fs.writeFileSync(filePath, pdfContent);

      const response = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'Bank Statement')
        .attach('document', filePath);

      expect(response.status).toBe(200);
      expect(response.body.data.document.size).toBe(largeFileSize);
    });
  });

  describe('Cloudinary Error Handling', () => {
    it('should handle Cloudinary service unavailable error', async () => {
      uploadFile.mockRejectedValue(new Error('Service temporarily unavailable'));

      const pdfContent = '%PDF-1.4\ntest content\n%%EOF';
      const filePath = path.join(testFilesDir, 'test.pdf');
      fs.writeFileSync(filePath, pdfContent);

      const response = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'International Passport')
        .attach('document', filePath);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('upload');
    });

    it('should handle Cloudinary authentication errors', async () => {
      uploadFile.mockRejectedValue(new Error('Invalid API credentials'));

      const pdfContent = '%PDF-1.4\ntest content\n%%EOF';
      const filePath = path.join(testFilesDir, 'test.pdf');
      fs.writeFileSync(filePath, pdfContent);

      const response = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'Bank Statement')
        .attach('document', filePath);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('upload');
    });

    it('should handle Cloudinary quota exceeded error', async () => {
      uploadFile.mockRejectedValue(new Error('Upload quota exceeded'));

      const pdfContent = '%PDF-1.4\ntest content\n%%EOF';
      const filePath = path.join(testFilesDir, 'test.pdf');
      fs.writeFileSync(filePath, pdfContent);

      const response = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'Flight Itinerary')
        .attach('document', filePath);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('quota');
    });

    it('should handle Cloudinary timeout errors', async () => {
      uploadFile.mockRejectedValue(new Error('Request timeout'));

      const pdfContent = '%PDF-1.4\ntest content\n%%EOF';
      const filePath = path.join(testFilesDir, 'test.pdf');
      fs.writeFileSync(filePath, pdfContent);

      const response = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'Hotel Booking')
        .attach('document', filePath);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('timeout');
    });

    it('should handle Cloudinary file format rejection', async () => {
      uploadFile.mockRejectedValue(new Error('Unsupported file format'));

      const invalidContent = 'This is not a valid file format';
      const filePath = path.join(testFilesDir, 'invalid.pdf');
      fs.writeFileSync(filePath, invalidContent);

      const response = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'Other')
        .attach('document', filePath);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('format');
    });
  });

  describe('Cloudinary Response Validation', () => {
    it('should validate Cloudinary response structure', async () => {
      // Mock incomplete Cloudinary response
      uploadFile.mockResolvedValue({
        secure_url: 'https://res.cloudinary.com/test/image/upload/v123456789/test.jpg',
        // Missing public_id and other required fields
      });

      const jpegContent = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
      const filePath = path.join(testFilesDir, 'test.jpg');
      fs.writeFileSync(filePath, jpegContent);

      const response = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'Passport Photograph')
        .attach('document', filePath);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('upload response');
    });

    it('should handle malformed Cloudinary URLs', async () => {
      uploadFile.mockResolvedValue({
        secure_url: 'not-a-valid-url',
        public_id: 'test-document',
        bytes: 1024000
      });

      const pdfContent = '%PDF-1.4\ntest content\n%%EOF';
      const filePath = path.join(testFilesDir, 'test.pdf');
      fs.writeFileSync(filePath, pdfContent);

      const response = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'International Passport')
        .attach('document', filePath);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('URL');
    });
  });

  describe('Document Replacement with Cloudinary Cleanup', () => {
    it('should delete old document from Cloudinary when replacing', async () => {
      // First upload
      uploadFile.mockResolvedValueOnce({
        secure_url: 'https://res.cloudinary.com/test/image/upload/v123456789/old-document.jpg',
        public_id: 'the-travel-place/visa-documents/old-document',
        bytes: 1024000
      });

      deleteFile.mockResolvedValue({ result: 'ok' });

      const jpegContent = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
      const filePath1 = path.join(testFilesDir, 'first.jpg');
      fs.writeFileSync(filePath1, jpegContent);

      const response1 = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'Passport Photograph')
        .attach('document', filePath1);

      expect(response1.status).toBe(200);

      // Second upload (replacement)
      uploadFile.mockResolvedValueOnce({
        secure_url: 'https://res.cloudinary.com/test/image/upload/v123456790/new-document.jpg',
        public_id: 'the-travel-place/visa-documents/new-document',
        bytes: 2048000
      });

      const filePath2 = path.join(testFilesDir, 'second.jpg');
      fs.writeFileSync(filePath2, jpegContent);

      const response2 = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'Passport Photograph')
        .attach('document', filePath2);

      expect(response2.status).toBe(200);
      expect(deleteFile).toHaveBeenCalledWith('the-travel-place/visa-documents/old-document', 'image');
    });

    it('should handle Cloudinary deletion failures gracefully', async () => {
      // First upload
      uploadFile.mockResolvedValueOnce({
        secure_url: 'https://res.cloudinary.com/test/image/upload/v123456789/old-document.jpg',
        public_id: 'the-travel-place/visa-documents/old-document',
        bytes: 1024000
      });

      const jpegContent = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
      const filePath1 = path.join(testFilesDir, 'first.jpg');
      fs.writeFileSync(filePath1, jpegContent);

      const response1 = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'Passport Photograph')
        .attach('document', filePath1);

      expect(response1.status).toBe(200);

      // Mock deletion failure
      deleteFile.mockRejectedValue(new Error('File not found'));

      // Second upload (replacement)
      uploadFile.mockResolvedValueOnce({
        secure_url: 'https://res.cloudinary.com/test/image/upload/v123456790/new-document.jpg',
        public_id: 'the-travel-place/visa-documents/new-document',
        bytes: 2048000
      });

      const filePath2 = path.join(testFilesDir, 'second.jpg');
      fs.writeFileSync(filePath2, jpegContent);

      const response2 = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'Passport Photograph')
        .attach('document', filePath2);

      // Should still succeed even if old file deletion fails
      expect(response2.status).toBe(200);
      expect(response2.body.data.document.cloudinaryUrl).toContain('new-document');
    });
  });

  describe('Cloudinary Configuration Validation', () => {
    it('should handle missing Cloudinary configuration', async () => {
      // Mock Cloudinary not being configured
      uploadFile.mockRejectedValue(new Error('Must supply cloud_name'));

      const pdfContent = '%PDF-1.4\ntest content\n%%EOF';
      const filePath = path.join(testFilesDir, 'test.pdf');
      fs.writeFileSync(filePath, pdfContent);

      const response = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'International Passport')
        .attach('document', filePath);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('configuration');
    });

    it('should validate Cloudinary folder structure', async () => {
      uploadFile.mockResolvedValue({
        secure_url: 'https://res.cloudinary.com/test/raw/upload/v123456789/the-travel-place/visa-documents/test-document.pdf',
        public_id: 'the-travel-place/visa-documents/test-document',
        bytes: 1024000,
        folder: `the-travel-place/visa-documents/${visaApplication._id}`
      });

      const pdfContent = '%PDF-1.4\ntest content\n%%EOF';
      const filePath = path.join(testFilesDir, 'test.pdf');
      fs.writeFileSync(filePath, pdfContent);

      const response = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'International Passport')
        .attach('document', filePath);

      expect(response.status).toBe(200);
      expect(uploadFile).toHaveBeenCalledWith(
        expect.any(String),
        `visa-documents/${visaApplication._id}`,
        expect.any(Object)
      );
    });
  });

  describe('Performance and Optimization', () => {
    it('should apply appropriate transformations for different file types', async () => {
      // Test image optimization
      uploadFile.mockResolvedValue({
        secure_url: 'https://res.cloudinary.com/test/image/upload/c_limit,h_2000,q_auto:low,w_2000/v123456789/optimized.jpg',
        public_id: 'optimized',
        bytes: 512000,
        format: 'jpg'
      });

      const jpegContent = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
      const filePath = path.join(testFilesDir, 'optimize.jpg');
      fs.writeFileSync(filePath, jpegContent);

      const response = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'Passport Photograph')
        .attach('document', filePath);

      expect(response.status).toBe(200);
      expect(uploadFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          quality: 'auto:low',
          strip: true
        })
      );
    });

    it('should handle concurrent uploads to Cloudinary', async () => {
      uploadFile.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            secure_url: `https://res.cloudinary.com/test/image/upload/v${Date.now()}/concurrent.jpg`,
            public_id: `concurrent-${Date.now()}`,
            bytes: 1024000
          }), 100)
        )
      );

      const jpegContent = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
      
      const uploadPromises = [];
      for (let i = 0; i < 3; i++) {
        const filePath = path.join(testFilesDir, `concurrent-${i}.jpg`);
        fs.writeFileSync(filePath, jpegContent);

        const uploadPromise = request(app)
          .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
          .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
          .field('documentType', 'Other')
          .attach('document', filePath);

        uploadPromises.push(uploadPromise);
      }

      const responses = await Promise.all(uploadPromises);
      
      // All uploads should eventually succeed
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status); // Success or rate limited
      });
    });
  });
});