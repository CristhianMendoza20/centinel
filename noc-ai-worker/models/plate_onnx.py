"""Plate-only YOLO ONNX inference using a local, single-thread CPU session."""
import ast
import hashlib
import cv2
import numpy as np


def letterbox(image, size=640):
    height, width = image.shape[:2]
    scale = min(size/width, size/height)
    resized_width, resized_height = max(1,round(width*scale)), max(1,round(height*scale))
    left, top = (size-resized_width)//2, (size-resized_height)//2
    canvas = np.full((size,size,3),114,dtype=np.uint8)
    canvas[top:top+resized_height,left:left+resized_width] = cv2.resize(image,(resized_width,resized_height))
    tensor = np.ascontiguousarray(canvas[:,:,::-1].transpose(2,0,1)[None],dtype=np.float32)/255.
    # Actual X/Y resize factors account for rounding, including very thin ROIs.
    return tensor, (resized_width/width,resized_height/height,left,top)


def decode(output, transform, image_shape, threshold=.35):
    raw = np.asarray(output)
    if raw.ndim != 3 or raw.shape[0] != 1 or raw.shape[1] != 5:
        raise ValueError('Expected raw single-class YOLO output [1,5,N]')
    rows = raw[0].T
    rows = rows[np.isfinite(rows).all(axis=1) & (rows[:,4]>=threshold)]
    sx,sy,left,top = transform
    height,width = image_shape[:2]
    boxes,scores = [],[]
    for cx,cy,bw,bh,score in rows:
        x1 = max(0., min(width, (cx-bw/2-left)/sx))
        y1 = max(0., min(height, (cy-bh/2-top)/sy))
        x2 = max(0., min(width, (cx+bw/2-left)/sx))
        y2 = max(0., min(height, (cy+bh/2-top)/sy))
        if x2>x1 and y2>y1 and score<=1:
            boxes.append([float(x1),float(y1),float(x2-x1),float(y2-y1)])
            scores.append(float(score))
    if not boxes:
        return []
    kept = cv2.dnn.NMSBoxes(boxes,scores,threshold,.45)
    return [((boxes[i][0],boxes[i][1],boxes[i][0]+boxes[i][2],boxes[i][1]+boxes[i][3]),scores[i])
            for i in np.asarray(kept).reshape(-1)]


class OnnxPlateModel:
    def __init__(self, path):
        import onnxruntime as ort
        options = ort.SessionOptions()
        options.intra_op_num_threads = 1
        options.inter_op_num_threads = 1
        options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
        # No process-global thread/GPU settings are changed.
        options.add_session_config_entry('session.intra_op.allow_spinning','0')
        options.add_session_config_entry('session.inter_op.allow_spinning','0')
        self.session = ort.InferenceSession(str(path),sess_options=options,providers=['CPUExecutionProvider'])
        metadata = self.session.get_modelmeta().custom_metadata_map
        names = ast.literal_eval(metadata.get('names','{}'))
        self.end_to_end = False
        self.size = 640
        # This published YOLOv9 graph has no metadata. Only the pinned plate
        # artifact may use its [batch,x1,y1,x2,y2,class,score] output contract.
        if not names:
            with open(path,'rb') as model_file:
                digest=hashlib.sha256(model_file.read()).hexdigest()
            if digest!='888397b96d761c89db40bc9c305838e8652660f5e282c2cadebbe8d2951a77a8':
                raise ValueError('Unidentified ONNX model without plate metadata')
            names={0:'License Plate'}
            self.end_to_end=True
            self.size=384
        if not isinstance(names,dict) or len(names)!=1 or 0 not in names or not any(
                word in str(names[0]).lower() for word in ('plate','placa','matricula')):
            raise ValueError('Expected one explicitly named plate class')
        inputs = self.session.get_inputs()
        if len(inputs)!=1 or inputs[0].type!='tensor(float)' or len(inputs[0].shape)!=4:
            raise ValueError('Unsupported plate model input')
        self.input_name = inputs[0].name
        self.names = names

    def predict(self, image):
        tensor,transform = letterbox(image,self.size)
        output = self.session.run(None,{self.input_name:tensor})[0]
        if self.end_to_end:
            return decode_end_to_end(output,transform,image.shape)
        return decode(output,transform,image.shape)


def decode_end_to_end(output,transform,image_shape,threshold=.35):
    rows=np.asarray(output)
    if rows.ndim!=2 or rows.shape[1]!=7:
        raise ValueError('Expected plate end-to-end output [N,7]')
    sx,sy,left,top=transform
    height,width=image_shape[:2]
    found=[]
    for batch,x1,y1,x2,y2,cls,score in rows:
        if not np.isfinite([batch,x1,y1,x2,y2,cls,score]).all() or batch!=0 or cls!=0 or not threshold<=score<=1:
            continue
        box=(max(0.,min(width,(x1-left)/sx)),max(0.,min(height,(y1-top)/sy)),
             max(0.,min(width,(x2-left)/sx)),max(0.,min(height,(y2-top)/sy)))
        if box[2]>box[0] and box[3]>box[1]: found.append((box,float(score)))
    return found
