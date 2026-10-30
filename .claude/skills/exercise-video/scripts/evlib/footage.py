"""Режим «живое видео»: свой ролик вместо генерации. Замена фона (маска MediaPipe Pose + доводка краев),
монтаж по отрезкам из JSON, титры, автопроверка позы по отрезкам удержания."""
import shutil
import statistics
import subprocess
from pathlib import Path

import numpy as np

from . import manifest, paths, post, pose
from .angles import measure, bone_lengths
from .util import Stop, log, now, sha256_file, save_json, load_json, key_of


def _hex_bgr(h):
    h = h.lstrip('#')
    return np.array([int(h[4:6], 16), int(h[2:4], 16), int(h[0:2], 16)], np.float32)


def _background(W, H, floor_y, f):
    wall, floor = _hex_bgr(f.get('wall', '#D8D2C6')), _hex_bgr(f.get('floor', '#C4BCAE'))
    y = np.arange(H, dtype=np.float32)[:, None]
    k = np.clip((y - floor_y) / 40.0 + 0.5, 0, 1)  # мягкая линия стены и пола
    depth = np.clip((y - floor_y) / max(1, H - floor_y), 0, 1) * 18
    bg = (wall * (1 - k) + (floor - depth) * k)[:, None, :]
    return np.repeat(bg, W, axis=1)


def _shadow(W, H, pts, vis):
    m = np.zeros((H, W), np.float32)
    import cv2
    feet = [i for i in (29, 30, 31, 32, 27, 28) if vis[i] > 0.3]
    if not feet:
        return m
    xs, ys = pts[feet, 0], pts[feet, 1]
    cx, cy = float(xs.mean()), float(ys.max()) + 8
    w = max(60.0, float(xs.max() - xs.min()) * 0.75 + 60)
    cv2.ellipse(m, (int(cx), int(cy)), (int(w), 22), 0, 0, 360, 1.0, -1)
    return cv2.GaussianBlur(m, (0, 0), 18)


def matte(src, dst, f, cfg):
    """Вырезает человека и ставит единый фон. Возвращает список поз по кадрам (для QA)."""
    import cv2
    import mediapipe as mp
    from mediapipe.tasks.python import vision, BaseOptions
    v = cfg['video']
    W, H, fps = v['width'], v['height'], v['fps']
    opts = vision.PoseLandmarkerOptions(base_options=BaseOptions(model_asset_path=str(pose.ensure_model())),
                                        running_mode=vision.RunningMode.VIDEO, output_segmentation_masks=True, num_poses=1)
    cap = cv2.VideoCapture(str(src))
    first = None
    frames = []
    ok, img = cap.read()
    if not ok:
        raise Stop(8, f'Не читается {src}')
    # цвета пола из нижней полосы первого кадра: по ним чистим маску между ног
    strip = cv2.cvtColor(img[int(H * 0.85):], cv2.COLOR_BGR2HSV)
    floor_hist = cv2.calcHist([strip], [0, 1], None, [30, 32], [0, 180, 0, 256])
    cv2.normalize(floor_hist, floor_hist, 0, 255, cv2.NORM_MINMAX)
    proc = subprocess.Popen(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24',
                             '-s', f'{W}x{H}', '-r', str(fps), '-i', '-', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '15',
                             '-pix_fmt', 'yuv420p', str(dst)], stdin=subprocess.PIPE)
    ema, floor_y, bg, i = None, None, None, 0
    lm = vision.PoseLandmarker.create_from_options(opts)
    try:
        while ok:
            res = lm.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img, cv2.COLOR_BGR2RGB)), int(i * 1000 / fps))
            m = res.segmentation_masks[0].numpy_view().astype(np.float32) if res.segmentation_masks else np.zeros((H, W), np.float32)
            m = m[..., 0] if m.ndim == 3 else m
            ema = m if ema is None else 0.3 * ema + 0.7 * m  # слабое сглаживание: меньше шлейфа на быстрых движениях
            a = cv2.ximgproc.guidedFilter(img, ema, 6, 1e-4) if hasattr(cv2, 'ximgproc') else ema
            pts = vis = None
            if res.pose_landmarks:
                L = res.pose_landmarks[0]
                pts = np.array([[l.x * W, l.y * H] for l in L])
                vis = np.array([l.visibility for l in L])
                if floor_y is None:
                    floor_y = float(np.max(pts[[29, 30, 31, 32], 1])) - f.get('floor_above_feet_px', 260)
                    bg = _background(W, H, floor_y, f)
                # между ног под тазом: убираем пиксели цвета пола (ковер)
                kx = sorted([pts[25, 0], pts[26, 0]])
                y0, y1 = int(min(pts[23, 1], pts[24, 1])), int(min(pts[27, 1], pts[28, 1]) - 50)
                x0, x1 = int(kx[0] + 25), int(kx[1] - 25)
                if y1 > y0 and x1 > x0:
                    hsv = cv2.cvtColor(img[y0:y1, x0:x1], cv2.COLOR_BGR2HSV)
                    prob = cv2.calcBackProject([hsv], [0, 1], floor_hist, [0, 180, 0, 256], 1).astype(np.float32) / 255
                    a[y0:y1, x0:x1] *= 1 - np.clip(prob * 3, 0, 1)
            if bg is None:
                bg = _background(W, H, H * 0.7, f)
            a = np.clip((a - 0.4) / 0.35, 0, 1)  # край чуть внутрь: меньше каймы от стены
            a = cv2.GaussianBlur(a, (3, 3), 0)
            sh = _shadow(W, H, pts, vis) if pts is not None else 0
            back = bg * (1 - 0.28 * (sh[..., None] if isinstance(sh, np.ndarray) else 0))
            fg = img.astype(np.float32)
            gray = fg.mean(axis=2, keepdims=True)
            edge = ((a > 0.02) & (a < 0.98))[..., None]
            fg = np.where(edge, fg * 0.5 + gray * 0.5, fg)  # гасим цветную кайму на краях
            out = fg * a[..., None] + back * (1 - a[..., None])
            proc.stdin.write(np.clip(out, 0, 255).astype(np.uint8).tobytes())
            frames.append({'t': i / fps, 'pose': None if pts is None else {'pts': pts, 'vis': vis, 'people': len(res.pose_landmarks)}})
            i += 1
            ok, img = cap.read()
    finally:
        lm.close()
        cap.release()
        proc.stdin.close()
        proc.wait()
    if proc.returncode:
        raise Stop(8, 'ffmpeg не записал видео с замененным фоном')
    return frames


