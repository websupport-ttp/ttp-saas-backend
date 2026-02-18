// v1/controllers/bookingController.js

const asyncHandler = require('../middleware/asyncHandler');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const { StatusCodes } = require('http-status-codes');
const logger = require('../utils/logger');

// Import models
const FlightBooking = require('../models/flightModel');
const HotelBooking = require('../models/hotelModel');
const Booking = require('../models/bookingModel');
const InsurancePolicy = require('../models/insuranceModel');
const VisaApplication = require('../models/visaApplicationModel');

// Import services
const amadeusXmlService = require('../services/amadeusXmlService');
const ratehawkService = require('../services/ratehawkService');
const sanlamAllianzService = require('../services/allianzService');
const paystackService = require('../services/paystackService');

/**
 * @description Flight search controller
 * @route POST /api/v1/bookings/flights/search
 * @access Public
 */
const searchFlights = asyncHandler(async (req, res) => {
  const { 
    origin, 
    destination, 
    departureDate, 
    returnDate, 
    passengers, 
    class: travelClass 
  } = req.body;

  // Validate required fields
  if (!origin || !destination || !departureDate || !passengers) {
    throw new ApiError('Missing required fields', StatusCodes.BAD_REQUEST);
  }

  try {
    // Use Amadeus XML service for flight search
    const searchResults = await amadeusXmlService.searchFlights({
      origin,
      destination,
      departureDate,
      returnDate,
      passengers,
      class: travelClass || 'economy'
    });

    res.status(StatusCodes.OK).json(
      new ApiResponse(
        StatusCodes.OK,
        searchResults,
        'Flight search completed successfully'
      )
    );
  } catch (error) {
    logger.error('Flight search error:', error);
    
    // Fallback to mock data if service is unavailable
    const mockResults = {
      data: [
        {
          id: 'MOCK-FL-001',
          price: { total: '450000', currency: 'NGN' },
          itineraries: [{
            outbound: [{
              airline: { code: 'AA', name: 'American Airlines' },
              flightNumber: 'AA123',
              departure: {
                airport: { code: origin, name: 'Origin Airport' },
                dateTime: new Date(departureDate + 'T10:00:00Z')
              },
              arrival: {
                airport: { code: destination, name: 'Destination Airport' },
                dateTime: new Date(departureDate + 'T18:00:00Z')
              },
              duration: 480
            }]
          }]
        }
      ],
      meta: { count: 1 }
    };
    
    res.status(StatusCodes.OK).json(
      new ApiResponse(
        StatusCodes.OK,
        mockResults,
        'Flight search completed (mock data - service unavailable)'
      )
    );
  }
});

/**
 * @description Flight booking controller
 * @route POST /api/v1/bookings/flights/book
 * @access Private
 */
