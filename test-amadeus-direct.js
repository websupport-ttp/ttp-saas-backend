// Direct test of Amadeus XML SOAP service
const soap = require('soap');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function testAmadeusDirectConnection() {
  try {
    console.log('🔍 Testing Direct Amadeus XML Connection...\n');
    
    const config = {
      endpoint: process.env.AMADEUS_XML_ENDPOINT,
      username: process.env.AMADEUS_XML_USERNAME,
      password: process.env.AMADEUS_XML_PASSWORD,
      officeId: process.env.AMADEUS_XML_OFFICE_ID
    };
    
    console.log('📋 Configuration:');
    console.log('- Endpoint:', config.endpoint);
    console.log('- Username:', config.username);
    console.log('- Password:', config.password ? '***' : 'NOT SET');
    console.log('- Office ID:', config.officeId);
    
    if (!config.endpoint || !config.username || !config.password || !config.officeId) {
      console.error('❌ Missing required configuration');
      return false;
    }
    
    console.log('\n🔌 Creating SOAP Client...');
    
    const soapOptions = {
      timeout: 30000,
      connection_timeout: 30000,
      forceSoap12Headers: false,
      preserveWhitespace: true,
      strict: false,
      ignoreBaseNameSpaces: false,
      request: {
        timeout: 30000,
        headers: {
          'User-Agent': 'TTP-AmadeusXML-Test/1.0',
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': ''
        }
      }
    };
    
    const client = await soap.createClientAsync(config.endpoint, soapOptions);
    
    console.log('✅ SOAP Client Created Successfully');
    
    // Set Basic Authentication
    client.setSecurity(new soap.BasicAuthSecurity(config.username, config.password));
    console.log('✅ Basic Authentication Set');
    
    // List available methods
    console.log('\n📋 Available SOAP Methods:');
    const methods = Object.keys(client.describe());
    methods.forEach(method => {
      console.log(`- ${method}`);
    });
    
    // Try a simple method call (if available)
    if (methods.includes('Security_Authenticate')) {
      console.log('\n🔐 Testing Authentication...');
      
      const authRequest = {
        userIdentifier: {
          originIdentification: {
            sourceOffice: config.officeId,
            originatorTypeCode: 'U'
          },
          originatorTypeCode: 'U',
          originator: config.username
        },
        dutyCode: {
          dutyCodeDetails: {
            referenceQualifier: 'DUT',
            referenceIdentifier: 'SU'
          }
        },
        systemDetails: {
          organizationDetails: {
            organizationId: config.officeId
          }
        }
      };
      
      try {
        const authResponse = await client.Security_AuthenticateAsync(authRequest);
        console.log('✅ Authentication Successful!');
        console.log('📄 Response:', JSON.stringify(authResponse, null, 2));
        return true;
      } catch (authError) {
        console.error('❌ Authentication Failed:', authError.message);
        if (authError.response) {
          console.error('📄 Response:', authError.response);
        }
        return false;
      }
    } else {
      console.log('⚠️  Security_Authenticate method not found');
      console.log('💡 This might be normal - some Amadeus endpoints use different authentication');
      return true;
    }
    
  } catch (error) {
    console.error('❌ Direct Connection Test Failed:');
    console.error('❌ Error:', error.message);
    
    if (error.code) {
      console.error('❌ Error Code:', error.code);
    }
    
    if (error.response) {
      console.error('❌ Response:', error.response);
    }
    
    return false;
  }
}

async function testEndpointConnectivity() {
  try {
    console.log('\n🌐 Testing Endpoint Connectivity...');
    
    const axios = require('axios');
    const endpoint = process.env.AMADEUS_XML_ENDPOINT;
    
    const response = await axios.get(endpoint, { timeout: 10000 });
    console.log('✅ Endpoint is accessible');
    console.log('📊 Status:', response.status);
    console.log('📄 Content-Type:', response.headers['content-type']);
    
    return true;
  } catch (error) {
    console.error('❌ Endpoint connectivity failed:', error.message);
    
    if (error.code === 'ENOTFOUND') {
      console.error('💡 DNS resolution failed - check internet connection');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('💡 Connection refused - endpoint might be down');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('💡 Connection timeout - network or firewall issue');
    }
    
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting Direct Amadeus XML Tests...\n');
  
  const connectivityOk = await testEndpointConnectivity();
  const connectionOk = await testAmadeusDirectConnection();
  
  console.log('\n📋 Test Results:');
  console.log(`- Endpoint Connectivity: ${connectivityOk ? '✅ OK' : '❌ Failed'}`);
  console.log(`- SOAP Connection: ${connectionOk ? '✅ OK' : '❌ Failed'}`);
  
  if (connectivityOk && connectionOk) {
    console.log('\n🎉 Amadeus XML connection is working!');
    console.log('💡 The issue might be in the service implementation or error handling');
  } else {
    console.log('\n⚠️  Connection issues detected');
    console.log('💡 Check network connectivity and Amadeus credentials');
  }
}

if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testAmadeusDirectConnection };