MATTE_VERSION = 2


def matte_cached(ex, src, norm, bg, cfg):
    """Вырезка дорогая (минуты): результат кэшируется по хэшу исходника и настроек фона."""
    import json
    key = key_of(sha256_file(src), bg, MATTE_VERSION, cfg['video']['width'], cfg['video']['height'], cfg['video']['fps'])
    d = paths.WORK / ex['id'] / 'footage' / 'cache' / key
    mp4, npz = d / 'matted.mp4', d / 'poses.npz'
    if mp4.exists() and npz.exists():
        log('Вырезка фона: из кэша')
        z = np.load(npz, allow_pickle=True)
        return list(z['frames']), mp4
    d.mkdir(parents=True, exist_ok=True)
    log('Меняю фон (маска MediaPipe по каждому кадру, несколько минут)')
    frames = matte(norm, mp4, bg, cfg)
    np.savez_compressed(npz, frames=np.array(frames, dtype=object))
    return frames, mp4


def _zoom_path(frames, cfg):
    """Масштаб и центр по рамке позы, сглаженные вперед и назад (без запаздывания): человек занимает ~60% высоты."""
    v = cfg['video']
    W, H = v['width'], v['height']
    n = len(frames)
    sc, cx, cy = np.ones(n), np.full(n, W / 2), np.full(n, H / 2)
    last = None
    for i, fr in enumerate(frames):
        p = fr['pose']
        if p is not None:
            pts = p['pts'][p['vis'] > 0.3] if (p['vis'] > 0.3).sum() > 8 else p['pts']
            top, bot = float(pts[:, 1].min()) - 0.06 * H, float(pts[:, 1].max()) + 0.02 * H
            last = (min(1.6, max(1.0, 0.6 * H / max(1.0, bot - top))), float(pts[:, 0].mean()), (top + bot) / 2)
        if last:
            sc[i], cx[i], cy[i] = last

    def smooth(x, a=0.06):
        y = x.copy()
        for i in range(1, n):
            y[i] = y[i - 1] + a * (x[i] - y[i - 1])
        for i in range(n - 2, -1, -1):
            y[i] = y[i + 1] + a * (y[i] - y[i + 1])
        return y
    return smooth(sc), smooth(cx), smooth(cy)


