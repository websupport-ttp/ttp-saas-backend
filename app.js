// app.js
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

// Load environment variables
dotenv.config({ path: './.env' });

// Validate environment variables
const { validateAppEnvironment } = require('./v1/utils/validateEnv');
try {
  validateAppEnvironment();
} catch (error) {
  console.error('Failed to start application due to environment validation errors:', error.message);
  process.exit(1);
}

// Initialize Express app
const app = express();

// Import configurations
const connectDB = require('./v1/config/db');
const redisClient = require('./v1/config/redis');
const { serviceChargeEnum } = require('./v1/utils/constants');

// Connect to MongoDB
connectDB();

// Initialize application components
const { initializeApplication } = require('./v1/utils/initializeApp');
// Run initialization after a short delay to ensure DB connection is established
setTimeout(() => {
  initializeApplication().catch(error => {
    console.error('Failed to initialize application:', error.message);
  });
}, 2000);

// Connect to Redis and set initial service charge enum
(async () => {
  try {
    // Import logger inside the async function to ensure it's fully initialized
    const logger = require('./v1/utils/logger');
    
    if (!redisClient.isReady) {
      await redisClient.connect();
    }
    
    // Safely check if logger methods exist
    if (logger && typeof logger.info === 'function') {
      logger.info('Connected to Redis');
    } else {
      console.log('Connected to Redis');
    }

    // Set service charge enum in Redis if not already set
    for (const key in serviceChargeEnum) {
      if (serviceChargeEnum.hasOwnProperty(key)) {
        const field = key.replace(/([A-Z])/g, '_$1').toUpperCase(); // Convert camelCase to SNAKE_CASE
        const value = serviceChargeEnum[key];
        const exists = await redisClient.hExists('serviceCharges', field);
        if (!exists) {
          await redisClient.hSet('serviceCharges', field, value);
          if (logger && typeof logger.info === 'function') {
            logger.info(`Set Redis service charge: ${field} = ${value}`);
          } else {
            console.log(`Set Redis service charge: ${field} = ${value}`);
          }
        }
      }
    }
  } catch (err) {
    try {
      const logger = require('./v1/utils/logger');
      if (logger && typeof logger.error === 'function') {
        logger.error('Failed to connect to Redis or set service charges:', err.message);
        logger.warn('Application will continue without Redis caching. Some features may be degraded.');
      } else {
        console.error('Failed to connect to Redis or set service charges:', err.message);
        console.warn('Application will continue without Redis caching. Some features may be degraded.');
      }
    } catch (loggerError) {
      console.error('Failed to connect to Redis or set service charges:', err.message);
      console.warn('Application will continue without Redis caching. Some features may be degraded.');
    }
    
    // Mock Redis client methods to prevent crashes when Redis is unavailable
    redisClient.isReady = false;
    redisClient.get = async () => null;
    redisClient.set = async () => 'OK';
    redisClient.hGet = async () => null;
    redisClient.hSet = async () => 1;
    redisClient.hExists = async () => false;
    redisClient.del = async () => 1;
    redisClient.flushdb = async () => 'OK';
  }
})();

// Enhanced Security Configuration
const securityConfig = {
  // Body parsing limits
  jsonLimit: '10mb',
  urlencodedLimit: '10mb',
  
  // CORS configuration
  corsOptions: {
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      if (process.env.NODE_ENV === 'production') {
        const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim());
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        } else {
          return callback(new Error('Not allowed by CORS'));
        }
      } else {
        // Development mode - allow all origins
        return callback(null, true);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-Device-ID',
      'X-Request-ID',
      'X-Forwarded-For',
    ],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    maxAge: 86400, // 24 hours
  },
  
  // Helmet configuration for enhanced security headers
  helmetOptions: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
        scriptSrc: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false, // Disable for API compatibility
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    noSniff: true,
    frameguard: { action: 'deny' },
    xssFilter: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  },
};

// Body parsing with size limits
app.use(express.json({ 
  limit: securityConfig.jsonLimit,
  verify: (req, res, buf) => {
    // Store raw body for webhook verification if needed
    req.rawBody = buf;
  }
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: securityConfig.urlencodedLimit 
}));

