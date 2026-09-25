const request = require('supertest');
const { createApp } = require('../helpers');

describe('[Básico] Vista Tío Yacu', () => {
  const app = createApp();

  test('sirve la página de asistencia y predicción', async () => {
    const res = await request(app).get('/tioyacu.html');

    expect(res.status).toBe(200);
    expect(res.text).toContain('Tío Yacu');
    expect(res.text).toContain('Registrar asistencia');
    expect(res.text).toContain('Predecir');
  });
});
