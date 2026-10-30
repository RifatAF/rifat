"""MediaPipe Pose Landmarker (tasks API): точки позы по картинке и по каждому кадру видео."""
import os
import urllib.request

import numpy as np

from . import paths
from .util import log, Stop


def ensure_model():
    if paths.POSE_MODEL.exists() and paths.POSE_MODEL.stat().st_size > 1e6:
        return paths.POSE_MODEL
    paths.MODELS.mkdir(parents=True, exist_ok=True)
    log(f'Скачиваю модель позы MediaPipe → {paths.rel(paths.POSE_MODEL)}')
    tmp = str(paths.POSE_MODEL) + '.part'
    urllib.request.urlretrieve(paths.POSE_MODEL_URL, tmp)
    os.replace(tmp, paths.POSE_MODEL)
    return paths.POSE_MODEL


def _landmarker(mode):
    try:
        import mediapipe as mp
        from mediapipe.tasks.python import vision, BaseOptions
    except ImportError as e:
        raise Stop(5, f'Нет mediapipe ({e}). Выполни: python3 scripts/ev.py setup')
    except OSError as e:
        raise Stop(5, f'mediapipe не загрузился ({e}). На Linux нужны libegl1 и libgles2: sudo apt-get install -y libegl1 libgles2')
    rm = vision.RunningMode.VIDEO if mode == 'video' else vision.RunningMode.IMAGE
    opts = vision.PoseLandmarkerOptions(base_options=BaseOptions(model_asset_path=str(ensure_model())), running_mode=rm,
                                        num_poses=2, min_pose_detection_confidence=0.5, min_tracking_confidence=0.5)
    return mp, vision.PoseLandmarker.create_from_options(opts)


def _to_arrays(res, w, h):
    if not res.pose_landmarks:
        return None
    lms = res.pose_landmarks[0]
    pts = np.array([[l.x * w, l.y * h] for l in lms], dtype=float)
    vis = np.array([l.visibility for l in lms], dtype=float)
    return {'pts': pts, 'vis': vis, 'people': len(res.pose_landmarks)}


def detect_image(path):
    import cv2
    mp, lm = _landmarker('image')
    img = cv2.imread(str(path))
    if img is None:
        raise Stop(5, f'Не читается картинка {path}')
    h, w = img.shape[:2]
    with lm:
        res = lm.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img, cv2.COLOR_BGR2RGB)))
    return _to_arrays(res, w, h)


def detect_video(path):
    """Список кадров: {'t': сек, 'pose': dict|None}."""
    import cv2
    mp, lm = _landmarker('video')
    cap = cv2.VideoCapture(str(path))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    frames, i = [], 0
    with lm:
        while True:
            ok, img = cap.read()
            if not ok:
                break
            h, w = img.shape[:2]
            ts = int(i * 1000 / fps)
            res = lm.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img, cv2.COLOR_BGR2RGB)), ts)
            frames.append({'t': i / fps, 'pose': _to_arrays(res, w, h)})
            i += 1
    cap.release()
    return frames, fps
