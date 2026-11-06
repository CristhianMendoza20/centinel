require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '12345678',
  database: process.env.DB_NAME || 'vigia_centinel',
});

async function main() {
  try {
    console.log('Conectando a la BD...');
    console.log('   Host:', process.env.DB_HOST);
    console.log('   DB:  ', process.env.DB_NAME);
    console.log('   User:', process.env.DB_USER);

    await pool.query('SELECT 1');
    console.log('Conexion a PostgreSQL OK\n');

    const email = 'j.david.jdrc21@gmail.com';
    const res = await pool.query(
      `SELECT u.id, u.nombre, u.email, u.estado, u.password_hash,
              u.codigo_2fa, u.expira_2fa,
              r.nombre as rol
       FROM usuarios u
       LEFT JOIN roles r ON u.rol_id = r.id
       WHERE u.email = $1`,
      [email]
    );

    if (res.rows.length === 0) {
      console.log('USUARIO NO ENCONTRADO en la BD:', email);
      console.log('\nUsuarios existentes:');
      const todos = await pool.query('SELECT u.email, r.nombre as rol, u.estado FROM usuarios u LEFT JOIN roles r ON u.rol_id = r.id');
      todos.rows.forEach(u => console.log('   -', u.email, '[' + u.rol + '] estado=' + u.estado));
    } else {
      const u = res.rows[0];
      console.log('USUARIO ENCONTRADO:');
      console.log('   ID:     ', u.id);
      console.log('   Nombre: ', u.nombre);
      console.log('   Email:  ', u.email);
      console.log('   Rol:    ', u.rol);
      console.log('   Estado: ', u.estado);
      console.log('   Hash:   ', u.password_hash ? u.password_hash.substring(0, 20) + '...' : 'NULL');
      console.log('   2FA cod:', u.codigo_2fa || 'NULL');
      console.log('   2FA exp:', u.expira_2fa || 'NULL');

      const pass = '12345678';
      const valid = await bcrypt.compare(pass, u.password_hash).catch(() => false);
      console.log('\nContrasena "12345678" valida:', valid ? 'SI' : 'NO');

      if (!valid) {
        console.log('\nEl hash guardado NO corresponde a "12345678".');
        const newHash = await bcrypt.hash(pass, 10);
        console.log('Hash correcto generado:', newHash);
        console.log('\nPara corregir, ejecutar en la BD:');
        console.log('UPDATE usuarios SET password_hash = \'' + newHash + '\' WHERE email = \'' + email + '\';');
        
        // Aplicar fix automatico
        await pool.query('UPDATE usuarios SET password_hash = $1 WHERE email = $2', [newHash, email]);
        console.log('\nFIX APLICADO AUTOMATICAMENTE!');
      }

      if (!u.estado) {
        console.log('\nLa cuenta esta DESACTIVADA (estado = false)');
        console.log('Activando cuenta...');
        await pool.query('UPDATE usuarios SET estado = true WHERE email = $1', [email]);
        console.log('CUENTA ACTIVADA!');
      }
    }

    const cols = await pool.query(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_name = 'usuarios' AND column_name IN ('codigo_2fa','expira_2fa')
       ORDER BY column_name`
    );
    console.log('\nColumnas 2FA en tabla usuarios:');
    if (cols.rows.length === 0) {
      console.log('   FALTAN las columnas codigo_2fa y expira_2fa!');
      console.log('   Aplicando ALTER TABLE...');
      await pool.query('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS codigo_2fa VARCHAR(6), ADD COLUMN IF NOT EXISTS expira_2fa TIMESTAMPTZ');
      console.log('   Columnas agregadas!');
    } else {
      cols.rows.forEach(c => console.log('   OK:', c.column_name, '(' + c.data_type + ')'));
    }

  } catch (err) {
    console.error('ERROR:', err.message);
    console.error(err.stack);
  } finally {
    await pool.end();
  }
}

main();
