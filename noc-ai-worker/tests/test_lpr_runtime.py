import unittest
import threading
import time
from concurrent.futures import Future
from unittest.mock import patch
from types import SimpleNamespace
import numpy as np
from core import lpr_runtime as runtime
from core.video_stream import RTSPStream


class RuntimeTests(unittest.TestCase):
    def test_atomic_pair_legacy_interface(self):
        stream=RTSPStream.__new__(RTSPStream)
        stream.lock=threading.Lock();stream.ret=True
        stream.frame=np.zeros((10,20,3));stream.frame_full=np.zeros((20,40,3))
        stream.frame_id=7;stream.captured_at=123
        self.assertIs(stream.read()[1],stream.read_pair()[1])
        self.assertEqual(stream.read_pair()[3:],(7,123))

    def test_pending_not_duplicated_close_discards(self):
        session=runtime.LprSession(1,'test');future=Future()
        frame=np.zeros((100,100,3),dtype=np.uint8)
        with patch.object(runtime.executor,'submit',return_value=future) as submit:
            for _ in range(3): session.update(1,1,time.time(),frame,frame,(0,0,100,100),'Auto',{})
            self.assertEqual(submit.call_count,1)
            session.close();self.assertTrue(future.cancelled());self.assertEqual(session.tracks,{})
            self.assertIsNone(session.update(1,2,time.time(),frame,frame,(0,0,100,100),'Auto',{})['placa'])

    def test_stale_result_does_not_vote(self):
        session=runtime.LprSession(1,'test');future=Future()
        frame=np.zeros((100,100,3),dtype=np.uint8)
        with patch.object(runtime.executor,'submit',return_value=future):
            session.update(1,1,time.time(),frame,frame,(0,0,100,100),'Auto',{})
        future.set_result({'plate':'1234ABC'})
        state=session.tracks[1];pending=state['pending']
        state['pending']=(*pending[:3],time.monotonic()-30)
        with patch.object(runtime.executor,'submit',return_value=None):
            session.update(1,2,time.time(),frame,frame,(0,0,100,100),'Auto',{})
        self.assertEqual(len(state['voter'].samples),0)

    def test_consensus_sends_once_and_all_evidence_from_same_frame(self):
        session=runtime.LprSession(1,'test');frame=np.zeros((100,100,3),dtype=np.uint8)
        registry=SimpleNamespace(lock_plates=threading.Lock(),known_plates=[],known_plate_data=[])
        with patch.dict('sys.modules',{'models.ocr_model':registry}),patch.object(runtime.executor,'submit',return_value=None),patch.object(runtime,'deliver') as deliver:
            sent=Future();sent.set_result(True);deliver.return_value=sent
            session.update(1,0,time.time(),frame,frame,(0,0,100,100),'Auto',{})
            state=session.tracks[1]
            for i in range(1,4):
                result=dict(plate='1234ABC',confidence=.9,quality=.7+i*.01,evidence={
                    'foto_placa':f'plate{i}','foto_vehiculo':f'car{i}','foto_contexto':f'scene{i}',
                    'raw':'1234ABC','corrected':False})
                future=Future();future.set_result(result)
                state['pending']=(future,i,time.time(),time.monotonic())
                session.update(1,i,time.time(),frame,frame,(0,0,100,100),'Auto',{'min_votos':3})
            session.update(1,4,time.time(),frame,frame,(0,0,100,100),'Auto',{'min_votos':3})
            self.assertEqual(deliver.call_count,1)
            payload=deliver.call_args.args[0]
            self.assertEqual((payload['foto_placa'],payload['foto_vehiculo'],payload['foto_contexto']),('plate3','car3','scene3'))
            self.assertTrue(state['sent'])

if __name__=='__main__': unittest.main()
