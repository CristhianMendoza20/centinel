"""Explicit, pinned download of the plate-only ONNX model. Never run at startup."""
import hashlib
import argparse
import json
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parents[1]
REVISION = '251a30d7daedca065f56e04b0af04052c907c68f'
SHA256 = '693133a1db97a3ba1e90068986f80afb72c3fcddb681e57181a89a9a3dc351d6'
SOURCE = 'https://huggingface.co/morsetechlab/yolov11-license-plate-detection'
URL = f'{SOURCE}/resolve/{REVISION}/license-plate-finetune-v1n.onnx'


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--variant',choices=['v9','v11'],default='v9')
    args=parser.parse_args()
    folder = ROOT/'models'/'weights'
    folder.mkdir(parents=True, exist_ok=True)
    use_v9=args.variant=='v9'
    digest='888397b96d761c89db40bc9c305838e8652660f5e282c2cadebbe8d2951a77a8' if use_v9 else SHA256
    source='https://github.com/ankandrew/open-image-models' if use_v9 else SOURCE
    original='yolo-v9-t-384-license-plates-end2end.onnx' if use_v9 else 'license-plate-finetune-v1n.onnx'
    url=f'{source}/releases/download/assets/{original}' if use_v9 else URL
    target = folder/('plate_v9.onnx' if use_v9 else 'plate.onnx')
    candidate=folder/'plate_v9_candidate.onnx'
    if use_v9 and not target.exists() and candidate.is_file():
        data=candidate.read_bytes()
        if hashlib.sha256(data).hexdigest()==digest: target.write_bytes(data)
    if target.exists():
        if hashlib.sha256(target.read_bytes()).hexdigest() != digest:
            raise SystemExit('Existing model differs; it was not overwritten.')
    else:
        partial = target.with_suffix('.onnx.download')
        with requests.get(url, stream=True, timeout=(20,60)) as response:
            response.raise_for_status()
            with partial.open('wb') as output:
                for chunk in response.iter_content(1024*1024):
                    output.write(chunk)
        if hashlib.sha256(partial.read_bytes()).hexdigest() != digest:
            raise SystemExit('Checksum mismatch; download not installed.')
        partial.replace(target)
    manifest = dict(source=source, revision='release asset 195700452' if use_v9 else REVISION, sha256=digest,
        original_file=original, license='Repository MIT; release has no separate weights license metadata' if use_v9 else 'AGPL-3.0',
        purpose='Plate bounding boxes only; OCR and facial models are separate.',
        limitations='Local evaluation required. No Bolivia accuracy claim. False boxes remain possible.')
    target.with_suffix('.provenance.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    print(json.dumps(dict(installed=str(target),sha256=digest)))

if __name__=='__main__': main()
