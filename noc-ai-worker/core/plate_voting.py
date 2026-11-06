"""Whole-plate consensus, one independent vote per source frame."""
from collections import deque, defaultdict


class PlateVoter:
    def __init__(self, maxlen=15):
        self.samples = deque(maxlen=maxlen)
        self.last_frame = -1

    def add(self, frame_id, plate, confidence, quality, evidence=None):
        # Reject duplicate and out-of-order results, including alternate OCR variants.
        if frame_id <= self.last_frame:
            return False
        self.last_frame = frame_id
        self.samples.append((frame_id, plate, max(0., min(1., confidence)),
                             max(0., min(1., quality)), evidence))
        return True

    def resultado(self, min_votes=3, min_ratio=.65):
        groups = defaultdict(list)
        for item in self.samples:
            if item[1]:
                groups[item[1]].append(item)
        if not groups:
            return None
        weights = {p: sum(max(.01, s[2]*s[3]) for s in items) for p, items in groups.items()}
        ranked = sorted(weights, key=weights.get, reverse=True)
        plate = ranked[0]
        # Ties and ambiguous candidates remain unconfirmed.
        if len(ranked) > 1 and abs(weights[plate]-weights[ranked[1]]) < 1e-9:
            return None
        items = groups[plate]
        ratio = weights[plate]/sum(weights.values())
        if len(items) < min_votes or ratio < min_ratio:
            return None
        best = max(items, key=lambda s: s[2]*s[3])
        return dict(plate=plate, confidence=sum(s[2] for s in items)/len(items),
                    votes=len(items), ratio=ratio, evidence=best[4])
