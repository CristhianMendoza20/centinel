import threading
import time

from config import log
from services.api_client import cargar_base_datos_centinel, obtener_camaras_activas
from services.modulos import cargar_modulos_worker
from api.server import start_server
from core.engine import hilo_ia

def recargar_bd_periodico(intervalo_seg: int = 600):
    """Recarga la BD biométrica cada N segundos (hot-reload en 2do plano)."""
    while True:
        time.sleep(intervalo_seg)
        log.info("🔄 Recargando base de datos biométrica...")
        cargar_base_datos_centinel()
        cargar_modulos_worker()

if __name__ == '__main__':
    log.info("═══════════════════════════════════════")
    log.info("  CENTINEL — AI WORKER v1.0 (MODULAR)")
    log.info("═══════════════════════════════════════")

    # Cargar estado de módulos del sistema
    cargar_modulos_worker()

    # Cargar base de datos biométrica al inicio
    cargar_base_datos_centinel()

    # Hilo de recarga periódica de BD (hot-reload cada 15 min)
    threading.Thread(target=recargar_bd_periodico, args=(900,), daemon=True).start()

    # Iniciar un hilo de IA por cada cámara configurada
    camaras_db = obtener_camaras_activas()
    if not camaras_db:
        log.warning("⚠️ No se encontraron cámaras activas en la Base de Datos.")
        log.warning("👉 Ve a 'Gestión de Cámaras' en el Frontend Web y registra una cámara.")
    else:
        log.info(f"✅ Se encontraron {len(camaras_db)} cámara(s) activa(s) en la Base de Datos.")

    from core.video_stream import frame_queues, stop_events
    from queue import Queue
    import threading
    from config import QUEUE_MAXSIZE

    for cam_cfg in camaras_db:
        cid = str(cam_cfg["id"])
        frame_queues[cid] = Queue(maxsize=QUEUE_MAXSIZE)
        stop_events[cid] = threading.Event()
        threading.Thread(target=hilo_ia, args=(cam_cfg,), daemon=True).start()
        log.info(f"[{cam_cfg['id']}] Hilo lanzado — {cam_cfg['nombre']}")

    # Iniciar servidor Flask (bloqueante)
    start_server()
