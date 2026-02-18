// v1/utils/xmlParser.js
const xml2js = require('xml2js');
const { XMLParser, XMLBuilder } = require('fast-xml-parser');
const { ApiError } = require('./apiError');
const logger = require('./logger');

/**
 * @class XmlParser
 * @description Utility class for XML processing with Amadeus-specific functionality.
 * Provides methods for parsing XML, building SOAP envelopes, and validating XML schemas.
 */
class XmlParser {
  constructor() {
    // Configure xml2js parser with Amadeus-friendly options
    this.xml2jsParser = new xml2js.Parser({
      explicitArray: false,
      ignoreAttrs: false,
      mergeAttrs: true,
      normalize: true,
      normalizeTags: true,
      trim: true,
      explicitRoot: false
    });

    // Configure xml2js builder for SOAP envelope construction
    this.xml2jsBuilder = new xml2js.Builder({
      rootName: 'soap:Envelope',
      xmldec: { version: '1.0', encoding: 'UTF-8' },
      renderOpts: { pretty: true, indent: '  ' }
    });

    // Configure fast-xml-parser for high-performance parsing
    this.fastXmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      parseAttributeValue: true,
      trimValues: true,
      parseTrueNumberOnly: false,
      arrayMode: false
    });

    // Configure fast-xml-parser builder
    this.fastXmlBuilder = new XMLBuilder({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      format: true,
      indentBy: '  '
    });

    this.contextLogger = logger.createContextualLogger('XmlParser');
  }

  /**
   * Parse Amadeus XML response with comprehensive error handling
   * @param {string} xmlString - XML string to parse
   * @param {object} options - Parsing options
   * @param {boolean} options.useFastParser - Use fast-xml-parser instead of xml2js
   * @param {boolean} options.validateStructure - Validate basic XML structure
   * @returns {Promise<object>} Parsed XML as JavaScript object
   * @throws {ApiError} When XML parsing fails
   */
  async parseAmadeusXml(xmlString, options = {}) {
    const startTime = Date.now();
    const { useFastParser = false, validateStructure = true } = options;

    try {
      // Input validation
      if (!xmlString || typeof xmlString !== 'string') {
        throw ApiError.validationError('Invalid XML input: XML string is required', [], {
          xmlInput: typeof xmlString,
          length: xmlString?.length || 0
        });
      }

      // Basic XML structure validation
      if (validateStructure && !this._isValidXmlStructure(xmlString)) {
        throw ApiError.validationError('Invalid XML structure: Malformed XML detected', [], {
          xmlPreview: xmlString.substring(0, 200)
        });
      }

      let parsedXml;
      const parser = useFastParser ? 'fast-xml-parser' : 'xml2js';

      if (useFastParser) {
        parsedXml = this.fastXmlParser.parse(xmlString);
      } else {
        parsedXml = await this.xml2jsParser.parseStringPromise(xmlString);
      }

      const duration = Date.now() - startTime;
      this.contextLogger.debug('XML parsing completed successfully', {
        parser,
        duration,
        xmlSize: xmlString.length,
        hasSOAPEnvelope: this._hasSOAPEnvelope(parsedXml)
      });

      // Handle SOAP faults
      if (this._isSOAPFault(parsedXml)) {
        throw this._createSOAPFaultError(parsedXml);
      }

      return parsedXml;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      if (error instanceof ApiError) {
        throw error;
      }

      // Handle xml2js parsing errors
      if (error.message && error.message.includes('Non-whitespace before first tag')) {
        throw ApiError.validationError('Invalid XML format: Non-whitespace characters before XML declaration', [], {
          originalError: error.message,
          xmlPreview: xmlString.substring(0, 100)
        });
      }

      // Handle general XML parsing errors
      this.contextLogger.error('XML parsing failed', {
        error: error.message,
        duration,
        xmlSize: xmlString?.length || 0,
        xmlPreview: xmlString?.substring(0, 200) || 'N/A'
      });

      throw ApiError.thirdPartyServiceError('Amadeus XML', 'parse XML response', error, {
        xmlSize: xmlString?.length || 0,
        parsingDuration: duration
      });
    }
  }

  /**
   * Build SOAP envelope for Amadeus XML requests
   * @param {object} body - SOAP body content
   * @param {object} headers - SOAP headers (optional)
   * @param {object} options - Building options
   * @param {string} options.soapVersion - SOAP version (1.1 or 1.2)
   * @param {object} options.namespaces - Additional namespaces
   * @returns {string} Complete SOAP envelope as XML string
   * @throws {ApiError} When SOAP envelope construction fails
   */
  buildSoapEnvelope(body, headers = {}, options = {}) {
    const startTime = Date.now();
    const { soapVersion = '1.1', namespaces = {} } = options;

    try {
      // Input validation
      if (!body || typeof body !== 'object') {
        throw ApiError.validationError('Invalid SOAP body: Body object is required', [], {
          bodyType: typeof body,
          hasBody: !!body
        });
      }

      // Define SOAP namespaces based on version
      const soapNamespaces = soapVersion === '1.2' ? {
        'xmlns:soap': 'http://www.w3.org/2003/05/soap-envelope',
        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema'
      } : {
        'xmlns:soap': 'http://schemas.xmlsoap.org/soap/envelope/',
        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema'
      };

      // Merge with additional namespaces
      const allNamespaces = { ...soapNamespaces, ...namespaces };

      // Build SOAP envelope structure
      const soapEnvelope = {
        $: allNamespaces,
        'soap:Header': Object.keys(headers).length > 0 ? headers : undefined,
        'soap:Body': body
      };

      // Build XML string
      const xmlString = this.xml2jsBuilder.buildObject(soapEnvelope);
      
      const duration = Date.now() - startTime;
      this.contextLogger.debug('SOAP envelope built successfully', {
        soapVersion,
        hasHeaders: Object.keys(headers).length > 0,
        bodyKeys: Object.keys(body),
        duration,
        xmlSize: xmlString.length
      });

      return xmlString;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.contextLogger.error('SOAP envelope construction failed', {
        error: error.message,
        duration,
        soapVersion,
        bodyKeys: body ? Object.keys(body) : []
      });

      if (error instanceof ApiError) {
        throw error;
      }

      throw ApiError.internalServerError('Failed to build SOAP envelope', {
        originalError: error.message,
        soapVersion,
        constructionDuration: duration
      });
    }
  }

  /**
   * Validate XML against basic schema rules
   * @param {string} xmlString - XML string to validate
   * @param {object} schema - Schema validation rules (optional)
   * @param {Array<string>} schema.requiredElements - Required XML elements
   * @param {Array<string>} schema.requiredAttributes - Required attributes
   * @returns {object} Validation result with success status and errors
   */
  validateXmlSchema(xmlString, schema = {}) {
    const startTime = Date.now();
    const { requiredElements = [], requiredAttributes = [] } = schema;
    const errors = [];

    try {
      // Basic XML structure validation
      if (!this._isValidXmlStructure(xmlString)) {
        errors.push('Invalid XML structure: Malformed XML detected');
      }

      // Parse XML for schema validation
      let parsedXml;
      try {
        parsedXml = this.fastXmlParser.parse(xmlString);
      } catch (parseError) {
        errors.push(`XML parsing error: ${parseError.message}`);
        return { success: false, errors };
      }

      // Validate required elements
      for (const element of requiredElements) {
        if (!this._hasElement(parsedXml, element)) {
          errors.push(`Missing required element: ${element}`);
        }
      }

      // Validate required attributes
      for (const attribute of requiredAttributes) {
        if (!this._hasAttribute(parsedXml, attribute)) {
          errors.push(`Missing required attribute: ${attribute}`);
        }
      }

      const duration = Date.now() - startTime;
      const isValid = errors.length === 0;

      this.contextLogger.debug('XML schema validation completed', {
        isValid,
        errorsCount: errors.length,
        duration,
        xmlSize: xmlString.length,
        requiredElements: requiredElements.length,
        requiredAttributes: requiredAttributes.length
      });

      return {
        success: isValid,
        errors: isValid ? [] : errors,
        validationDuration: duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.contextLogger.error('XML schema validation failed', {
        error: error.message,
        duration,
        xmlSize: xmlString?.length || 0
      });

      return {
        success: false,
        errors: [`Validation error: ${error.message}`],
        validationDuration: duration
      };
    }
  }

  /**
   * Transform XML to JSON with custom mapping rules
   * @param {string} xmlString - XML string to transform
   * @param {object} mapping - Transformation mapping rules
   * @param {object} mapping.fieldMappings - Field name mappings
   * @param {object} mapping.valueTransformers - Value transformation functions
   * @returns {Promise<object>} Transformed JSON object
   * @throws {ApiError} When transformation fails
   */
  async transformXmlToJson(xmlString, mapping = {}) {
    const startTime = Date.now();
    const { fieldMappings = {}, valueTransformers = {} } = mapping;

    try {
      // Parse XML first
      const parsedXml = await this.parseAmadeusXml(xmlString, { useFastParser: true });
      
      // Apply transformations
      const transformedJson = this._applyTransformations(parsedXml, fieldMappings, valueTransformers);
      
      const duration = Date.now() - startTime;
      this.contextLogger.debug('XML to JSON transformation completed', {
        duration,
        xmlSize: xmlString.length,
        fieldMappingsCount: Object.keys(fieldMappings).length,
        transformersCount: Object.keys(valueTransformers).length
      });

      return transformedJson;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.contextLogger.error('XML to JSON transformation failed', {
        error: error.message,
        duration,
        xmlSize: xmlString?.length || 0
      });

      if (error instanceof ApiError) {
        throw error;
      }

      throw ApiError.internalServerError('Failed to transform XML to JSON', {
        originalError: error.message,
        transformationDuration: duration
      });
    }
  }

  // Private helper methods

  /**
   * Check if XML string has valid basic structure
   * @private
   */
  _isValidXmlStructure(xmlString) {
    if (!xmlString || typeof xmlString !== 'string') return false;
    
    const trimmed = xmlString.trim();
    return trimmed.startsWith('<') && trimmed.endsWith('>') && 
           trimmed.includes('</') && !trimmed.includes('<<');
  }

  /**
   * Check if parsed XML contains SOAP envelope
   * @private
   */
  _hasSOAPEnvelope(parsedXml) {
    return !!(parsedXml && (
      parsedXml['soap:envelope'] || 
      parsedXml['soap:Envelope'] || 
      parsedXml.envelope || 
      parsedXml.Envelope
    ));
  }

  /**
   * Check if parsed XML is a SOAP fault
   * @private
   */
  _isSOAPFault(parsedXml) {
    if (!parsedXml) return false;
    
    // Check for SOAP fault in various possible structures
    const body = parsedXml['soap:Body'] || parsedXml.Body || parsedXml.body;
    if (!body) return false;
    
    return !!(body['soap:Fault'] || body.Fault || body.fault);
  }

  /**
   * Create ApiError from SOAP fault
   * @private
   */
  _createSOAPFaultError(parsedXml) {
    const body = parsedXml['soap:Body'] || parsedXml.Body || parsedXml.body;
    const fault = body['soap:Fault'] || body.Fault || body.fault;
    
    const faultCode = fault.faultcode || fault.Code || 'UNKNOWN_FAULT';
    const faultString = fault.faultstring || fault.Reason || 'SOAP Fault occurred';
    const faultDetail = fault.detail || fault.Detail || {};

    return ApiError.thirdPartyServiceError('Amadeus SOAP', 'process request', null, {
      soapFault: true,
      faultCode,
      faultString,
      faultDetail
    });
  }

  /**
   * Check if parsed XML has specific element
   * @private
   */
  _hasElement(obj, elementPath) {
    const parts = elementPath.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (!current || typeof current !== 'object' || !(part in current)) {
        return false;
      }
      current = current[part];
    }
    
    return true;
  }

  /**
   * Check if parsed XML has specific attribute
   * @private
   */
  _hasAttribute(obj, attributePath) {
    // Attributes are prefixed with @_ in fast-xml-parser
    const attributeKey = attributePath.startsWith('@_') ? attributePath : `@_${attributePath}`;
    return this._hasElement(obj, attributeKey);
  }

  /**
   * Apply field mappings and value transformations
   * @private
   */
  _applyTransformations(obj, fieldMappings, valueTransformers) {
    if (!obj || typeof obj !== 'object') return obj;
    
    const result = Array.isArray(obj) ? [] : {};
    
    for (const [key, value] of Object.entries(obj)) {
      // Apply field mapping
      const mappedKey = fieldMappings[key] || key;
      
      // Apply value transformation
      let transformedValue = value;
      if (valueTransformers[key] && typeof valueTransformers[key] === 'function') {
        try {
          transformedValue = valueTransformers[key](value);
        } catch (error) {
          this.contextLogger.warn('Value transformation failed', {
            key,
            error: error.message,
            originalValue: value
          });
          transformedValue = value; // Keep original value on transformation error
        }
      }
      
      // Recursively transform nested objects
      if (transformedValue && typeof transformedValue === 'object') {
        transformedValue = this._applyTransformations(transformedValue, fieldMappings, valueTransformers);
      }
      
      result[mappedKey] = transformedValue;
    }
    
    return result;
  }
}

// Create singleton instance
const xmlParser = new XmlParser();

module.exports = xmlParser;