"""Pure LPR text helpers. Never correct authoritative registered plates."""
import re

DEFAULT_PATTERNS = (r"[0-9]{3,4}[A-Z]{2,3}",)


def normalizar(text):
    return re.sub(r"[^A-Z0-9]", "", str(text or "").upper())


def es_valida(text, patterns=DEFAULT_PATTERNS):
    return any(re.fullmatch(p, normalizar(text)) for p in patterns)


def candidatos(text, patterns=DEFAULT_PATTERNS):
    """Return hypotheses; callers must not silently promote corrections to truth."""
    raw = normalizar(text)
    if es_valida(raw, patterns):
        return [(raw, False)]
    result = []
    digits = str.maketrans({'O':'0','I':'1','Z':'2','S':'5','B':'8'})
    letters = str.maketrans({'0':'O','1':'I','2':'Z','5':'S','8':'B'})
    for split in (3, 4):
        candidate = raw[:split].translate(digits) + raw[split:].translate(letters)
        if es_valida(candidate, patterns) and (candidate, True) not in result:
            result.append((candidate, True))
    return result


def match_exacto(text, plates, data):
    key = normalizar(text)
    return next((d for p, d in zip(plates, data) if key and normalizar(p) == key), None)


def confirmaciones_config(cfg, default=3):
    value = cfg.get('min_votos', cfg.get('confirmaciones_placa', cfg.get('confirmaciones', default)))
    try:
        return max(2, min(15, int(value)))
    except (TypeError, ValueError):
        return default
