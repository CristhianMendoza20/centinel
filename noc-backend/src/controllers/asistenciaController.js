const db = require('../db');
const fs = require('fs/promises');
const path = require('path');
const http = require('http');
const { broadcast } = require('../services/websocketService');
const { isModuloActivoSync, getModuloConfigSync } = require('./modulosController');
const { WORKER_API_KEY } = require('../config/security');

const UPLOADS_DIR = path.join(__dirname, '../../uploads');

function notifyAIWorker(endpoint = '/reload_cameras') {
  const req = http.request({
    hostname: 'localhost',
    port: 5000,
    path: endpoint,
    method: 'POST',
    headers: {
      'x-worker-key': WORKER_API_KEY || ''
    }
  });
  req.on('error', (e) => console.error(`Error notifying AI worker (${endpoint}):`, e.message));
  req.end();
}

async function handleImageUpload(base64String, folderName) {
  if (!base64String || typeof base64String !== 'string' || !base64String.startsWith('data:image')) {
    return base64String;
  }
  
  try {
    const matches = base64String.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return base64String;

    const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}.${extension}`;
    const targetDir = path.join(UPLOADS_DIR, folderName);
    await fs.mkdir(targetDir, { recursive: true });
    const filePath = path.join(targetDir, fileName);
    
    await fs.writeFile(filePath, buffer);
    return `/uploads/${folderName}/${fileName}`;
  } catch (error) {
    console.error('Error guardando imagen de asistencia/empleado:', error);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
// UNIDADES CRUD
// ══════════════════════════════════════════════════════════════
async function getUnidades(req, res) {
  try {
    const { rows } = await db.query('SELECT * FROM unidades ORDER BY id ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function crearUnidad(req, res) {
  try {
    const { nombre, direccion, activa } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre de la unidad es obligatorio' });
    const { rows } = await db.query(
      'INSERT INTO unidades (nombre, direccion, activa) VALUES ($1, $2, $3) RETURNING *',
      [nombre.trim(), direccion?.trim() || null, activa !== undefined ? Boolean(activa) : true]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function actualizarUnidad(req, res) {
  try {
    const { id } = req.params;
    const { nombre, direccion, activa } = req.body;
    const { rows } = await db.query(
      `UPDATE unidades 
       SET nombre = COALESCE($1, nombre),
           direccion = COALESCE($2, direccion),
           activa = COALESCE($3, activa)
       WHERE id = $4 RETURNING *`,
      [nombre ? nombre.trim() : null, direccion !== undefined ? direccion : null, activa !== undefined ? Boolean(activa) : null, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Unidad no encontrada' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function eliminarUnidad(req, res) {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM unidades WHERE id = $1', [id]);
    res.json({ ok: true, mensaje: 'Unidad eliminada correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ══════════════════════════════════════════════════════════════
// EMPLEADOS CRUD
// ══════════════════════════════════════════════════════════════
async function getEmpleados(req, res) {
  try {
    const query = `
      SELECT e.*, u.nombre as unidad_nombre 
      FROM empleados e
      LEFT JOIN unidades u ON e.unidad_id = u.id
      WHERE e.deleted_at IS NULL
      ORDER BY e.nombre ASC
    `;
    const { rows } = await db.query(query);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function crearEmpleado(req, res) {
  try {
    const { nombre, ci, cargo, unidad_id, foto, horario_entrada, horario_salida, activo, consentimiento_biometrico } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre del empleado es obligatorio' });

    let foto_url = null;
    if (foto) {
      foto_url = await handleImageUpload(foto, 'empleados');
    }

    const { rows } = await db.query(
      `INSERT INTO empleados 
        (nombre, ci, cargo, unidad_id, foto_url, horario_entrada, horario_salida, activo, consentimiento_biometrico)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        nombre.trim(),
        ci ? ci.trim() : null,
        cargo ? cargo.trim() : null,
        unidad_id ? parseInt(unidad_id) : null,
        foto_url,
        horario_entrada || null,
        horario_salida || null,
        activo !== undefined ? Boolean(activo) : true,
        consentimiento_biometrico !== undefined ? Boolean(consentimiento_biometrico) : true
      ]
    );

    // Notificar al AI worker para que recargue rostros incluyendo este nuevo empleado
    notifyAIWorker('/reload_cameras');

    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'El CI ya se encuentra registrado por otro empleado' });
    }
    res.status(500).json({ error: err.message });
  }
}

