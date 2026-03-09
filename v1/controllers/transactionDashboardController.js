// v1/controllers/transactionDashboardController.js
const { StatusCodes } = require('http-status-codes');
const CarBooking = require('../models/carBookingModel');
const { ApiError } = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../middleware/asyncHandler');
const logger = require('../utils/logger');

/**
 * @desc    Get all transactions with filters
 * @route   GET /api/v1/dashboard/transactions
 * @access  Private/Staff (Tier 2+) or Admin
 */
const getAllTransactions = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    paymentStatus,
    currency,
    startDate,
    endDate,
    search,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = req.query;

  // Build filter query
  const filter = {};

  if (status) {
    filter.status = status;
  }

  if (paymentStatus) {
    filter.paymentStatus = paymentStatus;
  }

  if (currency) {
    filter.currency = currency.toUpperCase();
  }

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) {
      filter.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      filter.createdAt.$lte = new Date(endDate);
    }
  }

  if (search) {
    filter.$or = [
      { bookingReference: { $regex: search, $options: 'i' } },
      { 'driverInfo.email': { $regex: search, $options: 'i' } },
      { 'driverInfo.firstName': { $regex: search, $options: 'i' } },
      { 'driverInfo.lastName': { $regex: search, $options: 'i' } },
    ];
  }

  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const sortOptions = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

  // Execute query
  const [transactions, total] = await Promise.all([
    CarBooking.find(filter)
      .populate('user', 'firstName lastName email')
      .populate('car', 'make model year')
      .populate('processedBy', 'firstName lastName')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    CarBooking.countDocuments(filter),
  ]);

  ApiResponse.success(res, StatusCodes.OK, 'Transactions fetched successfully', {
    transactions,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
});

/**
 * @desc    Get transaction analytics
 * @route   GET /api/v1/dashboard/transactions/analytics
 * @access  Private/Staff (Tier 2+) or Admin
 */
const getTransactionAnalytics = asyncHandler(async (req, res) => {
  const { startDate, endDate, currency } = req.query;

  // Build date filter
  const dateFilter = {};
  if (startDate || endDate) {
    dateFilter.createdAt = {};
    if (startDate) {
      dateFilter.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.createdAt.$lte = new Date(endDate);
    }
  }

  // Revenue by currency
  const revenueByCurrency = await CarBooking.aggregate([
    { $match: { paymentStatus: 'paid', ...dateFilter } },
    {
      $group: {
        _id: '$currency',
        totalRevenue: { $sum: '$totalAmount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { totalRevenue: -1 } },
  ]);

  // Revenue over time (daily for last 30 days or specified range)
  const revenueOverTime = await CarBooking.aggregate([
    { $match: { paymentStatus: 'paid', ...dateFilter } },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          currency: '$currency',
        },
        revenue: { $sum: '$totalAmount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.date': 1 } },
  ]);

  // Bookings by status
  const bookingsByStatus = await CarBooking.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$totalAmount' },
      },
    },
  ]);

  // Payment status distribution
  const paymentStatusDistribution = await CarBooking.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: '$paymentStatus',
        count: { $sum: 1 },
        totalAmount: { $sum: '$totalAmount' },
      },
    },
  ]);

  // Top performing cars
  const topCars = await CarBooking.aggregate([
    { $match: { paymentStatus: 'paid', ...dateFilter } },
    {
      $group: {
        _id: '$car',
        bookings: { $sum: 1 },
        revenue: { $sum: '$totalAmount' },
      },
    },
    { $sort: { revenue: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'cars',
        localField: '_id',
        foreignField: '_id',
        as: 'carDetails',
      },
    },
    { $unwind: '$carDetails' },
    {
      $project: {
        _id: 1,
        bookings: 1,
        revenue: 1,
        make: '$carDetails.make',
        model: '$carDetails.model',
        year: '$carDetails.year',
      },
    },
  ]);

  // Summary statistics
  const summary = await CarBooking.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: null,
        totalBookings: { $sum: 1 },
        totalRevenue: {
          $sum: {
            $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$totalAmount', 0],
          },
        },
        pendingBookings: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
        },
        confirmedBookings: {
          $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] },
        },
        completedBookings: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
        },
        cancelledBookings: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
        },
      },
    },
  ]);

  ApiResponse.success(res, StatusCodes.OK, 'Analytics fetched successfully', {
    revenueByCurrency,
    revenueOverTime,
    bookingsByStatus,
    paymentStatusDistribution,
    topCars,
    summary: summary[0] || {
      totalBookings: 0,
      totalRevenue: 0,
      pendingBookings: 0,
      confirmedBookings: 0,
      completedBookings: 0,
      cancelledBookings: 0,
    },
  });
});

/**
 * @desc    Export transactions to CSV
 * @route   GET /api/v1/dashboard/transactions/export
 * @access  Private/Staff (Tier 2+) or Admin
 */
const exportTransactions = asyncHandler(async (req, res) => {
  const { status, paymentStatus, currency, startDate, endDate } = req.query;

  // Build filter query
  const filter = {};

  if (status) {
    filter.status = status;
  }

  if (paymentStatus) {
    filter.paymentStatus = paymentStatus;
  }

  if (currency) {
    filter.currency = currency.toUpperCase();
  }

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) {
      filter.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      filter.createdAt.$lte = new Date(endDate);
    }
  }

  // Fetch all matching transactions
  const transactions = await CarBooking.find(filter)
    .populate('user', 'firstName lastName email')
    .populate('car', 'make model year')
    .sort({ createdAt: -1 })
    .lean();

  // Convert to CSV format
  const csvHeader = [
    'Booking Reference',
    'Date',
    'Customer Name',
    'Customer Email',
    'Car',
    'Pickup Date',
    'Return Date',
    'Amount',
    'Currency',
    'Status',
    'Payment Status',
  ].join(',');

  const csvRows = transactions.map((t) => {
    const customerName = t.user
      ? `${t.user.firstName} ${t.user.lastName}`
      : `${t.driverInfo.firstName} ${t.driverInfo.lastName}`;
    const customerEmail = t.user ? t.user.email : t.driverInfo.email;
    const car = t.car ? `${t.car.make} ${t.car.model} ${t.car.year}` : 'N/A';

    return [
      t.bookingReference,
      new Date(t.createdAt).toISOString().split('T')[0],
      customerName,
      customerEmail,
      car,
      new Date(t.pickupDate).toISOString().split('T')[0],
      new Date(t.returnDate).toISOString().split('T')[0],
      t.totalAmount,
      t.currency || 'NGN',
      t.status,
      t.paymentStatus,
    ].join(',');
  });

  const csv = [csvHeader, ...csvRows].join('\n');

  // Set headers for CSV download
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=transactions-${Date.now()}.csv`
  );

  res.send(csv);
});

module.exports = {
  getAllTransactions,
  getTransactionAnalytics,
  exportTransactions,
};
