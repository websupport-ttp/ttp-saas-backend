// v1/test/debug.health.test.js
const request = require('supertest');
const app = require('../../app');

describe('Debug Health Endpoint', () => {
  test('should debug health endpoint response', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    console.log('Health endpoint response:', JSON.stringify(response.body, null, 2));
    console.log('Response headers:', response.headers);
  });

  test('should debug health system endpoint response', async () => {
    const response = await request(app)
      .get('/health/system')
      .expect(200);

    console.log('Health system endpoint response:', JSON.stringify(response.body, null, 2));
  });

  test('should debug health liveness endpoint response', async () => {
    const response = await request(app)
      .get('/health/liveness')
      .expect(200);

    console.log('Health liveness endpoint response:', JSON.stringify(response.body, null, 2));
  });
});