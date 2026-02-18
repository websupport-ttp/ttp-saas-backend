// v1/services/airportDbService.js
const axios = require('axios');
const logger = require('../utils/logger');
const { ApiError } = require('../utils/apiError');
const { StatusCodes } = require('http-status-codes');

// AirportDB API configuration
const AIRPORTDB_API_KEY = 'f4068f4a77de13bc33a1e10c2fc185a296c52d39c33a42bcee4bf3e07053ca867111f8bfeab20cbf4d865dff5f433bb1';
const AIRPORTDB_BASE_URL = 'https://airportdb.io/api/v1';

// Cache configuration
let airportsCache = new Map(); // Use Map for better performance with large datasets
let countriesCache = null;
let citiesCache = new Map();
let cacheTimestamp = null;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const AUTOCOMPLETE_CACHE_DURATION = 60 * 60 * 1000; // 1 hour for autocomplete results

// Autocomplete cache for search queries
let autocompleteCache = new Map();

/**
 * @function makeAirportDbRequest
 * @description Makes authenticated requests to AirportDB API
 * @param {string} endpoint - API endpoint
 * @param {object} params - Query parameters
 * @returns {object} API response data
 */
const makeAirportDbRequest = async (endpoint, params = {}) => {
  try {
    const response = await axios.get(`${AIRPORTDB_BASE_URL}${endpoint}`, {
      params: {
        apiToken: AIRPORTDB_API_KEY,
        ...params
      },
      timeout: 10000 // 10 second timeout
    });

    return response.data;
  } catch (error) {
    logger.error(`AirportDB API request failed for ${endpoint}:`, error.message);
    
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || error.response.data?.error || 'AirportDB API request failed';
      
      if (status === 401) {
        throw new ApiError('Invalid AirportDB API key', StatusCodes.UNAUTHORIZED);
      } else if (status === 429) {
        throw new ApiError('AirportDB API rate limit exceeded', StatusCodes.TOO_MANY_REQUESTS);
      } else if (status >= 500) {
        throw new ApiError('AirportDB API server error', StatusCodes.BAD_GATEWAY);
      }
      
      throw new ApiError(message, status);
    }
    
    throw new ApiError('Failed to connect to AirportDB API', StatusCodes.SERVICE_UNAVAILABLE);
  }
};

/**
 * @function isCacheValid
 * @description Checks if cache is still valid
 * @param {number} timestamp - Cache timestamp
 * @param {number} duration - Cache duration in milliseconds
 * @returns {boolean} True if cache is valid
 */
const isCacheValid = (timestamp, duration = CACHE_DURATION) => {
  return timestamp && (Date.now() - timestamp) < duration;
};

/**
 * @function getAllAirports
 * @description Fetches all airports from AirportDB and caches them
 * @returns {Array} Array of airport objects
 */
const getAllAirports = async () => {
  try {
    // Check if we have valid cached data
    if (airportsCache.size > 0 && isCacheValid(cacheTimestamp)) {
      logger.info(`Returning ${airportsCache.size} cached airports`);
      return Array.from(airportsCache.values());
    }

    logger.info('Fetching all airports from AirportDB...');
    
    // Fetch airports from AirportDB
    const response = await makeAirportDbRequest('/airports');
    
    if (!response || !Array.isArray(response)) {
      throw new ApiError('Invalid response format from AirportDB', StatusCodes.BAD_GATEWAY);
    }

    // Clear existing cache
    airportsCache.clear();
    
    // Process and cache airports
    const processedAirports = response.map(airport => ({
      id: airport.id,
      iataCode: airport.iata_code,
      icaoCode: airport.icao_code,
      name: airport.name,
      city: airport.city,
      country: airport.country,
      countryCode: airport.country_code,
      latitude: parseFloat(airport.latitude) || null,
      longitude: parseFloat(airport.longitude) || null,
      elevation: parseInt(airport.elevation) || null,
      timezone: airport.timezone,
      type: airport.type || 'airport',
      // Format for autocomplete
      searchText: `${airport.name} ${airport.city} ${airport.country} ${airport.iata_code} ${airport.icao_code}`.toLowerCase(),
      displayName: `${airport.name} (${airport.iata_code})`,
      fullDisplayName: `${airport.name}, ${airport.city}, ${airport.country} (${airport.iata_code})`
    })).filter(airport => airport.iataCode); // Only include airports with IATA codes

    // Cache airports by IATA code for fast lookup
    processedAirports.forEach(airport => {
      airportsCache.set(airport.iataCode, airport);
    });

    cacheTimestamp = Date.now();
    
    logger.info(`Fetched and cached ${processedAirports.length} airports from AirportDB`);
    
    return processedAirports;

  } catch (error) {
    logger.error('Failed to fetch airports from AirportDB:', error.message);
    
    // If we have cached data (even if expired), return it
    if (airportsCache.size > 0) {
      logger.warn('Returning expired cached airports due to API error');
      return Array.from(airportsCache.values());
    }
    
    throw error;
  }
};

