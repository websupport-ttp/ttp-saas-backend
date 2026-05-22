// app.js
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');
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

// Trust proxy — required when running behind Render/Railway/Vercel load balancers.
// Without this, express-rate-limit throws ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
// and req.ip returns the proxy IP instead of the real client IP.
app.set('trust proxy', 1);

// Import configurations
const connectDB = require('./v1/config/db');
const redisClient = require('./v1/config/redis');

// Connect to MongoDB
connectDB();

// Initialize application components
const { initializeApplication } = require('./v1/utils/initializeApp');
const { initializeDefaultCurrencies } = require('./v1/services/currencyService');

// Run initialization after a short delay to ensure DB connection is established
setTimeout(() => {
  initializeApplication().catch(error => {
    console.error('Failed to initialize application:', error.message);
  });
  
  // Initialize default currencies
  initializeDefaultCurrencies().catch(error => {
    console.error('Failed to initialize currencies:', error.message);
  });
}, 2000);

// Connect to Redis and set initial service charge enum
(async () => {
  try {
    const logger = require('./v1/utils/logger');
    
    if (!redisClient.isReady) {
      await redisClient.connect();
    }
    
    if (logger && typeof logger.info === 'function') {
      logger.info('Connected to Redis');
    } else {
      console.log('Connected to Redis');
    }
    // Note: serviceChargeEnum is written to Redis by initializeApp.warmUpCache()
    // No need to duplicate it here
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
      
      // Log the origin for debugging
      console.log(`CORS request from origin: ${origin}`);
      
      if (process.env.NODE_ENV === 'production') {
        // Default allowed origins for production
        const defaultAllowedOrigins = [
          // Dev
          'https://dev.ttp.ng',
          'https://www.dev.ttp.ng',
          // Staging
          'https://staging.ttp.ng',
          'https://www.staging.ttp.ng',
          // Production
          'https://ttp.ng',
          'https://www.ttp.ng',
          // Vercel preview deployments
          'https://ttp-saas-frontend.vercel.app',
          'https://ttp-saas-frontend-git-main.vercel.app'
        ];
        
        const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(o => o);
        
        // Merge default and configured origins
        const allAllowedOrigins = allowedOrigins.length > 0 
          ? [...defaultAllowedOrigins, ...allowedOrigins]
          : defaultAllowedOrigins;
        
        // Check if origin matches exactly or matches Vercel preview pattern
        const isAllowed = allAllowedOrigins.includes(origin) || 
                         /^https:\/\/ttp-saas-frontend-[a-z0-9]+-websupport-ttps-projects\.vercel\.app$/.test(origin) ||
                         /^https:\/\/ttp-saas-frontend-[a-z0-9]+\.vercel\.app$/.test(origin);
        
        if (isAllowed) {
          console.log(`CORS allowed for origin: ${origin}`);
          return callback(null, true);
        } else {
          console.warn(`CORS blocked origin: ${origin}`);
          console.warn(`Allowed origins:`, allAllowedOrigins);
          return callback(new Error('Not allowed by CORS'));
        }
      } else {
        // Development mode - allow all origins
        console.log(`CORS allowed (dev mode) for origin: ${origin}`);
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
      'X-Client-Version',
      'X-Client-Platform',
      'X-Guest-Request',
    ],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    maxAge: 86400, // 24 hours
    preflightContinue: false,
    optionsSuccessStatus: 204
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

// Handle preflight requests explicitly
app.options('*', cors(securityConfig.corsOptions));

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

// Rate limiting
// General limiter — applied to all /api/ routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // increased from 100 — booking flows make multiple requests
  standardHeaders: true,  // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,   // Disable X-RateLimit-* headers
  message: {
    status: 'error',
    message: 'Too many requests from this IP, please try again after 15 minutes.',
  },
  skip: (req) => req.ip === '127.0.0.1' || req.ip === '::1', // Skip localhost
});

// Strict limiter for auth endpoints — prevents brute force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Too many authentication attempts from this IP, please try again after 15 minutes.',
  },
});

app.use('/api/', apiLimiter);
app.use('/api/v1/auth/', authLimiter);

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

// Setup Swagger documentation (disable only during automated tests)
if (process.env.NODE_ENV !== 'test' || process.env.ENABLE_SWAGGER === 'true') {
  try {
    const swaggerDocs = swaggerJsdoc(swaggerOptions);
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs, {
      explorer: true,
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'The Travel Place API Documentation'
    }));
    
    // Also serve the raw swagger JSON
    app.get('/api-docs.json', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(swaggerDocs);
    });
    
    console.log('📚 Swagger documentation available at /api-docs');
  } catch (error) {
    console.warn('⚠️  Failed to setup Swagger documentation:', error.message);
  }
}

// V1 API Routes
app.get('/', (req, res) => {
  res.send(`Welcome to The Travel Place's API`)
})

// V1 API Routes
app.use('/api/v1', require('./v1/routes'));

// Health check routes (separate from v1 for monitoring tools)
app.use('/health', require('./v1/routes/healthRoutes'));

// Monitoring routes for XML metrics
app.use('/api/v1/monitoring', require('./v1/routes/monitoring'));

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