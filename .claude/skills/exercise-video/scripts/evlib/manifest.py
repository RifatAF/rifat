"""manifest.json: статус каждого видео. Статусы: draft, qa_passed, approved, rejected.
qa_passed ставит только автопроверка, approved и rejected только человек."""
import fcntl
from contextlib import contextmanager
from pathlib import Path

from . import paths
from .util import load_json, save_json, now

STATUSES = ('draft', 'qa_passed', 'approved', 'rejected')
EMPTY = {'schema': 1, 'statuses': list(STATUSES), 'exercises': {}}


@contextmanager
def locked():
    """Читает manifest под файловой блокировкой и сохраняет при выходе: параллельные запуски не затирают друг друга."""
    paths.MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    lock = Path(str(paths.MANIFEST) + '.lock')
    with open(lock, 'w') as lf:
        fcntl.flock(lf, fcntl.LOCK_EX)
        data = load_json(paths.MANIFEST) if paths.MANIFEST.exists() else dict(EMPTY, exercises={})
        yield data
        save_json(paths.MANIFEST, data)


def read():
    return load_json(paths.MANIFEST) if paths.MANIFEST.exists() else dict(EMPTY, exercises={})


def ex_entry(data, ex_id):
    return data['exercises'].setdefault(ex_id, {
        'attempts': 0, 'cost_usd': 0.0, 'cost_ok': False, 'provider': None, 'videos': {}, 'log': []})


def latest(entry):
    vids = sorted(entry.get('videos', {}).values(), key=lambda v: v['version'])
    return vids[-1] if vids else None


def set_status(video, status, by, note=None):
    assert status in STATUSES, status
    video['status'] = status
    video.setdefault('history', []).append({'at': now(), 'status': status, 'by': by, **({'note': note} if note else {})})
