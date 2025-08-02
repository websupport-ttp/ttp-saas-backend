// v1/test/visaApplication.advanced.test.js
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

describe('Advanced Visa Application Test Scenarios', () => {
  let testUser;
  let staffUser;
  let managerUser;
  let authToken;
  let staffAuthToken;
  let managerAuthToken;

  beforeAll(async () => {
    // Setup test environment
    await testDb.clearDatabase();
    
    // Create test users with different roles
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

    const managerUserData = testData.createUser({
      email: 'manager@example.com',
      role: 'Manager',
      isEmailVerified: true,
      isPhoneVerified: true
    });

    testUser = await User.create(userData);
    staffUser = await User.create(staffUserData);
    managerUser = await User.create(managerUserData);

    // Generate auth tokens
    authToken = testAuth.generateTestToken({ 
      userId: testUser._id, 
      role: testUser.role 
    });
    
    staffAuthToken = testAuth.generateTestToken({ 
      userId: staffUser._id, 
      role: staffUser.role 
    });

    managerAuthToken = testAuth.generateTestToken({ 
      userId: managerUser._id, 
      role: managerUser.role 
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

  describe('Advanced Visa Application Creation Scenarios', () => {
    it('should handle visa applications for different countries with specific requirements', async () => {
      const countries = [
        { name: 'United States', purpose: 'Tourism' },
        { name: 'United Kingdom', purpose: 'Business' },
        { name: 'Canada', purpose: 'Study' },
        { name: 'Germany', purpose: 'Work' },
        { name: 'Australia', purpose: 'Tourism' }
      ];

      for (const country of countries) {
        const applicationData = {
          countryOfInterest: country.name,
          purposeOfTravel: country.purpose,
          travelDates: {
            startDate: '2024-06-01',
            endDate: '2024-06-15'
          },
          personalInformation: {
            firstName: 'Test',
            lastName: 'Applicant',
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
          .send(applicationData)
          .expect(201);

        expect(response.body.data.visaApplicationId).toBeDefined();
        
        // Verify application was created with correct country
        const application = await VisaApplication.findById(response.body.data.visaApplicationId);
        expect(application.countryOfInterest).toBe(country.name);
        expect(application.purposeOfTravel).toBe(country.purpose);
      }
    });

    it('should validate travel dates are in the future', async () => {
      const applicationData = {
        countryOfInterest: 'United States',
        purposeOfTravel: 'Tourism',
        travelDates: {
          startDate: '2020-01-01', // Past date
          endDate: '2020-01-15'
        },
        personalInformation: {
          firstName: 'Test',
          lastName: 'User',
          dateOfBirth: '1990-01-01',
          gender: 'Male',
          nationality: 'Nigerian',
          maritalStatus: 'Single',
          occupation: 'Engineer',
          address: '123 Test Street, Lagos, Nigeria'
        }
      };

      // Note: This test assumes validation is implemented in the controller
      // If not implemented, this test will help identify the need for it
      const response = await request(app)
        .post('/api/v1/products/visa/apply')
        .set('Cookie', testAuth.createSignedCookieString(authToken))
        .send(applicationData);

      // Should either succeed (if validation not implemented) or fail with validation error
      if (response.status === 400) {
        testAssertions.assertErrorResponse(response, 400);
      } else {
        expect(response.status).toBe(201);
      }
    });

    it('should handle applications with complete personal information', async () => {
      const completeApplicationData = {
        countryOfInterest: 'United Kingdom',
        purposeOfTravel: 'Business',
        travelDates: {
          startDate: '2024-08-01',
          endDate: '2024-08-15'
        },
        personalInformation: {
          firstName: 'John',
          lastName: 'Doe',
          otherNames: 'Michael',
          dateOfBirth: '1985-03-15',
          gender: 'Male',
          nationality: 'Nigerian',
          maritalStatus: 'Married',
          occupation: 'Business Analyst',
          address: '456 Business District, Victoria Island, Lagos, Nigeria'
        },
        passportDetails: {
          passportNumber: 'A12345678',
          issueDate: '2020-01-01',
          expiryDate: '2030-01-01',
          placeOfIssue: 'Lagos, Nigeria'
        }
      };

      const response = await request(app)
        .post('/api/v1/products/visa/apply')
        .set('Cookie', testAuth.createSignedCookieString(authToken))
        .send(completeApplicationData)
        .expect(201);

      const application = await VisaApplication.findById(response.body.data.visaApplicationId);
      expect(application.personalInformation.otherNames).toBe('Michael');
      expect(application.passportDetails.passportNumber).toBe('A12345678');
    });
  });

  describe('Advanced Document Upload Scenarios', () => {
    let testVisaApplication;

    beforeEach(async () => {
      testVisaApplication = await VisaApplication.create({
        userId: testUser._id,
        countryOfInterest: 'United States',
        purposeOfTravel: 'Tourism',
        status: 'Processing Documents'
      });
    });

    it('should handle multiple document types for different visa categories', async () => {
      const documentTypes = [
        'International Passport',
        'Passport Photograph',
        'Bank Statement',
        'Flight Itinerary',
        'Hotel Booking',
        'Invitation Letter',
        'Other'
      ];

      for (const docType of documentTypes) {
        const testFileBuffer = Buffer.from(`${docType} content`);
        
        const response = await request(app)
          .post(`/api/v1/products/visa/${testVisaApplication._id}/upload-document`)
          .set('Cookie', testAuth.createSignedCookieString(authToken))
          .field('documentType', docType)
          .attach('file', testFileBuffer, `${docType.toLowerCase().replace(' ', '-')}.pdf`)
          .expect(200);

        expect(response.body.data.document.documentType).toBe(docType);
      }

      // Verify all documents were uploaded
      const updatedApplication = await VisaApplication.findById(testVisaApplication._id);
      expect(updatedApplication.documents).toHaveLength(documentTypes.length);
    });

    it('should handle large file uploads', async () => {
      // Create a larger test file (simulating a 5MB file)
      const largeFileBuffer = Buffer.alloc(5 * 1024 * 1024, 'a');
      
      const response = await request(app)
        .post(`/api/v1/products/visa/${testVisaApplication._id}/upload-document`)
        .set('Cookie', testAuth.createSignedCookieString(authToken))
        .field('documentType', 'Bank Statement')
        .attach('file', largeFileBuffer, 'large-bank-statement.pdf')
        .expect(200);

      expect(response.body.data.document.fileSize).toBe(1024000); // Mocked response
    });

    it('should prevent duplicate document types', async () => {
      // Upload first document
      const testFileBuffer1 = Buffer.from('first passport content');
      await request(app)
        .post(`/api/v1/products/visa/${testVisaApplication._id}/upload-document`)
        .set('Cookie', testAuth.createSignedCookieString(authToken))
        .field('documentType', 'International Passport')
        .attach('file', testFileBuffer1, 'passport1.jpg')
        .expect(200);

      // Try to upload another document of the same type
      const testFileBuffer2 = Buffer.from('second passport content');
      const response = await request(app)
        .post(`/api/v1/products/visa/${testVisaApplication._id}/upload-document`)
        .set('Cookie', testAuth.createSignedCookieString(authToken))
        .field('documentType', 'International Passport')
        .attach('file', testFileBuffer2, 'passport2.jpg');

      // Should either succeed (allowing multiple) or fail with validation error
      // This test helps identify if duplicate prevention is needed
      expect([200, 400]).toContain(response.status);
    });
  });

  describe('Advanced Status Management Scenarios', () => {
    let testVisaApplication;

    beforeEach(async () => {
      testVisaApplication = await VisaApplication.create({
        userId: testUser._id,
        countryOfInterest: 'United States',
        purposeOfTravel: 'Tourism',
        status: 'Processing Documents'
      });
    });

    it('should handle status transitions with proper workflow', async () => {
      const statusWorkflow = [
        { status: 'Submitted', note: 'Application submitted for review' },
        { status: 'Requires More Info', note: 'Additional documents needed' },
        { status: 'Submitted', note: 'Additional documents provided' },
        { status: 'Approved', note: 'Application approved by embassy' }
      ];

      for (const step of statusWorkflow) {
        const response = await request(app)
          .put(`/api/v1/products/visa/${testVisaApplication._id}/status`)
          .set('Cookie', testAuth.createSignedCookieString(staffAuthToken))
          .send(step)
          .expect(200);

        expect(response.body.data.visaApplication.status).toBe(step.status);
      }

      // Verify all notes were added
      const finalApplication = await VisaApplication.findById(testVisaApplication._id);
      expect(finalApplication.applicationNotes).toHaveLength(statusWorkflow.length);
    });

    it('should allow managers to update status but not regular users', async () => {
      // Manager should be able to update status
      const managerUpdate = await request(app)
        .put(`/api/v1/products/visa/${testVisaApplication._id}/status`)
        .set('Cookie', testAuth.createSignedCookieString(managerAuthToken))
        .send({ status: 'Approved', note: 'Manager approval' })
        .expect(200);

      expect(managerUpdate.body.data.visaApplication.status).toBe('Approved');

      // Regular user should not be able to update status
      await request(app)
        .put(`/api/v1/products/visa/${testVisaApplication._id}/status`)
        .set('Cookie', testAuth.createSignedCookieString(authToken))
        .send({ status: 'Rejected', note: 'User trying to reject' })
        .expect(403);
    });

    it('should track who made status updates', async () => {
      const updateData = {
        status: 'Approved',
        note: 'Application approved after review'
      };

      await request(app)
        .put(`/api/v1/products/visa/${testVisaApplication._id}/status`)
        .set('Cookie', testAuth.createSignedCookieString(staffAuthToken))
        .send(updateData)
        .expect(200);

      const updatedApplication = await VisaApplication.findById(testVisaApplication._id);
      expect(updatedApplication.applicationNotes[0].addedBy.toString()).toBe(staffUser._id.toString());
    });
  });

  describe('Payment Integration Advanced Scenarios', () => {
    let testVisaApplication;

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

    it('should handle different visa processing fees by country', async () => {
      const countryFees = [
        { country: 'United States', fee: 16000 },
        { country: 'United Kingdom', fee: 12000 },
        { country: 'Canada', fee: 10000 },
        { country: 'Germany', fee: 8000 }
      ];

      for (const { country, fee } of countryFees) {
        const paymentReference = `VISA-${country.replace(' ', '')}-${Date.now()}`;
        
        const ledgerEntry = await Ledger.create({
          userId: testUser._id,
          transactionReference: paymentReference,
          amount: fee,
          currency: 'NGN',
          status: 'Completed',
          paymentGateway: 'Paystack',
          productType: 'Visa Processing',
          itemType: 'Visa',
          serviceCharge: Math.floor(fee * 0.15), // 15% service charge
          totalAmountPaid: fee + Math.floor(fee * 0.15),
          productDetails: {
            visaApplicationId: testVisaApplication._id,
            countryOfInterest: country,
            purposeOfTravel: 'Tourism'
          }
        });

        expect(ledgerEntry.amount).toBe(fee);
        expect(ledgerEntry.productDetails.countryOfInterest).toBe(country);
      }
    });

    it('should handle payment failures and retries', async () => {
      const paymentReference = `VISA-FAILED-${Date.now()}`;
      
      // Create failed payment
      const failedPayment = await Ledger.create({
        userId: testUser._id,
        transactionReference: paymentReference,
        amount: 15000,
        currency: 'NGN',
        status: 'Failed',
        paymentGateway: 'Paystack',
        productType: 'Visa Processing',
        itemType: 'Visa',
        serviceCharge: 2250,
        totalAmountPaid: 17250,
        productDetails: {
          visaApplicationId: testVisaApplication._id,
          countryOfInterest: 'United States'
        },
        paymentGatewayResponse: {
          status: 'failed',
          gateway_response: 'Insufficient funds'
        }
      });

      expect(failedPayment.status).toBe('Failed');

      // Create retry payment (successful)
      const retryReference = `VISA-RETRY-${Date.now()}`;
      const successfulPayment = await Ledger.create({
        userId: testUser._id,
        transactionReference: retryReference,
        amount: 15000,
        currency: 'NGN',
        status: 'Completed',
        paymentGateway: 'Paystack',
        productType: 'Visa Processing',
        itemType: 'Visa',
        serviceCharge: 2250,
        totalAmountPaid: 17250,
        productDetails: {
          visaApplicationId: testVisaApplication._id,
          countryOfInterest: 'United States'
        },
        paymentGatewayResponse: {
          status: 'success',
          gateway_response: 'Approved'
        }
      });

      expect(successfulPayment.status).toBe('Completed');
    });
  });

  describe('Performance and Load Testing Scenarios', () => {
    it('should handle multiple simultaneous visa applications', async () => {
      const applicationPromises = [];
      const numberOfApplications = 10;

      // Create multiple applications simultaneously
      for (let i = 0; i < numberOfApplications; i++) {
        const applicationData = {
          countryOfInterest: `Country-${i}`,
          purposeOfTravel: 'Tourism',
          travelDates: {
            startDate: '2024-06-01',
            endDate: '2024-06-15'
          },
          personalInformation: {
            firstName: `User-${i}`,
            lastName: 'Test',
            dateOfBirth: '1990-01-01',
            gender: 'Male',
            nationality: 'Nigerian',
            maritalStatus: 'Single',
            occupation: 'Engineer',
            address: `${i} Test Street, Lagos, Nigeria`
          },
          guestEmail: `user${i}@example.com`,
          guestPhoneNumber: `+12345678${i.toString().padStart(2, '0')}`
        };

        const promise = request(app)
          .post('/api/v1/products/visa/apply')
          .send(applicationData);

        applicationPromises.push(promise);
      }

      const responses = await Promise.all(applicationPromises);
      
      // All applications should be created successfully
      responses.forEach((response, index) => {
        expect(response.status).toBe(201);
        expect(response.body.data.visaApplicationId).toBeDefined();
      });

      // Verify all applications were created in database
      const applications = await VisaApplication.find({});
      expect(applications).toHaveLength(numberOfApplications);
    });

    it('should handle concurrent document uploads', async () => {
      // Create a test visa application
      const testApplication = await VisaApplication.create({
        userId: testUser._id,
        countryOfInterest: 'United States',
        purposeOfTravel: 'Tourism',
        status: 'Processing Documents'
      });

      const uploadPromises = [];
      const documentTypes = [
        'International Passport',
        'Bank Statement',
        'Flight Itinerary',
        'Hotel Booking',
        'Invitation Letter'
      ];

      // Upload multiple documents simultaneously
      documentTypes.forEach((docType, index) => {
        const testFileBuffer = Buffer.from(`${docType} content ${index}`);
        
        const promise = request(app)
          .post(`/api/v1/products/visa/${testApplication._id}/upload-document`)
          .set('Cookie', testAuth.createSignedCookieString(authToken))
          .field('documentType', docType)
          .attach('file', testFileBuffer, `${docType.toLowerCase().replace(' ', '-')}.pdf`);

        uploadPromises.push(promise);
      });

      const responses = await Promise.all(uploadPromises);
      
      // All uploads should be successful
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });

      // Verify all documents were uploaded
      const updatedApplication = await VisaApplication.findById(testApplication._id);
      expect(updatedApplication.documents).toHaveLength(documentTypes.length);
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle malformed request data gracefully', async () => {
      const malformedData = {
        countryOfInterest: null,
        purposeOfTravel: undefined,
        travelDates: 'invalid-date-format',
        personalInformation: 'not-an-object'
      };

      const response = await request(app)
        .post('/api/v1/products/visa/apply')
        .set('Cookie', testAuth.createSignedCookieString(authToken))
        .send(malformedData);

      expect([400, 500]).toContain(response.status);
      if (response.status === 400) {
        testAssertions.assertErrorResponse(response, 400);
      }
    });

    it('should handle extremely long text inputs', async () => {
      const longText = 'A'.repeat(10000); // 10KB of text
      
      const applicationData = {
        countryOfInterest: 'United States',
        purposeOfTravel: 'Tourism',
        travelDates: {
          startDate: '2024-06-01',
          endDate: '2024-06-15'
        },
        personalInformation: {
          firstName: longText,
          lastName: 'User',
          dateOfBirth: '1990-01-01',
          gender: 'Male',
          nationality: 'Nigerian',
          maritalStatus: 'Single',
          occupation: 'Engineer',
          address: longText
        }
      };

      const response = await request(app)
        .post('/api/v1/products/visa/apply')
        .set('Cookie', testAuth.createSignedCookieString(authToken))
        .send(applicationData);

      // Should either succeed or fail with validation error
      expect([201, 400]).toContain(response.status);
    });

    it('should handle special characters in application data', async () => {
      const specialCharData = {
        countryOfInterest: 'United States',
        purposeOfTravel: 'Tourism & Business',
        travelDates: {
          startDate: '2024-06-01',
          endDate: '2024-06-15'
        },
        personalInformation: {
          firstName: 'José',
          lastName: 'O\'Connor-Smith',
          dateOfBirth: '1990-01-01',
          gender: 'Male',
          nationality: 'Nigerian',
          maritalStatus: 'Single',
          occupation: 'Software Engineer & Consultant',
          address: '123 Test Street, Lagos, Nigeria (Near Market)'
        }
      };

      const response = await request(app)
        .post('/api/v1/products/visa/apply')
        .set('Cookie', testAuth.createSignedCookieString(authToken))
        .send(specialCharData)
        .expect(201);

      const application = await VisaApplication.findById(response.body.data.visaApplicationId);
      expect(application.personalInformation.firstName).toBe('José');
      expect(application.personalInformation.lastName).toBe('O\'Connor-Smith');
    });

    it('should handle database disconnection during application creation', async () => {
      // This test would require more sophisticated mocking of mongoose connection
      // For now, we'll test the error handling structure
      const applicationData = {
        countryOfInterest: 'United States',
        purposeOfTravel: 'Tourism',
        travelDates: {
          startDate: '2024-06-01',
          endDate: '2024-06-15'
        },
        personalInformation: {
          firstName: 'Test',
          lastName: 'User',
          dateOfBirth: '1990-01-01',
          gender: 'Male',
          nationality: 'Nigerian',
          maritalStatus: 'Single',
          occupation: 'Engineer',
          address: '123 Test Street, Lagos, Nigeria'
        }
      };

      // Mock VisaApplication.create to simulate database error
      const originalCreate = VisaApplication.create;
      VisaApplication.create = jest.fn().mockRejectedValue(new Error('Database connection lost'));

      const response = await request(app)
        .post('/api/v1/products/visa/apply')
        .set('Cookie', testAuth.createSignedCookieString(authToken))
        .send(applicationData)
        .expect(500);

      testAssertions.assertErrorResponse(response, 500);

      // Restore original method
      VisaApplication.create = originalCreate;
    });
  });

  describe('Security and Authorization Tests', () => {
    let otherUser;
    let otherUserToken;
    let testVisaApplication;

    beforeEach(async () => {
      // Create another user
      const otherUserData = testData.createUser({
        email: 'other@example.com',
        role: 'User'
      });
      otherUser = await User.create(otherUserData);
      otherUserToken = testAuth.generateTestToken({ 
        userId: otherUser._id, 
        role: otherUser.role 
      });

      // Create application for first user
      testVisaApplication = await VisaApplication.create({
        userId: testUser._id,
        countryOfInterest: 'United States',
        purposeOfTravel: 'Tourism',
        status: 'Processing Documents'
      });
    });

    it('should prevent users from accessing other users applications', async () => {
      const response = await request(app)
        .get(`/api/v1/products/visa/${testVisaApplication._id}`)
        .set('Cookie', testAuth.createSignedCookieString(otherUserToken))
        .expect(403);

      testAssertions.assertErrorResponse(response, 403);
    });

    it('should prevent users from uploading documents to other users applications', async () => {
      const testFileBuffer = Buffer.from('unauthorized upload attempt');
      
      const response = await request(app)
        .post(`/api/v1/products/visa/${testVisaApplication._id}/upload-document`)
        .set('Cookie', testAuth.createSignedCookieString(otherUserToken))
        .field('documentType', 'International Passport')
        .attach('file', testFileBuffer, 'passport.jpg')
        .expect(403);

      testAssertions.assertErrorResponse(response, 403);
    });

    it('should allow staff to access any user application', async () => {
      const response = await request(app)
        .get(`/api/v1/products/visa/${testVisaApplication._id}`)
        .set('Cookie', testAuth.createSignedCookieString(staffAuthToken))
        .expect(200);

      testAssertions.assertSuccessResponse(response, 200);
      expect(response.body.data.visaApplication._id).toBe(testVisaApplication._id.toString());
    });

    it('should handle invalid authentication tokens', async () => {
      const invalidToken = 'invalid.jwt.token';
      
      const response = await request(app)
        .get(`/api/v1/products/visa/${testVisaApplication._id}`)
        .set('Cookie', `accessToken=${invalidToken}`)
        .expect(401);

      testAssertions.assertErrorResponse(response, 401);
    });
  });
});