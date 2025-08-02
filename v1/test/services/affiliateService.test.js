// v1/test/services/affiliateService.test.js
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const affiliateService = require('../../services/affiliateService');
const Affiliate = require('../../models/affiliateModel');
const Wallet = require('../../models/walletModel');
const User = require('../../models/userModel');

describe('AffiliateService Unit Tests', () => {
  let mongoServer;

  beforeAll(async () => {
    // Start in-memory MongoDB instance
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    // Connect to the in-memory database
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    // Clean up and close connections
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear all collections before each test
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
  });

  describe('registerAffiliate', () => {
    let testUser;

    beforeEach(async () => {
      // Create test user
      testUser = await User.create({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phoneNumber: '+2348123456789',
        password: 'Password123!',
        role: 'User',
        isEmailVerified: true,
        isPhoneVerified: true
      });
    });

    it('should successfully register a new affiliate', async () => {
      const userData = {
        userId: testUser._id
      };

      const businessData = {
        businessName: 'Test Travel Agency',
        businessEmail: 'business@testtravelagency.com',
        businessPhone: '+2348111222333',
        businessAddress: {
          street: '123 Business Street',
          city: 'Lagos',
          state: 'Lagos State',
          country: 'Nigeria',
          postalCode: '100001'
        }
      };

      const result = await affiliateService.registerAffiliate(userData, businessData);

      expect(result).toBeTruthy();
      expect(result.affiliateId).toMatch(/^AFF-\d{6}$/);
      expect(result.referralCode).toMatch(/^[A-Z0-9]+-\d{3}$/);
      expect(result.status).toBe('pending');
      expect(result.businessName).toBe(businessData.businessName);
      expect(result.businessEmail).toBe(businessData.businessEmail);

      // Verify affiliate was created in database
      const affiliate = await Affiliate.findOne({ userId: testUser._id });
      expect(affiliate).toBeTruthy();
      expect(affiliate.status).toBe('pending');

      // Verify wallet was created
      const wallet = await Wallet.findOne({ affiliateId: affiliate._id });
      expect(wallet).toBeTruthy();
      expect(wallet.balance).toBe(0);
      expect(wallet.status).toBe('active');
    });

    it('should throw error for missing user ID', async () => {
      const userData = {};
      const businessData = {
        businessName: 'Test Travel Agency',
        businessEmail: 'business@testtravelagency.com',
        businessPhone: '+2348111222333',
        businessAddress: {
          street: '123 Business Street',
          city: 'Lagos',
          state: 'Lagos State',
          country: 'Nigeria'
        }
      };

      await expect(affiliateService.registerAffiliate(userData, businessData))
        .rejects.toThrow('User ID is required for affiliate registration');
    });

    it('should throw error for missing business data', async () => {
      const userData = {
        userId: testUser._id
      };
      const businessData = {
        businessName: 'Test Travel Agency'
        // Missing required fields
      };

      await expect(affiliateService.registerAffiliate(userData, businessData))
        .rejects.toThrow('Business name, email, and phone are required');
    });

    it('should throw error for non-existent user', async () => {
      const userData = {
        userId: new mongoose.Types.ObjectId()
      };
      const businessData = {
        businessName: 'Test Travel Agency',
        businessEmail: 'business@testtravelagency.com',
        businessPhone: '+2348111222333',
        businessAddress: {
          street: '123 Business Street',
          city: 'Lagos',
          state: 'Lagos State',
          country: 'Nigeria'
        }
      };

      await expect(affiliateService.registerAffiliate(userData, businessData))
        .rejects.toThrow('User not found');
    });

    it('should throw error for duplicate affiliate registration', async () => {
      // First registration
      const userData = {
        userId: testUser._id
      };
      const businessData = {
        businessName: 'Test Travel Agency',
        businessEmail: 'business@testtravelagency.com',
        businessPhone: '+2348111222333',
        businessAddress: {
          street: '123 Business Street',
          city: 'Lagos',
          state: 'Lagos State',
          country: 'Nigeria'
        }
      };

      await affiliateService.registerAffiliate(userData, businessData);

      // Second registration attempt
      await expect(affiliateService.registerAffiliate(userData, businessData))
        .rejects.toThrow('User is already registered as an affiliate');
    });

    it('should throw error for duplicate business email', async () => {
      // First registration
      const userData1 = {
        userId: testUser._id
      };
      const businessData1 = {
        businessName: 'Test Travel Agency',
        businessEmail: 'business@testtravelagency.com',
        businessPhone: '+2348111222333',
        businessAddress: {
          street: '123 Business Street',
          city: 'Lagos',
          state: 'Lagos State',
          country: 'Nigeria'
        }
      };

      await affiliateService.registerAffiliate(userData1, businessData1);

      // Create another user
      const testUser2 = await User.create({
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
        phoneNumber: '+2348555666777',
        password: 'Password123!',
        role: 'User',
        isEmailVerified: true,
        isPhoneVerified: true
      });

      // Second registration with same business email
      const userData2 = {
        userId: testUser2._id
      };
      const businessData2 = {
        businessName: 'Different Business Name',
        businessEmail: 'business@testtravelagency.com', // Same email
        businessPhone: '+2348444555666',
        businessAddress: {
          street: '456 Different Street',
          city: 'Abuja',
          state: 'FCT',
          country: 'Nigeria'
        }
      };

      await expect(affiliateService.registerAffiliate(userData2, businessData2))
        .rejects.toThrow('Business email is already registered');
    });
  });

  describe('validateReferralCode', () => {
    let affiliate;

    beforeEach(async () => {
      // Create test user
      const testUser = await User.create({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phoneNumber: '+2348123456789',
        password: 'Password123!',
        role: 'user',
        isEmailVerified: true,
        isPhoneVerified: true
      });

      // Create active affiliate
      affiliate = await Affiliate.create({
        userId: testUser._id,
        businessName: 'Test Travel Agency',
        businessEmail: 'business@testtravelagency.com',
        businessPhone: '+2348111222333',
        businessAddress: {
          street: '123 Business Street',
          city: 'Lagos',
          state: 'Lagos State',
          country: 'Nigeria'
        },
        status: 'active'
      });
    });

    it('should validate active referral code', async () => {
      const result = await affiliateService.validateReferralCode(affiliate.referralCode);

      expect(result).toBeTruthy();
      expect(result.isValid).toBe(true);
      expect(result.affiliateId).toBe(affiliate.affiliateId);
      expect(result.referralCode).toBe(affiliate.referralCode);
      expect(result.businessName).toBe(affiliate.businessName);
    });

    it('should reject inactive referral code', async () => {
      // Suspend the affiliate
      affiliate.status = 'suspended';
      await affiliate.save();

      await expect(affiliateService.validateReferralCode(affiliate.referralCode))
        .rejects.toThrow('Invalid or inactive referral code');
    });

    it('should reject non-existent referral code', async () => {
      await expect(affiliateService.validateReferralCode('INVALID-123'))
        .rejects.toThrow('Invalid or inactive referral code');
    });
  });

  describe('approveAffiliate', () => {
    let affiliate;
    let adminUser;

    beforeEach(async () => {
      // Create test user
      const testUser = await User.create({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phoneNumber: '+2348123456789',
        password: 'Password123!',
        role: 'user',
        isEmailVerified: true,
        isPhoneVerified: true
      });

      // Create admin user
      adminUser = await User.create({
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@example.com',
        phoneNumber: '+2348987654321',
        password: 'AdminPass123!',
        role: 'Admin',
        isEmailVerified: true,
        isPhoneVerified: true
      });

      // Create pending affiliate
      affiliate = await Affiliate.create({
        userId: testUser._id,
        businessName: 'Test Travel Agency',
        businessEmail: 'business@testtravelagency.com',
        businessPhone: '+2348111222333',
        businessAddress: {
          street: '123 Business Street',
          city: 'Lagos',
          state: 'Lagos State',
          country: 'Nigeria'
        },
        status: 'pending'
      });
    });

    it('should successfully approve a pending affiliate', async () => {
      const result = await affiliateService.approveAffiliate(affiliate.affiliateId, adminUser._id);

      expect(result).toBeTruthy();
      expect(result.status).toBe('active');
      expect(result.approvedBy.toString()).toBe(adminUser._id.toString());
      expect(result.approvedAt).toBeTruthy();

      // Verify in database
      const updatedAffiliate = await Affiliate.findById(affiliate._id);
      expect(updatedAffiliate.status).toBe('active');
      expect(updatedAffiliate.approvedBy.toString()).toBe(adminUser._id.toString());
    });

    it('should throw error for non-existent affiliate', async () => {
      await expect(affiliateService.approveAffiliate('AFF-999999', adminUser._id))
        .rejects.toThrow('Affiliate not found');
    });

    it('should throw error for non-pending affiliate', async () => {
      // First approve the affiliate
      await affiliate.approve(adminUser._id);

      // Try to approve again
      await expect(affiliateService.approveAffiliate(affiliate.affiliateId, adminUser._id))
        .rejects.toThrow('Only pending affiliates can be approved');
    });

    it('should throw error for invalid admin', async () => {
      await expect(affiliateService.approveAffiliate(affiliate.affiliateId, new mongoose.Types.ObjectId()))
        .rejects.toThrow('Invalid admin user');
    });
  });
});