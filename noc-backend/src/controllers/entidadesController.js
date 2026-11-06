const db = require('../db');
const fs = require('fs/promises');
const path = require('path');
const { broadcast } = require('../services/websocketService');
const http = require('http');

const { WORKER_API_KEY } = require('../config/security');

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

// Directorio base para subidas (relativo a la carpeta del proyecto)
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// Función auxiliar para procesar imágenes Base64
async function handleImageUpload(base64String, folderName) {
  if (!base64String || !base64String.startsWith('data:image')) {
    return base64String; // No es base64 o está vacío, podría ser una URL ya existente o null
  }
  
  try {
    const matches = base64String.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return base64String;

    const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    const fileName = `${Date.now()}-${Math.round(Math.random()*1E9)}.${extension}`;
    const targetDir = path.join(UPLOADS_DIR, folderName);
    
    // Asegurar que la carpeta existe
    await fs.mkdir(targetDir, { recursive: true });
    
    const filePath = path.join(targetDir, fileName);
    
    // Guardar archivo físico
    await fs.writeFile(filePath, buffer);
    
    // Retornar la ruta relativa que se guardará en la base de datos
    return `/uploads/${folderName}/${fileName}`;
  } catch (error) {
    console.error('Error guardando imagen:', error);
    return null;
  }
}

// Configuración de Mapeo de Entidades a Tablas y Nombres de Carpetas
const tableMapping = {
  'personas': { table: 'sujetos_interes', folder: 'personas' },
  'desaparecidos': { table: 'personas_desaparecidas', folder: 'personas' },
  'vehiculos': { table: 'vehiculos_lpr', folder: 'vehiculos' },
  'camaras': { table: 'camaras', folder: null },
  // Tablas que originalmente eran solo arrays in-memory (historiales locales)
  'vehiculos_capturados': { table: 'alertas_tacticas' },
  'personas_capturadas': { table: 'alertas_tacticas' }
};

