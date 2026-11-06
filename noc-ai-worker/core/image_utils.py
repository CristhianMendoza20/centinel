import cv2
import numpy as np
import threading
from sklearn.cluster import KMeans
from config import BASIC_COLORS, COLOR_MAP

import base64

def cv2_to_base64(img, quality=85):
    """Convierte una imagen de cv2 a string de Base64 para enviar al backend."""
    if img is None or img.size == 0:
        return None
    _, buffer = cv2.imencode('.jpg', img, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    encoded = base64.b64encode(buffer).decode('utf-8')
    return f"data:image/jpeg;base64,{encoded}"

def rgb_a_nombre(r, g, b):
    min_dist = float('inf')
    closest = "Desconocido"
    for name, (cr, cg, cb) in BASIC_COLORS.items():
        dist = (r-cr)**2 + (g-cg)**2 + (b-cb)**2
        if dist < min_dist:
            min_dist = dist
            closest = name
    return closest

def extraer_colores_ropa(roi_bgr):
    h, w = roi_bgr.shape[:2]
    if h < 20 or w < 20:
        return "No determinado"
        
    torso = roi_bgr[int(h*0.2):int(h*0.55), :]
    piernas = roi_bgr[int(h*0.55):int(h*0.9), :]
    
    def dom_color(crop):
        if crop.size == 0: return "Desconocido"
        crop_rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
        pixels = crop_rgb.reshape((-1, 3))
        if len(pixels) > 500:
            pixels = pixels[np.random.choice(len(pixels), 500, replace=False)]
        kmeans = KMeans(n_clusters=1, random_state=42, n_init=1).fit(pixels)
        dom = kmeans.cluster_centers_[0]
        return rgb_a_nombre(dom[0], dom[1], dom[2])
        
    color_torso = dom_color(torso)
    color_piernas = dom_color(piernas)
    return f"Torso {color_torso}, Piernas {color_piernas}"

def mejorar_resolucion(img: np.ndarray, scale: int = 2) -> np.ndarray:
    if img is None or img.size == 0:
        return img
        
    h, w = img.shape[:2]
    if w * scale > 300 or h * scale > 300:
        scale = 1
        
    if scale > 1:
        img_scaled = cv2.resize(img, (w * scale, h * scale), interpolation=cv2.INTER_LANCZOS4)
    else:
        img_scaled = img.copy()
    
    blur = cv2.GaussianBlur(img_scaled, (0, 0), 2.0)
    img_sharp = cv2.addWeighted(img_scaled, 1.5, blur, -0.5, 0)
    
    yuv = cv2.cvtColor(img_sharp, cv2.COLOR_BGR2YUV)
    clahe = cv2.createCLAHE(clipLimit=1.5, tileGridSize=(4, 4))
    yuv[:, :, 0] = clahe.apply(yuv[:, :, 0])
    img_final = cv2.cvtColor(yuv, cv2.COLOR_YUV2BGR)
    
    return img_final