const bookFlight = asyncHandler(async (req, res) => {
  const { 
    offerId, 
    passengers, 
    contactInfo,
    paymentMethod = 'paystack',
    itinerary,
    pricing
  } = req.body;

  if (!passengers || !contactInfo || !itinerary || !pricing) {
    throw new ApiError('Missing required booking information', StatusCodes.BAD_REQUEST);
  }

  try {
    // Create flight booking record
    const flightBooking = new FlightBooking({
      userId: req.user.id,
      contactInfo,
      passengers,
      itinerary,
      pricing,
      tripType: itinerary.return && itinerary.return.length > 0 ? 'round-trip' : 'one-way',
      amadeusData: {
        offerId,
        sessionId: req.sessionID
      }
    });

    await flightBooking.save();

    // Create unified booking record
    const booking = new Booking({
      userId: req.user.id,
      type: 'flight',
      flightBooking: flightBooking._id,
      contactInfo,
      pricing,
      metadata: {
        source: 'web',
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip
      }
    });

    await booking.save();

    // Process payment
    if (paymentMethod === 'paystack') {
      const paymentData = await paystackService.initializePayment({
        email: contactInfo.email,
        amount: pricing.total, // Amount in Naira, Paystack service will convert to kobo
        reference: booking.bookingReference,
        callback_url: `${process.env.FRONTEND_URL}/success?service=flight`
      });

      booking.payment.reference = paymentData.reference;
      booking.payment.method = 'paystack';
      await booking.save();

      flightBooking.payment.reference = paymentData.reference;
      flightBooking.payment.method = 'paystack';
      await flightBooking.save();

      res.status(StatusCodes.CREATED).json(
        new ApiResponse(
          StatusCodes.CREATED,
          {
            booking: booking.toObject(),
            flightBooking: flightBooking.toObject(),
            paymentUrl: paymentData.authorization_url
          },
          'Flight booking created successfully'
        )
      );
    } else {
      res.status(StatusCodes.CREATED).json(
        new ApiResponse(
          StatusCodes.CREATED,
          {
            booking: booking.toObject(),
            flightBooking: flightBooking.toObject()
          },
          'Flight booking created successfully'
        )
      );
    }
  } catch (error) {
    logger.error('Flight booking error:', error);
    throw new ApiError(
      'Flight booking failed. Please try again.',
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
});

/**
 * @description Hotel search controller
 * @route POST /api/v1/bookings/hotels/search
 * @access Public
 */
const searchHotels = asyncHandler(async (req, res) => {
  const { 
    destination, 
    checkIn, 
    checkOut, 
    guests,
    rooms = 1
  } = req.body;

  if (!destination || !checkIn || !checkOut || !guests) {
    throw new ApiError('Missing required fields', StatusCodes.BAD_REQUEST);
  }

  try {
    const searchResults = await ratehawkService.searchHotels({
      destination,
      checkIn,
      checkOut,
      guests,
      rooms
    });

    res.status(StatusCodes.OK).json(
      new ApiResponse(
        StatusCodes.OK,
        searchResults,
        'Hotel search completed successfully'
      )
    );
  } catch (error) {
    logger.error('Hotel search error:', error);
    
    // Fallback to mock data
    const mockResults = {
      data: [
        {
          id: 'MOCK-HTL-001',
          name: 'Sample Hotel',
          address: {
            city: destination,
            country: 'Nigeria'
          },
          rating: { stars: 4, score: 8.5 },
          pricing: {
            total: 85000,
            currency: 'NGN',
            perNight: 42500
          },
          amenities: ['WiFi', 'Pool', 'Gym', 'Restaurant']
        }
      ],
      meta: { count: 1 }
    };
    
    res.status(StatusCodes.OK).json(
      new ApiResponse(
        StatusCodes.OK,
        mockResults,
        'Hotel search completed (mock data - service unavailable)'
      )
    );
  }
});

/**
 * @description Hotel booking controller
 * @route POST /api/v1/bookings/hotels/book
 * @access Private
 */
const bookHotel = asyncHandler(async (req, res) => {
  const { 
    hotel,
    stay,
    rooms,
    guests,
    contactInfo,
    pricing,
    paymentMethod = 'paystack'
  } = req.body;

  if (!hotel || !stay || !rooms || !guests || !contactInfo || !pricing) {
    throw new ApiError('Missing required booking information', StatusCodes.BAD_REQUEST);
  }

  try {
    // Create hotel booking record
    const hotelBooking = new HotelBooking({
      userId: req.user.id,
      contactInfo,
      hotel,
      stay,
      rooms,
      guests,
      pricing,
      ratehawkData: {
        searchId: req.body.searchId,
        hotelId: hotel.id,
        rateId: req.body.rateId
      }
    });

    await hotelBooking.save();

    // Create unified booking record
    const booking = new Booking({
      userId: req.user.id,
      type: 'hotel',
      hotelBooking: hotelBooking._id,
      contactInfo,
      pricing,
      metadata: {
        source: 'web',
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip
      }
    });

    await booking.save();

    // Process payment
    if (paymentMethod === 'paystack') {
      const paymentData = await paystackService.initializePayment({
        email: contactInfo.email,
        amount: pricing.total, // Amount in Naira, Paystack service will convert to kobo
        reference: booking.bookingReference,
        callback_url: `${process.env.FRONTEND_URL}/hotels/payment/callback`
      });

      booking.payment.reference = paymentData.reference;
      booking.payment.method = 'paystack';
      await booking.save();

      hotelBooking.payment.reference = paymentData.reference;
      hotelBooking.payment.method = 'paystack';
      await hotelBooking.save();

      res.status(StatusCodes.CREATED).json(
        new ApiResponse(
          StatusCodes.CREATED,
          {
            booking: booking.toObject(),
            hotelBooking: hotelBooking.toObject(),
            paymentUrl: paymentData.authorization_url
          },
          'Hotel booking created successfully'
        )
      );
    } else {
      res.status(StatusCodes.CREATED).json(
        new ApiResponse(
          StatusCodes.CREATED,
          {
            booking: booking.toObject(),
            hotelBooking: hotelBooking.toObject()
          },
          'Hotel booking created successfully'
        )
      );
    }
  } catch (error) {
    logger.error('Hotel booking error:', error);
    throw new ApiError(
      'Hotel booking failed. Please try again.',
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
});

/**
 * @description Visa application controller
 * @route POST /api/v1/bookings/visa/apply
 * @access Private
 */
const applyVisa = asyncHandler(async (req, res) => {
  const { 
    destination, 
    applicantInfo, 
    documents,
    consultancyFee = 50000 // Default fee in kobo (500 NGN)
  } = req.body;

  if (!destination || !applicantInfo) {
    throw new ApiError('Missing required application information', StatusCodes.BAD_REQUEST);
  }

  try {
    // Create visa application record
    const visaApplication = new VisaApplication({
      userId: req.user.id,
      destination,
      applicantInfo,
      documents: documents || [],
      consultancyFee,
      status: 'pending'
    });

    await visaApplication.save();

    // Create unified booking record
    const booking = new Booking({
      userId: req.user.id,
      type: 'visa',
      visaApplication: visaApplication._id,
      contactInfo: {
        email: applicantInfo.email,
        phone: applicantInfo.phone,
        firstName: applicantInfo.firstName,
        lastName: applicantInfo.lastName
      },
      pricing: {
        subtotal: consultancyFee / 100,
        taxes: 0,
        fees: 0,
        total: consultancyFee / 100
      },
      metadata: {
        source: 'web',
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip
      }
    });

    await booking.save();

    // Initialize payment for consultancy fee
    const paymentData = await paystackService.initializePayment({
      email: applicantInfo.email,
      amount: consultancyFee,
      reference: booking.bookingReference,
      callback_url: `${process.env.FRONTEND_URL}/visa/payment/callback`
    });

    booking.payment.reference = paymentData.reference;
    booking.payment.method = 'paystack';
    await booking.save();

    res.status(StatusCodes.CREATED).json(
      new ApiResponse(
        StatusCodes.CREATED,
        {
          booking: booking.toObject(),
          visaApplication: visaApplication.toObject(),
          paymentUrl: paymentData.authorization_url
        },
        'Visa application submitted successfully'
      )
    );
  } catch (error) {
    logger.error('Visa application error:', error);
    throw new ApiError(
      'Visa application failed. Please try again.',
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
});

/**
 * @description Insurance quote controller
 * @route POST /api/v1/bookings/insurance/quote
 * @access Public
 */
const getInsuranceQuote = asyncHandler(async (req, res) => {
  const { 
    destination, 
    travelDates, 
    travelers,
    coverageType = 'comprehensive'
  } = req.body;

  if (!destination || !travelDates || !travelers) {
    throw new ApiError('Missing required fields', StatusCodes.BAD_REQUEST);
  }

  try {
    const quote = await sanlamAllianzService.getQuote({
      destination,
      travelDates,
      travelers,
      coverageType
    });

    res.status(StatusCodes.OK).json(
      new ApiResponse(
        StatusCodes.OK,
        quote,
        'Insurance quote generated successfully'
      )
    );
  } catch (error) {
    logger.error('Insurance quote error:', error);
    
    // Fallback to mock quote
    const mockQuote = {
      quoteId: `QUOTE-${Date.now()}`,
      premium: {
        amount: 25000,
        currency: 'NGN'
      },
      coverage: [
        { type: 'Medical Emergency', limit: 1000000 },
        { type: 'Trip Cancellation', limit: 500000 },
        { type: 'Baggage Loss', limit: 100000 }
      ],
      validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000)
    };
    
    res.status(StatusCodes.OK).json(
      new ApiResponse(
        StatusCodes.OK,
        mockQuote,
        'Insurance quote generated (mock data - service unavailable)'
      )
    );
  }
});

/**
 * @description Insurance purchase controller
 * @route POST /api/v1/bookings/insurance/purchase
 * @access Private
 */
const purchaseInsurance = asyncHandler(async (req, res) => {
  const { 
    quoteId, 
    policyHolder, 
    beneficiaries,
    trip,
    coverage,
    premium,
    paymentMethod = 'paystack'
  } = req.body;

  if (!quoteId || !policyHolder || !trip || !coverage || !premium) {
    throw new ApiError('Missing required policy information', StatusCodes.BAD_REQUEST);
  }

  try {
    // Create insurance policy record
    const insurancePolicy = new InsurancePolicy({
      userId: req.user.id,
      provider: {
        name: 'SanlamAllianz',
        code: 'SA',
        contact: {
          phone: '+234-1-234-5678',
          email: 'support@sanlamallianz.com.ng',
          website: 'https://sanlamallianz.com.ng'
        }
      },
      policyHolder,
      trip,
      coverage,
      beneficiaries: beneficiaries || [],
      premium,
      effectiveDate: trip.startDate,
      expiryDate: trip.endDate,
      sanlamAllianzData: {
        quoteId
      }
    });

    await insurancePolicy.save();

    // Create unified booking record
    const booking = new Booking({
      userId: req.user.id,
      type: 'insurance',
      insurancePolicy: insurancePolicy._id,
      contactInfo: {
        email: policyHolder.email,
        phone: policyHolder.phone,
        firstName: policyHolder.firstName,
        lastName: policyHolder.lastName
      },
      pricing: {
        subtotal: premium.amount,
        taxes: 0,
        fees: 0,
        total: premium.amount
      },
      metadata: {
        source: 'web',
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip
      }
    });

    await booking.save();

    // Process payment
    if (paymentMethod === 'paystack') {
      const paymentData = await paystackService.initializePayment({
        email: policyHolder.email,
        amount: premium.amount, // Amount in Naira, Paystack service will convert to kobo
        reference: booking.bookingReference,
        callback_url: `${process.env.FRONTEND_URL}/insurance/payment/callback`
      });

      booking.payment.reference = paymentData.reference;
      booking.payment.method = 'paystack';
      await booking.save();

      insurancePolicy.payment.reference = paymentData.reference;
      insurancePolicy.payment.method = 'paystack';
      await insurancePolicy.save();

      res.status(StatusCodes.CREATED).json(
        new ApiResponse(
          StatusCodes.CREATED,
          {
            booking: booking.toObject(),
            insurancePolicy: insurancePolicy.toObject(),
            paymentUrl: paymentData.authorization_url
          },
          'Insurance policy created successfully'
        )
      );
    } else {
      res.status(StatusCodes.CREATED).json(
        new ApiResponse(
          StatusCodes.CREATED,
          {
            booking: booking.toObject(),
            insurancePolicy: insurancePolicy.toObject()
          },
          'Insurance policy created successfully'
        )
      );
    }
  } catch (error) {
    logger.error('Insurance purchase error:', error);
    throw new ApiError(
      'Insurance purchase failed. Please try again.',
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
});

/**
 * @description Payment verification controller
 * @route POST /api/v1/bookings/payment/verify
 * @access Private
 */
const verifyPayment = asyncHandler(async (req, res) => {
  const { reference } = req.body;

  if (!reference) {
    throw new ApiError('Missing payment reference', StatusCodes.BAD_REQUEST);
  }

  try {
    const verification = await paystackService.verifyPayment(reference);
    
    if (verification.status === 'success') {
      // Find and update booking
      const booking = await Booking.findOne({ 'payment.reference': reference });
      
      if (!booking) {
        throw new ApiError('Booking not found', StatusCodes.NOT_FOUND);
      }

      // Update booking payment status
      booking.payment.status = 'paid';
      booking.payment.paidAt = new Date();
      booking.status = 'confirmed';
      await booking.save();

      // Update specific booking model
      let updatedRecord;
      
      switch (booking.type) {
        case 'flight':
          updatedRecord = await FlightBooking.findById(booking.flightBooking);
          if (updatedRecord) {
            updatedRecord.payment.status = 'paid';
            updatedRecord.payment.paidAt = new Date();
            updatedRecord.status = 'confirmed';
            await updatedRecord.save();
          }
          break;
        case 'hotel':
          updatedRecord = await HotelBooking.findById(booking.hotelBooking);
          if (updatedRecord) {
            updatedRecord.payment.status = 'paid';
            updatedRecord.payment.paidAt = new Date();
            updatedRecord.status = 'confirmed';
            await updatedRecord.save();
          }
          break;
        case 'visa':
          updatedRecord = await VisaApplication.findById(booking.visaApplication);
          if (updatedRecord) {
            updatedRecord.paymentStatus = 'paid';
            updatedRecord.status = 'under_review';
            await updatedRecord.save();
          }
          break;
        case 'insurance':
          updatedRecord = await InsurancePolicy.findById(booking.insurancePolicy);
          if (updatedRecord) {
            updatedRecord.payment.status = 'paid';
            updatedRecord.payment.paidAt = new Date();
            updatedRecord.status = 'active';
            await updatedRecord.save();
          }
          break;
      }

      res.status(StatusCodes.OK).json(
        new ApiResponse(
          StatusCodes.OK,
          {
            verification,
            booking: booking.toObject(),
            specificBooking: updatedRecord?.toObject()
          },
          'Payment verified successfully'
        )
      );
    } else {
      throw new ApiError('Payment verification failed', StatusCodes.BAD_REQUEST);
    }
  } catch (error) {
    logger.error('Payment verification error:', error);
    throw new ApiError(
      'Payment verification failed. Please try again.',
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
});

/**
 * @description Get user bookings
 * @route GET /api/v1/bookings
 * @access Private
 */
const getUserBookings = asyncHandler(async (req, res) => {
  const { type, status, page = 1, limit = 10 } = req.query;
  
  const query = { userId: req.user.id };
  if (type) query.type = type;
  if (status) query.status = status;

  const skip = (page - 1) * limit;

  try {
    const bookings = await Booking.find(query)
      .populate([
        { path: 'flightBooking' },
        { path: 'hotelBooking' },
        { path: 'visaApplication' },
        { path: 'insurancePolicy' }
      ])
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Booking.countDocuments(query);

    res.status(StatusCodes.OK).json(
      new ApiResponse(
        StatusCodes.OK,
        {
          bookings,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        },
        'Bookings retrieved successfully'
      )
    );
  } catch (error) {
    logger.error('Get bookings error:', error);
    throw new ApiError(
      'Failed to retrieve bookings',
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
});

/**
 * @description Get booking by reference
 * @route GET /api/v1/bookings/:reference
 * @access Private
 */
const getBookingByReference = asyncHandler(async (req, res) => {
  const { reference } = req.params;

  try {
    const booking = await Booking.findOne({ 
      bookingReference: reference,
      userId: req.user.id 
    }).populate([
      { path: 'flightBooking' },
      { path: 'hotelBooking' },
      { path: 'visaApplication' },
      { path: 'insurancePolicy' }
    ]);

    if (!booking) {
      throw new ApiError('Booking not found', StatusCodes.NOT_FOUND);
    }

    res.status(StatusCodes.OK).json(
      new ApiResponse(
        StatusCodes.OK,
        booking,
        'Booking retrieved successfully'
      )
    );
  } catch (error) {
    logger.error('Get booking error:', error);
    throw new ApiError(
      'Failed to retrieve booking',
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
});

module.exports = {
  searchFlights,
  bookFlight,
  searchHotels,
  bookHotel,
  applyVisa,
  getInsuranceQuote,
  purchaseInsurance,
  verifyPayment,
  getUserBookings,
  getBookingByReference
};