/**
 * @function searchAirportsForAutocomplete
 * @description Search airports optimized for autocomplete functionality
 * @param {string} query - Search query
 * @param {object} options - Search options
 * @returns {Array} Array of matching airports
 */
const searchAirportsForAutocomplete = async (query, options = {}) => {
  try {
    if (!query || query.trim().length < 1) {
      return [];
    }

    const searchQuery = query.trim().toLowerCase();
    const limit = options.limit || 10;
    
    // Check autocomplete cache first
    const cacheKey = `${searchQuery}_${limit}`;
    const cachedResult = autocompleteCache.get(cacheKey);
    
    if (cachedResult && isCacheValid(cachedResult.timestamp, AUTOCOMPLETE_CACHE_DURATION)) {
      logger.debug(`Returning cached autocomplete results for: ${searchQuery}`);
      return cachedResult.data;
    }

    // Ensure we have airport data
    await getAllAirports();
    
    const allAirports = Array.from(airportsCache.values());
    
    // Search algorithm optimized for autocomplete
    const results = [];
    const exactMatches = [];
    const startsWithMatches = [];
    const containsMatches = [];
    
    for (const airport of allAirports) {
      // Skip if we already have enough results
      if (results.length >= limit * 3) break; // Get more than needed for better sorting
      
      const { iataCode, name, city, country, searchText } = airport;
      
      // Exact IATA code match (highest priority)
      if (iataCode.toLowerCase() === searchQuery) {
        exactMatches.push({ ...airport, matchScore: 100 });
        continue;
      }
      
      // IATA code starts with query
      if (iataCode.toLowerCase().startsWith(searchQuery)) {
        startsWithMatches.push({ ...airport, matchScore: 90 });
        continue;
      }
      
      // Airport name starts with query
      if (name.toLowerCase().startsWith(searchQuery)) {
        startsWithMatches.push({ ...airport, matchScore: 85 });
        continue;
      }
      
      // City name starts with query
      if (city.toLowerCase().startsWith(searchQuery)) {
        startsWithMatches.push({ ...airport, matchScore: 80 });
        continue;
      }
      
      // Country name starts with query
      if (country.toLowerCase().startsWith(searchQuery)) {
        startsWithMatches.push({ ...airport, matchScore: 75 });
        continue;
      }
      
      // Contains query in search text
      if (searchText.includes(searchQuery)) {
        const score = calculateContainsScore(searchText, searchQuery, name, city);
        containsMatches.push({ ...airport, matchScore: score });
      }
    }
    
    // Combine and sort results
    const combinedResults = [
      ...exactMatches,
      ...startsWithMatches.sort((a, b) => b.matchScore - a.matchScore),
      ...containsMatches.sort((a, b) => b.matchScore - a.matchScore)
    ];
    
    // Remove duplicates and limit results
    const uniqueResults = [];
    const seenCodes = new Set();
    
    for (const result of combinedResults) {
      if (!seenCodes.has(result.iataCode) && uniqueResults.length < limit) {
        seenCodes.add(result.iataCode);
        uniqueResults.push(result);
      }
    }
    
    // Cache the results
    autocompleteCache.set(cacheKey, {
      data: uniqueResults,
      timestamp: Date.now()
    });
    
    // Clean up old cache entries (keep only last 100 searches)
    if (autocompleteCache.size > 100) {
      const entries = Array.from(autocompleteCache.entries());
      entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
      autocompleteCache.clear();
      entries.slice(0, 100).forEach(([key, value]) => {
        autocompleteCache.set(key, value);
      });
    }
    
    logger.debug(`Found ${uniqueResults.length} airports for query: ${searchQuery}`);
    
    return uniqueResults;

  } catch (error) {
    logger.error(`Airport autocomplete search failed for query "${query}":`, error.message);
    throw error;
  }
};

