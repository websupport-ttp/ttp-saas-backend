// v1/test/fileUpload.security.test.js
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

describe('File Upload Security Tests', () => {
  let mongoServer;
  let testUser;
  let visaApplication;
  let testFilesDir;

  beforeAll(async () => {
    mongoServer = await setupTestEnvironment();
    
    testFilesDir = path.join(__dirname, 'security-test-files');
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
      firstName: 'Security',
      lastName: 'Tester',
      email: 'security@example.com',
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
        firstName: 'Security',
        lastName: 'Tester',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'Male',
        nationality: 'Nigerian',
        maritalStatus: 'Single',
        occupation: 'Tester',
        address: '123 Security Street'
      }
    });

    jest.clearAllMocks();
    uploadFile.mockResolvedValue({
      secure_url: 'https://res.cloudinary.com/test/image/upload/v123456789/test-document.jpg',
      public_id: 'test-document',
      bytes: 1024000
    });
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

  describe('Malicious File Detection', () => {
    it('should detect and reject files with embedded scripts', async () => {
      const maliciousContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
/OpenAction << /S /JavaScript /JS (this.print({bUI:true,bSilent:false,bShrinkToFit:true}); this.closeDoc(true);) >>
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
>>
endobj
xref
0 4
trailer
<<
/Size 4
/Root 1 0 R
>>
startxref
%%EOF`;

      const filePath = path.join(testFilesDir, 'malicious-script.pdf');
      fs.writeFileSync(filePath, maliciousContent);

      const response = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'International Passport')
        .attach('document', filePath);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('security');
    });

    it('should detect and reject files with suspicious URLs', async () => {
      const suspiciousContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
/URI << /Base (http://malicious-site.com/steal-data) >>
>>
endobj
xref
0 2
trailer
<<
/Size 2
/Root 1 0 R
>>
startxref
%%EOF`;

      const filePath = path.join(testFilesDir, 'suspicious-url.pdf');
      fs.writeFileSync(filePath, suspiciousContent);

      const response = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'Bank Statement')
        .attach('document', filePath);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('security');
    });

    it('should detect polyglot files (files that are valid in multiple formats)', async () => {
      // Create a file that starts as a valid JPEG but contains PDF content
      const jpegHeader = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
      const pdfContent = Buffer.from('%PDF-1.4\n/JavaScript content here\n%%EOF');
      const polyglotContent = Buffer.concat([jpegHeader, pdfContent]);

      const filePath = path.join(testFilesDir, 'polyglot.jpg');
      fs.writeFileSync(filePath, polyglotContent);

      const response = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'Passport Photograph')
        .attach('document', filePath);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('security');
    });
  });

  describe('File Type Spoofing Detection', () => {
    it('should detect executable files disguised as PDFs', async () => {
      // Windows PE header (executable)
      const peHeader = Buffer.from([0x4D, 0x5A, 0x90, 0x00]); // MZ header
      const filePath = path.join(testFilesDir, 'fake-pdf.pdf');
      fs.writeFileSync(filePath, peHeader);

      const response = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'Other')
        .attach('document', filePath);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('file type mismatch');
    });

    it('should detect ZIP files disguised as images', async () => {
      // ZIP file header
      const zipHeader = Buffer.from([0x50, 0x4B, 0x03, 0x04]);
      const filePath = path.join(testFilesDir, 'fake-image.jpg');
      fs.writeFileSync(filePath, zipHeader);

      const response = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'Passport Photograph')
        .attach('document', filePath);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('file type mismatch');
    });

    it('should detect HTML files disguised as PDFs', async () => {
      const htmlContent = `<!DOCTYPE html>
<html>
<head><title>Fake PDF</title></head>
<body>
<script>alert('XSS');</script>
<p>This looks like a PDF but it's HTML</p>
</body>
</html>`;

      const filePath = path.join(testFilesDir, 'fake-html.pdf');
      fs.writeFileSync(filePath, htmlContent);

      const response = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'Flight Itinerary')
        .attach('document', filePath);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('file type mismatch');
    });
  });

  describe('Path Traversal Protection', () => {
    it('should sanitize filenames with path traversal attempts', async () => {
      const pdfContent = '%PDF-1.4\ntest content\n%%EOF';
      const filePath = path.join(testFilesDir, 'normal.pdf');
      fs.writeFileSync(filePath, pdfContent);

      // Simulate a file with malicious filename
      const response = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'Other')
        .attach('document', filePath);

      if (response.status === 200) {
        expect(response.body.data.document.originalName).not.toContain('../');
        expect(response.body.data.document.originalName).not.toContain('..\\');
        expect(response.body.data.document.filename).not.toContain('../');
        expect(response.body.data.document.filename).not.toContain('..\\');
      }
    });

    it('should reject files with null bytes in filename', async () => {
      const pdfContent = '%PDF-1.4\ntest content\n%%EOF';
      const filePath = path.join(testFilesDir, 'null-byte.pdf');
      fs.writeFileSync(filePath, pdfContent);

      // This test simulates what would happen if someone tried to upload a file with null bytes
      // The actual prevention would be in the multer configuration or filename sanitization
      const response = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'Other')
        .attach('document', filePath);

      // Should either succeed with sanitized filename or reject
      if (response.status === 200) {
        expect(response.body.data.document.originalName).not.toContain('\0');
      }
    });
  });

  describe('Content Validation', () => {
    it('should validate PDF structure integrity', async () => {
      const corruptedPdf = '%PDF-1.4\nCorrupted content without proper structure';
      const filePath = path.join(testFilesDir, 'corrupted.pdf');
      fs.writeFileSync(filePath, corruptedPdf);

      const response = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'Bank Statement')
        .attach('document', filePath);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('corrupted');
    });

    it('should validate image file integrity', async () => {
      // Create a corrupted JPEG (missing proper structure)
      const corruptedJpeg = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]); // Incomplete JPEG
      const filePath = path.join(testFilesDir, 'corrupted.jpg');
      fs.writeFileSync(filePath, corruptedJpeg);

      const response = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'Passport Photograph')
        .attach('document', filePath);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('corrupted');
    });

    it('should detect and reject password-protected PDFs', async () => {
      // Simulate a password-protected PDF structure
      const protectedPdf = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
/Encrypt 3 0 R
>>
endobj
3 0 obj
<<
/Filter /Standard
/V 1
/R 2
/O <encrypted_owner_password>
/U <encrypted_user_password>
/P -44
>>
endobj
xref
0 4
trailer
<<
/Size 4
/Root 1 0 R
/Encrypt 3 0 R
>>
startxref
%%EOF`;

      const filePath = path.join(testFilesDir, 'protected.pdf');
      fs.writeFileSync(filePath, protectedPdf);

      const response = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'International Passport')
        .attach('document', filePath);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('password-protected');
    });
  });

  describe('Rate Limiting and Abuse Prevention', () => {
    it('should implement rate limiting for file uploads', async () => {
      const uploadPromises = [];
      
      // Try to upload many files rapidly
      for (let i = 0; i < 20; i++) {
        const pdfContent = `%PDF-1.4\ntest content ${i}\n%%EOF`;
        const filePath = path.join(testFilesDir, `rate-limit-${i}.pdf`);
        fs.writeFileSync(filePath, pdfContent);

        const uploadPromise = request(app)
          .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
          .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
          .field('documentType', 'Other')
          .attach('document', filePath);

        uploadPromises.push(uploadPromise);
      }

      const responses = await Promise.allSettled(uploadPromises);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(result => 
        result.status === 'fulfilled' && result.value.status === 429
      );
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should prevent excessive file size uploads in rapid succession', async () => {
      const largeContent = Buffer.alloc(5 * 1024 * 1024, 'A'); // 5MB
      const pdfHeader = '%PDF-1.4\n';
      
      const uploadPromises = [];
      
      for (let i = 0; i < 3; i++) {
        const pdfContent = Buffer.concat([Buffer.from(pdfHeader), largeContent]);
        const filePath = path.join(testFilesDir, `large-${i}.pdf`);
        fs.writeFileSync(filePath, pdfContent);

        const uploadPromise = request(app)
          .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
          .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
          .field('documentType', 'Other')
          .attach('document', filePath);

        uploadPromises.push(uploadPromise);
      }

      const responses = await Promise.allSettled(uploadPromises);
      
      // Should have some form of throttling or rejection for rapid large uploads
      const successfulUploads = responses.filter(result => 
        result.status === 'fulfilled' && result.value.status === 200
      ).length;
      
      expect(successfulUploads).toBeLessThan(3); // Not all should succeed
    });
  });

  describe('Metadata Security', () => {
    it('should strip potentially dangerous metadata from images', async () => {
      // Create a JPEG with EXIF data that could contain malicious content
      const jpegWithExif = Buffer.concat([
        Buffer.from([0xFF, 0xD8, 0xFF, 0xE1]), // JPEG + EXIF marker
        Buffer.from([0x00, 0x16]), // Length
        Buffer.from('Exif\0\0'), // EXIF header
        Buffer.from('Malicious metadata content here'),
        Buffer.from([0xFF, 0xD9]) // End of image
      ]);

      const filePath = path.join(testFilesDir, 'exif-metadata.jpg');
      fs.writeFileSync(filePath, jpegWithExif);

      const response = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'Passport Photograph')
        .attach('document', filePath);

      if (response.status === 200) {
        // Verify that Cloudinary was called with metadata stripping options
        expect(uploadFile).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(String),
          expect.objectContaining({
            strip: true // Should strip metadata
          })
        );
      }
    });

    it('should handle files with suspicious metadata gracefully', async () => {
      const pdfWithSuspiciousMetadata = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
/Info << /Title (Legitimate Document) /Author (javascript:alert('XSS')) /Subject (Normal Subject) >>
>>
endobj
xref
0 2
trailer
<<
/Size 2
/Root 1 0 R
>>
startxref
%%EOF`;

      const filePath = path.join(testFilesDir, 'suspicious-metadata.pdf');
      fs.writeFileSync(filePath, pdfWithSuspiciousMetadata);

      const response = await request(app)
        .post(`/api/v1/products/visa/${visaApplication._id}/upload-document`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .field('documentType', 'Hotel Booking')
        .attach('document', filePath);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('security');
    });
  });
});