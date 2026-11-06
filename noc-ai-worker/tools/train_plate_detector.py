"""Explicit offline training only. Does not start or modify the running worker."""
import argparse
from pathlib import Path

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data',type=Path,required=True)
    parser.add_argument('--weights',type=Path,required=True,help='Trusted local YOLO starting weights')
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--device',default='cpu')
    parser.add_argument('--epochs',type=int,default=80)
    parser.add_argument('--batch',type=int,default=2)
    args=parser.parse_args()
    if not args.data.is_file() or not args.weights.is_file():
        parser.error('Dataset YAML and local starting weights must exist')
    from ultralytics import YOLO
    model=YOLO(str(args.weights))
    model.train(data=str(args.data.resolve()),imgsz=640,epochs=args.epochs,batch=args.batch,
                device=args.device,workers=0,project=str(args.output.resolve()),name='plate',exist_ok=False)