/**
 * @function calculateContainsScore
 * @description Calculate relevance score for contains matches
 * @param {string} searchText - Full search text
 * @param {string} query - Search query
 * @param {string} name - Airport name
 * @param {string} city - City name
 * @returns {number} Relevance score
 */
const calculateContainsScore = (searchText, query, name, city) => {
  let score = 50; // Base score for contains match
  
  // Boost score if query appears in name
  if (name.toLowerCase().includes(query)) {
    score += 20;
  }
  
  // Boost score if query appears in city
  if (city.toLowerCase().includes(query)) {
    score += 15;
  }
  
  // Boost score for shorter names (more specific matches)
  if (name.length < 30) {
    score += 10;
  }
  
  // Boost score if query appears early in the text
  const queryIndex = searchText.indexOf(query);
  if (queryIndex < 20) {
    score += 10;
  }
  
  return score;
};

/**
 * @function getAirportByCode
 * @description Get airport details by IATA or ICAO code
 * @param {string} code - Airport code (IATA or ICAO)
 * @returns {object} Airport details
 */
const getAirportByCode = async (code) => {
  try {
    if (!code || code.trim().length < 3) {
      throw new ApiError('Airport code must be at least 3 characters', StatusCodes.BAD_REQUEST);
    }

    const airportCode = code.trim().toUpperCase();
    
    // Ensure we have airport data
    await getAllAirports();
    
    // Try IATA code first
    let airport = airportsCache.get(airportCode);
    
    // If not found by IATA, search by ICAO
    if (!airport) {
      const allAirports = Array.from(airportsCache.values());
      airport = allAirports.find(a => a.icaoCode === airportCode);
    }
    
    if (!airport) {
      throw new ApiError(`Airport not found with code: ${airportCode}`, StatusCodes.NOT_FOUND);
    }
    
    return airport;

  } catch (error) {
    logger.error(`Failed to get airport by code "${code}":`, error.message);
    throw error;
  }
};

/**
 * @function getPopularAirports
 * @description Get list of popular airports for quick selection
 * @param {object} options - Options (limit, country, etc.)
 * @returns {Array} Array of popular airports
 */
