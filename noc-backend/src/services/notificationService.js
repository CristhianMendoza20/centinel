const path = require('path');
const fsSync = require('fs');
const { notifTelegram } = require('./telegramService');
const { notifEmail } = require('./emailService');

async function enviarNotificaciones(alerta) {
  const esDesap = alerta.tipo_alerta === 'DESAPARECIDO';
  const esLPR = alerta.tipo_alerta === 'LPR';

  let tipo, nombre, confianza, camara, fechaHora;

  if (esLPR) {
    tipo = '🚗 VEHÍCULO EN LISTA NEGRA DETECTADO';
    nombre = `Placa: ${alerta.nombre || 'N/D'}`;
    confianza = parseFloat(alerta.nivel_confianza || 0).toFixed(1);
    camara = alerta.ubicacion_camara || 'Cámara no identificada';
    fechaHora = new Date(alerta.fecha_hora).toLocaleString('es-BO');
  } else {
    tipo = esDesap ? '🔍 PERSONA DESAPARECIDA LOCALIZADA' : '🚨 SOSPECHOSO DETECTADO';
    nombre = alerta.nombre || 'Desconocido';
    confianza = parseFloat(alerta.nivel_confianza || 0).toFixed(1);
    camara = alerta.ubicacion_camara || 'Cámara no identificada';
    fechaHora = new Date(alerta.fecha_hora).toLocaleString('es-BO');
  }

  let localFotoPath = null;
  if (alerta.foto_captura) {
    if (alerta.foto_captura.startsWith('/uploads/')) {
      localFotoPath = path.join(__dirname, '../../', alerta.foto_captura.replace(/^\//, ''));
    } else {
      const r = alerta.foto_captura.split('/capturas/')[1];
      if (r) {
        localFotoPath = path.join(__dirname, '../../../noc-ai-worker/capturas', r);
      }
    }
  }


  // Mensaje Telegram (HTML)
  let msgTelegram;
  if (esLPR) {
    msgTelegram =
      `<b>${tipo}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🚗 <b>Placa:</b> ${alerta.nombre || 'N/D'}\n` +
      `🏎️ <b>Tipo:</b> ${alerta.tipo_vehiculo || 'Vehículo'}\n` +
      `📡 <b>Precisión IA:</b> ${confianza}%\n` +
      `📷 <b>Cámara:</b> ${camara}\n` +
      `🕐 <b>Hora:</b> ${fechaHora}` +
      (alerta.contacto_referencia ? `\n📞 <b>Contacto:</b> ${alerta.contacto_referencia}` : '');
  } else {
    msgTelegram =
      `<b>${tipo}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 <b>Sujeto:</b> ${nombre}\n` +
      (alerta.ropa ? `👕 <b>Ropa:</b> ${alerta.ropa}\n` : '') +
      `📡 <b>Precisión IA:</b> ${confianza}%\n` +
      `📷 <b>Cámara:</b> ${camara}\n` +
      `🕐 <b>Hora:</b> ${fechaHora}`;
  }

  // Email HTML
  const color = esLPR ? '#d97706' : esDesap ? '#0891b2' : '#dc2626';
  const extraRows = esLPR ? `
          <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px;">Tipo Vehículo</td>
              <td style="padding:8px 0;font-size:14px;">${alerta.tipo_vehiculo || 'Vehículo'}</td></tr>
          ${alerta.contacto_referencia ? `<tr><td style="padding:8px 0;color:#94a3b8;font-size:13px;">Contacto</td>
              <td style="padding:8px 0;font-size:14px;">${alerta.contacto_referencia}</td></tr>` : ''}
  ` : alerta.ropa ? `
          <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px;">Ropa Detectada</td>
              <td style="padding:8px 0;font-size:14px;">${alerta.ropa}</td></tr>
  ` : '';
  
  const imgHtml = localFotoPath ? `<div style="text-align:center;margin-bottom:16px;"><img src="cid:foto_alerta" style="max-width:100%;border-radius:8px;border:1px solid #1e3a5f;" /></div>` : '';

  const msgEmail = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#0b1525;color:#e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="background:${color};padding:16px 24px;">
        <h2 style="margin:0;font-size:18px;color:#fff;">${tipo}</h2>
      </div>
      <div style="padding:24px;">
        ${imgHtml}
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px;width:120px;">${esLPR ? 'Placa' : 'Sujeto'}</td>
              <td style="padding:8px 0;font-weight:bold;font-size:14px;">${esLPR ? (alerta.nombre || 'N/D') : nombre}</td></tr>
          <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px;">Precisión IA</td>
              <td style="padding:8px 0;font-size:14px;">${confianza}%</td></tr>
          <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px;">Cámara</td>
              <td style="padding:8px 0;font-size:14px;">${camara}</td></tr>
          <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px;">Fecha / Hora</td>
              <td style="padding:8px 0;font-size:14px;">${fechaHora}</td></tr>
          ${extraRows}
        </table>
        <p style="margin-top:20px;font-size:11px;color:#475569;border-top:1px solid #1e3a5f;padding-top:12px;">
          Sistema CENTINEL — Bolivia · Mensaje automático, no responder.
        </p>
      </div>
    </div>`;

  await Promise.all([
    notifTelegram(msgTelegram, localFotoPath),
    notifEmail(
      `[CENTINEL] ${tipo} — ${esLPR ? (alerta.nombre || 'Placa') : nombre}`,
      msgEmail,
      localFotoPath
    )
  ]);
  console.log('✅ Notificaciones enviadas correctamente');
}

module.exports = { enviarNotificaciones };
