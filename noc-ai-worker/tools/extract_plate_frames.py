"""Extract original frames for manual plate annotation; no image enhancement."""
import argparse
from pathlib import Path
import cv2

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('video',type=Path)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--every',type=float,default=5)
    args=parser.parse_args()
    if args.every<=0: parser.error('--every must be positive')
    args.output.mkdir(parents=True,exist_ok=True)
    cap=cv2.VideoCapture(str(args.video));fps=cap.get(cv2.CAP_PROP_FPS)
    if fps<=0: raise SystemExit('Cannot read video FPS')
    step=max(1,round(args.every*fps))
    for index in range(0,int(cap.get(cv2.CAP_PROP_FRAME_COUNT)),step):
        cap.set(cv2.CAP_PROP_POS_FRAMES,index);ok,frame=cap.read()
        if ok: cv2.imwrite(str(args.output/f'{args.video.stem}_{index:07d}.png'),frame)
    cap.release()
