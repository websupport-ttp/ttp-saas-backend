// v1/services/ratehawkService.js
const axios = require('axios');
const logger = require('../utils/logger');
const { ApiError } = require('../utils/apiError');
const { StatusCodes } = require('http-status-codes');

const RATEHAWK_BASE_URL = process.env.RATEHAWK_BASE_URL || process.env.RATEHAWK_SANDBOX_URL || 'https://api.worldota.net';
const RATEHAWK_API_KEY_ID = process.env.RATEHAWK_API_KEY_ID;
const RATEHAWK_API_ACCESS_TOKEN = process.env.RATEHAWK_API_ACCESS_TOKEN;

// ─── Auth ────────────────────────────────────────────────────────────────────

const getAuthHeaders = () => {
  if (!RATEHAWK_API_KEY_ID || !RATEHAWK_API_ACCESS_TOKEN) {
    throw new ApiError('Ratehawk API credentials are not set.', StatusCodes.INTERNAL_SERVER_ERROR);
  }
  const base64Auth = Buffer.from(`${RATEHAWK_API_KEY_ID}:${RATEHAWK_API_ACCESS_TOKEN}`).toString('base64');
  return { 'Content-Type': 'application/json', 'Authorization': `Basic ${base64Auth}` };
};

// ─── Generic caller ──────────────────────────────────────────────────────────

const ratehawkApiCall = async (endpoint, data, method = 'POST') => {
  try {
    const headers = getAuthHeaders();
    const url = `${RATEHAWK_BASE_URL}${endpoint}`;
    logger.info(`Ratehawk ${method} ${endpoint}`);

    const response = method === 'GET'
      ? await axios.get(url, { headers, params: data })
      : await axios.post(url, data, { headers });

    return response.data;
  } catch (error) {
    logger.error(`Ratehawk API call to ${endpoint} failed:`, error.message);
    if (error.response) {
      const msg = error.response.data?.error || error.response.data?.message || 'Ratehawk API request failed';
      throw new ApiError(msg, error.response.status || StatusCodes.INTERNAL_SERVER_ERROR);
    }
    throw new ApiError('No response from Ratehawk API', StatusCodes.SERVICE_UNAVAILABLE);
  }
};

// ─── Region lookup ───────────────────────────────────────────────────────────

const REGION_MAP = {
  'lagos': 6040, 'abuja': 6041, 'port harcourt': 6042,
  'kano': 6043, 'ibadan': 6044,
};

const getRegionId = async (destination) => {
  const key = destination.toLowerCase();
  if (REGION_MAP[key]) return REGION_MAP[key];

  try {
    const res = await ratehawkApiCall('/api/b2b/v3/search/multicomplete', { query: destination, language: 'en' }, 'POST');
    if (res.data?.regions?.length) return res.data.regions[0].id;
    if (res.data?.hotels?.length) return res.data.hotels[0].region_id;
  } catch (e) {
    logger.warn(`Region lookup failed for "${destination}", using fallback`);
  }
  return 2114; // fallback test region
};

// ─── Parse helpers ───────────────────────────────────────────────────────────

/**
 * Parse tax_data.taxes from a rate's payment_options.
 * Returns { includedTaxes, excludedTaxes } arrays.
 */
const parseTaxData = (rate) => {
  const taxes = rate?.payment_options?.payment_types?.[0]?.tax_data?.taxes || [];
  const includedTaxes = [];
  const excludedTaxes = [];
  for (const t of taxes) {
    const entry = { name: t.name, amount: t.amount, currency: t.currency_code };
    if (t.included_by_supplier) includedTaxes.push(entry);
    else excludedTaxes.push(entry);
  }
  return { includedTaxes, excludedTaxes };
};

/**
 * Parse metapolicy_struct into a flat readable object.
 */
const parseMetapolicy = (hotelStatic) => {
  const struct = hotelStatic?.metapolicy_struct || {};
  const extra = hotelStatic?.metapolicy_extra_info || '';
  return { struct, extra };
};

/**
 * Map a raw ETG rate to our standard format.
 */
