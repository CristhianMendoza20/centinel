-- Migración 005: Módulos de Inteligencia Artificial (Reconocimiento Facial y LPR)
-- Base de datos: vigia_centinel

ALTER TABLE modulos_sistema ADD COLUMN IF NOT EXISTS categoria VARCHAR(20) DEFAULT 'ia';
ALTER TABLE modulos_sistema ADD COLUMN IF NOT EXISTS orden INT DEFAULT 100;

-- Insertar Reconocimiento Facial y Reconocimiento de Placas (LPR) como módulos activos por defecto
INSERT INTO modulos_sistema (clave, nombre, descripcion, activo, categoria, orden, config) VALUES
 ('reconocimiento_facial', 'Reconocimiento Facial',
  'Cotejo biométrico de rostros contra base de datos de sujetos de interés y personas desaparecidas.', true, 'ia', 1,
  '{"umbral_facial":0.35,"confirmaciones":1,"min_confianza_alerta":35,"cooldown_seg":8}'),
 ('reconocimiento_placas', 'Reconocimiento de Placas (LPR)',
  'Detección automática de vehículos y lectura OCR de placas vehiculares contra lista negra.', true, 'ia', 2,
  '{"confirmaciones":2,"cooldown_seg":30,"min_caracteres":6}')
ON CONFLICT (clave) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  orden = EXCLUDED.orden;

-- Actualizar orden y categoría de los módulos existentes
UPDATE modulos_sistema SET categoria = 'ia', orden = 3 WHERE clave = 'asistencia';
UPDATE modulos_sistema SET categoria = 'ia', orden = 4 WHERE clave = 'zonas_restringidas';
