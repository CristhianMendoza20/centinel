-- 007_centinel_restore.sql
-- Configurar nombre oficial CENTINEL y módulos de Sujetos de Interés y Lista Negra LPR

UPDATE modulos_sistema 
SET nombre = 'Reconocimiento Facial / Sujetos de Interés',
    descripcion = 'Cotejo biométrico de rostros contra base de datos de sujetos de interés y personas desaparecidas.',
    activo = true
WHERE clave = 'reconocimiento_facial';

UPDATE modulos_sistema 
SET nombre = 'Reconocimiento de Placas / Lista Negra LPR',
    descripcion = 'Detección automática de vehículos y lectura OCR de placas vehiculares contra lista negra de matrículas.',
    activo = true
WHERE clave = 'reconocimiento_placas';

-- Correo oficial de CENTINEL para el administrador
UPDATE usuarios SET email = 'admin@centinel.lat' WHERE email != 'admin@centinel.lat' AND id = 1;
