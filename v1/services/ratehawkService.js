// v1/services/ratehawkService.js
const axios = require('axios');
const logger = require('../utils/logger');
const { ApiError } = require('../utils/apiError');
const { StatusCodes } = require('http-status-codes');

const RATEHAWK_BASE_URL = process.env.RATEHAWK_BASE_URL || process.env.RATEHAWK_SANDBOX_URL;
const RATEHAWK_API_KEY_ID = process.env.RATEHAWK_API_KEY_ID;
const RATEHAWK_API_ACCESS_TOKEN = process.env.RATEHAWK_API_ACCESS_TOKEN;

/**
 * @function getAuthHeaders
 * @description Gets authentication headers for Ratehawk API calls.
 * @returns {object} The authentication headers.
 * @throws {ApiError} If credentials are not set.
 */
const getAuthHeaders = () => {
  if (!RATEHAWK_API_KEY_ID || !RATEHAWK_API_ACCESS_TOKEN) {
    throw new ApiError('Ratehawk API credentials are not set.', StatusCodes.INTERNAL_SERVER_ERROR);
  }
  
  const authString = `${RATEHAWK_API_KEY_ID}:${RATEHAWK_API_ACCESS_TOKEN}`;
  const base64Auth = Buffer.from(authString).toString('base64');
  
  logger.info(`Auth credentials - Key ID: ${RATEHAWK_API_KEY_ID}, Token length: ${RATEHAWK_API_ACCESS_TOKEN?.length}`);
  
  return {
    'Content-Type': 'application/json',
    'Authorization': `Basic ${base64Auth}`
  };
};

/**
 * @function ratehawkApiCall
 * @description Generic function to make authenticated calls to the Ratehawk API.
 * @param {string} endpoint - The API endpoint path.
 * @param {object} data - The request payload.
 * @param {string} method - The HTTP method ('GET' or 'POST').
 * @returns {object} The API response data.
 * @throws {ApiError} If the API call fails.
 */
