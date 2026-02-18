// Simple server test
const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

app.get('/', (req, res) => {
  res.send('Simple server is working!');
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Simple server is healthy' });
});

const server = app.listen(PORT, () => {
  console.log(`🚀 Simple test server running on port ${PORT}`);
});

// Handle graceful shutdown
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