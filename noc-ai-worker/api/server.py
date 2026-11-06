from flask import Flask, Response, request
import cv2
import numpy as np
import os
from queue import Empty
import models.face_model as face_model
import models.ocr_model as ocr_model
from core.video_stream import frame_queues
from models.yolo_model import DEVICE
from config import CAPTURAS_DIR, JPEG_QUALITY, log
from services.api_client import obtener_camaras_activas

def _lpr_status():
    from core.lpr_runtime import detector, enabled
    if not enabled():
        return {'version': 'legacy', 'ready': ocr_model.ocr_reader is not None}
    state = detector.status()
    return dict(state, version='v2', ready=state['loaded'] and not state['error'])

def check_worker_auth(req):
    expected = os.getenv('WORKER_API_KEY', '')
    if not expected:
        return True
    provided = req.headers.get('x-worker-key', '')
    return provided == expected

app = Flask(__name__, static_folder=CAPTURAS_DIR, static_url_path='/capturas')

@app.after_request
def _add_cors_headers(resp):
    resp.headers['Access-Control-Allow-Origin'] = '*'
    resp.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    resp.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, x-worker-key'
    return resp

def generate_stream(cam_id: str):
    q = frame_queues[cam_id]
    while True:
        try:
            frame = q.get(timeout=3.0)
        except Empty:
            blank = np.zeros((480, 640, 3), dtype=np.uint8)
            cv2.putText(blank, "Esperando señal...", (200, 240),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (80, 80, 80), 2)
            frame = blank

        ok, buf = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
        if not ok:
            continue
        yield (b'--frame\r\nContent-Type: image/jpeg\r\n\r\n'
               + buf.tobytes() + b'\r\n')

@app.route('/video_feed')
def video_feed():
    camaras_db = obtener_camaras_activas()
    cam_id = camaras_db[0]["id"] if len(camaras_db) > 0 else None
    if cam_id is None or cam_id not in frame_queues:
        return {"error": "No hay cámaras configuradas en la BD"}, 404
    return Response(generate_stream(cam_id),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/video_celular')
def video_celular():
    camaras_db = obtener_camaras_activas()
    cam_id = camaras_db[1]["id"] if len(camaras_db) > 1 else None
    if cam_id is None or cam_id not in frame_queues:
        return {"error": "Segunda cámara no está configurada en la BD"}, 404
    return Response(generate_stream(cam_id),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/video_feed/<cam_id>')
def video_feed_dinamico(cam_id):
    if cam_id not in frame_queues:
        return {"error": f"cámara '{cam_id}' no configurada"}, 404
    return Response(generate_stream(cam_id),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/status')
def status():
    with face_model.lock_encodings:
        n = len(face_model.known_encodings)
    with ocr_model.lock_plates:
        n_plates = len(ocr_model.known_plates)
    return {
        "status": "online",
        "perfiles_cargados": n,
        "vehiculos_lista_negra": n_plates,
        "lpr_activo": _lpr_status()['ready'],
        "lpr": _lpr_status(),
        "dispositivo_ia": DEVICE,
        "camaras": [{"id": cam["id"], "nombre": cam["nombre"]} for cam in obtener_camaras_activas()],
    }

@app.route('/reload_cameras', methods=['POST', 'OPTIONS'])
def reload_cameras():
    from flask import request
    from core.video_stream import frame_queues, stop_events
    from core.engine import hilo_ia
    import threading
    from services.api_client import obtener_camaras_activas, cargar_base_datos_centinel
    from config import QUEUE_MAXSIZE
    from queue import Queue

    if request.method == 'OPTIONS':
        return Response(status=204)

    if not check_worker_auth(request):
        return {"error": "No autorizado: clave x-worker-key inválida"}, 401

    # 1. Recargar rostros y placas
    log.info("Recargando base de datos biométrica y LPR...")
    threading.Thread(target=cargar_base_datos_centinel, daemon=True).start()

    # 2. Recargar cámaras
    camaras_db = obtener_camaras_activas()
    active_ids = {str(c["id"]) for c in camaras_db}
    current_ids = set(frame_queues.keys())
    
    removed = current_ids - active_ids
    added = active_ids - current_ids

    # Detener cámaras eliminadas o inactivadas
    for cid in removed:
        if cid in stop_events:
            stop_events[cid].set()
            log.info(f"[{cid}] Señal de parada enviada.")
        if cid in frame_queues:
            del frame_queues[cid]
            
    # Iniciar nuevas cámaras
    for cam_cfg in camaras_db:
        cid = str(cam_cfg["id"])
        if cid in added:
            frame_queues[cid] = Queue(maxsize=QUEUE_MAXSIZE)
            stop_events[cid] = threading.Event()
            threading.Thread(target=hilo_ia, args=(cam_cfg,), daemon=True).start()
            log.info(f"[{cid}] Hilo lanzado (Reload) — {cam_cfg['nombre']}")

    return {"ok": True, "added": list(added), "removed": list(removed)}

@app.route('/reload_modules', methods=['POST', 'OPTIONS'])
def reload_modules():
    if request.method == 'OPTIONS':
        return Response(status=204)

    if not check_worker_auth(request):
        return {"error": "No autorizado: clave x-worker-key inválida"}, 401

    import threading
    from services.modulos import cargar_modulos_worker
    from services.api_client import cargar_base_datos_centinel
    from core.engine import track_identities, track_vehicle_ids

    ok = cargar_modulos_worker()
    if ok:
        threading.Thread(target=cargar_base_datos_centinel, daemon=True).start()
        track_identities.clear()
        track_vehicle_ids.clear()
        log.info("🔄 Módulos actualizados: recargando base de datos y reseteando caché de tracking...")
    return {"ok": ok}

def start_server():
    camaras_db = obtener_camaras_activas()
    log.info(f"✅ {len(camaras_db)} cámara(s) activa(s). Iniciando servidor Flask en :5000")
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True, use_reloader=False)
