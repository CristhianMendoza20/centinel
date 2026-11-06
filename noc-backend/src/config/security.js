const crypto = require('crypto');

// Secretos de seguridad. Deben definirse en noc-backend/.env
//   JWT_SECRET      -> firma de tokens de sesión
//   WORKER_API_KEY  -> clave compartida entre el backend y el AI Worker (Python)

let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  // Sin valor en .env se genera uno temporal: las sesiones se pierden al reiniciar.
  JWT_SECRET = crypto.randomBytes(48).toString('hex');
  console.warn('⚠️  JWT_SECRET no está definido en .env — usando uno temporal (las sesiones se cerrarán al reiniciar).');
}

const WORKER_API_KEY = process.env.WORKER_API_KEY || '';
if (!WORKER_API_KEY) {
  console.warn('⚠️  WORKER_API_KEY no está definido en .env — el AI Worker NO podrá enviar alertas.');
}

module.exports = { JWT_SECRET, WORKER_API_KEY };
