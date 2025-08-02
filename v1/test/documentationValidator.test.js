// v1/test/documentationValidator.test.js
const DocumentationValidator = require('../utils/documentationValidator');
const fs = require('fs');
const path = require('path');

describe('DocumentationValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new DocumentationValidator();
  });

  afterEach(() => {
    // Clean up any generated files
    const reportPath = path.join(process.cwd(), 'api-validation-report.json');
    if (fs.existsSync(reportPath)) {
      fs.unlinkSync(reportPath);
    }
  });

  describe('Constructor', () => {
    test('should initialize with default swagger options', () => {
      expect(validator.swaggerOptions).toBeDefined();
      expect(validator.swaggerOptions.definition.openapi).toBe('3.0.0');
      expect(validator.swaggerOptions.definition.info.title).toBe('The Travel Place API');
      expect(validator.validationResults).toBeDefined();
      expect(validator.validationResults.summary.totalEndpoints).toBe(0);
    });
  });

  describe('generateSwaggerSpec', () => {
    test('should generate swagger specification successfully', () => {
      const spec = validator.generateSwaggerSpec();
      expect(spec).toBeDefined();
      expect(spec.openapi).toBe('3.0.0');
      expect(spec.info.title).toBe('The Travel Place API');
    });

    test('should handle swagger generation errors gracefully', () => {
      // Mock swaggerJsdoc to throw an error
      const originalOptions = validator.swaggerOptions;
      validator.swaggerOptions = { invalid: 'config' };
      
      const spec = validator.generateSwaggerSpec();
      expect(spec).toBeNull();
      expect(validator.validationResults.errors).toHaveLength(1);
      expect(validator.validationResults.errors[0].type).toBe('SWAGGER_GENERATION_ERROR');
      
      // Restore original options
      validator.swaggerOptions = originalOptions;
    });
  });

  describe('loadRouteFiles', () => {
    test('should load and parse route files successfully', async () => {
      const endpoints = await validator.loadRouteFiles();
      expect(Array.isArray(endpoints)).toBe(true);
      expect(endpoints.length).toBeGreaterThan(0);
      
      // Check that endpoints have required properties
      endpoints.forEach(endpoint => {
        expect(endpoint).toHaveProperty('method');
        expect(endpoint).toHaveProperty('path');
        expect(endpoint).toHaveProperty('file');
        expect(endpoint).toHaveProperty('hasDocumentation');
        expect(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).toContain(endpoint.method);
      });
    });

    test('should handle route file processing errors', async () => {
      // Mock fs.readdirSync to include a non-existent file
      const originalReaddir = fs.readdirSync;
      const originalReadFile = fs.readFileSync;
      
      fs.readdirSync = jest.fn().mockReturnValue(['nonexistent.js']);
      fs.readFileSync = jest.fn().mockImplementation(() => {
        throw new Error('File not found');
      });

      const endpoints = await validator.loadRouteFiles();
      expect(endpoints).toEqual([]);
      expect(validator.validationResults.errors).toHaveLength(1);
      expect(validator.validationResults.errors[0].type).toBe('ROUTE_FILE_ERROR');

      // Restore original functions
      fs.readdirSync = originalReaddir;
      fs.readFileSync = originalReadFile;
    });
  });

  describe('checkForSwaggerDoc', () => {
    test('should detect swagger documentation in content', () => {
      const contentWithSwagger = `
        /**
         * @openapi
         * /api/test:
         *   get:
         *     summary: Test endpoint
         */
        router.get('/test', (req, res) => {});
      `;
      
      const hasDoc = validator.checkForSwaggerDoc(contentWithSwagger, '/test');
      expect(hasDoc).toBe(true);
    });

    test('should return false when no swagger documentation found', () => {
      const contentWithoutSwagger = `
        router.get('/test', (req, res) => {});
      `;
      
      const hasDoc = validator.checkForSwaggerDoc(contentWithoutSwagger, '/test');
      expect(hasDoc).toBe(false);
    });

    test('should return false when route path not found', () => {
      const content = `router.get('/other', (req, res) => {});`;
      const hasDoc = validator.checkForSwaggerDoc(content, '/test');
      expect(hasDoc).toBe(false);
    });
  });

  describe('pathsMatch', () => {
    test('should match identical paths', () => {
      expect(validator.pathsMatch('/api/users', '/api/users')).toBe(true);
    });

    test('should match Express parameters with OpenAPI parameters', () => {
      expect(validator.pathsMatch('/api/users/:id', '/api/users/{id}')).toBe(true);
      expect(validator.pathsMatch('/api/users/:id/posts/:postId', '/api/users/{id}/posts/{postId}')).toBe(true);
    });

    test('should not match different paths', () => {
      expect(validator.pathsMatch('/api/users', '/api/posts')).toBe(false);
      expect(validator.pathsMatch('/api/users/:id', '/api/users/{userId}')).toBe(false);
    });
  });

  describe('validateSchemaStructure', () => {
    test('should validate object schema with required properties', () => {
      const schema = {
        type: 'object',
        required: ['name', 'email'],
        properties: {
          name: { type: 'string' },
          email: { type: 'string', format: 'email' }
        }
      };

      const issues = validator.validateSchemaStructure(schema, 'test');
      expect(issues).toHaveLength(0);
    });

    test('should detect missing required properties', () => {
      const schema = {
        type: 'object',
        required: ['name', 'email'],
        properties: {
          name: { type: 'string' }
          // email property missing
        }
      };

      const issues = validator.validateSchemaStructure(schema, 'test');
      expect(issues).toHaveLength(1);
      expect(issues[0]).toContain('Required property \'email\' not defined in properties');
    });

    test('should detect properties without types', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          invalidProp: {} // Missing type
        }
      };

      const issues = validator.validateSchemaStructure(schema, 'test');
      expect(issues).toHaveLength(1);
      expect(issues[0]).toContain('missing type definition');
    });

    test('should validate array schema', () => {
      const validArraySchema = {
        type: 'array',
        items: { type: 'string' }
      };

      const issues = validator.validateSchemaStructure(validArraySchema, 'test');
      expect(issues).toHaveLength(0);
    });

    test('should detect array schema without items', () => {
      const invalidArraySchema = {
        type: 'array'
        // items missing
      };

      const issues = validator.validateSchemaStructure(invalidArraySchema, 'test');
      expect(issues).toHaveLength(1);
      expect(issues[0]).toContain('Array schema missing items definition');
    });

    test('should handle null or undefined schema', () => {
      const issues = validator.validateSchemaStructure(null, 'test');
      expect(issues).toHaveLength(1);
      expect(issues[0]).toContain('Schema is null or undefined');
    });
  });

  describe('validateRequestSchema', () => {
    test('should validate operation with valid request body', () => {
      const operation = {
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' }
                }
              }
            }
          }
        }
      };

      const result = validator.validateRequestSchema(operation);
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    test('should detect invalid request schema', () => {
      const operation = {
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  // name property missing
                }
              }
            }
          }
        }
      };

      const result = validator.validateRequestSchema(operation);
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    test('should handle operation without request body', () => {
      const operation = {};
      const result = validator.validateRequestSchema(operation);
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe('validateResponseSchema', () => {
    test('should validate operation with valid response schema', () => {
      const operation = {
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { type: 'object' }
                  }
                }
              }
            }
          }
        }
      };

      const result = validator.validateResponseSchema(operation);
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    test('should handle operation without responses', () => {
      const operation = {};
      const result = validator.validateResponseSchema(operation);
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe('validateParameters', () => {
    test('should validate operation with valid parameters', () => {
      const operation = {
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer' }
          }
        ]
      };

      const result = validator.validateParameters(operation);
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    test('should detect parameters with missing properties', () => {
      const operation = {
        parameters: [
          {
            // name missing
            in: 'path',
            schema: { type: 'string' }
          },
          {
            name: 'limit',
            // in missing
            schema: { type: 'integer' }
          },
          {
            name: 'filter',
            in: 'query'
            // schema missing
          }
        ]
      };

      const result = validator.validateParameters(operation);
      expect(result.valid).toBe(false);
      expect(result.issues).toHaveLength(3);
    });

    test('should handle operation without parameters', () => {
      const operation = {};
      const result = validator.validateParameters(operation);
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe('validateSecurity', () => {
    test('should validate operation with valid security', () => {
      const operation = {
        security: [
          { bearerAuth: [] },
          { apiKey: [] }
        ]
      };

      const result = validator.validateSecurity(operation);
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    test('should handle operation without security', () => {
      const operation = {};
      const result = validator.validateSecurity(operation);
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe('generateValidationReport', () => {
    test('should generate comprehensive validation report', async () => {
      const results = await validator.generateValidationReport();
      
      expect(results).toBeDefined();
      expect(results.summary).toBeDefined();
      expect(results.endpoints).toBeDefined();
      expect(results.schemas).toBeDefined();
      expect(results.errors).toBeDefined();
      expect(results.warnings).toBeDefined();
      
      expect(typeof results.summary.totalEndpoints).toBe('number');
      expect(typeof results.summary.validatedEndpoints).toBe('number');
      expect(typeof results.summary.missingDocumentation).toBe('number');
      expect(Array.isArray(results.endpoints)).toBe(true);
      expect(Array.isArray(results.schemas)).toBe(true);
    });

    test('should handle swagger generation failure in report', async () => {
      // Mock generateSwaggerSpec to return null
      validator.generateSwaggerSpec = jest.fn().mockReturnValue(null);
      
      const results = await validator.generateValidationReport();
      expect(results.summary.totalEndpoints).toBe(0);
      expect(results.endpoints).toHaveLength(0);
      expect(results.schemas).toHaveLength(0);
    });
  });

  describe('saveValidationReport', () => {
    test('should save validation report to file', () => {
      const testResults = {
        summary: { totalEndpoints: 5 },
        endpoints: [],
        schemas: [],
        errors: [],
        warnings: []
      };

      const reportPath = validator.saveValidationReport(testResults, 'test-report.json');
      expect(reportPath).toBeDefined();
      expect(fs.existsSync(reportPath)).toBe(true);
      
      const savedContent = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      expect(savedContent.summary.totalEndpoints).toBe(5);
      
      // Clean up
      fs.unlinkSync(reportPath);
    });

    test('should handle file save errors', () => {
      // Mock fs.writeFileSync to throw an error
      const originalWriteFile = fs.writeFileSync;
      fs.writeFileSync = jest.fn().mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const reportPath = validator.saveValidationReport({}, 'test-report.json');
      expect(reportPath).toBeNull();

      // Restore original function
      fs.writeFileSync = originalWriteFile;
    });
  });

  describe('validateEndpoint', () => {
    test('should validate specific endpoint successfully', async () => {
      // This test requires a valid swagger spec with documented endpoints
      const result = await validator.validateEndpoint('GET', '/api/v1/health');
      
      if (result.valid) {
        expect(result.operation).toBeDefined();
        expect(result.requestSchema).toBeDefined();
        expect(result.responseSchema).toBeDefined();
        expect(result.parameters).toBeDefined();
        expect(result.security).toBeDefined();
      } else {
        // If endpoint is not documented, should return appropriate error
        expect(result.error).toBeDefined();
      }
    });

    test('should handle missing swagger specification', async () => {
      validator.generateSwaggerSpec = jest.fn().mockReturnValue(null);
      
      const result = await validator.validateEndpoint('GET', '/api/test');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('No swagger specification found');
    });

    test('should handle undocumented path', async () => {
      validator.generateSwaggerSpec = jest.fn().mockReturnValue({
        paths: {}
      });
      
      const result = await validator.validateEndpoint('GET', '/api/nonexistent');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Path /api/nonexistent not found in documentation');
    });

    test('should handle undocumented method', async () => {
      validator.generateSwaggerSpec = jest.fn().mockReturnValue({
        paths: {
          '/api/test': {
            get: { summary: 'Test endpoint' }
          }
        }
      });
      
      const result = await validator.validateEndpoint('POST', '/api/test');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Method POST not found for path /api/test');
    });
  });

  describe('printValidationReport', () => {
    test('should print validation report without errors', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      const testResults = {
        summary: {
          totalEndpoints: 10,
          validatedEndpoints: 8,
          missingDocumentation: 2,
          schemaErrors: 0,
          driftDetected: 1
        },
        endpoints: [
          { method: 'GET', path: '/api/test', file: 'test.js', isDocumented: true },
          { method: 'POST', path: '/api/test', file: 'test.js', isDocumented: false }
        ],
        errors: [],
        warnings: [
          { type: 'MISSING_DOCUMENTATION', message: 'Test warning', endpoint: 'POST /api/test' }
        ]
      };

      validator.printValidationReport(testResults);
      
      expect(consoleSpy).toHaveBeenCalledWith('\n📊 API Documentation Validation Report');
      expect(consoleSpy).toHaveBeenCalledWith('Total Endpoints: 10');
      expect(consoleSpy).toHaveBeenCalledWith('Documentation Coverage: 80.00%');
      
      consoleSpy.mockRestore();
    });
  });
});