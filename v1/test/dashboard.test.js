const request = require('supertest');
const { StatusCodes } = require('http-status-codes');
const app = require('../../app');
const User = require('../models/userModel');
const Car = require('../models/carModel');
const CarBooking = require('../models/carBookingModel');
const { connectDB, disconnectDB, clearDatabase } = require('./testSetup');

describe('Dashboard Statistics API', () => {
  let userToken, staffToken, adminToken, managerToken;
  let regularUser, staffUser, adminUser, managerUser;
  let testCar, testBooking;

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await clearDatabase();

    // Create test users
    regularUser = await User.create({
      firstName: 'Regular',
      lastName: 'User',
      email: 'regular@test.com',
      phoneNumber: '+2348012345678',
      password: 'Password123!',
      role: 'User',
      isEmailVerified: true
    });

    staffUser = await User.create({
      firstName: 'Staff',
      lastName: 'Member',
      email: 'staff@test.com',
      phoneNumber: '+2348012345679',
      password: 'Password123!',
      role: 'Staff',
      staffClearanceLevel: 2,
      employeeId: 'EMP-001',
      isEmailVerified: true
    });

    adminUser = await User.create({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@test.com',
      phoneNumber: '+2348012345680',
      password: 'Password123!',
      role: 'Admin',
      isEmailVerified: true
    });

    managerUser = await User.create({
      firstName: 'Manager',
      lastName: 'User',
      email: 'manager@test.com',
      phoneNumber: '+2348012345681',
      password: 'Password123!',
      role: 'Manager',
      isEmailVerified: true
    });

    // Login users to get tokens
    const userLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ emailOrPhone: 'regular@test.com', password: 'Password123!' });
    userToken = userLogin.body.data.token;

    const staffLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ emailOrPhone: 'staff@test.com', password: 'Password123!' });
    staffToken = staffLogin.body.data.token;

    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ emailOrPhone: 'admin@test.com', password: 'Password123!' });
    adminToken = adminLogin.body.data.token;

    const managerLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ emailOrPhone: 'manager@test.com', password: 'Password123!' });
    managerToken = managerLogin.body.data.token;

    // Create test car
    testCar = await Car.create({
      name: 'Test Car',
      brand: 'Toyota',
      model: 'Camry',
      year: 2024,
      type: 'sedan',
      capacity: 5,
      transmission: 'automatic',
      pricePerDay: 50,
      location: 'Lagos',
      availability: true,
      supplier: {
        name: 'Test Supplier',
        rating: 5
      }
    });

    // Create test booking
    testBooking = await CarBooking.create({
      user: regularUser._id,
      car: testCar._id,
      bookingReference: 'BK-TEST-001',
      pickupDate: new Date(Date.now() + 86400000),
      dropoffDate: new Date(Date.now() + 172800000),
      pickupLocation: 'Lagos Airport',
      dropoffLocation: 'Lagos Airport',
      totalPrice: 100,
      status: 'pending',
      paymentStatus: 'pending'
    });
  });

  describe('GET /api/v1/dashboard/stats', () => {
    it('should get user dashboard statistics', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toEqual(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('totalBookings');
      expect(res.body.data).toHaveProperty('pendingBookings');
      expect(res.body.data).toHaveProperty('activeBookings');
      expect(res.body.data).toHaveProperty('recentBookings');
      expect(res.body.data.totalBookings).toBe(1);
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/stats');

      expect(res.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
    });
  });

  describe('GET /api/v1/dashboard/staff/stats', () => {
    it('should get staff dashboard statistics', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/staff/stats')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.statusCode).toEqual(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('pendingBookings');
      expect(res.body.data).toHaveProperty('availableCars');
      expect(res.body.data).toHaveProperty('todayRevenue');
      expect(res.body.data).toHaveProperty('totalCars');
      expect(res.body.data.availableCars).toBe(1);
    });

    it('should deny access to regular users', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/staff/stats')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toEqual(StatusCodes.FORBIDDEN);
    });

    it('should allow admin access', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/staff/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(StatusCodes.OK);
    });
  });

  describe('GET /api/v1/dashboard/admin/stats', () => {
    it('should get admin dashboard statistics', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('totalUsers');
      expect(res.body.data).toHaveProperty('totalBookings');
      expect(res.body.data).toHaveProperty('totalCars');
      expect(res.body.data).toHaveProperty('totalRevenue');
      expect(res.body.data).toHaveProperty('usersByRole');
      expect(res.body.data).toHaveProperty('bookingsByStatus');
      expect(res.body.data).toHaveProperty('recentActivity');
      expect(res.body.data.totalUsers).toBe(4);
    });

    it('should deny access to non-admin users', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/admin/stats')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toEqual(StatusCodes.FORBIDDEN);
    });

    it('should deny access to staff users', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/admin/stats')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.statusCode).toEqual(StatusCodes.FORBIDDEN);
    });
  });

  describe('GET /api/v1/dashboard/manager/stats', () => {
    it('should get manager dashboard statistics', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/manager/stats')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.statusCode).toEqual(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('teamMembers');
      expect(res.body.data).toHaveProperty('completedToday');
      expect(res.body.data).toHaveProperty('pendingTasks');
      expect(res.body.data).toHaveProperty('performance');
      expect(res.body.data).toHaveProperty('revenueByDay');
      expect(res.body.data.teamMembers).toBe(1);
    });

    it('should allow admin access', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/manager/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(StatusCodes.OK);
    });

    it('should deny access to regular users', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/manager/stats')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toEqual(StatusCodes.FORBIDDEN);
    });
  });

  describe('Dashboard Statistics with Multiple Bookings', () => {
    beforeEach(async () => {
      // Create additional bookings
      await CarBooking.create({
        user: regularUser._id,
        car: testCar._id,
        bookingReference: 'BK-TEST-002',
        pickupDate: new Date(Date.now() + 86400000),
        dropoffDate: new Date(Date.now() + 172800000),
        pickupLocation: 'Lagos',
        dropoffLocation: 'Abuja',
        totalPrice: 200,
        status: 'confirmed',
        paymentStatus: 'paid'
      });

      await CarBooking.create({
        user: regularUser._id,
        car: testCar._id,
        bookingReference: 'BK-TEST-003',
        pickupDate: new Date(Date.now() - 86400000),
        dropoffDate: new Date(Date.now() + 86400000),
        pickupLocation: 'Abuja',
        dropoffLocation: 'Lagos',
        totalPrice: 150,
        status: 'active',
        paymentStatus: 'paid'
      });
    });

    it('should calculate correct totals', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.body.data.totalBookings).toBe(3);
      expect(res.body.data.pendingBookings).toBe(1);
      expect(res.body.data.activeBookings).toBe(2); // confirmed + active
    });

    it('should calculate correct revenue', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.body.data.totalRevenue).toBe(350); // 200 + 150 (paid bookings only)
    });
  });
});
