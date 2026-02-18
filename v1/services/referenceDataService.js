// v1/services/referenceDataService.js
const axios = require('axios');
const logger = require('../utils/logger');
const { ApiError } = require('../utils/apiError');
const { StatusCodes } = require('http-status-codes');

// Amadeus API configuration
const AMADEUS_BASE_URL = process.env.AMADEUS_BASE_URL;
const AMADEUS_CLIENT_ID = process.env.AMADEUS_CLIENT_ID;
const AMADEUS_CLIENT_SECRET = process.env.AMADEUS_CLIENT_SECRET;

// Check if Amadeus credentials are available
const hasAmadeusCredentials = AMADEUS_BASE_URL && AMADEUS_CLIENT_ID && AMADEUS_CLIENT_SECRET;

// Cache for reference data (airports and countries don't change frequently)
let airportsCache = null;
let countriesCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Fallback airport data for development
const fallbackAirports = [
  {
    type: "location",
    subType: "AIRPORT",
    name: "John F Kennedy International Airport",
    detailedName: "John F Kennedy International Airport",
    id: "AJFK",
    self: {
      href: "https://test.api.amadeus.com/v1/reference-data/locations/AJFK",
      methods: ["GET"]
    },
    timeZoneOffset: "-05:00",
    iataCode: "JFK",
    geoCode: {
      latitude: 40.63980103,
      longitude: -73.77890015
    },
    address: {
      cityName: "NEW YORK",
      cityCode: "NYC",
      countryName: "UNITED STATES OF AMERICA",
      countryCode: "US",
      regionCode: "NAMER"
    }
  },
  {
    type: "location",
    subType: "AIRPORT",
    name: "Heathrow Airport",
    detailedName: "London Heathrow Airport",
    id: "ALHR",
    self: {
      href: "https://test.api.amadeus.com/v1/reference-data/locations/ALHR",
      methods: ["GET"]
    },
    timeZoneOffset: "+00:00",
    iataCode: "LHR",
    geoCode: {
      latitude: 51.4775,
      longitude: -0.461389
    },
    address: {
      cityName: "LONDON",
      cityCode: "LON",
      countryName: "UNITED KINGDOM",
      countryCode: "GB",
      regionCode: "EUROP"
    }
  },
  {
    type: "location",
    subType: "AIRPORT",
    name: "Charles de Gaulle Airport",
    detailedName: "Paris Charles de Gaulle Airport",
    id: "ACDG",
    self: {
      href: "https://test.api.amadeus.com/v1/reference-data/locations/ACDG",
      methods: ["GET"]
    },
    timeZoneOffset: "+01:00",
    iataCode: "CDG",
    geoCode: {
      latitude: 49.012779,
      longitude: 2.55
    },
    address: {
      cityName: "PARIS",
      cityCode: "PAR",
      countryName: "FRANCE",
      countryCode: "FR",
      regionCode: "EUROP"
    }
  },
  {
    type: "location",
    subType: "AIRPORT",
    name: "Dubai International Airport",
    detailedName: "Dubai International Airport",
    id: "ADXB",
    self: {
      href: "https://test.api.amadeus.com/v1/reference-data/locations/ADXB",
      methods: ["GET"]
    },
    timeZoneOffset: "+04:00",
    iataCode: "DXB",
    geoCode: {
      latitude: 25.2532,
      longitude: 55.3657
    },
    address: {
      cityName: "DUBAI",
      cityCode: "DXB",
      countryName: "UNITED ARAB EMIRATES",
      countryCode: "AE",
      regionCode: "MIDEA"
    }
  },
  {
    type: "location",
    subType: "AIRPORT",
    name: "Los Angeles International Airport",
    detailedName: "Los Angeles International Airport",
    id: "ALAX",
    self: {
      href: "https://test.api.amadeus.com/v1/reference-data/locations/ALAX",
      methods: ["GET"]
    },
    timeZoneOffset: "-08:00",
    iataCode: "LAX",
    geoCode: {
      latitude: 33.9425,
      longitude: -118.408056
    },
    address: {
      cityName: "LOS ANGELES",
      cityCode: "LAX",
      countryName: "UNITED STATES OF AMERICA",
      countryCode: "US",
      regionCode: "NAMER"
    }
  },
  {
    type: "location",
    subType: "AIRPORT",
    name: "Murtala Muhammed International Airport",
    detailedName: "Lagos Murtala Muhammed International Airport",
    id: "ALOS",
    self: {
      href: "https://test.api.amadeus.com/v1/reference-data/locations/ALOS",
      methods: ["GET"]
    },
    timeZoneOffset: "+01:00",
    iataCode: "LOS",
    geoCode: {
      latitude: 6.5774,
      longitude: 3.3212
    },
    address: {
      cityName: "LAGOS",
      cityCode: "LOS",
      countryName: "NIGERIA",
      countryCode: "NG",
      regionCode: "AFRIC"
    }
  },
  {
    type: "location",
    subType: "AIRPORT",
    name: "Nnamdi Azikiwe International Airport",
    detailedName: "Abuja Nnamdi Azikiwe International Airport",
    id: "AABV",
    self: {
      href: "https://test.api.amadeus.com/v1/reference-data/locations/AABV",
      methods: ["GET"]
    },
    timeZoneOffset: "+01:00",
    iataCode: "ABV",
    geoCode: {
      latitude: 9.0068,
      longitude: 7.2632
    },
    address: {
      cityName: "ABUJA",
      cityCode: "ABV",
      countryName: "NIGERIA",
      countryCode: "NG",
      regionCode: "AFRIC"
    }
  }
];

