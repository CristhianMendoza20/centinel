# 🐍 CENTINEL — AI Worker

Servicio en Python que detecta personas y vehículos (YOLOv8), realiza seguimiento (ByteTrack), extrae placas (EasyOCR), reconoce rostros (InsightFace/ArcFace) contra la base biométrica, transmite video procesado, y dispara alertas al backend.

Soporta **cualquier cantidad de cámaras**: webcam local, celular con IP Webcam, cámaras IP y analógicas (DVR/NVR) Hikvision o Dahua vía RTSP.

---

## Arquitectura (Fase 3: Modularización)

El proyecto está diseñado bajo una arquitectura de micro-módulos altamente concurrente:

```text
noc-ai-worker/
├── main.py                # Orquestador (Entrypoint)
├── config.py              # Variables de configuración y thresholds
├── api/
│   └── server.py          # Endpoints Flask (video_feed, status)
├── core/
│   ├── engine.py          # Lógica Pipeline IA (YOLO + Tracks + OCR + Face)
│   ├── image_utils.py     # Mejora de color, upscaling y guardado asíncrono
│   └── video_stream.py    # Subproceso RTSPStream y vaciado de colas OpenCV
├── models/
│   ├── face_model.py      # InsightFace / ArcFace wrapper
│   ├── ocr_model.py       # EasyOCR wrapper
│   └── yolo_model.py      # Ultralytics YOLOv8 setup
└── services/
    └── api_client.py      # Comunicación HTTP con Backend Node
```

---

## Requisitos previos

| Herramienta | Versión mínima |
|------------|-----------------|
| Python     | 3.10+           |
| pip        | actualizado     |

### Hardware Recomendado
- **GPU (Altamente recomendado):** GPU NVIDIA con soporte CUDA (ej. GTX 1650 Ti). Requerido para procesamiento múltiple fluido.
- **RAM:** 8 GB mínimo, 16 GB recomendado.

---

## Instalación

```bash
cd noc-ai-worker

# Crear y activar entorno virtual
py -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate     # Linux / macOS
```

### 1. PyTorch (con CUDA)
Para máxima velocidad en Windows:
```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
```

### 2. Resto de Dependencias
```bash
pip install -r requirements.txt
```

---

## Configurar cámaras y Tolerancias

La configuración global se maneja en `config.py`. 

Edita la lista `CAMARAS` para agregar o eliminar fuentes de video:

```python
CAMARAS = [
    {"id": "cam1", "nombre": "Webcam Laptop", "source": 0, "backend": cv2.CAP_DSHOW},
    {"id": "cam_lpr_1", "nombre": "RTSP Hikvision", "source": "rtsp://USER:PASS@IP:554/Streaming/Channels/101"},
]
```

En el mismo archivo `config.py`, puedes ajustar el hardware:
- `FRAME_SKIP`: Frames a omitir para aligerar la GPU.
- `YOLO_CONFIDENCE` / `FACE_TOLERANCE`: Umbrales de precisión de IA.

---

## Instalación de Dependencias e Inicio

Es muy importante que la instalación de dependencias se complete al 100% (si la cancelas, faltarán módulos como `psycopg2-binary`).

1. Elimina paquetes conflictivos si es necesario:
```bash
pip uninstall onnxruntime -y
```

2. Instala los requerimientos completos (incluyendo soporte GPU para reconocimiento facial):
```bash
pip install -r requirements.txt
```

3. Ejecuta el worker:
```bash
python main.py
```

Salida esperada (con GPU):
```
═══════════════════════════════════════
  CENTINEL — AI WORKER v3.0 (MODULAR)
═══════════════════════════════════════
[CENTINEL] Dispositivo de inferencia: CUDA (NVIDIA GeForce GTX 1650 Ti)
[CENTINEL] Modelo YOLO (yolov8s.pt) listo en CUDA.
[CENTINEL] Modelo InsightFace listo.
[CENTINEL] Modelo EasyOCR listo.
[CENTINEL] ✅ 1 cámara(s) activa(s). Iniciando servidor Flask en :5000
```

### Endpoints del Worker

| Ruta                        | Descripción                                             |
|------------------------------|----------------------------------------------------------|
| `GET /video_feed/<cam_id>`   | Stream MJPEG en vivo de la cámara especificada en `config.py` |
| `GET /status`                | Estado general, RAM, CUDA, Modelos, Perfiles cargados    |

---

## Solución de problemas

### ❌ `torch.cuda.is_available()` da `False`
- Verifica que tienes drivers NVIDIA actualizados (`nvidia-smi`).
- Reinstala PyTorch con el flag `cu118` o `cu121` según soporte de tu tarjeta gráfica.

### ❌ Error al cargar InsightFace o EasyOCR
El worker intentará degradar elegantemente si alguno de estos modelos falla, notificando en los logs y funcionando parcialmente (solo YOLO). Asegúrate de tener las dependencias correctas instaladas desde el `requirements.txt`.
