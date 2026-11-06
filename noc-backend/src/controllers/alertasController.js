const db = require('../db');
const path = require('path');
const fs = require('fs/promises');
const { broadcast } = require('../services/websocketService');
const { enviarNotificaciones } = require('../services/notificationService');
const { isModuloActivoSync } = require('./modulosController');

const UPLOADS_DIR = path.join(__dirname, '../../uploads');

async function handleImageUpload(base64String, folderName) {
  if (!base64String || !base64String.startsWith('data:image')) return base64String;
  try {
    const matches = base64String.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches.length !== 3) return base64String;
    const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    const fileName = `${Date.now()}-${Math.round(Math.random()*1E9)}.${extension}`;
    const targetDir = path.join(UPLOADS_DIR, folderName);
    await fs.mkdir(targetDir, { recursive: true });
    const filePath = path.join(targetDir, fileName);
    await fs.writeFile(filePath, buffer);
    return `/uploads/${folderName}/${fileName}`;
  } catch (error) {
    console.error('Error guardando imagen:', error);
    return null;
  }
}

// Migraciones automáticas
db.query("ALTER TABLE alertas_tacticas ADD COLUMN IF NOT EXISTS nombre_captura VARCHAR(255)").catch(() => {});
db.query("ALTER TABLE alertas_tacticas ALTER COLUMN foto_evidencia_url DROP NOT NULL").catch(() => {});
// Para recuperar el nombre de la cámara al recargar (camara_id ya existe en el esquema base)
db.query("ALTER TABLE alertas_tacticas ADD COLUMN IF NOT EXISTS camara_id INT REFERENCES camaras(id) ON DELETE SET NULL").catch(() => {});

