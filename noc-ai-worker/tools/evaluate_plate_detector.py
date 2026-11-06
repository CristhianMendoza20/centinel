"""Offline video evaluation. No engine, face model, DB, API or notifications."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import sys
import time
import cv2
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--videos',nargs='+',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--every',type=float,default=2)
    parser.add_argument('--ocr',action='store_true')
    parser.add_argument('--model',type=Path)
    args=parser.parse_args()
    if args.every<=0: parser.error('--every must be positive')
    args.output.mkdir(parents=True,exist_ok=True)
    if args.model: os.environ['LPR_MODEL_PATH']=str(args.model.resolve())
    if os.name=='nt':
        import ctypes
        ctypes.windll.kernel32.SetPriorityClass(ctypes.windll.kernel32.GetCurrentProcess(),0x4000)
    import torch
    # Offline process only: no global settings in the production worker change.
    torch.set_num_threads(1)
    cv2.setNumThreads(1)
    from ultralytics import YOLO
    from models.plate_detector import PlateDetector
    from models.plate_reader import quality,PlateReader
    vehicles=YOLO(str(ROOT/'yolo11n.pt'))
    detector=PlateDetector()
    reader=PlateReader()
    if not detector.status()['model_available']: raise SystemExit('No local plate model')
    report={'mode':'offline_cpu','sampling_seconds':args.every,'ground_truth_available':False,
            'accuracy':None,'modules_started':['vehicle_detector','plate_detector'], 'videos':[]}
    for video in args.videos:
        started=time.perf_counter()
        checksum=hashlib.sha256(video.read_bytes()).hexdigest()
        cap=cv2.VideoCapture(str(video));fps=cap.get(cv2.CAP_PROP_FPS);count=int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        source_size=[int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))]
        if fps<=0: raise RuntimeError(f'Cannot open {video.name}')
        rows=[];latencies=[];vehicle_calls=0;sampled=0;preview=[];ocr_count=0;errors=0
        for index in range(0,count,max(1,round(fps*args.every))):
            cap.set(cv2.CAP_PROP_POS_FRAMES,index);ok,frame=cap.read()
            if not ok: errors+=1;continue
            sampled+=1
            prediction=vehicles.predict(frame,imgsz=640,device='cpu',conf=.45,classes=[2,3,5,7],verbose=False)[0]
            for box in prediction.boxes:
                x1,y1,x2,y2=map(int,box.xyxy[0].cpu().tolist())
                x1,y1=max(0,x1),max(0,y1);x2,y2=min(frame.shape[1],x2),min(frame.shape[0],y2)
                roi=frame[y1:y2,x1:x2]
                if not roi.size: continue
                vehicle_calls+=1;start=time.perf_counter();plates=detector.detect(roi)
                latencies.append((time.perf_counter()-start)*1000)
                for (a,b,c,d),confidence in plates:
                    crop=roi[b:d,a:c];score,sharp,contrast=quality(crop)
                    eligible=len(plates)==1 and c-a>=60 and d-b>=12 and sharp>=60 and contrast>=10
                    row=dict(video=video.name,frame=index,second=round(index/fps,3),
                        vehicle_box=[x1,y1,x2,y2],plate_box=[x1+a,y1+b,x1+c,y1+d],
                        confidence=confidence,width=c-a,height=d-b,sharpness=sharp,contrast=contrast,
                        quality=score,ocr_eligible=eligible,reading=None)
                    if args.ocr and eligible and ocr_count<20:
                        row['reading']=reader.read(crop);ocr_count+=1
                        if row['reading'] and row['reading']['confidence']<.65: row['reading']=None
                    rows.append(row)
                    # Bound retained previews while scanning long videos.
                    rank=(int(eligible),score,confidence)
                    if len(preview)<24 or rank>min(p[0] for p in preview):
                        preview.append((rank,frame.copy(),row))
                        preview.sort(key=lambda p:p[0],reverse=True);preview=preview[:24]
            if sampled%20==0: print(json.dumps(dict(video=video.name,sampled=sampled,plate_boxes=len(rows))),flush=True)
        cap.release()
        dest=args.output/video.stem;dest.mkdir(exist_ok=True)
        for k,(_,frame,row) in enumerate(preview):
            a,b,c,d=row['plate_box'];crop=frame[b:d,a:c]
            stem=f'{k:02d}_frame{row["frame"]}'
            cv2.imwrite(str(dest/f'{stem}_plate.png'),crop)
            cv2.rectangle(frame,(a,b),(c,d),(0,255,255),2)
            cv2.putText(frame,f'{row["second"]}s | {row["width"]}x{row["height"]} | {row["confidence"]:.2f}',
                        (10,25),cv2.FONT_HERSHEY_SIMPLEX,.65,(0,255,255),2)
            cv2.imwrite(str(dest/f'{stem}_context.jpg'),frame)
        summary=dict(video=video.name,sha256=checksum,fps=fps,source_frames=count,
            source_size=source_size,
            duration_seconds=count/fps,sampled_frames=sampled,vehicle_rois=vehicle_calls,
            detected_plate_boxes=len(rows),eligible_ocr_crops=sum(r['ocr_eligible'] for r in rows),
            ocr_calls=ocr_count,ocr_candidates=sum(bool(r['reading']) for r in rows),
            detector_p50_ms=float(np.percentile(latencies,50)) if latencies else None,
            detector_p95_ms=float(np.percentile(latencies,95)) if latencies else None,
            total_seconds=time.perf_counter()-started,decode_errors=errors,
            source_unchanged=hashlib.sha256(video.read_bytes()).hexdigest()==checksum,observations=rows)
        report['videos'].append(summary)
        print(json.dumps({k:v for k,v in summary.items() if k!='observations'}),flush=True)
        report['detector_status']=detector.status()
        (args.output/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    if any(video['ocr_calls'] for video in report['videos']):
        report['modules_started'].append('plate_ocr')
    (args.output/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')

if __name__=='__main__': main()
