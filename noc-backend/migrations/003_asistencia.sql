-- Migración 003: Control de Asistencia
-- Base de datos: vigia_centinel

CREATE TABLE IF NOT EXISTS unidades (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    direccion VARCHAR(255),
    activa BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS empleados (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    ci VARCHAR(30) UNIQUE,
    cargo VARCHAR(100),
    unidad_id INT REFERENCES unidades(id) ON DELETE SET NULL,
    foto_url TEXT,
    horario_entrada TIME,
    horario_salida TIME,
    activo BOOLEAN DEFAULT true,
    consentimiento_biometrico BOOLEAN DEFAULT true,
    deleted_at TIMESTAMP NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE camaras ADD COLUMN IF NOT EXISTS unidad_id INT REFERENCES unidades(id) ON DELETE SET NULL;
ALTER TABLE camaras ADD COLUMN IF NOT EXISTS rol_asistencia VARCHAR(20); -- NULL | 'entrada' | 'salida' | 'ambas'

CREATE TABLE IF NOT EXISTS asistencia_jornadas (
    id SERIAL PRIMARY KEY,
    empleado_id INT NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
    unidad_id INT REFERENCES unidades(id) ON DELETE SET NULL,
    entrada TIMESTAMP NOT NULL,
    salida TIMESTAMP,
    camara_entrada_id INT REFERENCES camaras(id) ON DELETE SET NULL,
    camara_salida_id INT REFERENCES camaras(id) ON DELETE SET NULL,
    foto_entrada_url TEXT,
    foto_salida_url TEXT,
    confianza_entrada NUMERIC(5,2),
    confianza_salida NUMERIC(5,2),
    cierre VARCHAR(20) DEFAULT 'normal', -- 'normal' | 'automatico' | 'manual'
    observacion TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_jornada_abierta
  ON asistencia_jornadas(empleado_id) WHERE salida IS NULL;
CREATE INDEX IF NOT EXISTS idx_jornada_entrada ON asistencia_jornadas(entrada DESC);
