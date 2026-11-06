const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const normalize = value => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
function validateReading(b) {
  if (!b || !UUID.test(b.event_id) || !UUID.test(b.session_id)) throw Error('Identificadores inválidos');
  if (!Number.isInteger(b.camara_id) || b.camara_id <= 0) throw Error('Cámara inválida');
  if (typeof b.track_id !== 'string' || !b.track_id.length || b.track_id.length > 80) throw Error('Track inválido');
  if (typeof b.placa !== 'string' || !/^[A-Z0-9]{5,12}$/.test(b.placa)) throw Error('Placa inválida');
  if (!Number.isFinite(b.confianza) || b.confianza < 0 || b.confianza > 100) throw Error('Confianza inválida');
  if (!Number.isInteger(b.votos) || b.votos < 2 || b.votos > 15) throw Error('Votos inválidos');
  if (!Number.isFinite(b.ratio) || b.ratio < .5 || b.ratio > 1) throw Error('Consenso inválido');
  if (typeof b.tipo_vehiculo !== 'string' || b.tipo_vehiculo.length > 50) throw Error('Tipo inválido');
  if (typeof b.captured_at !== 'string' || !/(Z|[+-]\d\d:\d\d)$/.test(b.captured_at) || !Number.isFinite(Date.parse(b.captured_at)) || Date.parse(b.captured_at) > Date.now()+60000) throw Error('Hora inválida');
  if (!b.evidencia || Array.isArray(b.evidencia) || typeof b.evidencia !== 'object' || JSON.stringify(b.evidencia).length > 8192) throw Error('Evidencia inválida');
  const images = {};
  for (const kind of ['placa','vehiculo','contexto']) {
    const value = b[`foto_${kind}`];
    if (typeof value !== 'string' || value.length > 2800000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) throw Error(`Imagen ${kind} inválida`);
    const data = Buffer.from(value.split(',')[1], 'base64');
    if (data.length < 4 || data[0] !== 255 || data[1] !== 216 || data.at(-2) !== 255 || data.at(-1) !== 217) throw Error(`JPEG ${kind} inválido`);
    images[kind] = data;
  }
  return images;
}
module.exports = { UUID, normalize, validateReading };
