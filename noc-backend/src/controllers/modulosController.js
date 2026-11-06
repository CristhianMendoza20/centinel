const db = require('../db');
const { broadcast } = require('../services/websocketService');
const http = require('http');
const { WORKER_API_KEY } = require('../config/security');

function notifyWorkerReloadModules() {
  const req = http.request({
    hostname: 'localhost',
    port: 5000,
    path: '/reload_modules',
    method: 'POST',
    headers: {
      'x-worker-key': WORKER_API_KEY || ''
    }
  });
  req.on('error', (e) => console.error('Error notificando recarga de módulos al AI worker:', e.message));
  req.end();
}

// Cache local de módulos activos en memoria para el middleware rápido
let modulosCache = {};
let lastCacheUpdate = 0;

async function refreshCache() {
  try {
    const { rows } = await db.query('SELECT clave, activo, config FROM modulos_sistema');
    const mapa = {};
    for (const r of rows) {
      mapa[r.clave] = { activo: r.activo, config: r.config || {} };
    }
    modulosCache = mapa;
    lastCacheUpdate = Date.now();
  } catch (err) {
    console.error('Error refrescando cache de módulos:', err.message);
  }
}

// Refrescar al cargar el archivo
refreshCache();

// GET /api/modulos — Lista de módulos para el frontend
async function getModulos(req, res) {
  try {
    const query = `
      SELECT m.*, u.nombre as actualizado_por_nombre 
      FROM modulos_sistema m
      LEFT JOIN usuarios u ON m.actualizado_por = u.id
      ORDER BY m.orden ASC, m.clave ASC
    `;
    const { rows } = await db.query(query);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PUT /api/modulos/:clave — Activar/desactivar o cambiar configuración (solo Admin)
async function updateModulo(req, res) {
  try {
    const { clave } = req.params;
    const { activo, config } = req.body;
    const usuarioId = req.user?.id || null;

    const updates = [];
    const values = [];
    let idx = 1;

    if (activo !== undefined) {
      updates.push(`activo = $${idx++}`);
      values.push(Boolean(activo));
    }
    if (config !== undefined) {
      updates.push(`config = $${idx++}`);
      values.push(JSON.stringify(config));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No se enviaron datos para actualizar' });
    }

    updates.push(`actualizado_por = $${idx++}`);
    values.push(usuarioId);
    updates.push(`actualizado_en = CURRENT_TIMESTAMP`);

    values.push(clave);
    const query = `
      UPDATE modulos_sistema 
      SET ${updates.join(', ')} 
      WHERE clave = $${idx} 
      RETURNING *
    `;

    const { rows } = await db.query(query, values);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Módulo no encontrado' });
    }

    const actualizado = rows[0];

    // Actualizar cache en memoria
    await refreshCache();

    // Notificar al worker de IA
    notifyWorkerReloadModules();

    // Notificar a todos los clientes frontend conectados por WebSocket
    broadcast({
      type: 'MODULOS_ACTUALIZADOS',
      payload: actualizado
    });

    res.json(actualizado);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/worker/modulos — Estado de módulos para el AI Worker
async function getWorkerModulos(req, res) {
  try {
    const { rows } = await db.query('SELECT clave, activo, config FROM modulos_sistema');
    const result = {};
    for (const r of rows) {
      result[r.clave] = {
        activo: Boolean(r.activo),
        config: r.config || {}
      };
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/sidebar/badges — Conteos en vivo para los badges del sidebar
async function getSidebarBadges(req, res) {
  try {
    const [alertasRes, presentesRes, intrusionesRes] = await Promise.all([
      db.query("SELECT COUNT(*) FROM alertas_tacticas WHERE tipo_alerta IN ('SOSPECHOSO', 'DESAPARECIDO', 'LPR')").catch(() => ({ rows: [{ count: 0 }] })),
      db.query("SELECT COUNT(*) FROM asistencia_jornadas WHERE salida IS NULL").catch(() => ({ rows: [{ count: 0 }] })),
      db.query("SELECT COUNT(*) FROM zonas_intrusiones WHERE revisada = false").catch(() => ({ rows: [{ count: 0 }] })),
    ]);

    res.json({
      alertas: parseInt(alertasRes.rows[0]?.count || 0),
      presentes: parseInt(presentesRes.rows[0]?.count || 0),
      intrusiones: parseInt(intrusionesRes.rows[0]?.count || 0)
    });
  } catch (err) {
    res.json({ alertas: 0, presentes: 0, intrusiones: 0 });
  }
}

function isModuloActivoSync(clave) {
  if (!modulosCache[clave]) return false;
  return Boolean(modulosCache[clave].activo);
}

function getModuloConfigSync(clave) {
  return modulosCache[clave]?.config || {};
}

module.exports = {
  getModulos,
  updateModulo,
  getWorkerModulos,
  getSidebarBadges,
  refreshCache,
  isModuloActivoSync,
  getModuloConfigSync
};
