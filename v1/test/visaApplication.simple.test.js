// Simple test to check if visa application endpoints are working
const request = require('supertest');
const app = require('../../app');

describe('Simple Visa Application Test', () => {
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

  it('should handle invalid visa application data', async () => {
    const invalidData = {
      countryOfInterest: 'US', // Too short
      purposeOfTravel: '', // Empty
      guestEmail: 'invalid-email', // Invalid format
      guestPhoneNumber: '123' // Too short
    };

    const response = await request(app)
      .post('/api/v1/products/visa/apply')
      .send(invalidData);
    
    // Should return validation error
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('status', 'fail');
  });

  it('should check visa status endpoint exists', async () => {
    // Use a mock ID to test if the route exists
    const mockId = '507f1f77bcf86cd799439011';
    
    const response = await request(app)
      .get(`/api/v1/products/visa/${mockId}`)
      .send();
    
    // Should not return 404 (route not found)
    // Will likely return 401 (unauthorized) or 404 (application not found)
    expect(response.status).not.toBe(404);
  });

  it('should check document upload endpoint exists', async () => {
    // Use a mock ID to test if the route exists
    const mockId = '507f1f77bcf86cd799439011';
    
    const response = await request(app)
      .post(`/api/v1/products/visa/${mockId}/upload-document`)
      .send();
    
    // Should not return 404 (route not found)
    // Will likely return 401 (unauthorized) or 400 (validation error)
    expect(response.status).not.toBe(404);
  });

  it('should check status update endpoint exists', async () => {
    // Use a mock ID to test if the route exists
    const mockId = '507f1f77bcf86cd799439011';
    
    const response = await request(app)
      .put(`/api/v1/products/visa/${mockId}/status`)
      .send({ status: 'Approved' });
    
    // Should not return 404 (route not found)
    // Will likely return 401 (unauthorized) or 403 (forbidden)
    expect(response.status).not.toBe(404);
  });
});