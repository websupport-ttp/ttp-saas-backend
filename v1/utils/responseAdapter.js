// v1/utils/responseAdapter.js
const { ApiError } = require('./apiError');
const logger = require('./logger');
const xmlParser = require('./xmlParser');

/**
 * @class ResponseAdapter
 * @description Utility class for transforming XML responses to maintain JSON API contracts.
 * Provides methods to adapt Amadeus XML responses to existing JSON format for backward compatibility.
 */
class ResponseAdapter {
  constructor() {
    this.contextLogger = logger.createContextualLogger('ResponseAdapter');
  }

  /**
   * Adapt flight search XML response to existing JSON format
   * @param {string|object} xmlResponse - XML response string or parsed XML object
   * @param {object} options - Adaptation options
   * @param {boolean} options.includeRawXml - Include raw XML in response for debugging
   * @returns {Promise<object>} Adapted JSON response matching existing API contract
   * @throws {ApiError} When adaptation fails
   */
  async adaptFlightSearchResponse(xmlResponse, options = {}) {
    const startTime = Date.now();
    const { includeRawXml = false } = options;

    try {
      // Parse XML if it's a string
      let parsedXml = xmlResponse;
      if (typeof xmlResponse === 'string') {
        parsedXml = await xmlParser.parseAmadeusXml(xmlResponse);
      }

      // Extract flight offers from XML structure
      const flightOffers = this._extractFlightOffers(parsedXml);
      
      // Transform to existing JSON format
      const adaptedResponse = {
        meta: {
          count: flightOffers.length,
          links: this._extractPaginationLinks(parsedXml)
        },
        data: flightOffers.map(offer => this._transformFlightOffer(offer)),
        dictionaries: this._extractDictionaries(parsedXml)
      };

      // Add raw XML for debugging if requested
      if (includeRawXml && process.env.NODE_ENV !== 'production') {
        adaptedResponse._debug = {
          rawXml: typeof xmlResponse === 'string' ? xmlResponse : 'Already parsed'
        };
      }

      const duration = Date.now() - startTime;
      this.contextLogger.debug('Flight search response adapted successfully', {
        duration,
        offersCount: flightOffers.length,
        hasMetadata: !!adaptedResponse.meta,
        hasDictionaries: !!adaptedResponse.dictionaries
      });

      return adaptedResponse;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.contextLogger.error('Flight search response adaptation failed', {
        error: error.message,
        duration,
        responseType: typeof xmlResponse
      });

      if (error instanceof ApiError) {
        throw error;
      }

      throw ApiError.internalServerError('Failed to adapt flight search response', {
        originalError: error.message,
        adaptationDuration: duration
      });
    }
  }  /**

   * Adapt booking XML response to existing JSON format
   * @param {string|object} xmlResponse - XML response string or parsed XML object
   * @param {object} options - Adaptation options
   * @param {boolean} options.includeRawXml - Include raw XML in response for debugging
   * @returns {Promise<object>} Adapted JSON response matching existing API contract
   * @throws {ApiError} When adaptation fails
   */
  async adaptBookingResponse(xmlResponse, options = {}) {
    const startTime = Date.now();
    const { includeRawXml = false } = options;

    try {
      // Parse XML if it's a string
      let parsedXml = xmlResponse;
      if (typeof xmlResponse === 'string') {
        parsedXml = await xmlParser.parseAmadeusXml(xmlResponse);
      }

      // Extract booking information from XML structure
      const bookingData = this._extractBookingData(parsedXml);
      
      // Transform to existing JSON format
      const adaptedResponse = {
        data: {
          type: 'flight-order',
          id: bookingData.id || bookingData.reference,
          associatedRecords: bookingData.associatedRecords || [],
          flightOffers: bookingData.flightOffers?.map(offer => this._transformFlightOffer(offer)) || [],
          travelers: bookingData.travelers?.map(traveler => this._transformTraveler(traveler)) || [],
          contacts: bookingData.contacts || [],
          ticketingAgreement: bookingData.ticketingAgreement || {},
          automatedProcess: bookingData.automatedProcess || []
        }
      };

      // Add raw XML for debugging if requested
      if (includeRawXml && process.env.NODE_ENV !== 'production') {
        adaptedResponse._debug = {
          rawXml: typeof xmlResponse === 'string' ? xmlResponse : 'Already parsed'
        };
      }

      const duration = Date.now() - startTime;
      this.contextLogger.debug('Booking response adapted successfully', {
        duration,
        bookingId: adaptedResponse.data.id,
        travelersCount: adaptedResponse.data.travelers.length,
        flightOffersCount: adaptedResponse.data.flightOffers.length
      });

      return adaptedResponse;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.contextLogger.error('Booking response adaptation failed', {
        error: error.message,
        duration,
        responseType: typeof xmlResponse
      });

      if (error instanceof ApiError) {
        throw error;
      }

      throw ApiError.internalServerError('Failed to adapt booking response', {
        originalError: error.message,
        adaptationDuration: duration
      });
    }
  }

