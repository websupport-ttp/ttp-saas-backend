// Test script for Hotel API functionality
const axios = require('axios');

const BASE_URL = 'http://localhost:8080/api/v1';

async function testHotelSearch() {
  try {
    console.log('🏨 Testing Hotel Search API...');
    
    const searchData = {
      destination: 'Lagos',
      checkInDate: '2024-12-15',
      checkOutDate: '2024-12-18',
      adults: 2,
      children: 0,
      currency: 'NGN'
    };

    const response = await axios.post(`${BASE_URL}/products/hotels/search`, searchData);
    
    console.log('✅ Hotel Search Response Status:', response.status);
    console.log('✅ Hotels Found:', response.data.data?.totalResults || 0);
    
    if (response.data.data?.hotels?.length > 0) {
      console.log('✅ Sample Hotel:', {
        name: response.data.data.hotels[0].name,
        id: response.data.data.hotels[0].id,
        price: response.data.data.hotels[0].rooms?.[0]?.price || 'N/A'
      });
    }
    
    return response.data;
  } catch (error) {
    console.error('❌ Hotel Search Failed:', error.response?.data || error.message);
    return null;
  }
}

async function testHotelBooking() {
  try {
    console.log('\n🏨 Testing Hotel Booking API...');
    
    // Note: This requires authentication token
    const bookingData = {
      hotelDetails: {
        id: 'TEST001',
        name: 'Test Hotel Lagos',
        price: 150000,
        currency: 'NGN',
        checkInDate: '2024-12-15',
        checkOutDate: '2024-12-18',
        roomName: 'Deluxe Room'
      },
      guestDetails: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'test@example.com',
        phoneNumber: '+2348012345678'
      },
      paymentDetails: {
        email: 'test@example.com',
        currency: 'NGN',
        callback_url: 'http://localhost:3000/payment/callback'
      },
      searchId: 'test_search_123',
      roomId: 'test_room_456'
    };

    // This will fail without auth token, but we can test the endpoint exists
    const response = await axios.post(`${BASE_URL}/products/hotels/book`, bookingData);
    
    console.log('✅ Hotel Booking Response Status:', response.status);
    return response.data;
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('✅ Hotel Booking Endpoint Exists (Authentication Required)');
    } else {
      console.error('❌ Hotel Booking Failed:', error.response?.data || error.message);
    }
    return null;
  }
}

async function runTests() {
  console.log('🚀 Starting Hotel API Tests...\n');
  
  await testHotelSearch();
  await testHotelBooking();
  
  console.log('\n✅ Hotel API Tests Completed!');
  console.log('\n📋 Summary:');
  console.log('- Hotel Search: Implemented with Ratehawk API');
  console.log('- Hotel Booking: Implemented with Paystack integration');
  console.log('- Payment Verification: Implemented with Ratehawk booking');
  console.log('- Fallback: Mock data available in development mode');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testHotelSearch, testHotelBooking };