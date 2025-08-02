// v1/test/models/referralModel.test.js
const mongoose = require('mongoose');
const Referral = require('../../models/referralModel');
const Affiliate = require('../../models/affiliateModel');
const User = require('../../models/userModel');

describe('Referral Model', () => {
  let testUser;
  let testCustomer;
  let testAffiliate;
  
  beforeAll(async () => {
    // Ensure test environment is set up
    process.env.NODE_ENV = 'test';
    process.env.JWT_ACCESS_SECRET = 'test_access_secret';
    process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
    
    // Create test users
    testUser = await User.create({
      firstName: 'Test',
      lastName: 'Affiliate',
      email: 'testaffiliate@example.com',
      password: 'password123',
      role: 'Business',
    });

    testCustomer = await User.create({
      firstName: 'Test',
      lastName: 'Customer',
      email: 'testcustomer@example.com',
      password: 'password123',
    });

    testAffiliate = await Affiliate.create({
      userId: testUser._id,
      businessName: 'Test Business',
      businessEmail: 'test@business.com',
      businessPhone: '+2348012345678',
      businessAddress: {
        street: '123 Street',
        city: 'Lagos',
        state: 'Lagos',
        country: 'Nigeria',
      },
      status: 'active',
    });
  });

  afterAll(async () => {
    // Clean up test data
    await User.deleteMany({});
    await Affiliate.deleteMany({});
    await Referral.deleteMany({});
  });

  beforeEach(async () => {
    // Clean up referrals before each test
    await Referral.deleteMany({});
  });

  describe('Referral Creation', () => {
    it('should create a valid referral', async () => {
      const referralData = {
        affiliateId: testAffiliate._id,
        customerId: testCustomer._id,
        referralCode: testAffiliate.referralCode,
        referralSource: 'qr_code',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        referrerUrl: 'https://example.com/referrer',
        landingPage: 'https://travelplace.com/flights',
        deviceInfo: {
          type: 'desktop',
          browser: 'Chrome',
          os: 'Windows',
        },
        geolocation: {
          country: 'Nigeria',
          region: 'Lagos',
          city: 'Lagos',
          coordinates: {
            latitude: 6.5244,
            longitude: 3.3792,
          },
        },
      };

      const referral = new Referral(referralData);
      const savedReferral = await referral.save();

      expect(savedReferral.affiliateId.toString()).toBe(testAffiliate._id.toString());
      expect(savedReferral.customerId.toString()).toBe(testCustomer._id.toString());
      expect(savedReferral.referralCode).toBe(testAffiliate.referralCode);
      expect(savedReferral.referralSource).toBe('qr_code');
      expect(savedReferral.ipAddress).toBe('192.168.1.1');
      expect(savedReferral.status).toBe('active');
      expect(savedReferral.totalBookings).toBe(0);
      expect(savedReferral.totalValue).toBe(0);
      expect(savedReferral.currency).toBe('NGN');
    });

    it('should require all mandatory fields', async () => {
      const referral = new Referral({});

      await expect(referral.save()).rejects.toThrow();
    });

    it('should validate IP address format', async () => {
      const referral = new Referral({
        affiliateId: testAffiliate._id,
        customerId: testCustomer._id,
        referralCode: testAffiliate.referralCode,
        ipAddress: 'invalid-ip',
        userAgent: 'Test User Agent',
      });

      await expect(referral.save()).rejects.toThrow('Please provide a valid IP address');
    });

    it('should validate referral source enum', async () => {
      const referral = new Referral({
        affiliateId: testAffiliate._id,
        customerId: testCustomer._id,
        referralCode: testAffiliate.referralCode,
        referralSource: 'invalid_source',
        ipAddress: '192.168.1.1',
        userAgent: 'Test User Agent',
      });

      await expect(referral.save()).rejects.toThrow('Referral source must be one of: qr_code, link, manual, social_media, email, other');
    });

    it('should validate status enum', async () => {
      const referral = new Referral({
        affiliateId: testAffiliate._id,
        customerId: testCustomer._id,
        referralCode: testAffiliate.referralCode,
        ipAddress: '192.168.1.1',
        userAgent: 'Test User Agent',
        status: 'invalid_status',
      });

      await expect(referral.save()).rejects.toThrow('Status must be one of: active, converted, inactive, blocked');
    });

    it('should validate currency enum', async () => {
      const referral = new Referral({
        affiliateId: testAffiliate._id,
        customerId: testCustomer._id,
        referralCode: testAffiliate.referralCode,
        ipAddress: '192.168.1.1',
        userAgent: 'Test User Agent',
        currency: 'INVALID',
      });

      await expect(referral.save()).rejects.toThrow('Currency must be one of: NGN, USD, EUR, GBP');
    });

    it('should validate coordinate ranges', async () => {
      const referral = new Referral({
        affiliateId: testAffiliate._id,
        customerId: testCustomer._id,
        referralCode: testAffiliate.referralCode,
        ipAddress: '192.168.1.1',
        userAgent: 'Test User Agent',
        geolocation: {
          coordinates: {
            latitude: 91, // Invalid: > 90
            longitude: 181, // Invalid: > 180
          },
        },
      });

      await expect(referral.save()).rejects.toThrow();
    });

    it('should enforce unique affiliate-customer combination', async () => {
      await Referral.create({
        affiliateId: testAffiliate._id,
        customerId: testCustomer._id,
        referralCode: testAffiliate.referralCode,
        ipAddress: '192.168.1.1',
        userAgent: 'Test User Agent',
      });

      const duplicateReferral = new Referral({
        affiliateId: testAffiliate._id,
        customerId: testCustomer._id,
        referralCode: testAffiliate.referralCode,
        ipAddress: '192.168.1.2',
        userAgent: 'Different User Agent',
      });

      await expect(duplicateReferral.save()).rejects.toThrow();
    });

    it('should set default values correctly', async () => {
      const referral = await Referral.create({
        affiliateId: testAffiliate._id,
        customerId: testCustomer._id,
        referralCode: testAffiliate.referralCode,
        ipAddress: '192.168.1.1',
        userAgent: 'Test User Agent',
      });

      expect(referral.referralSource).toBe('link');
      expect(referral.status).toBe('active');
      expect(referral.totalBookings).toBe(0);
      expect(referral.totalValue).toBe(0);
      expect(referral.currency).toBe('NGN');
      expect(referral.deviceInfo.type).toBe('unknown');
    });
  });

  describe('Referral Methods', () => {
    let referral;

    beforeEach(async () => {
      referral = await Referral.create({
        affiliateId: testAffiliate._id,
        customerId: testCustomer._id,
        referralCode: testAffiliate.referralCode,
        ipAddress: '192.168.1.1',
        userAgent: 'Test User Agent',
      });
    });

    describe('Booking Management', () => {
      it('should add booking successfully', async () => {
        const bookingData = {
          bookingReference: 'BK-12345678',
          serviceType: 'flight',
          bookingAmount: 50000,
          commissionGenerated: 1250,
        };

        await referral.addBooking(bookingData);

        expect(referral.totalBookings).toBe(1);
        expect(referral.totalValue).toBe(50000);
        expect(referral.status).toBe('converted');
        expect(referral.firstBookingAt).toBeInstanceOf(Date);
        expect(referral.conversionDate).toBeInstanceOf(Date);
        expect(referral.lastActivityAt).toBeInstanceOf(Date);
        expect(referral.bookingHistory).toHaveLength(1);
        expect(referral.bookingHistory[0].bookingReference).toBe('BK-12345678');
        expect(referral.bookingHistory[0].serviceType).toBe('flight');
        expect(referral.bookingHistory[0].bookingAmount).toBe(50000);
        expect(referral.bookingHistory[0].commissionGenerated).toBe(1250);
      });

      it('should add multiple bookings', async () => {
        const booking1 = {
          bookingReference: 'BK-11111111',
          serviceType: 'flight',
          bookingAmount: 50000,
          commissionGenerated: 1250,
        };

        const booking2 = {
          bookingReference: 'BK-22222222',
          serviceType: 'hotel',
          bookingAmount: 30000,
          commissionGenerated: 900,
        };

        await referral.addBooking(booking1);
        await referral.addBooking(booking2);

        expect(referral.totalBookings).toBe(2);
        expect(referral.totalValue).toBe(80000);
        expect(referral.bookingHistory).toHaveLength(2);
      });

      it('should round total value to 2 decimal places', async () => {
        const bookingData = {
          bookingReference: 'BK-12345678',
          serviceType: 'flight',
          bookingAmount: 50000.999,
          commissionGenerated: 1250.025,
        };

        await referral.addBooking(bookingData);

        expect(referral.totalValue).toBe(50001.00);
      });
    });

    describe('Analytics Methods', () => {
      beforeEach(async () => {
        // Add some bookings for analytics tests
        await referral.addBooking({
          bookingReference: 'BK-11111111',
          serviceType: 'flight',
          bookingAmount: 50000,
          commissionGenerated: 1250,
        });

        await referral.addBooking({
          bookingReference: 'BK-22222222',
          serviceType: 'hotel',
          bookingAmount: 30000,
          commissionGenerated: 900,
        });
      });

      it('should calculate conversion rate correctly', () => {
        const conversionRate = referral.getConversionRate();
        expect(conversionRate).toBe(1); // Has bookings, so converted
      });

      it('should calculate average booking value', () => {
        const averageValue = referral.getAverageBookingValue();
        expect(averageValue).toBe(40000); // (50000 + 30000) / 2
      });

      it('should calculate customer lifetime value', () => {
        const lifetimeValue = referral.getCustomerLifetimeValue();
        expect(lifetimeValue).toBe(80000); // Total value
      });

      it('should return zero conversion rate for no bookings', async () => {
        const newReferral = await Referral.create({
          affiliateId: testAffiliate._id,
          customerId: new mongoose.Types.ObjectId(),
          referralCode: testAffiliate.referralCode,
          ipAddress: '192.168.1.2',
          userAgent: 'Test User Agent',
        });

        const conversionRate = newReferral.getConversionRate();
        expect(conversionRate).toBe(0);
      });
    });

    describe('Status Management', () => {
      it('should block referral', async () => {
        const reason = 'Suspicious activity detected';
        await referral.block(reason);

        expect(referral.status).toBe('blocked');
        expect(referral.notes).toBe(reason);
      });

      it('should reactivate referral without bookings', async () => {
        await referral.block('Test block');
        await referral.reactivate();

        expect(referral.status).toBe('active');
      });

      it('should reactivate referral with bookings as converted', async () => {
        await referral.addBooking({
          bookingReference: 'BK-12345678',
          serviceType: 'flight',
          bookingAmount: 50000,
          commissionGenerated: 1250,
        });

        await referral.block('Test block');
        await referral.reactivate();

        expect(referral.status).toBe('converted');
      });
    });

    describe('Summary Generation', () => {
      it('should get referral summary', async () => {
        await referral.addBooking({
          bookingReference: 'BK-12345678',
          serviceType: 'flight',
          bookingAmount: 50000,
          commissionGenerated: 1250,
        });

        const summary = referral.getSummary();

        expect(summary).toHaveProperty('id');
        expect(summary).toHaveProperty('affiliateId');
        expect(summary).toHaveProperty('customerId');
        expect(summary).toHaveProperty('referralCode');
        expect(summary).toHaveProperty('referralSource', 'link');
        expect(summary).toHaveProperty('status', 'converted');
        expect(summary).toHaveProperty('totalBookings', 1);
        expect(summary).toHaveProperty('totalValue', 50000);
        expect(summary).toHaveProperty('averageBookingValue', 50000);
        expect(summary).toHaveProperty('firstBookingAt');
        expect(summary).toHaveProperty('lastActivityAt');
        expect(summary).toHaveProperty('createdAt');
      });
    });
  });

  describe('Static Methods', () => {
    let affiliate2;
    let customer2;

    beforeEach(async () => {
      // Create additional test data
      customer2 = await User.create({
        firstName: 'Customer',
        lastName: 'Two',
        email: 'customer2@example.com',
        password: 'password123',
      });

      affiliate2 = await Affiliate.create({
        userId: testUser._id,
        businessName: 'Business Two',
        businessEmail: 'business2@example.com',
        businessPhone: '+2348012345679',
        businessAddress: {
          street: '456 Street',
          city: 'Abuja',
          state: 'FCT',
          country: 'Nigeria',
        },
        status: 'active',
      });

      // Create test referrals
      await Referral.create([
        {
          affiliateId: testAffiliate._id,
          customerId: testCustomer._id,
          referralCode: testAffiliate.referralCode,
          ipAddress: '192.168.1.1',
          userAgent: 'Test User Agent 1',
          status: 'active',
        },
        {
          affiliateId: testAffiliate._id,
          customerId: customer2._id,
          referralCode: testAffiliate.referralCode,
          ipAddress: '192.168.1.2',
          userAgent: 'Test User Agent 2',
          status: 'converted',
          totalBookings: 2,
          totalValue: 80000,
        },
        {
          affiliateId: affiliate2._id,
          customerId: testCustomer._id,
          referralCode: affiliate2.referralCode,
          ipAddress: '192.168.1.3',
          userAgent: 'Test User Agent 3',
          status: 'active',
        },
      ]);
    });

    afterEach(async () => {
      await User.deleteOne({ _id: customer2._id });
      await Affiliate.deleteOne({ _id: affiliate2._id });
    });

    it('should find referrals by affiliate', async () => {
      const referrals = await Referral.findByAffiliate(testAffiliate._id);

      expect(referrals).toHaveLength(2);
      referrals.forEach(referral => {
        expect(referral.affiliateId.toString()).toBe(testAffiliate._id.toString());
      });
    });

    it('should find referrals by affiliate with status filter', async () => {
      const activeReferrals = await Referral.findByAffiliate(testAffiliate._id, {
        status: 'active',
      });

      expect(activeReferrals).toHaveLength(1);
      expect(activeReferrals[0].status).toBe('active');
    });

    it('should find referrals by customer', async () => {
      const customerReferrals = await Referral.findByCustomer(testCustomer._id);

      expect(customerReferrals).toHaveLength(2);
      customerReferrals.forEach(referral => {
        expect(referral.customerId.toString()).toBe(testCustomer._id.toString());
      });
    });

    it('should validate referral code for existing referral', async () => {
      const result = await Referral.validateReferralCode(testAffiliate.referralCode, testCustomer._id);

      expect(result.valid).toBe(true);
      expect(result.isNew).toBe(false);
      expect(result.referral).toBeTruthy();
    });

    it('should validate referral code for new customer', async () => {
      const newCustomer = await User.create({
        firstName: 'New',
        lastName: 'Customer',
        email: 'newcustomer@example.com',
        password: 'password123',
      });

      const result = await Referral.validateReferralCode(testAffiliate.referralCode, newCustomer._id);

      expect(result.valid).toBe(true);
      expect(result.isNew).toBe(true);
      expect(result.affiliate).toBeTruthy();
      expect(result.affiliate._id.toString()).toBe(testAffiliate._id.toString());

      await User.deleteOne({ _id: newCustomer._id });
    });

    it('should reject invalid referral code', async () => {
      const result = await Referral.validateReferralCode('INVALID-CODE', testCustomer._id);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid or inactive referral code');
    });

    it('should get affiliate statistics', async () => {
      const stats = await Referral.getAffiliateStats(testAffiliate._id);

      expect(stats).toHaveLength(1);
      expect(stats[0].totalReferrals).toBe(2);
      expect(stats[0].convertedReferrals).toBe(1);
      expect(stats[0].totalBookings).toBe(2);
      expect(stats[0].totalValue).toBe(80000);
      expect(stats[0].conversionRate).toBe(50); // 1/2 * 100
    });

    it('should get top performing referrals', async () => {
      const topPerformers = await Referral.getTopPerformers(testAffiliate._id, 5);

      expect(topPerformers).toHaveLength(2);
      expect(topPerformers[0].totalValue).toBeGreaterThanOrEqual(topPerformers[1].totalValue);
    });

    it('should handle empty results for non-existent affiliate', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const referrals = await Referral.findByAffiliate(nonExistentId);

      expect(referrals).toHaveLength(0);
    });
  });

  describe('Validation and Constraints', () => {
    it('should validate notes length', async () => {
      const longNotes = 'a'.repeat(501);
      const referral = new Referral({
        affiliateId: testAffiliate._id,
        customerId: testCustomer._id,
        referralCode: testAffiliate.referralCode,
        ipAddress: '192.168.1.1',
        userAgent: 'Test User Agent',
        notes: longNotes,
      });

      await expect(referral.save()).rejects.toThrow('Notes cannot exceed 500 characters');
    });

    it('should validate user agent length', async () => {
      const longUserAgent = 'a'.repeat(501);
      const referral = new Referral({
        affiliateId: testAffiliate._id,
        customerId: testCustomer._id,
        referralCode: testAffiliate.referralCode,
        ipAddress: '192.168.1.1',
        userAgent: longUserAgent,
      });

      await expect(referral.save()).rejects.toThrow('User agent cannot exceed 500 characters');
    });

    it('should validate negative total values', async () => {
      const referral = new Referral({
        affiliateId: testAffiliate._id,
        customerId: testCustomer._id,
        referralCode: testAffiliate.referralCode,
        ipAddress: '192.168.1.1',
        userAgent: 'Test User Agent',
        totalValue: -100,
      });

      await expect(referral.save()).rejects.toThrow('Total value cannot be negative');
    });

    it('should validate negative total bookings', async () => {
      const referral = new Referral({
        affiliateId: testAffiliate._id,
        customerId: testCustomer._id,
        referralCode: testAffiliate.referralCode,
        ipAddress: '192.168.1.1',
        userAgent: 'Test User Agent',
        totalBookings: -1,
      });

      await expect(referral.save()).rejects.toThrow('Total bookings cannot be negative');
    });
  });

  describe('Indexes and Performance', () => {
    it('should have proper indexes defined', () => {
      const indexes = Referral.schema.indexes();
      const indexFields = indexes.map(index => Object.keys(index[0]));
      
      expect(indexFields).toContainEqual(['affiliateId']);
      expect(indexFields).toContainEqual(['customerId']);
      expect(indexFields).toContainEqual(['referralCode']);
      expect(indexFields).toContainEqual(['referralSource']);
      expect(indexFields).toContainEqual(['status']);
      expect(indexFields).toContainEqual(['createdAt']);
    });

    it('should have unique compound index for affiliate-customer combination', () => {
      const indexes = Referral.schema.indexes();
      const uniqueIndexes = indexes.filter(index => index[1] && index[1].unique);
      
      expect(uniqueIndexes.length).toBeGreaterThan(0);
    });
  });
});