  /**
   * Adapt XML error response to standard API error format
   * @param {string|object} xmlError - XML error response string or parsed XML object
   * @param {object} context - Additional error context
   * @returns {Promise<ApiError>} Standardized API error
   */
  async adaptErrorResponse(xmlError, context = {}) {
    const startTime = Date.now();

    try {
      // Parse XML if it's a string
      let parsedXml = xmlError;
      if (typeof xmlError === 'string') {
        parsedXml = await xmlParser.parseAmadeusXml(xmlError);
      }

      // Extract error information from XML
      const errorInfo = this._extractErrorInfo(parsedXml);
      
      const duration = Date.now() - startTime;
      this.contextLogger.debug('Error response adapted successfully', {
        duration,
        errorCode: errorInfo.code,
        errorType: errorInfo.type
      });

      // Create appropriate ApiError based on error type
      return this._createApiErrorFromXml(errorInfo, context);

    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.contextLogger.error('Error response adaptation failed', {
        error: error.message,
        duration,
        responseType: typeof xmlError
      });

      // Return generic error if adaptation fails
      return ApiError.thirdPartyServiceError('Amadeus XML', 'process error response', error, {
        adaptationDuration: duration,
        ...context
      });
    }
  } 
 // Private helper methods for XML data extraction and transformation

  /**
   * Extract flight offers from parsed XML
   * @private
   */
  _extractFlightOffers(parsedXml) {
    try {
      // Handle different possible XML structures for flight offers
      const body = this._getSOAPBody(parsedXml);
      
      // Debug: Log the entire SOAP body structure
      this.contextLogger.info('SOAP Body structure for flight offers extraction', {
        bodyKeys: Object.keys(body),
        hasFlightOffersSearchResponse: !!body.flightOffersSearchResponse,
        hasAirFlightSearchResponse: !!body.airFlightSearchResponse,
        hasFlightOffers: !!body.flightOffers,
        bodyType: typeof body
      });
      
      // Look for flight offers in various possible locations
      let offers = [];
      
      if (body.flightOffersSearchResponse?.flightOffers) {
        offers = Array.isArray(body.flightOffersSearchResponse.flightOffers) 
          ? body.flightOffersSearchResponse.flightOffers 
          : [body.flightOffersSearchResponse.flightOffers];
      } else if (body.airFlightSearchResponse?.flightOffers) {
        offers = Array.isArray(body.airFlightSearchResponse.flightOffers)
          ? body.airFlightSearchResponse.flightOffers
          : [body.airFlightSearchResponse.flightOffers];
      } else if (body.flightOffers) {
        offers = Array.isArray(body.flightOffers) ? body.flightOffers : [body.flightOffers];
      }

      // Debug logging for extracted offers
      this.contextLogger.info('Extracted flight offers from XML', {
        offersCount: offers.length,
        firstOfferItinerariesCount: offers[0]?.itineraries?.length || 0,
        hasMultipleItineraries: offers.some(o => o.itineraries && o.itineraries.length > 1),
        firstOfferStructure: offers[0] ? {
          id: offers[0].id,
          hasItineraries: !!offers[0].itineraries,
          itinerariesType: Array.isArray(offers[0].itineraries) ? 'array' : typeof offers[0].itineraries,
          itinerariesLength: offers[0].itineraries?.length
        } : null
      });

      return offers;
    } catch (error) {
      this.contextLogger.warn('Failed to extract flight offers from XML', {
        error: error.message
      });
      return [];
    }
  }