const getPopularAirports = async (options = {}) => {
  try {
    // Ensure we have airport data
    await getAllAirports();
    
    const limit = options.limit || 50;
    const country = options.country?.toUpperCase();
    
    // Define popular airport codes (major international hubs)
    const popularCodes = [
      // Major US hubs
      'JFK', 'LAX', 'ORD', 'DFW', 'ATL', 'DEN', 'SFO', 'SEA', 'LAS', 'MIA',
      // Major European hubs
      'LHR', 'CDG', 'FRA', 'AMS', 'MAD', 'FCO', 'MUC', 'ZUR', 'VIE', 'CPH',
      // Major Asian hubs
      'NRT', 'ICN', 'SIN', 'HKG', 'PVG', 'BKK', 'KUL', 'CGK', 'MNL', 'DEL',
      // Major Middle Eastern hubs
      'DXB', 'DOH', 'AUH', 'KWI', 'RUH', 'CAI',
      // Major African hubs
      'LOS', 'ABV', 'JNB', 'CPT', 'CAI', 'ADD', 'NBO', 'ACC',
      // Major Australian/Oceanian hubs
      'SYD', 'MEL', 'AKL', 'BNE', 'PER',
      // Major Canadian hubs
      'YYZ', 'YVR', 'YUL', 'YYC',
      // Major South American hubs
      'GRU', 'EZE', 'SCL', 'LIM', 'BOG'
    ];
    
    const popularAirports = [];
    
    // Get airports by popular codes
    for (const code of popularCodes) {
      const airport = airportsCache.get(code);
      if (airport) {
        // Filter by country if specified
        if (!country || airport.countryCode === country) {
          popularAirports.push(airport);
        }
      }
      
      if (popularAirports.length >= limit) break;
    }
    
    // If we don't have enough popular airports, add more from the same country
    if (country && popularAirports.length < limit) {
      const allAirports = Array.from(airportsCache.values());
      const countryAirports = allAirports
        .filter(a => a.countryCode === country && !popularAirports.find(p => p.iataCode === a.iataCode))
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, limit - popularAirports.length);
      
      popularAirports.push(...countryAirports);
    }
    
    return popularAirports;

  } catch (error) {
    logger.error('Failed to get popular airports:', error.message);
    throw error;
  }
};

/**
 * @function getCountries
 * @description Get list of countries from airport data
 * @returns {Array} Array of country objects
 */
const getCountries = async () => {
  try {
    // Check cache first
    if (countriesCache && isCacheValid(cacheTimestamp)) {
      logger.info('Returning cached countries data');
      return countriesCache;
    }

    // Ensure we have airport data
    await getAllAirports();
    
    const allAirports = Array.from(airportsCache.values());
    const countriesMap = new Map();
    
    // Extract unique countries from airport data
    allAirports.forEach(airport => {
      if (airport.country && airport.countryCode) {
        countriesMap.set(airport.countryCode, {
          code: airport.countryCode,
          name: airport.country,
          airportCount: (countriesMap.get(airport.countryCode)?.airportCount || 0) + 1
        });
      }
    });
    
    // Convert to array and sort by name
    const countries = Array.from(countriesMap.values())
      .sort((a, b) => a.name.localeCompare(b.name));
    
    // Cache the results
    countriesCache = countries;
    
    logger.info(`Generated ${countries.length} countries from airport data`);
    
    return countries;

  } catch (error) {
    logger.error('Failed to get countries:', error.message);
    throw error;
  }
};

/**
 * @function clearCache
 * @description Clear all caches
 * @returns {object} Cache clear status
 */
const clearCache = () => {
  airportsCache.clear();
  autocompleteCache.clear();
  countriesCache = null;
  citiesCache.clear();
  cacheTimestamp = null;
  
  logger.info('AirportDB cache cleared');
  
  return {
    success: true,
    message: 'All caches cleared successfully',
    timestamp: new Date().toISOString()
  };
};

/**
 * @function getCacheStatus
 * @description Get current cache status
 * @returns {object} Cache status information
 */
const getCacheStatus = () => {
  return {
    airports: {
      count: airportsCache.size,
      valid: isCacheValid(cacheTimestamp)
    },
    autocomplete: {
      count: autocompleteCache.size,
      entries: Array.from(autocompleteCache.keys()).slice(0, 10) // Show first 10 cached queries
    },
    countries: {
      count: countriesCache ? countriesCache.length : 0,
      valid: countriesCache && isCacheValid(cacheTimestamp)
    },
    cacheTimestamp,
    cacheAge: cacheTimestamp ? Date.now() - cacheTimestamp : null,
    cacheDuration: CACHE_DURATION,
    autocompleteCacheDuration: AUTOCOMPLETE_CACHE_DURATION
  };
};

module.exports = {
  getAllAirports,
  searchAirportsForAutocomplete,
  getAirportByCode,
  getPopularAirports,
  getCountries,
  clearCache,
  getCacheStatus
};