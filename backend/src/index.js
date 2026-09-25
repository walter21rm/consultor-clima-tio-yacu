const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { createApp } = require('./app');

const app = createApp();
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Consultor de clima escuchando en http://0.0.0.0:${PORT}`);
});
