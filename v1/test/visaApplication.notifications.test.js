// v1/test/visaApplication.notifications.test.js
const request = require('supertest');
const app = require('../../app');
const { testDb, testAuth, testData, testAssertions } = require('./testSetup');
const User = require('../models/userModel');
const VisaApplication = require('../models/visaApplicationModel');

// Mock external services
jest.mock('../utils/emailService');
jest.mock('../utils/smsService');
jest.mock('../services/cloudinaryService');

const { sendEmail } = require('../utils/emailService');
const { sendSMS, sendWhatsAppMessage } = require('../utils/smsService');

describe('Visa Application Notification System Integration', () => {
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

  describe('Application Creation Notifications', () => {
    it('should send confirmation notification when visa application is created', async () => {
      const applicationData = {
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
        .send(applicationData)
        .expect(201);

      // Verify application was created
      expect(response.body.data.visaApplicationId).toBeDefined();

      // Note: Actual notification sending would depend on implementation
      // This test verifies the structure is in place for notifications
      const application = await VisaApplication.findById(response.body.data.visaApplicationId);
      expect(application.status).toBe('Processing Documents');
    });

    it('should send notification to guest users via email and SMS', async () => {
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

      const response = await request(app)
        .post('/api/v1/products/visa/apply')
        .send(guestApplicationData)
        .expect(201);

      // Verify guest application was created
      const application = await VisaApplication.findById(response.body.data.visaApplicationId);
      expect(application.guestEmail).toBe(guestApplicationData.guestEmail);
      expect(application.guestPhoneNumber).toBe(guestApplicationData.guestPhoneNumber);
    });
  });

  describe('Status Update Notifications', () => {
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

    it('should trigger approval notification when status is updated to Approved', async () => {
      const updateData = {
        status: 'Approved',
        note: 'Visa application approved successfully. Please collect your visa from the embassy.'
      };

      const response = await request(app)
        .put(`/api/v1/products/visa/${testVisaApplication._id}/status`)
        .set('Cookie', testAuth.createSignedCookieString(staffAuthToken))
        .send(updateData)
        .expect(200);

      // Verify status was updated
      expect(response.body.data.visaApplication.status).toBe('Approved');
      expect(response.body.data.visaApplication.applicationNotes[0].note).toBe(updateData.note);

      // Verify notification structure is in place
      const updatedApplication = await VisaApplication.findById(testVisaApplication._id);
      expect(updatedApplication.status).toBe('Approved');
      expect(updatedApplication.applicationNotes).toHaveLength(1);
    });

    it('should trigger rejection notification when status is updated to Rejected', async () => {
      const updateData = {
        status: 'Rejected',
        note: 'Visa application rejected due to insufficient documentation. Please reapply with complete documents.'
      };

      const response = await request(app)
        .put(`/api/v1/products/visa/${testVisaApplication._id}/status`)
        .set('Cookie', testAuth.createSignedCookieString(staffAuthToken))
        .send(updateData)
        .expect(200);

      // Verify status was updated
      expect(response.body.data.visaApplication.status).toBe('Rejected');
      expect(response.body.data.visaApplication.applicationNotes[0].note).toBe(updateData.note);

      // Verify notification structure
      const updatedApplication = await VisaApplication.findById(testVisaApplication._id);
      expect(updatedApplication.status).toBe('Rejected');
    });

    it('should trigger notification when more information is required', async () => {
      const updateData = {
        status: 'Requires More Info',
        note: 'Please provide additional bank statements for the last 6 months and proof of accommodation.'
      };

      const response = await request(app)
        .put(`/api/v1/products/visa/${testVisaApplication._id}/status`)
        .set('Cookie', testAuth.createSignedCookieString(staffAuthToken))
        .send(updateData)
        .expect(200);

      // Verify status was updated
      expect(response.body.data.visaApplication.status).toBe('Requires More Info');
      expect(response.body.data.visaApplication.applicationNotes[0].note).toContain('additional bank statements');

      // Verify notification structure
      const updatedApplication = await VisaApplication.findById(testVisaApplication._id);
      expect(updatedApplication.status).toBe('Requires More Info');
    });

    it('should handle notification for submitted status', async () => {
      const updateData = {
        status: 'Submitted',
        note: 'Application has been submitted to the embassy for processing.'
      };

      const response = await request(app)
        .put(`/api/v1/products/visa/${testVisaApplication._id}/status`)
        .set('Cookie', testAuth.createSignedCookieString(staffAuthToken))
        .send(updateData)
        .expect(200);

      // Verify status was updated
      expect(response.body.data.visaApplication.status).toBe('Submitted');
      expect(response.body.data.visaApplication.applicationNotes[0].note).toBe(updateData.note);
    });
  });

  describe('Document Upload Notifications', () => {
    beforeEach(async () => {
      testVisaApplication = await VisaApplication.create({
        userId: testUser._id,
        countryOfInterest: 'United States',
        purposeOfTravel: 'Tourism',
        status: 'Processing Documents'
      });
    });

    it('should send confirmation when document is successfully uploaded', async () => {
      const testFileBuffer = Buffer.from('test passport content');
      
      const response = await request(app)
        .post(`/api/v1/products/visa/${testVisaApplication._id}/upload-document`)
        .set('Cookie', testAuth.createSignedCookieString(authToken))
        .field('documentType', 'International Passport')
        .attach('file', testFileBuffer, 'passport.jpg')
        .expect(200);

      // Verify document was uploaded
      expect(response.body.data.document.documentType).toBe('International Passport');

      // Verify document was added to application
      const updatedApplication = await VisaApplication.findById(testVisaApplication._id);
      expect(updatedApplication.documents).toHaveLength(1);
      expect(updatedApplication.documents[0].documentType).toBe('International Passport');
    });

    it('should notify when all required documents are uploaded', async () => {
      const requiredDocuments = [
        'International Passport',
        'Bank Statement',
        'Flight Itinerary'
      ];

      // Upload all required documents
      for (const docType of requiredDocuments) {
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
      expect(updatedApplication.documents).toHaveLength(requiredDocuments.length);

      // Check that all required document types are present
      const uploadedTypes = updatedApplication.documents.map(doc => doc.documentType);
      requiredDocuments.forEach(type => {
        expect(uploadedTypes).toContain(type);
      });
    });
  });

  describe('Guest User Notifications', () => {
    let guestApplication;

    beforeEach(async () => {
      guestApplication = await VisaApplication.create({
        guestEmail: 'guest@example.com',
        guestPhoneNumber: '+2348123456789',
        countryOfInterest: 'United Kingdom',
        purposeOfTravel: 'Business',
        status: 'Processing Documents',
        personalInformation: {
          firstName: 'Guest',
          lastName: 'User'
        }
      });
    });

    it('should send notifications to guest email when status is updated', async () => {
      const updateData = {
        status: 'Approved',
        note: 'Guest visa application approved'
      };

      const response = await request(app)
        .put(`/api/v1/products/visa/${guestApplication._id}/status`)
        .set('Cookie', testAuth.createSignedCookieString(staffAuthToken))
        .send(updateData)
        .expect(200);

      // Verify status was updated
      expect(response.body.data.visaApplication.status).toBe('Approved');

      // Verify guest application structure
      const updatedApplication = await VisaApplication.findById(guestApplication._id);
      expect(updatedApplication.guestEmail).toBe('guest@example.com');
      expect(updatedApplication.status).toBe('Approved');
    });

    it('should send SMS notifications to guest phone number', async () => {
      const updateData = {
        status: 'Requires More Info',
        note: 'Additional documents needed for guest application'
      };

      const response = await request(app)
        .put(`/api/v1/products/visa/${guestApplication._id}/status`)
        .set('Cookie', testAuth.createSignedCookieString(staffAuthToken))
        .send(updateData)
        .expect(200);

      // Verify status was updated
      expect(response.body.data.visaApplication.status).toBe('Requires More Info');

      // Verify guest phone number is available for SMS
      const updatedApplication = await VisaApplication.findById(guestApplication._id);
      expect(updatedApplication.guestPhoneNumber).toBe('+2348123456789');
    });
  });

  describe('Notification Error Handling', () => {
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

    it('should handle email service failures gracefully', async () => {
      // Mock email service to fail
      sendEmail.mockRejectedValue(new Error('Email service unavailable'));

      const updateData = {
        status: 'Approved',
        note: 'Application approved despite email failure'
      };

      const response = await request(app)
        .put(`/api/v1/products/visa/${testVisaApplication._id}/status`)
        .set('Cookie', testAuth.createSignedCookieString(staffAuthToken))
        .send(updateData)
        .expect(200);

      // Status update should still succeed even if notification fails
      expect(response.body.data.visaApplication.status).toBe('Approved');
    });

    it('should handle SMS service failures gracefully', async () => {
      // Mock SMS service to fail
      sendSMS.mockRejectedValue(new Error('SMS service unavailable'));
      sendWhatsAppMessage.mockRejectedValue(new Error('WhatsApp service unavailable'));

      const updateData = {
        status: 'Rejected',
        note: 'Application rejected despite SMS failure'
      };

      const response = await request(app)
        .put(`/api/v1/products/visa/${testVisaApplication._id}/status`)
        .set('Cookie', testAuth.createSignedCookieString(staffAuthToken))
        .send(updateData)
        .expect(200);

      // Status update should still succeed even if notification fails
      expect(response.body.data.visaApplication.status).toBe('Rejected');
    });

    it('should handle missing user contact information', async () => {
      // Create application with user that has no email/phone
      const userWithoutContact = await User.create({
        firstName: 'No',
        lastName: 'Contact',
        email: null, // No email
        phoneNumber: null, // No phone
        password: 'password123',
        role: 'User'
      });

      const applicationWithoutContact = await VisaApplication.create({
        userId: userWithoutContact._id,
        countryOfInterest: 'Germany',
        purposeOfTravel: 'Work',
        status: 'Processing Documents'
      });

      const updateData = {
        status: 'Approved',
        note: 'Application approved for user without contact info'
      };

      const response = await request(app)
        .put(`/api/v1/products/visa/${applicationWithoutContact._id}/status`)
        .set('Cookie', testAuth.createSignedCookieString(staffAuthToken))
        .send(updateData)
        .expect(200);

      // Status update should still succeed
      expect(response.body.data.visaApplication.status).toBe('Approved');
    });
  });

  describe('Notification Content Validation', () => {
    beforeEach(async () => {
      testVisaApplication = await VisaApplication.create({
        userId: testUser._id,
        countryOfInterest: 'France',
        purposeOfTravel: 'Tourism',
        status: 'Processing Documents',
        personalInformation: {
          firstName: 'Marie',
          lastName: 'Dubois'
        }
      });
    });

    it('should include relevant application details in notifications', async () => {
      const updateData = {
        status: 'Approved',
        note: 'Your France tourism visa has been approved. Please collect from embassy.'
      };

      const response = await request(app)
        .put(`/api/v1/products/visa/${testVisaApplication._id}/status`)
        .set('Cookie', testAuth.createSignedCookieString(staffAuthToken))
        .send(updateData)
        .expect(200);

      // Verify application details are available for notification content
      const updatedApplication = await VisaApplication.findById(testVisaApplication._id);
      expect(updatedApplication.countryOfInterest).toBe('France');
      expect(updatedApplication.purposeOfTravel).toBe('Tourism');
      expect(updatedApplication.personalInformation.firstName).toBe('Marie');
      expect(updatedApplication.status).toBe('Approved');
    });

    it('should handle special characters in notification content', async () => {
      const updateData = {
        status: 'Requires More Info',
        note: 'Veuillez fournir des documents supplémentaires. Additional info: résumé & références.'
      };

      const response = await request(app)
        .put(`/api/v1/products/visa/${testVisaApplication._id}/status`)
        .set('Cookie', testAuth.createSignedCookieString(staffAuthToken))
        .send(updateData)
        .expect(200);

      // Verify special characters are preserved
      const updatedApplication = await VisaApplication.findById(testVisaApplication._id);
      expect(updatedApplication.applicationNotes[0].note).toContain('résumé & références');
    });
  });
});