const asyncHandler = require('../middleware/asyncHandler');
const User = require('../models/userModel');
const CarBooking = require('../models/carBookingModel');
const Car = require('../models/carModel');
const { StatusCodes } = require('http-status-codes');
const ApiResponse = require('../utils/apiResponse');
const logger = require('../utils/logger');

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

  return ApiResponse.success(res, StatusCodes.OK, 'User statistics retrieved successfully', stats);
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

  return ApiResponse.success(res, StatusCodes.OK, 'Staff statistics retrieved successfully', stats);
});

/**
 * @desc    Get dashboard statistics for admin
 * @route   GET /api/v1/dashboard/admin/stats
 * @access  Private (Admin only)
 */
const getAdminStats = asyncHandler(async (req, res) => {
  try {
    logger.info('Starting getAdminStats...');
    
    // Debug: Check database connection
    logger.info(`Database connection state: ${require('mongoose').connection.readyState}`);
    
    // Get total users
    const totalUsers = await User.countDocuments();
    logger.info(`Total users count: ${totalUsers}`);
    
    // Debug: Get sample users to verify data exists
    const sampleUsers = await User.find().limit(3).select('firstName lastName email role');
    logger.info(`Sample users: ${JSON.stringify(sampleUsers)}`);

    // Get total bookings
    const totalBookings = await CarBooking.countDocuments();
    logger.info(`Total bookings count: ${totalBookings}`);

    // Get total cars
    const totalCars = await Car.countDocuments();
    logger.info(`Total cars count: ${totalCars}`);

    // Get total revenue
    const paidBookings = await CarBooking.find({ paymentStatus: 'paid' });
    logger.info(`Paid bookings count: ${paidBookings.length}`);
    const totalRevenue = paidBookings.reduce((sum, booking) => sum + (booking.totalAmount || 0), 0);
    logger.info(`Total revenue: ${totalRevenue}`);

    // Get users by role
    const usersByRole = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);
    logger.info(`Users by role: ${JSON.stringify(usersByRole)}`);

    // Get bookings by status
    const bookingsByStatus = await CarBooking.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    logger.info(`Bookings by status: ${JSON.stringify(bookingsByStatus)}`);

    // Get recent activity (last 10 bookings)
    const recentActivity = await CarBooking.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('user', 'firstName lastName email')
      .populate('car', 'name brand model')
      .select('bookingReference status totalAmount createdAt');
    logger.info(`Recent activity count: ${recentActivity.length}`);

    const stats = {
      totalUsers,
      totalBookings,
      totalCars,
      totalRevenue,
      usersByRole,
      bookingsByStatus,
      recentActivity
    };

    logger.info('Admin stats retrieved successfully');
    return ApiResponse.success(res, StatusCodes.OK, 'Admin statistics retrieved successfully', stats);
  } catch (error) {
    logger.error('Error in getAdminStats:', error);
    throw error;
  }
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

  return ApiResponse.success(res, StatusCodes.OK, 'Manager statistics retrieved successfully', stats);
});

/**
 * @desc    Get financial statistics for management (expenses & profit)
 * @route   GET /api/v1/dashboard/management/financial-stats
 * @access  Private (Management only - Admin, Executive, Manager, Department Heads)
 */
