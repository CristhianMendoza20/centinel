// Agrega las columnas direccion y zona a camaras (sin borrar latitud/longitud)
const db = require('./src/db');

(async () => {
  try {
    await db.query('ALTER TABLE camaras ADD COLUMN IF NOT EXISTS direccion VARCHAR(255)');
    await db.query('ALTER TABLE camaras ADD COLUMN IF NOT EXISTS zona VARCHAR(100)');
    const r = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'camaras' ORDER BY ordinal_position");
    console.log('Columnas de camaras:', r.rows.map(x => x.column_name).join(', '));
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
