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

  test('sin location consulta todas las partes de Perú', async () => {
    global.fetch.mockImplementation(async (url) => {
      const query = decodeURIComponent(String(url)).match(/[?&]q=([^&]+)/)?.[1] || 'Lima';
      const city = query.split(',')[0].trim();
      return {
        ok: true,
        status: 200,
        json: async () =>
          mockWeatherApiOk({
            name: city,
            region: city,
            country: 'Peru',
            temp_c: 22,
            humidity: 64,
            condition: 'Nublado',
            localtime: '2026-09-22 08:00',
          }),
      };
    });

    const res = await request(app).get('/api/v1/weather').set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.location).toBe('Perú');
    expect(res.body.cities.length).toBeGreaterThanOrEqual(20);
  });

  test('mapea la respuesta de WeatherAPI al contrato del curso', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () =>
        mockWeatherApiOk({
          name: 'Madrid',
          region: 'Madrid',
          country: 'Spain',
          temp_c: 24.6,
          humidity: 60,
          condition: 'Despejado',
        }),
    });

    const res = await request(app)
      .get('/api/v1/weather?location=Spain')
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        location: 'Madrid',
        city: 'Madrid',
        region: 'Madrid',
        country: 'Spain',
        temperature: '25°C',
        condition: 'Despejado',
        humidity: '60%',
      })
    );
  });

  test('identifica ciudades de Perú y devuelve el clima de cada una', async () => {
    global.fetch.mockImplementation(async (url) => {
      const query = decodeURIComponent(String(url)).match(/[?&]q=([^&]+)/)?.[1] || '';
      const city = query.split(',')[0].trim();
      return {
        ok: true,
        status: 200,
        json: async () =>
          mockWeatherApiOk({
            name: city,
            region: city,
            country: 'Peru',
            temp_c: 22,
            humidity: 64,
            condition: 'Nublado',
          }),
      };
    });

    const res = await request(app)
      .get('/api/v1/weather?location=Peru')
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.location).toBe('Perú');
    expect(res.body.cities.length).toBeGreaterThanOrEqual(8);
    expect(res.body.cities.every((item) => /peru/i.test(item.country))).toBe(true);
    expect(res.body.cities[0]).toEqual(
      expect.objectContaining({
        city: expect.any(String),
        location: expect.any(String),
        temperature: expect.stringMatching(/°C$/),
        condition: expect.any(String),
        humidity: expect.stringMatching(/%$/),
      })
    );
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