  /**
   * Extract booking data from parsed XML
   * @private
   */
  _extractBookingData(parsedXml) {
    try {
      const body = this._getSOAPBody(parsedXml);
      
      // Look for booking data in various possible locations
      let bookingData = {};
      
      if (body.flightOrderCreateResponse) {
        bookingData = body.flightOrderCreateResponse;
      } else if (body.airBookingResponse) {
        bookingData = body.airBookingResponse;
      } else if (body.bookingResponse) {
        bookingData = body.bookingResponse;
      } else {
        // Fallback to root level data
        bookingData = body;
      }

      return {
        id: bookingData.id || bookingData.reference || bookingData.bookingReference,
        reference: bookingData.reference || bookingData.bookingReference,
        associatedRecords: bookingData.associatedRecords || [],
        flightOffers: bookingData.flightOffers || [],
        travelers: bookingData.travelers || bookingData.passengers || [],
        contacts: bookingData.contacts || [],
        ticketingAgreement: bookingData.ticketingAgreement || {},
        automatedProcess: bookingData.automatedProcess || []
      };
    } catch (error) {
      this.contextLogger.warn('Failed to extract booking data from XML', {
        error: error.message
      });
      return {};
    }
  }

  /**
   * Extract error information from parsed XML
   * @private
   */
  _extractErrorInfo(parsedXml) {
    try {
      // Check for SOAP fault first
      const body = this._getSOAPBody(parsedXml);
      
      if (body.fault || body.Fault) {
        const fault = body.fault || body.Fault;
        return {
          type: 'SOAP_FAULT',
          code: fault.faultcode || fault.Code || 'SOAP_FAULT',
          message: fault.faultstring || fault.Reason || 'SOAP fault occurred',
          detail: fault.detail || fault.Detail || {}
        };
      }

      // Check for application errors
      if (body.errors || body.error) {
        const errors = body.errors || body.error;
        const errorArray = Array.isArray(errors) ? errors : [errors];
        const firstError = errorArray[0];
        
        return {
          type: 'APPLICATION_ERROR',
          code: firstError.code || firstError.errorCode || 'APPLICATION_ERROR',
          message: firstError.detail || firstError.message || 'Application error occurred',
          detail: firstError
        };
      }

      // Generic error structure
      return {
        type: 'UNKNOWN_ERROR',
        code: 'UNKNOWN_ERROR',
        message: 'Unknown error occurred',
        detail: parsedXml
      };
    } catch (error) {
      return {
        type: 'PARSING_ERROR',
        code: 'XML_PARSING_ERROR',
        message: 'Failed to parse error response',
        detail: { originalError: error.message }
      };
    }
  } 
 /**
   * Transform flight offer from XML format to JSON format
   * @private
   */
  _transformFlightOffer(xmlOffer) {
    try {
      return {
        type: 'flight-offer',
        id: xmlOffer.id || xmlOffer.offerId || this._generateOfferId(),
        source: xmlOffer.source || 'GDS',
        instantTicketingRequired: xmlOffer.instantTicketingRequired || false,
        nonHomogeneous: xmlOffer.nonHomogeneous || false,
        oneWay: xmlOffer.oneWay || false,
        lastTicketingDate: xmlOffer.lastTicketingDate || xmlOffer.ticketingDeadline,
        numberOfBookableSeats: xmlOffer.numberOfBookableSeats || xmlOffer.availableSeats || 1,
        itineraries: this._transformItineraries(xmlOffer.itineraries || xmlOffer.segments || []),
        price: this._transformPrice(xmlOffer.price || xmlOffer.pricing || {}),
        pricingOptions: this._transformPricingOptions(xmlOffer.pricingOptions || {}),
        validatingAirlineCodes: this._extractValidatingAirlines(xmlOffer),
        travelerPricings: this._transformTravelerPricings(xmlOffer.travelerPricings || xmlOffer.passengerPricing || [])
      };
    } catch (error) {
      this.contextLogger.warn('Failed to transform flight offer', {
        error: error.message,
        offerId: xmlOffer?.id || 'unknown'
      });
      
      // Return minimal valid structure on error
      return {
        type: 'flight-offer',
        id: xmlOffer?.id || this._generateOfferId(),
        source: 'GDS',
        price: { total: '0', currency: 'USD' },
        itineraries: [],
        travelerPricings: []
      };
    }
  }

