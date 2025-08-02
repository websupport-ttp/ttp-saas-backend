// v1/utils/documentationValidator.js
const swaggerJsdoc = require('swagger-jsdoc');
const fs = require('fs');
const path = require('path');

/**
 * Documentation Validator Utility
 * Validates OpenAPI specifications against actual endpoint implementations
 * Detects documentation drift and provides comprehensive validation reports
 */
class DocumentationValidator {
  constructor() {
    this.swaggerOptions = {
      definition: {
        openapi: '3.0.0',
        info: {
          title: 'The Travel Place API',
          version: '1.0.0',
          description: 'Comprehensive travel booking platform API with integrated third-party services',
        },
        servers: [
          {
            url: process.env.BASE_URL || 'http://localhost:3000',
            description: 'Development server',
          },
        ],
      },
      apis: ['./v1/routes/*.js', './docs/swagger.js'],
    };
    
    this.validationResults = {
      endpoints: [],
      schemas: [],
      errors: [],
      warnings: [],
      summary: {
        totalEndpoints: 0,
        validatedEndpoints: 0,
        missingDocumentation: 0,
        schemaErrors: 0,
        driftDetected: 0
      }
    };
  }

  /**
   * Generate OpenAPI specification from JSDoc comments
   */
  generateSwaggerSpec() {
    try {
      return swaggerJsdoc(this.swaggerOptions);
    } catch (error) {
      this.validationResults.errors.push({
        type: 'SWAGGER_GENERATION_ERROR',
        message: `Failed to generate swagger specification: ${error.message}`,
        details: error.stack
      });
      return null;
    }
  }

