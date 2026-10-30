"""Пути скилла. EV_STATE_DIR переносит состояние (work, out, manifest, reports) в другую папку: так selftest не трогает боевой manifest."""
import os
from pathlib import Path

SKILL = Path(__file__).resolve().parents[2]
REPO = SKILL.parents[2] if SKILL.parent.name == 'skills' and SKILL.parents[1].name == '.claude' else None
STATE = Path(os.environ.get('EV_STATE_DIR') or SKILL)

CONFIG = SKILL / 'config.json'
EXERCISES = SKILL / 'exercises'
TEMPLATES = SKILL / 'templates'
FONTS = TEMPLATES / 'fonts'
MODELS = SKILL / 'models'
POSE_MODEL = MODELS / 'pose_landmarker_full.task'
POSE_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task'

MANIFEST = STATE / 'manifest.json'
LIBRARY = STATE / 'library'
REPORTS = STATE / 'reports'
WORK = STATE / 'work'
OUT = STATE / 'out'

# куда publish кладет одобренные файлы и какие данные приложения обновляет
PUBLISH_DIR = (REPO / 'video') if REPO else None
APP_EXERCISES = (REPO / 'data' / 'exercises.json') if REPO else None


def rel(p):
    p = Path(p)
    for base in (STATE, SKILL, REPO):
        if base:
            try:
                return str(p.resolve().relative_to(base.resolve()))
            except ValueError:
                pass
    return str(p)
