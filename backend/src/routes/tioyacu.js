const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { listAttendance, saveAttendance } = require('../db/attendanceDb');
const { parseDate, todayDate, predictAttendance } = require('../services/predictionService');

const router = express.Router();

router.use(authMiddleware);

router.get('/attendance', (_req, res) => {
  res.json({ records: listAttendance() });
});

router.post('/attendance', (req, res) => {
  const date = parseDate(req.body?.date);
  const attendees = Number(req.body?.attendees);

  if (!date) {
    return res.status(400).json({
      error: 'La fecha es inválida. Usa el formato YYYY-MM-DD.',
    });
  }

  if (date > todayDate()) {
    return res.status(400).json({
      error: 'Solo se puede registrar asistencia de una fecha pasada o de hoy.',
    });
  }

  if (!Number.isInteger(attendees) || attendees < 0) {
    return res.status(400).json({
      error: 'La cantidad de personas debe ser un entero mayor o igual a 0.',
    });
  }

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const iso = `${date.getFullYear()}-${month}-${day}`;
  const saved = saveAttendance(iso, attendees);

  return res.json({
    date: saved.date,
    attendees: saved.attendees,
    source: 'registrado',
  });
});

router.get('/prediction', async (req, res) => {
  try {
    const result = await predictAttendance(req.query.date);
    return res.json(result);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({
      error: err.message || 'No se pudo calcular la predicción.',
    });
  }
});

module.exports = router;
