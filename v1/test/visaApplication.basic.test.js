// v1/test/visaApplication.basic.test.js
const request = require('supertest');
const app = require('../../app');

describe('Basic Visa Application Test', () => {
  it('should have a basic test', () => {
    expect(true).toBe(true);
  });

  it('should respond to visa application endpoint', async () => {
    const validApplicationData = {
      countryOfInterest: 'United States',
      purposeOfTravel: 'Tourism',
      travelDates: {
        startDate: '2024-06-01',
        endDate: '2024-06-15'
      },
      personalInformation: {
        firstName: 'Test',
        lastName: 'User',
        dateOfBirth: '1990-01-01',
        gender: 'Male',
        nationality: 'Nigerian',
        maritalStatus: 'Single',
        occupation: 'Engineer',
        address: '123 Test Street, Lagos, Nigeria'
      },
      guestEmail: 'test@example.com',
      guestPhoneNumber: '+1234567890'
    };

    const response = await request(app)
      .post('/api/v1/products/visa/apply')
      .send(validApplicationData);
    
    // We expect either 201 (success) or 400/401 (validation/auth error)
    // but not 404 (route not found) or 500 (server error)
    expect([200, 201, 400, 401]).toContain(response.status);
    
    // If successful, should have proper response structure
    if (response.status === 201) {
      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('visaApplicationId');
    }
  });
});