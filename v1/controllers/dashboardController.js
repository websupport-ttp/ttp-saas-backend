const asyncHandler = require('../middleware/asyncHandler');
const User = require('../models/userModel');
const CarBooking = require('../models/carBookingModel');
const Car = require('../models/carModel');
const { StatusCodes } = require('http-status-codes');
const ApiResponse = require('../utils/apiResponse');

/**
 * @desc    Get dashboard statistics for user
 * @route   GET /api/v1/dashboard/stats
 * @access  Private
 */
const getUserStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Get user's bookings count
  const bookingsCount = await CarBooking.countDocuments({ user: userId });

  // Get user's pending bookings
  const pendingBookings = await CarBooking.countDocuments({
    user: userId,
    status: 'pending'
  });

  // Get user's active bookings
  const activeBookings = await CarBooking.countDocuments({
    user: userId,
    status: { $in: ['confirmed', 'active'] }
  });

  // Get recent bookings
  const recentBookings = await CarBooking.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('car', 'name brand model images')
    .select('bookingReference status totalAmount pickupDate returnDate createdAt');

  const stats = {
    totalBookings: bookingsCount,
    pendingBookings,
    activeBookings,
    recentBookings
  };

  res.status(StatusCodes.OK).json(
    ApiResponse.success(stats, 'User statistics retrieved successfully')
  );
});

/**
 * @desc    Get dashboard statistics for staff
 * @route   GET /api/v1/dashboard/staff/stats
 * @access  Private (Staff only)
 */
const getStaffStats = asyncHandler(async (req, res) => {
  // Get pending bookings count
  const pendingBookings = await CarBooking.countDocuments({ status: 'pending' });

  // Get available cars count
  const availableCars = await Car.countDocuments({ availability: true });

  // Get today's revenue
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const todayBookings = await CarBooking.find({
    createdAt: { $gte: today },
    paymentStatus: 'paid'
  });

  const todayRevenue = todayBookings.reduce((sum, booking) => sum + booking.totalAmount, 0);

  // Get total cars
  const totalCars = await Car.countDocuments();

  const stats = {
    pendingBookings,
    availableCars,
    todayRevenue,
    totalCars
  };

  res.status(StatusCodes.OK).json(
    ApiResponse.success(stats, 'Staff statistics retrieved successfully')
  );
});

/**
 * @desc    Get dashboard statistics for admin
 * @route   GET /api/v1/dashboard/admin/stats
 * @access  Private (Admin only)
 */
const getAdminStats = asyncHandler(async (req, res) => {
  // Get total users
  const totalUsers = await User.countDocuments();

  // Get total bookings
  const totalBookings = await CarBooking.countDocuments();

  // Get total cars
  const totalCars = await Car.countDocuments();

  // Get total revenue
  const paidBookings = await CarBooking.find({ paymentStatus: 'paid' });
  const totalRevenue = paidBookings.reduce((sum, booking) => sum + booking.totalAmount, 0);

  // Get users by role
  const usersByRole = await User.aggregate([
    {
      $group: {
        _id: '$role',
        count: { $sum: 1 }
      }
    }
  ]);

  // Get bookings by status
  const bookingsByStatus = await CarBooking.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  // Get recent activity (last 10 bookings)
  const recentActivity = await CarBooking.find()
    .sort({ createdAt: -1 })
    .limit(10)
    .populate('user', 'firstName lastName email')
    .populate('car', 'name brand model')
    .select('bookingReference status totalAmount createdAt');

  const stats = {
    totalUsers,
    totalBookings,
    totalCars,
    totalRevenue,
    usersByRole,
    bookingsByStatus,
    recentActivity
  };

  ApiResponse.success(res, StatusCodes.OK, 'Admin statistics retrieved successfully', stats);
});

/**
 * @desc    Get dashboard statistics for manager
 * @route   GET /api/v1/dashboard/manager/stats
 * @access  Private (Manager/Executive only)
 */
const getManagerStats = asyncHandler(async (req, res) => {
  // Get team members count (staff users)
  const teamMembers = await User.countDocuments({ role: 'Staff' });

  // Get today's completed bookings
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const completedToday = await CarBooking.countDocuments({
    status: 'completed',
    updatedAt: { $gte: today }
  });

  // Get pending tasks (pending bookings)
  const pendingTasks = await CarBooking.countDocuments({ status: 'pending' });

  // Calculate performance (completion rate)
  const totalBookings = await CarBooking.countDocuments();
  const completedBookings = await CarBooking.countDocuments({ status: 'completed' });
  const performance = totalBookings > 0 ? Math.round((completedBookings / totalBookings) * 100) : 0;

  // Get revenue trend (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const revenueByDay = await CarBooking.aggregate([
    {
      $match: {
        createdAt: { $gte: sevenDaysAgo },
        paymentStatus: 'paid'
      }
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        revenue: { $sum: '$totalAmount' },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);

  const stats = {
    teamMembers,
    completedToday,
    pendingTasks,
    performance,
    revenueByDay
  };

  res.status(StatusCodes.OK).json(
    ApiResponse.success(stats, 'Manager statistics retrieved successfully')
  );
});

module.exports = {
  getUserStats,
  getStaffStats,
  getAdminStats,
  getManagerStats
};
