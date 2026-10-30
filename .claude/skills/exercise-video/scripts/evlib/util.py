import hashlib, json, os, sys, tempfile, time
from pathlib import Path


def load_json(p):
    with open(p, encoding='utf-8') as f:
        return json.load(f)


def save_json(p, data):
    p = Path(p)
    p.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=p.parent, prefix='.' + p.name, suffix='.tmp')
    with os.fdopen(fd, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')
    os.replace(tmp, p)


def sha256_file(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def key_of(*parts):
    return hashlib.sha256(json.dumps(parts, ensure_ascii=False, sort_keys=True, default=str).encode()).hexdigest()[:16]


def now():
    return time.strftime('%Y-%m-%dT%H:%M:%S%z')


def plural(n, one, few, many):
    n = abs(int(n))
    if n % 10 == 1 and n % 100 != 11:
        return one
    if 2 <= n % 10 <= 4 and not 12 <= n % 100 <= 14:
        return few
    return many


def log(msg):
    print(msg, flush=True)


class Stop(Exception):
    """Остановка конвейера с кодом выхода и сообщением для человека."""
    def __init__(self, code, msg):
        super().__init__(msg)
        self.code = code