const ratehawkApiCall = async (endpoint, data, method = 'POST') => {
  try {
    const headers = getAuthHeaders();
    const url = `${RATEHAWK_BASE_URL}${endpoint}`;
    
    logger.info(`Making ${method} request to Ratehawk API: ${endpoint}`);
    logger.info(`Full URL: ${url}`);
    logger.info(`Request data: ${JSON.stringify(data, null, 2)}`);
    
    let response;
    if (method === 'GET') {
      response = await axios.get(url, { headers, params: data });
    } else if (method === 'POST') {
      response = await axios.post(url, data, { headers });
    } else {
      throw new ApiError('Unsupported HTTP method for Ratehawk API call', StatusCodes.BAD_REQUEST);
    }
    
    logger.info(`Ratehawk API response status: ${response.status}`);
    return response.data;
  } catch (error) {
    logger.error(`Ratehawk API call to ${endpoint} failed:`, error.message);
    
    if (error.response) {
      logger.error('Ratehawk API response status:', error.response.status);
      logger.error('Ratehawk API response data:', error.response.data);
      
      // Check for specific Ratehawk error messages
      const errorMessage = error.response.data?.error || error.response.data?.message || 'Ratehawk API request failed';
      const debugInfo = error.response.data?.debug;
      
      if (debugInfo) {
        logger.error('Ratehawk API debug info:', debugInfo);
        if (debugInfo.validation_error) {
          logger.error('Validation error:', debugInfo.validation_error);
        }
      }
      
      throw new ApiError(
        errorMessage,
        error.response.status || StatusCodes.INTERNAL_SERVER_ERROR
      );
    } else if (error.request) {
      logger.error('No response received from Ratehawk API');
      throw new ApiError('No response from Ratehawk API - possible network or authentication issue', StatusCodes.SERVICE_UNAVAILABLE);
    }
    throw new ApiError('Ratehawk API request failed: ' + error.message, StatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * @function searchHotels
 * @description Searches for hotels using Ratehawk API.
 * @param {object} searchCriteria - Hotel search criteria.
 * @returns {object} Hotel search results.
 */
const searchHotels = async (searchCriteria) => {
  try {
    logger.info('Starting hotel search for:', searchCriteria.destination);
    
    // Get region ID first
    const regionId = await getRegionId(searchCriteria.destination);
    logger.info(`Using region ID: ${regionId} for ${searchCriteria.destination}`);
    
    // Transform search criteria to Ratehawk format
    const ratehawkRequest = {
      checkin: searchCriteria.checkInDate,
      checkout: searchCriteria.checkOutDate,
      residency: 'ng', // Nigeria as default residency
      language: 'en',
      guests: [
        {
          adults: searchCriteria.adults || 2,
          children: searchCriteria.children || []
        }
      ],
      region_id: regionId,
      // Use USD for sandbox testing as NGN is not supported in sandbox
      currency: process.env.NODE_ENV === 'development' ? 'USD' : (searchCriteria.currency || 'USD')
    };

    logger.info('Searching hotels with criteria:', ratehawkRequest);
    
    // Make the search request
    // Note: Using /serp/region endpoint for region-based search
    const response = await ratehawkApiCall('/api/b2b/v3/search/serp/region', ratehawkRequest, 'POST');
    
    // Transform response to our format
    return {
      searchId: response.data?.search_id,
      hotels: response.data?.hotels?.map(hotel => ({
        id: hotel.id,
        name: hotel.name,
        address: hotel.address,
        stars: hotel.star_rating,
        images: hotel.images,
        amenities: hotel.amenities,
        rooms: hotel.rates?.map(rate => ({
          id: rate.match_hash,
          name: rate.room_name,
          price: rate.daily_prices?.[0],
          currency: rate.currency,
          cancellationPolicy: rate.cancellation_penalties,
          breakfast: rate.meal,
          bedding: rate.room_data_trans?.bedding_type
        })) || [],
        location: {
          latitude: hotel.latitude,
          longitude: hotel.longitude
        },
        rating: hotel.review_score,
        reviewCount: hotel.review_count
      })) || [],
      totalResults: response.data?.hotels?.length || 0
    };
  } catch (error) {
    logger.error('Hotel search failed:', error.message);
    throw error;
  }
};

/**
 * @function bookHotel
 * @description Books a hotel using Ratehawk API.
 * @param {object} bookingDetails - Hotel booking details.
 * @returns {object} Hotel booking confirmation.
 */
const bookHotel = async (bookingDetails) => {
  try {
    const { searchId, roomId, guestDetails, hotelDetails } = bookingDetails;
    
    // Transform booking details to Ratehawk format
    const ratehawkBookingRequest = {
      search_id: searchId,
      room_id: roomId,
      user_ip: '127.0.0.1', // Should be actual user IP in production
      partner_order_id: `TTP-${Date.now()}`,
      book_hash: roomId, // Usually the same as room_id for Ratehawk
      language: 'en',
      guests: [
        {
          first_name: guestDetails.firstName,
          last_name: guestDetails.lastName,
          phone: guestDetails.phoneNumber,
          email: guestDetails.email
        }
      ]
    };

    logger.info('Booking hotel with details:', ratehawkBookingRequest);
    
    // Make the booking request
    const response = await ratehawkApiCall('/api/b2b/v3/hotel/order/booking/form', ratehawkBookingRequest, 'POST');
    
    return {
      bookingReference: response.data?.partner_order_id,
      ratehawkOrderId: response.data?.order_id,
      status: response.data?.status,
      hotelConfirmation: response.data?.hotel_confirmation_code,
      totalPrice: response.data?.amount_sell_b2b2c,
      currency: response.data?.currency,
      checkIn: response.data?.checkin,
      checkOut: response.data?.checkout,
      guestName: `${guestDetails.firstName} ${guestDetails.lastName}`,
      hotelName: hotelDetails.name,
      roomType: hotelDetails.roomName
    };
  } catch (error) {
    logger.error('Hotel booking failed:', error.message);
    throw error;
  }
};

/**
 * @function getRegionId
 * @description Gets region ID for a destination (city/country).
 * @param {string} destination - The destination name.
 * @returns {number} The region ID for Ratehawk API.
 */
const getRegionId = async (destination) => {
  try {
    // For now, return common region IDs for major Nigerian cities
    const regionMap = {
      'lagos': 6040, // Lagos region ID (example)
      'abuja': 6041, // Abuja region ID (example)
      'port harcourt': 6042, // Port Harcourt region ID (example)
      'kano': 6043, // Kano region ID (example)
      'ibadan': 6044, // Ibadan region ID (example)
    };
    
    const normalizedDestination = destination.toLowerCase();
    
    // Check if we have a predefined region ID
    if (regionMap[normalizedDestination]) {
      return regionMap[normalizedDestination];
    }
    
    // If not found, search for the region using Ratehawk's multicomplete API
    const searchResponse = await ratehawkApiCall('/api/b2b/v3/search/multicomplete', {
      query: destination,
      language: 'en'
    }, 'POST');
    
    // Check if we got regions in the response
    if (searchResponse.data && searchResponse.data.regions && searchResponse.data.regions.length > 0) {
      logger.info(`Found region for ${destination}:`, searchResponse.data.regions[0]);
      return searchResponse.data.regions[0].id;
    }
    
    // Check if we got hotels in the response (can also extract region from hotel)
    if (searchResponse.data && searchResponse.data.hotels && searchResponse.data.hotels.length > 0) {
      logger.info(`Found hotel for ${destination}, using its region`);
      return searchResponse.data.hotels[0].region_id;
    }
    
    // For sandbox testing, use a known test region ID
    // The sandbox may have limited data, so we'll use a default test region
    logger.warn(`No region found for destination: ${destination}, using default test region`);
    return 2114; // Default test region ID for sandbox (you may need to adjust this)
  } catch (error) {
    logger.error('Failed to get region ID:', error.message);
    // Default to Lagos region ID
    return 6040;
  }
};

/**
 * @function getHotelDetails
 * @description Gets detailed information about a specific hotel.
 * @param {string} hotelId - The hotel ID.
 * @returns {object} Hotel details.
 */
const getHotelDetails = async (hotelId) => {
  try {
    const response = await ratehawkApiCall(`/api/b2b/v3/hotel/info`, {
      hotel_id: hotelId,
      language: 'en'
    }, 'POST');
    
    return response.data;
  } catch (error) {
    logger.error('Failed to get hotel details:', error.message);
    throw error;
  }
};

/**
 * @function cancelBooking
 * @description Cancels a hotel booking.
 * @param {string} orderId - The Ratehawk order ID.
 * @returns {object} Cancellation response.
 */
const cancelBooking = async (orderId) => {
  try {
    const response = await ratehawkApiCall('/api/b2b/v3/hotel/order/cancel', {
      order_id: orderId
    }, 'POST');
    
    return response.data;
  } catch (error) {
    logger.error('Failed to cancel booking:', error.message);
    throw error;
  }
};

module.exports = {
  searchHotels,
  bookHotel,
  getHotelDetails,
  cancelBooking,
  getRegionId
};