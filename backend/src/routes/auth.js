const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};

  const demoUser = process.env.DEMO_USER || 'admin';
  const demoPassword = process.env.DEMO_PASSWORD || 'admin123';

  if (!username || !password) {
    return res.status(400).json({
      error: 'Usuario y contraseña son requeridos.',
    });
  }

  if (username !== demoUser || password !== demoPassword) {
    return res.status(401).json({
      error: 'Credenciales inválidas.',
    });
  }

  const token = jwt.sign(
    { sub: username, role: 'user' },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  return res.json({ token });
});

module.exports = router;