async function actualizarEmpleado(req, res) {
  try {
    const { id } = req.params;
    const { nombre, ci, cargo, unidad_id, foto, horario_entrada, horario_salida, activo, consentimiento_biometrico } = req.body;

    let foto_url = undefined;
    if (foto && foto.startsWith('data:image')) {
      foto_url = await handleImageUpload(foto, 'empleados');
    } else if (foto !== undefined) {
      foto_url = foto;
    }

    const updates = [];
    const values = [];
    let idx = 1;

    if (nombre !== undefined) { updates.push(`nombre = $${idx++}`); values.push(nombre.trim()); }
    if (ci !== undefined) { updates.push(`ci = $${idx++}`); values.push(ci ? ci.trim() : null); }
    if (cargo !== undefined) { updates.push(`cargo = $${idx++}`); values.push(cargo ? cargo.trim() : null); }
    if (unidad_id !== undefined) { updates.push(`unidad_id = $${idx++}`); values.push(unidad_id ? parseInt(unidad_id) : null); }
    if (foto_url !== undefined) { updates.push(`foto_url = $${idx++}`); values.push(foto_url); }
    if (horario_entrada !== undefined) { updates.push(`horario_entrada = $${idx++}`); values.push(horario_entrada || null); }
    if (horario_salida !== undefined) { updates.push(`horario_salida = $${idx++}`); values.push(horario_salida || null); }
    if (activo !== undefined) { updates.push(`activo = $${idx++}`); values.push(Boolean(activo)); }
    if (consentimiento_biometrico !== undefined) { updates.push(`consentimiento_biometrico = $${idx++}`); values.push(Boolean(consentimiento_biometrico)); }

    if (updates.length === 0) return res.status(400).json({ error: 'No se enviaron datos a actualizar' });

    values.push(id);
    const query = `UPDATE empleados SET ${updates.join(', ')} WHERE id = $${idx} AND deleted_at IS NULL RETURNING *`;
    const { rows } = await db.query(query, values);

    if (rows.length === 0) return res.status(404).json({ error: 'Empleado no encontrado' });

    // Notificar al AI worker
    notifyAIWorker('/reload_cameras');

    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'El CI ya se encuentra registrado por otro empleado' });
    }
    res.status(500).json({ error: err.message });
  }
}

