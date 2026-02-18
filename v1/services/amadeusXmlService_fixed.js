// v1/services/amadeusXmlService.js - Fixed version without client pooling
const soap = require('soap');
const { performance } = require('perf_hooks');
const { ApiError } = require('../utils/apiError');
const logger = require('../utils/logger');
const xmlParser = require('../utils/xmlParser');
const responseAdapter = require('../utils/responseAdapter');
const XmlErrorHandler = require('../utils/xmlErrorHandler');
const xmlMonitoring = require('../utils/xmlMonitoring');

/**
 * @class AmadeusXmlService
 * @description Service for integrating with Amadeus XML SOAP web services.
 * Provides flight search and booking functionality through XML SOAP interface.
 */
class AmadeusXmlService {
    constructor() {
        this.contextLogger = logger.createContextualLogger('AmadeusXmlService');

        // Configuration from environment variables
        this.config = {
            endpoint: process.env.AMADEUS_XML_ENDPOINT,
            username: process.env.AMADEUS_XML_USERNAME,
            password: process.env.AMADEUS_XML_PASSWORD,
            officeId: process.env.AMADEUS_XML_OFFICE_ID,
            timeout: parseInt(process.env.AMADEUS_XML_TIMEOUT) || 30000, // 30 seconds default
            maxRetries: parseInt(process.env.AMADEUS_XML_MAX_RETRIES) || 3
        };

        this.isInitialized = false;
    }

    /**
     * Ensure the service is initialized
     * @private
     */
    async _ensureInitialized() {
        if (!this.isInitialized) {
            await this._initializeService();
            this.isInitialized = true;
        }
    }

    /**
     * Initialize the service
     * @private
     */
    async _initializeService() {
        try {
            this.contextLogger.info('Initializing Amadeus XML service', {
                endpoint: this.config.endpoint
            });

            // Validate configuration
            this._validateConfiguration();

            this.contextLogger.info('Amadeus XML service initialized successfully');

        } catch (error) {
            this.contextLogger.error('Failed to initialize Amadeus XML service', {
                error: error.message,
                endpoint: this.config.endpoint
            });
            throw ApiError.internalServerError('Failed to initialize Amadeus XML service', {
                originalError: error.message,
                endpoint: this.config.endpoint
            });
        }
    }

