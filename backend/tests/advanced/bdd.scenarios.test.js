const request = require('supertest');
const {
  createApp,
  authHeader,
  mockWeatherApiOk,
} = require('../helpers');

/**
 * Escenarios BDD del curso (Gherkin → pruebas automatizadas).
 */
describe('[Avanzado] Escenarios BDD', () => {
  const app = createApp();

  test('Escenario 1: consulta exitosa del clima para un país seleccionado', async () => {
    // Dado que el usuario se encuentra logueado
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' });

    expect(login.status).toBe(200);
    const token = login.body.token;

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () =>
        mockWeatherApiOk({
          name: 'Lima',
          temp_c: 23,
          humidity: 64,
          condition: 'Parcialmente nublado',
        }),
    });

    // Cuando selecciona un país y consulta
    const weather = await request(app)
      .get('/api/v1/weather?location=Peru')
      .set(authHeader(token));

    // Entonces el sistema muestra los datos del clima
    expect(weather.status).toBe(200);
    expect(weather.body.location).toBe('Lima');
    expect(weather.body.temperature).toBe('23°C');
    expect(weather.body.condition).toBe('Parcialmente nublado');
    expect(weather.body.humidity).toBe('64%');
  });

  test('Escenario 2: intento de consulta sin sesión activa', async () => {
    // Dado un usuario sin autenticar
    // Cuando intenta realizar una consulta
    const res = await request(app).get('/api/v1/weather?location=Peru');

    // Entonces el sistema bloquea la acción
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  test('flujo completo login → varias ubicaciones → contrato estable', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' });

    const token = login.body.token;
    const locations = ['Mexico', 'Spain', 'Argentina'];

    for (const location of locations) {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () =>
          mockWeatherApiOk({
            name: location,
            temp_c: 18,
            humidity: 50,
            condition: 'Nublado',
          }),
      });

      const res = await request(app)
        .get(`/api/v1/weather?location=${encodeURIComponent(location)}`)
        .set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        expect.objectContaining({
          location: expect.any(String),
          temperature: expect.stringMatching(/°C$/),
          condition: expect.any(String),
          humidity: expect.stringMatching(/%$/),
        })
      );
    }
  });
});
