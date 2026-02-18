// Discover Amadeus XML service structure
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function discoverAmadeusStructure() {
  console.log('🔍 Discovering Amadeus Service Structure...\n');
  
  const baseUrl = 'http://amadeusws.tripxml.com';
  
  // Test different paths
  const paths = [
    '/',
    '/tripxml',
    '/tripxml/webservice',
    '/webservice',
    '/services',
    '/soap',
    '/api',
    '/wsdl'
  ];
  
  console.log('🌐 Testing base paths...');
  
  for (const testPath of paths) {
    try {
      const url = `${baseUrl}${testPath}`;
      console.log(`\n🔍 Testing: ${url}`);
      
      const response = await axios.get(url, { 
        timeout: 10000,
        headers: {
          'User-Agent': 'TTP-AmadeusXML-Discovery/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });
      
      console.log(`✅ Status: ${response.status}`);
      console.log(`✅ Content-Type: ${response.headers['content-type']}`);
      console.log(`✅ Content-Length: ${response.headers['content-length'] || 'N/A'}`);
      
      // Look for service links in the response
      const content = response.data.toLowerCase();
      
      if (content.includes('wsdl')) {
        console.log('🎯 WSDL references found!');
        const wsdlMatches = response.data.match(/href=[\"']([^\"']*wsdl[^\"']*)[\"']/gi);
        if (wsdlMatches) {
          wsdlMatches.forEach(match => {
            console.log(`  📄 ${match}`);
          });
        }
      }
      
      if (content.includes('asmx')) {
        console.log('🎯 ASMX services found!');
        const asmxMatches = response.data.match(/href=[\"']([^\"']*\\.asmx[^\"']*)[\"']/gi);
        if (asmxMatches) {
          asmxMatches.forEach(match => {
            console.log(`  🔧 ${match}`);
          });
        }
      }
      
      if (content.includes('service')) {
        console.log('🎯 Service references found!');
      }
      
      // Look for directory listings
      if (content.includes('directory') || content.includes('index of')) {
        console.log('📁 Directory listing detected');
      }
      
      // Show first 500 characters if it's HTML
      if (response.headers['content-type']?.includes('text/html')) {
        console.log('📄 Content preview:');
        console.log(response.data.substring(0, 500) + '...');
      }
      
    } catch (error) {
      console.error(`❌ ${baseUrl}${testPath}: ${error.message}`);
      
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        
        // Check if it's a redirect
        if (error.response.status >= 300 && error.response.status < 400) {
          const location = error.response.headers.location;
          if (location) {
            console.log(`🔄 Redirects to: ${location}`);
          }
        }
      }
    }
  }
}

async function testAlternativeEndpoints() {
  console.log('\n🔍 Testing Alternative Amadeus Endpoints...\n');
  
  // Common Amadeus XML service patterns
  const alternativeEndpoints = [
    'http://webservices.amadeus.com',
    'http://xml.amadeus.com',
    'http://api.amadeus.com/xml',
    'https://webservices.amadeus.com',
    'https://xml.amadeus.com',
    'http://amadeusws.tripxml.com:8080',
    'http://amadeusws.tripxml.com/api',
    'http://amadeusws.tripxml.com/xml',
    'http://tripxml.com/webservice',
    'http://www.tripxml.com/webservice'
  ];
  
  for (const endpoint of alternativeEndpoints) {
    try {
      console.log(`🔍 Testing: ${endpoint}`);
      
      const response = await axios.get(endpoint, { 
        timeout: 8000,
        headers: {
          'User-Agent': 'TTP-AmadeusXML-Discovery/1.0'
        }
      });
      
      console.log(`✅ ${endpoint} - Status: ${response.status}`);
      
      if (response.data.includes('wsdl') || response.data.includes('asmx')) {
        console.log('🎯 Potential service endpoint found!');
      }
      
    } catch (error) {
      console.error(`❌ ${endpoint}: ${error.message}`);
    }
  }
}

async function checkDNSResolution() {
  console.log('\n🌐 Checking DNS Resolution...\n');
  
  const domains = [
    'amadeusws.tripxml.com',
    'tripxml.com',
    'webservices.amadeus.com',
    'xml.amadeus.com'
  ];
  
  const dns = require('dns').promises;
  
  for (const domain of domains) {
    try {
      console.log(`🔍 Resolving: ${domain}`);
      const addresses = await dns.resolve4(domain);
      console.log(`✅ ${domain} resolves to: ${addresses.join(', ')}`);
    } catch (error) {
      console.error(`❌ ${domain}: ${error.message}`);
    }
  }
}

async function runDiscovery() {
  console.log('🚀 Starting Amadeus Service Discovery...\n');
  
  await checkDNSResolution();
  await discoverAmadeusStructure();
  await testAlternativeEndpoints();
  
  console.log('\n📋 Discovery Summary:');
  console.log('💡 Look for any successful endpoints above');
  console.log('💡 Check for WSDL or ASMX service references');
  console.log('💡 Contact Amadeus support (Rastko) with these results');
  console.log('💡 The endpoint URL might have changed or require different authentication');
}

if (require.main === module) {
  runDiscovery().catch(console.error);
}

module.exports = { discoverAmadeusStructure };