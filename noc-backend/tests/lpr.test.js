const {test}=require('node:test');
const assert=require('node:assert/strict');
const {validateReading,normalize}=require('../src/services/lprValidation');
const jpeg='data:image/jpeg;base64,/9j/2Q==';
const sample=()=>({event_id:'f117d90a-636b-41a4-8a52-578462f46d20',session_id:'851134a1-31a1-453d-a320-0c6c0b382e24',
  camara_id:1,track_id:'1',placa:'1234ABC',confianza:90,votos:3,ratio:.8,tipo_vehiculo:'Auto',captured_at:new Date().toISOString(),
  evidencia:{raw:'1234ABC'},foto_placa:jpeg,foto_vehiculo:jpeg,foto_contexto:jpeg});
test('valid reading and harmless normalization',()=>{
  assert.equal(Object.keys(validateReading(sample())).length,3);
  assert.equal(normalize('1Z34-abc'),'1Z34ABC');
  assert.notEqual(normalize('234ABC'),normalize('1234ABC'));
});
test('reject bad identifiers, forged image, confidence, and dates',()=>{
  for(const change of [{event_id:'../escape'},{camara_id:0},{votos:1},{confianza:NaN},{ratio:2},
    {captured_at:'2026-10-01T10:00:00'},{foto_placa:'data:image/svg+xml;base64,PHN2Zz4='},{foto_contexto:jpeg+'x'}])
    assert.throws(()=>validateReading({...sample(),...change}));
});
