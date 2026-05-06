// v1/services/airportDbService.js
//
// AirportDB API only supports per-airport lookup by IATA code.
// There is NO bulk /airports endpoint. Strategy:
//   - Popular airports: built-in static dataset (no API call needed)
//   - Search/autocomplete: call AirportDB /airport/{iata_code} for exact matches,
//     plus search against the static popular dataset for fast results
//   - Countries: derived from static dataset
//
const axios = require('axios');
const logger = require('../utils/logger');
const { ApiError } = require('../utils/apiError');
const { StatusCodes } = require('http-status-codes');

const AIRPORTDB_API_KEY  = 'f4068f4a77de13bc33a1e10c2fc185a296c52d39c33a42bcee4bf3e07053ca867111f8bfeab20cbf4d865dff5f433bb1';
const AIRPORTDB_BASE_URL = 'https://airportdb.io/api/v1';

// ── Redis (lazy-loaded) ───────────────────────────────────────────────────────

let redisClient = null;
const getRedis = () => {
  if (!redisClient) {
    try { redisClient = require('../config/redis'); } catch { /* no redis */ }
  }
  return redisClient?.isReady ? redisClient : null;
};

const _get = async (key) => { const r = getRedis(); if (!r) return null; return r.prefixedGet ? r.prefixedGet(key) : r.get(key); };
const _set = async (key, value, options) => { const r = getRedis(); if (!r) return; return r.prefixedSet ? r.prefixedSet(key, value, options) : r.set(key, value, options); };
const _del = async (key) => { const r = getRedis(); if (!r) return; return r.prefixedDel ? r.prefixedDel(key) : r.del(key); };

const REDIS_KEYS = {
  POPULAR:      (country, limit) => `airportdb:popular:${country || 'all'}:${limit}`,
  COUNTRIES:    'airportdb:countries',
  AIRPORT:      (code) => `airportdb:airport:${code}`,
  AUTOCOMPLETE: (q, limit) => `airportdb:ac:${q}:${limit}`,
};
const TTL_24H     = 86400;
const TTL_1H      = 3600;
const TTL_POPULAR = 3600 * 6;

const redisGet = async (key) => { try { const v = await _get(key); return v ? JSON.parse(v) : null; } catch { return null; } };
const redisSet = async (key, value, ttl) => { try { await _set(key, JSON.stringify(value), { EX: ttl }); } catch { /* ignore */ } };

// ── Static popular airport dataset ───────────────────────────────────────────
// Used for getPopularAirports and as a fast search index.
// No API call needed — this data is stable.

