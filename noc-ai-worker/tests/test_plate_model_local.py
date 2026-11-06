"""Local artifact smoke test; no downloads or other modules."""
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
import numpy as np
from models.plate_detector import PlateDetector

MODEL=Path(__file__).resolve().parents[1]/'models/weights/plate_v9.onnx'

class LocalPlateModelTests(unittest.TestCase):
    @unittest.skipUnless(MODEL.is_file(),'Local dedicated model not installed')
    def test_cpu_single_thread_and_no_facial_import(self):
        facial_before='models.face_model' in sys.modules
        with patch.dict(os.environ,{'LPR_MODEL_PATH':str(MODEL)}):
            detector=PlateDetector()
            self.assertEqual(detector.detect(np.zeros((100,200,3),dtype=np.uint8)),[])
            self.assertTrue(detector.status()['loaded'])
            self.assertIsNone(detector.status()['error'])
            self.assertEqual(detector.model.session.get_providers(),['CPUExecutionProvider'])
            self.assertEqual(detector.model.session.get_session_options().intra_op_num_threads,1)
            self.assertEqual('models.face_model' in sys.modules,facial_before)

if __name__=='__main__': unittest.main()
