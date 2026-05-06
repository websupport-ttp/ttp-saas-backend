// v1/services/airportDbService.js
const axios = require('axios');
const logger = require('../utils/logger');
const { ApiError } = require('../utils/apiError');
const { StatusCodes } = require('http-status-codes');

// AirportDB API configuration
const AIRPORTDB_API_KEY = 'f4068f4a77de13bc33a1e10c2fc185a296c52d39c33a42bcee4bf3e07053ca867111f8bfeab20cbf4d865dff5f433bb1';
const AIRPORTDB_BASE_URL = 'https://airportdb.io/api/v1';

// Redis client (lazy-loaded to avoid circular deps)
let redisClient = null;
const getRedis = () => {
  if (!redisClient) {
    try { redisClient = require('../config/redis'); } catch { /* no redis */ }
  }
  return redisClient?.isReady ? redisClient : null;
};

// Use prefixed helpers when available (isolates keys per environment on shared Redis)
const _get = async (key) => {
  const r = getRedis();
  if (!r) return null;
  return r.prefixedGet ? r.prefixedGet(key) : r.get(key);
};
const _set = async (key, value, options) => {
  const r = getRedis();
  if (!r) return;
  return r.prefixedSet ? r.prefixedSet(key, value, options) : r.set(key, value, options);
};
const _del = async (key) => {
  const r = getRedis();
  if (!r) return;
  return r.prefixedDel ? r.prefixedDel(key) : r.del(key);
};

// Redis key prefixes & TTLs
const REDIS_KEYS = {
  ALL_AIRPORTS:  'airportdb:airports:all',
  COUNTRIES:     'airportdb:countries',
  POPULAR:       'airportdb:popular',
  AUTOCOMPLETE:  (q, limit) => `airportdb:ac:${q}:${limit}`,
};
const TTL_24H     = 86400;
const TTL_1H      = 3600;
const TTL_POPULAR = 3600 * 6;

// In-memory fallback cache
let airportsCache   = new Map();
let countriesCache  = null;
let cacheTimestamp  = null;
let autocompleteCache = new Map();
const CACHE_DURATION              = 24 * 60 * 60 * 1000;
const AUTOCOMPLETE_CACHE_DURATION = 60 * 60 * 1000;

// ── Redis helpers ─────────────────────────────────────────────────────────────

const redisGet = async (key) => {
  try {
    const val = await _get(key);
    return val ? JSON.parse(val) : null;
  } catch (e) {
    logger.warn(`Redis GET failed for ${key}:`, e.message);
    return null;
  }
};

const redisSet = async (key, value, ttl) => {
  try {
    await _set(key, JSON.stringify(value), { EX: ttl });
  } catch (e) {
    logger.warn(`Redis SET failed for ${key}:`, e.message);
  }
};

// ── HTTP helper ───────────────────────────────────────────────────────────────

const makeAirportDbRequest = async (endpoint, params = {}) => {
  try {
    const response = await axios.get(`${AIRPORTDB_BASE_URL}${endpoint}`, {
      params: { apiToken: AIRPORTDB_API_KEY, ...params },
      timeout: 10000,
    });
    return response.data;
  } catch (error) {
    logger.error(`AirportDB API request failed for ${endpoint}:`, error.message);
    if (error.response) {
      const status  = error.response.status;
      const message = error.response.data?.message || error.response.data?.error || 'AirportDB API request failed';
      if (status === 401) throw new ApiError('Invalid AirportDB API key', StatusCodes.UNAUTHORIZED);
      if (status === 429) throw new ApiError('AirportDB API rate limit exceeded', StatusCodes.TOO_MANY_REQUESTS);
      if (status >= 500) throw new ApiError('AirportDB API server error', StatusCodes.BAD_GATEWAY);
      throw new ApiError(message, status);
    }
    throw new ApiError('Failed to connect to AirportDB API', StatusCodes.SERVICE_UNAVAILABLE);
  }
};

const isCacheValid = (timestamp, duration = CACHE_DURATION) =>
  timestamp && (Date.now() - timestamp) < duration;

// ── getAllAirports — Redis-first ───────────────────────────────────────────────

