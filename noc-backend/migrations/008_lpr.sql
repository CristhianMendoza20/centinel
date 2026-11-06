-- Additive migration: leaves facial, attendance, zones and registered plates intact.
CREATE TABLE IF NOT EXISTS lecturas_lpr (
  id BIGSERIAL PRIMARY KEY,
  event_id UUID NOT NULL UNIQUE,
  session_id UUID NOT NULL,
  track_id VARCHAR(80) NOT NULL,
  camara_id INT REFERENCES camaras(id) ON DELETE SET NULL,
  placa VARCHAR(20) NOT NULL,
  confianza NUMERIC(5,2) NOT NULL CHECK (confianza BETWEEN 0 AND 100),
  votos INT NOT NULL CHECK (votos BETWEEN 2 AND 15),
  ratio NUMERIC(6,5) NOT NULL CHECK (ratio BETWEEN 0 AND 1),
  tipo_vehiculo VARCHAR(50),
  coincidencia VARCHAR(20) NOT NULL CHECK (coincidencia IN ('exacta','sin_coincidencia')),
  evidencia JSONB NOT NULL DEFAULT '{}',
  fecha_hora TIMESTAMPTZ NOT NULL,
  recibido_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  alerta_id INT REFERENCES alertas_tacticas(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS lecturas_lpr_fecha_idx ON lecturas_lpr(fecha_hora DESC,id DESC);
CREATE INDEX IF NOT EXISTS lecturas_lpr_placa_idx ON lecturas_lpr(placa);
CREATE INDEX IF NOT EXISTS lecturas_lpr_camara_idx ON lecturas_lpr(camara_id,fecha_hora DESC);
-- No automatic evidence deletion: retention remains an explicit pending decision.
