const request = require('supertest');
const { createApp, loginAsDemo, authHeader } = require('../helpers');
const { distributeMonth } = require('../../src/services/predictionService');

function futureWeekday(dayIndex) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  const delta = (7 + dayIndex - date.getDay()) % 7 || 7;
  date.setDate(date.getDate() + delta);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

describe('[Avanzado] Predicción Tío Yacu', () => {
  const app = createApp();
  let token;

  beforeAll(async () => {
    token = await loginAsDemo(app);
  });

  test('reparte el total oficial del mes entre sus días', () => {
    const days = [
      { date: new Date(2026, 7, 1), weather: { condition: 'Despejado', tempC: 24 } },
      { date: new Date(2026, 7, 2), weather: { condition: 'Lluvia', tempC: 22 } },
    ];
    const counts = distributeMonth(100, days);
    expect(counts.reduce((sum, value) => sum + value, 0)).toBe(100);
    expect(counts[0]).toBeGreaterThan(counts[1]);
  });

  test('una fecha futura con lluvia indica no ir', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        forecast: {
          forecastday: [
            {
              day: {
                avgtemp_c: 22,
                avghumidity: 90,
                condition: { text: 'Lluvia moderada' },
              },
            },
          ],
        },
      }),
    });

    const res = await request(app)
      .get(`/api/v1/tioyacu/consult?date=${futureWeekday(2)}`)
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.kind).toBe('futuro');
    expect(res.body.advice).toBe('no ir');
    expect(res.body.adviceText).toMatch(/lluvia prevista/i);
    expect(res.body.estimatedAttendees).toEqual(expect.any(Number));
  });

  test('una fecha futura soleada indica ir', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        forecast: {
          forecastday: [
            {
              day: {
                avgtemp_c: 24,
                avghumidity: 70,
                condition: { text: 'Soleado' },
              },
            },
          ],
        },
      }),
    });

    const res = await request(app)
      .get(`/api/v1/tioyacu/consult?date=${futureWeekday(3)}`)
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.advice).toBe('ir');
    expect(res.body.weather.condition).toBe('Soleado');
  });
});
