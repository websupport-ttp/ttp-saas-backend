// v1/services/paystackService.js
const axios = require('axios');
const logger = require('../utils/logger');
const { ApiError } = require('../utils/apiError');
const ServiceWrapper = require('../utils/serviceWrapper');
const { StatusCodes } = require('http-status-codes');

const PAYSTACK_BASE_URL = 'https://api.paystack.co';
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

// Create service wrapper with fallback strategies
const paystackWrapper = new ServiceWrapper('Paystack', {
  failureThreshold: 3,
  recoveryTimeout: 30000, // 30 seconds for payment service
  maxRetries: 2, // Fewer retries for payment operations
  initialDelay: 500,
  fallbackStrategies: {
    initializePayment: {
      type: 'degraded_response'
    },
    verifyPayment: {
      type: 'cache' // Would check cache for recent verification
    }
  }
});

/**
 * @function makePaystackRequest
 * @description Make HTTP request to Paystack API with proper headers
 * @param {string} method - HTTP method
 * @param {string} endpoint - API endpoint
 * @param {object} data - Request data
 * @returns {object} API response
 */
const makePaystackRequest = async (method, endpoint, data = null) => {
  const config = {
    method,
    url: `${PAYSTACK_BASE_URL}${endpoint}`,
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    timeout: 30000, // 30 second timeout
  };

  if (data) {
    config.data = data;
  }

  const response = await axios(config);
  
  if (!response.data || !response.data.status) {
    throw new ApiError(
      response.data?.message || 'Invalid response from Paystack',
      StatusCodes.BAD_GATEWAY
    );
  }

  return response.data;
};

/**
 * @function initializePayment
 * @description Initializes a payment transaction with Paystack.
 * @param {object} paymentDetails - Details for the payment, including email, amount, reference, and optional callback_url.
 * @returns {object} Paystack initialization response, including authorization URL.
 * @throws {ApiError} If Paystack initialization fails.
 */
const initializePayment = async (paymentDetails) => {
  // Validate required fields
  if (!paymentDetails.email || !paymentDetails.amount || !paymentDetails.reference) {
    throw new ApiError('Missing required payment details: email, amount, and reference are required', StatusCodes.BAD_REQUEST);
  }

  // Ensure amount is in kobo (smallest currency unit)
  const processedDetails = {
    ...paymentDetails,
    amount: Math.round(paymentDetails.amount * 100), // Convert to kobo
  };

  // Include callback_url if provided
  if (paymentDetails.callback_url) {
    processedDetails.callback_url = paymentDetails.callback_url;
    logger.info(`Payment initialized with callback URL: ${paymentDetails.callback_url}`);
    console.log(`[DEBUG] Paystack payload with callback:`, JSON.stringify(processedDetails, null, 2));
  } else {
    console.log(`[DEBUG] No callback URL provided in payment details`);
  }

  return await paystackWrapper.execute(
    () => makePaystackRequest('POST', '/transaction/initialize', processedDetails),
    'initializePayment',
    { paymentDetails: processedDetails }
  );
};

/**
 * @function verifyPayment
 * @description Verifies a payment transaction with Paystack.
 * @param {string} reference - The transaction reference to verify.
 * @returns {object} Paystack verification response.
 * @throws {ApiError} If Paystack verification fails.
 */
const verifyPayment = async (reference) => {
  if (!reference) {
    throw new ApiError('Payment reference is required for verification', StatusCodes.BAD_REQUEST);
  }

  return await paystackWrapper.execute(
    () => makePaystackRequest('GET', `/transaction/verify/${reference}`),
    'verifyPayment',
    { reference, cacheKey: `paystack_verify_${reference}` }
  );
};

/**
 * @function listTransactions
 * @description List transactions from Paystack
 * @param {object} options - Query options (perPage, page, etc.)
 * @returns {object} Paystack transactions list response
 */
const listTransactions = async (options = {}) => {
  const queryParams = new URLSearchParams(options).toString();
  const endpoint = `/transaction${queryParams ? `?${queryParams}` : ''}`;

  return await paystackWrapper.execute(
    () => makePaystackRequest('GET', endpoint),
    'listTransactions',
    { options }
  );
};

/**
 * @function refundTransaction
 * @description Refund a transaction
 * @param {string} reference - Transaction reference to refund
 * @param {number} amount - Amount to refund (optional, full refund if not specified)
 * @returns {object} Paystack refund response
 */
const refundTransaction = async (reference, amount = null) => {
  if (!reference) {
    throw new ApiError('Transaction reference is required for refund', StatusCodes.BAD_REQUEST);
  }

  const refundData = { transaction: reference };
  if (amount) {
    refundData.amount = Math.round(amount * 100); // Convert to kobo
  }

  return await paystackWrapper.execute(
    () => makePaystackRequest('POST', '/refund', refundData),
    'refundTransaction',
    { reference, amount }
  );
};