def _affine(s, cx, cy, W, H):
    """Масштаб s вокруг (cx, cy) так, чтобы центр человека встал в точку (W/2, 0.55H), без выхода за края кадра."""
    tx, ty = W / 2 - s * cx, 0.55 * H - s * cy
    tx = min(0.0, max(W - s * W, tx))
    ty = min(0.0, max(H - s * H, ty))
    return np.float32([[s, 0, tx], [0, s, ty]])


def _zoom_frames(frames, path, cfg):
    W, H = cfg['video']['width'], cfg['video']['height']
    out = []
    for i, fr in enumerate(frames):
        p = fr['pose']
        if p is None:
            out.append(fr)
            continue
        M = _affine(path[0][i], path[1][i], path[2][i], W, H)
        pts = p['pts'] @ M[:, :2].T + M[:, 2]
        out.append({'t': fr['t'], 'pose': {**p, 'pts': pts}})
    return out


def follow(src, dst, frames, cfg):
    import cv2
    v = cfg['video']
    W, H = v['width'], v['height']
    path = _zoom_path(frames, cfg)
    cap = cv2.VideoCapture(str(src))
    proc = subprocess.Popen(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24',
                             '-s', f'{W}x{H}', '-r', str(v['fps']), '-i', '-', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '15',
                             '-pix_fmt', 'yuv420p', str(dst)], stdin=subprocess.PIPE)
    i = 0
    while True:
        ok, img = cap.read()
        if not ok:
            break
        k = min(i, len(frames) - 1)
        M = _affine(path[0][k], path[1][k], path[2][k], W, H)
        proc.stdin.write(cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE).tobytes())
        i += 1
    cap.release()
    proc.stdin.close()
    proc.wait()


def normalize_source(src, dst, cfg):
    v = cfg['video']
    post.ff(['-i', src, '-vf', f'scale={v["width"]}:{v["height"]}:force_original_aspect_ratio=increase,crop={v["width"]}:{v["height"]},'
             f'fps={v["fps"]},format=yuv420p', '-an', '-c:v', 'libx264', '-crf', '14', '-preset', 'veryfast', dst], 'нормализация исходника')


def cut(src, segs, build, cfg):
    """Отрезки исходника с их скоростью. Возвращает (body.mp4, timeline)."""
    parts, timeline, t = [], [], 0.0
    for s in segs:
        p = build / f'seg_{s["name"]}.mp4'
        sp = s.get('speed', 1.0)
        post.ff(['-ss', f'{s["t0"]:.3f}', '-to', f'{s["t1"]:.3f}', '-i', src, '-vf', f'setpts=PTS/{sp},fps={cfg["video"]["fps"]}',
                 *post.INTER, p], f'отрезок {s["name"]}')
        d = post.probe(p)['duration']
        timeline.append({'seg': s['name'], 't0': round(t, 3), 't1': round(t + d, 3), 'src': [s['t0'], s['t1']], 'speed': sp})
        t += d
        parts.append(p)
    body = build / 'body.mp4'
    post.concat(parts, body)
    return body, timeline


def captions(ex, timeline, body_s, cfg):
    v, cards = cfg['video'], load_json(paths.TEMPLATES / 'cards.json')
    intro, outro = v['intro_s'], v['outro_s']
    total = intro + body_s + outro
    head = post.ass_head(cfg)
    ev, texts = [], []

    def add(t0, t1, style, text, raw):
        texts.append(raw)
        ev.append(f'Dialogue: 0,{post._ts(t0)},{post._ts(t1)},{style},,0,0,0,,{text}')

    label = ex['footage'].get('ai_label_ru', 'Фон заменен с помощью ИИ')
    add(0, total, 'AI', post._esc(label), label)
    add(0, intro, 'Title', r'{\pos(540,820)}' + post._wrap(ex['title_ru'], 22), ex['title_ru'])
    info = f'{ex["zone"].capitalize()} · {ex["dose_ru"]}'
    add(0, intro, 'Info', r'{\pos(540,1080)}' + post._wrap(info, 34), info)
    segs = {s['name']: s for s in ex['footage']['segments']}
    for tl in timeline:
        s = segs[tl['seg']]
        a, b = intro + tl['t0'], intro + tl['t1']
        add(a, b, 'Phase', post._esc(s['label_ru']), s['label_ru'])
        lines = s.get('cues_ru') or ([s['cue_ru']] if s.get('cue_ru') else [])
        if s.get('show_mistakes'):
            lines = lines + [cards['mistake_prefix'] + m for m in ex['mistakes_ru']]
        if lines:
            step = (b - a) / len(lines)
            for k, line in enumerate(lines):
                add(a + k * step, a + (k + 1) * step, 'Cue', post._wrap(line), line)
    o0 = intro + body_s
    for k, line in enumerate(cards['outro_lines']):
        add(o0, total, 'Outro', r'{\pos(540,%d)}' % (800 + k * 110) + post._esc(line), line)
    add(o0, total, 'Outro', r'{\pos(540,1300)\fs44}' + post._esc(cards['brand']), cards['brand'])
    return head + '\n'.join(ev) + '\n', texts