  /**
   * Transform traveler from XML format to JSON format
   * @private
   */
  _transformTraveler(xmlTraveler) {
    try {
      return {
        id: xmlTraveler.id || xmlTraveler.travelerId || this._generateTravelerId(),
        dateOfBirth: xmlTraveler.dateOfBirth || xmlTraveler.birthDate,
        gender: xmlTraveler.gender || 'UNSPECIFIED',
        name: {
          firstName: xmlTraveler.firstName || xmlTraveler.name?.firstName || xmlTraveler.givenName,
          lastName: xmlTraveler.lastName || xmlTraveler.name?.lastName || xmlTraveler.surname
        },
        documents: this._transformDocuments(xmlTraveler.documents || []),
        contact: this._transformContact(xmlTraveler.contact || {})
      };
    } catch (error) {
      this.contextLogger.warn('Failed to transform traveler', {
        error: error.message,
        travelerId: xmlTraveler?.id || 'unknown'
      });
      
      return {
        id: xmlTraveler?.id || this._generateTravelerId(),
        name: { firstName: 'Unknown', lastName: 'Traveler' }
      };
    }
  }

  /**
   * Transform price information from XML to JSON
   * @private
   */
  _transformPrice(xmlPrice) {
    try {
      return {
        currency: xmlPrice.currency || xmlPrice.currencyCode || 'USD',
        total: xmlPrice.total || xmlPrice.totalAmount || xmlPrice.amount || '0',
        base: xmlPrice.base || xmlPrice.baseAmount || xmlPrice.baseFare || '0',
        fees: this._transformFees(xmlPrice.fees || xmlPrice.charges || []),
        taxes: this._transformTaxes(xmlPrice.taxes || xmlPrice.taxBreakdown || []),
        refundableTaxes: xmlPrice.refundableTaxes || '0'
      };
    } catch (error) {
      this.contextLogger.warn('Failed to transform price', {
        error: error.message
      });
      
      return {
        currency: 'USD',
        total: '0',
        base: '0'
      };
    }
  }

  /**
   * Get SOAP body from parsed XML
   * @private
   */
  _getSOAPBody(parsedXml) {
    if (!parsedXml) return {};
    
    // Handle different SOAP envelope structures
    return parsedXml['soap:Body'] || 
           parsedXml.Body || 
           parsedXml.body || 
           parsedXml['soapenv:Body'] || 
           parsedXml;
  }  /**

   * Create ApiError from XML error information
   * @private
   */
  _createApiErrorFromXml(errorInfo, context = {}) {
    const { type, code, message, detail } = errorInfo;
    
    switch (type) {
      case 'SOAP_FAULT':
        return ApiError.thirdPartyServiceError('Amadeus SOAP', 'process request', null, {
          soapFault: true,
          faultCode: code,
          faultString: message,
          faultDetail: detail,
          ...context
        });
        
      case 'APPLICATION_ERROR':
        // Map common Amadeus error codes to appropriate HTTP status codes
        if (code.includes('AUTHENTICATION') || code.includes('AUTH')) {
          return ApiError.authenticationError(message, { amadeusErrorCode: code, ...context });
        } else if (code.includes('AUTHORIZATION') || code.includes('PERMISSION')) {
          return ApiError.authorizationError(message, { amadeusErrorCode: code, ...context });
        } else if (code.includes('NOT_FOUND') || code.includes('NO_RESULT')) {
          return ApiError.notFoundError('Flight data', { amadeusErrorCode: code, ...context });
        } else if (code.includes('VALIDATION') || code.includes('INVALID')) {
          return ApiError.validationError(message, [detail], { amadeusErrorCode: code, ...context });
        } else {
          return ApiError.thirdPartyServiceError('Amadeus API', 'process request', null, {
            amadeusErrorCode: code,
            amadeusErrorMessage: message,
            ...context
          });
        }
        
      default:
        return ApiError.thirdPartyServiceError('Amadeus XML', 'parse response', null, {
          errorType: type,
          errorCode: code,
          errorMessage: message,
          ...context
        });
    }
  }