const POPULAR_AIRPORTS = [
  // Nigeria
  { iataCode:'LOS', icaoCode:'DNMM', name:'Murtala Muhammed International Airport',    city:'Lagos',         country:'Nigeria',      countryCode:'NG', latitude:6.5774,   longitude:3.3212  },
  { iataCode:'ABV', icaoCode:'DNAA', name:'Nnamdi Azikiwe International Airport',       city:'Abuja',         country:'Nigeria',      countryCode:'NG', latitude:9.0068,   longitude:7.2632  },
  { iataCode:'PHC', icaoCode:'DNPO', name:'Port Harcourt International Airport',        city:'Port Harcourt', country:'Nigeria',      countryCode:'NG', latitude:5.0155,   longitude:6.9496  },
  { iataCode:'KAN', icaoCode:'DNKN', name:'Mallam Aminu Kano International Airport',   city:'Kano',          country:'Nigeria',      countryCode:'NG', latitude:12.0476,  longitude:8.5246  },
  { iataCode:'ENU', icaoCode:'DNEN', name:'Akanu Ibiam International Airport',          city:'Enugu',         country:'Nigeria',      countryCode:'NG', latitude:6.4742,   longitude:7.5620  },
  // US
  { iataCode:'JFK', icaoCode:'KJFK', name:'John F. Kennedy International Airport',     city:'New York',      country:'United States',countryCode:'US', latitude:40.6413,  longitude:-73.7781 },
  { iataCode:'LAX', icaoCode:'KLAX', name:'Los Angeles International Airport',          city:'Los Angeles',   country:'United States',countryCode:'US', latitude:33.9425,  longitude:-118.4081},
  { iataCode:'ORD', icaoCode:'KORD', name:"O'Hare International Airport",              city:'Chicago',       country:'United States',countryCode:'US', latitude:41.9742,  longitude:-87.9073 },
  { iataCode:'DFW', icaoCode:'KDFW', name:'Dallas/Fort Worth International Airport',   city:'Dallas',        country:'United States',countryCode:'US', latitude:32.8998,  longitude:-97.0403 },
  { iataCode:'ATL', icaoCode:'KATL', name:'Hartsfield-Jackson Atlanta International',  city:'Atlanta',       country:'United States',countryCode:'US', latitude:33.6407,  longitude:-84.4277 },
  { iataCode:'MIA', icaoCode:'KMIA', name:'Miami International Airport',               city:'Miami',         country:'United States',countryCode:'US', latitude:25.7959,  longitude:-80.2870 },
  { iataCode:'SFO', icaoCode:'KSFO', name:'San Francisco International Airport',       city:'San Francisco', country:'United States',countryCode:'US', latitude:37.6213,  longitude:-122.3790},
  // Europe
  { iataCode:'LHR', icaoCode:'EGLL', name:'Heathrow Airport',                          city:'London',        country:'United Kingdom',countryCode:'GB', latitude:51.4775,  longitude:-0.4614  },
  { iataCode:'CDG', icaoCode:'LFPG', name:'Charles de Gaulle Airport',                 city:'Paris',         country:'France',       countryCode:'FR', latitude:49.0097,  longitude:2.5479   },
  { iataCode:'FRA', icaoCode:'EDDF', name:'Frankfurt Airport',                         city:'Frankfurt',     country:'Germany',      countryCode:'DE', latitude:50.0379,  longitude:8.5622   },
  { iataCode:'AMS', icaoCode:'EHAM', name:'Amsterdam Airport Schiphol',                city:'Amsterdam',     country:'Netherlands',  countryCode:'NL', latitude:52.3086,  longitude:4.7639   },
  { iataCode:'MAD', icaoCode:'LEMD', name:'Adolfo Suárez Madrid–Barajas Airport',      city:'Madrid',        country:'Spain',        countryCode:'ES', latitude:40.4936,  longitude:-3.5668  },
  { iataCode:'FCO', icaoCode:'LIRF', name:'Leonardo da Vinci International Airport',   city:'Rome',          country:'Italy',        countryCode:'IT', latitude:41.8003,  longitude:12.2389  },
  { iataCode:'MUC', icaoCode:'EDDM', name:'Munich Airport',                            city:'Munich',        country:'Germany',      countryCode:'DE', latitude:48.3538,  longitude:11.7861  },
  // Middle East
  { iataCode:'DXB', icaoCode:'OMDB', name:'Dubai International Airport',               city:'Dubai',         country:'UAE',          countryCode:'AE', latitude:25.2532,  longitude:55.3657  },
  { iataCode:'DOH', icaoCode:'OTHH', name:'Hamad International Airport',               city:'Doha',          country:'Qatar',        countryCode:'QA', latitude:25.2731,  longitude:51.6080  },
  { iataCode:'AUH', icaoCode:'OMAA', name:'Abu Dhabi International Airport',           city:'Abu Dhabi',     country:'UAE',          countryCode:'AE', latitude:24.4330,  longitude:54.6511  },
  // Asia
  { iataCode:'NRT', icaoCode:'RJAA', name:'Narita International Airport',              city:'Tokyo',         country:'Japan',        countryCode:'JP', latitude:35.7647,  longitude:140.3864 },
  { iataCode:'ICN', icaoCode:'RKSI', name:'Incheon International Airport',             city:'Seoul',         country:'South Korea',  countryCode:'KR', latitude:37.4602,  longitude:126.4407 },
  { iataCode:'SIN', icaoCode:'WSSS', name:'Singapore Changi Airport',                  city:'Singapore',     country:'Singapore',    countryCode:'SG', latitude:1.3644,   longitude:103.9915 },
  { iataCode:'HKG', icaoCode:'VHHH', name:'Hong Kong International Airport',           city:'Hong Kong',     country:'Hong Kong',    countryCode:'HK', latitude:22.3080,  longitude:113.9185 },
  { iataCode:'BKK', icaoCode:'VTBS', name:'Suvarnabhumi Airport',                      city:'Bangkok',       country:'Thailand',     countryCode:'TH', latitude:13.6900,  longitude:100.7501 },
  { iataCode:'DEL', icaoCode:'VIDP', name:'Indira Gandhi International Airport',       city:'New Delhi',     country:'India',        countryCode:'IN', latitude:28.5665,  longitude:77.1031  },
  { iataCode:'PVG', icaoCode:'ZSPD', name:'Shanghai Pudong International Airport',     city:'Shanghai',      country:'China',        countryCode:'CN', latitude:31.1443,  longitude:121.8083 },
  // Africa
  { iataCode:'JNB', icaoCode:'FAOR', name:'O.R. Tambo International Airport',          city:'Johannesburg',  country:'South Africa', countryCode:'ZA', latitude:-26.1392, longitude:28.2460  },
  { iataCode:'CPT', icaoCode:'FACT', name:'Cape Town International Airport',           city:'Cape Town',     country:'South Africa', countryCode:'ZA', latitude:-33.9648, longitude:18.6017  },
  { iataCode:'NBO', icaoCode:'HKJK', name:'Jomo Kenyatta International Airport',       city:'Nairobi',       country:'Kenya',        countryCode:'KE', latitude:-1.3192,  longitude:36.9275  },
  { iataCode:'ADD', icaoCode:'HAAB', name:'Addis Ababa Bole International Airport',    city:'Addis Ababa',   country:'Ethiopia',     countryCode:'ET', latitude:8.9779,   longitude:38.7993  },
  { iataCode:'ACC', icaoCode:'DGAA', name:'Kotoka International Airport',              city:'Accra',         country:'Ghana',        countryCode:'GH', latitude:5.6052,   longitude:-0.1668  },
  { iataCode:'CAI', icaoCode:'HECA', name:'Cairo International Airport',               city:'Cairo',         country:'Egypt',        countryCode:'EG', latitude:30.1219,  longitude:31.4056  },
  // Oceania
  { iataCode:'SYD', icaoCode:'YSSY', name:'Sydney Kingsford Smith Airport',            city:'Sydney',        country:'Australia',    countryCode:'AU', latitude:-33.9399, longitude:151.1753 },
  { iataCode:'MEL', icaoCode:'YMML', name:'Melbourne Airport',                         city:'Melbourne',     country:'Australia',    countryCode:'AU', latitude:-37.6690, longitude:144.8410 },
  { iataCode:'AKL', icaoCode:'NZAA', name:'Auckland Airport',                          city:'Auckland',      country:'New Zealand',  countryCode:'NZ', latitude:-37.0082, longitude:174.7850 },
  // Canada
  { iataCode:'YYZ', icaoCode:'CYYZ', name:'Toronto Pearson International Airport',    city:'Toronto',       country:'Canada',       countryCode:'CA', latitude:43.6777,  longitude:-79.6248 },
  { iataCode:'YVR', icaoCode:'CYVR', name:'Vancouver International Airport',           city:'Vancouver',     country:'Canada',       countryCode:'CA', latitude:49.1967,  longitude:-123.1815},
  // South America
  { iataCode:'GRU', icaoCode:'SBGR', name:'São Paulo/Guarulhos International Airport', city:'São Paulo',     country:'Brazil',       countryCode:'BR', latitude:-23.4356, longitude:-46.4731 },
  { iataCode:'EZE', icaoCode:'SAEZ', name:'Ministro Pistarini International Airport',  city:'Buenos Aires',  country:'Argentina',    countryCode:'AR', latitude:-34.8222, longitude:-58.5358 },
  { iataCode:'BOG', icaoCode:'SKBO', name:'El Dorado International Airport',           city:'Bogotá',        country:'Colombia',     countryCode:'CO', latitude:4.7016,   longitude:-74.1469 },
].map(a => ({
  ...a,
  searchText:      `${a.name} ${a.city} ${a.country} ${a.iataCode} ${a.icaoCode}`.toLowerCase(),
  displayName:     `${a.name} (${a.iataCode})`,
  fullDisplayName: `${a.name}, ${a.city}, ${a.country} (${a.iataCode})`,
}));