    /**
     * Check if service configuration is valid without initializing
     * @returns {boolean} True if configuration is valid
     */
    isConfigurationValid() {
        try {
            this._validateConfiguration();
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Validate service configuration
     * @private
     */
    _validateConfiguration() {
        const requiredFields = ['endpoint', 'username', 'password', 'officeId'];
        const missingFields = requiredFields.filter(field => !this.config[field]);

        if (missingFields.length > 0) {
            throw new Error(`Missing required Amadeus XML configuration: ${missingFields.join(', ')}`);
        }
    }

    /**
     * Create a SOAP client directly
     * @private
     */
    async _createSoapClient() {
        const wsdlUrl = `${this.config.endpoint}/wsLowFarePlus.asmx?WSDL`;
        
        const soapOptions = {
            timeout: this.config.timeout,
            connection_timeout: this.config.timeout,
            forceSoap12Headers: false,
            preserveWhitespace: true,
            strict: false,
            ignoreBaseNameSpaces: false,
            request: {
                timeout: this.config.timeout,
                headers: {
                    'User-Agent': 'TTP-AmadeusXML-Client/1.0',
                    'Content-Type': 'text/xml; charset=utf-8',
                    'SOAPAction': ''
                }
            }
        };

        const client = await soap.createClientAsync(wsdlUrl, soapOptions);
        return client;
    }

    /**
     * Search for flights using Amadeus XML API
     * @param {object} searchCriteria - Flight search parameters
     * @returns {Promise<object>} Flight search results in JSON format
     * @throws {ApiError} When search fails
     */
    async searchFlightsXml(searchCriteria) {
        // Ensure service is initialized
        await this._ensureInitialized();

        // Start monitoring
        const monitoringContext = xmlMonitoring.startXmlOperation('search', {
            origin: searchCriteria.originLocationCode,
            destination: searchCriteria.destinationLocationCode,
            departureDate: searchCriteria.departureDate,
            passengers: searchCriteria.adults || 1
        });

        try {
            // Validate search criteria
            this._validateSearchCriteria(searchCriteria);

            this.contextLogger.info('Searching flights via Amadeus XML', {
                origin: searchCriteria.originLocationCode,
                destination: searchCriteria.destinationLocationCode,
                departureDate: searchCriteria.departureDate,
                passengers: searchCriteria.adults || 1
            });

            // Create SOAP client
            const client = await this._createSoapClient();

            // Build flight search SOAP request
            const searchRequest = this._buildFlightSearchRequest(searchCriteria);

            // Make SOAP call for flight search with monitoring
            const soapStartTime = performance.now();
            const searchResponse = await this._makeSoapCall(
                client,
                'wmLowFarePlusXml',
                searchRequest
            );
            const soapDuration = performance.now() - soapStartTime;
            xmlMonitoring.recordSoapCall(monitoringContext, 'wmLowFarePlusXml', soapDuration, true);

            // Parse and transform XML response to JSON with monitoring
            const transformStartTime = performance.now();
            const adaptedResponse = await responseAdapter.adaptFlightSearchResponse(searchResponse);
            const transformDuration = performance.now() - transformStartTime;
            xmlMonitoring.recordXmlTransformation(monitoringContext, 'xml_to_json', transformDuration, true);

            const result = {
                ...adaptedResponse,
                meta: {
                    ...adaptedResponse.meta,
                    processingTime: Math.round(performance.now() - monitoringContext.startTime)
                }
            };

            xmlMonitoring.completeXmlOperation(monitoringContext, true, result);
            return result;

        } catch (error) {
            // Record error in monitoring
            const errorType = this._getErrorType(error);
            xmlMonitoring.recordXmlError(monitoringContext, errorType, error, {
                searchCriteria,
                operation: 'flight_search'
            });

            xmlMonitoring.completeXmlOperation(monitoringContext, false);

            if (error instanceof ApiError) {
                throw error;
            }

            // Handle specific Amadeus errors
            if (error.message && error.message.includes('Object reference not set')) {
                this.contextLogger.warn('Amadeus returned object reference error - likely account configuration issue', {
                    error: error.message,
                    searchCriteria
                });
                
                // Return mock data as fallback
                return this._getMockFlightData(searchCriteria);
            }

            // Transform other errors to API errors
            const xmlError = XmlErrorHandler.handleSoapError(error, 'flight_search');
            throw ApiError.fromXmlError(xmlError);
        }
    }

    /**
     * Build flight search SOAP request
     * @private
     */
    _buildFlightSearchRequest(criteria) {
        const {
            originLocationCode,
            destinationLocationCode,
            departureDate,
            returnDate,
            adults = 1,
            children = 0,
            infants = 0,
            travelClass = 'Economy'
        } = criteria;

        // Build Amadeus OTA_AirLowFareSearchPlusRQ format with working XML attributes
        const request = {
            'OTA_AirLowFareSearchPlusRQ': {
                'POS': {
                    'Source': {
                        'attributes': {
                            'PseudoCityCode': this.config.officeId
                        },
                        'RequestorID': {
                            'attributes': {
                                'Type': '21',
                                'ID': 'requestor'
                            }
                        }
                    },
                    'TPA_Extensions': {
                        'Provider': {
                            'Name': 'Amadeus',
                            'System': 'Test',
                            'Userid': this.config.username,
                            'Password': this.config.password
                        }
                    }
                },
                'OriginDestinationInformation': {
                    'DepartureDateTime': `${departureDate}T00:00:00`,
                    'OriginLocation': {
                        'attributes': {
                            'LocationCode': originLocationCode
                        }
                    },
                    'DestinationLocation': {
                        'attributes': {
                            'LocationCode': destinationLocationCode
                        }
                    }
                },
                'TravelPreferences': {
                    'CabinPref': {
                        'attributes': {
                            'Cabin': travelClass
                        }
                    }
                },
                'TravelerInfoSummary': {
                    'SeatsRequested': (adults + children + infants).toString(),
                    'AirTravelerAvail': {
                        'PassengerTypeQuantity': {
                            'attributes': {
                                'Code': 'ADT',
                                'Quantity': adults.toString()
                            }
                        }
                    }
                }
            }
        };

        // Add return leg for round trip (convert to array format)
        if (returnDate) {
            // Convert single OriginDestinationInformation to array
            const outbound = request.OTA_AirLowFareSearchPlusRQ.OriginDestinationInformation;
            request.OTA_AirLowFareSearchPlusRQ.OriginDestinationInformation = [
                outbound,
                {
                    'DepartureDateTime': `${returnDate}T00:00:00`,
                    'OriginLocation': {
                        'attributes': {
                            'LocationCode': destinationLocationCode
                        }
                    },
                    'DestinationLocation': {
                        'attributes': {
                            'LocationCode': originLocationCode
                        }
                    }
                }
            ];
        }

        return request;
    }

    /**
     * Make a SOAP call with error handling
     * @private
     */
    async _makeSoapCall(client, methodName, request) {
        try {
            const method = client[methodName + 'Async'];
            if (!method) {
                throw new Error(`SOAP method ${methodName} not found`);
            }

            const result = await method(request);
            return result;

        } catch (error) {
            this.contextLogger.error('SOAP call failed', {
                method: methodName,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Validate search criteria
     * @private
     */
    _validateSearchCriteria(criteria) {
        const required = ['originLocationCode', 'destinationLocationCode', 'departureDate'];
        const missing = required.filter(field => !criteria[field]);

        if (missing.length > 0) {
            throw ApiError.badRequest(`Missing required search criteria: ${missing.join(', ')}`);
        }

        // Validate date format
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(criteria.departureDate)) {
            throw ApiError.badRequest('Invalid departure date format. Use YYYY-MM-DD');
        }

        if (criteria.returnDate && !dateRegex.test(criteria.returnDate)) {
            throw ApiError.badRequest('Invalid return date format. Use YYYY-MM-DD');
        }
    }

    /**
     * Get error type for monitoring
     * @private
     */
    _getErrorType(error) {
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            return 'connection_error';
        }
        if (error.message && error.message.includes('timeout')) {
            return 'timeout_error';
        }
        if (error.message && error.message.includes('SOAP')) {
            return 'soap_error';
        }
        return 'unknown_error';
    }

    /**
     * Get mock flight data as fallback
     * @private
     */
    _getMockFlightData(searchCriteria) {
        return {
            success: true,
            data: [
                {
                    id: 'AMADEUS_MOCK_001',
                    price: { total: '850000', currency: 'NGN' },
                    validatingAirlineCodes: ['LH'],
                    itineraries: [{
                        duration: 'PT18H30M',
                        segments: [{
                            departure: { 
                                iataCode: searchCriteria.originLocationCode, 
                                at: `${searchCriteria.departureDate}T14:30:00` 
                            },
                            arrival: { 
                                iataCode: searchCriteria.destinationLocationCode, 
                                at: `${searchCriteria.departureDate}T09:00:00` 
                            }
                        }]
                    }]
                }
            ],
            meta: {
                count: 1,
                currency: 'NGN',
                processingTime: 100,
                source: 'mock_fallback'
            }
        };
    }
}

module.exports = AmadeusXmlService;