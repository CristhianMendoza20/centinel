import os
import logging
import cv2

# ==========================================
# LOGGING
# ==========================================
logging.basicConfig(level=logging.INFO, format='%(asctime)s [CENTINEL] %(message)s')
log = logging.getLogger("CENTINEL-AI")
logging.getLogger('werkzeug').setLevel(logging.ERROR)

# ==========================================
# RUTAS DE CAPTURAS
# ==========================================
BASE_DIR = os.path.dirname(__file__)
CAPTURAS_DIR = os.path.join(BASE_DIR, 'capturas')

os.makedirs(os.path.join(CAPTURAS_DIR, 'sospechosos'), exist_ok=True)
os.makedirs(os.path.join(CAPTURAS_DIR, 'desaparecidos'), exist_ok=True)
os.makedirs(os.path.join(CAPTURAS_DIR, 'vehiculos'), exist_ok=True)
os.makedirs(os.path.join(CAPTURAS_DIR, 'vehiculos_registrados'), exist_ok=True)
os.makedirs(os.path.join(CAPTURAS_DIR, 'personas_registradas'), exist_ok=True)

# ==========================================
# APIS DEL BACKEND (NODE)
# ==========================================
API_BASE      = 'http://localhost:3000/api'
API_ALERTAS   = f'{API_BASE}/alertas'
API_PERSONAS  = f'{API_BASE}/personas'
API_DESAPAREC = f'{API_BASE}/desaparecidos'
API_VEHICULOS = f'{API_BASE}/vehiculos'
API_VEHICULOS_CAPTURADOS = f'{API_BASE}/vehiculos-capturados'
API_PERSONAS_CAPTURADAS = f'{API_BASE}/personas-capturadas'
API_ASISTENCIA_MARCAR   = f'{API_BASE}/asistencia/marcar'

# ==========================================
# CÁMARAS (Soporte Híbrido RTSP + MP4)
# ==========================================
# CAMARAS = [
#     # ================= EJEMPLOS RTSP / IP =================
#     # Cámara IP Dahua/Hikvision típica:
#     # {"id": "cam_ingreso", "nombre": "Ingreso Principal (RTSP)", "source": "rtsp://admin:password@192.168.0.100:554/cam/realmonitor?channel=1&subtype=1"},
#     
#     # Aplicación IP Webcam en Android (reemplaza 192.168.X.X por la IP de tu celular):
#     # {"id": "cam_celular", "nombre": "Celular IP Webcam", "source": "http://192.168.0.15:8080/video"},
#     
#     # ================= EJEMPLOS WEBCAM LOCAL =================
#     # Webcam de tu laptop o computadora (el número 0 suele ser la cámara por defecto):
#     # {"id": "cam_local", "nombre": "Webcam Laptop", "source": 0},
#     # {"id": "cam_usb", "nombre": "Webcam USB Externa", "source": 1},
# 
#     # ================= PRUEBAS SIMULADAS =================
#     # {"id": "1", "nombre": "Cam Test 1 (Simulación)", "source": "videos de prueba/video2.mp4"},
#     # {"id": "2", "nombre": "Cam Test 2 (Simulación)", "source": "videos de prueba/video3.mp4"}
# ]

# ==========================================
# RESOLUCIÓN MÁXIMA DE ENTRADA
# ==========================================
MAX_INPUT_WIDTH  = 1280   # Limitar frames de entrada a 720p (1280x720)
MAX_INPUT_HEIGHT = 720    # Reduce carga de procesamiento ~50% para cámaras HD/4K

