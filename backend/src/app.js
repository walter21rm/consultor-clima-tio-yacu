const path = require('path');
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const weatherRoutes = require('./routes/weather');
const tioyacuRoutes = require('./routes/tioyacu');

function createApp() {
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'dev_secret_solo_local';
  }

  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', '..', 'frontend')));

  app.get('/api/v1/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/weather', weatherRoutes);
  app.use('/api/v1/tioyacu', tioyacuRoutes);

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  });

  return app;
}

module.exports = { createApp };