// Enhanced cookie parser with secure configuration
const cookieSecret = process.env.COOKIE_SECRET || 
  (process.env.NODE_ENV === 'test' ? 'test-cookie-secret-for-deterministic-testing-only-do-not-use-in-production' : 'default-cookie-secret-for-development');

app.use(cookieParser(cookieSecret));

// Enhanced CORS configuration
app.use(cors(securityConfig.corsOptions));

// Enhanced security headers with Helmet
app.use(helmet(securityConfig.helmetOptions));

// Additional security headers
app.use((req, res, next) => {
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  // Add custom security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Add request ID for tracing
  req.id = req.get('X-Request-ID') || require('crypto').randomUUID();
  res.setHeader('X-Request-ID', req.id);
  
  next();
});

// Enhanced input sanitization
app.use(mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    try {
      const logger = require('./v1/utils/logger');
      if (logger && typeof logger.logSecurityEvent === 'function') {
        logger.logSecurityEvent('NOSQL_INJECTION_ATTEMPT', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          endpoint: req.originalUrl,
          sanitizedKey: key,
        }, 'high');
      }
    } catch (error) {
      console.warn('Failed to log NoSQL injection attempt:', error.message);
    }
  },
}));

// Enhanced XSS protection
app.use(xss({
  onSanitize: (req, key, value) => {
    try {
      const logger = require('./v1/utils/logger');
      if (logger && typeof logger.logSecurityEvent === 'function') {
        logger.logSecurityEvent('XSS_ATTEMPT_DETECTED', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          endpoint: req.originalUrl,
          field: key,
          value: value.substring(0, 100), // Log first 100 chars
        }, 'high');
      }
    } catch (error) {
      console.warn('Failed to log XSS attempt:', error.message);
    }
  },
}));

// Enhanced HTTP Parameter Pollution protection
app.use(hpp({
  whitelist: ['tags', 'categories', 'sort'], // Allow arrays for these parameters
}));

// Compression with configuration
app.use(compression({
  level: 6,
  threshold: 1024, // Only compress responses larger than 1KB
  filter: (req, res) => {
    // Don't compress if the request includes a cache-control no-transform directive
    if (req.headers['cache-control'] && req.headers['cache-control'].includes('no-transform')) {
      return false;
    }
    return compression.filter(req, res);
  },
}));

// HTTP request logger
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Performance monitoring middleware
const performanceMiddleware = require('./v1/middleware/performanceMiddleware');
app.use(performanceMiddleware);

// Centralized OpenAPI documentation setup
const swaggerOptions = {
  // Directly define the swagger definition and apis here
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'The Travel Place API',
      version: '1.0.0',
      description: 'API documentation for The Travel Place backend services, integrating Allianz Travel Insurance, Paystack, Amadeus, and Ratehawk.',
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 5000}/api/v1`,
        description: 'Development server',
      },
      // Add production server URL here
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{
      bearerAuth: [],
    }],
  },
  apis: ['./v1/routes/*.js', './docs/swagger.js'], // Paths to files containing OpenAPI annotations
};

// Temporarily disable swagger docs to avoid YAML parsing errors during tests
if (process.env.NODE_ENV !== 'test') {
  const swaggerDocs = swaggerJsdoc(swaggerOptions);
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));
}

// V1 API Routes
app.use('/api/v1', require('./v1/routes'));

// Health check routes (separate from v1 for monitoring tools)
app.use('/health', require('./v1/routes/healthRoutes'));

// Handle unhandled routes first
app.all('*', (req, res, next) => {
  const { ApiError } = require('./v1/utils/apiError');
  const error = new ApiError(
    `Can't find ${req.originalUrl} on this server!`,
    404,
    [],
    'ROUTE_NOT_FOUND'
  );
  next(error);
});

// Global Error Handling Middleware
const { errorHandler, notFoundHandler } = require('./v1/middleware/errorHandler');

// Handle 404 errors for undefined routes
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);



module.exports = app;