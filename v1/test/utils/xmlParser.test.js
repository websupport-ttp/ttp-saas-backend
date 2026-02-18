// v1/test/utils/xmlParser.test.js
const xmlParser = require('../../utils/xmlParser');
const { ApiError } = require('../../utils/apiError');

// Mock logger
jest.mock('../../utils/logger', () => ({
  createContextualLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

describe('XmlParser', () => {
  describe('parseAmadeusXml', () => {
    test('should parse valid XML successfully', async () => {
      const validXml = `
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <testResponse>
              <result>success</result>
              <data>test data</data>
            </testResponse>
          </soap:Body>
        </soap:Envelope>
      `;

      const result = await xmlParser.parseAmadeusXml(validXml);

      expect(result).toBeDefined();
      expect(result['soap:body']).toBeDefined();
      expect(result['soap:body'].testresponse.result).toBe('success');
    });

    test('should parse XML with fast parser when option is enabled', async () => {
      const validXml = `
        <root>
          <item id="1">value1</item>
          <item id="2">value2</item>
        </root>
      `;

      const result = await xmlParser.parseAmadeusXml(validXml, { useFastParser: true });

      expect(result).toBeDefined();
      expect(result.root).toBeDefined();
    });

    test('should throw error for invalid XML input', async () => {
      await expect(xmlParser.parseAmadeusXml(null)).rejects.toThrow(ApiError);
      await expect(xmlParser.parseAmadeusXml('')).rejects.toThrow(ApiError);
      await expect(xmlParser.parseAmadeusXml(123)).rejects.toThrow(ApiError);
    });

    test('should throw error for malformed XML', async () => {
      const malformedXml = '<root><unclosed>tag</root>';

      await expect(xmlParser.parseAmadeusXml(malformedXml)).rejects.toThrow(ApiError);
    });

    test('should handle SOAP fault and throw appropriate error', async () => {
      const soapFaultXml = `
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <soap:Fault>
              <faultcode>Server.Error</faultcode>
              <faultstring>Internal server error</faultstring>
              <detail>
                <errorCode>500</errorCode>
              </detail>
            </soap:Fault>
          </soap:Body>
        </soap:Envelope>
      `;

      await expect(xmlParser.parseAmadeusXml(soapFaultXml)).rejects.toThrow(ApiError);
    });

    test('should validate XML structure when option is enabled', async () => {
      const invalidStructureXml = 'not xml at all';

      await expect(xmlParser.parseAmadeusXml(invalidStructureXml, { validateStructure: true }))
        .rejects.toThrow(ApiError);
    });

    test('should skip structure validation when option is disabled', async () => {
      const validXml = '<root>test</root>';

      const result = await xmlParser.parseAmadeusXml(validXml, { validateStructure: false });
      expect(result).toBeDefined();
    });

    test('should handle XML with attributes correctly', async () => {
      const xmlWithAttributes = `
        <root xmlns:test="http://test.com">
          <item id="123" type="test">value</item>
        </root>
      `;

      const result = await xmlParser.parseAmadeusXml(xmlWithAttributes);
      expect(result).toBeDefined();
    });

    test('should handle XML parsing errors gracefully', async () => {
      const xmlWithError = 'Non-whitespace before first tag <root>test</root>';

      await expect(xmlParser.parseAmadeusXml(xmlWithError)).rejects.toThrow(ApiError);
    });
  });

  describe('buildSoapEnvelope', () => {
    test('should build valid SOAP 1.1 envelope', () => {
      const body = {
        testRequest: {
          parameter: 'value'
        }
      };

      const result = xmlParser.buildSoapEnvelope(body);

      expect(result).toContain('soap:Envelope');
      expect(result).toContain('soap:Body');
      expect(result).toContain('testRequest');
      expect(result).toContain('parameter');
      expect(result).toContain('http://schemas.xmlsoap.org/soap/envelope/');
    });

    test('should build valid SOAP 1.2 envelope', () => {
      const body = {
        testRequest: {
          parameter: 'value'
        }
      };

      const result = xmlParser.buildSoapEnvelope(body, {}, { soapVersion: '1.2' });

      expect(result).toContain('soap:Envelope');
      expect(result).toContain('soap:Body');
      expect(result).toContain('http://www.w3.org/2003/05/soap-envelope');
    });

    test('should include SOAP headers when provided', () => {
      const body = { testRequest: {} };
      const headers = {
        Security: {
          UsernameToken: {
            Username: 'test',
            Password: 'password'
          }
        }
      };

      const result = xmlParser.buildSoapEnvelope(body, headers);

      expect(result).toContain('soap:Header');
      expect(result).toContain('Security');
      expect(result).toContain('UsernameToken');
    });

    test('should include custom namespaces', () => {
      const body = { testRequest: {} };
      const namespaces = {
        'xmlns:custom': 'http://custom.namespace.com'
      };

      const result = xmlParser.buildSoapEnvelope(body, {}, { namespaces });

      expect(result).toContain('xmlns:custom="http://custom.namespace.com"');
    });

    test('should throw error for invalid body', () => {
      expect(() => xmlParser.buildSoapEnvelope(null)).toThrow(ApiError);
      expect(() => xmlParser.buildSoapEnvelope('')).toThrow(ApiError);
      expect(() => xmlParser.buildSoapEnvelope(123)).toThrow(ApiError);
    });

    test('should handle empty headers gracefully', () => {
      const body = { testRequest: {} };

      const result = xmlParser.buildSoapEnvelope(body, {});

      expect(result).toContain('soap:Envelope');
      expect(result).toContain('soap:Body');
      expect(result).not.toContain('soap:Header');
    });

    test('should build envelope with complex nested body', () => {
      const body = {
        complexRequest: {
          level1: {
            level2: {
              array: ['item1', 'item2'],
              object: {
                property: 'value'
              }
            }
          }
        }
      };

      const result = xmlParser.buildSoapEnvelope(body);

      expect(result).toContain('complexRequest');
      expect(result).toContain('level1');
      expect(result).toContain('level2');
    });
  });

  describe('validateXmlSchema', () => {
    test('should validate XML successfully with no schema requirements', () => {
      const validXml = '<root><item>value</item></root>';

      const result = xmlParser.validateXmlSchema(validXml);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate required elements', () => {
      const xml = '<root><item>value</item></root>';
      const schema = {
        requiredElements: ['root.item']
      };

      const result = xmlParser.validateXmlSchema(xml, schema);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should fail validation for missing required elements', () => {
      const xml = '<root><other>value</other></root>';
      const schema = {
        requiredElements: ['root.item']
      };

      const result = xmlParser.validateXmlSchema(xml, schema);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Missing required element: root.item');
    });

    test('should validate required attributes', () => {
      const xml = '<root><item id="123">value</item></root>';
      const schema = {
        requiredAttributes: ['root.item.@_id']
      };

      const result = xmlParser.validateXmlSchema(xml, schema);

      expect(result.success).toBe(true);
    });

    test('should fail validation for missing required attributes', () => {
      const xml = '<root><item>value</item></root>';
      const schema = {
        requiredAttributes: ['root.item.@_id']
      };

      const result = xmlParser.validateXmlSchema(xml, schema);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Missing required attribute: root.item.@_id');
    });

    test('should handle malformed XML in validation', () => {
      const malformedXml = '<root><unclosed>tag</root>';

      const result = xmlParser.validateXmlSchema(malformedXml);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should return validation duration', () => {
      const xml = '<root>test</root>';

      const result = xmlParser.validateXmlSchema(xml);

      expect(result.validationDuration).toBeDefined();
      expect(typeof result.validationDuration).toBe('number');
    });
  });

  describe('transformXmlToJson', () => {
    test('should transform XML to JSON without mappings', async () => {
      const xml = '<root><item>value</item></root>';

      const result = await xmlParser.transformXmlToJson(xml);

      expect(result).toBeDefined();
      expect(result.root).toBeDefined();
      expect(result.root.item).toBe('value');
    });

    test('should apply field mappings', async () => {
      const xml = '<root><oldName>value</oldName></root>';
      const mapping = {
        fieldMappings: {
          oldName: 'newName'
        }
      };

      const result = await xmlParser.transformXmlToJson(xml, mapping);

      expect(result.root.newName).toBe('value');
      expect(result.root.oldName).toBeUndefined();
    });

    test('should apply value transformers', async () => {
      const xml = '<root><number>123</number></root>';
      const mapping = {
        valueTransformers: {
          number: (value) => parseInt(value, 10)
        }
      };

      const result = await xmlParser.transformXmlToJson(xml, mapping);

      expect(result.root.number).toBe(123);
      expect(typeof result.root.number).toBe('number');
    });

    test('should handle transformation errors gracefully', async () => {
      const xml = '<root><item>value</item></root>';
      const mapping = {
        valueTransformers: {
          item: () => { throw new Error('Transform error'); }
        }
      };

      const result = await xmlParser.transformXmlToJson(xml, mapping);

      // Should keep original value on transformation error
      expect(result.root.item).toBe('value');
    });

    test('should transform nested objects recursively', async () => {
      const xml = `
        <root>
          <level1>
            <oldName>value1</oldName>
            <level2>
              <oldName>value2</oldName>
            </level2>
          </level1>
        </root>
      `;
      const mapping = {
        fieldMappings: {
          oldName: 'newName'
        }
      };

      const result = await xmlParser.transformXmlToJson(xml, mapping);

      expect(result.root.level1.newName).toBe('value1');
      expect(result.root.level1.level2.newName).toBe('value2');
    });

    test('should handle arrays in transformation', async () => {
      const xml = `
        <root>
          <items>
            <item>value1</item>
            <item>value2</item>
          </items>
        </root>
      `;

      const result = await xmlParser.transformXmlToJson(xml);

      expect(result).toBeDefined();
      expect(result.root.items).toBeDefined();
    });

    test('should throw error for invalid XML in transformation', async () => {
      const invalidXml = 'not xml';

      await expect(xmlParser.transformXmlToJson(invalidXml)).rejects.toThrow(ApiError);
    });
  });

  describe('Private Helper Methods', () => {
    test('should detect valid XML structure', () => {
      expect(xmlParser._isValidXmlStructure('<root>test</root>')).toBe(true);
      expect(xmlParser._isValidXmlStructure('<root><child>test</child></root>')).toBe(true);
      expect(xmlParser._isValidXmlStructure('not xml')).toBe(false);
      expect(xmlParser._isValidXmlStructure('<root>no closing tag')).toBe(false);
      expect(xmlParser._isValidXmlStructure('')).toBe(false);
      expect(xmlParser._isValidXmlStructure(null)).toBe(false);
    });

    test('should detect SOAP envelope', () => {
      const withSoapEnvelope = {
        'soap:envelope': { 'soap:body': {} }
      };
      const withoutSoapEnvelope = {
        root: { item: 'value' }
      };

      expect(xmlParser._hasSOAPEnvelope(withSoapEnvelope)).toBe(true);
      expect(xmlParser._hasSOAPEnvelope(withoutSoapEnvelope)).toBe(false);
    });

    test('should detect SOAP fault', () => {
      const withSoapFault = {
        'soap:Body': {
          'soap:Fault': {
            faultcode: 'Server.Error'
          }
        }
      };
      const withoutSoapFault = {
        'soap:Body': {
          response: { result: 'success' }
        }
      };

      expect(xmlParser._isSOAPFault(withSoapFault)).toBe(true);
      expect(xmlParser._isSOAPFault(withoutSoapFault)).toBe(false);
    });

    test('should check element existence', () => {
      const obj = {
        root: {
          level1: {
            level2: 'value'
          }
        }
      };

      expect(xmlParser._hasElement(obj, 'root')).toBe(true);
      expect(xmlParser._hasElement(obj, 'root.level1')).toBe(true);
      expect(xmlParser._hasElement(obj, 'root.level1.level2')).toBe(true);
      expect(xmlParser._hasElement(obj, 'root.nonexistent')).toBe(false);
      expect(xmlParser._hasElement(obj, 'nonexistent')).toBe(false);
    });

    test('should check attribute existence', () => {
      const obj = {
        root: {
          '@_id': '123',
          item: {
            '@_type': 'test'
          }
        }
      };

      expect(xmlParser._hasAttribute(obj, 'root.@_id')).toBe(true);
      expect(xmlParser._hasAttribute(obj, 'root.item.@_type')).toBe(true);
      expect(xmlParser._hasAttribute(obj, 'root.@_nonexistent')).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should handle parsing timeout gracefully', async () => {
      // Mock a very large XML that might cause timeout
      const largeXml = '<root>' + 'x'.repeat(1000000) + '</root>';

      // This should not hang or crash
      const result = await xmlParser.parseAmadeusXml(largeXml);
      expect(result).toBeDefined();
    });

    test('should provide meaningful error messages', async () => {
      try {
        await xmlParser.parseAmadeusXml('<root><unclosed>tag</root>');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect(error.message).toContain('XML');
      }
    });

    test('should handle edge cases in SOAP envelope building', () => {
      // Empty body object
      const result1 = xmlParser.buildSoapEnvelope({});
      expect(result1).toContain('soap:Body');

      // Body with null values
      const result2 = xmlParser.buildSoapEnvelope({ item: null });
      expect(result2).toContain('soap:Body');

      // Body with undefined values
      const result3 = xmlParser.buildSoapEnvelope({ item: undefined });
      expect(result3).toContain('soap:Body');
    });
  });
});