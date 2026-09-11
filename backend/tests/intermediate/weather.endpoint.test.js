const request = require('supertest');
const {
  createApp,
  loginAsDemo,
  authHeader,
  mockWeatherApiOk,
} = require('../helpers');

describe('[Intermedio] Endpoint GET /api/v1/weather', () => {
  const app = createApp();
  let token;

  beforeAll(async () => {
    token = await loginAsDemo(app);
  });

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  test('exige el query param location', async () => {
    const res = await request(app)
      .get('/api/v1/weather')
      .set(authHeader(token));

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/location/i);
  });

  test('mapea la respuesta de WeatherAPI al contrato del curso', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockWeatherApiOk({ temp_c: 24.6, humidity: 60, condition: 'Despejado' }),
    });

    const res = await request(app)
      .get('/api/v1/weather?location=Peru')
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      location: 'Lima',
      temperature: '25°C',
      condition: 'Despejado',
      humidity: '60%',
    });
  });

  test('devuelve 404 cuando WeatherAPI no encuentra la ubicación', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'No matching location found.' } }),
    });

    const res = await request(app)
      .get('/api/v1/weather?location=CiudadInventadaXYZ')
      .set(authHeader(token));

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/ubicación/i);
  });

  test('devuelve 502 cuando el proveedor externo falla', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    const res = await request(app)
      .get('/api/v1/weather?location=Peru')
      .set(authHeader(token));

    expect(res.status).toBe(502);
  });
});
