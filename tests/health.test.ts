import request from 'supertest';
import app from '../src/app';

describe('Health Check Endpoint', () => {
  it('should return 200 and status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('status', 'ok');
  });
});
