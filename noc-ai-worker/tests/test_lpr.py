import unittest
import threading
from unittest.mock import patch
import numpy as np
from core.plate_voting import PlateVoter
from core.lpr_geometry import full_box
from core.lpr_jobs import BoundedLprExecutor
from models.plate_text import candidatos, normalizar, match_exacto, confirmaciones_config
from models.plate_reader import join_rows, variants
from models.plate_detector import PlateDetector


class LprTests(unittest.TestCase):
    def test_registry_never_corrected_or_substring_matched(self):
        self.assertEqual(normalizar(' 1234-abc '),'1234ABC')
        self.assertIsNone(match_exacto('234ABC',['1234ABC'],[{'id':1}]))
        self.assertIsNone(match_exacto('1234ABC',['1Z34ABC'],[{'id':1}]))
        self.assertEqual(match_exacto('1234ABC',['1234-abc'],[{'id':1}]),{'id':1})

    def test_positional_correction_is_hypothesis(self):
        self.assertEqual(candidatos('1Z34A8C'),[('1234ABC',True)])
        self.assertEqual(candidatos('1234ABC'),[('1234ABC',False)])
        self.assertEqual(candidatos('xxx'),[])

    def test_config_compatibility(self):
        self.assertEqual(confirmaciones_config({'confirmaciones':4}),4)
        self.assertEqual(confirmaciones_config({'confirmaciones':4,'confirmaciones_placa':2,'min_votos':5}),5)
        self.assertEqual(confirmaciones_config({'min_votos':'bad'}),3)
        self.assertEqual(confirmaciones_config({'min_votos':1}),2)

    def test_consensus_requires_distinct_frames_and_whole_plate(self):
        v=PlateVoter()
        for frame,p in enumerate(['1234ABC','1234ABC','1234ABD','1234ABC']):
            self.assertTrue(v.add(frame,p,.9,.8,{'frame':frame}))
        self.assertFalse(v.add(3,'1234ABC',1,1))
        result=v.resultado()
        self.assertEqual(result['plate'],'1234ABC')
        self.assertEqual(result['votes'],3)
        self.assertAlmostEqual(result['ratio'],.75)
        self.assertNotEqual(result['evidence']['frame'],2)

    def test_tie_no_synthetic_plate_and_bound(self):
        v=PlateVoter()
        for i in range(6): v.add(i,['1234ABC','1234ABD'][i%2],1,1)
        self.assertIsNone(v.resultado())
        for i in range(6,50): v.add(i,'9999XYZ',.9,.9)
        self.assertEqual(len(v.samples),15)
        self.assertEqual(v.resultado()['plate'],'9999XYZ')

    def test_geometry_uses_independent_xy_scales_and_clamps(self):
        self.assertEqual(full_box((-2,10,640,360),(360,640,3),(1081,1920,3)),(0,30,1920,1081))

    def test_ocr_joins_two_lines_left_to_right(self):
        box=lambda x,y: [[x,y],[x+20,y],[x+20,y+10],[x,y+10]]
        raw,conf=join_rows([(box(30,0),'34',.9),(box(0,20),'ABC',.8),(box(0,0),'12',.95)])
        self.assertEqual(raw,'1234ABC'); self.assertEqual(conf,.8)

    def test_does_not_downsample_good_crop(self):
        crop=np.zeros((120,300,3),dtype=np.uint8)
        self.assertEqual(variants(crop)[0][1].shape,crop.shape)
        self.assertEqual(variants(crop[:40,:100])[0][1].shape[:2],(80,200))

    def test_missing_detector_never_fakes_crop(self):
        with patch.dict('os.environ',{'LPR_MODEL_PATH':'__missing_test_plate__.pt'}):
            detector=PlateDetector()
            self.assertEqual(detector.detect(np.zeros((100,100,3),dtype=np.uint8)),[])
            self.assertFalse(detector.status()['loaded'])
            self.assertTrue(detector.status()['error'])

    def test_queue_bounded_and_releases_slot(self):
        executor=BoundedLprExecutor(2)
        gate=threading.Event()
        try:
            first=executor.submit(lambda:gate.wait(2))
            second=executor.submit(lambda:1)
            self.assertIsNone(executor.submit(lambda:2))
            self.assertTrue(second.cancel())
            third=executor.submit(lambda:3)
            self.assertIsNotNone(third)
            gate.set();first.result(3)
            self.assertEqual(third.result(3),3)
        finally:
            gate.set();executor.close()

if __name__=='__main__': unittest.main()
