const db = require('../db');
const fs = require('fs/promises');
const path = require('path');
const { UUID, validateReading } = require('../services/lprValidation');
const { broadcast } = require('../services/websocketService');
const { enviarNotificaciones } = require('../services/notificationService');
// Private: never served by the existing public /uploads static directory.
const ROOT = path.resolve(__dirname, '../../private_lpr');

async function postLectura(req,res) {
  const b = req.body;
  let images;
  try { images = validateReading(b); }
  catch (e) { return res.status(400).json({error:e.message}); }
  let client, committed=false, commitAttempted=false;
  const written=[];
  try {
    client=await db.connect();
    await client.query('BEGIN');
    // Serialize retries of one event and concurrent matches of one camera/plate.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[b.event_id]);
    const existing=await client.query('SELECT id FROM lecturas_lpr WHERE event_id=$1',[b.event_id]);
    if (existing.rows.length) {
      await client.query('COMMIT'); committed=true;
      return res.json({id:existing.rows[0].id,duplicate:true});
    }
    const camera=await client.query('SELECT nombre FROM camaras WHERE id=$1',[b.camara_id]);
    if (!camera.rows.length) { await client.query('ROLLBACK'); return res.status(400).json({error:'Cámara inexistente'}); }
    const match=await client.query("SELECT id FROM vehiculos_lpr WHERE deleted_at IS NULL AND regexp_replace(upper(placa),'[^A-Z0-9]','','g')=$1 LIMIT 1",[b.placa]);
    const exact=match.rows.length>0;
    await fs.mkdir(ROOT,{recursive:true});
    for (const [kind,data] of Object.entries(images)) {
      const dest=path.join(ROOT,`${b.event_id}-${kind}.jpg`);
      await fs.writeFile(dest,data); written.push(dest);
    }
    let alert=null;
    if (exact) {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`lpr:${b.camara_id}:${b.placa}`]);
      const config=await client.query("SELECT config FROM modulos_sistema WHERE clave='reconocimiento_placas'");
      const cooldown=Math.max(1,Math.min(3600,Number(config.rows[0]?.config?.cooldown_seg)||30));
      const recent=await client.query("SELECT 1 FROM lecturas_lpr WHERE camara_id=$1 AND placa=$2 AND alerta_id IS NOT NULL AND recibido_en > NOW()-($3 * interval '1 second') LIMIT 1",[b.camara_id,b.placa,cooldown]);
      if (!recent.rows.length) {
        const result=await client.query("INSERT INTO alertas_tacticas(tipo_alerta,nivel_confianza,nombre_captura,camara_id,fecha_hora_deteccion) VALUES('LPR',$1,$2,$3,$4) RETURNING id",[b.confianza,b.placa,b.camara_id,b.captured_at]);
        alert={id:result.rows[0].id,tipo_alerta:'LPR',nombre:b.placa,camara_id:b.camara_id,
          nivel_confianza:b.confianza,fecha_hora:b.captured_at,ubicacion_camara:camera.rows[0].nombre};
      }
    }
    const result=await client.query(`INSERT INTO lecturas_lpr
      (event_id,session_id,track_id,camara_id,placa,confianza,votos,ratio,tipo_vehiculo,coincidencia,evidencia,fecha_hora,alerta_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      [b.event_id,b.session_id,b.track_id,b.camara_id,b.placa,b.confianza,b.votos,b.ratio,b.tipo_vehiculo,
       exact?'exacta':'sin_coincidencia',b.evidencia,b.captured_at,alert?.id||null]);
    commitAttempted=true;
    await client.query('COMMIT'); committed=true;
    // Only new exact-match alerts use the existing notification configuration.
    // Tests stub this sender; duplicate event retries never send again.
    if (alert) {
      broadcast({type:'NUEVA_ALERTA',payload:alert});
      enviarNotificaciones({...alert,foto_captura:b.foto_placa}).catch(e=>console.error('LPR notification:',e.name));
    }
    return res.status(201).json({id:result.rows[0].id,coincidencia:exact?'exacta':'sin_coincidencia'});
  } catch(e) {
    if (client && !committed) await client.query('ROLLBACK').catch(()=>{});
    // A lost connection during COMMIT leaves its outcome uncertain. Preserve
    // evidence in that case; an idempotent retry will discover the saved row.
    if (!committed && !commitAttempted) await Promise.all(written.map(file=>fs.unlink(file).catch(()=>{})));
    console.error('LPR history:',e.code||e.name);
    return res.status(500).json({error:'No se pudo guardar la lectura LPR'});
  } finally { client?.release(); }
}

async function getLecturas(req,res) {
  const clauses=[],values=[];
  const add=(clause,value)=>{values.push(value);clauses.push(clause.replace('?',`$${values.length}`));};
  if (req.query.placa) {
    if (!/^[A-Z0-9 -]{1,20}$/i.test(req.query.placa)) return res.status(400).json({error:'Filtro de placa inválido'});
    add('l.placa LIKE ?',`%${req.query.placa.toUpperCase().replace(/[^A-Z0-9]/g,'')}%`);
  }
  for (const [key,op] of [['desde','>='],['hasta','<=']]) if (req.query[key]) {
    if (!Number.isFinite(Date.parse(req.query[key]))) return res.status(400).json({error:'Fecha inválida'});
    add(`l.fecha_hora ${op} ?`,new Date(req.query[key]).toISOString());
  }
  if (req.query.camara) {
    if (!/^\d+$/.test(req.query.camara)) return res.status(400).json({error:'Cámara inválida'});
    add('l.camara_id = ?',Number(req.query.camara));
  }
  const offset=Math.max(0,Math.min(100000,Number.parseInt(req.query.offset,10)||0));
  values.push(offset);
  try {
    const result=await db.query(`SELECT l.*,c.nombre AS ubicacion_camara FROM lecturas_lpr l LEFT JOIN camaras c ON c.id=l.camara_id ${clauses.length?'WHERE '+clauses.join(' AND '):''} ORDER BY l.fecha_hora DESC,l.id DESC LIMIT 51 OFFSET $${values.length}`,values);
    res.json({items:result.rows.slice(0,50),has_more:result.rows.length>50});
  } catch(e) {
    res.status(e.code==='42P01'?503:500).json({error:e.code==='42P01'?'Historial LPR pendiente de migración 008':'No se pudo consultar el historial'});
  }
}

async function getEvidencia(req,res) {
  const {event,kind}=req.params;
  if (!UUID.test(event) || !['placa','vehiculo','contexto'].includes(kind)) return res.sendStatus(400);
  try {
    const found=await db.query('SELECT 1 FROM lecturas_lpr WHERE event_id=$1',[event]);
    if (!found.rows.length) return res.sendStatus(404);
    res.set('Cache-Control','private, no-store');
    return res.sendFile(path.join(ROOT,`${event}-${kind}.jpg`),e=>{if(e && !res.headersSent) res.sendStatus(404);});
  } catch { return res.sendStatus(500); }
}
module.exports={postLectura,getLecturas,getEvidencia};
