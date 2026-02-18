// v1/services/amadeusService.js
const axios = require('axios');
const logger = require('../utils/logger');
const { ApiError } = require('../utils/apiError');
const { StatusCodes } = require('http-status-codes');
const getAmadeusXmlService = require('./amadeusXmlService');

// Legacy REST API configuration (kept for fallback)
const AMADEUS_BASE_URL = process.env.AMADEUS_BASE_URL;
const AMADEUS_CLIENT_ID = process.env.AMADEUS_CLIENT_ID;
const AMADEUS_CLIENT_SECRET = process.env.AMADEUS_CLIENT_SECRET;

// Feature flag for XML service usage
const USE_XML_SERVICE = process.env.AMADEUS_USE_XML_SERVICE === 'true' || process.env.AMADEUS_USE_XML_SERVICE === '1';

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
 * Supports both XML and REST API backends based on feature flag.
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
  
  try {
    if (USE_XML_SERVICE) {
      logger.info('Using Amadeus XML service for flight search', {
        origin: searchCriteria.originLocationCode,
        destination: searchCriteria.destinationLocationCode,
        useXmlService: true
      });
      
      // Use XML service with backward compatibility
      const amadeusXmlService = getAmadeusXmlService();
      return await amadeusXmlService.searchFlightsXml(searchCriteria);
    } else {
      logger.info('Using Amadeus REST API for flight search', {
        origin: searchCriteria.originLocationCode,
        destination: searchCriteria.destinationLocationCode,
        useXmlService: false
      });
      
      // Fallback to REST API
      return amadeusApiCall('/v2/shopping/flight-offers', searchCriteria, 'GET');
    }
  } catch (error) {
    logger.error('Flight search failed', {
      error: error.message,
      useXmlService: USE_XML_SERVICE,
      searchCriteria
    });
    
    // If XML service fails and we have REST API configured, try fallback
    if (USE_XML_SERVICE && AMADEUS_BASE_URL && AMADEUS_CLIENT_ID) {
      logger.warn('XML service failed, attempting REST API fallback');
      try {
        return amadeusApiCall('/v2/shopping/flight-offers', searchCriteria, 'GET');
      } catch (fallbackError) {
        logger.error('REST API fallback also failed', {
          xmlError: error.message,
          restError: fallbackError.message
        });
        throw error; // Throw original XML error
      }
    }
    
    throw error;
  }
};

/**
 * @function bookFlight
 * @description Books a flight using Amadeus Flight Create Orders API.
 * Supports both XML and REST API backends based on feature flag.
 * @param {object} flightOffer - The selected flight offer from search.
 * @param {Array<object>} travelers - Array of traveler details.
 * @param {object} options - Additional booking options (for XML service).
 * @returns {object} Booking confirmation.
 */
const bookFlight = async (flightOffer, travelers, options = {}) => {
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
  
  try {
    if (USE_XML_SERVICE) {
      logger.info('Using Amadeus XML service for flight booking', {
        offerId: flightOffer?.id,
        travelersCount: travelers?.length,
        useXmlService: true
      });
      
      // Extract contact information from travelers for XML service
      const contactEmail = options.contactEmail || travelers[0]?.contact?.emailAddress || travelers[0]?.email;
      const contactPhone = options.contactPhone || travelers[0]?.contact?.phones?.[0]?.number || travelers[0]?.phoneNumber;
      
      const xmlOptions = {
        contactEmail,
        contactPhone,
        ...options
      };
      
      // Use XML service with backward compatibility
      const amadeusXmlService = getAmadeusXmlService();
      return await amadeusXmlService.bookFlightXml(flightOffer, travelers, xmlOptions);
    } else {
      logger.info('Using Amadeus REST API for flight booking', {
        offerId: flightOffer?.id,
        travelersCount: travelers?.length,
        useXmlService: false
      });
      
      // Fallback to REST API
      const payload = {
        data: {
          type: 'flight-order',
          flightOffers: [flightOffer],
          travelers: travelers, // Ensure travelers array is formatted as per Amadeus API
        },
      };
      return amadeusApiCall('/v1/booking/flight-orders', payload, 'POST');
    }
  } catch (error) {
    logger.error('Flight booking failed', {
      error: error.message,
      useXmlService: USE_XML_SERVICE,
      offerId: flightOffer?.id,
      travelersCount: travelers?.length
    });
    
    // If XML service fails and we have REST API configured, try fallback
    if (USE_XML_SERVICE && AMADEUS_BASE_URL && AMADEUS_CLIENT_ID) {
      logger.warn('XML service failed, attempting REST API fallback');
      try {
        const payload = {
          data: {
            type: 'flight-order',
            flightOffers: [flightOffer],
            travelers: travelers,
          },
        };
        return amadeusApiCall('/v1/booking/flight-orders', payload, 'POST');
      } catch (fallbackError) {
        logger.error('REST API fallback also failed', {
          xmlError: error.message,
          restError: fallbackError.message
        });
        throw error; // Throw original XML error
      }
    }
    
    throw error;
  }
};

/**
 * @function getServiceInfo
 * @description Get information about which service backend is being used.
 * @returns {object} Service configuration information.
 */
const getServiceInfo = () => {
  return {
    useXmlService: USE_XML_SERVICE,
    hasRestApiConfig: !!(AMADEUS_BASE_URL && AMADEUS_CLIENT_ID),
    hasXmlConfig: !!(process.env.AMADEUS_XML_ENDPOINT && process.env.AMADEUS_XML_USERNAME),
    activeService: USE_XML_SERVICE ? 'XML' : 'REST'
  };
};

/**
 * @function healthCheck
 * @description Perform health check on the active Amadeus service.
 * @returns {object} Health status.
 */
const healthCheck = async () => {
  try {
    if (USE_XML_SERVICE) {
      const amadeusXmlService = getAmadeusXmlService();
      return await amadeusXmlService.healthCheck();
    } else {
      // Simple REST API health check
      const token = await authenticateAmadeus();
      return {
        status: 'healthy',
        service: 'AmadeusRestService',
        endpoint: AMADEUS_BASE_URL,
        authenticated: !!token,
        timestamp: new Date().toISOString()
      };
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      service: USE_XML_SERVICE ? 'AmadeusXmlService' : 'AmadeusRestService',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

module.exports = {
  searchFlights,
  bookFlight,
  getServiceInfo,
  healthCheck,
};