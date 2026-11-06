const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');
const { JWT_SECRET, WORKER_API_KEY } = require('../config/security');

// Middleware para verificar que el usuario está autenticado
const requireAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No autorizado, token requerido' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    // Guardar los datos decodificados en el request para usarlos luego (ej. rol_id, id)
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }
    return res.status(500).json({ error: 'Error interno de autenticación' });
  }
};

// Middleware para requerir el rol de administrador global
const requireAdmin = (req, res, next) => {
  if (req.user && req.user.rol_nombre === 'admin') {
    next();
  } else {
    return res.status(403).json({ error: 'Acceso denegado: se requieren privilegios de administrador' });
  }
};

// Middleware para endpoints que solo debe llamar el AI Worker (header x-worker-key)
const requireWorkerKey = (req, res, next) => {
  const provided = String(req.headers['x-worker-key'] || '');
  const a = Buffer.from(provided);
  const b = Buffer.from(WORKER_API_KEY);
  if (!WORKER_API_KEY || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: 'Clave de worker inválida' });
  }
  next();
};

// (Opcional) Middleware granular de permisos:
// function requirePermission(permissionName) {
//   return async (req, res, next) => {
//     // aquí buscaríamos en DB si el rol del req.user tiene el permiso dado
//   }
// }

module.exports = {
  requireAuth,
  requireAdmin,
  requireWorkerKey
};