const mapRate = (rate) => {
  const payType = rate?.payment_options?.payment_types?.[0] || {};
  const { includedTaxes, excludedTaxes } = parseTaxData(rate);
  return {
    matchHash: rate.match_hash,
    bookHash: rate.book_hash,
    roomName: rate.room_name,
    meal: rate.meal,
    mealData: rate.meal_data,
    dailyPrice: rate.daily_prices?.[0],
    showAmount: payType.show_amount,
    amount: payType.amount,
    currency: payType.show_currency_code || payType.currency_code,
    paymentType: payType.type,
    cancellationPenalties: rate.cancellation_penalties,
    freeCancellationBefore: rate.cancellation_penalties?.free_cancellation_before,
    includedTaxes,
    excludedTaxes,
    roomDataTrans: rate.room_data_trans,
  };
};

// ─── 1. Search by region ─────────────────────────────────────────────────────

const searchHotels = async (searchCriteria) => {
  const regionId = await getRegionId(searchCriteria.destination);

  const payload = {
    checkin: searchCriteria.checkInDate,
    checkout: searchCriteria.checkOutDate,
    residency: searchCriteria.residency || 'ng',
    language: 'en',
    guests: searchCriteria.guests || [{ adults: searchCriteria.adults || 2, children: searchCriteria.children || [] }],
    region_id: regionId,
    currency: searchCriteria.currency || 'USD',
    timeout: 30,
  };

  const response = await ratehawkApiCall('/api/b2b/v3/search/serp/region/', payload, 'POST');

  const hotels = (response.data?.hotels || []).map(hotel => ({
    id: hotel.id,
    hid: hotel.hid,
    name: hotel.name,
    address: hotel.address,
    stars: hotel.star_rating,
    images: hotel.images || [],
    amenities: hotel.amenities || [],
    location: { latitude: hotel.latitude, longitude: hotel.longitude },
    rating: hotel.review_score,
    reviewCount: hotel.review_count,
    rates: (hotel.rates || []).map(mapRate),
  }));

  return { searchId: response.data?.search_id, hotels, totalResults: hotels.length };
};

// ─── 2. Retrieve hotelpage (/search/hp/) ─────────────────────────────────────

const getHotelPage = async ({ hotelId, checkin, checkout, guests, residency = 'ng', currency = 'USD' }) => {
  const payload = {
    id: hotelId,
    checkin,
    checkout,
    residency,
    language: 'en',
    guests: guests || [{ adults: 2, children: [] }],
    currency,
    timeout: 30,
  };

  const response = await ratehawkApiCall('/api/b2b/v3/search/hp/', payload, 'POST');
  const hotel = response.data?.hotel || {};

  return {
    id: hotel.id,
    hid: hotel.hid,
    name: hotel.name,
    address: hotel.address,
    stars: hotel.star_rating,
    images: hotel.images || [],
    amenities: hotel.amenities || [],
    description: hotel.description_struct,
    metapolicy: parseMetapolicy(hotel),
    rates: (hotel.rates || []).map(mapRate),
  };
};

// ─── 3. Prebook rate (/hotel/prebook/) ───────────────────────────────────────

const prebookRate = async ({ bookHash, priceIncreasePercent = 0 }) => {
  const payload = { book_hash: bookHash, price_increase_percent: priceIncreasePercent };
  const response = await ratehawkApiCall('/api/b2b/v3/hotel/prebook/', payload, 'POST');
  const data = response.data || {};

  return {
    bookHash: data.book_hash,        // starts with "p-..."
    priceChanged: data.price_changed || false,
    newPrice: data.new_price,
    oldPrice: data.old_price,
    currency: data.currency,
    rate: data.rate ? mapRate(data.rate) : null,
  };
};

// ─── 4. Create booking form (/order/booking/form/) ───────────────────────────

const createBookingForm = async ({ bookHash, partnerOrderId, guests, userEmail, userPhone, language = 'en' }) => {
  const payload = {
    book_hash: bookHash,
    partner_order_id: partnerOrderId,
    language,
    user: { email: userEmail, phone: userPhone },
    rooms: guests, // [{ guests: [{ first_name, last_name, age? }] }]
  };

  const response = await ratehawkApiCall('/api/b2b/v3/hotel/order/booking/form/', payload, 'POST');
  return { orderId: response.data?.order_id, status: response.data?.status };
};

// ─── 5. Start booking (/order/booking/finish/) ───────────────────────────────

