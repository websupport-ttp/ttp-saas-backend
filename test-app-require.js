// Test if app.js can be required properly
console.log('Starting app require test...');

try {
  console.log('Requiring app.js...');
  const app = require('./app');
  console.log('App required successfully');
  console.log('App type:', typeof app);
  console.log('App is function:', typeof app === 'function');
  console.log('App has listen method:', typeof app.listen === 'function');
  
  if (typeof app.listen === 'function') {
    console.log('Attempting to start server...');
    const server = app.listen(8080, () => {
      console.log('🚀 Test server started successfully on port 8080');
    });
    
    server.on('error', (error) => {
      console.error('Server error:', error);
    });
  } else {
    console.error('App does not have listen method');
  }
} catch (error) {
  console.error('Error requiring app:', error);
}