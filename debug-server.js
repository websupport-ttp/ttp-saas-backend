// debug-server.js
const path = require('path');
const fs = require('fs');

console.log('🔍 Debugging Server Startup...\n');

// Load environment variables first
require('dotenv').config({ path: './.env' });

// Check environment
console.log('📋 Environment Check:');
console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
console.log(`   PORT: ${process.env.PORT || 'undefined (will use 3003)'}`);
console.log(`   Working Directory: ${process.cwd()}`);

// Check if required files exist
console.log('\n📁 File Check:');
const requiredFiles = [
  'app.js',
  'server.js',
  'package.json',
  '.env',
  'v1/routes/index.js',
  'v1/utils/logger.js'
];

requiredFiles.forEach(file => {
  const exists = fs.existsSync(path.join(__dirname, file));
  console.log(`   ${file}: ${exists ? '✅' : '❌'}`);
});

// Check package.json scripts
console.log('\n📦 Package.json Scripts:');
try {
  const packageJson = require('./package.json');
  console.log(`   start: ${packageJson.scripts.start}`);
  console.log(`   dev: ${packageJson.scripts.dev}`);
} catch (error) {
  console.log(`   ❌ Error reading package.json: ${error.message}`);
}

// Check environment variables
console.log('\n🔐 Environment Variables:');
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  console.log('   .env file exists ✅');
  try {
    const envContent = fs.readFileSync(envFile, 'utf8');
    const lines = envContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));
    console.log(`   Found ${lines.length} environment variables`);
    
    // Check for critical variables
    const criticalVars = ['MONGODB_URI', 'JWT_SECRET', 'NODE_ENV'];
    criticalVars.forEach(varName => {
      const hasVar = lines.some(line => line.startsWith(`${varName}=`));
      console.log(`   ${varName}: ${hasVar ? '✅' : '❌'}`);
    });
  } catch (error) {
    console.log(`   ❌ Error reading .env: ${error.message}`);
  }
} else {
  console.log('   .env file missing ❌');
}

// Try to start the server
console.log('\n🚀 Starting Server...');
try {
  // Set NODE_ENV to development if not set
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'development';
    console.log('   Set NODE_ENV to development');
  }
  
  // Enable Swagger for debugging
  process.env.ENABLE_SWAGGER = 'true';
  console.log('   Enabled Swagger documentation');
  
  // Load the app
  const app = require('./app');
  const PORT = process.env.PORT || 3003;
  
  const server = app.listen(PORT, () => {
    console.log(`\n🎉 Server started successfully!`);
    console.log(`   URL: http://localhost:${PORT}`);
    console.log(`   API Docs: http://localhost:${PORT}/api-docs`);
    console.log(`   Health Check: http://localhost:${PORT}/health`);
    console.log(`   Reference API: http://localhost:${PORT}/api/v1/reference/countries`);
    console.log('\n💡 You can now access the API documentation at http://localhost:5000/api-docs');
  });

  // Handle server errors
  server.on('error', (error) => {
    console.error(`\n❌ Server Error: ${error.message}`);
    if (error.code === 'EADDRINUSE') {
      console.error(`   Port ${PORT} is already in use. Try a different port or stop the existing server.`);
    }
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  });

} catch (error) {
  console.error(`\n❌ Failed to start server: ${error.message}`);
  console.error(`   Stack: ${error.stack}`);
  process.exit(1);
}