// Fast lookup map
const POPULAR_MAP = new Map(POPULAR_AIRPORTS.map(a => [a.iataCode, a]));

// ── AirportDB single-airport lookup ──────────────────────────────────────────

const fetchAirportByCode = async (iataCode) => {
  const cacheKey = REDIS_KEYS.AIRPORT(iataCode);
  const cached = await redisGet(cacheKey);
  if (cached) return cached;

  try {
    const response = await axios.get(`${AIRPORTDB_BASE_URL}/airport/${iataCode}`, {
      params: { apiToken: AIRPORTDB_API_KEY },
      timeout: 8000,
    });
    const a = response.data;
    if (!a || !a.iata_code) return null;

    const airport = {
      id:          a.id,
      iataCode:    a.iata_code,
      icaoCode:    a.icao_code,
      name:        a.name,
      city:        a.municipality || a.city || '',
      country:     a.country?.name || a.country || '',
      countryCode: a.iso_country  || a.country?.code || '',
      latitude:    parseFloat(a.latitude_deg  || a.latitude)  || null,
      longitude:   parseFloat(a.longitude_deg || a.longitude) || null,
      timezone:    a.timezone || '',
      type:        a.type || 'airport',
      searchText:  `${a.name} ${a.municipality || ''} ${a.country?.name || ''} ${a.iata_code} ${a.icao_code}`.toLowerCase(),
      displayName: `${a.name} (${a.iata_code})`,
      fullDisplayName: `${a.name}, ${a.municipality || ''}, ${a.country?.name || ''} (${a.iata_code})`,
    };

    redisSet(cacheKey, airport, TTL_24H);
    return airport;
  } catch (e) {
    logger.warn(`AirportDB lookup failed for ${iataCode}: ${e.message}`);
    return null;
  }
};

