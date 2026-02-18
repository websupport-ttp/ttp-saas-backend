// Simple API testing script
const http = require('http');

const testEndpoint = (path, method = 'GET', data = null) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: body
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
};

async function runTests() {
  console.log('🧪 Testing The Travel Place API...\n');

  const tests = [
    { name: 'Welcome Page', path: '/' },
    { name: 'Health Check', path: '/health' },
    { name: 'API Documentation', path: '/api-docs' },
    { name: 'User Routes', path: '/api/v1/users' },
    { name: 'Products Routes', path: '/api/v1/products' },
    { name: 'Auth Routes', path: '/api/v1/auth' },
    { name: 'Analytics Routes', path: '/api/v1/analytics' },
  ];

  for (const test of tests) {
    try {
      console.log(`Testing ${test.name}...`);
      const result = await testEndpoint(test.path);
      console.log(`✅ ${test.name}: ${result.status} ${getStatusText(result.status)}`);
    } catch (error) {
      console.log(`❌ ${test.name}: ${error.message}`);
    }
  }

  console.log('\n🎉 API Testing Complete!');
}

function getStatusText(status) {
  const statusTexts = {
    200: 'OK',
    201: 'Created',
    400: 'Bad Request',
    401: 'Unauthorized',
    404: 'Not Found',
    500: 'Internal Server Error'
  };
  return statusTexts[status] || 'Unknown';
}

runTests().catch(console.error);