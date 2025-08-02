// v1/test/visa.application.complete.test.js
const request = require('supertest');
const app = require('../../app');
const VisaApplication = require('../models/visaApplicationModel');
const User = require('../models/userModel');
const Ledger = require('../models/ledgerModel');

describe('Complete Visa Application Workflow', () => {
  let testUser;
  let authToken;
  let visaApplication;

  beforeEach(async () => {
    // Create a test user
    testUser = await User.create({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      password: 'password123',
      phoneNumber: '+2348123456789',
      role: 'User',
      isEmailVerified: true
    });

    // Mock auth token
    authToken = 'test-auth-token';
  });

  describe('POST /api/v1/products/visa/apply', () => {
    it('should create a visa application with proper fee calculation', async () => {
      const visaApplicationData = {
        destinationCountry: 'United States',
        visaType: 'Tourist',
        travelPurpose: 'Vacation and sightseeing',
        urgency: 'Standard',
        personalInformation: {
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1990-01-01',
          gender: 'Male',
          nationality: 'Nigerian',
          maritalStatus: 'Single',
          occupation: 'Software Engineer',
          address: '123 Main Street, Lagos, Nigeria'
        },
        travelDates: {
          startDate: '2024-06-01',
          endDate: '2024-06-15'
        },
        passportDetails: {
          passportNumber: 'A12345678',
          issueDate: '2020-01-01',
          expiryDate: '2030-01-01',
          placeOfIssue: 'Lagos'
        }
      };

      const response = await request(app)
        .post('/api/v1/products/visa/apply')
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User', email: testUser.email }))
        .send(visaApplicationData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.visaApplication).toBeDefined();
      expect(response.body.data.visaApplication.destinationCountry).toBe('United States');
      expect(response.body.data.visaApplication.visaType).toBe('Tourist');
      expect(response.body.data.visaApplication.fees).toBeDefined();
      expect(response.body.data.visaApplication.fees.total).toBeGreaterThan(0);
      expect(response.body.data.visaApplication.applicationReference).toBeDefined();
      expect(response.body.data.visaApplication.status).toBe('Pending');
      expect(response.body.data.visaApplication.paymentStatus).toBe('Pending');

      // Store for subsequent tests
      visaApplication = response.body.data.visaApplication;
    });

    it('should create a guest visa application', async () => {
      const guestVisaApplicationData = {
        destinationCountry: 'United Kingdom',
        visaType: 'Business',
        travelPurpose: 'Business meeting',
        urgency: 'Express',
        guestEmail: 'guest@example.com',
        guestPhoneNumber: '+2348987654321',
        personalInformation: {
          firstName: 'Jane',
          lastName: 'Smith',
          dateOfBirth: '1985-05-15',
          gender: 'Female',
          nationality: 'Nigerian',
          maritalStatus: 'Married',
          occupation: 'Business Analyst',
          address: '456 Business Ave, Abuja, Nigeria'
        }
      };

      const response = await request(app)
        .post('/api/v1/products/visa/apply')
        .send(guestVisaApplicationData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.visaApplication.destinationCountry).toBe('United Kingdom');
      expect(response.body.data.visaApplication.visaType).toBe('Business');
      expect(response.body.data.visaApplication.urgency).toBe('Express');
      expect(response.body.data.visaApplication.fees.urgencyFee).toBeGreaterThan(0);
    });

    it('should validate required fields', async () => {
      const invalidData = {
        destinationCountry: 'US', // Too short
        visaType: 'InvalidType',
        personalInformation: {
          firstName: 'J', // Too short
          lastName: 'D', // Too short
          dateOfBirth: 'invalid-date',
          gender: 'InvalidGender',
          nationality: 'N', // Too short
          maritalStatus: 'InvalidStatus',
          occupation: 'E', // Too short
          address: 'Short' // Too short
        }
      };

      const response = await request(app)
        .post('/api/v1/products/visa/apply')
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('validation');
    });
  });

  describe('GET /api/v1/products/visa/:id', () => {
    beforeEach(async () => {
      // Create a visa application for testing
      visaApplication = await VisaApplication.create({
        userId: testUser._id,
        destinationCountry: 'Canada',
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
    });

    it('should get visa application details for authorized user', async () => {
      const response = await request(app)
        .get(`/api/v1/products/visa/${visaApplication._id}`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.visaApplication).toBeDefined();
      expect(response.body.data.visaApplication.destinationCountry).toBe('Canada');
      expect(response.body.data.visaApplication.visaType).toBe('Tourist');
    });

    it('should not allow unauthorized access', async () => {
      const otherUser = await User.create({
        firstName: 'Other',
        lastName: 'User',
        email: 'other@example.com',
        password: 'password123',
        phoneNumber: '+2348111111111',
        role: 'User'
      });

      const response = await request(app)
        .get(`/api/v1/products/visa/${visaApplication._id}`)
        .set('x-test-user', JSON.stringify({ userId: otherUser._id.toString(), role: 'User' }))
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Unauthorized');
    });
  });

  describe('PUT /api/v1/products/visa/:id/status', () => {
    let staffUser;

    beforeEach(async () => {
      // Create a staff user
      staffUser = await User.create({
        firstName: 'Staff',
        lastName: 'Member',
        email: 'staff@example.com',
        password: 'password123',
        phoneNumber: '+2348222222222',
        role: 'Staff'
      });

      // Create a visa application for testing
      visaApplication = await VisaApplication.create({
        userId: testUser._id,
        destinationCountry: 'Germany',
        visaType: 'Business',
        travelPurpose: 'Conference',
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
          visaFee: 8000000,
          serviceFee: 1500000,
          urgencyFee: 0,
          total: 9500000
        },
        status: 'Pending'
      });
    });

    it('should update visa application status by staff', async () => {
      const updateData = {
        status: 'Under Review',
        note: 'Application is being reviewed by our team'
      };

      const response = await request(app)
        .put(`/api/v1/products/visa/${visaApplication._id}/status`)
        .set('x-test-user', JSON.stringify({ userId: staffUser._id.toString(), role: 'Staff' }))
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.visaApplication.status).toBe('Under Review');
      expect(response.body.data.visaApplication.previousStatus).toBe('Pending');
      expect(response.body.data.visaApplication.statusHistory).toBeDefined();
    });

    it('should not allow regular users to update status', async () => {
      const updateData = {
        status: 'Approved',
        note: 'Trying to approve my own application'
      };

      const response = await request(app)
        .put(`/api/v1/products/visa/${visaApplication._id}/status`)
        .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
        .send(updateData)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should validate status transitions', async () => {
      // Try to transition from Pending directly to Approved (should be allowed)
      const updateData = {
        status: 'Approved',
        note: 'Fast-track approval'
      };

      const response = await request(app)
        .put(`/api/v1/products/visa/${visaApplication._id}/status`)
        .set('x-test-user', JSON.stringify({ userId: staffUser._id.toString(), role: 'Staff' }))
        .send(updateData)
        .expect(400); // Should fail due to invalid transition

      expect(response.body.success).toBe(false);
    });
  });

  describe('Visa Application Fee Calculation', () => {
    it('should calculate correct fees for different countries and urgency levels', async () => {
      const testCases = [
        {
          country: 'United States',
          visaType: 'Tourist',
          urgency: 'Standard',
          expectedVisaFee: 16000000 // $160
        },
        {
          country: 'United Kingdom',
          visaType: 'Business',
          urgency: 'Express',
          expectedVisaFee: 9500000, // £95
          expectedUrgencyFee: 2500000 // NGN 25,000
        },
        {
          country: 'Dubai',
          visaType: 'Tourist',
          urgency: 'Super Express',
          expectedVisaFee: 35000000, // AED 350
          expectedUrgencyFee: 5000000 // NGN 50,000
        }
      ];

      for (const testCase of testCases) {
        const visaApplicationData = {
          destinationCountry: testCase.country,
          visaType: testCase.visaType,
          travelPurpose: 'Test purpose',
          urgency: testCase.urgency,
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

        const response = await request(app)
          .post('/api/v1/products/visa/apply')
          .set('x-test-user', JSON.stringify({ userId: testUser._id.toString(), role: 'User' }))
          .send(visaApplicationData)
          .expect(201);

        const fees = response.body.data.visaApplication.fees;
        expect(fees.visaFee).toBe(testCase.expectedVisaFee);
        expect(fees.serviceFee).toBe(1500000); // Standard service fee
        
        if (testCase.expectedUrgencyFee) {
          expect(fees.urgencyFee).toBe(testCase.expectedUrgencyFee);
        }
        
        expect(fees.total).toBe(fees.visaFee + fees.serviceFee + fees.urgencyFee);
      }
    });
  });
});