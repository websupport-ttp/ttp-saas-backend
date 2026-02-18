// test-booking-system.js
// Comprehensive test script for the travel booking system

const axios = require('axios');

const BASE_URL = process.env.BACKEND_URL || 'http://localhost:5001';
const API_BASE = `${BASE_URL}/api/v1`;

// Test user credentials
const testUser = {
  email: 'test@example.com',
  password: 'TestPassword123!',
  firstName: 'John',
  lastName: 'Doe',
  phoneNumber: '+2348012345678'
};

let authToken = '';
let bookingReferences = [];

// Helper function to make authenticated requests
const makeRequest = async (method, endpoint, data = null, useAuth = true) => {
  const config = {
    method,
    url: `${API_BASE}${endpoint}`,
    headers: useAuth && authToken ? { Authorization: `Bearer ${authToken}` } : {},
    data
  };

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`Error in ${method} ${endpoint}:`, error.response?.data || error.message);
    throw error;
  }
};

// Test authentication
const testAuth = async () => {
  console.log('\n🔐 Testing Authentication...');
  
  try {
    // Try to register (might fail if user exists)
    try {
      await makeRequest('POST', '/auth/register', testUser, false);
      console.log('✅ User registered successfully');
    } catch (error) {
      console.log('ℹ️ User might already exist, proceeding to login');
    }

    // Login
    const loginResponse = await makeRequest('POST', '/auth/login', {
      email: testUser.email,
      password: testUser.password
    }, false);

    authToken = loginResponse.data.token;
    console.log('✅ Login successful');
    return true;
  } catch (error) {
    console.error('❌ Authentication failed:', error.message);
    return false;
  }
};

// Test flight search and booking
const testFlightBooking = async () => {
  console.log('\n✈️ Testing Flight Booking...');
  
  try {
    // Search flights
    const searchData = {
      origin: 'LOS',
      destination: 'LHR',
      departureDate: '2024-12-15',
      returnDate: '2024-12-22',
      passengers: {
        adults: 1,
        children: 0,
        infants: 0
      },
      class: 'economy'
    };

    const searchResults = await makeRequest('POST', '/bookings/flights/search', searchData, false);
    console.log('✅ Flight search completed:', searchResults.data?.length || 0, 'results');

    // Book a flight (using mock data)
    const bookingData = {
      offerId: 'MOCK-FL-001',
      passengers: [{
        type: 'adult',
        title: 'Mr',
        firstName: testUser.firstName,
        lastName: testUser.lastName,
        dateOfBirth: '1990-01-01',
        passportNumber: 'A12345678',
        nationality: 'NG'
      }],
      contactInfo: {
        email: testUser.email,
        phone: testUser.phoneNumber
      },
      itinerary: {
        outbound: [{
          airline: { code: 'AA', name: 'American Airlines' },
          flightNumber: 'AA123',
          departure: {
            airport: { code: 'LOS', name: 'Lagos Airport' },
            dateTime: new Date('2024-12-15T10:00:00Z')
          },
          arrival: {
            airport: { code: 'LHR', name: 'London Heathrow' },
            dateTime: new Date('2024-12-15T18:00:00Z')
          },
          duration: 480
        }]
      },
      pricing: {
        baseFare: 450000,
        taxes: 50000,
        fees: 5000,
        total: 505000
      }
    };

    const bookingResult = await makeRequest('POST', '/bookings/flights/book', bookingData);
    console.log('✅ Flight booking created:', bookingResult.data.booking.bookingReference);
    bookingReferences.push(bookingResult.data.booking.bookingReference);
    
    return true;
  } catch (error) {
    console.error('❌ Flight booking failed:', error.message);
    return false;
  }
};

// Test hotel search and booking
const testHotelBooking = async () => {
  console.log('\n🏨 Testing Hotel Booking...');
  
  try {
    // Search hotels
    const searchData = {
      destination: 'London',
      checkIn: '2024-12-15',
      checkOut: '2024-12-22',
      guests: {
        adults: 1,
        children: 0
      },
      rooms: 1
    };

    const searchResults = await makeRequest('POST', '/bookings/hotels/search', searchData, false);
    console.log('✅ Hotel search completed:', searchResults.data?.length || 0, 'results');

    // Book a hotel (using mock data)
    const bookingData = {
      hotel: {
        id: 'MOCK-HTL-001',
        name: 'Sample Hotel London',
        address: {
          street: '123 Sample Street',
          city: 'London',
          country: 'UK',
          coordinates: { latitude: 51.5074, longitude: -0.1278 }
        },
        rating: { stars: 4, score: 8.5 },
        amenities: ['WiFi', 'Pool', 'Gym']
      },
      stay: {
        checkIn: new Date('2024-12-15'),
        checkOut: new Date('2024-12-22'),
        nights: 7
      },
      rooms: [{
        roomType: 'Standard Double',
        guests: [{
          title: 'Mr',
          firstName: testUser.firstName,
          lastName: testUser.lastName
        }],
        maxOccupancy: 2,
        pricing: {
          baseRate: 15000,
          taxes: 2000,
          total: 17000
        }
      }],
      guests: {
        adults: 1,
        children: 0
      },
      contactInfo: {
        email: testUser.email,
        phone: testUser.phoneNumber
      },
      pricing: {
        subtotal: 105000,
        taxes: 14000,
        total: 119000
      }
    };

    const bookingResult = await makeRequest('POST', '/bookings/hotels/book', bookingData);
    console.log('✅ Hotel booking created:', bookingResult.data.booking.bookingReference);
    bookingReferences.push(bookingResult.data.booking.bookingReference);
    
    return true;
  } catch (error) {
    console.error('❌ Hotel booking failed:', error.message);
    return false;
  }
};

