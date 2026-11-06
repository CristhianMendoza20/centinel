const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const DATA_DIR = path.join(__dirname, '../data');

module.exports = {
  DATA_FILE: path.join(DATA_DIR, 'data.json'),
  PERSONAS_FILE: path.join(DATA_DIR, 'personas.json'),
  DESAPARECIDOS_FILE: path.join(DATA_DIR, 'desaparecidos.json'),
  VEHICULOS_FILE: path.join(DATA_DIR, 'vehiculos.json'),
  VEHICULOS_CAPTURADOS_FILE: path.join(DATA_DIR, 'vehiculos_capturados.json'),
  PERSONAS_CAPTURADAS_FILE: path.join(DATA_DIR, 'personas_capturadas.json'),

  NOTIF_CONFIG: {
    telegram: {
      enabled: true,
      token: process.env.TELEGRAM_BOT_TOKEN || '',
      chat_id: process.env.TELEGRAM_CHAT_ID || '',
    },
    email: {
      enabled: true,
      from: process.env.EMAIL_USER || '',
      pass: process.env.EMAIL_PASS || '',
      to: process.env.EMAIL_TO || '',
    },
  }
};