// Authentication token management
let amadeusAuthToken = null;
let amadeusTokenExpiryTime = null;

/**
 * @function authenticateAmadeus
 * @description Authenticates with the Amadeus API to get an access token.
 * @returns {string} The Amadeus API authentication token.
 * @throws {ApiError} If authentication fails.
 */
const authenticateAmadeus = async () => {
  if (!hasAmadeusCredentials) {
    throw new ApiError('Amadeus API credentials not configured', StatusCodes.SERVICE_UNAVAILABLE);
  }

  if (amadeusAuthToken && amadeusTokenExpiryTime && Date.now() < amadeusTokenExpiryTime) {
    return amadeusAuthToken;
  }

  logger.info('Authenticating with Amadeus API for reference data...');
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
      amadeusTokenExpiryTime = Date.now() + (response.data.expires_in * 1000) - 5000;
      logger.info('Amadeus API authenticated successfully for reference data.');
      return amadeusAuthToken;
    } else {
      throw new ApiError('Amadeus authentication failed: Invalid response structure', StatusCodes.UNAUTHORIZED);
    }
  } catch (error) {
    logger.error('Amadeus authentication error for reference data:', error.message);
    throw new ApiError('Failed to authenticate with Amadeus API', StatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * @function amadeusApiCall
 * @description Generic function to make authenticated calls to the Amadeus API.
 * @param {string} url - The API endpoint URL.
 * @param {object} params - The request query parameters.
 * @returns {object} The API response data.
 * @throws {ApiError} If the API call fails.
 */
const amadeusApiCall = async (url, params = {}) => {
  const token = await authenticateAmadeus();
  try {
    const response = await axios.get(`${AMADEUS_BASE_URL}${url}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      params
    });
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
 * @function isCacheValid
 * @description Checks if the cache is still valid.
 * @returns {boolean} True if cache is valid, false otherwise.
 */
const isCacheValid = () => {
  return cacheTimestamp && (Date.now() - cacheTimestamp) < CACHE_DURATION;
};

/**
 * @function getAirports
 * @description Retrieves a list of airports from Amadeus API with caching.
 * @param {object} options - Search options (keyword, countryCode, etc.)
 * @returns {Array} Array of airport objects.
 */
const getAirports = async (options = {}) => {
  try {
    // If we have a specific search keyword, don't use cache
    if (options.keyword) {
      logger.info(`Searching airports with keyword: ${options.keyword}`);
      const response = await amadeusApiCall('/v1/reference-data/locations', {
        subType: 'AIRPORT',
        keyword: options.keyword,
        'page[limit]': options.limit || 20,
        'page[offset]': options.offset || 0
      });
      
      return {
        data: response.data || [],
        meta: response.meta || {},
        cached: false
      };
    }

    // For general airport list, use cache if available and valid
    if (airportsCache && isCacheValid()) {
      logger.info('Returning cached airports data');
      return {
        data: airportsCache,
        cached: true,
        cacheAge: Date.now() - cacheTimestamp
      };
    }

    logger.info('Fetching airports from Amadeus API...');
    
    // Get popular airports (major cities)
    const popularCities = [
      'NEW YORK', 'LONDON', 'PARIS', 'TOKYO', 'DUBAI', 'SINGAPORE', 
      'LOS ANGELES', 'CHICAGO', 'FRANKFURT', 'AMSTERDAM', 'MADRID',
      'ROME', 'BARCELONA', 'ISTANBUL', 'BANGKOK', 'HONG KONG',
      'SYDNEY', 'MELBOURNE', 'TORONTO', 'VANCOUVER', 'MUMBAI',
      'DELHI', 'LAGOS', 'ABUJA', 'CAIRO', 'JOHANNESBURG'
    ];

    const allAirports = [];
    
    // Fetch airports for each popular city
    for (const city of popularCities) {
      try {
        const response = await amadeusApiCall('/v1/reference-data/locations', {
          subType: 'AIRPORT',
          keyword: city,
          'page[limit]': 5 // Limit to top 5 airports per city
        });
        
        if (response.data && response.data.length > 0) {
          allAirports.push(...response.data);
        }
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        logger.warn(`Failed to fetch airports for ${city}:`, error.message);
        // Continue with other cities
      }
    }

    // Remove duplicates based on IATA code
    const uniqueAirports = allAirports.reduce((acc, airport) => {
      if (!acc.find(a => a.iataCode === airport.iataCode)) {
        acc.push(airport);
      }
      return acc;
    }, []);

    // Sort by name
    uniqueAirports.sort((a, b) => a.name.localeCompare(b.name));

    // Cache the results
    airportsCache = uniqueAirports;
    cacheTimestamp = Date.now();

    logger.info(`Fetched and cached ${uniqueAirports.length} airports`);
    
    return {
      data: uniqueAirports,
      cached: false,
      count: uniqueAirports.length
    };

  } catch (error) {
    logger.error('Failed to fetch airports:', error.message);
    
    // If we have cached data, return it even if expired
    if (airportsCache) {
      logger.warn('Returning expired cached airports data due to API error');
      return {
        data: airportsCache,
        cached: true,
        expired: true,
        error: error.message
      };
    }
    
    throw error;
  }
};

/**
 * @function getCountries
 * @description Retrieves a list of countries with caching.
 * @returns {Array} Array of country objects.
 */
const getCountries = async () => {
  try {
    // Check cache first
    if (countriesCache && isCacheValid()) {
      logger.info('Returning cached countries data');
      return {
        data: countriesCache,
        cached: true,
        cacheAge: Date.now() - cacheTimestamp
      };
    }

    logger.info('Generating countries list...');
    
    // Since Amadeus doesn't have a direct countries endpoint,
    // we'll provide a curated list of countries commonly used for travel
    const countries = [
      { code: 'US', name: 'United States', continent: 'North America' },
      { code: 'GB', name: 'United Kingdom', continent: 'Europe' },
      { code: 'FR', name: 'France', continent: 'Europe' },
      { code: 'DE', name: 'Germany', continent: 'Europe' },
      { code: 'IT', name: 'Italy', continent: 'Europe' },
      { code: 'ES', name: 'Spain', continent: 'Europe' },
      { code: 'NL', name: 'Netherlands', continent: 'Europe' },
      { code: 'CH', name: 'Switzerland', continent: 'Europe' },
      { code: 'AT', name: 'Austria', continent: 'Europe' },
      { code: 'BE', name: 'Belgium', continent: 'Europe' },
      { code: 'SE', name: 'Sweden', continent: 'Europe' },
      { code: 'NO', name: 'Norway', continent: 'Europe' },
      { code: 'DK', name: 'Denmark', continent: 'Europe' },
      { code: 'FI', name: 'Finland', continent: 'Europe' },
      { code: 'IE', name: 'Ireland', continent: 'Europe' },
      { code: 'PT', name: 'Portugal', continent: 'Europe' },
      { code: 'GR', name: 'Greece', continent: 'Europe' },
      { code: 'TR', name: 'Turkey', continent: 'Europe/Asia' },
      { code: 'RU', name: 'Russia', continent: 'Europe/Asia' },
      { code: 'JP', name: 'Japan', continent: 'Asia' },
      { code: 'CN', name: 'China', continent: 'Asia' },
      { code: 'KR', name: 'South Korea', continent: 'Asia' },
      { code: 'IN', name: 'India', continent: 'Asia' },
      { code: 'TH', name: 'Thailand', continent: 'Asia' },
      { code: 'SG', name: 'Singapore', continent: 'Asia' },
      { code: 'MY', name: 'Malaysia', continent: 'Asia' },
      { code: 'ID', name: 'Indonesia', continent: 'Asia' },
      { code: 'PH', name: 'Philippines', continent: 'Asia' },
      { code: 'VN', name: 'Vietnam', continent: 'Asia' },
      { code: 'HK', name: 'Hong Kong', continent: 'Asia' },
      { code: 'TW', name: 'Taiwan', continent: 'Asia' },
      { code: 'AE', name: 'United Arab Emirates', continent: 'Asia' },
      { code: 'SA', name: 'Saudi Arabia', continent: 'Asia' },
      { code: 'QA', name: 'Qatar', continent: 'Asia' },
      { code: 'KW', name: 'Kuwait', continent: 'Asia' },
      { code: 'OM', name: 'Oman', continent: 'Asia' },
      { code: 'BH', name: 'Bahrain', continent: 'Asia' },
      { code: 'IL', name: 'Israel', continent: 'Asia' },
      { code: 'JO', name: 'Jordan', continent: 'Asia' },
      { code: 'LB', name: 'Lebanon', continent: 'Asia' },
      { code: 'AU', name: 'Australia', continent: 'Oceania' },
      { code: 'NZ', name: 'New Zealand', continent: 'Oceania' },
      { code: 'CA', name: 'Canada', continent: 'North America' },
      { code: 'MX', name: 'Mexico', continent: 'North America' },
      { code: 'BR', name: 'Brazil', continent: 'South America' },
      { code: 'AR', name: 'Argentina', continent: 'South America' },
      { code: 'CL', name: 'Chile', continent: 'South America' },
      { code: 'PE', name: 'Peru', continent: 'South America' },
      { code: 'CO', name: 'Colombia', continent: 'South America' },
      { code: 'VE', name: 'Venezuela', continent: 'South America' },
      { code: 'UY', name: 'Uruguay', continent: 'South America' },
      { code: 'EC', name: 'Ecuador', continent: 'South America' },
      { code: 'ZA', name: 'South Africa', continent: 'Africa' },
      { code: 'NG', name: 'Nigeria', continent: 'Africa' },
      { code: 'KE', name: 'Kenya', continent: 'Africa' },
      { code: 'EG', name: 'Egypt', continent: 'Africa' },
      { code: 'MA', name: 'Morocco', continent: 'Africa' },
      { code: 'TN', name: 'Tunisia', continent: 'Africa' },
      { code: 'GH', name: 'Ghana', continent: 'Africa' },
      { code: 'ET', name: 'Ethiopia', continent: 'Africa' },
      { code: 'TZ', name: 'Tanzania', continent: 'Africa' },
      { code: 'UG', name: 'Uganda', continent: 'Africa' },
      { code: 'RW', name: 'Rwanda', continent: 'Africa' },
      { code: 'SN', name: 'Senegal', continent: 'Africa' },
      { code: 'CI', name: 'Ivory Coast', continent: 'Africa' },
      { code: 'BF', name: 'Burkina Faso', continent: 'Africa' },
      { code: 'ML', name: 'Mali', continent: 'Africa' },
      { code: 'NE', name: 'Niger', continent: 'Africa' },
      { code: 'TD', name: 'Chad', continent: 'Africa' },
      { code: 'CM', name: 'Cameroon', continent: 'Africa' },
      { code: 'GA', name: 'Gabon', continent: 'Africa' },
      { code: 'CG', name: 'Republic of the Congo', continent: 'Africa' },
      { code: 'CD', name: 'Democratic Republic of the Congo', continent: 'Africa' },
      { code: 'CF', name: 'Central African Republic', continent: 'Africa' },
      { code: 'AO', name: 'Angola', continent: 'Africa' },
      { code: 'ZM', name: 'Zambia', continent: 'Africa' },
      { code: 'ZW', name: 'Zimbabwe', continent: 'Africa' },
      { code: 'BW', name: 'Botswana', continent: 'Africa' },
      { code: 'NA', name: 'Namibia', continent: 'Africa' },
      { code: 'MZ', name: 'Mozambique', continent: 'Africa' },
      { code: 'MW', name: 'Malawi', continent: 'Africa' },
      { code: 'MG', name: 'Madagascar', continent: 'Africa' },
      { code: 'MU', name: 'Mauritius', continent: 'Africa' },
      { code: 'SC', name: 'Seychelles', continent: 'Africa' }
    ];

    // Sort countries by name
    countries.sort((a, b) => a.name.localeCompare(b.name));

    // Cache the results
    countriesCache = countries;
    cacheTimestamp = Date.now();

    logger.info(`Generated and cached ${countries.length} countries`);
    
    return {
      data: countries,
      cached: false,
      count: countries.length
    };

  } catch (error) {
    logger.error('Failed to generate countries list:', error.message);
    
    // If we have cached data, return it even if expired
    if (countriesCache) {
      logger.warn('Returning expired cached countries data due to error');
      return {
        data: countriesCache,
        cached: true,
        expired: true,
        error: error.message
      };
    }
    
    throw error;
  }
};

/**
 * @function searchAirports
 * @description Search airports by keyword, city, or country.
 * @param {string} query - Search query.
 * @param {object} options - Additional search options.
 * @returns {Array} Array of matching airports.
 */
const searchAirports = async (query, options = {}) => {
  try {
    if (!query || query.trim().length < 2) {
      throw new ApiError('Search query must be at least 2 characters long', StatusCodes.BAD_REQUEST);
    }

    logger.info(`Searching airports with query: ${query}`);
    
    // If Amadeus credentials are not available, use fallback data
    if (!hasAmadeusCredentials) {
      logger.warn('Amadeus credentials not configured, using fallback airport data');
      
      const searchTerm = query.trim().toLowerCase();
      const filteredAirports = fallbackAirports.filter(airport => 
        airport.name.toLowerCase().includes(searchTerm) ||
        airport.iataCode.toLowerCase().includes(searchTerm) ||
        airport.address.cityName.toLowerCase().includes(searchTerm) ||
        airport.address.countryName.toLowerCase().includes(searchTerm)
      );

      return {
        data: filteredAirports.slice(0, options.limit || 20),
        meta: {
          count: filteredAirports.length,
          links: {}
        },
        query: query.trim(),
        fallback: true
      };
    }
    
    try {
      const response = await amadeusApiCall('/v1/reference-data/locations', {
        subType: 'AIRPORT,CITY',
        keyword: query.trim(),
        'page[limit]': options.limit || 20,
        'page[offset]': options.offset || 0,
        sort: 'analytics.travelers.score',
        view: 'FULL'
      });

      return {
        data: response.data || [],
        meta: response.meta || {},
        query: query.trim()
      };
    } catch (apiError) {
      // If API fails, fall back to local data
      logger.warn(`Amadeus API failed, using fallback data: ${apiError.message}`);
      
      const searchTerm = query.trim().toLowerCase();
      const filteredAirports = fallbackAirports.filter(airport => 
        airport.name.toLowerCase().includes(searchTerm) ||
        airport.iataCode.toLowerCase().includes(searchTerm) ||
        airport.address.cityName.toLowerCase().includes(searchTerm) ||
        airport.address.countryName.toLowerCase().includes(searchTerm)
      );

      return {
        data: filteredAirports.slice(0, options.limit || 20),
        meta: {
          count: filteredAirports.length,
          links: {}
        },
        query: query.trim(),
        fallback: true,
        error: apiError.message
      };
    }

  } catch (error) {
    logger.error(`Airport search failed for query "${query}":`, error.message);
    throw error;
  }
};

/**
 * @function clearCache
 * @description Clears the reference data cache.
 * @returns {object} Cache clear status.
 */
const clearCache = () => {
  airportsCache = null;
  countriesCache = null;
  cacheTimestamp = null;
  
  logger.info('Reference data cache cleared');
  
  return {
    success: true,
    message: 'Cache cleared successfully',
    timestamp: new Date().toISOString()
  };
};

/**
 * @function getCacheStatus
 * @description Gets the current cache status.
 * @returns {object} Cache status information.
 */
const getCacheStatus = () => {
  return {
    airports: {
      cached: !!airportsCache,
      count: airportsCache ? airportsCache.length : 0,
      valid: isCacheValid()
    },
    countries: {
      cached: !!countriesCache,
      count: countriesCache ? countriesCache.length : 0,
      valid: isCacheValid()
    },
    cacheTimestamp,
    cacheAge: cacheTimestamp ? Date.now() - cacheTimestamp : null,
    cacheDuration: CACHE_DURATION
  };
};

module.exports = {
  getAirports,
  getCountries,
  searchAirports,
  clearCache,
  getCacheStatus
};