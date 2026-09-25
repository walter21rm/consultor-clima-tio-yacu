const request = require('supertest');
const { createApp, loginAsDemo, authHeader } = require('../helpers');
const { clearAttendance } = require('../../src/db/attendanceDb');
const { formatDate } = require('../../src/services/predictionService');

function shiftDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

describe('[Intermedio] Asistencia Tío Yacu', () => {
  const app = createApp();
  let token;

  beforeAll(async () => {
    token = await loginAsDemo(app);
  });

  beforeEach(() => {
    clearAttendance();
  });

  test('exige sesión para registrar y listar', async () => {
    const post = await request(app)
      .post('/api/v1/tioyacu/attendance')
      .send({ date: shiftDays(-1), attendees: 10 });
    const list = await request(app).get('/api/v1/tioyacu/attendance');

    expect(post.status).toBe(401);
    expect(list.status).toBe(401);
  });

  test('registra una fecha pasada y la lista de más reciente a más antigua', async () => {
    const older = shiftDays(-10);
    const newer = shiftDays(-1);

    const first = await request(app)
      .post('/api/v1/tioyacu/attendance')
      .set(authHeader(token))
      .send({ date: older, attendees: 40 });
    const second = await request(app)
      .post('/api/v1/tioyacu/attendance')
      .set(authHeader(token))
      .send({ date: newer, attendees: 90 });

    expect(first.status).toBe(200);
    expect(second.body).toEqual({
      date: newer,
      attendees: 90,
      source: 'registrado',
    });

    const list = await request(app)
      .get('/api/v1/tioyacu/attendance')
      .set(authHeader(token));

    expect(list.body.records.map((item) => item.date)).toEqual([newer, older]);
  });

  test('actualiza la asistencia si la fecha ya existe', async () => {
    const date = shiftDays(-3);
    await request(app)
      .post('/api/v1/tioyacu/attendance')
      .set(authHeader(token))
      .send({ date, attendees: 10 });

    const updated = await request(app)
      .post('/api/v1/tioyacu/attendance')
      .set(authHeader(token))
      .send({ date, attendees: 55 });

    expect(updated.status).toBe(200);
    expect(updated.body.attendees).toBe(55);

    const list = await request(app)
      .get('/api/v1/tioyacu/attendance')
      .set(authHeader(token));
    expect(list.body.records).toHaveLength(1);
  });

  test('rechaza una fecha futura y una cantidad inválida', async () => {
    const future = await request(app)
      .post('/api/v1/tioyacu/attendance')
      .set(authHeader(token))
      .send({ date: shiftDays(3), attendees: 10 });
    const invalid = await request(app)
      .post('/api/v1/tioyacu/attendance')
      .set(authHeader(token))
      .send({ date: shiftDays(-1), attendees: -4 });

    expect(future.status).toBe(400);
    expect(invalid.status).toBe(400);
  });
});
