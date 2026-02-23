// Quick test for phone validation
const phoneRegex = /^\+?[0-9]{7,15}$/;

const testNumbers = [
  '+2348189273082',
  '08189273082',
  '2348189273082',
  '+23408189273082', // This should fail (too long)
  '123456', // This should fail (too short)
  'abc123456789', // This should fail (contains letters)
];

console.log('Testing phone validation regex: /^\\+?[0-9]{7,15}$/\n');

testNumbers.forEach(number => {
  const isValid = phoneRegex.test(number);
  console.log(`${number.padEnd(20)} - ${isValid ? '✓ VALID' : '✗ INVALID'} (length: ${number.replace(/\+/, '').length})`);
});
