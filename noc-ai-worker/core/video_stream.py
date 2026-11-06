import cv2
import threading
import time
import os
from queue import Queue
from config import QUEUE_MAXSIZE, RECONNECT_ATTEMPTS_ANTES_DE_ESPERAR, MAX_INPUT_WIDTH, MAX_INPUT_HEIGHT, log
frame_queues = {}
stop_events = {}

def abrir_captura(cam_cfg: dict) -> cv2.VideoCapture:
    os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp|fflags;nobuffer|flags;low_delay"
    source  = cam_cfg["source"]
    backend = cam_cfg.get("backend")
    cap = cv2.VideoCapture(source, backend) if backend is not None else cv2.VideoCapture(source)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    return cap

def _resize_to_max(frame, max_w=MAX_INPUT_WIDTH, max_h=MAX_INPUT_HEIGHT):
    """
    Limita la resolución del frame de entrada a un máximo de 720p.
    Reduce la carga de procesamiento en ~50% para cámaras HD/4K
    sin perder calidad de detección (YOLO reescala internamente).
    """
    h, w = frame.shape[:2]
    if w <= max_w and h <= max_h:
        return frame
    
    scale = min(max_w / w, max_h / h)
    new_w = int(w * scale)
    new_h = int(h * scale)
    return cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_AREA)

class RTSPStream:
    """Hilo lector dedicado para vaciar el buffer de la cámara en tiempo real."""
    def __init__(self, cam_cfg, retain_full=None):
        self.cam_cfg = cam_cfg
        self.cap = abrir_captura(cam_cfg)
        self.ret = False
        self.frame = None
        self.frame_full = None
        self.frame_id = 0
        self.captured_at = None
        self.retain_full = retain_full or (lambda: False)
        self.lock = threading.Lock()
        self.running = True
        self.thread = threading.Thread(target=self._read_loop, daemon=True)
        self.thread.start()

    def _read_loop(self):
        fallos = 0
        source = self.cam_cfg.get("source", "")
        is_local_video = isinstance(source, str) and source.endswith(".mp4")
        
        if is_local_video:
            fps = self.cap.get(cv2.CAP_PROP_FPS)
            if fps == 0 or fps != fps: fps = 30
            delay = 1.0 / fps

        while self.running:
            ret, frame = self.cap.read()
            captured_at = time.time()
            
            if is_local_video:
                if not ret:
                    self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    continue
                time.sleep(delay)
            else:
                if not ret or frame is None or frame.size == 0 or frame.shape[0] == 0:
                    fallos += 1
                    if fallos >= RECONNECT_ATTEMPTS_ANTES_DE_ESPERAR:
                        log.warning(f"[{self.cam_cfg['id']}] Sin señal, reconectando lector...")
                        self.cap.release()
                        time.sleep(1.0)
                        self.cap = abrir_captura(self.cam_cfg)
                        fallos = 0
                    time.sleep(0.05)
                    continue
                fallos = 0
            
            # Limitar resolución de entrada a 720p para aliviar la GPU
            full = frame if self.retain_full() else None
            frame = _resize_to_max(frame)
            
            with self.lock:
                self.ret = ret
                self.frame = frame
                self.frame_full = full
                self.frame_id += 1
                self.captured_at = captured_at

    def read(self):
        with self.lock:
            return self.ret, self.frame

    def read_pair(self):
        # The two resolutions and identity always belong to the same source frame.
        with self.lock:
            return self.ret, self.frame, self.frame_full, self.frame_id, self.captured_at

    def release(self):
        self.running = False
        self.cap.release()
