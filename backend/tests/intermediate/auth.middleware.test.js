const request = require('supertest');
const jwt = require('jsonwebtoken');
const {
  createApp,
  loginAsDemo,
  authHeader,
  expiredToken,
} = require('../helpers');

describe('[Intermedio] Middleware JWT', () => {
  const app = createApp();

  test('bloquea consulta de clima sin Authorization', async () => {
    const res = await request(app).get('/api/v1/weather?location=Peru');

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/no autorizado|token/i);
  });

  test('bloquea token mal formado', async () => {
    const res = await request(app)
      .get('/api/v1/weather?location=Peru')
      .set(authHeader('no-es-un-jwt'));

    expect(res.status).toBe(401);
  });

  test('bloquea token expirado', async () => {
    const res = await request(app)
      .get('/api/v1/weather?location=Peru')
      .set(authHeader(expiredToken()));

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/inválido|expirado/i);
  });

  test('acepta token JWT válido emitido por login', async () => {
    const token = await loginAsDemo(app);
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    expect(payload.sub).toBe('admin');

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        location: { name: 'Lima' },
        current: {
          temp_c: 22,
          humidity: 64,
          condition: { text: 'Nublado' },
        },
      }),
    });

    const res = await request(app)
      .get('/api/v1/weather?location=Peru')
      .set(authHeader(token));

    expect(res.status).toBe(200);
  });
});
