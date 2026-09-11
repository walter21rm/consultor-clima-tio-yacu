const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createApp } = require('../src/app');

async function loginAsDemo(app) {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ username: 'admin', password: 'admin123' });

  return res.body.token;
}

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

function expiredToken() {
  return jwt.sign(
    { sub: 'admin', exp: Math.floor(Date.now() / 1000) - 60 },
    process.env.JWT_SECRET
  );
}

function mockWeatherApiOk(overrides = {}) {
  return {
    location: { name: overrides.name || 'Lima' },
    current: {
      temp_c: overrides.temp_c ?? 24.4,
      humidity: overrides.humidity ?? 60,
      condition: { text: overrides.condition || 'Despejado' },
    },
  };
}

module.exports = {
  createApp,
  loginAsDemo,
  authHeader,
  expiredToken,
  mockWeatherApiOk,
};
