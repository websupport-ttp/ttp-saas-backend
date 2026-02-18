const app = require('./app');

// For Vercel serverless deployment, export the app directly
if (process.env.VERCEL) {
  module.exports = app;
} else {
  // For local development, start the server normally
  const logger = require('./v1/utils/logger');
  const PORT = process.env.PORT || 5000;

  console.log('Starting server setup...');
  console.log('App object:', typeof app);
  console.log('Port:', PORT);

  // Start the server immediately - the app should be ready
  try {
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
      if (logger && typeof logger.info === 'function') {
        logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
      }
    });

    server.on('error', (error) => {
      console.error('Server error:', error);
      if (logger && typeof logger.error === 'function') {
        logger.error('Server error:', error);
      }
    });

    console.log('Server listen call completed');
  } catch (error) {
    console.error('Error starting server:', error);
    if (logger && typeof logger.error === 'function') {
      logger.error('Error starting server:', error);
    }
  }

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (err, promise) => {
    if (logger && typeof logger.error === 'function') {
      logger.error(`Error: ${err.message}`);
    } else {
      console.error(`Error: ${err.message}`);
    }
    // Close server & exit process
    process.exit(1);
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (err, origin) => {
    if (logger && typeof logger.error === 'function') {
      logger.error(`Uncaught Exception: ${err.message}\nOrigin: ${origin}`);
    } else {
      console.error(`Uncaught Exception: ${err.message}\nOrigin: ${origin}`);
    }
    // Close server & exit process
    process.exit(1);
  });
}