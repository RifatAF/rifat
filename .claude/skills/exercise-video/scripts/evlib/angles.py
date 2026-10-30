"""Углы суставов по точкам MediaPipe Pose (33 точки). Стороны анатомические: left = левая сторона человека.
Углы считаются в плоскости кадра, поэтому ракурс в JSON должен совпадать с плоскостью движения (боковой для сгибаний)."""
import math

import numpy as np

LM = dict(nose=0, ear_l=7, ear_r=8, sh_l=11, sh_r=12, el_l=13, el_r=14, wr_l=15, wr_r=16,
          hip_l=23, hip_r=24, kn_l=25, kn_r=26, an_l=27, an_r=28, heel_l=29, heel_r=30, toe_l=31, toe_r=32)


def _s(side):
    return 'l' if side == 'left' else 'r'


def angle3(a, b, c):
    v1, v2 = a - b, c - b
    n = np.linalg.norm(v1) * np.linalg.norm(v2)
    if n < 1e-6:
        return None
    return math.degrees(math.acos(max(-1.0, min(1.0, float(np.dot(v1, v2) / n)))))


def from_vertical(lower, upper):
    """Угол отрезка lower→upper от вертикали вверх, 0 = строго вертикально."""
    v = upper - lower
    return math.degrees(math.atan2(abs(v[0]), -v[1]))


def _joint(a, b, c):
    def f(side):
        s = _s(side)
        return [f'{a}_{s}', f'{b}_{s}', f'{c}_{s}'], lambda P: angle3(*P)
    return f


SIDED = {
    'knee': _joint('hip', 'kn', 'an'),
    'hip': _joint('sh', 'hip', 'kn'),
    'ankle': _joint('kn', 'an', 'toe'),
    'elbow': _joint('sh', 'el', 'wr'),
    'shoulder': _joint('hip', 'sh', 'el'),
    'neck_flexion': lambda side: ([f'sh_{_s(side)}', f'ear_{_s(side)}'], lambda P: from_vertical(P[0], P[1])),
}


def _mid(P, i, j):
    return (P[i] + P[j]) / 2


def _trunk_incline(P):
    return from_vertical((P[2] + P[3]) / 2, (P[0] + P[1]) / 2)


def _trunk_lateral(P):
    hip, sh = (P[2] + P[3]) / 2, (P[0] + P[1]) / 2
    v = sh - hip
    return math.degrees(math.atan2(v[0], -v[1]))


def _head_yaw(P):
    """Грубая оценка поворота головы во фронтальном ракурсе по смещению носа между ушами, градусы."""
    nose, el, er = P
    half = np.linalg.norm(el - er) / 2
    if half < 1e-6:
        return None
    r = float((nose[0] - (el[0] + er[0]) / 2) / half)
    return math.degrees(math.asin(max(-1.0, min(1.0, r))))


def _pelvis_tilt(P):
    v = P[0] - P[1]
    return math.degrees(math.atan2(v[1], abs(v[0]) + 1e-9))


def _feet_level(P):
    """Разница высоты лодыжек в % от расстояния плечо–лодыжка: ~0, когда обе стопы на полу."""
    sh, al, ar = (P[0] + P[1]) / 2, P[2], P[3]
    h = abs(((al + ar) / 2)[1] - sh[1])
    return None if h < 1e-6 else float(abs(al[1] - ar[1]) / h * 100)


UNSIDED = {
    'feet_level': (['sh_l', 'sh_r', 'an_l', 'an_r'], _feet_level),
    'trunk_incline': (['sh_l', 'sh_r', 'hip_l', 'hip_r'], _trunk_incline),
    'trunk_lateral': (['sh_l', 'sh_r', 'hip_l', 'hip_r'], _trunk_lateral),
    'head_yaw': (['nose', 'ear_l', 'ear_r'], _head_yaw),
    'pelvis_tilt': (['hip_l', 'hip_r'], _pelvis_tilt),
}

METRICS = {f'{k}_{s}' for k in SIDED for s in ('left', 'right')} | set(UNSIDED)


def swap_side_key(k):
    if k.endswith('_left'):
        return k[:-5] + '_right'
    if k.endswith('_right'):
        return k[:-6] + '_left'
    return k


def spec(metric):
    if metric in UNSIDED:
        return UNSIDED[metric]
    base, side = metric.rsplit('_', 1)
    return SIDED[base](side)


def measure(metric, pts, vis, min_vis):
    """pts: массив (33, 2) в пикселях, vis: (33,). None, если нужные точки не видны."""
    names, fn = spec(metric)
    idx = [LM[n] for n in names]
    if min(vis[i] for i in idx) < min_vis:
        return None
    return fn([pts[i] for i in idx])


BONES = {'thigh_l': ('hip_l', 'kn_l'), 'thigh_r': ('hip_r', 'kn_r'), 'shin_l': ('kn_l', 'an_l'), 'shin_r': ('kn_r', 'an_r'),
         'upper_arm_l': ('sh_l', 'el_l'), 'upper_arm_r': ('sh_r', 'el_r'), 'forearm_l': ('el_l', 'wr_l'), 'forearm_r': ('el_r', 'wr_r'),
         'torso_l': ('sh_l', 'hip_l'), 'torso_r': ('sh_r', 'hip_r')}


def bone_lengths(pts, vis, min_vis):
    out = {}
    for name, (a, b) in BONES.items():
        ia, ib = LM[a], LM[b]
        if vis[ia] >= min_vis and vis[ib] >= min_vis:
            out[name] = float(np.linalg.norm(pts[ia] - pts[ib]))
    return out


def side_visibility(vis, side):
    s = _s(side)
    keys = [f'{p}_{s}' for p in ('sh', 'el', 'wr', 'hip', 'kn', 'an')]
    return float(np.mean([vis[LM[k]] for k in keys]))