const getAllAirports = async () => {
  // 1. Try Redis
  const cached = await redisGet(REDIS_KEYS.ALL_AIRPORTS);
  if (cached && Array.isArray(cached)) {
    logger.debug(`Redis: returning ${cached.length} cached airports`);
    if (airportsCache.size === 0) {
      cached.forEach(a => airportsCache.set(a.iataCode, a));
      cacheTimestamp = Date.now();
    }
    return cached;
  }

  // 2. In-memory
  if (airportsCache.size > 0 && isCacheValid(cacheTimestamp)) {
    return Array.from(airportsCache.values());
  }

  // 3. Fetch from AirportDB
  logger.info('Fetching all airports from AirportDB...');
  const response = await makeAirportDbRequest('/airports');
  if (!response || !Array.isArray(response)) {
    throw new ApiError('Invalid response format from AirportDB', StatusCodes.BAD_GATEWAY);
  }

  airportsCache.clear();
  const processed = response.map(airport => ({
    id:          airport.id,
    iataCode:    airport.iata_code,
    icaoCode:    airport.icao_code,
    name:        airport.name,
    city:        airport.municipality || airport.city || '',
    country:     airport.country?.name || airport.country || '',
    countryCode: airport.iso_country  || airport.country?.code || airport.country_code || '',
    latitude:    parseFloat(airport.latitude_deg  || airport.latitude)  || null,
    longitude:   parseFloat(airport.longitude_deg || airport.longitude) || null,
    elevation:   parseInt(airport.elevation_ft    || airport.elevation) || null,
    timezone:    airport.timezone || '',
    type:        airport.type || 'airport',
    searchText:  `${airport.name} ${airport.municipality || airport.city || ''} ${airport.country?.name || airport.country || ''} ${airport.iata_code} ${airport.icao_code}`.toLowerCase(),
    displayName: `${airport.name} (${airport.iata_code})`,
    fullDisplayName: `${airport.name}, ${airport.municipality || airport.city || ''}, ${airport.country?.name || airport.country || ''} (${airport.iata_code})`,
  })).filter(a => a.iataCode);

  processed.forEach(a => airportsCache.set(a.iataCode, a));
  cacheTimestamp = Date.now();

  redisSet(REDIS_KEYS.ALL_AIRPORTS, processed, TTL_24H); // fire-and-forget
  logger.info(`Fetched and cached ${processed.length} airports`);
  return processed;
};

// ── searchAirportsForAutocomplete — Redis-first ───────────────────────────────

const searchAirportsForAutocomplete = async (query, options = {}) => {
  if (!query || query.trim().length < 1) return [];

  const searchQuery = query.trim().toLowerCase();
  const limit       = options.limit || 10;
  const cacheKey    = REDIS_KEYS.AUTOCOMPLETE(searchQuery, limit);

  // 1. Redis
  const redisCached = await redisGet(cacheKey);
  if (redisCached) {
    logger.debug(`Redis autocomplete hit: "${searchQuery}"`);
    return redisCached;
  }

  // 2. In-memory autocomplete cache
  const memKey    = `${searchQuery}_${limit}`;
  const memCached = autocompleteCache.get(memKey);
  if (memCached && isCacheValid(memCached.timestamp, AUTOCOMPLETE_CACHE_DURATION)) {
    return memCached.data;
  }

  // 3. Search
  await getAllAirports();
  const allAirports = Array.from(airportsCache.values());

  const exactMatches = [], startsWithMatches = [], containsMatches = [];

  for (const airport of allAirports) {
    const { iataCode, name, city, country, searchText } = airport;
    if (iataCode.toLowerCase() === searchQuery) {
      exactMatches.push({ ...airport, matchScore: 100 }); continue;
    }
    if (iataCode.toLowerCase().startsWith(searchQuery)) {
      startsWithMatches.push({ ...airport, matchScore: 90 }); continue;
    }
    if (name.toLowerCase().startsWith(searchQuery)) {
      startsWithMatches.push({ ...airport, matchScore: 85 }); continue;
    }
    if (city.toLowerCase().startsWith(searchQuery)) {
      startsWithMatches.push({ ...airport, matchScore: 80 }); continue;
    }
    if (country.toLowerCase().startsWith(searchQuery)) {
      startsWithMatches.push({ ...airport, matchScore: 75 }); continue;
    }
    if (searchText.includes(searchQuery)) {
      containsMatches.push({ ...airport, matchScore: calculateContainsScore(searchText, searchQuery, name, city) });
    }
  }

  const combined = [
    ...exactMatches,
    ...startsWithMatches.sort((a, b) => b.matchScore - a.matchScore),
    ...containsMatches.sort((a, b) => b.matchScore - a.matchScore),
  ];

  const seen = new Set();
  const uniqueResults = [];
  for (const r of combined) {
    if (!seen.has(r.iataCode) && uniqueResults.length < limit) {
      seen.add(r.iataCode);
      uniqueResults.push(r);
    }
  }

  // Store in Redis + in-memory
  redisSet(cacheKey, uniqueResults, TTL_1H);
  autocompleteCache.set(memKey, { data: uniqueResults, timestamp: Date.now() });
  if (autocompleteCache.size > 200) {
    const entries = Array.from(autocompleteCache.entries()).sort((a, b) => b[1].timestamp - a[1].timestamp);
    autocompleteCache.clear();
    entries.slice(0, 100).forEach(([k, v]) => autocompleteCache.set(k, v));
  }

  logger.debug(`Found ${uniqueResults.length} airports for query: "${searchQuery}"`);
  return uniqueResults;
};

