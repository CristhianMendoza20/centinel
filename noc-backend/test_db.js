const db = require('./src/db');
async function test() {
    try {
        const r = await db.query('UPDATE camaras SET nombre = $1, url_rtsp = $2, latitud = $3, longitud = $4, activa = $5 WHERE id = $6', ['Cam Test 2 (Simulación)', 'videos de prueba/video3.mp4', -17.7834, -63.1822, true, 2]);
    } catch (e) {
    }
    process.exit();
}
test();