// ── getAllAirports — returns static popular set (no bulk API call) ─────────────

const getAllAirports = async () => POPULAR_AIRPORTS;

// ── searchAirportsForAutocomplete ─────────────────────────────────────────────

const searchAirportsForAutocomplete = async (query, options = {}) => {
  if (!query || query.trim().length < 1) return [];

  const q     = query.trim().toLowerCase();
  const limit = options.limit || 10;
  const cacheKey = REDIS_KEYS.AUTOCOMPLETE(q, limit);

  // 1. Redis cache
  const cached = await redisGet(cacheKey);
  if (cached) return cached;

  // 2. Search static popular dataset first (instant)
  const exact = [], startsWith = [], contains = [];

  for (const a of POPULAR_AIRPORTS) {
    if (a.iataCode.toLowerCase() === q)              { exact.push({ ...a, matchScore: 100 }); continue; }
    if (a.iataCode.toLowerCase().startsWith(q))      { startsWith.push({ ...a, matchScore: 90 }); continue; }
    if (a.name.toLowerCase().startsWith(q))          { startsWith.push({ ...a, matchScore: 85 }); continue; }
    if (a.city.toLowerCase().startsWith(q))          { startsWith.push({ ...a, matchScore: 80 }); continue; }
    if (a.country.toLowerCase().startsWith(q))       { startsWith.push({ ...a, matchScore: 75 }); continue; }
    if (a.searchText.includes(q))                    { contains.push({ ...a, matchScore: 50 }); }
  }

  const staticResults = [...exact, ...startsWith, ...contains].slice(0, limit);

  // 3. If query looks like an IATA code (3 letters) and not already found, try AirportDB
  let apiResult = null;
  if (q.length === 3 && /^[a-z]{3}$/.test(q) && !POPULAR_MAP.has(q.toUpperCase())) {
    apiResult = await fetchAirportByCode(q.toUpperCase());
  }

  const seen = new Set(staticResults.map(a => a.iataCode));
  const results = [...staticResults];
  if (apiResult && !seen.has(apiResult.iataCode)) {
    results.unshift({ ...apiResult, matchScore: 95 }); // API exact match goes first
  }

  const final = results.slice(0, limit);
  redisSet(cacheKey, final, TTL_1H);
  return final;
};

// ── getAirportByCode ──────────────────────────────────────────────────────────

const getAirportByCode = async (code) => {
  if (!code || code.trim().length < 3) {
    throw new ApiError('Airport code must be at least 3 characters', StatusCodes.BAD_REQUEST);
  }
  const upper = code.trim().toUpperCase();

  // Check static set first
  if (POPULAR_MAP.has(upper)) return POPULAR_MAP.get(upper);

  // Fall back to AirportDB API
  const airport = await fetchAirportByCode(upper);
  if (!airport) throw new ApiError(`Airport not found: ${upper}`, StatusCodes.NOT_FOUND);
  return airport;
};

// ── getPopularAirports — pure static, no API call ─────────────────────────────

const getPopularAirports = async (options = {}) => {
  const limit   = options.limit || 50;
  const country = options.country?.toUpperCase();
  const cacheKey = REDIS_KEYS.POPULAR(country, limit);

  const cached = await redisGet(cacheKey);
  if (cached) return cached;

  const result = POPULAR_AIRPORTS
    .filter(a => !country || a.countryCode === country)
    .slice(0, limit);

  redisSet(cacheKey, result, TTL_POPULAR);
  return result;
};

// ── getCountries — derived from static dataset ────────────────────────────────

const getCountries = async () => {
  const cached = await redisGet(REDIS_KEYS.COUNTRIES);
  if (cached) return cached;

  const map = new Map();
  for (const a of POPULAR_AIRPORTS) {
    if (!map.has(a.countryCode)) {
      map.set(a.countryCode, { code: a.countryCode, name: a.country, airportCount: 0 });
    }
    map.get(a.countryCode).airportCount++;
  }

  const countries = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  redisSet(REDIS_KEYS.COUNTRIES, countries, TTL_24H);
  return countries;
};

// ── Cache management ──────────────────────────────────────────────────────────

const clearCache = () => {
  const r = getRedis();
  if (r) {
    _del(REDIS_KEYS.COUNTRIES).catch(() => {});
  }
  logger.info('AirportDB cache cleared');
  return { success: true, message: 'Cache cleared', timestamp: new Date().toISOString() };
};

const getCacheStatus = () => ({
  staticAirports: { count: POPULAR_AIRPORTS.length },
  redis:          { connected: !!getRedis() },
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
