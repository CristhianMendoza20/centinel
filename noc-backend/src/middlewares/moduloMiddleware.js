const { isModuloActivoSync, refreshCache } = require('../controllers/modulosController');

function requireModulo(clave) {
  return async (req, res, next) => {
    if (!isModuloActivoSync(clave)) {
      await refreshCache();
    }

    if (!isModuloActivoSync(clave)) {
      return res.status(403).json({
        error: `El módulo '${clave}' se encuentra desactivado actualmente por el administrador.`
      });
    }
    next();
  };
}

module.exports = { requireModulo };
