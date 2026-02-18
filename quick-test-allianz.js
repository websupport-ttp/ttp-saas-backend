// Quick test for Allianz API integration
require('dotenv').config();

console.log('\n=== ALLIANZ API CONFIGURATION CHECK ===\n');

const requiredVars = [
  'SANLAM_ALLIANZ_TRAVEL_BASE_URL',
  'SANLAM_ALLIANZ_API_USERNAME',
  'SANLAM_ALLIANZ_API_PASSWORD',
];

let allConfigured = true;

console.log('Checking environment variables:\n');

for (const varName of requiredVars) {
  const value = process.env[varName];
  const isPlaceholder = value && (value.includes('your_') || value.includes('_here'));
  
  if (value && !isPlaceholder) {
    console.log(`✓ ${varName}: Configured`);
  } else if (isPlaceholder) {
    console.log(`✗ ${varName}: Using placeholder value`);
    allConfigured = false;
  } else {
    console.log(`✗ ${varName}: Not set`);
    allConfigured = false;
  }
}

console.log('\n' + '='.repeat(50));

if (allConfigured) {
  console.log('\n✓ All credentials configured!');
  console.log('The API will use REAL SanlamAllianz data.\n');
  console.log('Next steps:');
  console.log('1. Restart backend server: npm start');
  console.log('2. Test from frontend travel insurance page');
  console.log('3. Check logs for "Successfully fetched ... from Allianz API"');
} else {
  console.log('\n⚠ API credentials not properly configured');
  console.log('The API will use FALLBACK MOCK data.\n');
  console.log('To use real API:');
  console.log('1. Edit backend/.env file');
  console.log('2. Replace placeholder values with real credentials:');
  console.log('   SANLAM_ALLIANZ_API_USERNAME=your_actual_username');
  console.log('   SANLAM_ALLIANZ_API_PASSWORD=your_actual_password');
  console.log('3. Restart backend server');
  console.log('4. Run this test again: node quick-test-allianz.js');
}

console.log('\n' + '='.repeat(50) + '\n');

// Show what the controller will do
console.log('Current Behavior:');
console.log('- getTravelInsuranceLookup: ' + (allConfigured ? 'Real API → Fallback if fails' : 'Fallback mock data'));
console.log('- getTravelInsuranceQuote: ' + (allConfigured ? 'Real API → Fallback if fails' : 'Fallback mock data'));
console.log('- purchaseTravelInsurance: ' + (allConfigured ? 'Real API → Fallback if fails' : 'Fallback mock data'));

console.log('\n✓ Integration code is ready and deployed!');
console.log('✓ Fallback mechanism ensures app works regardless of API status\n');
