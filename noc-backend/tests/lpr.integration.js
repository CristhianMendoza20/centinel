// Explicit integration run, isolated in PostgreSQL TEMP tables. No notifications.
const assert=require('node:assert/strict');
const fs=require('fs/promises');
const path=require('path');
const {randomUUID}=require('crypto');
const db=require('../src/db');
let notifications=0;
require('../src/services/notificationService').enviarNotificaciones=async()=>{notifications++;};
const controller=require('../src/controllers/lprController');
const events=[];
const originalConnect=db.connect.bind(db);
function response() { return {code:200,status(n){this.code=n;return this;},json(data){this.data=data;return this;}}; }
(async()=>{
  const client=await originalConnect();
  try {
    await client.query('SET search_path=pg_temp');
    await client.query(`CREATE TEMP TABLE camaras(id INT PRIMARY KEY,nombre TEXT);
      CREATE TEMP TABLE vehiculos_lpr(id INT PRIMARY KEY,placa TEXT,deleted_at TIMESTAMP);
      CREATE TEMP TABLE modulos_sistema(clave TEXT,config JSONB);
      CREATE TEMP TABLE alertas_tacticas(id SERIAL PRIMARY KEY,tipo_alerta TEXT,nivel_confianza NUMERIC,nombre_captura TEXT,camara_id INT,fecha_hora_deteccion TIMESTAMPTZ);
      INSERT INTO camaras VALUES(1,'TEST'); INSERT INTO vehiculos_lpr VALUES(1,'1234-ABC',NULL);
      INSERT INTO modulos_sistema VALUES('reconocimiento_placas','{"cooldown_seg":30}');`);
    await client.query(await fs.readFile(path.join(__dirname,'../migrations/008_lpr.sql'),'utf8'));
    db.connect=async()=>({query:client.query.bind(client),release(){}});
    const jpeg='data:image/jpeg;base64,/9j/2Q==';
    const base={session_id:randomUUID(),track_id:'1',camara_id:1,placa:'1234ABC',confianza:90,votos:3,ratio:.8,
      tipo_vehiculo:'Auto',captured_at:new Date().toISOString(),evidencia:{raw:'1234ABC'},foto_placa:jpeg,foto_vehiculo:jpeg,foto_contexto:jpeg};
    async function submit(plate,event=randomUUID()) {
      events.push(event);const res=response();
      await controller.postLectura({body:{...base,placa:plate,event_id:event}},res);
      assert.ok([200,201].includes(res.code),JSON.stringify(res.data));return {event,res};
    }
    const first=await submit('1234ABC');assert.equal(first.res.data.coincidencia,'exacta');
    const duplicate=await submit('1234ABC',first.event);assert.equal(duplicate.res.data.duplicate,true);
    const partial=await submit('234ABC');assert.equal(partial.res.data.coincidencia,'sin_coincidencia');
    await submit('1234ABC');
    assert.equal((await client.query('SELECT * FROM lecturas_lpr')).rowCount,3);
    assert.equal((await client.query('SELECT * FROM alertas_tacticas')).rowCount,1);
    assert.equal(notifications,1);
    console.log('PASS: independent history, exact match, no substring, idempotency, cooldown; TEMP tables only');
  } finally {
    db.connect=originalConnect;
    for(const event of new Set(events)) for(const kind of ['placa','vehiculo','contexto'])
      await fs.unlink(path.resolve(__dirname,`../private_lpr/${event}-${kind}.jpg`)).catch(()=>{});
    client.release(true);await db.end();
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
