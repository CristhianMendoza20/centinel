const db = require('./src/db');

async function inspect() {
  try {
    const tablesRes = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    console.log('=== TABLAS EXISTENTES ===');
    for (const row of tablesRes.rows) {
      const colRes = await db.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = $1 
        ORDER BY ordinal_position;
      `, [row.table_name]);
      console.log(`\nTabla: ${row.table_name}`);
      console.log('Columnas:', colRes.rows.map(c => `${c.column_name} (${c.data_type}${c.is_nullable === 'NO' ? ' NOT NULL' : ''})`).join(', '));
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

inspect();
