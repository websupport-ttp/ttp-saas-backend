// v1/services/amadeusService.js
const axios = require('axios');
const logger = require('../utils/logger');
const { ApiError } = require('../utils/apiError');
const { StatusCodes } = require('http-status-codes');

const AMADEUS_BASE_URL = process.env.AMADEUS_BASE_URL;
const AMADEUS_CLIENT_ID = process.env.AMADEUS_CLIENT_ID;
const AMADEUS_CLIENT_SECRET = process.env.AMADEUS_CLIENT_SECRET;

let amadeusAuthToken = null;
let amadeusTokenExpiryTime = null;

/**
 * @function authenticateAmadeus
 * @description Authenticates with the Amadeus API to get an access token.
 * Caches the token and re-authenticates if expired.
 * @returns {string} The Amadeus API authentication token.
 * @throws {ApiError} If authentication fails.
 */
const authenticateAmadeus = async () => {
  if (amadeusAuthToken && amadeusTokenExpiryTime && Date.now() < amadeusTokenExpiryTime) {
    logger.info('Using cached Amadeus token.');
    return amadeusAuthToken;
  }

  logger.info('Authenticating with Amadeus API...');
  try {
    const response = await axios.post(`${AMADEUS_BASE_URL}/v1/security/oauth2/token`,
      `grant_type=client_credentials&client_id=${AMADEUS_CLIENT_ID}&client_secret=${AMADEUS_CLIENT_SECRET}`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    if (response.data && response.data.access_token) {
      amadeusAuthToken = response.data.access_token;
      amadeusTokenExpiryTime = Date.now() + (response.data.expires_in * 1000) - 5000; // Subtract 5 seconds for buffer
      logger.info('Amadeus API authenticated successfully. Token acquired.');
      return amadeusAuthToken;
    } else {
      throw new ApiError('Amadeus authentication failed: Invalid response structure', StatusCodes.UNAUTHORIZED);
    }
  } catch (error) {
    logger.error('Amadeus authentication error:', error.message);
    if (error.response) {
      logger.error('Amadeus API response error:', error.response.data);
    }
    throw new ApiError('Failed to authenticate with Amadeus API', StatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * @function amadeusApiCall
 * @description Generic function to make authenticated calls to the Amadeus API.
 * @param {string} url - The API endpoint URL (e.g., '/v2/shopping/flight-offers').
 * @param {object} params - The request query parameters or body data.
 * @param {string} method - The HTTP method ('GET' or 'POST').
 * @returns {object} The API response data.
 * @throws {ApiError} If the API call fails.
 */
const amadeusApiCall = async (url, params, method = 'GET') => {
  const token = await authenticateAmadeus();
  try {
    const config = {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };

    let response;
    if (method === 'GET') {
      response = await axios.get(`${AMADEUS_BASE_URL}${url}`, { ...config, params });
    } else if (method === 'POST') {
      response = await axios.post(`${AMADEUS_BASE_URL}${url}`, params, config);
    } else {
      throw new ApiError('Unsupported HTTP method for Amadeus API call', StatusCodes.BAD_REQUEST);
    }
    return response.data;
  } catch (error) {
    logger.error(`Amadeus API call to ${url} failed:`, error.message);
    if (error.response) {
      logger.error('Amadeus API response error:', error.response.data);
      throw new ApiError(
        error.response.data.errors ? error.response.data.errors.map(e => e.detail).join(', ') : 'Amadeus API request failed',
        error.response.status || StatusCodes.INTERNAL_SERVER_ERROR
      );
    }
    throw new ApiError('Amadeus API request failed', StatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * @function searchFlights
 * @description Searches for flight offers using Amadeus Flight Offers Search API.
 * @param {object} searchCriteria - Flight search criteria.
 * @returns {object} Flight offers.
 */
const searchFlights = async (searchCriteria) => {
  // Example search criteria:
  // {
  //   originLocationCode: 'SYD',
  //   destinationLocationCode: 'BKK',
  //   departureDate: '2024-08-01',
  //   adults: 1,
  //   currencyCode: 'USD',
  //   max: 10
  // }
  return amadeusApiCall('/v2/shopping/flight-offers', searchCriteria, 'GET');
};

/**
 * @function bookFlight
 * @description Books a flight using Amadeus Flight Create Orders API.
 * @param {object} flightOffer - The selected flight offer from search.
 * @param {Array<object>} travelers - Array of traveler details.
 * @returns {object} Booking confirmation.
 */
const bookFlight = async (flightOffer, travelers) => {
  // Example booking payload:
  // {
  //   data: {
  //     type: 'flight-order',
  //     flightOffers: [flightOffer],
  //     travelers: travelers.map(t => ({
  //       id: t.id,
  //       gender: t.gender,
  //       dateOfBirth: t.dateOfBirth,
  //       name: { firstName: t.firstName, lastName: t.lastName },
  //       contact: { emailAddress: t.email, phones: [{ deviceType: 'MOBILE', countryCallingCode: '234', number: t.phoneNumber }] },
  //       documents: [{ documentType: 'PASSPORT', birthPlace: 'LAGOS', issuanceLocation: 'LAGOS', issuanceDate: '2018-04-25',
  //                     number: '123456789', expiryDate: '2028-04-25', issuanceCountry: 'NG', validityCountry: 'NG',
  //                     nationality: 'NG', holder: true }]
  //     }))
  //   }
  // }
  const payload = {
    data: {
      type: 'flight-order',
      flightOffers: [flightOffer],
      travelers: travelers, // Ensure travelers array is formatted as per Amadeus API
    },
  };
  return amadeusApiCall('/v1/booking/flight-orders', payload, 'POST');
};

module.exports = {
  searchFlights,
  bookFlight,
};