/**
 * @function getPaystackHealth
 * @description Get Paystack service health status
 * @returns {object} Health status
 */
const getPaystackHealth = () => {
  return paystackWrapper.getHealthStatus();
};

/**
 * @function performHealthCheck
 * @description Perform health check on Paystack service
 * @returns {Promise<boolean>} Health check result
 */
const performHealthCheck = async () => {
  return await paystackWrapper.performHealthCheck(async () => {
    // Simple health check - verify API is responding
    await makePaystackRequest('GET', '/transaction?perPage=1');
  });
};

/**
 * @function createTransferRecipient
 * @description Create a transfer recipient for bank transfers
 * @param {object} recipientData - Recipient details
 * @returns {object} Paystack recipient response
 */
const createTransferRecipient = async (recipientData) => {
  if (!recipientData.type || !recipientData.name || !recipientData.account_number || !recipientData.bank_code) {
    throw new ApiError('Missing required recipient details: type, name, account_number, and bank_code are required', StatusCodes.BAD_REQUEST);
  }

  return await paystackWrapper.execute(
    () => makePaystackRequest('POST', '/transferrecipient', recipientData),
    'createTransferRecipient',
    { recipientData }
  );
};

/**
 * @function initiateTransfer
 * @description Initiate a bank transfer
 * @param {object} transferData - Transfer details
 * @returns {object} Paystack transfer response
 */
const initiateTransfer = async (transferData) => {
  if (!transferData.source || !transferData.amount || !transferData.recipient) {
    throw new ApiError('Missing required transfer details: source, amount, and recipient are required', StatusCodes.BAD_REQUEST);
  }

  // Ensure amount is in kobo (smallest currency unit)
  const processedTransferData = {
    ...transferData,
    amount: Math.round(transferData.amount), // Should already be in kobo from withdrawal service
  };

  return await paystackWrapper.execute(
    () => makePaystackRequest('POST', '/transfer', processedTransferData),
    'initiateTransfer',
    { transferData: processedTransferData }
  );
};

/**
 * @function verifyBankAccount
 * @description Verify bank account details
 * @param {string} accountNumber - Account number
 * @param {string} bankCode - Bank code
 * @returns {object} Verification response
 */
const verifyBankAccount = async (accountNumber, bankCode) => {
  if (!accountNumber || !bankCode) {
    throw new ApiError('Account number and bank code are required for verification', StatusCodes.BAD_REQUEST);
  }

  const verificationData = {
    account_number: accountNumber,
    bank_code: bankCode
  };

  return await paystackWrapper.execute(
    () => makePaystackRequest('GET', `/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`),
    'verifyBankAccount',
    { verificationData }
  );
};

/**
 * @function listBanks
 * @description Get list of supported banks
 * @param {string} country - Country code (default: 'nigeria')
 * @returns {object} Banks list response
 */
const listBanks = async (country = 'nigeria') => {
  return await paystackWrapper.execute(
    () => makePaystackRequest('GET', `/bank?country=${country}`),
    'listBanks',
    { country }
  );
};

/**
 * @function getTransferStatus
 * @description Get transfer status by reference
 * @param {string} reference - Transfer reference
 * @returns {object} Transfer status response
 */
const getTransferStatus = async (reference) => {
  if (!reference) {
    throw new ApiError('Transfer reference is required', StatusCodes.BAD_REQUEST);
  }

  return await paystackWrapper.execute(
    () => makePaystackRequest('GET', `/transfer/verify/${reference}`),
    'getTransferStatus',
    { reference }
  );
};

/**
 * @function listTransfers
 * @description List transfers
 * @param {object} options - Query options
 * @returns {object} Transfers list response
 */
const listTransfers = async (options = {}) => {
  const queryParams = new URLSearchParams(options).toString();
  const endpoint = `/transfer${queryParams ? `?${queryParams}` : ''}`;

  return await paystackWrapper.execute(
    () => makePaystackRequest('GET', endpoint),
    'listTransfers',
    { options }
  );
};

/**
 * @function resetPaystackService
 * @description Reset Paystack service wrapper (for admin use)
 */
const resetPaystackService = () => {
  paystackWrapper.reset();
  logger.info('Paystack service wrapper has been reset');
};

module.exports = {
  initializePayment,
  verifyPayment,
  listTransactions,
  refundTransaction,
  createTransferRecipient,
  initiateTransfer,
  verifyBankAccount,
  listBanks,
  getTransferStatus,
  listTransfers,
  getPaystackHealth,
  performHealthCheck,
  resetPaystackService,
};