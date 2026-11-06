"""Dedicated local plate model. No automatic downloads or half-vehicle fallback."""
import os
import threading
import math
from pathlib import Path


class PlateDetector:
    def __init__(self):
        base = Path(__file__).resolve().parent
        default = base/'weights'/'plate_v9.onnx'
        if not default.is_file():
            default = base/'weights'/'plate.onnx'
        if not default.is_file():
            default = base/'weights'/'plate.pt'
        self.path = Path(os.getenv('LPR_MODEL_PATH', str(default)))
        # CPU by default: keep existing facial GPU workload isolated during rollout.
        self.device = 'cpu' if self.path.suffix.lower()=='.onnx' else os.getenv('LPR_DEVICE', 'cpu')
        self.backend = 'onnx_cpu' if self.path.suffix.lower()=='.onnx' else 'ultralytics'
        self.model = None
        self.error = None
        self.attempted = False
        self.lock = threading.Lock()

    def status(self):
        return {'model_available': self.path.is_file(), 'loaded': self.model is not None,
                'device': self.device, 'error': self.error, 'backend': self.backend,
                'threads': 1 if self.backend=='onnx_cpu' else None}

    def detect(self, vehicle):
        if vehicle is None or not vehicle.size or min(vehicle.shape[:2])<2:
            return []
        with self.lock:
            if not self.attempted:
                self.attempted = True
                if not self.path.is_file():
                    self.error = 'Modelo dedicado de placas no instalado'
                    return []
                try:
                    if self.backend=='onnx_cpu':
                        from models.plate_onnx import OnnxPlateModel
                        self.model = OnnxPlateModel(self.path)
                    else:
                        from ultralytics import YOLO
                        self.model = YOLO(str(self.path))
                    names = {str(v).lower().replace('_',' ').replace('-',' ') for v in self.model.names.values()}
                    if not any('plate' in n or 'placa' in n or 'matricula' in n for n in names):
                        raise ValueError('El modelo no declara una clase de matrícula')
                except Exception as exc:
                    self.error = str(exc)
                    self.model = None
            if self.model is None:
                return []
            try:
                detections = self._predict(vehicle)
                self.error = None
            except Exception as exc:
                self.error = f'Plate inference failed: {type(exc).__name__}'
                return []
            h,w = vehicle.shape[:2]
            boxes=[]
            for (x1,y1,x2,y2),confidence in detections:
                mx,my=(x2-x1)*.05,(y2-y1)*.08
                box=(max(0,math.floor(x1-mx)),max(0,math.floor(y1-my)),min(w,math.ceil(x2+mx)),min(h,math.ceil(y2+my)))
                if box[2]>box[0] and box[3]>box[1]:
                    boxes.append((box,float(confidence)))
            return sorted(boxes,key=lambda item:item[1],reverse=True)

    def _predict(self, vehicle):
        if self.backend=='onnx_cpu':
            return self.model.predict(vehicle)
        result = self.model.predict(vehicle,imgsz=640,device=self.device,conf=.35,
                                    verbose=False,half=self.device!='cpu')[0]
        return [(b.xyxy[0].cpu().tolist(),float(b.conf.item())) for b in result.boxes
                if any(k in str(self.model.names[int(b.cls.item())]).lower() for k in ('plate','placa','matricula'))]