const calculateContainsScore = (searchText, query, name, city) => {
  let score = 50;
  if (name.toLowerCase().includes(query)) score += 20;
  if (city.toLowerCase().includes(query)) score += 15;
  if (name.length < 30) score += 10;
  if (searchText.indexOf(query) < 20) score += 10;
  return score;
};

// ── getAirportByCode ──────────────────────────────────────────────────────────

const getAirportByCode = async (code) => {
  if (!code || code.trim().length < 3) {
    throw new ApiError('Airport code must be at least 3 characters', StatusCodes.BAD_REQUEST);
  }
  const airportCode = code.trim().toUpperCase();
  await getAllAirports();
  let airport = airportsCache.get(airportCode);
  if (!airport) {
    airport = Array.from(airportsCache.values()).find(a => a.icaoCode === airportCode);
  }
  if (!airport) throw new ApiError(`Airport not found: ${airportCode}`, StatusCodes.NOT_FOUND);
  return airport;
};

// ── getPopularAirports — Redis-first ─────────────────────────────────────────

const getPopularAirports = async (options = {}) => {
  const limit   = options.limit || 50;
  const country = options.country?.toUpperCase();
  const cacheKey = `${REDIS_KEYS.POPULAR}:${country || 'all'}:${limit}`;

  const redisCached = await redisGet(cacheKey);
  if (redisCached) return redisCached;

  await getAllAirports();

  const popularCodes = [
    'JFK','LAX','ORD','DFW','ATL','DEN','SFO','SEA','LAS','MIA',
    'LHR','CDG','FRA','AMS','MAD','FCO','MUC','ZUR','VIE','CPH',
    'NRT','ICN','SIN','HKG','PVG','BKK','KUL','CGK','MNL','DEL',
    'DXB','DOH','AUH','KWI','RUH','CAI',
    'LOS','ABV','JNB','CPT','ADD','NBO','ACC','PHC','KAN','ENU',
    'SYD','MEL','AKL','BNE','PER',
    'YYZ','YVR','YUL','YYC',
    'GRU','EZE','SCL','LIM','BOG',
  ];

  const result = [];
  for (const code of popularCodes) {
    const airport = airportsCache.get(code);
    if (airport && (!country || airport.countryCode === country)) {
      result.push(airport);
    }
    if (result.length >= limit) break;
  }

  if (country && result.length < limit) {
    const extra = Array.from(airportsCache.values())
      .filter(a => a.countryCode === country && !result.find(p => p.iataCode === a.iataCode))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, limit - result.length);
    result.push(...extra);
  }

  redisSet(cacheKey, result, TTL_POPULAR);
  return result;
};

// ── getCountries — Redis-first ────────────────────────────────────────────────

const getCountries = async () => {
  const redisCached = await redisGet(REDIS_KEYS.COUNTRIES);
  if (redisCached) return redisCached;

  if (countriesCache && isCacheValid(cacheTimestamp)) return countriesCache;

  await getAllAirports();
  const map = new Map();
  Array.from(airportsCache.values()).forEach(a => {
    if (a.country && a.countryCode) {
      map.set(a.countryCode, {
        code:         a.countryCode,
        name:         a.country,
        airportCount: (map.get(a.countryCode)?.airportCount || 0) + 1,
      });
    }
  });

  const countries = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  countriesCache = countries;
  redisSet(REDIS_KEYS.COUNTRIES, countries, TTL_24H);
  logger.info(`Generated ${countries.length} countries`);
  return countries;
};

// ── Cache management ──────────────────────────────────────────────────────────

const clearCache = () => {
  airportsCache.clear();
  autocompleteCache.clear();
  countriesCache  = null;
  cacheTimestamp  = null;
  const r = getRedis();
  if (r) {
    _del(REDIS_KEYS.ALL_AIRPORTS).catch(() => {});
    _del(REDIS_KEYS.COUNTRIES).catch(() => {});
  }
  logger.info('AirportDB cache cleared');
  return { success: true, message: 'All caches cleared', timestamp: new Date().toISOString() };
};

const getCacheStatus = () => ({
  airports:      { count: airportsCache.size,    valid: isCacheValid(cacheTimestamp) },
  autocomplete:  { count: autocompleteCache.size },
  countries:     { count: countriesCache?.length || 0 },
  redis:         { connected: !!getRedis() },
  cacheTimestamp,
  cacheAge: cacheTimestamp ? Date.now() - cacheTimestamp : null,
});

module.exports = {
  getAllAirports,
  searchAirportsForAutocomplete,
  getAirportByCode,
  getPopularAirports,
  getCountries,
  clearCache,
  getCacheStatus,
};
