const https = require('https');
const fsSync = require('fs');
const FormData = require('form-data');
const { NOTIF_CONFIG } = require('../config/constants');

async function notifTelegram(mensaje, fotoLocalPath) {
  const { enabled, token, chat_id } = NOTIF_CONFIG.telegram;
  if (!enabled || !token || !chat_id) return;

  if (fotoLocalPath && fsSync.existsSync(fotoLocalPath)) {
    const form = new FormData();
    form.append('chat_id', chat_id);
    form.append('caption', mensaje.replace(/<[^>]+>/g, ''));
    form.append('photo', fsSync.createReadStream(fotoLocalPath));

    return new Promise((resolve) => {
      form.submit(`https://api.telegram.org/bot${token}/sendPhoto`, (err, res) => {
        if (err) console.error('❌ Telegram error:', err.message);
        else console.log(`✈️  Telegram (Foto) → ${res.statusCode}`);
        resolve();
      });
    });
  } else {
    const body = JSON.stringify({ chat_id, text: mensaje, parse_mode: 'HTML' });
    return new Promise((resolve) => {
      const options = {
        hostname: 'api.telegram.org',
        path: `/bot${token}/sendMessage`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      };
      const req = https.request(options, res => {
        console.log(`✈️  Telegram → ${res.statusCode}`);
        resolve();
      });
      req.on('error', e => { console.error('❌ Telegram error:', e.message); resolve(); });
      req.write(body);
      req.end();
    });
  }
}

module.exports = { notifTelegram };
