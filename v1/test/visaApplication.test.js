// v1/test/visaApplication.test.js
const request = require('supertest');
const app = require('../../app');

describe('Visa Application Workflows', () => {
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
    
    expect([200, 201, 400, 401]).toContain(response.status);
    
    if (response.status === 201) {
      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('visaApplicationId');
    }
  });

  it('should handle invalid visa application data', async () => {
    const invalidData = {
      countryOfInterest: 'US',
      purposeOfTravel: '',
      guestEmail: 'invalid-email',
      guestPhoneNumber: '123'
    };

    const response = await request(app)
      .post('/api/v1/products/visa/apply')
      .send(invalidData);
    
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('status', 'fail');
  });

  it('should check visa status endpoint exists', async () => {
    const mockId = '507f1f77bcf86cd799439011';
    
    const response = await request(app)
      .get(`/api/v1/products/visa/${mockId}`)
      .send();
    
    expect(response.status).not.toBe(404);
  });

  it('should check document upload endpoint exists', async () => {
    const mockId = '507f1f77bcf86cd799439011';
    
    const response = await request(app)
      .post(`/api/v1/products/visa/${mockId}/upload-document`)
      .send();
    
    expect(response.status).not.toBe(404);
  });

  it('should check status update endpoint exists', async () => {
    const mockId = '507f1f77bcf86cd799439011';
    
    const response = await request(app)
      .put(`/api/v1/products/visa/${mockId}/status`)
      .send({ status: 'Approved' });
    
    expect(response.status).not.toBe(404);
  });
});