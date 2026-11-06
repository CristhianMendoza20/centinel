const db = require('../db');

/**
 * Middleware para registrar acciones críticas de los usuarios (POST, PUT, DELETE).
 * Se debe usar DESPUÉS de requireAuth, de forma que req.user esté disponible.
 */
function auditLogMiddleware(req, res, next) {
  // Ignorar GET o si no hay usuario
  if (req.method === 'GET' || !req.user) {
    return next();
  }

  // Guardar referencia al send original para capturar la respuesta
  const originalSend = res.send;
  let responseBody;

  res.send = function (body) {
    responseBody = body;
    return originalSend.apply(this, arguments);
  };

  res.on('finish', () => {
    // Solo registrar si fue exitoso (2xx)
    if (res.statusCode >= 200 && res.statusCode < 300) {
      try {
        const usuario_id = req.user.id;
        const method = req.method; // POST, PUT, DELETE
        const url = req.originalUrl; // ej: /api/personas/123
        
        let accion = 'DESCONOCIDO';
        if (method === 'POST') accion = 'CREAR';
        else if (method === 'PUT') accion = 'ACTUALIZAR';
        else if (method === 'DELETE') accion = 'ELIMINAR';

        const partesUrl = url.split('?')[0].split('/').filter(Boolean); // ej: ['api', 'personas', '123']
        let entidad = partesUrl[1] || 'sistema'; // ej: 'personas'
        let entidad_id = req.params.id || partesUrl[2] || null;

        // Si fue un POST exitoso, usualmente el ID viene en la respuesta
        if (method === 'POST' && responseBody) {
          try {
            const parsedBody = JSON.parse(responseBody);
            if (parsedBody && parsedBody.id) {
              entidad_id = parsedBody.id;
            }
          } catch (e) {
            // No se pudo parsear, ignorar
          }
        }

        // Obtener detalles (quitamos contraseñas y fotos para no saturar)
        const detalles = { ...req.body };
        if (detalles.password) delete detalles.password;
        if (detalles.foto) delete detalles.foto;

        const ip_origen = req.ip || req.connection.remoteAddress;

        // Insertar asíncronamente
        db.query(
          `INSERT INTO logs_auditoria (usuario_id, accion, entidad, entidad_id, detalles, ip_origen) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [usuario_id, accion, entidad, entidad_id, JSON.stringify(detalles), ip_origen]
        ).catch(err => {
          console.error('[Auditoría] Error al guardar log:', err.message);
        });

      } catch (err) {
        console.error('[Auditoría] Excepción en middleware:', err.message);
      }
    }
  });

  next();
}

module.exports = { auditLogMiddleware };
