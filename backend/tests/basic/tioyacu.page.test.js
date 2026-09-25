const request = require('supertest');
const { createApp } = require('../helpers');

describe('[Básico] Vista Tío Yacu', () => {
  const app = createApp();

  test('sirve la consulta por fecha, sin registro manual', async () => {
    const res = await request(app).get('/tioyacu.html');

    expect(res.status).toBe(200);
    expect(res.text).toContain('Tío Yacu');
    expect(res.text).toContain('Consultar');
    expect(res.text).toContain('place-slide');
    expect(res.text).toContain('CC BY-SA 4.0');
    expect(res.text).not.toContain('Registrar asistencia');
  });
});
