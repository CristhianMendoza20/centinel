import threading
import json
from config import log
from src.db import get_connection

lock_modulos = threading.Lock()
MODULOS_CACHE = {
    'reconocimiento_facial': {'activo': True, 'config': {}},
    'reconocimiento_placas': {'activo': True, 'config': {}},
    'asistencia': {'activo': False, 'config': {}},
    'zonas_restringidas': {'activo': False, 'config': {}}
}

def cargar_modulos_worker():
    """Carga el estado y configuración de los módulos desde la base de datos PostgreSQL."""
    global MODULOS_CACHE
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT clave, activo, config FROM modulos_sistema")
        rows = cur.fetchall()
        cur.close()

        nuevos_modulos = {}
        for row in rows:
            clave = row[0]
            activo = bool(row[1])
            raw_cfg = row[2]
            if isinstance(raw_cfg, str):
                try:
                    cfg = json.loads(raw_cfg)
                except Exception:
                    cfg = {}
            elif isinstance(raw_cfg, dict):
                cfg = raw_cfg
            else:
                cfg = {}

            nuevos_modulos[clave] = {
                'activo': activo,
                'config': cfg
            }

        with lock_modulos:
            MODULOS_CACHE = nuevos_modulos

        estados_str = ", ".join([f"{k}: {'✅ ACTIVO' if v['activo'] else '⏸ INACTIVO'}" for k, v in MODULOS_CACHE.items()])
        log.info(f"🔄 Módulos sincronizados en AI Worker ➔ {estados_str}")
        return True
    except Exception as e:
        log.warning(f"⚠️ No se pudo cargar estado de módulos de BD: {e}")
        return False
    finally:
        if conn:
            conn.close()

def modulo_activo(clave: str) -> bool:
    """Consulta rápida en memoria si un módulo está activado."""
    with lock_modulos:
        item = MODULOS_CACHE.get(clave)
        return bool(item and item.get('activo', False))

def get_modulo_config(clave: str) -> dict:
    """Obtiene la configuración JSON del módulo."""
    with lock_modulos:
        item = MODULOS_CACHE.get(clave)
        return item.get('config', {}) if item else {}