async function getAlertas(req, res) {
  try {
    const { rows } = await db.query(`
      SELECT a.*, c.nombre as ubicacion_camara 
      FROM alertas_tacticas a
      LEFT JOIN camaras c ON a.camara_id = c.id
      ORDER BY a.fecha_hora_deteccion DESC 
      LIMIT 100
    `);

    // Adaptar formato devuelto para compatibilidad con el MVP Frontend
    const adaptadas = rows.map(r => ({
      id: r.id,
      tipo_alerta: r.tipo_alerta,
      nivel_confianza: r.nivel_confianza,
      ubicacion_camara: r.ubicacion_camara || 'Cámara Remota',
      fecha_hora: r.fecha_hora_deteccion,
      foto_captura: r.foto_evidencia_url,
      // MVP asume nombre dentro de la alerta
      nombre: r.nombre_captura || (r.objetivo_referencia_id ? `Objetivo ID: ${r.objetivo_referencia_id}` : 'Desconocido') 
    }));

    res.json(adaptadas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function postAlerta(req, res) {
  try {
    const nuevaAlerta = { ...req.body, fecha_hora: new Date().toISOString() };

    // Verificación de módulos activos para evitar procesar alertas huérfanas
    if (nuevaAlerta.tipo_alerta === 'LPR' && !isModuloActivoSync('reconocimiento_placas')) {
      return res.status(202).json({ ok: false, razon: 'modulo_reconocimiento_placas_desactivado' });
    }
    if ((nuevaAlerta.tipo_alerta === 'SOSPECHOSO' || nuevaAlerta.tipo_alerta === 'DESAPARECIDO') && !isModuloActivoSync('reconocimiento_facial')) {
      return res.status(202).json({ ok: false, razon: 'modulo_reconocimiento_facial_desactivado' });
    }

    // ═══════════════════════════════════════════════════════════
    // ⚡ PASO 1: DISPARAR SIRENA AL FRONTEND *INMEDIATAMENTE*
    //    Antes de guardar en DB, antes de notificaciones externas.
    //    Esto garantiza latencia cero en la alerta visual/sonora.
    // ═══════════════════════════════════════════════════════════
    broadcast({ type: 'NUEVA_ALERTA', payload: nuevaAlerta });

    // Log táctico en consola
    const esDesap = nuevaAlerta.tipo_alerta === 'DESAPARECIDO';
    const esLPR = nuevaAlerta.tipo_alerta === 'LPR';
    if (esLPR) {
      console.log(`\n🚗 [CENTINEL ALERTA] VEHÍCULO EN LISTA NEGRA DETECTADO`);
      console.log(`   ➔ Placa: ${nuevaAlerta.nombre}`);
      console.log(`   ➔ Precisión IA: ${parseFloat(nuevaAlerta.nivel_confianza || 0).toFixed(1)}%`);
      console.log(`   ➔ Ubicación: ${nuevaAlerta.ubicacion_camara || 'Cámara no identificada'}`);
      console.log('');
    } else {
      console.log(esDesap
        ? `\n🔍 [CENTINEL ALERTA] PERSONA DESAPARECIDA LOCALIZADA`
        : `\n🚨 [CENTINEL ALERTA] INTRUSIÓN DETECTADA / SOSPECHOSO`
      );
      console.log(`   ➔ Objetivo Buscado: ${nuevaAlerta.nombre}`);
      console.log(`   ➔ Precisión IA: ${parseFloat(nuevaAlerta.nivel_confianza || 0).toFixed(1)}%`);
      console.log(`   ➔ Ubicación: ${nuevaAlerta.ubicacion_camara || 'Cámara no identificada'}\n`);
    }

    // PASO 2: Guardar imagen en disco (tolerante a fallos)
    let foto_url = null;
    try {
      // Las alertas LPR envían la imagen en `foto`; las faciales en `foto_captura`
      foto_url = await handleImageUpload(nuevaAlerta.foto_captura || nuevaAlerta.foto, 'alertas');
    } catch (imgErr) {
      console.error('⚠️ Error guardando imagen de alerta:', imgErr.message);
    }

    // PASO 3: Guardar en DB (tolerante a fallos — la alerta ya sonó)
    try {
      const insertQuery = `
        INSERT INTO alertas_tacticas 
        (tipo_alerta, nivel_confianza, foto_evidencia_url, nombre_captura, camara_id) 
        VALUES ($1, $2, $3, $4, $5) RETURNING id, fecha_hora_deteccion
      `;
      const camaraId = parseInt(nuevaAlerta.camara_id, 10);
      const { rows } = await db.query(insertQuery, [
        nuevaAlerta.tipo_alerta, 
        nuevaAlerta.nivel_confianza, 
        foto_url,
        nuevaAlerta.nombre,
        Number.isInteger(camaraId) ? camaraId : null
      ]);
      nuevaAlerta.id = rows[0].id;
      nuevaAlerta.fecha_hora = rows[0].fecha_hora_deteccion;
      nuevaAlerta.foto_captura = foto_url;
    } catch (dbErr) {
      console.error('⚠️ Error guardando alerta en DB (la sirena ya sonó):', dbErr.message);
    }

    // PASO 4: Telegram + Gmail en background (sin bloquear)
    enviarNotificaciones(nuevaAlerta).catch(e => console.error('Error notificaciones:', e));

    res.status(201).json(nuevaAlerta);
  } catch (err) {
    console.error('Error crítico en postAlerta:', err);
    res.status(500).json({ error: err.message });
  }
}

async function notificarManual(req, res) {
  try {
    const { id } = req.params;
    const { rows } = await db.query(`
      SELECT a.*, c.nombre as ubicacion_camara 
      FROM alertas_tacticas a
      LEFT JOIN camaras c ON a.camara_id = c.id
      WHERE a.id = $1
    `, [id]);
    
    if (rows.length === 0) return res.status(404).json({ error: 'Alerta no encontrada' });
    
    const r = rows[0];
    const alerta = {
      id: r.id,
      tipo_alerta: r.tipo_alerta,
      nivel_confianza: r.nivel_confianza,
      ubicacion_camara: r.ubicacion_camara || 'Cámara Remota',
      fecha_hora: r.fecha_hora_deteccion,
      foto_captura: r.foto_evidencia_url,
      nombre: r.nombre_captura || (r.objetivo_referencia_id ? `Objetivo ID: ${r.objetivo_referencia_id}` : 'Desconocido') 
    };

    enviarNotificaciones(alerta).catch(e => console.error('Error notificaciones:', e));
    res.json({ ok: true, mensaje: 'Notificación enviada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getAlertas, postAlerta, notificarManual };
