/**
 * Limpieza de evidencias antiguas — CENTINEL
 *
 * Borra las fotos de alertas (uploads/alertas) con más de N días.
 * NUNCA toca las fotos de registro (uploads/personas, uploads/vehiculos).
 * Las alertas se conservan en la BD para los reportes; solo se limpia
 * la referencia a la foto borrada (foto_evidencia_url = NULL).
 *
 * Uso:
 *   node cleanup_old_evidence.js              -> SIMULACIÓN: solo muestra qué se borraría
 *   node cleanup_old_evidence.js --apply      -> borra de verdad
 *   node cleanup_old_evidence.js --days=60    -> cambia la retención (por defecto 30 o EVIDENCE_RETENTION_DAYS)
 *
 * Atajos npm:  npm run cleanup        (simulación)
 *              npm run cleanup:apply  (borrado real)
 */
require('dotenv').config();
const fs = require('fs/promises');
const path = require('path');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const daysArg = args.find(a => a.startsWith('--days='));
const DAYS = Number(daysArg ? daysArg.split('=')[1] : process.env.EVIDENCE_RETENTION_DAYS || 30);

if (!Number.isFinite(DAYS) || DAYS < 1) {
  console.error('❌ Número de días inválido. Use un entero >= 1.');
  process.exit(1);
}

const ALERTAS_DIR = path.join(__dirname, 'uploads', 'alertas');
const LIMITE = Date.now() - DAYS * 24 * 60 * 60 * 1000;

async function main() {
  console.log(`🧹 Limpieza de evidencias — retención: ${DAYS} días — modo: ${APPLY ? 'BORRADO REAL' : 'SIMULACIÓN'}`);

  let archivos;
  try {
    archivos = await fs.readdir(ALERTAS_DIR);
  } catch (err) {
    if (err.code === 'ENOENT') { console.log('No existe uploads/alertas. Nada que limpiar.'); return; }
    throw err;
  }

  const viejos = [];
  let bytes = 0;
  for (const nombre of archivos) {
    const ruta = path.join(ALERTAS_DIR, nombre);
    const st = await fs.stat(ruta);
    if (st.isFile() && st.mtimeMs < LIMITE) {
      viejos.push(nombre);
      bytes += st.size;
    }
  }

  const mb = (bytes / 1024 / 1024).toFixed(1);
  console.log(`Encontrados ${viejos.length} de ${archivos.length} archivos con más de ${DAYS} días (${mb} MB).`);

  if (!viejos.length) return;
  if (!APPLY) {
    viejos.slice(0, 10).forEach(n => console.log('  -', n));
    if (viejos.length > 10) console.log(`  ... y ${viejos.length - 10} más`);
    console.log('\nNo se borró nada. Ejecute con --apply para borrar.');
    return;
  }

  let borrados = 0;
  for (const nombre of viejos) {
    try {
      await fs.unlink(path.join(ALERTAS_DIR, nombre));
      borrados++;
    } catch (err) {
      console.error(`  ⚠️  No se pudo borrar ${nombre}: ${err.message}`);
    }
  }

  // Quitar la referencia en la BD para que el frontend no muestre imágenes rotas
  const db = require('./src/db');
  const urls = viejos.map(n => `/uploads/alertas/${n}`);
  const { rowCount } = await db.query(
    'UPDATE alertas_tacticas SET foto_evidencia_url = NULL WHERE foto_evidencia_url = ANY($1)',
    [urls]
  );
  await db.end();

  console.log(`✅ Borrados ${borrados} archivos (${mb} MB). Referencias limpiadas en BD: ${rowCount}.`);
}

main().catch(err => {
  console.error('❌ Error en la limpieza:', err.message);
  process.exit(1);
});
