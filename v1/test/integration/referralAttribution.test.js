// v1/test/integration/referralAttribution.test.js
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../app');
const User = require('../../models/userModel');
const Affiliate = require('../../models/affiliateModel');
const Referral = require('../../models/referralModel');
const { generateToken } = require('../../utils/jwtUtils');
const { connectTestDB, clearTestDB, closeTestDB } = require('../utils/testDb');

describe('Referral Attribution Integration Tests', () => {
  let testUser, testAffiliate, authToken;

  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();

    // Create test user
    testUser = new User({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phoneNumber: '+2348123456789',
      password: 'hashedpassword123',
      isEmailVerified: true,
      role: 'customer'
    });
    await testUser.save();

    // Create test affiliate
    const affiliateUser = new User({
      firstName: 'Business',
      lastName: 'Owner',
      email: 'business@example.com',
      phoneNumber: '+2348987654321',
      password: 'hashedpassword123',
      isEmailVerified: true,
      role: 'business'
    });
    await affiliateUser.save();

    testAffiliate = new Affiliate({
      userId: affiliateUser._id,
      businessName: 'Test Travel Agency',
      businessEmail: 'business@example.com',
      businessPhone: '+2348987654321',
      businessAddress: {
        street: '123 Business St',
        city: 'Lagos',
        state: 'Lagos',
        country: 'Nigeria'
      },
      status: 'active',
      commissionRates: {
        flights: 2.5,
        hotels: 3.0,
        insurance: 5.0,
        visa: 4.0
      }
    });
    await testAffiliate.save();

    // Generate auth token
    authToken = generateToken(testUser._id);
  });

  describe('Complete Referral Attribution Flow', () => {
    it('should track referral and attribute booking successfully', async () => {
      // Step 1: Track referral when user uses referral code
      const referralTrackingData = {
        referralCode: testAffiliate.referralCode,
        serviceType: 'flight',
        destination: 'New York'
      };

      // Simulate booking request with referral code
      const bookingResponse = await request(app)
        .post('/api/v1/products/book-flight')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ...referralTrackingData,
          flightDetails: {
            departure: 'LOS',
            arrival: 'JFK',
            departureDate: '2024-06-01',
            passengers: 1,
            price: 500000
          },
          passengerDetails: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com',
            phone: '+2348123456789'
          }
        });

      // Should create referral tracking
      const referral = await Referral.findOne({
        customerId: testUser._id,
        affiliateId: testAffiliate._id
      });

      expect(referral).toBeTruthy();
      expect(referral.referralCode).toBe(testAffiliate.referralCode);
      expect(referral.status).toBe('active');

      // Check affiliate referral count increased
      const updatedAffiliate = await Affiliate.findById(testAffiliate._id);
      expect(updatedAffiliate.totalReferrals).toBe(1);
    });

    it('should handle guest booking with referral code', async () => {
      const guestBookingData = {
        referralCode: testAffiliate.referralCode,
        guestEmail: 'guest@example.com',
        flightDetails: {
          departure: 'LOS',
          arrival: 'DXB',
          departureDate: '2024-07-01',
          passengers: 1,
          price: 300000
        },
        passengerDetails: {
          firstName: 'Guest',
          lastName: 'User',
          email: 'guest@example.com',
          phone: '+2348111111111'
        }
      };

      // Simulate guest booking (without auth token)
      const response = await request(app)
        .post('/api/v1/products/book-flight')
        .send(guestBookingData);

      // Should handle guest referral tracking
      // Note: This would require the booking endpoint to create user and process referral
      expect(response.status).toBe(200);
    });

    it('should not create duplicate referrals for same customer-affiliate pair', async () => {
      // Create initial referral
      const initialReferral = new Referral({
        affiliateId: testAffiliate._id,
        customerId: testUser._id,
        referralCode: testAffiliate.referralCode,
        referralSource: 'link',
        ipAddress: '192.168.1.1',
        userAgent: 'Test Agent'
      });
      await initialReferral.save();

      // Try to create another referral with same code
      const bookingResponse = await request(app)
        .post('/api/v1/products/book-flight')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          referralCode: testAffiliate.referralCode,
          flightDetails: {
            departure: 'LOS',
            arrival: 'CDG',
            departureDate: '2024-08-01',
            passengers: 1,
            price: 400000
          },
          passengerDetails: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com',
            phone: '+2348123456789'
          }
        });

      // Should not create duplicate referral
      const referralCount = await Referral.countDocuments({
        customerId: testUser._id,
        affiliateId: testAffiliate._id
      });

      expect(referralCount).toBe(1);
    });

    it('should attribute multiple bookings to same referral', async () => {
      // Create referral
      const referral = new Referral({
        affiliateId: testAffiliate._id,
        customerId: testUser._id,
        referralCode: testAffiliate.referralCode,
        referralSource: 'link',
        ipAddress: '192.168.1.1',
        userAgent: 'Test Agent'
      });
      await referral.save();

      // First booking
      const firstBooking = await request(app)
        .post('/api/v1/products/book-flight')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          flightDetails: {
            departure: 'LOS',
            arrival: 'LHR',
            departureDate: '2024-09-01',
            passengers: 1,
            price: 600000
          },
          passengerDetails: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com',
            phone: '+2348123456789'
          }
        });

      // Second booking
      const secondBooking = await request(app)
        .post('/api/v1/products/book-hotel')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          hotelDetails: {
            hotelId: 'hotel123',
            checkIn: '2024-09-05',
            checkOut: '2024-09-10',
            guests: 2,
            price: 200000
          },
          guestDetails: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com',
            phone: '+2348123456789'
          }
        });

      // Check referral has both bookings
      const updatedReferral = await Referral.findById(referral._id);
      expect(updatedReferral.totalBookings).toBe(2);
      expect(updatedReferral.totalValue).toBe(800000);
      expect(updatedReferral.status).toBe('converted');
      expect(updatedReferral.bookingHistory).toHaveLength(2);
    });

    it('should handle invalid referral codes gracefully', async () => {
      const response = await request(app)
        .post('/api/v1/products/book-flight')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          referralCode: 'INVALID-CODE-123',
          flightDetails: {
            departure: 'LOS',
            arrival: 'JFK',
            departureDate: '2024-06-01',
            passengers: 1,
            price: 500000
          },
          passengerDetails: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com',
            phone: '+2348123456789'
          }
        });

      // Booking should still proceed even with invalid referral code
      expect(response.status).toBe(200);

      // No referral should be created
      const referralCount = await Referral.countDocuments({
        customerId: testUser._id
      });
      expect(referralCount).toBe(0);
    });

    it('should handle suspended affiliate referral codes', async () => {
      // Suspend the affiliate
      testAffiliate.status = 'suspended';
      await testAffiliate.save();

      const response = await request(app)
        .post('/api/v1/products/book-flight')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          referralCode: testAffiliate.referralCode,
          flightDetails: {
            departure: 'LOS',
            arrival: 'JFK',
            departureDate: '2024-06-01',
            passengers: 1,
            price: 500000
          },
          passengerDetails: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com',
            phone: '+2348123456789'
          }
        });

      // Booking should proceed but no referral created
      expect(response.status).toBe(200);

      const referralCount = await Referral.countDocuments({
        customerId: testUser._id,
        affiliateId: testAffiliate._id
      });
      expect(referralCount).toBe(0);
    });
  });

  describe('Referral Statistics and Performance', () => {
    beforeEach(async () => {
      // Create multiple referrals for testing
      const referrals = [
        {
          affiliateId: testAffiliate._id,
          customerId: testUser._id,
          referralCode: testAffiliate.referralCode,
          referralSource: 'qr_code',
          ipAddress: '192.168.1.1',
          userAgent: 'Mobile App',
          totalBookings: 2,
          totalValue: 150000,
          status: 'converted'
        },
        {
          affiliateId: testAffiliate._id,
          customerId: new mongoose.Types.ObjectId(),
          referralCode: testAffiliate.referralCode,
          referralSource: 'link',
          ipAddress: '192.168.1.2',
          userAgent: 'Chrome Browser',
          totalBookings: 0,
          totalValue: 0,
          status: 'active'
        },
        {
          affiliateId: testAffiliate._id,
          customerId: new mongoose.Types.ObjectId(),
          referralCode: testAffiliate.referralCode,
          referralSource: 'social_media',
          ipAddress: '192.168.1.3',
          userAgent: 'Facebook App',
          totalBookings: 1,
          totalValue: 75000,
          status: 'converted'
        }
      ];

      await Referral.insertMany(referrals);
    });

    it('should get comprehensive referral statistics', async () => {
      const response = await request(app)
        .get(`/api/v1/affiliates/${testAffiliate._id}/referral-stats`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.stats.overview.totalReferrals).toBe(3);
      expect(response.body.data.stats.overview.convertedReferrals).toBe(2);
      expect(response.body.data.stats.overview.totalValue).toBe(225000);
    });

    it('should filter statistics by date range', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      const endDate = new Date();

      const response = await request(app)
        .get(`/api/v1/affiliates/${testAffiliate._id}/referral-stats`)
        .query({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should get referral source breakdown', async () => {
      const response = await request(app)
        .get(`/api/v1/affiliates/${testAffiliate._id}/referral-stats`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      const sourceBreakdown = response.body.data.stats.sourceBreakdown;
      expect(sourceBreakdown).toHaveLength(3);
      
      const qrCodeSource = sourceBreakdown.find(s => s._id === 'qr_code');
      expect(qrCodeSource.count).toBe(1);
      expect(qrCodeSource.totalValue).toBe(150000);
    });
  });

  describe('Customer Referral History', () => {
    beforeEach(async () => {
      // Create referral for test user
      const referral = new Referral({
        affiliateId: testAffiliate._id,
        customerId: testUser._id,
        referralCode: testAffiliate.referralCode,
        referralSource: 'link',
        ipAddress: '192.168.1.1',
        userAgent: 'Test Agent',
        totalBookings: 1,
        totalValue: 100000,
        status: 'converted'
      });
      await referral.save();
    });

    it('should get customer referral history', async () => {
      const response = await request(app)
        .get(`/api/v1/users/${testUser._id}/referral-history`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.referrals).toHaveLength(1);
      expect(response.body.data.summary.totalReferrals).toBe(1);
      expect(response.body.data.summary.totalValue).toBe(100000);
    });
  });

  describe('Referral Management', () => {
    let testReferral;

    beforeEach(async () => {
      testReferral = new Referral({
        affiliateId: testAffiliate._id,
        customerId: testUser._id,
        referralCode: testAffiliate.referralCode,
        referralSource: 'link',
        ipAddress: '192.168.1.1',
        userAgent: 'Test Agent'
      });
      await testReferral.save();
    });

    it('should block referral for fraud prevention', async () => {
      const response = await request(app)
        .patch(`/api/v1/referrals/${testReferral._id}/block`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'Suspicious activity detected'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const updatedReferral = await Referral.findById(testReferral._id);
      expect(updatedReferral.status).toBe('blocked');
    });

    it('should reactivate blocked referral', async () => {
      // First block the referral
      await testReferral.block('Test block');

      const response = await request(app)
        .patch(`/api/v1/referrals/${testReferral._id}/reactivate`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const updatedReferral = await Referral.findById(testReferral._id);
      expect(updatedReferral.status).toBe('active');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Mock database error
      jest.spyOn(Referral.prototype, 'save').mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .post('/api/v1/products/book-flight')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          referralCode: testAffiliate.referralCode,
          flightDetails: {
            departure: 'LOS',
            arrival: 'JFK',
            departureDate: '2024-06-01',
            passengers: 1,
            price: 500000
          },
          passengerDetails: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com',
            phone: '+2348123456789'
          }
        });

      // Booking should still proceed even if referral tracking fails
      expect(response.status).toBe(200);
    });

    it('should handle malformed referral codes', async () => {
      const response = await request(app)
        .post('/api/v1/products/book-flight')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          referralCode: '', // Empty referral code
          flightDetails: {
            departure: 'LOS',
            arrival: 'JFK',
            departureDate: '2024-06-01',
            passengers: 1,
            price: 500000
          },
          passengerDetails: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com',
            phone: '+2348123456789'
          }
        });

      expect(response.status).toBe(200);
      
      const referralCount = await Referral.countDocuments({
        customerId: testUser._id
      });
      expect(referralCount).toBe(0);
    });
  });
});