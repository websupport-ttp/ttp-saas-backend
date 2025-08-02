// v1/test/models/affiliateModel.test.js
const mongoose = require('mongoose');
const Affiliate = require('../../models/affiliateModel');
const User = require('../../models/userModel');

describe('Affiliate Model', () => {
  let testUser;
  
  beforeAll(async () => {
    // Ensure test environment is set up
    process.env.NODE_ENV = 'test';
    process.env.JWT_ACCESS_SECRET = 'test_access_secret';
    process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
    
    // Create a test user
    testUser = await User.create({
      firstName: 'Test',
      lastName: 'Business',
      email: 'testbusiness@example.com',
      password: 'password123',
      role: 'Business',
    });
  });

  afterAll(async () => {
    // Clean up test data
    await User.deleteMany({});
    await Affiliate.deleteMany({});
  });

  beforeEach(async () => {
    // Clean up affiliates before each test
    await Affiliate.deleteMany({});
  });

  describe('Affiliate Creation', () => {
    it('should create a valid affiliate', async () => {
      const affiliateData = {
        userId: testUser._id,
        businessName: 'Travel Partners Ltd',
        businessEmail: 'partners@travelltd.com',
        businessPhone: '+2348012345678',
        businessAddress: {
          street: '123 Business Street',
          city: 'Lagos',
          state: 'Lagos',
          country: 'Nigeria',
          postalCode: '100001',
        },
      };

      const affiliate = new Affiliate(affiliateData);
      const savedAffiliate = await affiliate.save();

      expect(savedAffiliate.userId.toString()).toBe(testUser._id.toString());
      expect(savedAffiliate.businessName).toBe(affiliateData.businessName);
      expect(savedAffiliate.businessEmail).toBe(affiliateData.businessEmail);
      expect(savedAffiliate.businessPhone).toBe(affiliateData.businessPhone);
      expect(savedAffiliate.status).toBe('pending');
      expect(savedAffiliate.affiliateId).toMatch(/^AFF-\d{6}$/);
      expect(savedAffiliate.referralCode).toMatch(/^TRAVELPARTNERS-\d{3}$/);
      expect(savedAffiliate.totalReferrals).toBe(0);
      expect(savedAffiliate.totalCommissionsEarned).toBe(0);
    });

    it('should generate unique affiliate ID automatically', async () => {
      const affiliate1 = await Affiliate.create({
        userId: testUser._id,
        businessName: 'Business One',
        businessEmail: 'one@business.com',
        businessPhone: '+2348012345678',
        businessAddress: {
          street: '123 Street',
          city: 'Lagos',
          state: 'Lagos',
          country: 'Nigeria',
        },
      });

      const affiliate2 = await Affiliate.create({
        userId: testUser._id,
        businessName: 'Business Two',
        businessEmail: 'two@business.com',
        businessPhone: '+2348012345679',
        businessAddress: {
          street: '456 Street',
          city: 'Abuja',
          state: 'FCT',
          country: 'Nigeria',
        },
      });

      expect(affiliate1.affiliateId).not.toBe(affiliate2.affiliateId);
      expect(affiliate1.referralCode).not.toBe(affiliate2.referralCode);
    });

    it('should require all mandatory fields', async () => {
      const affiliate = new Affiliate({});

      await expect(affiliate.save()).rejects.toThrow();
    });

    it('should validate email format', async () => {
      const affiliate = new Affiliate({
        userId: testUser._id,
        businessName: 'Test Business',
        businessEmail: 'invalid-email',
        businessPhone: '+2348012345678',
        businessAddress: {
          street: '123 Street',
          city: 'Lagos',
          state: 'Lagos',
          country: 'Nigeria',
        },
      });

      await expect(affiliate.save()).rejects.toThrow('Please provide a valid business email address');
    });

    it('should validate phone number format', async () => {
      const affiliate = new Affiliate({
        userId: testUser._id,
        businessName: 'Test Business',
        businessEmail: 'test@business.com',
        businessPhone: 'invalid-phone',
        businessAddress: {
          street: '123 Street',
          city: 'Lagos',
          state: 'Lagos',
          country: 'Nigeria',
        },
      });

      await expect(affiliate.save()).rejects.toThrow('Please provide a valid business phone number');
    });

    it('should set default commission rates', async () => {
      const affiliate = await Affiliate.create({
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
      });

      expect(affiliate.commissionRates.flights).toBe(2.5);
      expect(affiliate.commissionRates.hotels).toBe(3.0);
      expect(affiliate.commissionRates.insurance).toBe(5.0);
      expect(affiliate.commissionRates.visa).toBe(4.0);
    });
  });

  describe('Affiliate Methods', () => {
    let affiliate;

    beforeEach(async () => {
      affiliate = await Affiliate.create({
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
      });
    });

    it('should approve affiliate', async () => {
      const adminId = new mongoose.Types.ObjectId();
      await affiliate.approve(adminId);

      expect(affiliate.status).toBe('active');
      expect(affiliate.approvedBy.toString()).toBe(adminId.toString());
      expect(affiliate.approvedAt).toBeInstanceOf(Date);
    });

    it('should suspend affiliate', async () => {
      const reason = 'Suspicious activity detected';
      await affiliate.suspend(reason);

      expect(affiliate.status).toBe('suspended');
      expect(affiliate.suspensionReason).toBe(reason);
      expect(affiliate.suspendedAt).toBeInstanceOf(Date);
    });

    it('should reactivate affiliate', async () => {
      await affiliate.suspend('Test suspension');
      await affiliate.reactivate();

      expect(affiliate.status).toBe('active');
      expect(affiliate.suspensionReason).toBeNull();
      expect(affiliate.suspendedAt).toBeNull();
    });

    it('should update commission rates', async () => {
      const newRates = {
        flights: 3.0,
        hotels: 3.5,
      };

      await affiliate.updateCommissionRates(newRates);

      expect(affiliate.commissionRates.flights).toBe(3.0);
      expect(affiliate.commissionRates.hotels).toBe(3.5);
      expect(affiliate.commissionRates.insurance).toBe(5.0); // Unchanged
      expect(affiliate.commissionRates.visa).toBe(4.0); // Unchanged
    });

    it('should increment referral count', async () => {
      const initialCount = affiliate.totalReferrals;
      await affiliate.incrementReferrals();

      expect(affiliate.totalReferrals).toBe(initialCount + 1);
    });

    it('should add commission earnings', async () => {
      const initialEarnings = affiliate.totalCommissionsEarned;
      const additionalEarnings = 150.50;
      
      await affiliate.addCommissionEarnings(additionalEarnings);

      expect(affiliate.totalCommissionsEarned).toBe(initialEarnings + additionalEarnings);
    });
  });

  describe('Static Methods', () => {
    beforeEach(async () => {
      // Create test affiliates with different statuses
      await Affiliate.create([
        {
          userId: testUser._id,
          businessName: 'Active Business 1',
          businessEmail: 'active1@business.com',
          businessPhone: '+2348012345678',
          businessAddress: {
            street: '123 Street',
            city: 'Lagos',
            state: 'Lagos',
            country: 'Nigeria',
          },
          status: 'active',
        },
        {
          userId: testUser._id,
          businessName: 'Active Business 2',
          businessEmail: 'active2@business.com',
          businessPhone: '+2348012345679',
          businessAddress: {
            street: '456 Street',
            city: 'Abuja',
            state: 'FCT',
            country: 'Nigeria',
          },
          status: 'active',
        },
        {
          userId: testUser._id,
          businessName: 'Pending Business',
          businessEmail: 'pending@business.com',
          businessPhone: '+2348012345680',
          businessAddress: {
            street: '789 Street',
            city: 'Kano',
            state: 'Kano',
            country: 'Nigeria',
          },
          status: 'pending',
        },
      ]);
    });

    it('should find active affiliates', async () => {
      const activeAffiliates = await Affiliate.findActive();
      
      expect(activeAffiliates).toHaveLength(2);
      activeAffiliates.forEach(affiliate => {
        expect(affiliate.status).toBe('active');
      });
    });

    it('should find pending affiliates', async () => {
      const pendingAffiliates = await Affiliate.findPending();
      
      expect(pendingAffiliates).toHaveLength(1);
      expect(pendingAffiliates[0].status).toBe('pending');
    });

    it('should validate referral code for active affiliate', async () => {
      const activeAffiliate = await Affiliate.findOne({ status: 'active' });
      const validAffiliate = await Affiliate.validateReferralCode(activeAffiliate.referralCode);
      
      expect(validAffiliate).toBeTruthy();
      expect(validAffiliate._id.toString()).toBe(activeAffiliate._id.toString());
    });

    it('should not validate referral code for inactive affiliate', async () => {
      const pendingAffiliate = await Affiliate.findOne({ status: 'pending' });
      const validAffiliate = await Affiliate.validateReferralCode(pendingAffiliate.referralCode);
      
      expect(validAffiliate).toBeNull();
    });

    it('should not validate invalid referral code', async () => {
      const validAffiliate = await Affiliate.validateReferralCode('INVALID-CODE');
      
      expect(validAffiliate).toBeNull();
    });

    it('should generate unique affiliate IDs', async () => {
      const id1 = await Affiliate.generateAffiliateId();
      const id2 = await Affiliate.generateAffiliateId();
      
      expect(id1).toMatch(/^AFF-\d{6}$/);
      expect(id2).toMatch(/^AFF-\d{6}$/);
      expect(id1).not.toBe(id2);
    });

    it('should generate unique referral codes', async () => {
      const code1 = await Affiliate.generateReferralCode('Test Business One');
      const code2 = await Affiliate.generateReferralCode('Test Business Two');
      
      expect(code1).toMatch(/^TESTBUSI-\d{3}$/);
      expect(code2).toMatch(/^TESTBUSI-\d{3}$/);
      expect(code1).not.toBe(code2);
    });
  });

  describe('Validation', () => {
    it('should validate commission rates within range', async () => {
      const affiliate = new Affiliate({
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
        commissionRates: {
          flights: 150, // Invalid: > 100
        },
      });

      await expect(affiliate.save()).rejects.toThrow('Flight commission rate cannot exceed 100%');
    });

    it('should validate negative commission rates', async () => {
      const affiliate = new Affiliate({
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
        commissionRates: {
          hotels: -5, // Invalid: negative
        },
      });

      await expect(affiliate.save()).rejects.toThrow('Hotel commission rate cannot be negative');
    });

    it('should validate business address completeness', async () => {
      const affiliate = new Affiliate({
        userId: testUser._id,
        businessName: 'Test Business',
        businessEmail: 'test@business.com',
        businessPhone: '+2348012345678',
        businessAddress: {
          street: '123 Street',
          // Missing required fields
        },
      });

      await expect(affiliate.save()).rejects.toThrow();
    });

    it('should validate status enum values', async () => {
      const affiliate = new Affiliate({
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
        status: 'invalid_status',
      });

      await expect(affiliate.save()).rejects.toThrow('Status must be one of: pending, active, suspended, inactive');
    });
  });

  describe('Indexes and Performance', () => {
    it('should have proper indexes defined', () => {
      const indexes = Affiliate.schema.indexes();
      const indexFields = indexes.map(index => Object.keys(index[0]));
      
      expect(indexFields).toContainEqual(['userId']);
      expect(indexFields).toContainEqual(['affiliateId']);
      expect(indexFields).toContainEqual(['referralCode']);
      expect(indexFields).toContainEqual(['status']);
      expect(indexFields).toContainEqual(['businessEmail']);
    });
  });
});