import threading
import os
import re
import cv2
import easyocr
import numpy as np
from config import log, PLATE_MIN_CHARS, PLATE_REGEX_BOLIVIA, LPR_CONFIRMACIONES

# ==========================================
# EasyOCR — HABILITADO EN GPU
# La GTX 1650 Ti (4GB VRAM) soporta YOLO11n + InsightFace + EasyOCR simultáneamente
# ==========================================
log.info("Preparando OCR LPR...")
try:
    # V2 owns a lazy isolated reader; never allocate the old GPU reader as well.
    ocr_reader = None if os.getenv('LPR_V2_ENABLED', '0') == '1' else easyocr.Reader(['en'], gpu=True, verbose=False)
    log.info("OCR LPR preparado.")
except Exception as e:
    log.warning(f"⚠️ No se pudo cargar EasyOCR: {e} — LPR deshabilitado")
    ocr_reader = None

lock_plates = threading.Lock()
lock_ocr = threading.Lock()

known_plates: list = []
known_plate_data: list = []

def _preprocesar_placa(roi_placa: np.ndarray) -> np.ndarray:
    """
    Preprocesamiento mejorado para OCR de placas:
    1. Escala de grises
    2. Bilateral filter (suaviza sin perder bordes)
    3. CLAHE (mejora contraste local)
    4. Binarización de Otsu (separa texto del fondo de forma adaptativa)
    """
    gray = cv2.cvtColor(roi_placa, cv2.COLOR_BGR2GRAY)
    blur = cv2.bilateralFilter(gray, 9, 75, 75)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(blur)
    # Binarización de Otsu — se adapta a cualquier condición de luz
    _, otsu = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return otsu

def validar_placa_bolivia(texto: str) -> bool:
    """
    Valida que el texto detectado coincida con el formato estándar
    de placas bolivianas: 3-4 dígitos + 2-3 letras (ej: 1234ABC, 123AB).
    Esto elimina falsos positivos de señales de tránsito, publicidad, etc.
    """
    limpio = re.sub(r'[^A-Z0-9]', '', texto.upper())
    return bool(PLATE_REGEX_BOLIVIA.match(limpio))

def leer_placa(frame_region: np.ndarray):
    """
    Ejecuta OCR sobre la región de un vehículo detectado.
    Devuelve (placa_texto, confianza) o (None, None).
    
    OPTIMIZACIONES:
    - Preprocesamiento mejorado con Otsu
    - Validación de formato boliviano
    - Mínimo 6 caracteres (antes era 4)
    """
    if ocr_reader is None:
        return None, None

    try:
        h, w = frame_region.shape[:2]
        # Tomar la parte inferior donde generalmente está la placa
        roi_placa = frame_region[int(h * 0.4):h, :]
        if roi_placa.size == 0:
            roi_placa = frame_region

        # Preprocesamiento mejorado
        processed = _preprocesar_placa(roi_placa)

        with lock_ocr:
            resultados = ocr_reader.readtext(
                processed, 
                detail=1, 
                paragraph=False,
                allowlist='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
            )

        if not resultados:
            return None, None

        mejor_placa = None
        mejor_conf  = 0.0
        for (bbox, texto, conf) in resultados:
            limpio = re.sub(r'[^A-Z0-9]', '', texto.upper())
            # Validar longitud mínima Y formato boliviano
            if len(limpio) >= PLATE_MIN_CHARS and conf > mejor_conf and validar_placa_bolivia(limpio):
                mejor_placa = limpio
                mejor_conf  = conf

        if mejor_placa:
            return mejor_placa, mejor_conf * 100
        return None, None

    except Exception as ex:
        log.warning(f"Error en OCR de placa: {ex}")
        return None, None
