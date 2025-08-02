// v1/services/allianzService.js
const axios = require('axios');
const logger = require('../utils/logger');
const { ApiError } = require('../utils/apiError');
const { StatusCodes } = require('http-status-codes');

const ALLIANZ_BASE_URL_TRAVEL = process.env.ALLIANZ_TRAVEL_BASE_URL;
const ALLIANZ_BASE_URL_INSTANT_PLAN = process.env.ALLIANZ_INSTANT_PLAN_BASE_URL;
const ALLIANZ_BASE_URL_LIFE = process.env.ALLIANZ_LIFE_BASE_URL;
const ALLIANZ_API_USERNAME = process.env.ALLIANZ_API_USERNAME;
const ALLIANZ_API_PASSWORD = process.env.ALLIANZ_API_PASSWORD;

let allianzAuthToken = null;
let tokenExpiryTime = null;

/**
 * @function authenticateAllianz
 * @description Authenticates with the Allianz API to get an access token.
 * Caches the token and re-authenticates if expired.
 * @returns {string} The Allianz API authentication token.
 * @throws {ApiError} If authentication fails.
 */
const authenticateAllianz = async () => {
  if (allianzAuthToken && tokenExpiryTime && Date.now() < tokenExpiryTime) {
    logger.info('Using cached Allianz token.');
    return allianzAuthToken;
  }

  logger.info('Authenticating with Allianz API...');
  try {
    const response = await axios.post(`${ALLIANZ_BASE_URL_INSTANT_PLAN}/api/auth`, {
      username: ALLIANZ_API_USERNAME,
      password: ALLIANZ_API_PASSWORD,
    });

    if (response.data && response.data.data && response.data.data.token) {
      allianzAuthToken = response.data.data.token;
      // Allianz token expiry is in 'MM/DD/YYYY HH:MM:SS PM/AM' format, need to parse
      // For simplicity, assuming a fixed expiry for mock, or parse 'expires' field
      // Example: "expires": "12/7/2020 9:50:39 PM"
      const expiryDateStr = response.data.data.expires;
      tokenExpiryTime = new Date(expiryDateStr).getTime(); // Convert to milliseconds

      logger.info('Allianz API authenticated successfully. Token acquired.');
      return allianzAuthToken;
    } else {
      throw new ApiError('Allianz authentication failed: Invalid response structure', StatusCodes.UNAUTHORIZED);
    }
  } catch (error) {
    logger.error('Allianz authentication error:', error.message);
    throw new ApiError('Failed to authenticate with Allianz API', StatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * @function allianzApiCall
 * @description Generic function to make authenticated calls to the Allianz API.
 * @param {string} url - The API endpoint URL.
 * @param {object} data - The request payload.
 * @param {string} baseUrl - The base URL for the specific Allianz product (travel, instant plan, life).
 * @returns {object} The API response data.
 * @throws {ApiError} If the API call fails.
 */
const allianzApiCall = async (url, data, baseUrl) => {
  const token = await authenticateAllianz();
  try {
    const response = await axios.post(`${baseUrl}${url}`, data, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  } catch (error) {
    logger.error(`Allianz API call to ${url} failed:`, error.message);
    if (error.response) {
      logger.error('Allianz API response error:', error.response.data);
      throw new ApiError(
        error.response.data.message || 'Allianz API request failed',
        error.response.status || StatusCodes.INTERNAL_SERVER_ERROR
      );
    }
    throw new ApiError('Allianz API request failed', StatusCodes.INTERNAL_SERVER_ERROR);
  }
};

// --- Travel Insurance Endpoints (using ALLIANZ_BASE_URL_TRAVEL) ---

/**
 * @function getTravelInsuranceLookup
 * @description Fetches lookup data for Travel Insurance.
 * @param {string} type - The type of lookup (e.g., 'GetCountry', 'GetTravelPlan').
 * @param {object} params - Optional query parameters (e.g., { countryId: 1 }).
 * @returns {object} Lookup data.
 */
const getTravelInsuranceLookup = async (type, params = {}) => {
  // Allianz lookup URLs are GET requests.
  // Example: Baseurl/api/lookup/GetCountry
  const url = `/api/lookup/${type}`;
  try {
    const token = await authenticateAllianz();
    const response = await axios.get(`${ALLIANZ_BASE_URL_TRAVEL}${url}`, {
      params,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    logger.error(`Allianz Travel Insurance Lookup (${type}) failed:`, error.message);
    throw new ApiError('Failed to fetch Allianz Travel Insurance lookup data', StatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * @function getTravelInsuranceQuote
 * @description Gets a quote for Travel Insurance.
 * @param {object} quoteDetails - Details for the quote request.
 * @returns {object} Quote response.
 */
const getTravelInsuranceQuote = async (quoteDetails) => {
  return allianzApiCall('/api/Quote', quoteDetails, ALLIANZ_BASE_URL_TRAVEL);
};

/**
 * @function purchaseTravelInsuranceIndividual
 * @description Purchases an individual Travel Insurance policy.
 * @param {object} purchaseDetails - Details for individual policy purchase.
 * @returns {object} Purchase confirmation.
 */
const purchaseTravelInsuranceIndividual = async (purchaseDetails) => {
  return allianzApiCall('/api/IndividualBooking', purchaseDetails, ALLIANZ_BASE_URL_TRAVEL);
};

/**
 * @function purchaseTravelInsuranceFamily
 * @description Purchases a family Travel Insurance policy.
 * @param {Array<object>} purchaseDetails - Array of details for family members.
 * @returns {object} Purchase confirmation.
 */
const purchaseTravelInsuranceFamily = async (purchaseDetails) => {
  return allianzApiCall('/api/FamilyBooking', purchaseDetails, ALLIANZ_BASE_URL_TRAVEL);
};

// --- Instant Plan Insurance Endpoints (using ALLIANZ_BASE_URL_INSTANT_PLAN) ---

/**
 * @function getInstantPlanLookup
 * @description Fetches lookup data for Instant Plan Insurance.
 * @param {string} type - The type of lookup (e.g., 'documenttypes', 'genders', 'states').
 * @param {string} [referenceId] - Optional reference ID for document types.
 * @returns {object} Lookup data.
 */
const getInstantPlanLookup = async (type, referenceId = '') => {
  const url = `/api/resources/${type}${referenceId ? `?referenceId=${referenceId}` : ''}`;
  try {
    const token = await authenticateAllianz();
    const response = await axios.get(`${ALLIANZ_BASE_URL_INSTANT_PLAN}${url}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    logger.error(`Allianz Instant Plan Lookup (${type}) failed:`, error.message);
    throw new ApiError('Failed to fetch Allianz Instant Plan lookup data', StatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * @function getInstantPlanQuote
 * @description Gets a quote for Instant Plan Insurance.
 * @param {object} quoteDetails - Details for the quote request.
 * @returns {object} Quote response.
 */
const getInstantPlanQuote = async (quoteDetails) => {
  return allianzApiCall('/api/quote/instantplan', quoteDetails, ALLIANZ_BASE_URL_INSTANT_PLAN);
};

/**
 * @function purchaseInstantPlanPolicy
 * @description Purchases an Instant Plan policy.
 * @param {object} purchaseDetails - Details for policy purchase.
 * @returns {object} Purchase confirmation.
 */
const purchaseInstantPlanPolicy = async (purchaseDetails) => {
  return allianzApiCall('/api/quote/instantplan', purchaseDetails, ALLIANZ_BASE_URL_INSTANT_PLAN);
};

/**
 * @function uploadInstantPlanPayment
 * @description Uploads payment details for an Instant Plan policy.
 * @param {string} policyId - The policy ID.
 * @param {object} paymentDetails - Payment details.
 * @returns {object} Payment upload confirmation.
 */
const uploadInstantPlanPayment = async (policyId, paymentDetails) => {
  return allianzApiCall(`/api/policy/${policyId}/payments`, paymentDetails, ALLIANZ_BASE_URL_INSTANT_PLAN);
};

/**
 * @function uploadInstantPlanDocument
 * @description Uploads supporting documents for an Instant Plan policy.
 * @param {string} policyId - The policy ID.
 * @param {FormData} formData - FormData containing file and document name.
 * @returns {object} Document upload confirmation.
 */
const uploadInstantPlanDocument = async (policyId, formData) => {
  const token = await authenticateAllianz();
  try {
    const response = await axios.post(`${ALLIANZ_BASE_URL_INSTANT_PLAN}/api/policy/${policyId}/uploads`, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data', // Important for FormData
      },
    });
    return response.data;
  } catch (error) {
    logger.error(`Allianz Instant Plan Document Upload failed for policy ${policyId}:`, error.message);
    if (error.response) {
      logger.error('Allianz API response error:', error.response.data);
      throw new ApiError(
        error.response.data.message || 'Allianz API document upload failed',
        error.response.status || StatusCodes.INTERNAL_SERVER_ERROR
      );
    }
    throw new ApiError('Allianz API document upload failed', StatusCodes.INTERNAL_SERVER_ERROR);
  }
};

// --- Motor Insurance Endpoints (using ALLIANZ_BASE_URL_MOTOR) ---
// Note: The document mentions two base URLs for motor: thirdpartyonlineTestV2 and motor/validate
// Assuming ALLIANZ_BASE_URL_MOTOR for general motor operations.
const ALLIANZ_BASE_URL_MOTOR = process.env.ALLIANZ_MOTOR_BASE_URL;

/**
 * @function validateMotorRegistration
 * @description Validates a motor registration number.
 * @param {string} registrationNo - The registration number to validate.
 * @returns {object} Validation response.
 */
const validateMotorRegistration = async (registrationNo) => {
  return allianzApiCall('/motor/validate', { RegistrationNo: registrationNo }, ALLIANZ_BASE_URL_MOTOR);
};

/**
 * @function getMotorDocumentTypes
 * @description Gets document types for Motor Comprehensive.
 * @returns {object} Document types.
 */
const getMotorDocumentTypes = async () => {
  // This is a GET request according to the doc
  const url = '/MotorComprehensive/Documenttypes';
  try {
    const token = await authenticateAllianz();
    const response = await axios.get(`${ALLIANZ_BASE_URL_MOTOR}${url}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    logger.error(`Allianz Motor Document Types Lookup failed:`, error.message);
    throw new ApiError('Failed to fetch Allianz Motor document types', StatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * @function getMotorPaymentFrequencies
 * @description Gets payment frequencies for Motor Comprehensive.
 * @returns {object} Payment frequencies.
 */
const getMotorPaymentFrequencies = async () => {
  const url = '/MotorComprehensive/PaymentFrequency';
  try {
    const token = await authenticateAllianz();
    const response = await axios.get(`${ALLIANZ_BASE_URL_MOTOR}${url}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    logger.error(`Allianz Motor Payment Frequencies Lookup failed:`, error.message);
    throw new ApiError('Failed to fetch Allianz Motor payment frequencies', StatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * @function getMotorAgents
 * @description Gets agent details for Motor.
 * @returns {object} Agent details.
 */
const getMotorAgents = async () => {
  const url = '/Motor/agents';
  try {
    const token = await authenticateAllianz();
    const response = await axios.get(`${ALLIANZ_BASE_URL_MOTOR}${url}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    logger.error(`Allianz Motor Agents Lookup failed:`, error.message);
    throw new ApiError('Failed to fetch Allianz Motor agents', StatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * @function getMotorVehicleSizes
 * @description Gets motor vehicle sizes.
 * @returns {object} Vehicle sizes.
 */
const getMotorVehicleSizes = async () => {
  const url = '/Motor/Vehicles';
  try {
    const token = await authenticateAllianz();
    const response = await axios.get(`${ALLIANZ_BASE_URL_MOTOR}${url}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    logger.error(`Allianz Motor Vehicle Sizes Lookup failed:`, error.message);
    throw new ApiError('Failed to fetch Allianz Motor vehicle sizes', StatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * @function purchaseMotorThirdParty
 * @description Purchases a Motor Third-Party policy.
 * @param {object} purchaseDetails - Details for Third-Party policy purchase.
 * @returns {object} Purchase confirmation.
 */
const purchaseMotorThirdParty = async (purchaseDetails) => {
  return allianzApiCall('/Motor/PurchaseMotorThirdParty', purchaseDetails, ALLIANZ_BASE_URL_MOTOR);
};

/**
 * @function generateTPLCertificate
 * @description Generates a TPL policy certificate.
 * @param {string} policyNo - The policy number.
 * @returns {object} Certificate URL.
 */
const generateTPLCertificate = async (policyNo) => {
  return allianzApiCall('/Motor/GenerateTPLCertificate', { policyno: policyNo }, ALLIANZ_BASE_URL_MOTOR);
};

/**
 * @function getMotorComprehensiveQuote
 * @description Gets a quote for Motor Comprehensive policy.
 * @param {object} quoteDetails - Details for the quote request.
 * @returns {object} Quote response.
 */
const getMotorComprehensiveQuote = async (quoteDetails) => {
  return allianzApiCall('/MotorComprehensive/quote', quoteDetails, ALLIANZ_BASE_URL_MOTOR);
};

/**
 * @function purchaseMotorComprehensive
 * @description Purchases a Motor Comprehensive policy.
 * @param {object} purchaseDetails - Details for Comprehensive policy purchase.
 * @returns {object} Purchase confirmation.
 */
const purchaseMotorComprehensive = async (purchaseDetails) => {
  return allianzApiCall('/MotorComprehensive/Purchase', purchaseDetails, ALLIANZ_BASE_URL_MOTOR);
};

/**
 * @function uploadMotorComprehensiveFiles
 * @description Uploads required files for Motor Comprehensive policy.
 * @param {string} referenceId - The policy reference ID.
 * @param {string} documentName - The name of the document.
 * @param {FormData} formData - FormData containing the file.
 * @returns {object} Upload confirmation.
 */
const uploadMotorComprehensiveFiles = async (referenceId, documentName, formData) => {
  const token = await authenticateAllianz();
  try {
    // Note: The doc shows URL as BaseUrl/MotorComprehensive/UploadFiles?ReferenceId=...&DocumentName=...
    const url = `/MotorComprehensive/UploadFiles?ReferenceId=${referenceId}&DocumentName=${encodeURIComponent(documentName)}`;
    const response = await axios.post(`${ALLIANZ_BASE_URL_MOTOR}${url}`, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    logger.error(`Allianz Motor Comprehensive Document Upload failed for ref ${referenceId}:`, error.message);
    if (error.response) {
      logger.error('Allianz API response error:', error.response.data);
      throw new ApiError(
        error.response.data.message || 'Allianz API document upload failed',
        error.response.status || StatusCodes.INTERNAL_SERVER_ERROR
      );
    }
    throw new ApiError('Allianz API document upload failed', StatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * @function getMotorComprehensiveCoverNote
 * @description Gets a cover note for Motor Comprehensive policy.
 * @param {string} referenceId - The policy reference ID.
 * @returns {object} Cover note URL.
 */
const getMotorComprehensiveCoverNote = async (referenceId) => {
  return allianzApiCall('/MotorComprehensive/CoverNote', { ReferenceId: referenceId }, ALLIANZ_BASE_URL_MOTOR);
};

// --- Motor Renewal Endpoints (using ALLIANZ_BASE_URL_MOTOR) ---

/**
 * @function getMotorRenewalQuote
 * @description Gets a quote for Motor Policy Renewal.
 * @param {object} quoteDetails - Details for renewal quote request.
 * @returns {object} Renewal quote.
 */
const getMotorRenewalQuote = async (quoteDetails) => {
  return allianzApiCall('/Renewal/Quote', quoteDetails, ALLIANZ_BASE_URL_MOTOR);
};

/**
 * @function purchaseMotorRenewal
 * @description Purchases a Motor Policy Renewal.
 * @param {object} renewalDetails - Details for renewal purchase.
 * @returns {object} Renewal confirmation.
 */
const purchaseMotorRenewal = async (renewalDetails) => {
  return allianzApiCall('/Renewal/RenewPolicy', renewalDetails, ALLIANZ_BASE_URL_MOTOR);
};

/**
 * @function getMotorRenewalStatus
 * @description Gets the status of a Motor Policy Renewal.
 * @param {string} renewalId - The renewal ID.
 * @returns {object} Renewal status.
 */
const getMotorRenewalStatus = async (renewalId) => {
  return allianzApiCall('/Renewal/status', { RenewalId: renewalId }, ALLIANZ_BASE_URL_MOTOR);
};

/**
 * @function getMotorRenewalCoverNote
 * @description Gets the cover note for a Renewed Motor Policy.
 * @param {string} renewalId - The renewal ID.
 * @returns {object} Cover note URL.
 */
const getMotorRenewalCoverNote = async (renewalId) => {
  return allianzApiCall('/Renewal/CoverNote', { RenewalId: renewalId }, ALLIANZ_BASE_URL_MOTOR);
};

// --- Life Insurance Endpoints (using ALLIANZ_BASE_URL_LIFE) ---

/**
 * @function getLifeInsuranceResources
 * @description Fetches lookup data for Life Insurance.
 * @param {string} type - The type of resource (e.g., 'lgas', 'states', 'genders').
 * @param {string} [id] - Optional ID for specific resources (e.g., stateId for LGAs).
 * @param {string} [referenceId] - Optional reference ID for document types.
 * @returns {object} Resource data.
 */
const getLifeInsuranceResources = async (type, id = '', referenceId = '') => {
  let url = `/api/resources/${type}`;
  if (id) url += `/${id}`;
  if (referenceId) url += `?referenceId=${referenceId}`;

  try {
    const token = await authenticateAllianz(); // Life insurance also uses /auth endpoint
    const response = await axios.get(`${ALLIANZ_BASE_URL_LIFE}${url}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    logger.error(`Allianz Life Insurance Resource Lookup (${type}) failed:`, error.message);
    throw new ApiError('Failed to fetch Allianz Life Insurance resource data', StatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * @function getLifeInsuranceQuote
 * @description Gets a quote for Life Insurance.
 * @param {object} quoteDetails - Details for the quote request.
 * @param {string} userId - The user ID for the Allianz API call.
 * @returns {object} Quote response.
 */
const getLifeInsuranceQuote = async (quoteDetails, userId) => {
  return allianzApiCall(`/api/quote?userid=${userId}`, quoteDetails, ALLIANZ_BASE_URL_LIFE);
};

/**
 * @function purchaseLifePolicy
 * @description Purchases a Life Insurance policy.
 * @param {object} purchaseDetails - Details for policy purchase.
 * @param {string} userId - The user ID for the Allianz API call.
 * @param {string} clientId - The client ID obtained from the quote.
 * @returns {object} Purchase confirmation.
 */
const purchaseLifePolicy = async (purchaseDetails, userId, clientId) => {
  return allianzApiCall(`/api/policy?userid=${userId}&clientId=${clientId}`, purchaseDetails, ALLIANZ_BASE_URL_LIFE);
};

/**
 * @function createLifePolicyBeneficiary
 * @description Creates a beneficiary on a Life Insurance policy.
 * @param {string} policyId - The policy ID.
 * @param {Array<object>} beneficiaries - Array of beneficiary details.
 * @param {string} userId - The user ID for the Allianz API call.
 * @returns {object} Beneficiary creation confirmation.
 */
const createLifePolicyBeneficiary = async (policyId, beneficiaries, userId) => {
  return allianzApiCall(`/api/policy/${policyId}/beneficiaries?UserId=${userId}`, beneficiaries, ALLIANZ_BASE_URL_LIFE);
};

/**
 * @function postLifePolicyPayment
 * @description Posts a payment on a Life Insurance policy.
 * @param {string} policyId - The policy ID.
 * @param {object} paymentDetails - Payment details.
 * @param {string} userId - The user ID for the Allianz API call.
 * @returns {object} Payment confirmation.
 */
const postLifePolicyPayment = async (policyId, paymentDetails, userId) => {
  return allianzApiCall(`/api/policy/${policyId}/payments?UserId=${userId}`, paymentDetails, ALLIANZ_BASE_URL_LIFE);
};

/**
 * @function getLifePolicyPayments
 * @description Gets payments made on a Life Insurance policy.
 * @param {string} policyId - The policy ID.
 * @param {string} userId - The user ID for the Allianz API call.
 * @returns {object} Payment history.
 */
const getLifePolicyPayments = async (policyId, userId) => {
  const url = `/api/policy/${policyId}/payments?UserId=${userId}`;
  try {
    const token = await authenticateAllianz();
    const response = await axios.get(`${ALLIANZ_BASE_URL_LIFE}${url}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    logger.error(`Allianz Life Policy Payments Lookup for policy ${policyId} failed:`, error.message);
    throw new ApiError('Failed to fetch Allianz Life Policy payments', StatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * @function generateLifePolicySchedule
 * @description Generates a Life Policy Schedule.
 * @param {string} policyId - The policy ID.
 * @param {string} userId - The user ID for the Allianz API call.
 * @returns {object} Schedule URL.
 */
const generateLifePolicySchedule = async (policyId, userId) => {
  const url = `/api/policy/${policyId}/schedule?UserId=${userId}`;
  try {
    const token = await authenticateAllianz();
    const response = await axios.get(`${ALLIANZ_BASE_URL_LIFE}${url}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    logger.error(`Allianz Life Policy Schedule generation for policy ${policyId} failed:`, error.message);
    throw new ApiError('Failed to generate Allianz Life Policy schedule', StatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * @function generateLifePolicyWelcomeLetter
 * @description Generates a Life Policy Welcome Letter.
 * @param {string} policyId - The policy ID.
 * @param {string} userId - The user ID for the Allianz API call.
 * @returns {object} Welcome letter URL.
 */
const generateLifePolicyWelcomeLetter = async (policyId, userId) => {
  const url = `/api/policy/${policyId}/welcomeletter?UserId=${userId}`;
  try {
    const token = await authenticateAllianz();
    const response = await axios.get(`${ALLIANZ_BASE_URL_LIFE}${url}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    logger.error(`Allianz Life Policy Welcome Letter generation for policy ${policyId} failed:`, error.message);
    throw new ApiError('Failed to generate Allianz Life Policy welcome letter', StatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * @function getLifePolicyDetail
 * @description Gets details of a Life Policy.
 * @param {string} policyId - The policy ID.
 * @returns {object} Policy details.
 */
const getLifePolicyDetail = async (policyId) => {
  const url = `/api/policy/${policyId}`;
  try {
    const token = await authenticateAllianz();
    const response = await axios.get(`${ALLIANZ_BASE_URL_LIFE}${url}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    logger.error(`Allianz Life Policy Detail for policy ${policyId} failed:`, error.message);
    throw new ApiError('Failed to fetch Allianz Life Policy details', StatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * @function uploadLifePolicyDocuments
 * @description Uploads documents for a Life Policy.
 * @param {string} policyId - The policy ID.
 * @param {FormData} formData - FormData containing file and document name.
 * @returns {object} Upload confirmation.
 */
const uploadLifePolicyDocuments = async (policyId, formData) => {
  const token = await authenticateAllianz();
  try {
    const response = await axios.post(`${ALLIANZ_BASE_URL_LIFE}/api/policy/${policyId}/uploads`, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    logger.error(`Allianz Life Policy Document Upload for policy ${policyId} failed:`, error.message);
    if (error.response) {
      logger.error('Allianz API response error:', error.response.data);
      throw new ApiError(
        error.response.data.message || 'Allianz API document upload failed',
        error.response.status || StatusCodes.INTERNAL_SERVER_ERROR
      );
    }
    throw new ApiError('Allianz API document upload failed', StatusCodes.INTERNAL_SERVER_ERROR);
  }
};


module.exports = {
  getTravelInsuranceLookup,
  getTravelInsuranceQuote,
  purchaseTravelInsuranceIndividual,
  purchaseTravelInsuranceFamily,
  getInstantPlanLookup,
  getInstantPlanQuote,
  purchaseInstantPlanPolicy,
  uploadInstantPlanPayment,
  uploadInstantPlanDocument,
  validateMotorRegistration,
  getMotorDocumentTypes,
  getMotorPaymentFrequencies,
  getMotorAgents,
  getMotorVehicleSizes,
  purchaseMotorThirdParty,
  generateTPLCertificate,
  getMotorComprehensiveQuote,
  purchaseMotorComprehensive,
  uploadMotorComprehensiveFiles,
  getMotorComprehensiveCoverNote,
  getMotorRenewalQuote,
  purchaseMotorRenewal,
  getMotorRenewalStatus,
  getMotorRenewalCoverNote,
  getLifeInsuranceResources,
  getLifeInsuranceQuote,
  purchaseLifePolicy,
  createLifePolicyBeneficiary,
  postLifePolicyPayment,
  getLifePolicyPayments,
  generateLifePolicySchedule,
  generateLifePolicyWelcomeLetter,
  getLifePolicyDetail,
  uploadLifePolicyDocuments,
};