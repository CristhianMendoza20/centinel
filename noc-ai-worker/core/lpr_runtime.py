"""Opt-in LPR pipeline. A missing dedicated model produces no invented plate crop."""
import os
import time
import uuid
from datetime import datetime, timezone
import cv2
from core.lpr_jobs import BoundedLprExecutor
from core.lpr_geometry import full_box
from core.plate_voting import PlateVoter
from core.image_utils import cv2_to_base64
from models.plate_detector import PlateDetector
from models.plate_reader import PlateReader, quality
from models.plate_text import DEFAULT_PATTERNS, confirmaciones_config
from services.lpr_delivery import deliver
from config import log

detector = PlateDetector()
reader = PlateReader()
executor = BoundedLprExecutor(4)


def enabled():
    return os.getenv('LPR_V2_ENABLED', '0') == '1'


def number(cfg, name, default, low, high):
    try:
        return max(low, min(high, float(cfg.get(name, default))))
    except (ValueError, TypeError):
        return default


def _jpeg(frame, max_width=None):
    if max_width and frame.shape[1] > max_width:
        ratio = max_width / frame.shape[1]
        frame = cv2.resize(frame, (max_width, round(frame.shape[0]*ratio)))
    return cv2_to_base64(frame, quality=85)


def process(frame, box, cfg):
    x1,y1,x2,y2 = box
    vehicle = frame[y1:y2, x1:x2]
    if not vehicle.size:
        return None
    boxes = detector.detect(vehicle)
    # Multiple plaques inside one vehicle ROI are ambiguous (occlusion/adjacent car).
    if len(boxes) != 1:
        return None
    (px1,py1,px2,py2), detection_conf = boxes[0]
    crop = vehicle[py1:py2, px1:px2]
    score, sharp, contrast = quality(crop)
    if crop.shape[1] < number(cfg,'min_ancho_placa',60,20,500) or crop.shape[0] < 12:
        return None
    if sharp < number(cfg,'min_nitidez',60,0,1000) or contrast < 10:
        return None
    patterns = cfg.get('formatos_placa') or DEFAULT_PATTERNS
    if not isinstance(patterns, (list,tuple)):
        patterns = DEFAULT_PATTERNS
    reading = reader.read(crop, patterns)
    if not reading or reading['confidence'] < number(cfg,'min_confianza_ocr',number(cfg,'umbral_ocr',.65,0,1),0,1):
        return None
    return dict(reading, quality=score, evidence={
        'foto_placa': _jpeg(crop), 'foto_vehiculo': _jpeg(vehicle,1280),
        'foto_contexto': _jpeg(frame,1024), 'raw': reading['raw'],
        'corrected': reading['corrected'], 'variant': reading['variant'],
        'quality': score, 'sharpness': sharp, 'detector_confidence': detection_conf,
        'box_plate': [x1+px1,y1+py1,x1+px2,y1+py2], 'box_vehicle': list(box)})


class LprSession:
    """Only the camera thread mutates tracks. Futures never mutate the camera state."""
    def __init__(self, cam_id, cam_name):
        self.session_id = str(uuid.uuid4())
        self.cam_id, self.cam_name = cam_id, cam_name
        self.tracks = {}
        self.closed = False

    def update(self, tid, frame_id, captured_at, small, full, box, kind, cfg):
        empty = {'placa':None,'tipo_vehiculo':kind,'matched':None,'conf':None}
        if self.closed or full is None:
            return empty
        self.expire()
        if tid not in self.tracks:
            if len(self.tracks) >= 16:
                return empty
            self.tracks[tid] = dict(voter=PlateVoter(),pending=None,last_frame=-1,
                last_submit=0.,last_seen=time.monotonic(),result=empty,
                event_id=str(uuid.uuid4()),sent=False,delivery=None,best={})
        state = self.tracks[tid]
        state['last_seen'] = time.monotonic()
        pending = state['pending']
        if pending and pending[0].done():
            state['pending'] = None
            future, source_id, source_time, submitted = pending
            try:
                result = future.result()
                if time.monotonic()-submitted <= 20 and result:
                    ev = dict(result['evidence'], captured_at=source_time)
                    # Keep only two best JPEG triplets per track, not 15 full images.
                    score=result['confidence']*result['quality']
                    best=state['best']
                    if score > best.get(result['plate'],(-1,None))[0]:
                        best[result['plate']] = (score,ev)
                        if len(best)>2:
                            del best[min(best,key=lambda key:best[key][0])]
                    metadata={k:v for k,v in ev.items() if not k.startswith('foto_')}
                    state['voter'].add(source_id,result['plate'],result['confidence'],result['quality'],metadata)
            except Exception as exc:
                log.warning('LPR: trabajo descartado (%s)', type(exc).__name__)
        consensus = state['voter'].resultado(confirmaciones_config(cfg),number(cfg,'min_ratio',.65,.5,1))
        # A correction is a hypothesis: require one independent uncorrected reading.
        if consensus and not any(s[1] == consensus['plate'] and not s[4].get('corrected',True)
                                 for s in state['voter'].samples if s[4]):
            consensus = None
        if consensus and consensus['plate'] in state['best'] and not state['sent']:
            # Local matching is display-only. Backend repeats exact match against current DB.
            import models.ocr_model as registry
            from models.plate_text import match_exacto
            with registry.lock_plates:
                matched = match_exacto(consensus['plate'],registry.known_plates,registry.known_plate_data)
            state['result'] = dict(placa=consensus['plate'],tipo_vehiculo=kind,
                                  matched=matched,conf=consensus['confidence']*100)
            delivery = state['delivery']
            if delivery is not None and delivery.done():
                state['sent'] = bool(delivery.result())
                state['delivery'] = None
            if not state['sent'] and state['delivery'] is None and time.monotonic()-state.get('last_delivery',0)>10:
                ev = state['best'][consensus['plate']][1]
                payload = dict(event_id=state['event_id'],session_id=self.session_id,track_id=str(tid),
                    camara_id=int(self.cam_id),placa=consensus['plate'],tipo_vehiculo=kind,
                    confianza=round(consensus['confidence']*100,2),votos=consensus['votes'],
                    ratio=consensus['ratio'],captured_at=datetime.fromtimestamp(ev['captured_at'],timezone.utc).isoformat(),
                    foto_placa=ev['foto_placa'],foto_vehiculo=ev['foto_vehiculo'],foto_contexto=ev['foto_contexto'],
                    evidencia={k:v for k,v in ev.items() if not k.startswith('foto_')})
                state.setdefault('payload', payload)
                state['delivery'] = deliver(state['payload'])
                state['last_delivery'] = time.monotonic()
        if not state['sent'] and state['pending'] is None and frame_id > state['last_frame'] and time.monotonic()-state['last_submit'] >= .25:
            future = executor.submit(process, full, full_box(box,small.shape,full.shape),dict(cfg))
            if future is not None:
                state['pending'] = (future,frame_id,captured_at,time.monotonic())
                state['last_frame'], state['last_submit'] = frame_id,time.monotonic()
        return state['result']

    def expire(self):
        for tid,state in list(self.tracks.items()):
            if time.monotonic()-state['last_seen'] > 10:
                if state['pending']:
                    state['pending'][0].cancel()
                del self.tracks[tid]

    def close(self):
        self.closed = True
        for state in self.tracks.values():
            if state['pending']:
                state['pending'][0].cancel()
        self.tracks.clear()
