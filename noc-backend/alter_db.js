const db = require('./src/db');

async function run() {
  try {
    await db.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS codigo_2fa VARCHAR(10);`);
    await db.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS expira_2fa TIMESTAMP;`);
    console.log('Columnas de 2FA añadidas correctamente a la tabla usuarios');
    process.exit(0);
  } catch (err) {
    console.error('Error alterando la tabla:', err);
    process.exit(1);
  }
}

run();
