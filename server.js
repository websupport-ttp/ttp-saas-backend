const app = require('./app');
const logger = require('./v1/utils/logger');

const PORT = process.env.PORT || 5000;

// Start the server
const server = app.listen(PORT, () => {
  logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  logger.error(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err, origin) => {
  logger.error(`Uncaught Exception: ${err.message}\nOrigin: ${origin}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});