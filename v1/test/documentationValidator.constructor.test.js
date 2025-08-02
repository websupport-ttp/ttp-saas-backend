// v1/test/documentationValidator.constructor.test.js
const DocumentationValidator = require('../utils/documentationValidator');

describe('DocumentationValidator Constructor and Export Tests', () => {
  describe('Class Export and Constructor', () => {
    test('should export DocumentationValidator as a constructor function', () => {
      expect(typeof DocumentationValidator).toBe('function');
      expect(DocumentationValidator.prototype).toBeDefined();
      expect(DocumentationValidator.prototype.constructor).toBe(DocumentationValidator);
    });

    test('should be instantiable with new keyword', () => {
      expect(() => {
        const validator = new DocumentationValidator();
        expect(validator).toBeInstanceOf(DocumentationValidator);
      }).not.toThrow();
    });

    test('should not throw "not a constructor" error', () => {
      expect(() => {
        const validator = new DocumentationValidator();
        expect(validator.constructor).toBe(DocumentationValidator);
      }).not.toThrow();
    });

    test('should have all required methods after instantiation', () => {
      const validator = new DocumentationValidator();
      
      // Core methods
      expect(typeof validator.generateSwaggerSpec).toBe('function');
      expect(typeof validator.loadRouteFiles).toBe('function');
      expect(typeof validator.generateValidationReport).toBe('function');
      expect(typeof validator.validateEndpoint).toBe('function');
      
      // Validation methods
      expect(typeof validator.validateSchemaStructure).toBe('function');
      expect(typeof validator.validateRequestSchema).toBe('function');
      expect(typeof validator.validateResponseSchema).toBe('function');
      expect(typeof validator.validateParameters).toBe('function');
      expect(typeof validator.validateSecurity).toBe('function');
      
      // New comprehensive validation methods
      expect(typeof validator.validateOpenAPIStructure).toBe('function');
      expect(typeof validator.validateSpecificationFormats).toBe('function');
      expect(typeof validator.validateAPISpecification).toBe('function');
      
      // Utility methods
      expect(typeof validator.pathsMatch).toBe('function');
      expect(typeof validator.checkForSwaggerDoc).toBe('function');
      expect(typeof validator.printValidationReport).toBe('function');
      expect(typeof validator.saveValidationReport).toBe('function');
    });

    test('should initialize with proper default values', () => {
      const validator = new DocumentationValidator();
      
      expect(validator.swaggerOptions).toBeDefined();
      expect(validator.swaggerOptions.definition).toBeDefined();
      expect(validator.swaggerOptions.definition.openapi).toBe('3.0.0');
      expect(validator.swaggerOptions.definition.info.title).toBe('The Travel Place API');
      
      expect(validator.validationResults).toBeDefined();
      expect(validator.validationResults.endpoints).toEqual([]);
      expect(validator.validationResults.schemas).toEqual([]);
      expect(validator.validationResults.errors).toEqual([]);
      expect(validator.validationResults.warnings).toEqual([]);
      expect(validator.validationResults.summary.totalEndpoints).toBe(0);
    });
  });

  describe('Method Binding and Context', () => {
    test('should maintain proper context when methods are called', async () => {
      const validator = new DocumentationValidator();
      
      // Test that methods can access instance properties
      expect(() => {
        const spec = validator.generateSwaggerSpec();
        expect(spec).toBeDefined();
      }).not.toThrow();
      
      // Test async methods
      expect(async () => {
        const endpoints = await validator.loadRouteFiles();
        expect(Array.isArray(endpoints)).toBe(true);
      }).not.toThrow();
    });

    test('should handle method extraction without losing context', () => {
      const validator = new DocumentationValidator();
      
      // Extract method and call it
      const { generateSwaggerSpec } = validator;
      expect(() => {
        const spec = generateSwaggerSpec.call(validator);
        expect(spec).toBeDefined();
      }).not.toThrow();
    });

    test('should work with destructuring assignment', () => {
      const validator = new DocumentationValidator();
      
      expect(() => {
        const {
          generateSwaggerSpec,
          validateSchemaStructure,
          pathsMatch
        } = validator;
        
        // These should work when called with proper context
        const spec = generateSwaggerSpec.call(validator);
        expect(spec).toBeDefined();
        
        const issues = validateSchemaStructure.call(validator, { type: 'object' }, 'test');
        expect(Array.isArray(issues)).toBe(true);
        
        const match = pathsMatch.call(validator, '/test', '/test');
        expect(typeof match).toBe('boolean');
      }).not.toThrow();
    });
  });

  describe('Static Function Exports', () => {
    test('should export individual validation functions', () => {
      expect(typeof DocumentationValidator.validateSchemaStructure).toBe('function');
      expect(typeof DocumentationValidator.validateRequestSchema).toBe('function');
      expect(typeof DocumentationValidator.validateResponseSchema).toBe('function');
      expect(typeof DocumentationValidator.validateParameters).toBe('function');
      expect(typeof DocumentationValidator.validateSecurity).toBe('function');
      expect(typeof DocumentationValidator.pathsMatch).toBe('function');
      expect(typeof DocumentationValidator.validateEndpoint).toBe('function');
    });

    test('should export class reference for additional compatibility', () => {
      expect(DocumentationValidator.DocumentationValidator).toBe(DocumentationValidator);
    });
  });

  describe('Multiple Instance Creation', () => {
    test('should allow creating multiple instances without conflicts', () => {
      const validator1 = new DocumentationValidator();
      const validator2 = new DocumentationValidator();
      
      expect(validator1).toBeInstanceOf(DocumentationValidator);
      expect(validator2).toBeInstanceOf(DocumentationValidator);
      expect(validator1).not.toBe(validator2);
      
      // Each instance should have its own validation results
      expect(validator1.validationResults).not.toBe(validator2.validationResults);
      
      // But they should have the same structure
      expect(validator1.validationResults).toEqual(validator2.validationResults);
    });

    test('should maintain separate state between instances', async () => {
      const validator1 = new DocumentationValidator();
      const validator2 = new DocumentationValidator();
      
      // Modify one instance
      validator1.validationResults.errors.push({ type: 'TEST', message: 'Test error' });
      
      // Other instance should be unaffected
      expect(validator1.validationResults.errors).toHaveLength(1);
      expect(validator2.validationResults.errors).toHaveLength(0);
    });
  });

  describe('Error Handling in Constructor', () => {
    test('should handle constructor errors gracefully', () => {
      // Mock environment variables that might affect constructor
      const originalEnv = process.env.BASE_URL;
      process.env.BASE_URL = 'invalid-url';
      
      expect(() => {
        const validator = new DocumentationValidator();
        expect(validator).toBeInstanceOf(DocumentationValidator);
      }).not.toThrow();
      
      // Restore environment
      process.env.BASE_URL = originalEnv;
    });

    test('should work without required dependencies in test environment', () => {
      expect(() => {
        const validator = new DocumentationValidator();
        
        // Should be able to call methods even if some dependencies are missing
        const spec = validator.generateSwaggerSpec();
        // Spec might be null due to missing files, but shouldn't throw constructor errors
        expect(spec === null || typeof spec === 'object').toBe(true);
      }).not.toThrow();
    });
  });

  describe('Comprehensive Validation Methods', () => {
    test('should have new comprehensive validation methods', () => {
      const validator = new DocumentationValidator();
      
      expect(typeof validator.validateOpenAPIStructure).toBe('function');
      expect(typeof validator.validateSpecificationFormats).toBe('function');
      expect(typeof validator.validateAPISpecification).toBe('function');
    });

    test('should validate OpenAPI structure correctly', () => {
      const validator = new DocumentationValidator();
      
      const validSpec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: { '/test': { get: { summary: 'Test' } } }
      };
      
      const result = validator.validateOpenAPIStructure(validSpec);
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    test('should detect invalid OpenAPI structure', () => {
      const validator = new DocumentationValidator();
      
      const invalidSpec = {
        // Missing required fields
      };
      
      const result = validator.validateOpenAPIStructure(invalidSpec);
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    test('should validate specification formats', () => {
      const validator = new DocumentationValidator();
      
      const spec = {
        paths: {
          '/test': {
            get: {
              summary: 'Test endpoint',
              responses: {
                '200': { description: 'Success' }
              }
            }
          }
        }
      };
      
      const result = validator.validateSpecificationFormats(spec);
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    test('should perform comprehensive API specification validation', async () => {
      const validator = new DocumentationValidator();
      
      const result = await validator.validateAPISpecification();
      expect(result).toBeDefined();
      expect(result.structure).toBeDefined();
      expect(result.formats).toBeDefined();
      expect(result.endpoints).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(typeof result.valid).toBe('boolean');
    });
  });
});