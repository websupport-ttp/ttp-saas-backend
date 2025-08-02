// v1/test/visaApplication.comprehensive.test.js
const request = require('supertest');
const app = require('../../app');
const { testDb, testAuth, testData, testAssertions } = require('./testSetup');
const User = require('../models/userModel');
const VisaApplication = require('../models/visaApplicationModel');
const Ledger = require('../models/ledgerModel');

// Mock external services
jest.mock('../utils/emailService');
jest.mock('../utils/smsService');
jest.mock('../services/cloudinaryService');

const { sendEmail } = require('../utils/emailService');
const { sendSMS, sendWhatsAppMessage } = require('../utils/smsService');
const { uploadToCloudinary } = require('../services/cloudinaryService');

describe('Comprehensive Visa Application Workflows', () => {
  let testUser;
  let staffUser;
  let authToken;
  let staffAuthToken;
  let testVisaApplication;

  beforeAll(async () => {
    // Setup test environment
    await testDb.clearDatabase();
    
    // Create test users
    const userData = testData.createUser({
      role: 'User',
      isEmailVerified: true,
      isPhoneVerified: true
    });
    
    const staffUserData = testData.createUser({
      email: 'staff@example.com',
      role: 'Staff',
      isEmailVerified: true,
      isPhoneVerified: true
    });

    testUser = await User.create(userData);
    staffUser = await User.create(staffUserData);

    // Generate auth tokens
    authToken = testAuth.generateTestToken({ 
      userId: testUser._id, 
      role: testUser.role 
    });
    
    staffAuthToken = testAuth.generateTestToken({ 
      userId: staffUser._id, 
      role: staffUser.role 
    });

    // Mock external services
    sendEmail.mockResolvedValue(true);
    sendSMS.mockResolvedValue(true);
    sendWhatsAppMessage.mockResolvedValue(true);
    uploadToCloudinary.mockResolvedValue({
      secure_url: 'https://res.cloudinary.com/test/image/upload/v123456789/test-document.jpg',
      public_id: 'test-document',
      bytes: 1024000
    });
  });

  afterAll(async () => {
    await testDb.clearDatabase();
    await testDb.closeDatabase();
  });

  beforeEach(async () => {
    // Clear visa applications before each test
    await VisaApplication.deleteMany({});
    jest.clearAllMocks();
  });

  describe('Visa Application Creation Workflows', () => {
    const validVisaApplicationData = {
      countryOfInterest: 'United States',
      purposeOfTravel: 'Tourism',
      travelDates: {
        startDate: '2024-06-01',
        endDate: '2024-06-15'
      },
      personalInformation: {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        gender: 'Male',
        nationality: 'Nigerian',
        maritalStatus: 'Single',
        occupation: 'Software Engineer',
        address: '123 Test Street, Lagos, Nigeria'
      }
    };

    it('should successfully create a visa application for authenticated user', async () => {
      const response = await request(app)
        .post('/api/v1/products/visa/apply')
        .set('Cookie', testAuth.createSignedCookieString(authToken))
        .send(validVisaApplicationData)
        .expect(201);

      testAssertions.assertSuccessResponse(response, 201);
      expect(response.body.data).toHaveProperty('visaApplicationId');
      expect(response.body.message).toBe('Visa application initiated successfully. Please proceed to upload documents.');

      // Verify application was created in database
      const application = await VisaApplication.findById(response.body.data.visaApplicationId);
      expect(application).toBeTruthy();
      expect(application.userId.toString()).toBe(testUser._id.toString());
      expect(application.countryOfInterest).toBe(validVisaApplicationData.countryOfInterest);
      expect(application.status).toBe('Processing Documents');
    });

    it('should create visa application with guest user details when not authenticated', async () => {
      const guestApplicationData = {
        ...validVisaApplicationData,
        guestEmail: 'guest@example.com',
        guestPhoneNumber: '+1234567890'
      };

      const response = await request(app)
        .post('/api/v1/products/visa/apply')
        .send(guestApplicationData)
        .expect(201);

      testAssertions.assertSuccessResponse(response, 201);
      
      const application = await VisaApplication.findById(response.body.data.visaApplicationId);
      expect(application.guestEmail).toBe(guestApplicationData.guestEmail);
      expect(application.guestPhoneNumber).toBe(guestApplicationData.guestPhoneNumber);
      expect(application.userId).toBeUndefined();
    });

    it('should validate required fields', async () => {
      const invalidData = {
        // Missing required fields
        purposeOfTravel: 'Tourism'
      };

      const response = await request(app)
        .post('/api/v1/products/visa/apply')
        .set('Cookie', testAuth.createSignedCookieString(authToken))
        .send(invalidData)
        .expect(400);

      testAssertions.assertErrorResponse(response, 400);
    });

    it('should require guest contact info when not authenticated', async () => {
      const response = await request(app)
        .post('/api/v1/products/visa/apply')
        .send(validVisaApplicationData)
        .expect(400);

      testAssertions.assertErrorResponse(response, 400);
      expect(response.body.message).toContain('Guest email and phone number are required');
    });
  });

  describe('Document Upload Workflows', () => {
    beforeEach(async () => {
      // Create a test visa application
      testVisaApplication = await VisaApplication.create({
        userId: testUser._id,
        countryOfInterest: 'United States',
        purposeOfTravel: 'Tourism',
        status: 'Processing Documents'
      });
    });

    it('should successfully upload a document', async () => {
      // Create a test file buffer
      const testFileBuffer = Buffer.from('test file content');
      
      const response = await request(app)
        .post(`/api/v1/products/visa/${testVisaApplication._id}/upload-document`)
        .set('Cookie', testAuth.createSignedCookieString(authToken))
        .field('documentType', 'International Passport')
        .attach('file', testFileBuffer, 'passport.jpg')
        .expect(200);

      testAssertions.assertSuccessResponse(response, 200);
      expect(response.body.data.document).toHaveProperty('cloudinaryUrl');
      expect(response.body.data.document).toHaveProperty('documentType', 'International Passport');

      // Verify document was added to application
      const updatedApplication = await VisaApplication.findById(testVisaApplication._id);
      expect(updatedApplication.documents).toHaveLength(1);
      expect(updatedApplication.documents[0].documentType).toBe('International Passport');
    });

    it('should validate document type', async () => {
      const testFileBuffer = Buffer.from('test file content');
      
      const response = await request(app)
        .post(`/api/v1/products/visa/${testVisaApplication._id}/upload-document`)
        .set('Cookie', testAuth.createSignedCookieString(authToken))
        .field('documentType', 'Invalid Document Type')
        .attach('file', testFileBuffer, 'document.jpg')
        .expect(400);

      testAssertions.assertErrorResponse(response, 400);
    });

    it('should require file upload', async () => {
      const response = await request(app)
        .post(`/api/v1/products/visa/${testVisaApplication._id}/upload-document`)
        .set('Cookie', testAuth.createSignedCookieString(authToken))
        .field('documentType', 'International Passport')
        .expect(400);

      testAssertions.assertErrorResponse(response, 400);
      expect(response.body.message).toContain('No file uploaded');
    });

    it('should handle multiple document uploads', async () => {
      const documentTypes = ['International Passport', 'Bank Statement', 'Flight Itinerary'];
      
      for (const docType of documentTypes) {
        const testFileBuffer = Buffer.from(`${docType} content`);
        
        await request(app)
          .post(`/api/v1/products/visa/${testVisaApplication._id}/upload-document`)
          .set('Cookie', testAuth.createSignedCookieString(authToken))
          .field('documentType', docType)
          .attach('file', testFileBuffer, `${docType.toLowerCase().replace(' ', '-')}.pdf`)
          .expect(200);
      }

      // Verify all documents were uploaded
      const updatedApplication = await VisaApplication.findById(testVisaApplication._id);
      expect(updatedApplication.documents).toHaveLength(3);
      
      const uploadedTypes = updatedApplication.documents.map(doc => doc.documentType);
      documentTypes.forEach(type => {
        expect(uploadedTypes).toContain(type);
      });
    });
  });

  describe('Status Update Workflows', () => {
    beforeEach(async () => {
      testVisaApplication = await VisaApplication.create({
        userId: testUser._id,
        countryOfInterest: 'United States',
        purposeOfTravel: 'Tourism',
        status: 'Processing Documents'
      });
    });

    it('should successfully update visa application status by staff', async () => {
      const updateData = {
        status: 'Approved',
        note: 'All documents verified and approved'
      };

      const response = await request(app)
        .put(`/api/v1/products/visa/${testVisaApplication._id}/status`)
        .set('Cookie', testAuth.createSignedCookieString(staffAuthToken))
        .send(updateData)
        .expect(200);

      testAssertions.assertSuccessResponse(response, 200);
      expect(response.body.data.visaApplication.status).toBe('Approved');
      expect(response.body.data.visaApplication.applicationNotes).toHaveLength(1);
      expect(response.body.data.visaApplication.applicationNotes[0].note).toBe(updateData.note);
    });

    it('should prevent regular users from updating status', async () => {
      const updateData = {
        status: 'Approved',
        note: 'Trying to approve my own application'
      };

      const response = await request(app)
        .put(`/api/v1/products/visa/${testVisaApplication._id}/status`)
        .set('Cookie', testAuth.createSignedCookieString(authToken))
        .send(updateData)
        .expect(403);

      testAssertions.assertErrorResponse(response, 403);
    });

    it('should validate status values', async () => {
      const updateData = {
        status: 'Invalid Status'
      };

      const response = await request(app)
        .put(`/api/v1/products/visa/${testVisaApplication._id}/status`)
        .set('Cookie', testAuth.createSignedCookieString(staffAuthToken))
        .send(updateData)
        .expect(400);

      testAssertions.assertErrorResponse(response, 400);
    });

    it('should handle all valid status transitions', async () => {
      const validStatuses = ['Pending', 'Submitted', 'Approved', 'Rejected', 'Processing Documents', 'Requires More Info'];
      
      for (const status of validStatuses) {
        const updateData = {
          status: status,
          note: `Status updated to ${status}`
        };

        const response = await request(app)
          .put(`/api/v1/products/visa/${testVisaApplication._id}/status`)
          .set('Cookie', testAuth.createSignedCookieString(staffAuthToken))
          .send(updateData)
          .expect(200);

        expect(response.body.data.visaApplication.status).toBe(status);
      }
    });
  });

  describe('Payment Integration Workflows', () => {
    beforeEach(async () => {
      testVisaApplication = await VisaApplication.create({
        userId: testUser._id,
        countryOfInterest: 'United States',
        purposeOfTravel: 'Tourism',
        status: 'Processing Documents',
        personalInformation: {
          firstName: 'John',
          lastName: 'Doe'
        }
      });
    });

    it('should integrate with payment system for visa processing fees', async () => {
      // Mock a visa processing fee payment scenario
      const paymentData = {
        amount: 15000, // NGN 150
        currency: 'NGN',
        email: testUser.email || 'test@example.com',
        reference: `VISA-${testVisaApplication._id}-${Date.now()}`
      };

      // Create ledger entry for visa payment
      const ledgerEntry = await Ledger.create({
        userId: testUser._id,
        transactionReference: paymentData.reference,
        amount: paymentData.amount,
        currency: paymentData.currency,
        status: 'Completed',
        paymentGateway: 'Paystack',
        productType: 'Visa Processing',
        itemType: 'Visa',
        serviceCharge: 2000,
        totalAmountPaid: paymentData.amount + 2000,
        productDetails: {
          visaApplicationId: testVisaApplication._id,
          countryOfInterest: testVisaApplication.countryOfInterest,
          purposeOfTravel: testVisaApplication.purposeOfTravel
        }
      });

      expect(ledgerEntry).toBeTruthy();
      expect(ledgerEntry.productType).toBe('Visa Processing');
      expect(ledgerEntry.productDetails.visaApplicationId.toString()).toBe(testVisaApplication._id.toString());
    });

    it('should handle failed visa processing payments', async () => {
      const paymentReference = `VISA-${testVisaApplication._id}-${Date.now()}`;
      const failedLedgerEntry = await Ledger.create({
        userId: testUser._id,
        transactionReference: paymentReference,
        amount: 20000,
        currency: 'NGN',
        status: 'Failed',
        paymentGateway: 'Paystack',
        productType: 'Visa Processing',
        itemType: 'Visa',
        serviceCharge: 2500,
        totalAmountPaid: 22500,
        productDetails: {
          visaApplicationId: testVisaApplication._id,
          countryOfInterest: testVisaApplication.countryOfInterest
        },
        paymentGatewayResponse: {
          status: 'failed',
          gateway_response: 'Declined by bank'
        }
      });

      expect(failedLedgerEntry.status).toBe('Failed');
      expect(failedLedgerEntry.paymentGatewayResponse.status).toBe('failed');
    });
  });

  describe('Notification System Integration', () => {
    beforeEach(async () => {
      testVisaApplication = await VisaApplication.create({
        userId: testUser._id,
        countryOfInterest: 'United States',
        purposeOfTravel: 'Tourism',
        status: 'Processing Documents',
        personalInformation: {
          firstName: 'John',
          lastName: 'Doe'
        }
      });
    });

    it('should trigger notifications when status is updated to Approved', async () => {
      const updateData = {
        status: 'Approved',
        note: 'Visa application approved successfully'
      };

      await request(app)
        .put(`/api/v1/products/visa/${testVisaApplication._id}/status`)
        .set('Cookie', testAuth.createSignedCookieString(staffAuthToken))
        .send(updateData)
        .expect(200);

      // Verify that application status was updated correctly
      const updatedApplication = await VisaApplication.findById(testVisaApplication._id);
      expect(updatedApplication.status).toBe('Approved');
      expect(updatedApplication.applicationNotes[0].note).toBe(updateData.note);
    });

    it('should handle status update to Rejected with proper notification', async () => {
      const updateData = {
        status: 'Rejected',
        note: 'Missing required documents'
      };

      await request(app)
        .put(`/api/v1/products/visa/${testVisaApplication._id}/status`)
        .set('Cookie', testAuth.createSignedCookieString(staffAuthToken))
        .send(updateData)
        .expect(200);

      const updatedApplication = await VisaApplication.findById(testVisaApplication._id);
      expect(updatedApplication.status).toBe('Rejected');
      expect(updatedApplication.applicationNotes[0].note).toBe(updateData.note);
    });

    it('should handle status update requiring more information', async () => {
      const updateData = {
        status: 'Requires More Info',
        note: 'Please provide additional bank statements and proof of accommodation'
      };

      await request(app)
        .put(`/api/v1/products/visa/${testVisaApplication._id}/status`)
        .set('Cookie', testAuth.createSignedCookieString(staffAuthToken))
        .send(updateData)
        .expect(200);

      const updatedApplication = await VisaApplication.findById(testVisaApplication._id);
      expect(updatedApplication.status).toBe('Requires More Info');
      expect(updatedApplication.applicationNotes[0].note).toContain('additional bank statements');
    });
  });

  describe('Error Handling Edge Cases', () => {
    it('should handle database connection errors during application creation', async () => {
      // Mock mongoose to throw an error
      const originalCreate = VisaApplication.create;
      VisaApplication.create = jest.fn().mockRejectedValue(new Error('Database connection failed'));

      const validVisaApplicationData = {
        countryOfInterest: 'United States',
        purposeOfTravel: 'Tourism',
        travelDates: {
          startDate: '2024-06-01',
          endDate: '2024-06-15'
        },
        personalInformation: {
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1990-01-01',
          gender: 'Male',
          nationality: 'Nigerian',
          maritalStatus: 'Single',
          occupation: 'Software Engineer',
          address: '123 Test Street, Lagos, Nigeria'
        }
      };

      const response = await request(app)
        .post('/api/v1/products/visa/apply')
        .set('Cookie', testAuth.createSignedCookieString(authToken))
        .send(validVisaApplicationData)
        .expect(500);

      testAssertions.assertErrorResponse(response, 500);

      // Restore original method
      VisaApplication.create = originalCreate;
    });

    it('should handle invalid MongoDB ObjectId in URL parameters', async () => {
      const invalidId = 'invalid-object-id';

      const response = await request(app)
        .get(`/api/v1/products/visa/${invalidId}`)
        .set('Cookie', testAuth.createSignedCookieString(authToken))
        .expect(400);

      testAssertions.assertErrorResponse(response, 400);
    });

    it('should handle expired authentication token', async () => {
      const expiredToken = testAuth.generateTestToken({ 
        userId: testUser._id, 
        role: testUser.role 
      }, '-1h'); // Expired token

      const response = await request(app)
        .post('/api/v1/products/visa/apply')
        .set('Cookie', testAuth.createSignedCookieString(expiredToken))
        .send({
          countryOfInterest: 'United States',
          purposeOfTravel: 'Tourism',
          travelDates: {
            startDate: '2024-06-01',
            endDate: '2024-06-15'
          },
          personalInformation: {
            firstName: 'John',
            lastName: 'Doe',
            dateOfBirth: '1990-01-01',
            gender: 'Male',
            nationality: 'Nigerian',
            maritalStatus: 'Single',
            occupation: 'Software Engineer',
            address: '123 Test Street, Lagos, Nigeria'
          }
        })
        .expect(401);

      testAssertions.assertErrorResponse(response, 401);
    });

    it('should handle cloudinary service unavailability', async () => {
      const testVisaApplication = await VisaApplication.create({
        userId: testUser._id,
        countryOfInterest: 'United States',
        purposeOfTravel: 'Tourism',
        status: 'Processing Documents'
      });

      // Mock cloudinary to be unavailable
      uploadToCloudinary.mockRejectedValue(new Error('Service unavailable'));

      const testFileBuffer = Buffer.from('test file content');
      
      const response = await request(app)
        .post(`/api/v1/products/visa/${testVisaApplication._id}/upload-document`)
        .set('Cookie', testAuth.createSignedCookieString(authToken))
        .field('documentType', 'International Passport')
        .attach('file', testFileBuffer, 'passport.jpg')
        .expect(500);

      testAssertions.assertErrorResponse(response, 500);
      expect(response.body.message).toContain('Failed to upload document');
    });

    it('should handle non-existent visa application', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      
      const response = await request(app)
        .get(`/api/v1/products/visa/${nonExistentId}`)
        .set('Cookie', testAuth.createSignedCookieString(authToken))
        .expect(404);

      testAssertions.assertErrorResponse(response, 404);
      expect(response.body.message).toContain('Visa application not found');
    });

    it('should handle unauthorized access to other users applications', async () => {
      // Create another user
      const otherUserData = testData.createUser({
        email: 'other@example.com',
        role: 'User'
      });
      const otherUser = await User.create(otherUserData);
      
      // Create application for other user
      const otherUserApplication = await VisaApplication.create({
        userId: otherUser._id,
        countryOfInterest: 'Canada',
        purposeOfTravel: 'Tourism',
        status: 'Processing Documents'
      });

      // Try to access with different user's token
      const response = await request(app)
        .get(`/api/v1/products/visa/${otherUserApplication._id}`)
        .set('Cookie', testAuth.createSignedCookieString(authToken))
        .expect(403);

      testAssertions.assertErrorResponse(response, 403);
    });
  });

  describe('Complete Workflow Integration Tests', () => {
    it('should complete full visa application workflow for authenticated user', async () => {
      // Step 1: Create visa application
      const applicationData = {
        countryOfInterest: 'United Kingdom',
        purposeOfTravel: 'Business',
        travelDates: {
          startDate: '2024-06-01',
          endDate: '2024-06-15'
        },
        personalInformation: {
          firstName: 'Jane',
          lastName: 'Smith',
          dateOfBirth: '1985-03-15',
          gender: 'Female',
          nationality: 'Nigerian',
          maritalStatus: 'Married',
          occupation: 'Business Analyst',
          address: '456 Business District, Lagos, Nigeria'
        }
      };

      const createResponse = await request(app)
        .post('/api/v1/products/visa/apply')
        .set('Cookie', testAuth.createSignedCookieString(authToken))
        .send(applicationData)
        .expect(201);

      const applicationId = createResponse.body.data.visaApplicationId;

      // Step 2: Upload required documents
      const documentTypes = ['International Passport', 'Bank Statement', 'Flight Itinerary'];
      
      for (const docType of documentTypes) {
        const testFileBuffer = Buffer.from(`${docType} content`);
        
        await request(app)
          .post(`/api/v1/products/visa/${applicationId}/upload-document`)
          .set('Cookie', testAuth.createSignedCookieString(authToken))
          .field('documentType', docType)
          .attach('file', testFileBuffer, `${docType.toLowerCase().replace(' ', '-')}.pdf`)
          .expect(200);
      }

      // Step 3: Verify application details
      const detailsResponse = await request(app)
        .get(`/api/v1/products/visa/${applicationId}`)
        .set('Cookie', testAuth.createSignedCookieString(authToken))
        .expect(200);

      expect(detailsResponse.body.data.visaApplication.documents).toHaveLength(3);
      expect(detailsResponse.body.data.visaApplication.status).toBe('Processing Documents');

      // Step 4: Staff updates status to submitted
      const statusResponse = await request(app)
        .put(`/api/v1/products/visa/${applicationId}/status`)
        .set('Cookie', testAuth.createSignedCookieString(staffAuthToken))
        .send({ status: 'Submitted', note: 'All documents received and verified' })
        .expect(200);

      expect(statusResponse.body.data.visaApplication.status).toBe('Submitted');
      expect(statusResponse.body.data.visaApplication.applicationNotes).toHaveLength(1);

      // Step 5: Final approval
      await request(app)
        .put(`/api/v1/products/visa/${applicationId}/status`)
        .set('Cookie', testAuth.createSignedCookieString(staffAuthToken))
        .send({ status: 'Approved', note: 'Visa application approved by embassy' })
        .expect(200);

      // Verify final state
      const finalResponse = await request(app)
        .get(`/api/v1/products/visa/${applicationId}`)
        .set('Cookie', testAuth.createSignedCookieString(authToken))
        .expect(200);

      expect(finalResponse.body.data.visaApplication.status).toBe('Approved');
      expect(finalResponse.body.data.visaApplication.applicationNotes).toHaveLength(2);
    });

    it('should complete full visa application workflow for guest user', async () => {
      // Step 1: Create guest visa application
      const guestApplicationData = {
        countryOfInterest: 'Canada',
        purposeOfTravel: 'Tourism',
        travelDates: {
          startDate: '2024-07-01',
          endDate: '2024-07-21'
        },
        personalInformation: {
          firstName: 'Guest',
          lastName: 'User',
          dateOfBirth: '1990-05-20',
          gender: 'Male',
          nationality: 'Nigerian',
          maritalStatus: 'Single',
          occupation: 'Teacher',
          address: '789 Education Lane, Abuja, Nigeria'
        },
        guestEmail: 'guest.user@example.com',
        guestPhoneNumber: '+2348123456789'
      };

      const createResponse = await request(app)
        .post('/api/v1/products/visa/apply')
        .send(guestApplicationData)
        .expect(201);

      const applicationId = createResponse.body.data.visaApplicationId;

      // Verify guest application was created
      const application = await VisaApplication.findById(applicationId);
      expect(application.guestEmail).toBe(guestApplicationData.guestEmail);
      expect(application.guestPhoneNumber).toBe(guestApplicationData.guestPhoneNumber);
      expect(application.userId).toBeUndefined();

      // Step 2: Staff can view and update guest application
      const statusResponse = await request(app)
        .put(`/api/v1/products/visa/${applicationId}/status`)
        .set('Cookie', testAuth.createSignedCookieString(staffAuthToken))
        .send({ status: 'Approved', note: 'Guest application approved' })
        .expect(200);

      expect(statusResponse.body.data.visaApplication.status).toBe('Approved');
    });

    it('should handle visa application rejection workflow', async () => {
      // Create application
      const applicationData = {
        countryOfInterest: 'United States',
        purposeOfTravel: 'Tourism',
        travelDates: {
          startDate: '2024-08-01',
          endDate: '2024-08-15'
        },
        personalInformation: {
          firstName: 'Test',
          lastName: 'Applicant',
          dateOfBirth: '1992-01-01',
          gender: 'Male',
          nationality: 'Nigerian',
          maritalStatus: 'Single',
          occupation: 'Engineer',
          address: '123 Test Street, Lagos, Nigeria'
        }
      };

      const createResponse = await request(app)
        .post('/api/v1/products/visa/apply')
        .set('Cookie', testAuth.createSignedCookieString(authToken))
        .send(applicationData)
        .expect(201);

      const applicationId = createResponse.body.data.visaApplicationId;

      // Upload incomplete documents
      const testFileBuffer = Buffer.from('incomplete document');
      await request(app)
        .post(`/api/v1/products/visa/${applicationId}/upload-document`)
        .set('Cookie', testAuth.createSignedCookieString(authToken))
        .field('documentType', 'International Passport')
        .attach('file', testFileBuffer, 'passport.jpg')
        .expect(200);

      // Staff rejects application
      const rejectionResponse = await request(app)
        .put(`/api/v1/products/visa/${applicationId}/status`)
        .set('Cookie', testAuth.createSignedCookieString(staffAuthToken))
        .send({ 
          status: 'Rejected', 
          note: 'Insufficient documentation provided. Please submit bank statements and flight itinerary.' 
        })
        .expect(200);

      expect(rejectionResponse.body.data.visaApplication.status).toBe('Rejected');
      expect(rejectionResponse.body.data.visaApplication.applicationNotes[0].note).toContain('Insufficient documentation');

      // Verify final rejected state
      const finalResponse = await request(app)
        .get(`/api/v1/products/visa/${applicationId}`)
        .set('Cookie', testAuth.createSignedCookieString(authToken))
        .expect(200);

      expect(finalResponse.body.data.visaApplication.status).toBe('Rejected');
    });
  });

  describe('Performance and Load Tests', () => {
    it('should handle multiple simultaneous visa applications', async () => {
      const applicationPromises = [];
      
      // Create 5 simultaneous applications
      for (let i = 0; i < 5; i++) {
        const applicationData = {
          countryOfInterest: `Country${i}`,
          purposeOfTravel: 'Tourism',
          travelDates: {
            startDate: '2024-12-01',
            endDate: '2024-12-15'
          },
          personalInformation: {
            firstName: `User${i}`,
            lastName: 'Test',
            dateOfBirth: '1990-01-01',
            gender: 'Male',
            nationality: 'Nigerian',
            maritalStatus: 'Single',
            occupation: 'Engineer',
            address: `${i} Test Street, Lagos, Nigeria`
          }
        };

        applicationPromises.push(
          request(app)
            .post('/api/v1/products/visa/apply')
            .set('Cookie', testAuth.createSignedCookieString(authToken))
            .send(applicationData)
        );
      }

      const responses = await Promise.all(applicationPromises);
      
      // All applications should be created successfully
      responses.forEach((response, index) => {
        expect(response.status).toBe(201);
        expect(response.body.data).toHaveProperty('visaApplicationId');
      });

      // Verify all applications exist in database
      const applications = await VisaApplication.find({ userId: testUser._id });
      expect(applications.length).toBeGreaterThanOrEqual(5);
    });

    it('should handle concurrent document uploads', async () => {
      const testVisaApplication = await VisaApplication.create({
        userId: testUser._id,
        countryOfInterest: 'Netherlands',
        purposeOfTravel: 'Tourism',
        status: 'Processing Documents'
      });

      // Simulate concurrent uploads
      const uploadPromises = [
        request(app)
          .post(`/api/v1/products/visa/${testVisaApplication._id}/upload-document`)
          .set('Cookie', testAuth.createSignedCookieString(authToken))
          .field('documentType', 'International Passport')
          .attach('file', Buffer.from('passport content'), 'passport.pdf'),
        
        request(app)
          .post(`/api/v1/products/visa/${testVisaApplication._id}/upload-document`)
          .set('Cookie', testAuth.createSignedCookieString(authToken))
          .field('documentType', 'Bank Statement')
          .attach('file', Buffer.from('bank statement content'), 'bank-statement.pdf'),
        
        request(app)
          .post(`/api/v1/products/visa/${testVisaApplication._id}/upload-document`)
          .set('Cookie', testAuth.createSignedCookieString(authToken))
          .field('documentType', 'Flight Itinerary')
          .attach('file', Buffer.from('flight itinerary content'), 'flight.pdf')
      ];

      const responses = await Promise.all(uploadPromises);
      
      // All uploads should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Verify all documents were uploaded
      const updatedApplication = await VisaApplication.findById(testVisaApplication._id);
      expect(updatedApplication.documents).toHaveLength(3);
    });
  });
});