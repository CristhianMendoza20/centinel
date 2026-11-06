-- Migración 004: Zonas Restringidas
-- Base de datos: vigia_centinel

CREATE TABLE IF NOT EXISTS zonas_restringidas (
    id SERIAL PRIMARY KEY,
    camara_id INT NOT NULL REFERENCES camaras(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    poligono JSONB NOT NULL,
    activa BOOLEAN DEFAULT true,
    horario JSONB DEFAULT NULL,
    nivel VARCHAR(20) DEFAULT 'ALTO',
    empleados_autorizados INT[] DEFAULT '{}',
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE alertas_tacticas ADD COLUMN IF NOT EXISTS zona_id INT REFERENCES zonas_restringidas(id) ON DELETE SET NULL;