async function eliminarEmpleado(req, res) {
  try {
    const { id } = req.params;
    const { rows } = await db.query(
      'UPDATE empleados SET deleted_at = CURRENT_TIMESTAMP, activo = false WHERE id = $1 RETURNING *',
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Empleado no encontrado' });

    // Notificar al worker para que elimine el embedding de la memoria
    notifyAIWorker('/reload_cameras');

    res.json({ ok: true, mensaje: 'Empleado dado de baja correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ══════════════════════════════════════════════════════════════
// REGISTRO DE ASISTENCIA AUTOMÁTICO (AI WORKER)
// ══════════════════════════════════════════════════════════════
async function marcarAsistencia(req, res) {
  try {
    // 1. Validar que el módulo esté activo
    if (!isModuloActivoSync('asistencia')) {
      return res.status(403).json({ error: 'El módulo de Control de Asistencia está desactivado.' });
    }

    const { empleado_id, camara_id, confianza, foto_base64 } = req.body;
    if (!empleado_id || !camara_id) {
      return res.status(400).json({ error: 'empleado_id y camara_id son requeridos' });
    }

    // 2. Obtener datos del empleado
    const empRes = await db.query(
      'SELECT id, nombre, ci, cargo, unidad_id, activo, consentimiento_biometrico FROM empleados WHERE id = $1 AND deleted_at IS NULL',
      [empleado_id]
    );
    if (empRes.rows.length === 0) {
      return res.status(404).json({ error: 'Empleado no encontrado' });
    }
    const empleado = empRes.rows[0];

    if (!empleado.activo) {
      return res.status(400).json({ error: 'El empleado no está activo en el sistema' });
    }
    if (!empleado.consentimiento_biometrico) {
      return res.status(400).json({ error: 'El empleado no cuenta con consentimiento biométrico activo' });
    }

    // 3. Obtener datos de la cámara
    const camRes = await db.query(
      'SELECT id, nombre, rol_asistencia, unidad_id, activa FROM camaras WHERE id = $1',
      [camara_id]
    );
    if (camRes.rows.length === 0) {
      return res.status(404).json({ error: 'Cámara no encontrada' });
    }
    const camara = camRes.rows[0];

    if (!camara.activa) {
      return res.status(400).json({ error: 'La cámara está inactiva' });
    }
    if (!camara.rol_asistencia) {
      return res.status(400).json({ error: 'La cámara no tiene rol de asistencia configurado' });
    }

    const config = getModuloConfigSync('asistencia');
    const cooldownMinutos = parseInt(config.min_minutos_entre_marcas) || 5;
    const unidadEfectivaId = camara.unidad_id || empleado.unidad_id || null;

    // 4. Verificar si tiene jornada abierta
    const abiertaRes = await db.query(
      'SELECT * FROM asistencia_jornadas WHERE empleado_id = $1 AND salida IS NULL',
      [empleado_id]
    );
    const jornadaAbierta = abiertaRes.rows[0] || null;

    if (!jornadaAbierta) {
      // ── CASO A: INGRESO (ENTRADA) ──
      // Solo si la cámara permite entrada
      if (camara.rol_asistencia !== 'entrada' && camara.rol_asistencia !== 'ambas') {
        return res.status(200).json({ 
          ok: false, 
          motivo: 'CAMARA_SOLO_SALIDA',
          mensaje: 'El empleado no tiene jornada abierta y esta cámara solo registra salidas.' 
        });
      }

      // Validar cooldown respecto a la última salida (evitar marcar entrada de inmediato si acaba de salir)
      const ultimaRes = await db.query(
        'SELECT salida FROM asistencia_jornadas WHERE empleado_id = $1 ORDER BY COALESCE(salida, entrada) DESC LIMIT 1',
        [empleado_id]
      );
      if (ultimaRes.rows.length > 0 && ultimaRes.rows[0].salida) {
        const diffMin = (Date.now() - new Date(ultimaRes.rows[0].salida).getTime()) / (1000 * 60);
        if (diffMin < cooldownMinutos) {
          return res.status(200).json({ 
            ok: false, 
            motivo: 'COOLDOWN_SALIDA_RECIENTE', 
            minutos_restantes: Math.ceil(cooldownMinutos - diffMin) 
          });
        }
      }

      // Guardar foto de captura si existe
      let fotoUrl = null;
      if (foto_base64) {
        fotoUrl = await handleImageUpload(foto_base64, 'asistencia');
      }

      const insertRes = await db.query(
        `INSERT INTO asistencia_jornadas 
          (empleado_id, unidad_id, entrada, camara_entrada_id, foto_entrada_url, confianza_entrada, cierre)
         VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5, 'normal')
         RETURNING *`,
        [empleado.id, unidadEfectivaId, camara.id, fotoUrl, confianza ? parseFloat(confianza) : null]
      );
      const nuevaJornada = insertRes.rows[0];

      // WebSocket broadcast en tiempo real
      broadcast({
        type: 'ASISTENCIA_MARCA',
        data: {
          tipo: 'ENTRADA',
          jornada_id: nuevaJornada.id,
          empleado: {
            id: empleado.id,
            nombre: empleado.nombre,
            ci: empleado.ci,
            cargo: empleado.cargo
          },
          unidad_id: unidadEfectivaId,
          camara_id: camara.id,
          camara_nombre: camara.nombre,
          timestamp: nuevaJornada.entrada,
          foto_url: nuevaJornada.foto_entrada_url,
          confianza: nuevaJornada.confianza_entrada
        }
      });

      return res.status(201).json({
        ok: true,
        tipo: 'ENTRADA',
        jornada: nuevaJornada,
        mensaje: `Entrada registrada para ${empleado.nombre}`
      });

    } else {
      // ── CASO B: EGRESO (SALIDA) ──
      // Solo si la cámara permite salida
      if (camara.rol_asistencia !== 'salida' && camara.rol_asistencia !== 'ambas') {
        return res.status(200).json({ 
          ok: false, 
          motivo: 'CAMARA_SOLO_ENTRADA',
          mensaje: 'El empleado ya tiene jornada abierta y esta cámara solo registra entradas.' 
        });
      }

      // Validar cooldown respecto al momento de entrada
      const diffMin = (Date.now() - new Date(jornadaAbierta.entrada).getTime()) / (1000 * 60);
      if (diffMin < cooldownMinutos) {
        return res.status(200).json({ 
          ok: false, 
          motivo: 'COOLDOWN_ENTRADA_RECIENTE', 
          minutos_restantes: Math.ceil(cooldownMinutos - diffMin) 
        });
      }

      // Guardar foto de salida
      let fotoUrl = null;
      if (foto_base64) {
        fotoUrl = await handleImageUpload(foto_base64, 'asistencia');
      }

      const updateRes = await db.query(
        `UPDATE asistencia_jornadas 
         SET salida = CURRENT_TIMESTAMP,
             camara_salida_id = $1,
             foto_salida_url = $2,
             confianza_salida = $3,
             cierre = 'normal'
         WHERE id = $4
         RETURNING *, EXTRACT(EPOCH FROM (salida - entrada))::int as duracion_segundos`,
        [camara.id, fotoUrl, confianza ? parseFloat(confianza) : null, jornadaAbierta.id]
      );
      const jornadaCerrada = updateRes.rows[0];

      // WebSocket broadcast
      broadcast({
        type: 'ASISTENCIA_MARCA',
        data: {
          tipo: 'SALIDA',
          jornada_id: jornadaCerrada.id,
          empleado: {
            id: empleado.id,
            nombre: empleado.nombre,
            ci: empleado.ci,
            cargo: empleado.cargo
          },
          unidad_id: jornadaCerrada.unidad_id,
          camara_id: camara.id,
          camara_nombre: camara.nombre,
          timestamp: jornadaCerrada.salida,
          duracion_segundos: jornadaCerrada.duracion_segundos,
          foto_url: jornadaCerrada.foto_salida_url,
          confianza: jornadaCerrada.confianza_salida
        }
      });

      return res.json({
        ok: true,
        tipo: 'SALIDA',
        jornada: jornadaCerrada,
        mensaje: `Salida registrada para ${empleado.nombre}`
      });
    }

  } catch (err) {
    console.error('Error en marcarAsistencia:', err);
    res.status(500).json({ error: err.message });
  }
}

// ══════════════════════════════════════════════════════════════
// MONITOREO EN VIVO — EMPLEADOS PRESENTES AHORA
// ══════════════════════════════════════════════════════════════
async function getPresentes(req, res) {
  try {
    const { unidad_id } = req.query;
    let query = `
      SELECT 
        j.id as jornada_id,
        j.empleado_id,
        e.nombre as empleado_nombre,
        e.ci as empleado_ci,
        e.cargo as empleado_cargo,
        e.foto_url as empleado_foto,
        e.horario_entrada,
        e.horario_salida,
        u.id as unidad_id,
        u.nombre as unidad_nombre,
        c.nombre as camara_entrada_nombre,
        j.entrada,
        j.foto_entrada_url,
        j.confianza_entrada,
        EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - j.entrada))::int as segundos_transcurridos
      FROM asistencia_jornadas j
      JOIN empleados e ON j.empleado_id = e.id
      LEFT JOIN unidades u ON j.unidad_id = u.id
      LEFT JOIN camaras c ON j.camara_entrada_id = c.id
      WHERE j.salida IS NULL AND e.deleted_at IS NULL
    `;
    const params = [];
    if (unidad_id) {
      params.push(parseInt(unidad_id));
      query += ` AND j.unidad_id = $${params.length}`;
    }
    query += ` ORDER BY j.entrada DESC`;

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ══════════════════════════════════════════════════════════════
// HISTORIAL DE JORNADAS CON FILTROS Y PAGINACIÓN
// ══════════════════════════════════════════════════════════════
async function getJornadas(req, res) {
  try {
    const { desde, hasta, empleado_id, unidad_id, cierre, estado, limit = 50, offset = 0 } = req.query;

    let whereClauses = ['e.deleted_at IS NULL'];
    const params = [];

    if (desde) {
      params.push(desde);
      whereClauses.push(`j.entrada >= $${params.length}`);
    }
    if (hasta) {
      params.push(hasta);
      whereClauses.push(`j.entrada <= $${params.length}::timestamp + interval '1 day'`);
    }
    if (empleado_id) {
      params.push(parseInt(empleado_id));
      whereClauses.push(`j.empleado_id = $${params.length}`);
    }
    if (unidad_id) {
      params.push(parseInt(unidad_id));
      whereClauses.push(`j.unidad_id = $${params.length}`);
    }
    if (cierre) {
      params.push(cierre);
      whereClauses.push(`j.cierre = $${params.length}`);
    }
    if (estado === 'abierta') {
      whereClauses.push('j.salida IS NULL');
    } else if (estado === 'cerrada') {
      whereClauses.push('j.salida IS NULL IS FALSE');
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Conteo total
    const countRes = await db.query(
      `SELECT COUNT(*) FROM asistencia_jornadas j JOIN empleados e ON j.empleado_id = e.id ${whereStr}`,
      params
    );
    const total = parseInt(countRes.rows[0].count);

    // Registros
    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;
    params.push(parseInt(limit), parseInt(offset));

    const dataQuery = `
      SELECT 
        j.id,
        j.empleado_id,
        e.nombre as empleado_nombre,
        e.ci as empleado_ci,
        e.cargo as empleado_cargo,
        e.foto_url as empleado_foto,
        e.horario_entrada,
        e.horario_salida,
        u.id as unidad_id,
        u.nombre as unidad_nombre,
        ce.nombre as camara_entrada_nombre,
        cs.nombre as camara_salida_nombre,
        j.entrada,
        j.salida,
        j.foto_entrada_url,
        j.foto_salida_url,
        j.confianza_entrada,
        j.confianza_salida,
        j.cierre,
        j.observacion,
        EXTRACT(EPOCH FROM (COALESCE(j.salida, CURRENT_TIMESTAMP) - j.entrada))::int as duracion_segundos
      FROM asistencia_jornadas j
      JOIN empleados e ON j.empleado_id = e.id
      LEFT JOIN unidades u ON j.unidad_id = u.id
      LEFT JOIN camaras ce ON j.camara_entrada_id = ce.id
      LEFT JOIN camaras cs ON j.camara_salida_id = cs.id
      ${whereStr}
      ORDER BY j.entrada DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const { rows } = await db.query(dataQuery, params);
    res.json({ total, jornadas: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ══════════════════════════════════════════════════════════════
// AJUSTE MANUAL POR PARTE DEL ADMINISTRADOR
// ══════════════════════════════════════════════════════════════
async function marcarManual(req, res) {
  try {
    const { accion, jornada_id, empleado_id, unidad_id, entrada, salida, observacion } = req.body;

    if (accion === 'cerrar_jornada') {
      if (!jornada_id) return res.status(400).json({ error: 'jornada_id es requerido para cerrar jornada' });
      const fechaSalida = salida ? new Date(salida) : new Date();

      const { rows } = await db.query(
        `UPDATE asistencia_jornadas 
         SET salida = $1, cierre = 'manual', observacion = COALESCE($2, 'Cierre manual por administrador')
         WHERE id = $3 AND salida IS NULL
         RETURNING *, EXTRACT(EPOCH FROM (salida - entrada))::int as duracion_segundos`,
        [fechaSalida, observacion || null, jornada_id]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Jornada no encontrada o ya cerrada' });

      broadcast({
        type: 'ASISTENCIA_MARCA',
        data: {
          tipo: 'SALIDA_MANUAL',
          jornada_id: rows[0].id,
          empleado_id: rows[0].empleado_id,
          timestamp: rows[0].salida,
          duracion_segundos: rows[0].duracion_segundos
        }
      });

      return res.json({ ok: true, jornada: rows[0], mensaje: 'Jornada cerrada manualmente con éxito' });

    } else if (accion === 'crear_manual') {
      if (!empleado_id || !entrada) {
        return res.status(400).json({ error: 'empleado_id y fecha/hora de entrada son requeridos' });
      }

      // Si no viene salida y hay una jornada abierta, lanzar error
      if (!salida) {
        const abierta = await db.query('SELECT id FROM asistencia_jornadas WHERE empleado_id = $1 AND salida IS NULL', [empleado_id]);
        if (abierta.rows.length > 0) {
          return res.status(400).json({ error: 'El empleado ya cuenta con una jornada abierta. Ciérrela primero.' });
        }
      }

      const { rows } = await db.query(
        `INSERT INTO asistencia_jornadas 
          (empleado_id, unidad_id, entrada, salida, cierre, observacion)
         VALUES ($1, $2, $3, $4, 'manual', $5)
         RETURNING *, EXTRACT(EPOCH FROM (COALESCE(salida, CURRENT_TIMESTAMP) - entrada))::int as duracion_segundos`,
        [empleado_id, unidad_id || null, new Date(entrada), salida ? new Date(salida) : null, observacion || 'Registro manual de administrador']
      );

      return res.status(201).json({ ok: true, jornada: rows[0], mensaje: 'Jornada creada manualmente' });

    } else if (accion === 'editar_jornada') {
      if (!jornada_id) return res.status(400).json({ error: 'jornada_id es requerido' });

      const updates = [];
      const values = [];
      let idx = 1;

      if (entrada) { updates.push(`entrada = $${idx++}`); values.push(new Date(entrada)); }
      if (salida !== undefined) { updates.push(`salida = $${idx++}`); values.push(salida ? new Date(salida) : null); }
      if (observacion !== undefined) { updates.push(`observacion = $${idx++}`); values.push(observacion); }
      updates.push(`cierre = 'manual'`);

      values.push(jornada_id);
      const query = `UPDATE asistencia_jornadas SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`;
      const { rows } = await db.query(query, values);
      if (rows.length === 0) return res.status(404).json({ error: 'Jornada no encontrada' });

      return res.json({ ok: true, jornada: rows[0], mensaje: 'Jornada actualizada con éxito' });

    } else {
      return res.status(400).json({ error: 'Acción no soportada (usar cerrar_jornada, crear_manual o editar_jornada)' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ══════════════════════════════════════════════════════════════
// RESUMEN Y MÉTRICAS DE ASISTENCIA
// ══════════════════════════════════════════════════════════════
async function getResumen(req, res) {
  try {
    const config = getModuloConfigSync('asistencia');
    const toleranciaMin = parseInt(config.tolerancia_tardanza_min) || 10;

    // 1. Empleados presentes ahora
    const presentesRes = await db.query(
      'SELECT COUNT(*) FROM asistencia_jornadas WHERE salida IS NULL'
    );
    const totalPresentes = parseInt(presentesRes.rows[0].count);

    // 2. Total empleados activos
    const empTotalRes = await db.query(
      'SELECT COUNT(*) FROM empleados WHERE activo = true AND deleted_at IS NULL'
    );
    const totalEmpleadosActivos = parseInt(empTotalRes.rows[0].count);

    // 3. Entradas y Salidas hoy
    const hoyRes = await db.query(`
      SELECT 
        COUNT(CASE WHEN entrada >= CURRENT_DATE THEN 1 END) as entradas_hoy,
        COUNT(CASE WHEN salida >= CURRENT_DATE THEN 1 END) as salidas_hoy
      FROM asistencia_jornadas
    `);

    // 4. Tardanzas hoy (comparando hora entrada con e.horario_entrada + tolerancia)
    const tardanzasRes = await db.query(`
      SELECT COUNT(*) as tardanzas_hoy
      FROM asistencia_jornadas j
      JOIN empleados e ON j.empleado_id = e.id
      WHERE j.entrada >= CURRENT_DATE 
        AND e.horario_entrada IS NOT NULL
        AND j.entrada::time > (e.horario_entrada + ($1 || ' minutes')::interval)
    `, [toleranciaMin]);
    const tardanzasHoy = parseInt(tardanzasRes.rows[0].tardanzas_hoy);

    // 5. Ranking o resumen por empleado en los últimos 30 días
    const rankingRes = await db.query(`
      SELECT 
        e.id,
        e.nombre,
        e.cargo,
        e.foto_url,
        COUNT(j.id) as total_jornadas,
        COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(j.salida, CURRENT_TIMESTAMP) - j.entrada)) / 3600), 0)::numeric(10,2) as total_horas,
        COUNT(CASE 
          WHEN e.horario_entrada IS NOT NULL 
           AND j.entrada::time > (e.horario_entrada + ($1 || ' minutes')::interval) 
          THEN 1 
        END) as tardanzas
      FROM empleados e
      LEFT JOIN asistencia_jornadas j ON e.id = j.empleado_id AND j.entrada >= CURRENT_DATE - INTERVAL '30 days'
      WHERE e.deleted_at IS NULL AND e.activo = true
      GROUP BY e.id, e.nombre, e.cargo, e.foto_url
      ORDER BY total_horas DESC
      LIMIT 20
    `, [toleranciaMin]);

    res.json({
      presentes_ahora: totalPresentes,
      empleados_activos: totalEmpleadosActivos,
      entradas_hoy: parseInt(hoyRes.rows[0].entradas_hoy),
      salidas_hoy: parseInt(hoyRes.rows[0].salidas_hoy),
      tardanzas_hoy: tardanzasHoy,
      ranking_empleados: rankingRes.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ══════════════════════════════════════════════════════════════
// EXPORTACIÓN A CSV
// ══════════════════════════════════════════════════════════════
async function getJornadasCSV(req, res) {
  try {
    const { desde, hasta, unidad_id } = req.query;
    let whereClauses = ['e.deleted_at IS NULL'];
    const params = [];

    if (desde) {
      params.push(desde);
      whereClauses.push(`j.entrada >= $${params.length}`);
    }
    if (hasta) {
      params.push(hasta);
      whereClauses.push(`j.entrada <= $${params.length}::timestamp + interval '1 day'`);
    }
    if (unidad_id) {
      params.push(parseInt(unidad_id));
      whereClauses.push(`j.unidad_id = $${params.length}`);
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const query = `
      SELECT 
        j.id,
        e.nombre as empleado_nombre,
        e.ci as empleado_ci,
        e.cargo as empleado_cargo,
        COALESCE(u.nombre, 'Sin Unidad') as unidad,
        TO_CHAR(j.entrada, 'YYYY-MM-DD HH24:MI:SS') as entrada,
        TO_CHAR(j.salida, 'YYYY-MM-DD HH24:MI:SS') as salida,
        ROUND((EXTRACT(EPOCH FROM (COALESCE(j.salida, CURRENT_TIMESTAMP) - j.entrada)) / 3600)::numeric, 2) as horas,
        j.cierre,
        COALESCE(ce.nombre, 'Manual') as camara_entrada,
        COALESCE(cs.nombre, 'Manual') as camara_salida,
        COALESCE(j.observacion, '') as observacion
      FROM asistencia_jornadas j
      JOIN empleados e ON j.empleado_id = e.id
      LEFT JOIN unidades u ON j.unidad_id = u.id
      LEFT JOIN camaras ce ON j.camara_entrada_id = ce.id
      LEFT JOIN camaras cs ON j.camara_salida_id = cs.id
      ${whereStr}
      ORDER BY j.entrada DESC
    `;

    const { rows } = await db.query(query, params);

    // Encabezados CSV
    const headers = ['ID', 'Empleado', 'CI', 'Cargo', 'Unidad', 'Entrada', 'Salida', 'Horas', 'Cierre', 'Camara Entrada', 'Camara Salida', 'Observacion'];
    const csvLines = [headers.join(',')];

    for (const r of rows) {
      const line = [
        r.id,
        `"${(r.empleado_nombre || '').replace(/"/g, '""')}"`,
        `"${(r.empleado_ci || '').replace(/"/g, '""')}"`,
        `"${(r.empleado_cargo || '').replace(/"/g, '""')}"`,
        `"${(r.unidad || '').replace(/"/g, '""')}"`,
        `"${r.entrada || ''}"`,
        `"${r.salida || 'EN CURSO'}"`,
        r.horas || '0',
        `"${r.cierre || 'normal'}"`,
        `"${(r.camara_entrada || '').replace(/"/g, '""')}"`,
        `"${(r.camara_salida || '').replace(/"/g, '""')}"`,
        `"${(r.observacion || '').replace(/"/g, '""')}"`
      ];
      csvLines.push(line.join(','));
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="asistencia_${Date.now()}.csv"`);
    res.send('\uFEFF' + csvLines.join('\n'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ══════════════════════════════════════════════════════════════
// CIERRE AUTOMÁTICO DE JORNADAS HUÉRFANAS / NOCTURNAS
// ══════════════════════════════════════════════════════════════
async function ejecutarCierreAutomatico() {
  try {
    if (!isModuloActivoSync('asistencia')) return;

    const config = getModuloConfigSync('asistencia');
    // Cerrar jornadas que lleven más de 16 horas abiertas o que hayan iniciado el día anterior
    const query = `
      UPDATE asistencia_jornadas
      SET salida = entrada + INTERVAL '8 hours',
          cierre = 'automatico',
          observacion = 'Cierre automático por límite de tiempo de turno'
      WHERE salida IS NULL
        AND (entrada < CURRENT_DATE OR entrada < CURRENT_TIMESTAMP - INTERVAL '16 hours')
      RETURNING id, empleado_id
    `;
    const { rows } = await db.query(query);
    if (rows.length > 0) {
      console.log(`[ASISTENCIA] Cierre automático ejecutado para ${rows.length} jornadas pendientes.`);
    }
  } catch (err) {
    console.error('[ASISTENCIA] Error en cierre automático:', err.message);
  }
}

// Programar verificación periódica cada 10 minutos
setInterval(ejecutarCierreAutomatico, 10 * 60 * 1000);

module.exports = {
  getUnidades,
  crearUnidad,
  actualizarUnidad,
  eliminarUnidad,
  getEmpleados,
  crearEmpleado,
  actualizarEmpleado,
  eliminarEmpleado,
  marcarAsistencia,
  getPresentes,
  getJornadas,
  marcarManual,
  getResumen,
  getJornadasCSV,
  ejecutarCierreAutomatico
};