const getManagementFinancialStats = asyncHandler(async (req, res) => {
  const Ledger = require('../models/ledgerModel');
  
  // Get date range from query params (default to last 30 days)
  const { startDate, endDate, period = '30days' } = req.query;
  
  let dateFilter = {};
  const now = new Date();
  
  if (startDate && endDate) {
    dateFilter = {
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    };
  } else {
    // Default periods
    const periodDays = {
      '7days': 7,
      '30days': 30,
      '90days': 90,
      '365days': 365
    };
    
    const days = periodDays[period] || 30;
    const startPeriod = new Date();
    startPeriod.setDate(startPeriod.getDate() - days);
    
    dateFilter = {
      createdAt: { $gte: startPeriod }
    };
  }

  // Get total revenue (completed transactions)
  const revenueData = await Ledger.aggregate([
    {
      $match: {
        ...dateFilter,
        status: 'Completed'
      }
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$totalAmountPaid' },
        totalProfit: { $sum: '$profitMargin' },
        totalServiceCharge: { $sum: '$serviceCharge' },
        totalMarkup: { $sum: '$markupApplied' },
        transactionCount: { $sum: 1 }
      }
    }
  ]);

  const revenue = revenueData[0] || {
    totalRevenue: 0,
    totalProfit: 0,
    totalServiceCharge: 0,
    totalMarkup: 0,
    transactionCount: 0
  };

  // Calculate expenses (this is a simplified calculation)
  // In a real system, you'd have an Expenses model
  const estimatedExpenses = revenue.totalRevenue * 0.3; // Assume 30% operational costs
  const netProfit = revenue.totalProfit - estimatedExpenses;
  const profitMargin = revenue.totalRevenue > 0 
    ? ((netProfit / revenue.totalRevenue) * 100).toFixed(2) 
    : 0;

  // Revenue by service type
  const revenueByService = await Ledger.aggregate([
    {
      $match: {
        ...dateFilter,
        status: 'Completed'
      }
    },
    {
      $group: {
        _id: '$itemType',
        revenue: { $sum: '$totalAmountPaid' },
        profit: { $sum: '$profitMargin' },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { revenue: -1 }
    }
  ]);

  // Monthly trends (last 12 months)
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const monthlyTrends = await Ledger.aggregate([
    {
      $match: {
        createdAt: { $gte: twelveMonthsAgo },
        status: 'Completed'
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        revenue: { $sum: '$totalAmountPaid' },
        profit: { $sum: '$profitMargin' },
        transactions: { $sum: 1 }
      }
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1 }
    },
    {
      $project: {
        _id: 0,
        month: {
          $concat: [
            { $toString: '$_id.year' },
            '-',
            {
              $cond: [
                { $lt: ['$_id.month', 10] },
                { $concat: ['0', { $toString: '$_id.month' }] },
                { $toString: '$_id.month' }
              ]
            }
          ]
        },
        revenue: 1,
        profit: 1,
        expenses: { $multiply: ['$revenue', 0.3] }, // Estimated expenses
        transactions: 1
      }
    }
  ]);

  // Top performing services
  const topPerformingServices = revenueByService.slice(0, 5).map(service => ({
    service: service._id,
    revenue: service.revenue,
    profit: service.profit,
    transactions: service.count,
    profitMargin: service.revenue > 0 
      ? ((service.profit / service.revenue) * 100).toFixed(2) 
      : 0
  }));

  // Recent high-value transactions
  const recentTransactions = await Ledger.find({
    ...dateFilter,
    status: 'Completed'
  })
    .sort({ totalAmountPaid: -1 })
    .limit(10)
    .populate('userId', 'firstName lastName email')
    .select('transactionReference itemType totalAmountPaid profitMargin createdAt customerSegment');

  // Revenue by customer segment
  const revenueBySegment = await Ledger.aggregate([
    {
      $match: {
        ...dateFilter,
        status: 'Completed'
      }
    },
    {
      $group: {
        _id: '$customerSegment',
        revenue: { $sum: '$totalAmountPaid' },
        count: { $sum: 1 }
      }
    }
  ]);

  // Revenue by booking channel
  const revenueByChannel = await Ledger.aggregate([
    {
      $match: {
        ...dateFilter,
        status: 'Completed'
      }
    },
    {
      $group: {
        _id: '$bookingChannel',
        revenue: { $sum: '$totalAmountPaid' },
        count: { $sum: 1 }
      }
    }
  ]);

  const stats = {
    summary: {
      totalRevenue: revenue.totalRevenue,
      totalExpenses: estimatedExpenses,
      netProfit,
      profitMargin: parseFloat(profitMargin),
      totalTransactions: revenue.transactionCount,
      averageTransactionValue: revenue.transactionCount > 0 
        ? (revenue.totalRevenue / revenue.transactionCount).toFixed(2) 
        : 0
    },
    revenueByService: revenueByService.reduce((acc, item) => {
      acc[item._id.toLowerCase()] = {
        revenue: item.revenue,
        profit: item.profit,
        count: item.count
      };
      return acc;
    }, {}),
    expensesByCategory: {
      operations: estimatedExpenses * 0.4,
      marketing: estimatedExpenses * 0.25,
      salaries: estimatedExpenses * 0.25,
      infrastructure: estimatedExpenses * 0.1
    },
    monthlyTrends,
    topPerformingServices,
    recentTransactions,
    revenueBySegment,
    revenueByChannel
  };

  return ApiResponse.success(res, StatusCodes.OK, 'Management financial statistics retrieved successfully', stats);
});

module.exports = {
  getUserStats,
  getStaffStats,
  getAdminStats,
  getManagerStats,
  getManagementFinancialStats
};