def qa_footage(frames, ex, cfg):
    """Проверка живого видео: человек найден, один, без аномалий; углы в отрезках удержания; ограничения."""
    from .qa import _angle_check, _ctol
    q = cfg['qa']
    tol = ex.get('tolerance_deg', q['angle_tolerance_deg'])
    checks = []
    found = [f for f in frames if f['pose']]
    rate = len(found) / max(1, len(frames))
    checks.append({'name': 'поза найдена в кадрах', 'passed': rate >= q['min_detection_rate'], 'detail': f'{rate:.0%} из {len(frames)}'})
    bones = [bone_lengths(f['pose']['pts'], f['pose']['vis'], 0.5) for f in found]
    med = {k: statistics.median([b[k] for b in bones if k in b]) for k in {k for b in bones for k in b}}
    body_h = statistics.median([float(np.ptp(f['pose']['pts'][:, 1])) for f in found]) if found else 1
    bad = sum(1 for b in bones if any(med[k] > 0.03 * body_h and abs(L - med[k]) / med[k] > q['bone_ratio_max_dev'] for k, L in b.items()))
    share = bad / max(1, len(found))
    # у живого человека длины в кадре меняет ракурс (присед анфас укорачивает бедра), а не брак: только для информации
    checks.append({'name': 'анатомия: длины костей', 'passed': True,
                   'detail': f'кадров с выбросами {share:.1%}; не блокирует: живое видео, проверка нужна для ИИ-генерации'})
    people = sum(1 for f in found if f['pose'].get('people', 1) > 1)
    checks.append({'name': 'в кадре один человек', 'passed': people <= 0.02 * len(frames), 'detail': f'кадров с несколькими людьми: {people}'})

    def series(metric, a, b):
        vals = [measure(metric, f['pose']['pts'], f['pose']['vis'], q['min_landmark_visibility'])
                for f in found if a <= f['t'] <= b]
        return [x for x in vals if x is not None]

    for s in ex['footage']['segments']:
        if not s.get('targets'):
            continue
        a, b = s['t0'] + (s['t1'] - s['t0']) * 0.2, s['t1'] - (s['t1'] - s['t0']) * 0.2
        for m, tgt in s['targets'].items():
            vals = series(m, a, b)
            val = float(np.median(vals)) if vals else None
            checks.append(_angle_check(f'{s["label_ru"]} ({s["t0"]:g}–{s["t1"]:g} с): {m}', m, val, tgt, tol, ex, cfg, phase=s['name']))
    t_all = (ex['footage']['segments'][0]['t0'], ex['footage']['segments'][-1]['t1'])
    for c in ex.get('constraints', []):
        hold = [s for s in ex['footage']['segments'] if s.get('targets')]
        vals = [x for s in hold for x in series(c['metric'], s['t0'], s['t1'])]
        if not vals:
            checks.append({'name': f'ограничение {c["metric"]}', 'passed': False, 'detail': 'нет измерений'})
            continue
        vv = np.array(vals)
        lo, hi = c.get('min', -999), c.get('max', 999)
        ct = _ctol(c['metric'], tol)
        out = float(np.mean((vv < lo - ct) | (vv > hi + ct)))
        checks.append({'name': f'ограничение {c["metric"]} в [{lo}; {hi}] (удержание)', 'passed': out <= 0.05,
                       'detail': f'{c.get("why_ru", "")}; вне диапазона {out:.0%} кадров, измерено {vv.min():.0f}–{vv.max():.0f}'})
    failed = [c for c in checks if not c['passed']]
    return {'exercise': ex['id'], 'checked_at': now(), 'frames': len(frames), 'source_range_s': list(t_all),
            'passed': not failed, 'failed_count': len(failed), 'checks': checks, 'bad_phases': [], 'global_fail': bool(failed)}


