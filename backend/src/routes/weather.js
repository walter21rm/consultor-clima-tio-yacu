const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { getWeatherByLocation } = require('../services/weatherService');

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  const location = (req.query.location || '').trim();

  if (!location) {
    return res.status(400).json({
      error: 'El parámetro location es requerido.',
    });
  }

  try {
    const weather = await getWeatherByLocation(location);
    return res.json(weather);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({
      error: err.message || 'Error interno al consultar el clima.',
    });
  }
});

module.exports = router;
