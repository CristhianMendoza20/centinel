"""Offline benchmark; never starts Flask, reads registry or sends alerts.

CSV columns: video,frame,track_id,x1,y1,x2,y2,plate_real,legible.
Use original image coordinates. One row per visible vehicle at a source frame.
Unknown truth stays empty; illegible=0 rows measure false confirmations only if
the true plate is independently known. Do not label from OCR output.
"""
import argparse
import csv
import json
import sys
import time
from pathlib import Path
import cv2
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--annotations',type=Path,required=True)
    parser.add_argument('--videos',type=Path,default=ROOT/'videos de prueba')
    parser.add_argument('--mode',choices=['legacy','v2'],required=True)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    rows=list(csv.DictReader(args.annotations.open(encoding='utf-8-sig')))
    if not rows: raise SystemExit('No hay vehículos anotados; no se puede medir precisión.')
    if args.mode=='legacy':
        from models.ocr_model import leer_placa
    else:
        from models.plate_detector import PlateDetector
        from models.plate_reader import PlateReader,quality
        detector,reader=PlateDetector(),PlateReader()
        if not detector.status()['model_available']:
            raise SystemExit('Falta el modelo dedicado: benchmark v2 no ejecutado.')
    results=[]
    for row in rows:
        cap=cv2.VideoCapture(str(args.videos/row['video']))
        cap.set(cv2.CAP_PROP_POS_FRAMES,int(row['frame']))
        ok,frame=cap.read();cap.release()
        if not ok: raise RuntimeError(f"No se pudo leer {row['video']}:{row['frame']}")
        x1,y1,x2,y2=[int(row[k]) for k in ('x1','y1','x2','y2')]
        if not (0<=x1<x2<=frame.shape[1] and 0<=y1<y2<=frame.shape[0]):
            raise ValueError('ROI fuera del frame')
        roi=frame[y1:y2,x1:x2];start=time.perf_counter();plate=None;conf=0
        if args.mode=='legacy': plate,conf=leer_placa(roi)
        else:
            boxes=detector.detect(roi)
            if len(boxes)==1:
                (a,b,c,d),_=boxes[0];crop=roi[b:d,a:c]
                _,sharp,contrast=quality(crop)
                if crop.shape[1]>=60 and crop.shape[0]>=12 and sharp>=60 and contrast>=10:
                    result=reader.read(crop)
                    if result and result['confidence']>=.65:
                        plate,conf=result['plate'],result['confidence']*100
        results.append(dict(row,plate=plate,confidence=conf,latency_ms=(time.perf_counter()-start)*1000))
    labeled=[r for r in results if r['plate_real'] and r['legible']=='1']
    read=[r for r in labeled if r['plate']]
    lat=[r['latency_ms'] for r in results]
    report=dict(mode=args.mode,scope='vehicle ROIs at annotated frames; not live camera FPS',
        samples=len(results),labeled_legible=len(labeled),
        read_rate=len(read)/len(labeled) if labeled else None,
        exact_accuracy=sum(r['plate']==r['plate_real'] for r in read)/len(read) if read else None,
        false_reads=sum(bool(r['plate']) and r['plate']!=r['plate_real'] for r in labeled) if labeled else None,
        latency_p50_ms=float(np.percentile(lat,50)),latency_p95_ms=float(np.percentile(lat,95)),
        roi_throughput_fps=1000*len(lat)/sum(lat),results=results)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k!='results'},indent=2))

if __name__=='__main__': main()