def import_source(ex_id, src):
    dst = paths.WORK / ex_id / 'source' / Path(src).name
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(src, dst)
    return dst


def run(ex, cfg, new_version=False):
    from . import qa
    from .pipeline import next_version, tech_checks
    f = ex['footage']
    src = paths.STATE / f['file'] if not Path(f['file']).is_absolute() else Path(f['file'])
    if not src.exists():
        raise Stop(2, f'Нет исходного видео {src}. Положи его: ev.py import {ex["id"]} <файл>')
    with manifest.locked() as m:
        ver = next_version(manifest.ex_entry(m, ex['id']))
    build = paths.WORK / ex['id'] / 'footage' / f'v{ver}'
    if build.exists():
        shutil.rmtree(build)
    build.mkdir(parents=True)
    norm = build / 'norm.mp4'
    log('Нормализую исходник: 1080x1920, 30 fps')
    normalize_source(src, norm, cfg)
    frames, matted = matte_cached(ex, src, norm, f.get('background', {}), cfg)
    if f.get('follow', True):
        followed = build / 'followed.mp4'
        log('Плавное приближение к человеку')
        follow(matted, followed, frames, cfg)
        frames = _zoom_frames(frames, _zoom_path(frames, cfg), cfg)
        matted = followed
    log('Автопроверка позы по исходнику')
    rep = qa_footage(frames, ex, cfg)
    body, timeline = cut(matted, f['segments'], build, cfg)
    body_s = post.probe(body)['duration']
    ass, texts = captions(ex, timeline, body_s, cfg)
    from .exercise import find_banned
    banned = find_banned(texts)
    if banned:
        raise Stop(2, 'В титрах медицинские обещания: ' + '; '.join(f'«{t}»' for t, _ in banned))
    name = f'{ex["id"]}_v{ver}'
    paths.OUT.mkdir(parents=True, exist_ok=True)
    mp4, jpg = paths.OUT / f'{name}.mp4', paths.OUT / f'{name}.jpg'
    total = cfg['video']['intro_s'] + body_s + cfg['video']['outro_s']
    log(f'Сборка {paths.rel(mp4)}')
    meta = post.assemble([body], ass, mp4, build, cfg, total)
    key = next((t for t in timeline if t['seg'] == f.get('poster_segment', timeline[0]['seg'])), timeline[0])
    post.poster(mp4, jpg, cfg['video']['intro_s'] + (key['t0'] + key['t1']) / 2)
    rep['checks'] += tech_checks(meta, cfg)
    rep['failed_count'] = sum(1 for c in rep['checks'] if not c['passed'])
    rep['passed'] = rep['failed_count'] == 0
    paths.REPORTS.mkdir(parents=True, exist_ok=True)
    rj, rm = paths.REPORTS / f'{name}.qa.json', paths.REPORTS / f'{name}.qa.md'
    save_json(rj, rep)
    rm.write_text(qa.to_markdown(rep, name, {'файл': paths.rel(mp4), 'источник': 'живое видео, фон заменен', 'длительность': f'{meta["duration"]:.1f} с',
                                             'размер': f'{meta["size_bytes"] / 1048576:.2f} МБ', 'дозировка': ex['dose_ru']}), encoding='utf-8')
    with manifest.locked() as m:
        e = manifest.ex_entry(m, ex['id'])
        e['provider'] = 'footage'
        v = e['videos'].setdefault(name, {'version': ver, 'created': now(), 'provider': 'footage'})
        v.update({'file': paths.rel(mp4), 'preview': paths.rel(jpg), 'sha256': sha256_file(mp4), 'build': paths.rel(build),
                  'qa': {'passed': rep['passed'], 'failed': rep['failed_count'], 'report': paths.rel(rm)}, 'timeline': timeline,
                  'duration_s': round(meta['duration'], 2), 'size_mb': round(meta['size_bytes'] / 1048576, 2)})
        manifest.set_status(v, 'draft', 'ev.py', 'собрано из живого видео')
        if rep['passed']:
            manifest.set_status(v, 'qa_passed', 'autoqa', 'все проверки пройдены')
    log(f'\n{"qa_passed" if rep["passed"] else "НЕ ПРОЙДЕНО"}: {name}\n  видео: {paths.rel(mp4)}\n  отчет: {paths.rel(rm)}')
    return 0 if rep['passed'] else 1
