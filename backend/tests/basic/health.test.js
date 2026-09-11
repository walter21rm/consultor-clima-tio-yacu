const request = require('supertest');
const { createApp } = require('../helpers');

describe('[Básico] Health y archivos estáticos', () => {
  const app = createApp();

  test('GET /api/v1/health responde status ok', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  test('sirve la página de login (index.html)', async () => {
    const res = await request(app).get('/index.html');

    expect(res.status).toBe(200);
    expect(res.text).toContain('Consultor de Clima');
    expect(res.text).toContain('Iniciar sesión');
  });

  test('sirve la página de consulta (weather.html)', async () => {
    const res = await request(app).get('/weather.html');

    expect(res.status).toBe(200);
    expect(res.text).toContain('Consultar');
    expect(res.text).toContain('País o región');
  });
});
