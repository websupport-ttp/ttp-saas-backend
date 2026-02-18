// Test email service
require('dotenv').config({ path: './.env' });
const { sendEmail } = require('./v1/utils/emailService');

async function testEmail() {
  try {
    console.log('Testing email service...');
    console.log('Email config:', {
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      username: process.env.EMAIL_USERNAME,
      from: process.env.EMAIL_FROM
    });
    
    await sendEmail({
      to: 'opeyemioladejobi@gmail.com',
      subject: 'Test Email - Flight Booking System',
      html: `
        <h2>Test Email</h2>
        <p>This is a test email to verify the email service is working.</p>
        <p>If you receive this, the email service is configured correctly.</p>
        <p>Time: ${new Date().toISOString()}</p>
      `
    });
    
    console.log('✅ Email sent successfully!');
  } catch (error) {
    console.error('❌ Email failed:', error.message);
    console.error('Full error:', error);
  }
}

testEmail();