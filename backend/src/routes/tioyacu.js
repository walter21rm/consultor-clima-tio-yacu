const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { consultDate } = require('../services/predictionService');

const router = express.Router();

router.use(authMiddleware);

router.get('/consult', async (req, res) => {
  try {
    const result = await consultDate(req.query.date);
    return res.json(result);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({
      error: err.message || 'No se pudo consultar la fecha.',
    });
  }
});

module.exports = router;
