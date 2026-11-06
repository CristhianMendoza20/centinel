const db = require('./src/db');

async function run() {
  try {
    await db.query(`ALTER TABLE camaras DROP COLUMN IF EXISTS latitud;`);
    await db.query(`ALTER TABLE camaras DROP COLUMN IF EXISTS longitud;`);
    await db.query(`ALTER TABLE camaras ADD COLUMN IF NOT EXISTS direccion VARCHAR(255);`);
    await db.query(`ALTER TABLE camaras ADD COLUMN IF NOT EXISTS zona VARCHAR(100);`);
    console.log('Columnas latitud y longitud eliminadas. Añadidas direccion y zona.');
    process.exit(0);
  } catch (err) {
    console.error('Error alterando la tabla:', err);
    process.exit(1);
  }
}

run();
