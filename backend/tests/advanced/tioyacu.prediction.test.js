const request = require('supertest');
const { createApp, loginAsDemo, authHeader } = require('../helpers');
const { clearAttendance } = require('../../src/db/attendanceDb');
const { formatDate } = require('../../src/services/predictionService');

function onWeekday(dayIndex, direction) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  const delta =
    direction > 0
      ? (7 + dayIndex - date.getDay()) % 7 || 7
      : (7 + date.getDay() - dayIndex) % 7 || 7;
  date.setDate(date.getDate() + direction * delta);
  return formatDate(date);
}

function mockForecast({ temp = 24, condition = 'Soleado', humidity = 70 } = {}) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      forecast: {
        forecastday: [
          {
            day: {
              avgtemp_c: temp,
              avghumidity: humidity,
              condition: { text: condition },
            },
          },
        ],
      },
    }),
  });
}

describe('[Avanzado] Predicción Tío Yacu', () => {
  const app = createApp();
  let token;

  beforeAll(async () => {
    token = await loginAsDemo(app);
  });

  beforeEach(() => {
    clearAttendance();
  });

  test('bloquea la predicción sin sesión', async () => {
    const res = await request(app).get('/api/v1/tioyacu/prediction?date=2026-10-04');
    expect(res.status).toBe(401);
  });

  test('predice un sábado soleado con base de días de semana', async () => {
    const wednesday = onWeekday(3, -1);
    const saturday = onWeekday(6, 1);
    await request(app)
      .post('/api/v1/tioyacu/attendance')
      .set(authHeader(token))
      .send({ date: wednesday, attendees: 100 });

    mockForecast({ temp: 24, condition: 'Soleado', humidity: 70 });

    const res = await request(app)
      .get(`/api/v1/tioyacu/prediction?date=${saturday}`)
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.estimatedAttendees).toBe(144);
    expect(res.body.advice).toBe('ir');
    expect(res.body.adviceText).toMatch(/conviene ir/i);
    expect(res.body.weather).toEqual({
      temperature: '24°C',
      condition: 'Soleado',
      humidity: '70%',
    });
    expect(res.body.reason).toMatch(/fin de semana y día soleado/i);
  });

  test('indica no ir cuando el pronóstico es lluvia', async () => {
    mockForecast({ temp: 22, condition: 'Lluvia moderada', humidity: 90 });
    const future = onWeekday(2, 1);

    const res = await request(app)
      .get(`/api/v1/tioyacu/prediction?date=${future}`)
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.advice).toBe('no ir');
    expect(res.body.adviceText).toMatch(/lluvia prevista/i);
  });

  test('una fecha pasada registrada no se vuelve a predecir', async () => {
    const past = onWeekday(1, -1);
    await request(app)
      .post('/api/v1/tioyacu/attendance')
      .set(authHeader(token))
      .send({ date: past, attendees: 77 });

    global.fetch = jest.fn();
    const res = await request(app)
      .get(`/api/v1/tioyacu/prediction?date=${past}`)
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        date: past,
        estimatedAttendees: 77,
        source: 'registrado',
      })
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
