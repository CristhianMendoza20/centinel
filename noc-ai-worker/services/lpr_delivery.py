"""Bounded, idempotent history delivery. Does not alter facial/API sender."""
import os
import time
import requests
from config import API_BASE, log
from core.lpr_jobs import BoundedLprExecutor

_delivery = BoundedLprExecutor(capacity=8)


def _send(payload):
    for attempt in range(3):
        try:
            response = requests.post(API_BASE+'/lpr/lecturas', json=payload,
                headers={'x-worker-key': os.getenv('WORKER_API_KEY', '')}, timeout=5)
            if response.status_code in (200, 201):
                return True
            if response.status_code < 500:
                log.warning('LPR historial rechazado: HTTP %s', response.status_code)
                return False
        except requests.RequestException:
            pass
        time.sleep(.5*(attempt+1))
    log.warning('LPR historial no entregado tras 3 intentos: %s', payload['event_id'])
    return False


def deliver(payload):
    return _delivery.submit(_send, payload)
