"""Bounded executor exclusively for LPR; never shares facial inference resources."""
from concurrent.futures import ThreadPoolExecutor
from threading import BoundedSemaphore


class BoundedLprExecutor:
    def __init__(self, capacity=4):
        self.slots = BoundedSemaphore(capacity)
        self.pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix='lpr-only')

    def submit(self, fn, *args):
        if not self.slots.acquire(blocking=False):
            return None
        try:
            future = self.pool.submit(fn, *args)
        except Exception:
            self.slots.release()
            raise
        future.add_done_callback(lambda _: self.slots.release())
        return future

    def close(self):
        self.pool.shutdown(wait=True, cancel_futures=True)
