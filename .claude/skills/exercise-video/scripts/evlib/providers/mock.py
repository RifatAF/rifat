"""Офлайн-провайдер для прогона конвейера без денег: рисует манекен в боковом ракурсе по целевым углам.
EV_MOCK_DEFECT=shallow|glitch|loop внедряет типичные ошибки ИИ-видео, чтобы проверить, что автопроверка их ловит."""
import math
import os

import numpy as np

from .base import Base

W, H, FPS = 720, 1280, 24
DEFAULT = {'knee': 178, 'hip': 178, 'trunk_incline': 2, 'shoulder': 12, 'elbow': 168, 'neck_flexion': 8}


def _dir(a):
    r = math.radians(a)
    return np.array([math.cos(r), math.sin(r)])


def _pose_params(hint, side):
    s = side or 'left'
    p = dict(DEFAULT)
    for k in ('knee', 'hip', 'shoulder', 'elbow', 'neck_flexion'):
        if f'{k}_{s}' in (hint or {}):
            p[k] = hint[f'{k}_{s}']
    if 'trunk_incline' in (hint or {}):
        p['trunk_incline'] = hint['trunk_incline']
    elif 'hip' in p:
        p['trunk_incline'] = max(2, (180 - p['hip']) * 0.45)
    if 'shoulder_' + s not in (hint or {}) and p['knee'] < 140:
        p['shoulder'] = 12 + (140 - p['knee']) * 1.6  # руки вперед для баланса в приседе
    return p


def render(hint, facing_side='left', shin_scale=1.0):
    import cv2
    p = _pose_params(hint, facing_side)
    img = np.full((H, W, 3), (232, 240, 244), np.uint8)
    floor_y = 1100
    cv2.rectangle(img, (0, floor_y), (W, H), (165, 172, 178), -1)
    Ls, Lt, Lb, Lu, Lf, Ln = 215 * shin_scale, 230, 270, 150, 140, 95
    a_t = -90 + p['trunk_incline']
    a_th = a_t + p['hip']
    a_sh = a_th + (180 - p['knee'])
    a_ua = a_t + 180 - p['shoulder']
    a_fa = a_ua - (180 - p['elbow'])
    a_nk = a_t + p['neck_flexion']
    hip = np.zeros(2)
    knee = hip + Lt * _dir(a_th)
    ankle = knee + Ls * _dir(a_sh)
    sh = hip + Lb * _dir(a_t)
    el = sh + Lu * _dir(a_ua)
    wr = el + Lf * _dir(a_fa)
    head = sh + Ln * _dir(a_nk)
    off = np.array([W * 0.47, floor_y - 18]) - ankle
    pts = {k: v + off for k, v in dict(hip=hip, knee=knee, ankle=ankle, sh=sh, el=el, wr=wr, head=head).items()}
    if facing_side == 'left':  # левым боком к камере = лицом к левому краю кадра
        for k in pts:
            pts[k][0] = W - pts[k][0]
    fwd = -1 if facing_side == 'left' else 1
    P = lambda v: (int(v[0]), int(v[1]))
    skin, shirt, pants, dark = (150, 180, 225), (150, 100, 60), (90, 75, 60), (30, 30, 30)
    # дальние рука и нога: темнее и чуть сзади, ближние рисуются поверх (подсказка глубины для детектора)
    back = np.array([-fwd * 22, -6])
    shade = lambda c: tuple(int(x * 0.6) for x in c)
    for a, b, c, w in [('ankle', 'knee', pants, 58), ('knee', 'hip', pants, 70), ('sh', 'el', shirt, 42), ('el', 'wr', skin, 32)]:
        cv2.line(img, P(pts[a] + back), P(pts[b] + back), shade(c), w, cv2.LINE_AA)
    cv2.line(img, P(pts['ankle'] + back), P(pts['ankle'] + back + [fwd * 95, 0]), shade(skin), 30, cv2.LINE_AA)
    for a, b, c, w in [('ankle', 'knee', pants, 62), ('knee', 'hip', pants, 76), ('hip', 'sh', shirt, 100),
                       ('sh', 'el', shirt, 46), ('el', 'wr', skin, 36)]:
        cv2.line(img, P(pts[a]), P(pts[b]), c, w, cv2.LINE_AA)
    for k, c, r in [('knee', pants, 36), ('hip', pants, 46), ('sh', shirt, 50), ('el', shirt, 23)]:
        cv2.circle(img, P(pts[k]), r, c, -1, cv2.LINE_AA)
    cv2.line(img, P(pts['ankle']), P(pts['ankle'] + [fwd * 100, 0]), skin, 34, cv2.LINE_AA)
    hd = pts['head'] + [0, -40]
    cv2.ellipse(img, P(hd), (56, 70), 0, 0, 360, skin, -1, cv2.LINE_AA)
    cv2.ellipse(img, P(hd + [-fwd * 8, -32]), (60, 40), 0, 180, 360, (40, 30, 20), -1, cv2.LINE_AA)
    cv2.circle(img, P(hd + [fwd * 30, -6]), 6, dark, -1)
    cv2.circle(img, P(hd + [fwd * 62, 10]), 8, skin, -1)
    cv2.ellipse(img, P(hd + [fwd * 33, 34]), (13, 4), 0, 0, 180, (60, 60, 150), 2)
    return img


def _ease(x):
    return 0.5 - 0.5 * math.cos(math.pi * x)


def _lerp(a, b, x):
    keys = set(a) | set(b)
    return {k: a.get(k, b.get(k)) + (b.get(k, a.get(k)) - a.get(k, b.get(k))) * x for k in keys}


class Provider(Base):
    name = 'mock'
    supports_seed = True
    supports_end_frame = True

    def generate_image(self, prompt, seed, out_path, pose_hint=None, view=None):
        import cv2
        cv2.imwrite(str(out_path), render(pose_hint or {}, (view or {}).get('facing_side') or 'left'))
        return {'model': 'mock-mannequin', 'seed': seed}

    def edit_image(self, ref_path, prompt, seed, out_path, pose_hint=None, view=None):
        return self.generate_image(prompt, seed, out_path, pose_hint, view)

    def image_to_video(self, start_path, end_path, prompt, negative, seed, duration_s, out_path,
                       pose_from=None, pose_to=None, view=None):
        import cv2
        defect = os.environ.get('EV_MOCK_DEFECT', '')
        side = (view or {}).get('facing_side') or 'left'
        a, b = pose_from or {}, pose_to or {}
        if defect == 'shallow':
            b = _lerp(a, b, 0.55)
        n = int(duration_s * FPS)
        lead, tail = int(0.4 * FPS), int(0.5 * FPS)  # неподвижные края, как у настоящих моделей
        vw = cv2.VideoWriter(str(out_path), cv2.VideoWriter_fourcc(*'mp4v'), FPS, (W, H))
        for i in range(n):
            x = min(1, max(0, (i - lead) / max(1, n - lead - tail)))
            if defect == 'loop':  # модель «зациклила» движение: туда и обратно дважды
                x = abs(math.sin(math.pi * 2 * x))
            scale = 1.45 if defect == 'glitch' and (i // 6) % 3 == 1 else 1.0
            vw.write(render(_lerp(a, b, _ease(x)), side, shin_scale=scale))
        vw.release()
        return {'model': 'mock-mannequin' + (f'+{defect}' if defect else ''), 'seed': seed}
