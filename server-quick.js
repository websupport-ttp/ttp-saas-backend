// Quick server startup - bypasses complex initialization
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: './.env' });

const app = express();
const PORT = process.env.PORT || 8080;

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

// Basic health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.send('The Travel Place API - Quick Server');
});

// Load and mount routes
try {
  console.log('Loading routes...');
  
  // Try to load individual route files to identify the problematic one
  const routeFiles = [
    'authRoutes',
    'userRoutes', 
    'productRoutes',
    'bookingRoutes',
    'messageRoutes',
    'postRoutes',
    'categoryRoutes',
    'analyticsRoutes',
    'affiliateRoutes',
    'affiliateNotificationRoutes',
    'walletRoutes',
    'qrCodeRoutes',
    'referenceDataRoutes',
    'airportDbRoutes'
  ];
  
  for (const routeFile of routeFiles) {
    try {
      const route = require(`./v1/routes/${routeFile}`);
      console.log(`✅ ${routeFile} loaded successfully`);
    } catch (error) {
      console.error(`❌ Error loading ${routeFile}:`, error.message);
    }
  }
  
  // Load main routes
  const routes = require('./v1/routes');
  app.use('/api/v1', routes);
  console.log('✅ Main routes loaded successfully');
} catch (error) {
  console.error('❌ Error loading routes:', error.message);
  
  // Load a minimal hotel booking route for testing
  app.post('/api/v1/products/hotels/book', (req, res) => {
    console.log('Hotel booking request received:', req.body);
    
    // Return the expected format for hotel booking success (matching ApiResponse.success format)
    res.json({ 
      status: 'success',
      message: 'Hotel booking initiated. Please complete payment to confirm reservation.',
      data: {
        bookingReference: `TTP-HTL-${Date.now()}`,
        authorizationUrl: `http://localhost:3001/success?service=hotel&ref=TTP-HTL-${Date.now()}`,
        paymentReference: `TTP-HTL-PAY-${Date.now()}`,
        amount: (req.body.hotelDetails?.price || 50000) + 3000, // Add service charge
        currency: 'NGN',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        hotelDetails: {
          id: req.body.hotelDetails?.id || 'dummy_hotel_id',
          name: req.body.hotelDetails?.name || 'Test Hotel',
          checkIn: req.body.hotelDetails?.checkInDate,
          checkOut: req.body.hotelDetails?.checkOutDate,
          roomType: req.body.hotelDetails?.roomName || 'Standard Room'
        },
        guestDetails: {
          name: `${req.body.guestDetails?.firstName || 'Test'} ${req.body.guestDetails?.lastName || 'User'}`,
          email: req.body.guestDetails?.email || 'test@example.com',
          phone: req.body.guestDetails?.phoneNumber || '+234000000000'
        },
        serviceCharges: {
          hotelReservationCharges: 3000
        },
        instructions: {
          payment: 'Complete payment within 30 minutes to confirm hotel reservation',
          cancellation: 'Cancellation policy depends on hotel terms and conditions'
        }
      },
      timestamp: new Date().toISOString()
    });
  });
  
  console.log('✅ Minimal hotel booking route added');
}

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error', 
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found', 
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Quick server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`📍 API base: http://localhost:${PORT}/api/v1`);
});

server.on('error', (error) => {
  console.error('❌ Server error:', error);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});