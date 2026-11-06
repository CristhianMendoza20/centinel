-- Base de datos: vigia_centinel
-- Script de Inicialización PostgreSQL para CENTINEL Enterprise (v4.5 Completo)

-- 1a. Tabla de Roles
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) UNIQUE NOT NULL,
    descripcion TEXT
);

-- 1b. Tabla de Permisos
CREATE TABLE IF NOT EXISTS permisos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) UNIQUE NOT NULL,
    descripcion TEXT
);

-- 1c. Relación Roles y Permisos
CREATE TABLE IF NOT EXISTS rol_permisos (
    rol_id INT REFERENCES roles(id) ON DELETE CASCADE,
    permiso_id INT REFERENCES permisos(id) ON DELETE CASCADE,
    PRIMARY KEY (rol_id, permiso_id)
);

-- 1d. Tabla de Usuarios (Autenticación)
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    rol_id INT REFERENCES roles(id) ON DELETE SET NULL,
    estado BOOLEAN DEFAULT true,
    codigo_2fa VARCHAR(10),
    expira_2fa TIMESTAMP,
    ultimo_acceso TIMESTAMP,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertar roles base
INSERT INTO roles (nombre, descripcion) VALUES 
('admin', 'Administrador Global del Sistema'),
('operador', 'Operador de Monitoreo')
ON CONFLICT (nombre) DO NOTHING;

-- Insertar administrador por defecto (password: admin123)
INSERT INTO usuarios (nombre, email, password_hash, rol_id) 
VALUES ('Administrador Global', 'admin@centinel.lat', '$2a$10$X7/j9kK9xGvYx.L5N0z/OeLz4.k7vL8hFq8v6r/z9z8s8v9z8s8v9', (SELECT id FROM roles WHERE nombre = 'admin')) 
ON CONFLICT (email) DO NOTHING;

-- 2a. Unidades Operativas / Establecimientos
CREATE TABLE IF NOT EXISTS unidades (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    direccion VARCHAR(255),
    activa BOOLEAN DEFAULT true
);

-- 2b. Tabla de Cámaras
CREATE TABLE IF NOT EXISTS camaras (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    url_rtsp TEXT NOT NULL,
    latitud NUMERIC(10, 8),
    longitud NUMERIC(11, 8),
    direccion VARCHAR(255),
    zona VARCHAR(100),
    unidad_id INT REFERENCES unidades(id) ON DELETE SET NULL,
    rol_asistencia VARCHAR(20), -- NULL | 'entrada' | 'salida' | 'ambas'
    activa BOOLEAN DEFAULT true,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabla de Sujetos de Interés (Sospechosos / Buscados)
CREATE TABLE IF NOT EXISTS sujetos_interes (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    alias VARCHAR(100),
    ci VARCHAR(30),
    nivel_riesgo VARCHAR(50) DEFAULT 'MEDIO',
    antecedentes TEXT,
    foto_url TEXT,
    deleted_at TIMESTAMP NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabla de Personas Desaparecidas
CREATE TABLE IF NOT EXISTS personas_desaparecidas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    contacto_familiar VARCHAR(100),
    fecha_desaparicion DATE,
    rasgos_distintivos TEXT,
    ropa_visto_ultima_vez TEXT,
    foto_url TEXT,
    estado_encontrado BOOLEAN DEFAULT false,
    deleted_at TIMESTAMP NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Tabla de Vehículos LPR (Lista Negra)
CREATE TABLE IF NOT EXISTS vehiculos_lpr (
    id SERIAL PRIMARY KEY,
    placa VARCHAR(20) UNIQUE NOT NULL,
    ruat VARCHAR(50),
    tipo_vehiculo VARCHAR(50),
    contacto_referencia VARCHAR(100),
    infracciones TEXT,
    foto_url TEXT,
    deleted_at TIMESTAMP NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6a. Zonas Restringidas (Detección perimetral)
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

-- 6b. Tabla de Alertas Tácticas (Registros de IA)
CREATE TABLE IF NOT EXISTS alertas_tacticas (
    id SERIAL PRIMARY KEY,
    camara_id INT REFERENCES camaras(id) ON DELETE SET NULL,
    zona_id INT REFERENCES zonas_restringidas(id) ON DELETE SET NULL,
    tipo_alerta VARCHAR(50) NOT NULL, -- LPR, SOSPECHOSO, DESAPARECIDO, INTRUSION, ZONA_RESTRINGIDA
    nombre_captura VARCHAR(255),
    objetivo_referencia_id INT,
    nivel_confianza NUMERIC(5, 2) NOT NULL,
    ropa VARCHAR(255),
    foto_evidencia_url TEXT,
    fecha_hora_deteccion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vehiculos_placa ON vehiculos_lpr(placa);
CREATE INDEX IF NOT EXISTS idx_alertas_tipo ON alertas_tacticas(tipo_alerta);
CREATE INDEX IF NOT EXISTS idx_alertas_fecha ON alertas_tacticas(fecha_hora_deteccion DESC);

-- 7. Control de Empleados y Asistencia
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

CREATE UNIQUE INDEX IF NOT EXISTS ux_jornada_abierta ON asistencia_jornadas(empleado_id) WHERE salida IS NULL;
CREATE INDEX IF NOT EXISTS idx_jornada_entrada ON asistencia_jornadas(entrada DESC);

-- 8. Infraestructura de Módulos del Sistema
CREATE TABLE IF NOT EXISTS modulos_sistema (
    clave           VARCHAR(50) PRIMARY KEY,
    nombre          VARCHAR(100) NOT NULL,
    descripcion     TEXT,
    activo          BOOLEAN NOT NULL DEFAULT false,
    config          JSONB NOT NULL DEFAULT '{}',
    actualizado_por INT REFERENCES usuarios(id) ON DELETE SET NULL,
    actualizado_en  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO modulos_sistema (clave, nombre, descripcion, config) VALUES
 ('asistencia', 'Control de Asistencia', 'Marcación de ingreso y salida de empleados por biometría facial con cronómetro de permanencia.',
  '{"umbral_facial":0.50,"confirmaciones":3,"min_minutos_entre_marcas":2,"hora_cierre_automatico":"23:59"}'),
 ('zonas_restringidas', 'Zonas Restringidas', 'Detección perimetral por polígonos sobre cámaras y alerta inmediata ante intrusiones.',
  '{"segundos_permanencia":3,"cooldown_seg":60,"excluir_empleados":false}')
ON CONFLICT (clave) DO NOTHING;

-- 9. Tabla de Auditoría (Logs de acciones de usuarios)
CREATE TABLE IF NOT EXISTS logs_auditoria (
    id SERIAL PRIMARY KEY,
    usuario_id INT REFERENCES usuarios(id) ON DELETE SET NULL,
    accion VARCHAR(100) NOT NULL,
    entidad VARCHAR(100),
    entidad_id VARCHAR(50),
    detalles JSONB,
    ip_origen VARCHAR(45),
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