  /**
   * Load route files and extract endpoint information
   */
  async loadRouteFiles() {
    const routesDir = path.join(process.cwd(), 'v1', 'routes');
    const routeFiles = fs.readdirSync(routesDir).filter(file => file.endsWith('.js'));
    const endpoints = [];

    for (const file of routeFiles) {
      try {
        const filePath = path.join(routesDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Extract route definitions using regex patterns
        const routePatterns = [
          /router\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g,
          /app\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g
        ];

        routePatterns.forEach(pattern => {
          let match;
          while ((match = pattern.exec(content)) !== null) {
            endpoints.push({
              method: match[1].toUpperCase(),
              path: match[2],
              file: file,
              hasDocumentation: this.checkForSwaggerDoc(content, match[2])
            });
          }
        });
      } catch (error) {
        this.validationResults.errors.push({
          type: 'ROUTE_FILE_ERROR',
          message: `Failed to process route file ${file}: ${error.message}`,
          file: file
        });
      }
    }

    return endpoints;
  }

  /**
   * Check if endpoint has swagger documentation
   */
  checkForSwaggerDoc(content, routePath) {
    // Look for OpenAPI/Swagger comments near the route definition
    const swaggerPatterns = [
      /@openapi/i,
      /@swagger/i,
      /\* @openapi/i,
      /\* @swagger/i
    ];

    // Get content around the route definition
    const routeIndex = content.indexOf(routePath);
    if (routeIndex === -1) return false;

    // Check 1000 characters before the route definition for swagger docs
    const beforeRoute = content.substring(Math.max(0, routeIndex - 1000), routeIndex);
    
    return swaggerPatterns.some(pattern => pattern.test(beforeRoute));
  }

  /**
   * Generate comprehensive validation report
   */
  async generateValidationReport() {
    console.log('🔍 Starting API documentation validation...');

    // Generate swagger specification
    const swaggerSpec = this.generateSwaggerSpec();
    if (!swaggerSpec) {
      return this.validationResults;
    }

    // Load and analyze route files
    const endpoints = await this.loadRouteFiles();
    this.validationResults.summary.totalEndpoints = endpoints.length;

    // Store endpoint details
    this.validationResults.endpoints = endpoints.map(endpoint => ({
      ...endpoint,
      isDocumented: endpoint.hasDocumentation
    }));

    // Validate documented endpoints
    if (swaggerSpec.paths) {
      for (const path in swaggerSpec.paths) {
        const pathItem = swaggerSpec.paths[path];
        for (const method in pathItem) {
          if (['get', 'post', 'put', 'patch', 'delete'].includes(method)) {
            const operation = pathItem[method];
            const endpointKey = `${method.toUpperCase()} ${path}`;
            
            // Find corresponding implementation
            const hasImplementation = endpoints.some(ep => 
              ep.method === method.toUpperCase() && this.pathsMatch(ep.path, path)
            );
            
            // Validate schemas
            const requestSchemaValid = this.validateRequestSchema(operation);
            const responseSchemaValid = this.validateResponseSchema(operation);
            const parametersValid = this.validateParameters(operation);
            const securityValid = this.validateSecurity(operation);
            
            this.validationResults.schemas.push({
              endpoint: endpointKey,
              hasImplementation,
              hasDocumentation: true,
              requestSchemaValid,
              responseSchemaValid,
              parametersValid,
              securityValid
            });
            
            // Add warnings for missing implementations
            if (!hasImplementation) {
              this.validationResults.warnings.push({
                type: 'MISSING_IMPLEMENTATION',
                message: `Documented endpoint ${endpointKey} has no implementation`,
                endpoint: endpointKey
              });
            }
          }
        }
      }
    }

    // Add warnings for undocumented endpoints
    endpoints.forEach(endpoint => {
      if (!endpoint.hasDocumentation) {
        this.validationResults.warnings.push({
          type: 'MISSING_DOCUMENTATION',
          message: `Endpoint ${endpoint.method} ${endpoint.path} has no documentation`,
          endpoint: `${endpoint.method} ${endpoint.path}`,
          file: endpoint.file
        });
      }
    });

    // Calculate summary statistics
    this.validationResults.summary.validatedEndpoints = endpoints.filter(ep => ep.hasDocumentation).length;
    this.validationResults.summary.missingDocumentation = endpoints.filter(ep => !ep.hasDocumentation).length;
    this.validationResults.summary.schemaErrors = this.validationResults.errors.length;
    this.validationResults.summary.driftDetected = this.validationResults.warnings.length;

    console.log('✅ API documentation validation completed');
    return this.validationResults;
  }

  /**
   * Print validation report to console
   */
  printValidationReport(results = this.validationResults) {
    console.log('\n📊 API Documentation Validation Report');
    console.log('=====================================');
    
    // Summary
    console.log('\n📈 Summary:');
    console.log(`Total Endpoints: ${results.summary.totalEndpoints}`);
    console.log(`Validated Endpoints: ${results.summary.validatedEndpoints}`);
    console.log(`Missing Documentation: ${results.summary.missingDocumentation}`);
    console.log(`Schema Errors: ${results.summary.schemaErrors}`);
    console.log(`Warnings: ${results.summary.driftDetected}`);

    // Coverage percentage
    const coverage = results.summary.totalEndpoints > 0 
      ? ((results.summary.validatedEndpoints / results.summary.totalEndpoints) * 100).toFixed(2)
      : 0;
    console.log(`Documentation Coverage: ${coverage}%`);

    // Errors
    if (results.errors.length > 0) {
      console.log('\n❌ Errors:');
      results.errors.forEach((error, index) => {
        console.log(`${index + 1}. [${error.type}] ${error.message}`);
        if (error.endpoint) console.log(`   Endpoint: ${error.endpoint}`);
        if (error.file) console.log(`   File: ${error.file}`);
      });
    }

    // Warnings
    if (results.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      results.warnings.forEach((warning, index) => {
        console.log(`${index + 1}. [${warning.type}] ${warning.message}`);
        if (warning.endpoint) console.log(`   Endpoint: ${warning.endpoint}`);
        if (warning.file) console.log(`   File: ${warning.file}`);
      });
    }

    // Endpoint details
    console.log('\n📋 Endpoint Details:');
    results.endpoints.forEach(endpoint => {
      const status = endpoint.isDocumented ? '✅' : '❌';
      console.log(`${status} ${endpoint.method} ${endpoint.path} (${endpoint.file})`);
    });

    console.log('\n=====================================');
  }

  /**
   * Save validation report to file
   */
  saveValidationReport(results = this.validationResults, filename = 'api-validation-report.json') {
    try {
      const reportPath = path.join(process.cwd(), filename);
      fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
      console.log(`📄 Validation report saved to: ${reportPath}`);
      return reportPath;
    } catch (error) {
      console.error('Failed to save validation report:', error.message);
      return null;
    }
  }

  /**
   * Validate a specific endpoint
   */
  async validateEndpoint(method, path) {
    const result = { 
      valid: false, 
      error: null, 
      operation: null,
      requestSchema: { valid: true, issues: [] },
      responseSchema: { valid: true, issues: [] },
      parameters: { valid: true, issues: [] },
      security: { valid: true, issues: [] }
    };
    
    try {
      const spec = this.generateSwaggerSpec();
      
      if (!spec) {
        result.error = 'No swagger specification found';
        return result;
      }
      
      // Find matching path
      let matchedPath = null;
      for (const apiPath in spec.paths) {
        if (this.pathsMatch(path, apiPath)) {
          matchedPath = apiPath;
          break;
        }
      }
      
      if (!matchedPath) {
        result.error = `Path ${path} not found in documentation`;
        return result;
      }
      
      // Check if method exists
      const pathObj = spec.paths[matchedPath];
      const methodLower = method.toLowerCase();
      if (!pathObj[methodLower]) {
        result.error = `Method ${method} not found for path ${path}`;
        return result;
      }
      
      result.valid = true;
      result.operation = pathObj[methodLower];
      
      // Validate schemas and parameters
      result.requestSchema = this.validateRequestSchema(result.operation);
      result.responseSchema = this.validateResponseSchema(result.operation);
      result.parameters = this.validateParameters(result.operation);
      result.security = this.validateSecurity(result.operation);
      
      return result;
    } catch (error) {
      result.error = `Error validating endpoint: ${error.message}`;
      return result;
    }
  }

  /**
   * Validate schema structure
   */
  validateSchemaStructure(schema, name) {
    return validateSchemaStructure(schema, name);
  }

  /**
   * Validate request schema
   */
  validateRequestSchema(operation) {
    return validateRequestSchema(operation);
  }

  /**
   * Validate response schema
   */
  validateResponseSchema(operation) {
    return validateResponseSchema(operation);
  }

  /**
   * Validate parameters
   */
  validateParameters(operation) {
    return validateParameters(operation);
  }

  /**
   * Validate security
   */
  validateSecurity(operation) {
    return validateSecurity(operation);
  }

  /**
   * Check if paths match
   */
  pathsMatch(expressPath, openApiPath) {
    return pathsMatch(expressPath, openApiPath);
  }

  /**
   * Validate OpenAPI specification structure
   */
  validateOpenAPIStructure(spec) {
    const issues = [];
    
    if (!spec) {
      issues.push('OpenAPI specification is null or undefined');
      return { valid: false, issues };
    }
    
    // Check required OpenAPI fields
    if (!spec.openapi) {
      issues.push('Missing required field: openapi');
    } else if (!spec.openapi.startsWith('3.0')) {
      issues.push('OpenAPI version should be 3.0.x');
    }
    
    if (!spec.info) {
      issues.push('Missing required field: info');
    } else {
      if (!spec.info.title) {
        issues.push('Missing required field: info.title');
      }
      if (!spec.info.version) {
        issues.push('Missing required field: info.version');
      }
    }
    
    if (!spec.paths) {
      issues.push('Missing required field: paths');
    } else if (Object.keys(spec.paths).length === 0) {
      issues.push('Paths object is empty - no endpoints documented');
    }
    
    return { valid: issues.length === 0, issues };
  }

  /**
   * Validate API specification formats
   */
  validateSpecificationFormats(spec) {
    const issues = [];
    
    if (!spec || !spec.paths) {
      return { valid: false, issues: ['No paths to validate'] };
    }
    
    // Validate each path and operation
    for (const path in spec.paths) {
      const pathItem = spec.paths[path];
      
      // Validate path format
      if (!path.startsWith('/')) {
        issues.push(`Path ${path} should start with /`);
      }
      
      // Validate operations
      for (const method in pathItem) {
        if (['get', 'post', 'put', 'patch', 'delete', 'options', 'head'].includes(method)) {
          const operation = pathItem[method];
          
          // Check for required operation fields
          if (!operation.summary && !operation.description) {
            issues.push(`Operation ${method.toUpperCase()} ${path} missing summary or description`);
          }
          
          // Validate responses
          if (!operation.responses) {
            issues.push(`Operation ${method.toUpperCase()} ${path} missing responses`);
          } else {
            const hasSuccessResponse = Object.keys(operation.responses).some(code => 
              code.startsWith('2') || code === 'default'
            );
            if (!hasSuccessResponse) {
              issues.push(`Operation ${method.toUpperCase()} ${path} missing success response (2xx)`);
            }
          }
          
          // Validate request body for POST/PUT/PATCH
          if (['post', 'put', 'patch'].includes(method)) {
            if (!operation.requestBody) {
              issues.push(`Operation ${method.toUpperCase()} ${path} should have requestBody`);
            }
          }
        }
      }
    }
    
    return { valid: issues.length === 0, issues };
  }

  /**
   * Validate comprehensive API specification
   */
  async validateAPISpecification() {
    const spec = this.generateSwaggerSpec();
    const result = {
      valid: true,
      structure: { valid: true, issues: [] },
      formats: { valid: true, issues: [] },
      endpoints: [],
      summary: {
        totalEndpoints: 0,
        validEndpoints: 0,
        structureIssues: 0,
        formatIssues: 0
      }
    };
    
    if (!spec) {
      result.valid = false;
      result.structure.valid = false;
      result.structure.issues.push('Failed to generate OpenAPI specification');
      return result;
    }
    
    // Validate structure
    result.structure = this.validateOpenAPIStructure(spec);
    
    // Validate formats
    result.formats = this.validateSpecificationFormats(spec);
    
    // Validate individual endpoints
    if (spec.paths) {
      for (const path in spec.paths) {
        const pathItem = spec.paths[path];
        for (const method in pathItem) {
          if (['get', 'post', 'put', 'patch', 'delete'].includes(method)) {
            const endpointValidation = await this.validateEndpoint(method.toUpperCase(), path);
            result.endpoints.push({
              method: method.toUpperCase(),
              path,
              ...endpointValidation
            });
            result.summary.totalEndpoints++;
            if (endpointValidation.valid) {
              result.summary.validEndpoints++;
            }
          }
        }
      }
    }
    
    // Calculate summary
    result.summary.structureIssues = result.structure.issues.length;
    result.summary.formatIssues = result.formats.issues.length;
    result.valid = result.structure.valid && result.formats.valid && 
                   result.summary.validEndpoints === result.summary.totalEndpoints;
    
    return result;
  }
}

/**
 * Individual validation functions for backward compatibility
 */
const validateSchemaStructure = (schema, name) => {
  const issues = [];
  if (!schema) {
    issues.push(`Schema is null or undefined`);
    return issues;
  }
  
  if (schema.type === 'object') {
    // Check if all required properties are defined
    if (schema.required) {
      schema.required.forEach(prop => {
        if (!schema.properties || !schema.properties[prop]) {
          issues.push(`Required property '${prop}' not defined in properties for ${name}`);
        }
      });
    }
    
    // Check if all properties have types
    if (schema.properties) {
      Object.keys(schema.properties).forEach(prop => {
        const property = schema.properties[prop];
        if (!property.type && !property.$ref && !property.allOf && !property.oneOf && !property.anyOf) {
          issues.push(`Property ${prop} missing type definition`);
        }
      });
    }
  }
  
  if (schema.type === 'array' && !schema.items) {
    issues.push(`Array schema missing items definition for ${name}`);
  }
  
  return issues;
};

const validateRequestSchema = (operation) => {
  const result = { valid: true, issues: [] };
  
  if (!operation || !operation.requestBody || !operation.requestBody.content) {
    return result;
  }
  
  const contentTypes = Object.keys(operation.requestBody.content);
  for (const contentType of contentTypes) {
    const content = operation.requestBody.content[contentType];
    if (!content.schema) {
      result.valid = false;
      result.issues.push(`Missing schema for ${contentType} in request body`);
      continue;
    }
    
    const issues = validateSchemaStructure(content.schema, `request body ${contentType}`);
    if (issues.length > 0) {
      result.valid = false;
      result.issues.push(...issues);
    }
  }
  
  return result;
};

const validateResponseSchema = (operation) => {
  const result = { valid: true, issues: [] };
  
  if (!operation || !operation.responses) {
    return result;
  }
  
  const statusCodes = Object.keys(operation.responses);
  for (const statusCode of statusCodes) {
    const response = operation.responses[statusCode];
    if (!response.content) continue;
    
    const contentTypes = Object.keys(response.content);
    for (const contentType of contentTypes) {
      const content = response.content[contentType];
      if (!content.schema) {
        result.valid = false;
        result.issues.push(`Missing schema for ${contentType} in response ${statusCode}`);
        continue;
      }
      
      const issues = validateSchemaStructure(content.schema, `response ${statusCode} ${contentType}`);
      if (issues.length > 0) {
        result.valid = false;
        result.issues.push(...issues);
      }
    }
  }
  
  return result;
};

const validateParameters = (operation) => {
  const result = { valid: true, issues: [] };
  
  if (!operation || !operation.parameters) {
    return result;
  }
  
  for (const param of operation.parameters) {
    if (!param.name) {
      result.valid = false;
      result.issues.push('Parameter missing name');
    }
    if (!param.in) {
      result.valid = false;
      result.issues.push(`Parameter ${param.name || 'unknown'} missing 'in' property`);
    }
    if (!param.schema) {
      result.valid = false;
      result.issues.push(`Parameter ${param.name || 'unknown'} missing schema`);
    }
  }
  
  return result;
};

const validateSecurity = (operation) => {
  const result = { valid: true, issues: [] };
  
  if (!operation || !operation.security) {
    return result;
  }
  
  // Add security validation logic here if needed
  return result;
};

const pathsMatch = (expressPath, openApiPath) => {
  // Convert Express path params (:id) to OpenAPI format ({id})
  const expressPathRegex = expressPath
    .replace(/:[^\/]+/g, match => `{${match.substring(1)}}`)
    .replace(/\//g, '\\/');
  const openApiPathRegex = openApiPath.replace(/\//g, '\\/');
  return expressPathRegex === openApiPathRegex;
};

const validateEndpoint = async (method, path) => {
  const result = { valid: false, error: null, operation: null };
  
  try {
    const validator = new DocumentationValidator();
    const spec = validator.generateSwaggerSpec();
    
    if (!spec) {
      result.error = 'No swagger specification found';
      return result;
    }
    
    // Find matching path
    let matchedPath = null;
    for (const apiPath in spec.paths) {
      if (pathsMatch(path, apiPath)) {
        matchedPath = apiPath;
        break;
      }
    }
    
    if (!matchedPath) {
      result.error = `Path ${path} not found in documentation`;
      return result;
    }
    
    // Check if method exists
    const pathObj = spec.paths[matchedPath];
    const methodLower = method.toLowerCase();
    if (!pathObj[methodLower]) {
      result.error = `Method ${method} not found for path ${path}`;
      return result;
    }
    
    result.valid = true;
    result.operation = pathObj[methodLower];
    return result;
  } catch (error) {
    result.error = `Error validating endpoint: ${error.message}`;
    return result;
  }
};

// Export the class as the main export for backward compatibility
module.exports = DocumentationValidator;

// Also export individual functions as properties for backward compatibility
module.exports.validateSchemaStructure = validateSchemaStructure;
module.exports.validateRequestSchema = validateRequestSchema;
module.exports.validateResponseSchema = validateResponseSchema;
module.exports.validateParameters = validateParameters;
module.exports.validateSecurity = validateSecurity;
module.exports.pathsMatch = pathsMatch;
module.exports.validateEndpoint = validateEndpoint;

// Export class methods as static functions for additional compatibility
module.exports.DocumentationValidator = DocumentationValidator;