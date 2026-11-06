import threading
import torch
from ultralytics import YOLO
import numpy as np
from config import log, YOLO_IMG_SIZE

DEVICE = 'cuda' if torch.cuda.is_available() else 'cpu'
log.info(f"Dispositivo de inferencia: {DEVICE.upper()}"
         + (f" ({torch.cuda.get_device_name(0)})" if DEVICE == 'cuda' else " — sin GPU detectada, usando CPU"))

if DEVICE == 'cuda':
    props = torch.cuda.get_device_properties(0)
    vram_gb = props.total_memory / (1024**3)
    log.info(f"VRAM disponible: {vram_gb:.1f} GB")

lock_yolo = threading.Lock()   # Protege la inferencia YOLO — solo un hilo a la vez

# ==========================================
# Usar YOLO11n (Nano) para maximizar fluidez en GTX 1650 Ti (4GB VRAM)
# yolo11n = ~2.6M params, ~22% más rápido que yolov8n y mayor mAP
# Con YOLO_IMG_SIZE=640 mantiene excelente detección de personas y vehículos
# ==========================================
log.info("Cargando modelo YOLO (Nano — optimizado para 4GB VRAM)...")
try:
    model = YOLO('yolo11n.pt')
    _modelo_usado = 'yolo11n.pt'
except Exception:
    log.warning("⚠️  No se pudo cargar yolo11n.pt — descargando...")
    model = YOLO('yolo11n.pt')
    _modelo_usado = 'yolo11n.pt'

model.to(DEVICE)

# Usar half precision (FP16) en CUDA para ahorrar ~50% de VRAM en inferencia
if DEVICE == 'cuda':
    model.fuse()
    log.info("Modelo fusionado y listo para FP16 (half precision).")

# Pre-calentar el modelo con un frame dummy
_warmup = np.zeros((YOLO_IMG_SIZE, YOLO_IMG_SIZE, 3), dtype=np.uint8)
model(_warmup, verbose=False)
log.info(f"Modelo YOLO ({_modelo_usado}) listo en {DEVICE.upper()} @ {YOLO_IMG_SIZE}px.")
