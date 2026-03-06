// Test script to verify Resend email service is working
require('dotenv').config();
const https = require('https');

const testEmail = async () => {
  console.log('Testing Resend Email Service...');
  console.log('RESEND_API_KEY:', process.env.RESEND_API_KEY ? '✓ Set' : '✗ Missing');
  console.log('EMAIL_FROM:', process.env.EMAIL_FROM || 'Not set');
  
  if (!process.env.RESEND_API_KEY) {
    console.error('❌ RESEND_API_KEY is not set!');
    process.exit(1);
  }

  const payload = JSON.stringify({
    from: process.env.EMAIL_FROM || 'The Travel Place <onboarding@resend.dev>',
    to: ['test@example.com'], // Change this to your email
    subject: 'Test Email from Railway',
    html: '<p>This is a test email to verify Resend is working on Railway.</p>'
  });

  const options = {
    hostname: 'api.resend.com',
    port: 443,
    path: '/emails',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log('\nResponse Status:', res.statusCode);
        console.log('Response Body:', data);
        
        try {
          const response = JSON.parse(data);
          
          if (res.statusCode === 200) {
            console.log('✅ Email sent successfully!');
            console.log('Message ID:', response.id);
            resolve(response);
          } else {
            console.error('❌ Resend API error:', response.message || response.error);
            reject(new Error(response.message || response.error));
          }
        } catch (parseError) {
          console.error('❌ Failed to parse response:', parseError.message);
          reject(parseError);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request failed:', error.message);
      reject(error);
    });

    req.setTimeout(30000);
    req.write(payload);
    req.end();
  });
};

// Run the test
testEmail()
  .then(() => {
    console.log('\n✅ Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  });
