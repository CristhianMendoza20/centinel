import unittest
import numpy as np
from models.plate_onnx import letterbox,decode,decode_end_to_end


class OnnxGeometryTests(unittest.TestCase):
    def test_letterbox_rgb_padding_and_roundtrip(self):
        image=np.zeros((100,200,3),dtype=np.uint8);image[:]=[10,20,30]
        tensor,transform=letterbox(image)
        self.assertEqual(tensor.shape,(1,3,640,640))
        np.testing.assert_allclose(tensor[0,:,160,0],[30/255,20/255,10/255])
        np.testing.assert_allclose(tensor[0,:,0,0],[114/255]*3)
        output=np.array([[[320],[320],[320],[64],[.9]]],dtype=np.float32)
        boxes=decode(output,transform,image.shape)
        np.testing.assert_allclose(boxes[0][0],[50,40,150,60],atol=.001)

    def test_nms_bad_scores_and_padding_not_plate(self):
        _,transform=letterbox(np.zeros((100,200,3),dtype=np.uint8))
        output=np.array([[[320,321,320,50],[320,321,320,20],[320,320,320,20],
                          [64,64,64,20],[.9,.8,float('nan'),.9]]],dtype=np.float32)
        self.assertEqual(len(decode(output,transform,(100,200,3))),1)

    def test_wrong_model_shape_rejected(self):
        with self.assertRaises(ValueError): decode(np.zeros((1,84,8400)),(1,1,0,0),(640,640,3))

    def test_end_to_end_filters_class_batch_and_maps_coordinates(self):
        tensor,transform=letterbox(np.zeros((100,200,3),dtype=np.uint8),384)
        self.assertEqual(tensor.shape,(1,3,384,384))
        rows=np.array([[0,96,172.8,288,211.2,0,.9],
                       [1,96,172.8,288,211.2,0,.9],
                       [0,96,172.8,288,211.2,1,.9],
                       [0,96,172.8,288,211.2,0,.2]])
        found=decode_end_to_end(rows,transform,(100,200,3))
        self.assertEqual(len(found),1)
        np.testing.assert_allclose(found[0][0],[50,40,150,60],atol=.001)

if __name__=='__main__': unittest.main()