  // Additional helper methods for data transformation

  /**
   * Extract pagination links from XML response
   * @private
   */
  _extractPaginationLinks(parsedXml) {
    try {
      const body = this._getSOAPBody(parsedXml);
      return body.links || body.pagination || {};
    } catch (error) {
      return {};
    }
  }

  /**
   * Extract dictionaries from XML response
   * @private
   */
  _extractDictionaries(parsedXml) {
    try {
      const body = this._getSOAPBody(parsedXml);
      return body.dictionaries || body.referenceData || {};
    } catch (error) {
      return {};
    }
  }

  /**
   * Transform itineraries from XML to JSON
   * @private
   */
  _transformItineraries(xmlItineraries) {
    if (!Array.isArray(xmlItineraries)) {
      xmlItineraries = xmlItineraries ? [xmlItineraries] : [];
    }
    
    // Debug logging for itineraries
    this.contextLogger.info('Transforming itineraries', {
      itinerariesCount: xmlItineraries.length,
      isArray: Array.isArray(xmlItineraries),
      hasMultiple: xmlItineraries.length > 1
    });
    
    return xmlItineraries.map(itinerary => ({
      duration: itinerary.duration || itinerary.totalDuration,
      segments: this._transformSegments(itinerary.segments || itinerary.flights || [])
    }));
  }

  /**
   * Transform flight segments from XML to JSON
   * @private
   */
  _transformSegments(xmlSegments) {
    if (!Array.isArray(xmlSegments)) {
      xmlSegments = xmlSegments ? [xmlSegments] : [];
    }
    
    return xmlSegments.map(segment => ({
      departure: {
        iataCode: segment.departure?.iataCode || segment.origin,
        terminal: segment.departure?.terminal,
        at: segment.departure?.at || segment.departureTime
      },
      arrival: {
        iataCode: segment.arrival?.iataCode || segment.destination,
        terminal: segment.arrival?.terminal,
        at: segment.arrival?.at || segment.arrivalTime
      },
      carrierCode: segment.carrierCode || segment.airline,
      number: segment.number || segment.flightNumber,
      aircraft: {
        code: segment.aircraft?.code || segment.aircraftType
      },
      operating: segment.operating || {},
      duration: segment.duration,
      id: segment.id || this._generateSegmentId(),
      numberOfStops: segment.numberOfStops || 0,
      blacklistedInEU: segment.blacklistedInEU || false
    }));
  }

  /**
   * Generate unique offer ID
   * @private
   */
  _generateOfferId() {
    return `OFFER_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  }

  /**
   * Generate unique traveler ID
   * @private
   */
  _generateTravelerId() {
    return `TRAVELER_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  }

  /**
   * Generate unique segment ID
   * @private
   */
  _generateSegmentId() {
    return `SEGMENT_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  }

  // Placeholder methods for complex transformations (to be implemented based on actual XML structure)
  _transformPricingOptions(xmlPricingOptions) { return xmlPricingOptions; }
  _extractValidatingAirlines(xmlOffer) { return [xmlOffer.validatingAirline || 'XX']; }
  _transformTravelerPricings(xmlTravelerPricings) { return xmlTravelerPricings || []; }
  _transformDocuments(xmlDocuments) { return xmlDocuments || []; }
  _transformContact(xmlContact) { return xmlContact; }
  _transformFees(xmlFees) { return xmlFees || []; }
  _transformTaxes(xmlTaxes) { return xmlTaxes || []; }
}

// Create singleton instance
const responseAdapter = new ResponseAdapter();

module.exports = responseAdapter;