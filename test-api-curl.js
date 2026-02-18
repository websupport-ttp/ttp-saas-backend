const { spawn } = require('child_process');

console.log('Testing API with curl...');

const curl = spawn('curl', [
  '-s',
  '-w', '\\nHTTP Status: %{http_code}\\n',
  'http://localhost:3005/api/v1/reference/airports/search?q=New&limit=5'
]);

curl.stdout.on('data', (data) => {
  console.log('Response:', data.toString());
});

curl.stderr.on('data', (data) => {
  console.error('Error:', data.toString());
});

curl.on('close', (code) => {
  console.log(`Curl process exited with code ${code}`);
});

// Also test health endpoint
setTimeout(() => {
  console.log('\\nTesting health endpoint...');
  const healthCurl = spawn('curl', [
    '-s',
    '-w', '\\nHTTP Status: %{http_code}\\n',
    'http://localhost:3005/health'
  ]);

  healthCurl.stdout.on('data', (data) => {
    console.log('Health Response:', data.toString());
  });

  healthCurl.stderr.on('data', (data) => {
    console.error('Health Error:', data.toString());
  });

  healthCurl.on('close', (code) => {
    console.log(`Health curl process exited with code ${code}`);
  });
}, 2000);