function createCrudController(entityType, broadcastTypeNuevo = null) {
  return {
    async getAll(req, res) {
      try {
        const mapping = tableMapping[entityType];
        if (!mapping || !mapping.table) return res.json([]);
        
        // Simular lógica para historiales (en el MVP eran vehiculos_capturados)
        if (entityType === 'vehiculos_capturados' || entityType === 'personas_capturadas') {
          const tipo = entityType === 'vehiculos_capturados' ? 'LPR' : 'SOSPECHOSO';
          const inClause = entityType === 'personas_capturadas' ? "('SOSPECHOSO', 'DESAPARECIDO')" : "('LPR')";
          
          const { rows } = await db.query(`
            SELECT a.*, c.nombre as ubicacion_camara,
                   COALESCE(s.foto_url, d.foto_url, v.foto_url) as foto_registrada
            FROM alertas_tacticas a 
            LEFT JOIN camaras c ON a.camara_id = c.id
            LEFT JOIN sujetos_interes s ON s.nombre = a.nombre_captura AND a.tipo_alerta = 'SOSPECHOSO'
            LEFT JOIN personas_desaparecidas d ON d.nombre = a.nombre_captura AND a.tipo_alerta = 'DESAPARECIDO'
            LEFT JOIN vehiculos_lpr v ON v.placa = a.nombre_captura AND a.tipo_alerta = 'LPR'
            WHERE a.tipo_alerta IN ${inClause} 
            ORDER BY a.fecha_hora_deteccion DESC LIMIT 100
          `);
          
          if (entityType === 'vehiculos_capturados') {
             return res.json(rows.map(r => ({
                id_vehiculo: r.id,
                tipo_vehiculo: 'Vehículo',
                placa: r.nombre_captura || r.objetivo_referencia_id || 'No detectada',
                nivel_confianza: r.nivel_confianza,
                foto_vehiculo: r.foto_evidencia_url,
                foto_placa: r.foto_evidencia_url,
                foto_registrada: r.foto_registrada,
                foto_contexto: r.foto_evidencia_url,
                ubicacion_camara: r.ubicacion_camara || 'Desconocida',
                fecha_hora: r.fecha_hora_deteccion
             })));
          } else {
             return res.json(rows.map(r => ({
                id_persona: r.id,
                nombre: r.nombre_captura || r.objetivo_referencia_id || 'Desconocido',
                tipo: r.tipo_alerta.toLowerCase(),
                nivel_confianza: r.nivel_confianza,
                foto_persona: r.foto_evidencia_url,
                foto_rostro: r.foto_evidencia_url,
                foto_registrada: r.foto_registrada,
                foto_contexto: r.foto_evidencia_url,
                ubicacion_camara: r.ubicacion_camara || 'Desconocida',
                fecha_hora: r.fecha_hora_deteccion
             })));
          }
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 100;
        const offset = (page - 1) * limit;

        let queryStr = `SELECT * FROM ${mapping.table}`;
        
        // Soft Deletes (ignorar camaras)
        if (entityType !== 'camaras' && entityType !== 'vehiculos_capturados' && entityType !== 'personas_capturadas') {
          queryStr += ` WHERE deleted_at IS NULL`;
        }
        
        queryStr += ` ORDER BY id DESC LIMIT $1 OFFSET $2`;

        const { rows } = await db.query(queryStr, [limit, offset]);
        
        // Adaptar campos de la base de datos (foto_url) al formato que espera el frontend MVP (foto)
        const adaptados = rows.map(r => {
          const item = { ...r, foto: r.foto_url || r.foto_evidencia_url };
          if (entityType === 'personas') {
            item.peligrosidad = r.nivel_riesgo;
          }
          // Aliases para compatibilidad con el frontend (nombres cortos)
          if (entityType === 'desaparecidos') {
            item.contacto = r.contacto_familiar;
            item.rasgos = r.rasgos_distintivos;
            item.ropa = r.ropa_visto_ultima_vez;
          }
          if (entityType === 'vehiculos') {
            item.tipo = r.tipo_vehiculo;
            item.antecedentes = r.infracciones;
            item.contacto = r.contacto_referencia;
          }
          return item;
        });

        res.json(adaptados);
      } catch (err) { res.status(500).json({ error: err.message }); }
    },
    async create(req, res) {
      try {
        const mapping = tableMapping[entityType];
        if (!mapping) return res.status(400).json({ error: 'Entidad no soportada' });

        const body = { ...req.body };
        
        // Manejar subida de foto
        let foto_url = null;
        if (body.foto && mapping.folder) {
          foto_url = await handleImageUpload(body.foto, mapping.folder);
        }

        let query = '';
        let values = [];
        let nuevo = {};

        if (entityType === 'personas') {
          const { rows: desapRows } = await db.query(`SELECT id FROM personas_desaparecidas WHERE nombre = $1 AND deleted_at IS NULL`, [body.nombre]);
          if (desapRows.length > 0) {
            return res.status(400).json({ error: 'Persona ya registrada en el módulo de Desaparecidos' });
          }
          query = `INSERT INTO sujetos_interes (nombre, alias, ci, nivel_riesgo, antecedentes, foto_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`;
          values = [body.nombre, body.alias, body.ci, body.peligrosidad || 'Baja', body.antecedentes, foto_url];
        } else if (entityType === 'desaparecidos') {
          const { rows: sujRows } = await db.query(`SELECT id FROM sujetos_interes WHERE nombre = $1 AND deleted_at IS NULL`, [body.nombre]);
          if (sujRows.length > 0) {
             return res.status(400).json({ error: 'Persona ya registrada en el módulo de Sujetos de Interés' });
          }
          query = `INSERT INTO personas_desaparecidas (nombre, contacto_familiar, fecha_desaparicion, rasgos_distintivos, ropa_visto_ultima_vez, foto_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`;
          values = [body.nombre, body.contacto_familiar || body.contacto, body.fecha_desaparicion, body.rasgos_distintivos || body.rasgos, body.ropa_visto_ultima_vez || body.ropa, foto_url];
        } else if (entityType === 'vehiculos') {
          query = `INSERT INTO vehiculos_lpr (placa, ruat, tipo_vehiculo, contacto_referencia, infracciones, foto_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`;
          values = [body.placa?.toUpperCase().trim(), body.ruat, body.tipo_vehiculo || body.tipo || 'Auto', body.contacto_referencia || body.contacto, body.infracciones || body.antecedentes, foto_url];
        } else if (entityType === 'camaras') {
          query = `INSERT INTO camaras (nombre, url_rtsp, direccion, zona, activa, rol_asistencia, unidad_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`;
          values = [
            body.nombre, 
            body.url_rtsp, 
            body.direccion || null, 
            body.zona || null, 
            body.activa !== false,
            body.rol_asistencia || null,
            body.unidad_id ? parseInt(body.unidad_id, 10) : null
          ];
        }

        if (entityType === 'vehiculos_capturados' || entityType === 'personas_capturadas') {
          if (broadcastTypeNuevo) {
            broadcast({ type: broadcastTypeNuevo, payload: body });
          }
          return res.status(201).json(body);
        }

        if (query) {
           const { rows } = await db.query(query, values);
           nuevo = rows[0];
           nuevo.foto = nuevo.foto_url;
           if (entityType === 'personas') nuevo.peligrosidad = nuevo.nivel_riesgo;
           if (entityType === 'vehiculos') {
             nuevo.tipo = nuevo.tipo_vehiculo;
             nuevo.antecedentes = nuevo.infracciones;
             nuevo.contacto = nuevo.contacto_referencia;
           }
           if (entityType === 'desaparecidos') {
             nuevo.contacto = nuevo.contacto_familiar;
             nuevo.rasgos = nuevo.rasgos_distintivos;
             nuevo.ropa = nuevo.ropa_visto_ultima_vez;
           }
        }

        if (broadcastTypeNuevo && query) {
          broadcast({ type: broadcastTypeNuevo, payload: nuevo });
        }
        if (['personas', 'desaparecidos', 'vehiculos', 'camaras'].includes(entityType)) {
          notifyAIWorker();
        }
        
        res.status(201).json(nuevo);
      } catch (err) { 
        if (err.code === '23505') {
          if (entityType === 'vehiculos') {
            return res.status(400).json({ error: `La matrícula "${req.body.placa}" ya se encuentra registrada en la Lista Negra LPR.` });
          }
          return res.status(400).json({ error: 'Ya existe un registro con estos datos únicos en el sistema.' });
        }
        res.status(500).json({ error: err.message }); 
      }
    },
    async update(req, res) {
      try {
        const mapping = tableMapping[entityType];
        if (!mapping) return res.status(400).json({ error: 'Entidad no soportada' });

        const { id } = req.params;
        const body = { ...req.body };
        
        let query = '';
        let values = [];

        // Si se envía una nueva foto en base64, procesarla. Si no, ignorar el campo foto
        let foto_url = null;
        let updateFoto = false;
        if (body.foto && body.foto.startsWith('data:image')) {
          foto_url = await handleImageUpload(body.foto, mapping.folder);
          updateFoto = true;
        }

        if (entityType === 'personas') {
          query = `UPDATE sujetos_interes SET nombre = $1, alias = $2, ci = $3, nivel_riesgo = $4, antecedentes = $5 ${updateFoto ? ', foto_url = $7' : ''} WHERE id = $6 RETURNING *`;
          values = [body.nombre, body.alias, body.ci, body.peligrosidad, body.antecedentes, id];
          if (updateFoto) values.push(foto_url);
        } else if (entityType === 'desaparecidos') {
          query = `UPDATE personas_desaparecidas SET nombre = $1, contacto_familiar = $2, fecha_desaparicion = $3, rasgos_distintivos = $4, ropa_visto_ultima_vez = $5 ${updateFoto ? ', foto_url = $7' : ''} WHERE id = $6 RETURNING *`;
          values = [body.nombre, body.contacto_familiar || body.contacto, body.fecha_desaparicion, body.rasgos_distintivos || body.rasgos, body.ropa_visto_ultima_vez || body.ropa, id];
          if (updateFoto) values.push(foto_url);
        } else if (entityType === 'vehiculos') {
          query = `UPDATE vehiculos_lpr SET placa = $1, ruat = $2, tipo_vehiculo = $3, contacto_referencia = $4, infracciones = $5 ${updateFoto ? ', foto_url = $7' : ''} WHERE id = $6 RETURNING *`;
          values = [body.placa?.toUpperCase().trim(), body.ruat, body.tipo_vehiculo || body.tipo || 'Auto', body.contacto_referencia || body.contacto, body.infracciones || body.antecedentes, id];
          if (updateFoto) values.push(foto_url);
        } else if (entityType === 'camaras') {
          query = `UPDATE camaras SET nombre = $1, url_rtsp = $2, direccion = $3, zona = $4, activa = $5, rol_asistencia = $6, unidad_id = $7 WHERE id = $8 RETURNING *`;
          values = [
            body.nombre, 
            body.url_rtsp, 
            body.direccion || null, 
            body.zona || null, 
            body.activa !== false, 
            body.rol_asistencia || null,
            body.unidad_id ? parseInt(body.unidad_id, 10) : null,
            id
          ];
        }

        if (query) {
           const { rows } = await db.query(query, values);
           if (rows.length === 0) return res.status(404).send('No encontrado');
           const actualizado = rows[0];
           actualizado.foto = actualizado.foto_url;
           if (entityType === 'personas') actualizado.peligrosidad = actualizado.nivel_riesgo;
           if (entityType === 'vehiculos') {
             actualizado.tipo = actualizado.tipo_vehiculo;
             actualizado.antecedentes = actualizado.infracciones;
             actualizado.contacto = actualizado.contacto_referencia;
           }
           if (entityType === 'desaparecidos') {
             actualizado.contacto = actualizado.contacto_familiar;
             actualizado.rasgos = actualizado.rasgos_distintivos;
             actualizado.ropa = actualizado.ropa_visto_ultima_vez;
           }
           if (['personas', 'desaparecidos', 'vehiculos', 'camaras'].includes(entityType)) {
             notifyAIWorker();
           }
           res.json(actualizado);
        } else {
           res.status(400).send('Método no implementado');
        }

      } catch (err) { 
        if (err.code === '23505') {
          if (entityType === 'vehiculos') {
            return res.status(400).json({ error: `La matrícula "${req.body.placa}" ya se encuentra registrada en la Lista Negra LPR.` });
          }
          return res.status(400).json({ error: 'Ya existe un registro con estos datos únicos en el sistema.' });
        }
        res.status(500).json({ error: err.message }); 
      }
    },
    async remove(req, res) {
      try {
        const mapping = tableMapping[entityType];
        if (!mapping || !mapping.table) return res.status(400).json({ error: 'Entidad no soportada' });
        const { id } = req.params;
        if (entityType !== 'camaras' && entityType !== 'vehiculos_capturados' && entityType !== 'personas_capturadas') {
          await db.query(`UPDATE ${mapping.table} SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1`, [id]);
        } else {
          await db.query(`DELETE FROM ${mapping.table} WHERE id = $1`, [id]);
        }
        if (['personas', 'desaparecidos', 'vehiculos', 'camaras'].includes(entityType)) {
          notifyAIWorker();
        }
        res.json({ success: true });
      } catch (err) { res.status(500).json({ error: err.message }); }
    }
  };
}

module.exports = { createCrudController };
