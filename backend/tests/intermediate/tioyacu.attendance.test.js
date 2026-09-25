const request = require('supertest');
const { createApp, loginAsDemo, authHeader } = require('../helpers');

describe('[Intermedio] Consulta histórica Tío Yacu', () => {
  const app = createApp();
  let token;

  beforeAll(async () => {
    token = await loginAsDemo(app);
  });

  test('exige sesión para consultar una fecha', async () => {
    const res = await request(app).get('/api/v1/tioyacu/consult?date=2026-08-15');
    expect(res.status).toBe(401);
  });

  test('una fecha pasada devuelve asistencia y clima sin que el usuario los cargue', async () => {
    const time = Array.from(
      { length: 31 },
      (_, index) => `2026-08-${String(index + 1).padStart(2, '0')}`
    );
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        daily: {
          time,
          weather_code: time.map((day) => (day === '2026-08-15' ? 61 : 0)),
          temperature_2m_mean: time.map(() => 22.4),
          relative_humidity_2m_mean: time.map(() => 88),
          precipitation_sum: time.map((day) => (day === '2026-08-15' ? 12 : 0)),
        },
      }),
    });

    const res = await request(app)
      .get('/api/v1/tioyacu/consult?date=2026-08-15')
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.kind).toBe('pasado');
    expect(res.body.attendees).toBeGreaterThan(0);
    expect(res.body.attendees).toBeLessThan(31233);
    expect(res.body.weather).toEqual({
      temperature: '22°C',
      condition: 'Lluvia',
      humidity: '88%',
    });
    expect(res.body.officialMonth).toEqual(
      expect.objectContaining({ year: 2025, month: 8, visitors: 31233 })
    );
    expect(res.body.note).toMatch(/DIRCETUR/i);
  });

  test('rechaza una fecha inválida', async () => {
    const res = await request(app)
      .get('/api/v1/tioyacu/consult?date=2026-13-40')
      .set(authHeader(token));
    expect(res.status).toBe(400);
  });
});