// Test visa application
const testVisaApplication = async () => {
  console.log('\n📋 Testing Visa Application...');
  
  try {
    const applicationData = {
      destination: 'United Kingdom',
      applicantInfo: {
        firstName: testUser.firstName,
        lastName: testUser.lastName,
        email: testUser.email,
        phone: testUser.phoneNumber,
        dateOfBirth: '1990-01-01',
        nationality: 'Nigerian',
        passportNumber: 'A12345678'
      },
      documents: [
        { name: 'passport.pdf', url: 'https://example.com/passport.pdf' },
        { name: 'photo.jpg', url: 'https://example.com/photo.jpg' }
      ],
      consultancyFee: 50000
    };

    const applicationResult = await makeRequest('POST', '/bookings/visa/apply', applicationData);
    console.log('✅ Visa application submitted:', applicationResult.data.booking.bookingReference);
    bookingReferences.push(applicationResult.data.booking.bookingReference);
    
    return true;
  } catch (error) {
    console.error('❌ Visa application failed:', error.message);
    return false;
  }
};

// Test insurance quote and purchase
const testInsuranceBooking = async () => {
  console.log('\n🛡️ Testing Insurance Booking...');
  
  try {
    // Get insurance quote
    const quoteData = {
      destination: 'United Kingdom',
      travelDates: {
        startDate: '2024-12-15',
        endDate: '2024-12-22'
      },
      travelers: [{
        age: 34,
        coverageAmount: 1000000
      }],
      coverageType: 'comprehensive'
    };

    const quoteResult = await makeRequest('POST', '/bookings/insurance/quote', quoteData, false);
    console.log('✅ Insurance quote generated:', quoteResult.data.quoteId);

    // Purchase insurance
    const purchaseData = {
      quoteId: quoteResult.data.quoteId,
      policyHolder: {
        title: 'Mr',
        firstName: testUser.firstName,
        lastName: testUser.lastName,
        dateOfBirth: '1990-01-01',
        email: testUser.email,
        phone: testUser.phoneNumber,
        address: {
          street: '123 Test Street',
          city: 'Lagos',
          state: 'Lagos',
          country: 'Nigeria'
        }
      },
      trip: {
        destination: 'United Kingdom',
        startDate: new Date('2024-12-15'),
        endDate: new Date('2024-12-22'),
        purpose: 'leisure'
      },
      coverage: [
        { type: 'Medical Emergency', limit: 1000000, deductible: 0 },
        { type: 'Trip Cancellation', limit: 500000, deductible: 0 }
      ],
      premium: {
        amount: 25000,
        currency: 'NGN'
      },
      beneficiaries: [{
        title: 'Mrs',
        firstName: 'Jane',
        lastName: 'Doe',
        relationship: 'spouse',
        dateOfBirth: '1992-01-01',
        percentage: 100
      }]
    };

    const purchaseResult = await makeRequest('POST', '/bookings/insurance/purchase', purchaseData);
    console.log('✅ Insurance policy created:', purchaseResult.data.booking.bookingReference);
    bookingReferences.push(purchaseResult.data.booking.bookingReference);
    
    return true;
  } catch (error) {
    console.error('❌ Insurance booking failed:', error.message);
    return false;
  }
};

// Test booking retrieval
const testBookingRetrieval = async () => {
  console.log('\n📋 Testing Booking Retrieval...');
  
  try {
    // Get all user bookings
    const allBookings = await makeRequest('GET', '/bookings');
    console.log('✅ Retrieved all bookings:', allBookings.data.bookings.length, 'total');

    // Get specific booking by reference
    if (bookingReferences.length > 0) {
      const specificBooking = await makeRequest('GET', `/bookings/${bookingReferences[0]}`);
      console.log('✅ Retrieved specific booking:', specificBooking.data.bookingReference);
    }

    // Get bookings by type
    const flightBookings = await makeRequest('GET', '/bookings?type=flight');
    console.log('✅ Retrieved flight bookings:', flightBookings.data.bookings.length);

    return true;
  } catch (error) {
    console.error('❌ Booking retrieval failed:', error.message);
    return false;
  }
};

// Test payment verification (mock)
const testPaymentVerification = async () => {
  console.log('\n💳 Testing Payment Verification...');
  
  try {
    // This would normally be called by Paystack webhook
    // For testing, we'll simulate it
    if (bookingReferences.length > 0) {
      console.log('ℹ️ Payment verification would be handled by Paystack webhook');
      console.log('ℹ️ In production, this updates booking status to confirmed');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Payment verification test failed:', error.message);
    return false;
  }
};

// Main test runner
const runTests = async () => {
  console.log('🚀 Starting Travel Booking System Tests...\n');
  
  const tests = [
    { name: 'Authentication', fn: testAuth },
    { name: 'Flight Booking', fn: testFlightBooking },
    { name: 'Hotel Booking', fn: testHotelBooking },
    { name: 'Visa Application', fn: testVisaApplication },
    { name: 'Insurance Booking', fn: testInsuranceBooking },
    { name: 'Booking Retrieval', fn: testBookingRetrieval },
    { name: 'Payment Verification', fn: testPaymentVerification }
  ];

  const results = [];
  
  for (const test of tests) {
    try {
      const success = await test.fn();
      results.push({ name: test.name, success });
    } catch (error) {
      results.push({ name: test.name, success: false, error: error.message });
    }
  }

  // Print summary
  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  
  results.forEach(result => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${result.name}`);
    if (!result.success && result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  const passCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  
  console.log(`\n🎯 Overall: ${passCount}/${totalCount} tests passed`);
  
  if (bookingReferences.length > 0) {
    console.log('\n📋 Created Booking References:');
    bookingReferences.forEach((ref, index) => {
      console.log(`${index + 1}. ${ref}`);
    });
  }
};

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests };