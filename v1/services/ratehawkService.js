// v1/services/ratehawkService.js
const axios = require('axios');
const logger = require('../utils/logger');
const { ApiError } = require('../utils/apiError');
const { StatusCodes } = require('http-status-codes');

const RATEHAWK_BASE_URL = process.env.RATEHAWK_BASE_URL;
const RATEHAWK_API_KEY = process.env.RATEHAWK_API_KEY;
const RATEHAWK_API_SECRET = process.env.RATEHAWK_API_SECRET; // Or password depending on their auth method

/**
 * @function authenticateRatehawk
 * @description Authenticates with the Ratehawk API.
 * (Assuming basic auth or token-based like Amadeus/Allianz. Adjust as per actual Ratehawk docs).
 * For now, just returns a dummy token as a placeholder.
 * @returns {string} The Ratehawk API authentication token.
 * @throws {ApiError} If authentication fails.
 */
const authenticateRatehawk = async () => {
  // Placeholder for Ratehawk authentication logic
  // This would typically involve a POST request to an auth endpoint
  // with API Key/Secret and receiving a token.
  // For now, returning a dummy token.
  logger.info('Authenticating with Ratehawk API (placeholder)...');
  if (!RATEHAWK_API_KEY || !RATEHAWK_API_SECRET) {
    throw new ApiError('Ratehawk API credentials are not set.', StatusCodes.INTERNAL_SERVER_ERROR);
  }
  // Example: return Buffer.from(`${RATEHAWK_API_KEY}:${RATEHAWK_API_SECRET}`).toString('base64'); for Basic Auth
  // Or a token from a login endpoint.
  return 'DUMMY_RATEHAWK_TOKEN'; // Replace with actual token retrieval
};

/**
 * @function ratehawkApiCall
 * @description Generic function to make authenticated calls to the Ratehawk API.
 * @param {string} url - The API endpoint URL.
 * @param {object} data - The request payload.
 * @param {string} method - The HTTP method ('GET' or 'POST').
 * @returns {object} The API response data.
 * @throws {ApiError} If the API call fails.
 */
const ratehawkApiCall = async (url, data, method = 'POST') => {
  const token = await authenticateRatehawk(); // Or use basic auth in headers directly
  try {
    const config = {
      headers: {
        Authorization: `Bearer ${token}`, // Adjust header as per Ratehawk's auth
        'Content-Type': 'application/json',
      },
    };

    let response;
    if (method === 'GET') {
      response = await axios.get(`${RATEHAWK_BASE_URL}${url}`, { ...config, params: data });
    } else if (method === 'POST') {
      response = await axios.post(`${RATEHAWK_BASE_URL}${url}`, data, config);
    } else {
      throw new ApiError('Unsupported HTTP method for Ratehawk API call', StatusCodes.BAD_REQUEST);
    }
    return response.data;
  } catch (error) {
    logger.error(`Ratehawk API call to ${url} failed:`, error.message);
    if (error.response) {
      logger.error('Ratehawk API response error:', error.response.data);
      throw new ApiError(
        error.response.data.message || 'Ratehawk API request failed',
        error.response.status || StatusCodes.INTERNAL_SERVER_ERROR
      );
    }
    throw new ApiError('Ratehawk API request failed', StatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * @function searchHotels
 * @description Searches for hotels using Ratehawk API.
 * @param {object} searchCriteria - Hotel search criteria.
 * @returns {object} Hotel search results.
 */
const searchHotels = async (searchCriteria) => {
  // Example search criteria:
  // {
  //   checkin: '2024-09-01',
  //   checkout: '2024-09-05',
  //   country: 'NG',
  //   city: 'Lagos',
  //   adults: 2,
  //   children: [],
  //   currency: 'NGN'
  // }
  return ratehawkApiCall('/hotel/search', searchCriteria, 'POST'); // Assuming POST for search
};

/**
 * @function bookHotel
 * @description Books a hotel using Ratehawk API.
 * @param {object} bookingDetails - Hotel booking details.
 * @returns {object} Hotel booking confirmation.
 */
const bookHotel = async (bookingDetails) => {
  // Example booking details:
  // {
  //   search_id: '...', // from search response
  //   room_id: '...', // from search response
  //   guest_details: [{ first_name: 'John', last_name: 'Doe', email: '...', phone: '...' }],
  //   payment_method: '...',
  //   total_price: '...'
  // }
  return ratehawkApiCall('/hotel/book', bookingDetails, 'POST'); // Assuming POST for booking
};

module.exports = {
  searchHotels,
  bookHotel,
};