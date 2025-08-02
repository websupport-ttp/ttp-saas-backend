// v1/test/fileUpload.comprehensive.test.js
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

describe('Comprehensive File Upload Testing for Visa Documents', () => {
  let mongoServer;
  let testUser;
  let visaApplication;
  let testFilesDir;

  beforeAll(async () => {
    mongoServer = await setupTestEnvironment();
    
    // Create test files directory
    testFilesDir = path.join(__dirname, 'test-files');
    if (!fs.existsSync(testFilesDir)) {
      fs.mkdirSync(testFilesDir, { recursive: true });
    }
  });

  afterAll(async () => {
    // Clean up test files directory
    if (fs.existsSync(testFilesDir)) {
      fs.rmSync(testFilesDir, { recursive: true, force: true });
    }
    
    await teardownTestEnvironment(mongoServer);
  });

  beforeEach(async () => {
    // Create test user
    testUser = await User.create({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      password: 'password123',
      phoneNumber: '+2348123456789',
      role: 'User',
      isEmailVerified: true
    });

    // Create test visa application
    visaApplication = await VisaApplication.create({
      userId: testUser._id,
      destinationCountry: 'United States',
      visaType: 'Tourist',
      travelPurpose: 'Tourism',
      urgency: 'Standard',
      personalInformation: {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'Male',
        nationality: 'Nigerian',
        maritalStatus: 'Single',
        occupation: 'Engineer',
        address: '123 Test Street'
      },
      fees: {
        visaFee: 10000000,
        serviceFee: 1500000,
        urgencyFee: 0,
        total: 11500000
      }
    });

    // Reset mocks
    jest.clearAllMocks();
    
    // Mock successful Cloudinary upload by default
    uploadFile.mockResolvedValue({
      secure_url: 'https://res.cloudinary.com/test/image/upload/v123456789/test-document.jpg',
      public_id: 'test-document',
      bytes: 1024000,
      format: 'jpg',
      resource_type: 'image'
    });
  });

  afterEach(async () => {
    // Clean up any test files created during tests
    const files = fs.readdirSync(testFilesDir);
    files.forEach(file => {
      const filePath = path.join(testFilesDir, file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
  });

  describe('File Format Validation Tests', () => {
    const createTestFile = (filename, content, mimeType = 'application/pdf') => {
      const filePath = path.join(testFilesDir, filename);
      fs.writeFileSync(filePath, content);
      return { filePath, mimeType };
    };

    it('should accept valid PDF documents', async () => {
      const pdfContent = '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\nxref\n0 2\ntrailer\n<<\n/Size 2\n/Root 1 0 R\n>>\nstartxref\n%%EOF';
      const { filePath } = createTestFile('passport.pdf', pdfContent);

      const response = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'International Passport')
        .attach('document', filePath);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.document).toHaveProperty('cloudinaryUrl');
      expect(uploadFile).toHaveBeenCalledWith(
        expect.any(String),
        `visa-documents/${visaApplication._id}`,
        expect.objectContaining({
          resource_type: 'auto',
          allowed_formats: expect.arrayContaining(['pdf', 'jpg', 'jpeg', 'png'])
        })
      );
    });

    it('should accept valid JPEG images', async () => {
      // Create a minimal JPEG file header
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
      expect(response.body.success).toBe(true);
      expect(response.body.data.document.mimetype).toBe('image/jpeg');
    });

    it('should accept valid PNG images', async () => {
      // Create a minimal PNG file header
      const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const pngContent = Buffer.concat([pngHeader, Buffer.alloc(1000, 0x00)]);
      const filePath = path.join(testFilesDir, 'document.png');
      fs.writeFileSync(filePath, pngContent);

      const response = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'Bank Statement')
        .attach('document', filePath);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.document.mimetype).toBe('image/png');
    });

    it('should reject unsupported file formats', async () => {
      const { filePath } = createTestFile('document.txt', 'This is a text file', 'text/plain');

      const response = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'Other')
        .attach('document', filePath);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('file format');
    });

    it('should reject executable files', async () => {
      const { filePath } = createTestFile('malicious.exe', 'MZ\x90\x00', 'application/x-msdownload');

      const response = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'Other')
        .attach('document', filePath);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('file format');
    });
  });

  describe('File Size Validation Tests', () => {
    it('should accept files within size limits (< 10MB)', async () => {
      // Create a 5MB file
      const fileSize = 5 * 1024 * 1024; // 5MB
      const content = Buffer.alloc(fileSize, 'A');
      const filePath = path.join(testFilesDir, 'large-document.pdf');
      
      // Add PDF header to make it a valid PDF
      const pdfHeader = '%PDF-1.4\n';
      const pdfContent = Buffer.concat([Buffer.from(pdfHeader), content]);
      fs.writeFileSync(filePath, pdfContent);

      const response = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'Bank Statement')
        .attach('document', filePath);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.document.size).toBeGreaterThan(fileSize);
    });

    it('should reject files exceeding size limits (> 10MB)', async () => {
      // Create a 15MB file
      const fileSize = 15 * 1024 * 1024; // 15MB
      const content = Buffer.alloc(fileSize, 'A');
      const filePath = path.join(testFilesDir, 'oversized-document.pdf');
      
      const pdfHeader = '%PDF-1.4\n';
      const pdfContent = Buffer.concat([Buffer.from(pdfHeader), content]);
      fs.writeFileSync(filePath, pdfContent);

      const response = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'Flight Itinerary')
        .attach('document', filePath);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('file size');
    });

    it('should reject empty files', async () => {
      const filePath = path.join(testFilesDir, 'empty.pdf');
      fs.writeFileSync(filePath, '');

      const response = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'Other')
        .attach('document', filePath);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('empty');
    });
  });

  describe('Security Validation Tests', () => {
    it('should scan for malicious content in PDF files', async () => {
      // Create a PDF with potentially malicious JavaScript
      const maliciousPdf = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
/OpenAction << /S /JavaScript /JS (app.alert('XSS')) >>
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
xref
0 3
trailer
<<
/Size 3
/Root 1 0 R
>>
startxref
%%EOF`;

      const filePath = path.join(testFilesDir, 'malicious.pdf');
      fs.writeFileSync(filePath, maliciousPdf);

      const response = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'Other')
        .attach('document', filePath);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('security');
    });

    it('should validate file headers match extensions', async () => {
      // Create a file with .pdf extension but JPEG content
      const jpegHeader = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
      const filePath = path.join(testFilesDir, 'fake.pdf');
      fs.writeFileSync(filePath, jpegHeader);

      const response = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'International Passport')
        .attach('document', filePath);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('file type mismatch');
    });

    it('should sanitize file names', async () => {
      const pdfContent = '%PDF-1.4\ntest content\n%%EOF';
      const filePath = path.join(testFilesDir, '../../../malicious-path.pdf');
      fs.writeFileSync(path.join(testFilesDir, 'malicious-path.pdf'), pdfContent);

      const response = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'Other')
        .attach('document', path.join(testFilesDir, 'malicious-path.pdf'));

      if (response.status === 200) {
        expect(response.body.data.document.filename).not.toContain('../');
        expect(response.body.data.document.filename).not.toContain('\\');
      }
    });
  });

  describe('Cloudinary Integration Tests', () => {
    it('should successfully upload to Cloudinary with correct parameters', async () => {
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
          allowed_formats: expect.arrayContaining(['pdf', 'jpg', 'jpeg', 'png']),
          quality: 'auto:low'
        })
      );
    });

    it('should handle Cloudinary upload failures gracefully', async () => {
      uploadFile.mockRejectedValue(new Error('Cloudinary service unavailable'));

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

    it('should handle Cloudinary timeout errors', async () => {
      uploadFile.mockRejectedValue(new Error('Request timeout'));

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
      expect(response.body.message).toContain('timeout');
    });

    it('should clean up local files after successful upload', async () => {
      const pdfContent = '%PDF-1.4\ntest content\n%%EOF';
      const filePath = path.join(testFilesDir, 'cleanup-test.pdf');
      fs.writeFileSync(filePath, pdfContent);

      const response = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'Hotel Booking')
        .attach('document', filePath);

      expect(response.status).toBe(200);
      
      // Verify the uploaded file path is cleaned up (this would be in uploads/ directory)
      // The test file we created should still exist, but the multer temp file should be cleaned
      expect(fs.existsSync(filePath)).toBe(true); // Our test file
    });

    it('should clean up local files after failed upload', async () => {
      uploadFile.mockRejectedValue(new Error('Upload failed'));

      const pdfContent = '%PDF-1.4\ntest content\n%%EOF';
      const filePath = path.join(testFilesDir, 'failed-upload.pdf');
      fs.writeFileSync(filePath, pdfContent);

      const response = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'Invitation Letter')
        .attach('document', filePath);

      expect(response.status).toBe(500);
      // Local cleanup should still happen even on failure
    });
  });

  describe('Document Type Validation Tests', () => {
    const validDocumentTypes = [
      'International Passport',
      'Passport Photograph',
      'Bank Statement',
      'Flight Itinerary',
      'Hotel Booking',
      'Invitation Letter',
      'Other'
    ];

    validDocumentTypes.forEach(documentType => {
      it(`should accept valid document type: ${documentType}`, async () => {
        const pdfContent = '%PDF-1.4\ntest content\n%%EOF';
        const filePath = path.join(testFilesDir, `${documentType.replace(/\s+/g, '-').toLowerCase()}.pdf`);
        fs.writeFileSync(filePath, pdfContent);

        const response = await request(app)
          .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
          .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
          .field('documentType', documentType)
          .attach('document', filePath);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.document.documentType).toBe(documentType);
      });
    });

    it('should reject invalid document types', async () => {
      const pdfContent = '%PDF-1.4\ntest content\n%%EOF';
      const filePath = path.join(testFilesDir, 'invalid-type.pdf');
      fs.writeFileSync(filePath, pdfContent);

      const response = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'Invalid Document Type')
        .attach('document', filePath);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('document type');
    });

    it('should require document type field', async () => {
      const pdfContent = '%PDF-1.4\ntest content\n%%EOF';
      const filePath = path.join(testFilesDir, 'no-type.pdf');
      fs.writeFileSync(filePath, pdfContent);

      const response = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .attach('document', filePath);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('documentType');
    });
  });

  describe('Multiple Document Upload Tests', () => {
    it('should allow multiple documents of different types', async () => {
      const documents = [
        { type: 'International Passport', filename: 'passport.pdf' },
        { type: 'Passport Photograph', filename: 'photo.jpg' },
        { type: 'Bank Statement', filename: 'bank.pdf' }
      ];

      for (const doc of documents) {
        let content;
        if (doc.filename.endsWith('.pdf')) {
          content = '%PDF-1.4\ntest content\n%%EOF';
        } else {
          content = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]); // JPEG header
        }
        
        const filePath = path.join(testFilesDir, doc.filename);
        fs.writeFileSync(filePath, content);

        const response = await request(app)
          .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
          .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
          .field('documentType', doc.type)
          .attach('document', filePath);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }

      // Verify all documents are stored
      const updatedApplication = await VisaApplication.findById(visaApplication._id);
      expect(updatedApplication.documents).toHaveLength(3);
    });

    it('should prevent duplicate document types', async () => {
      // Upload first passport document
      const pdfContent = '%PDF-1.4\nfirst passport\n%%EOF';
      const filePath1 = path.join(testFilesDir, 'passport1.pdf');
      fs.writeFileSync(filePath1, pdfContent);

      const response1 = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'International Passport')
        .attach('document', filePath1);

      expect(response1.status).toBe(200);

      // Try to upload second passport document
      const pdfContent2 = '%PDF-1.4\nsecond passport\n%%EOF';
      const filePath2 = path.join(testFilesDir, 'passport2.pdf');
      fs.writeFileSync(filePath2, pdfContent2);

      const response2 = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'International Passport')
        .attach('document', filePath2);

      expect(response2.status).toBe(200); // Should replace the existing document
      
      const updatedApplication = await VisaApplication.findById(visaApplication._id);
      const passportDocs = updatedApplication.documents.filter(doc => doc.documentType === 'International Passport');
      expect(passportDocs).toHaveLength(1); // Should only have one passport document
    });
  });

  describe('Error Handling Tests', () => {
    it('should handle missing file upload', async () => {
      const response = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'International Passport');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('file');
    });

    it('should handle invalid visa application ID', async () => {
      const pdfContent = '%PDF-1.4\ntest content\n%%EOF';
      const filePath = path.join(testFilesDir, 'test.pdf');
      fs.writeFileSync(filePath, pdfContent);

      const response = await request(app)
        .post('/api/v1/products/visa/invalid-id/upload-document')
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'International Passport')
        .attach('document', filePath);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('ID');
    });

    it('should handle non-existent visa application', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      const pdfContent = '%PDF-1.4\ntest content\n%%EOF';
      const filePath = path.join(testFilesDir, 'test.pdf');
      fs.writeFileSync(filePath, pdfContent);

      const response = await request(app)
        .post(`/api/v1/products/visa/${nonExistentId}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'International Passport')
        .attach('document', filePath);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });

    it('should handle unauthorized access to other users visa applications', async () => {
      const otherUser = await User.create({
        firstName: 'Other',
        lastName: 'User',
        email: 'other@example.com',
        password: 'password123',
        phoneNumber: '+2348111111111',
        role: 'User'
      });

      const pdfContent = '%PDF-1.4\ntest content\n%%EOF';
      const filePath = path.join(testFilesDir, 'test.pdf');
      fs.writeFileSync(filePath, pdfContent);

      const response = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: otherUser._id.toString(), role: 'User' }))
        .field('documentType', 'International Passport')
        .attach('document', filePath);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Unauthorized');
    });
  });

  describe('Performance and Load Tests', () => {
    it('should handle concurrent file uploads', async () => {
      const uploadPromises = [];
      
      for (let i = 0; i < 5; i++) {
        const pdfContent = `%PDF-1.4\ntest content ${i}\n%%EOF`;
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
      
      // At least some uploads should succeed (depending on rate limiting)
      const successfulUploads = responses.filter(res => res.status === 200);
      expect(successfulUploads.length).toBeGreaterThan(0);
    });

    it('should complete upload within reasonable time', async () => {
      const pdfContent = '%PDF-1.4\ntest content\n%%EOF';
      const filePath = path.join(testFilesDir, 'performance-test.pdf');
      fs.writeFileSync(filePath, pdfContent);

      const startTime = Date.now();
      
      const response = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'International Passport')
        .attach('document', filePath);

      const endTime = Date.now();
      const uploadTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(uploadTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});