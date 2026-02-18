// v1/controllers/carHireController.js
const { StatusCodes } = require('http-status-codes');
const Car = require('../models/carModel');
const CarBooking = require('../models/carBookingModel');
const { ApiError } = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../middleware/asyncHandler');
const crypto = require('crypto');

/**
 * @description Get all cars (public)
 * @route GET /api/v1/products/car-hire
 * @access Public
 */
const getAllCars = asyncHandler(async (req, res) => {
  const { type, location, minPrice, maxPrice, transmission, capacity } = req.query;

  const query = { isActive: true, availability: true };

  if (type) query.type = type;
  if (location) query.location = new RegExp(location, 'i');
  if (transmission) query.transmission = transmission;
  if (capacity) query.capacity = { $gte: parseInt(capacity) };
  if (minPrice || maxPrice) {
    query.pricePerDay = {};
    if (minPrice) query.pricePerDay.$gte = parseFloat(minPrice);
    if (maxPrice) query.pricePerDay.$lte = parseFloat(maxPrice);
  }

  const cars = await Car.find(query).sort({ pricePerDay: 1 });

  ApiResponse.success(res, StatusCodes.OK, 'Cars fetched successfully', {
    count: cars.length,
    cars,
  });
});

/**
 * @description Get single car by ID (public)
 * @route GET /api/v1/products/car-hire/:id
 * @access Public
 */
const getCarById = asyncHandler(async (req, res) => {
  const car = await Car.findById(req.params.id);

  if (!car || !car.isActive) {
    throw new ApiError('Car not found', StatusCodes.NOT_FOUND);
  }

  ApiResponse.success(res, StatusCodes.OK, 'Car fetched successfully', { car });
});

/**
 * @description Create new car (Staff Tier 2+ only)
 * @route POST /api/v1/products/car-hire
 * @access Private/Staff (Tier 2+)
 */
const createCar = asyncHandler(async (req, res) => {
  const carData = {
    ...req.body,
    managedBy: req.user.userId,
  };

  const car = await Car.create(carData);

  ApiResponse.success(res, StatusCodes.CREATED, 'Car created successfully', { car });
});

/**
 * @description Update car (Staff Tier 2+ only)
 * @route PUT /api/v1/products/car-hire/:id
 * @access Private/Staff (Tier 2+)
 */
const updateCar = asyncHandler(async (req, res) => {
  const car = await Car.findById(req.params.id);

  if (!car) {
    throw new ApiError('Car not found', StatusCodes.NOT_FOUND);
  }

  // Update car fields
  Object.keys(req.body).forEach(key => {
    if (key !== 'managedBy') { // Prevent changing managedBy
      car[key] = req.body[key];
    }
  });

  await car.save();

  ApiResponse.success(res, StatusCodes.OK, 'Car updated successfully', { car });
});

/**
 * @description Delete car (Staff Tier 2+ only)
 * @route DELETE /api/v1/products/car-hire/:id
 * @access Private/Staff (Tier 2+)
 */
const deleteCar = asyncHandler(async (req, res) => {
  const car = await Car.findById(req.params.id);

  if (!car) {
    throw new ApiError('Car not found', StatusCodes.NOT_FOUND);
  }

  // Soft delete
  car.isActive = false;
  await car.save();

  ApiResponse.success(res, StatusCodes.OK, 'Car deleted successfully');
});

/**
 * @description Book a car
 * @route POST /api/v1/car-hire/book
 * @access Public (guests can book)
 */
const bookCar = asyncHandler(async (req, res) => {
  const {
    carId,
    pickupLocation,
    returnLocation,
    pickupDate,
    returnDate,
    driverInfo,
    emergencyContact,
    extras,
    specialRequests,
  } = req.body;

  // Verify car exists and is available
  const car = await Car.findById(carId);
  if (!car || !car.isActive || !car.availability) {
    throw new ApiError('Car not available', StatusCodes.BAD_REQUEST);
  }

  // Calculate total amount
  const days = Math.max(1, Math.ceil((new Date(returnDate) - new Date(pickupDate)) / (1000 * 60 * 60 * 24)));
  const totalAmount = car.pricePerDay * days;

  // Generate booking reference
  const bookingReference = `CAR-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const paymentReference = `PAY-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

  // Create booking (user field is optional for guest bookings)
  const bookingData = {
    bookingReference,
    car: carId,
    pickupLocation,
    returnLocation,
    pickupDate: new Date(pickupDate),
    returnDate: new Date(returnDate),
    driverInfo,
    emergencyContact,
    extras: extras || [],
    specialRequests: specialRequests || '',
    totalAmount,
    paymentReference,
  };

  // Add user ID if authenticated
  if (req.user && req.user.userId) {
    bookingData.user = req.user.userId;
  }

  const booking = await CarBooking.create(bookingData);

  // TODO: Initialize Paystack payment
  const authorizationUrl = `https://checkout.paystack.com/pay/${paymentReference}`;

  ApiResponse.success(res, StatusCodes.CREATED, 'Booking created successfully', {
    booking,
    bookingReference,
    paymentReference,
    authorizationUrl,
  });
});

/**
 * @description Get user's bookings
 * @route GET /api/v1/products/car-hire/my-bookings
 * @access Private
 */
const getMyBookings = asyncHandler(async (req, res) => {
  const bookings = await CarBooking.find({ user: req.user.userId })
    .populate('car')
    .sort({ createdAt: -1 });

  ApiResponse.success(res, StatusCodes.OK, 'Bookings fetched successfully', {
    count: bookings.length,
    bookings,
  });
});

/**
 * @description Get all bookings (Staff Tier 2+ only)
 * @route GET /api/v1/products/car-hire/bookings
 * @access Private/Staff (Tier 2+)
 */
const getAllBookings = asyncHandler(async (req, res) => {
  const { status, paymentStatus, startDate, endDate } = req.query;

  const query = {};

  if (status) query.status = status;
  if (paymentStatus) query.paymentStatus = paymentStatus;
  if (startDate || endDate) {
    query.pickupDate = {};
    if (startDate) query.pickupDate.$gte = new Date(startDate);
    if (endDate) query.pickupDate.$lte = new Date(endDate);
  }

  const bookings = await CarBooking.find(query)
    .populate('car')
    .populate('user', 'firstName lastName email phoneNumber')
    .populate('processedBy', 'firstName lastName')
    .sort({ createdAt: -1 });

  ApiResponse.success(res, StatusCodes.OK, 'Bookings fetched successfully', {
    count: bookings.length,
    bookings,
  });
});

/**
 * @description Process booking (Staff Tier 2+ only)
 * @route PUT /api/v1/products/car-hire/bookings/:id/process
 * @access Private/Staff (Tier 2+)
 */
const processBooking = asyncHandler(async (req, res) => {
  const { status, notes } = req.body;

  const booking = await CarBooking.findById(req.params.id);

  if (!booking) {
    throw new ApiError('Booking not found', StatusCodes.NOT_FOUND);
  }

  booking.status = status || booking.status;
  booking.notes = notes || booking.notes;
  booking.processedBy = req.user.userId;
  booking.processedAt = new Date();

  await booking.save();

  ApiResponse.success(res, StatusCodes.OK, 'Booking processed successfully', { booking });
});

module.exports = {
  getAllCars,
  getCarById,
  createCar,
  updateCar,
  deleteCar,
  bookCar,
  getMyBookings,
  getAllBookings,
  processBooking,
};
