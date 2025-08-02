// v1/test/integration/testApp.js
// Test application setup with all routes properly configured

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const compression = require('compression');
const cookieParser = require('cookie-parser');

// Create test app
const app = express();

// Basic security middleware for testing
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
}));

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser('test-cookie-secret'));
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());
app.use(compression());

// Performance monitoring middleware
const performanceMiddleware = require('../../middleware/performanceMiddleware');
app.use(performanceMiddleware);

// V1 API Routes - Import all routes properly
app.use('/api/v1', require('../../routes'));

// Health check routes
app.use('/health', require('../../routes/healthRoutes'));

// Handle unhandled routes
app.all('*', (req, res, next) => {
  const { ApiError } = require('../../utils/apiError');
  const error = new ApiError(
    `Can't find ${req.originalUrl} on this server!`,
    404,
    [],
    'ROUTE_NOT_FOUND'
  );
  next(error);
});

// Global Error Handling Middleware
const { errorHandler, notFoundHandler } = require('../../middleware/errorHandler');
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;