const nodemailer = require('nodemailer');
const fsSync = require('fs');
const { NOTIF_CONFIG } = require('../config/constants');

async function notifEmail(asunto, cuerpoHTML, fotoLocalPath) {
  const { enabled, from, pass, to } = NOTIF_CONFIG.email;
  if (!enabled || !from || !pass || !to) { 
    return; 
  }
  
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: from, pass },
    });
    
    const mailOptions = {
      from: `"CENTINEL" <${from}>`,
      to,
      subject: asunto,
      html: cuerpoHTML,
    };

    if (fotoLocalPath && fsSync.existsSync(fotoLocalPath)) {
      mailOptions.attachments = [{
        filename: 'alerta.jpg',
        path: fotoLocalPath,
        cid: 'foto_alerta' // Se usará en el HTML como src="cid:foto_alerta"
      }];
    }

    await transporter.sendMail(mailOptions);
    console.log('📧 Email → 200 OK');
  } catch (err) {
    console.error('❌ Email error:', err.message);
  }
}

module.exports = { notifEmail };
