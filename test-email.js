// Test email sending
require('dotenv').config();
const nodemailer = require('nodemailer');

async function testEmail() {
  console.log('Testing email configuration...');
  console.log('EMAIL_HOST:', process.env.EMAIL_HOST);
  console.log('EMAIL_PORT:', process.env.EMAIL_PORT);
  console.log('EMAIL_SECURE:', process.env.EMAIL_SECURE);
  console.log('EMAIL_USERNAME:', process.env.EMAIL_USERNAME);
  console.log('EMAIL_FROM:', process.env.EMAIL_FROM);
  console.log('EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? '***configured***' : 'NOT SET');

  const port = parseInt(process.env.EMAIL_PORT) || 587;
  const secure = process.env.EMAIL_SECURE === 'true' || port === 465;

  console.log('\nUsing configuration:');
  console.log('Port:', port);
  console.log('Secure:', secure);

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: port,
    secure: secure,
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    debug: true, // Enable debug output
    logger: true // Log to console
  });

  try {
    console.log('\n🔍 Verifying SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully!');

    console.log('\n📧 Sending test email...');
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: process.env.EMAIL_FROM, // Send to yourself
      subject: 'Test Email - Travel Insurance System',
      html: `
        <h1>Test Email</h1>
        <p>This is a test email from your Travel Insurance booking system.</p>
        <p>If you received this, your email configuration is working correctly!</p>
        <p>Timestamp: ${new Date().toISOString()}</p>
      `
    });

    console.log('✅ Email sent successfully!');
    console.log('Message ID:', info.messageId);
    console.log('Response:', info.response);
    
  } catch (error) {
    console.error('❌ Email test failed:');
    console.error('Error:', error.message);
    console.error('Code:', error.code);
    console.error('Command:', error.command);
    
    if (error.code === 'ETIMEDOUT') {
      console.error('\n💡 Connection timeout - possible causes:');
      console.error('  1. Firewall blocking port 587');
      console.error('  2. Network restrictions');
      console.error('  3. Gmail blocking the connection');
      console.error('  4. Try using port 465 with secure: true instead');
    } else if (error.code === 'EAUTH') {
      console.error('\n💡 Authentication failed - possible causes:');
      console.error('  1. Incorrect app password');
      console.error('  2. 2-Step Verification not enabled');
      console.error('  3. App password not generated correctly');
    }
  }
}

testEmail();
