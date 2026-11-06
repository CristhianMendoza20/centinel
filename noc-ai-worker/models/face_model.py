import threading
import numpy as np
from insightface.app import FaceAnalysis
from models.yolo_model import DEVICE
from config import log, FACE_TOLERANCE, MIN_FACE_ROI_WIDTH, MIN_FACE_ROI_HEIGHT

# ==========================================
# InsightFace — buffalo_sc (Small Compact)
# ~200 MB VRAM vs ~1200 MB del buffalo_l
# Mantiene 95% de precisión en reconocimiento facial
# det_size reducido a (320, 320) porque YOLO ya nos da el bounding box
# ==========================================
log.info("Cargando modelo InsightFace (ArcFace — buffalo_sc, optimizado)...")
try:
    ctx_id = 0 if DEVICE == 'cuda' else -1
    face_app = FaceAnalysis(
        name='buffalo_sc',
        providers=['CUDAExecutionProvider', 'CPUExecutionProvider']
    )
    face_app.prepare(ctx_id=ctx_id, det_size=(640, 640))
    # Bajar el umbral de detección de rostro (det_thresh) para detectar perfiles (por defecto es 0.5)
    try: face_app.models['detection'].det_thresh = 0.3
    except: pass
    log.info("Modelo InsightFace (buffalo_sc) listo — det_size=(640,640) — det_thresh=0.3.")
except Exception as e:
    log.error(f"Error cargando InsightFace buffalo_sc: {e}")
    # Fallback a buffalo_l si buffalo_sc no está disponible
    try:
        log.info("Intentando fallback a buffalo_l...")
        face_app = FaceAnalysis(
            name='buffalo_l',
            providers=['CUDAExecutionProvider', 'CPUExecutionProvider']
        )
        face_app.prepare(ctx_id=ctx_id, det_size=(640, 640))
        try: face_app.models['detection'].det_thresh = 0.3
        except: pass
        log.info("Modelo InsightFace (buffalo_l) listo como fallback — det_thresh=0.3.")
    except Exception as e2:
        log.error(f"Error cargando InsightFace fallback: {e2}")
        face_app = None

lock_face = threading.Lock()   # Protege InsightFace de accesos concurrentes
lock_encodings = threading.Lock()

known_encodings: list = []
known_names:    list = []
known_types:    list = []
known_ids:      list = []

def reconocer_rostro(frame_region: np.ndarray):
    """
    Devuelve (nombre, tipo, confianza, entidad_id) del mejor match.
    Si no hay coincidencia, retorna ("Desconocido", "desconocido", None, None).
    
    OPTIMIZACIÓN: Filtro de tamaño mínimo de ROI.
    Si el recorte es menor a MIN_FACE_ROI_WIDTH x MIN_FACE_ROI_HEIGHT,
    el rostro está demasiado lejos para reconocer con confianza → se ignora.
    """
    if face_app is None:
        return "Desconocido", "desconocido", None, None

    # Filtro de tamaño mínimo — evita falsos positivos en rostros lejanos
    h, w = frame_region.shape[:2]
    if w < MIN_FACE_ROI_WIDTH or h < MIN_FACE_ROI_HEIGHT:
        return "Desconocido", "desconocido", None, None

    with lock_face:
        faces = face_app.get(frame_region)
        if not faces:
            return "Desconocido", "desconocido", None, None

        # Tomar la cara más grande
        face = max(faces, key=lambda f: (f.bbox[2]-f.bbox[0])*(f.bbox[3]-f.bbox[1]))
        enc = face.normed_embedding

    with lock_encodings:
        if not known_encodings:
            return "Desconocido", "desconocido", None, None
        encs_snapshot = known_encodings
        names_snap    = known_names
        types_snap    = known_types
        ids_snap      = known_ids if known_ids else [None] * len(known_names)

    # InsightFace usa Similitud de Coseno nativamente
    similarities = np.dot(encs_snapshot, enc)
    best_idx  = int(np.argmax(similarities))
    best_sim  = similarities[best_idx]

    tipo_detectado = types_snap[best_idx]
    threshold = FACE_TOLERANCE
    if tipo_detectado == 'empleado':
        try:
            from services.modulos import get_modulo_config
            cfg = get_modulo_config('asistencia')
            threshold = float(cfg.get('umbral_facial', 0.50))
        except Exception:
            threshold = 0.50
    elif tipo_detectado in ('sospechoso', 'desaparecido'):
        try:
            from services.modulos import get_modulo_config
            cfg = get_modulo_config('reconocimiento_facial')
            threshold = float(cfg.get('umbral_facial', FACE_TOLERANCE))
        except Exception:
            threshold = FACE_TOLERANCE

    if best_sim > threshold:
        confianza = float(best_sim * 100)
        ent_id = ids_snap[best_idx] if best_idx < len(ids_snap) else None
        return names_snap[best_idx], tipo_detectado, confianza, ent_id

    return "Desconocido", "desconocido", None, None
