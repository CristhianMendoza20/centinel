const db = require('./src/db');
const bcrypt = require('bcryptjs');

async function run() {
  try {
    const hash = await bcrypt.hash('operador123', 10);
    await db.query(`
      INSERT INTO usuarios (nombre, email, password_hash, rol_id) 
      VALUES ('Operador Piter', 'piterbenjamin61@gmail.com', $1, (SELECT id FROM roles WHERE nombre = 'operador')) 
      ON CONFLICT DO NOTHING;
    `, [hash]);
    console.log('Usuario creado con éxito (o ya existía)');
    process.exit(0);
  } catch (err) {
    console.error('Error creando usuario:', err);
    process.exit(1);
  }
}

run();
