const fs = require('fs');
const path = require('path');
const db = require('./src/db');

async function runMigrations() {
  const migrationsDir = path.join(__dirname, 'migrations');
  if (!fs.existsSync(migrationsDir)) return;
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  
  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    try {
      await db.query(sql);
      console.log(`✅ Migración aplicada: ${file}`);
    } catch (err) {
      console.error(`⚠️ Error en migración ${file}:`, err.message);
    }
  }
}

if (require.main === module) {
  runMigrations().then(() => {
    console.log('🏁 Proceso de migraciones completado.');
    process.exit(0);
  }).catch(e => {
    console.error('Error ejecutando migraciones:', e);
    process.exit(1);
  });
}

module.exports = { runMigrations };
