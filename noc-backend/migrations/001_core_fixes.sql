-- Migración 001: Correcciones y columnas base
-- Base de datos: vigia_centinel

-- Cámaras: soporte de ubicación física
ALTER TABLE camaras ADD COLUMN IF NOT EXISTS direccion VARCHAR(255);
ALTER TABLE camaras ADD COLUMN IF NOT EXISTS zona VARCHAR(100);

-- Usuarios: soporte de 2FA
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS codigo_2fa VARCHAR(10);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS expira_2fa TIMESTAMP;

-- Alertas tácticas: soporte de evidencia flexible y nombres de captura
ALTER TABLE alertas_tacticas ADD COLUMN IF NOT EXISTS nombre_captura VARCHAR(255);
ALTER TABLE alertas_tacticas ADD COLUMN IF NOT EXISTS camara_id INT REFERENCES camaras(id) ON DELETE SET NULL;
ALTER TABLE alertas_tacticas ADD COLUMN IF NOT EXISTS ropa VARCHAR(255);
ALTER TABLE alertas_tacticas ALTER COLUMN foto_evidencia_url DROP NOT NULL;
