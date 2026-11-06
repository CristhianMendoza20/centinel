-- Migración 002: Infraestructura de Módulos Activables
-- Base de datos: vigia_centinel

CREATE TABLE IF NOT EXISTS modulos_sistema (
    clave           VARCHAR(50) PRIMARY KEY,      -- 'asistencia', 'zonas_restringidas'
    nombre          VARCHAR(100) NOT NULL,
    descripcion     TEXT,
    activo          BOOLEAN NOT NULL DEFAULT false,
    config          JSONB NOT NULL DEFAULT '{}',  -- parámetros propios de cada módulo
    actualizado_por INT REFERENCES usuarios(id) ON DELETE SET NULL,
    actualizado_en  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO modulos_sistema (clave, nombre, descripcion, config) VALUES
 ('asistencia', 'Control de Asistencia', 'Marcación de ingreso y salida de empleados por biometría facial con cronómetro de permanencia.',
  '{"umbral_facial":0.50,"confirmaciones":3,"min_minutos_entre_marcas":2,"hora_cierre_automatico":"23:59"}'),
 ('zonas_restringidas', 'Zonas Restringidas', 'Detección perimetral por polígonos sobre cámaras y alerta inmediata ante intrusiones.',
  '{"segundos_permanencia":3,"cooldown_seg":60,"excluir_empleados":false}')
ON CONFLICT (clave) DO NOTHING;