const startBooking = async ({ orderId, partnerOrderId, userEmail, userPhone, language = 'en' }) => {
  const payload = {
    order_id: orderId,
    partner_order_id: partnerOrderId,
    language,
    user: { email: userEmail, phone: userPhone },
    payment_type: { type: 'deposit' },
  };

  const response = await ratehawkApiCall('/api/b2b/v3/hotel/order/booking/finish/', payload, 'POST');
  return { status: response.data?.status, orderId: response.data?.order_id };
};

// ─── 6. Check booking status (/order/booking/finish/status/) ─────────────────

const checkBookingStatus = async (orderId) => {
  const response = await ratehawkApiCall('/api/b2b/v3/hotel/order/booking/finish/status/', { order_id: orderId }, 'POST');
  return {
    status: response.data?.status,
    error: response.data?.error,
    orderId: response.data?.order_id,
  };
};

/**
 * Poll checkBookingStatus until final status or timeout.
 * Returns { status, orderId, error }
 */
const pollBookingStatus = async (orderId, { intervalMs = 3000, maxWaitMs = 60000 } = {}) => {
  const deadline = Date.now() + maxWaitMs;
  const FINAL_FAILURES = new Set(['block', 'charge', '3ds', 'soldout', 'provider', 'book_limit', 'not_allowed', 'booking_finish_did_not_succeed']);

  while (Date.now() < deadline) {
    let result;
    try {
      result = await checkBookingStatus(orderId);
    } catch (e) {
      // 5xx / network — keep polling
      logger.warn(`checkBookingStatus error for ${orderId}: ${e.message}, retrying...`);
      await new Promise(r => setTimeout(r, intervalMs));
      continue;
    }

    const { status, error } = result;

    if (status === 'ok') return result;
    if (error && FINAL_FAILURES.has(error)) return result;
    if (status === 'processing' || error === 'timeout' || error === 'unknown') {
      await new Promise(r => setTimeout(r, intervalMs));
      continue;
    }

    // Unknown status — keep polling
    await new Promise(r => setTimeout(r, intervalMs));
  }

  return { status: 'timeout', orderId, error: 'timeout' };
};

// ─── 7. Hotel static content (/hotel/info/) ──────────────────────────────────

const getHotelDetails = async (hotelId) => {
  const response = await ratehawkApiCall('/api/b2b/v3/hotel/info/', { id: hotelId, language: 'en' }, 'POST');
  const hotel = response.data || {};
  return {
    id: hotel.id,
    hid: hotel.hid,
    name: hotel.name,
    address: hotel.address,
    stars: hotel.star_rating,
    images: hotel.images || [],
    amenities: hotel.amenities || [],
    description: hotel.description_struct,
    metapolicy: parseMetapolicy(hotel),
    roomGroups: hotel.room_groups || [],
  };
};

// ─── 8. Hotel dump (/hotel/info/dump/) ───────────────────────────────────────

const getHotelDump = async () => {
  const response = await ratehawkApiCall('/api/b2b/v3/hotel/info/dump/', {}, 'POST');
  return { url: response.data?.url, lastUpdate: response.data?.last_update };
};

// ─── 9. Hotel incremental dump (/hotel/info/incremental_dump/) ───────────────

const getHotelIncrementalDump = async (date) => {
  const payload = date ? { date } : {};
  const response = await ratehawkApiCall('/api/b2b/v3/hotel/info/incremental_dump/', payload, 'POST');
  return { url: response.data?.url, lastUpdate: response.data?.last_update };
};

// ─── 10. Cancel booking ──────────────────────────────────────────────────────

const cancelBooking = async (orderId) => {
  const response = await ratehawkApiCall('/api/b2b/v3/hotel/order/cancel/', { order_id: orderId }, 'POST');
  return response.data;
};

// ─── 11. Retrieve booking info (/order/info/) ────────────────────────────────

const getBookingInfo = async (orderId) => {
  const response = await ratehawkApiCall('/api/b2b/v3/hotel/order/info/', { order_id: orderId }, 'POST');
  return response.data;
};

module.exports = {
  searchHotels,
  getHotelPage,
  prebookRate,
  createBookingForm,
  startBooking,
  checkBookingStatus,
  pollBookingStatus,
  getHotelDetails,
  getHotelDump,
  getHotelIncrementalDump,
  cancelBooking,
  getBookingInfo,
  getRegionId,
  parseTaxData,
  parseMetapolicy,
};
