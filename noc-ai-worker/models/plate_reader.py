"""Lazy, isolated plate OCR: no changes to facial model loading or settings."""
import cv2
import os
import threading
from models.plate_text import candidatos, DEFAULT_PATTERNS


def quality(crop):
    if crop is None or not crop.size:
        return 0., 0., 0.
    gray=cv2.cvtColor(crop,cv2.COLOR_BGR2GRAY)
    sharp=float(cv2.Laplacian(gray,cv2.CV_64F).var())
    contrast=float(gray.std())
    score=min(1.,crop.shape[1]/160)*min(1.,sharp/120)*min(1.,contrast/45)
    return score,sharp,contrast


def variants(crop):
    # Never downsample a usable plate. Upscaling is interpolation, not recovered detail.
    h,w=crop.shape[:2]
    if h<80:
        crop=cv2.resize(crop,(round(w*80/h),80),interpolation=cv2.INTER_CUBIC)
    gray=cv2.cvtColor(crop,cv2.COLOR_BGR2GRAY)
    enhanced=cv2.createCLAHE(clipLimit=2.,tileGridSize=(8,8)).apply(gray)
    return [('original',crop),('contraste',enhanced)]


def join_rows(results):
    """Group boxes by vertical overlap; preserve row order for two-line plates."""
    rows=[]
    for box,text,conf in sorted(results,key=lambda r:min(p[1] for p in r[0])):
        top,bottom=min(p[1] for p in box),max(p[1] for p in box)
        center=(top+bottom)/2
        row=next((r for r in rows if abs(r[0]-center)<max(8.,(bottom-top)*.6)),None)
        if row is None:
            row=[center,[]];rows.append(row)
        row[1].append((min(p[0] for p in box),text,float(conf)))
    ordered=[item for row in sorted(rows) for item in sorted(row[1])]
    return ''.join(i[1] for i in ordered),min((i[2] for i in ordered),default=0.)


class PlateReader:
    def __init__(self):
        self.reader=None
        self.lock=threading.Lock()

    def read(self,crop,patterns=DEFAULT_PATTERNS):
        with self.lock:
            if self.reader is None:
                import easyocr
                self.reader=easyocr.Reader(['en'],gpu=os.getenv('LPR_OCR_GPU','0')=='1',verbose=False)
            readings=[]
            for name,img in variants(crop):
                raw,conf=join_rows(self.reader.readtext(img,detail=1,paragraph=False,
                                    allowlist='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'))
                hypotheses=candidatos(raw,patterns)
                if len(hypotheses)==1:
                    plate,corrected=hypotheses[0]
                    readings.append(dict(plate=plate,raw=raw,confidence=conf,
                                         corrected=corrected,variant=name))
            # Different valid outputs from one frame are ambiguous: no vote.
            if len({r['plate'] for r in readings})!=1:
                return None
            return max(readings,key=lambda r:(not r['corrected'],r['confidence']))