# ==========================================
# PARÁMETROS DE RENDIMIENTO (GTX 1650 Ti 4GB / Ryzen 5 4600H / 16GB RAM)
# ==========================================
FRAME_SKIP         = 3      # Procesar 1 de cada N frames con YOLO (calibrado para 2 cámaras MP4)
YOLO_IMG_SIZE      = 640    # Resolución de inferencia YOLO (640 para mejor detección con yolov8n)
FACE_SCALE         = 0.5    # Factor de escala para face_recognition
JPEG_QUALITY       = 75     # Calidad del stream MJPEG al browser
COOLDOWN_SECONDS   = 8      # Segundos entre alertas del mismo sujeto (subido para evitar spam)
YOLO_CONFIDENCE    = 0.45   # Confianza mínima detección YOLO (subido de 0.40 → 0.45 para menos ruido)
FACE_TOLERANCE     = 0.35   # Tolerancia face matching (bajado a 0.35 para admitir rostros de perfil)
QUEUE_MAXSIZE      = 2      # Buffer de frames procesados por cámara
RECONNECT_ATTEMPTS_ANTES_DE_ESPERAR = 30   # Lecturas fallidas seguidas antes de reintentar conexión
MIN_ALERT_CONFIDENCE = 35.0  # Confianza mínima (%) para disparar una alerta real (bajado a 35 para pruebas)
CONFIRMACIONES_REQUERIDAS = 1  # Fuego instantáneo: lanza alerta al primer rostro reconocido

# --- FRAME_SKIP Adaptativo ---
FRAME_SKIP_MIN     = 2      # Mínimo frame skip cuando la GPU está ociosa (FPS alto)
FRAME_SKIP_MAX     = 8      # Máximo frame skip cuando la GPU está saturada (FPS bajo)
FPS_TARGET_LOW     = 25     # Si FPS cae por debajo, aumentar skip
FPS_TARGET_HIGH    = 35     # Si FPS sube por encima, reducir skip

# --- Filtro de ROI mínimo para InsightFace ---
MIN_FACE_ROI_WIDTH  = 40    # Píxeles mínimos de ancho del ROI (bajado a 40 para rostros lejanos/perfiles)
MIN_FACE_ROI_HEIGHT = 40    # Píxeles mínimos de alto del ROI

# --- ByteTrack (supervision) ---
TRACK_ACTIVATION_THRESHOLD = 0.45   # Umbral de confianza para activar un nuevo track (subido de 0.40)
LOST_TRACK_BUFFER          = 45     # Frames que un track "perdido" se mantiene vivo
MINIMUM_MATCHING_THRESHOLD = 0.8    # IOU mínimo para asociar detección con track existente
FACE_RECHECK_FRAMES        = 5      # Cada cuántos frames YOLO se re-verifica el rostro
FACE_AGGRESSIVE_ATTEMPTS   = 4      # Intentos agresivos iniciales de reconocimiento facial

# --- Detección de vehículos / LPR ---
VEHICLE_CLASSES = {2: "Auto", 3: "Moto", 5: "Bus", 7: "Camión"}
LPR_RECHECK_FRAMES   = 10    # Cada cuántos frames YOLO se re-intenta OCR en un vehículo
LPR_AGGRESSIVE_ATTEMPTS = 4  # Intentos iniciales agresivos de OCR para tracks nuevos
LPR_COOLDOWN_SECONDS = 30    # Cooldown entre alertas de la misma placa
PLATE_MIN_CHARS      = 6     # Mínimo de caracteres para considerar una placa válida (subido de 4 → 6)
LPR_CONFIRMACIONES   = 2     # Veces consecutivas que la MISMA placa debe leerse antes de alertar

# --- Regex para placas bolivianas estándar (1234-ABC o 1234ABC) ---
import re
PLATE_REGEX_BOLIVIA = re.compile(r'^[0-9]{3,4}[A-Z]{2,3}$')

# --- Mapeo de Colores ---
COLOR_MAP = {
    "sospechoso":  (0,   0,   255),   # Rojo
    "desaparecido":(0,   255, 255),   # Amarillo
    "empleado":    (0,   230, 115),   # Verde esmeralda
    "desconocido": (200, 200, 200),   # Gris
}

BASIC_COLORS = {
    "Rojo": (255, 0, 0), "Verde": (0, 255, 0), "Azul": (0, 0, 255),
    "Amarillo": (255, 255, 0), "Negro": (0, 0, 0), "Blanco": (255, 255, 255),
    "Gris": (128, 128, 128), "Naranja": (255, 165, 0), "Morado": (128, 0, 128)
}
