"""Автопроверка позы MediaPipe: углы суставов против JSON (допуск ±tol), число повторов, темп, анатомия (длины костей,
скачки точек), сторона к камере, ограничения. qa_passed ставится, только если прошли все обязательные проверки."""
import statistics

import numpy as np

from . import pose
from .angles import measure, bone_lengths, side_visibility
from .util import now


def _tol(ex, cfg):
    return ex.get('tolerance_deg', cfg['qa']['angle_tolerance_deg'])


def _ctol(metric, tol):
    """Допуск в градусах к процентным метрикам не применяется."""
    return 0 if metric == 'feet_level' else tol


def _blocking(metric, ex, cfg):
    """В режиме demo блокирует только основной сустав: видео наглядное, а не измерительное."""
    return cfg['qa'].get('mode', 'strict') == 'strict' or metric == ex.get('primary_joint')


def _angle_check(name, metric, val, tgt, tol, ex, cfg, **kw):
    ok = val is not None and abs(val - tgt) <= tol
    hard = _blocking(metric, ex, cfg)
    c = {'name': name, 'target': tgt, 'measured': None if val is None else round(val, 1),
         'delta': None if val is None else round(val - tgt, 1), 'passed': ok or not hard, **kw}
    if not hard:
        c['detail'] = ('в допуске' if ok else 'вне допуска') + ', не блокирует (режим demo)'
    return c


def check_image(img_path, targets, ex, cfg, label):
    """Проверка ключевого кадра до генерации видео: дешевле поймать кривую позу на картинке."""
    q, tol = cfg['qa'], ex.get('tolerance_deg', cfg['qa']['angle_tolerance_deg'])
    det = pose.detect_image(img_path)
    res = {'image': str(img_path), 'pose': label, 'checks': [], 'passed': False}
    if not det:
        res['checks'].append({'name': 'человек найден', 'passed': False, 'detail': 'MediaPipe не нашел позу'})
        return res
    if det['people'] > 1:
        res['checks'].append({'name': 'один человек', 'passed': False, 'detail': f'людей в кадре: {det["people"]}'})
    for m, tgt in targets.items():
        val = measure(m, det['pts'], det['vis'], q['min_landmark_visibility'])
        res['checks'].append(_angle_check(f'угол {m}', m, val, tgt, tol, ex, cfg))
    for c in ex.get('constraints', []):
        val = measure(c['metric'], det['pts'], det['vis'], 0.0)
        lo, hi = c.get('min', -999), c.get('max', 999)
        res['checks'].append({'name': f'ограничение {c["metric"]} в [{lo}; {hi}]', 'measured': None if val is None else round(val, 1),
                              'passed': val is not None and lo - _ctol(c['metric'], tol) <= val <= hi + _ctol(c['metric'], tol),
                              'detail': c.get('why_ru', '')})
    fs = ex['camera'].get('facing_side')
    if ex['camera']['view'] == 'side' and fs:
        other = 'right' if fs == 'left' else 'left'
        a, b = side_visibility(det['vis'], fs), side_visibility(det['vis'], other)
        res['checks'].append({'name': f'к камере {fs}-сторона', 'passed': a >= b,
                              'detail': f'видимость {fs} {a:.2f} / {other} {b:.2f}'})
    res['passed'] = all(c['passed'] for c in res['checks'])
    return res


def _series(frames, metric, min_vis):
    t, v = [], []
    for f in frames:
        if f['pose']:
            val = measure(metric, f['pose']['pts'], f['pose']['vis'], min_vis)
            if val is not None:
                t.append(f['t'])
                v.append(val)
    return np.array(t), np.array(v)


def _window(t, v, a, b):
    m = (t >= a) & (t <= b)
    return float(np.median(v[m])) if m.any() else None


def _smooth(v, k=5):
    if len(v) < k:
        return v
    return np.convolve(np.pad(v, (k // 2, k // 2), mode='edge'), np.ones(k) / k, mode='valid')


def check_video(path, ex, timeline, cfg):
    q, tol = cfg['qa'], _tol(ex, cfg)
    frames, fps = pose.detect_video(path)
    n = len(frames)
    checks = []

    def add(name, passed, phase=None, **kw):
        checks.append({'name': name, 'passed': bool(passed), **({'phase': phase} if phase else {}), **kw})

    # 1. человек найден почти в каждом кадре, и он один
    found = [f for f in frames if f['pose']]
    rate = len(found) / max(1, n)
    add('поза найдена в кадрах', rate >= q['min_detection_rate'], detail=f'{rate:.0%} из {n} кадров')
    multi = sum(1 for f in found if f['pose']['people'] > 1)
    add('в кадре один человек', multi <= 0.02 * n, detail=f'кадров с несколькими людьми: {multi}')
    if not found:
        return _finish(path, ex, checks, timeline, fps, n)

    # 2. анатомия: длины костей стабильны (лишние или вывернутые конечности, «плывущее» тело), нет скачков точек
    bones = [bone_lengths(f['pose']['pts'], f['pose']['vis'], 0.5) for f in found]
    med = {k: statistics.median([b[k] for b in bones if k in b]) for k in {k for b in bones for k in b}}
    body_h = statistics.median([float(np.ptp(f['pose']['pts'][:, 1])) for f in found]) or 1
    bad_frames = set()
    for i, b in enumerate(bones):
        for k, L in b.items():
            if med[k] > 0.03 * body_h and abs(L - med[k]) / med[k] > q['bone_ratio_max_dev']:
                bad_frames.add(i)
    jumps = 0
    key_idx = [11, 12, 23, 24, 25, 26, 27, 28]
    for i in range(1, len(found)):
        d = np.max(np.linalg.norm(found[i]['pose']['pts'][key_idx] - found[i - 1]['pose']['pts'][key_idx], axis=1))
        if d > q['max_jump_body_share'] * body_h:
            jumps += 1
            bad_frames.add(i)
    share = len(bad_frames) / len(found)
    bad_times = sorted({round(found[i]['t'], 1) for i in bad_frames})
    add('анатомия: длины костей и плавность', share <= q['max_anomaly_frame_share'],
        detail=f'аномальных кадров {share:.1%} (скачков {jumps}); время, с: {bad_times[:12]}', times=bad_times)

    # 3. сторона к камере (зеркальность)
    fs = ex['camera'].get('facing_side')
    if ex['camera']['view'] == 'side' and fs:
        other = 'right' if fs == 'left' else 'left'
        a = float(np.mean([side_visibility(f['pose']['vis'], fs) for f in found]))
        b = float(np.mean([side_visibility(f['pose']['vis'], other) for f in found]))
        add(f'к камере {fs}-сторона (не зеркало)', a >= b, detail=f'видимость {fs} {a:.2f} / {other} {b:.2f}')

    # 4. углы: старт и конец каждой фазы движения в каждом повторе
    phases = {p['name']: p for p in ex['phases']}
    series = {}
    metrics = set(ex['start_pose']['targets']) | {m for p in ex['phases'] for m in p.get('targets', {})}
    for m in metrics:
        series[m] = _series(frames, m, q['min_landmark_visibility'])
    for m, tgt in ex['start_pose']['targets'].items():
        t, v = series[m]
        val = _window(t, v, 0, 0.25)
        checks.append(_angle_check(f'старт: {m}', m, val, tgt, tol, ex, cfg, phase='start'))
    for seg in timeline:
        ph = phases[seg['phase']]
        if ph['type'] != 'move':
            continue
        for m, tgt in ph['targets'].items():
            t, v = series[m]
            val = _window(t, v, seg['t1'] - 0.25, seg['t1'] + 0.05)
            checks.append(_angle_check(f'повтор {seg["rep"]}, {ph["label_ru"].lower()}: {m}', m, val, tgt, tol, ex, cfg, phase=ph['name']))

    # 5. повторы и темп по основному суставу
    pj = ex['primary_joint']
    t, v = series.get(pj) or _series(frames, pj, q['min_landmark_visibility'])
    kp = phases[ex['key_phase']]
    s0, g0 = ex['start_pose']['targets'][pj], kp['targets'][pj]
    if len(v) > 5:
        p = (_smooth(v) - s0) / (g0 - s0)
        reps, state, rep_t, down_dur, start_cross = 0, 'low', [], [], None
        for ti, pi in zip(t, p):
            if state == 'low' and pi > 0.1 and start_cross is None:
                start_cross = ti
            if state == 'low' and pi < 0.1:
                start_cross = None
            if state == 'low' and pi > 0.7:
                state = 'high'
                reps += 1
                rep_t.append(ti)
            if state == 'high' and pi > 0.9 and start_cross is not None:
                down_dur.append(ti - start_cross)
                start_cross = None
            if state == 'high' and pi < 0.3:
                state = 'low'
                start_cross = None
        add('число повторов', reps == ex['reps_in_video'], target=ex['reps_in_video'], measured=reps,
            detail='лишние повторы обычно значат, что модель зациклила движение')
        cycle = sum(ph['duration_s'] for ph in ex['phases'])
        if len(rep_t) >= 2:
            periods = np.diff(rep_t)
            worst = float(np.max(np.abs(periods - cycle))) / cycle
            add('темп: длительность цикла', worst <= q['cycle_tolerance_share'], target=cycle,
                measured=[round(float(x), 2) for x in periods.tolist()], detail=f'отклонение до {worst:.0%}')
        # фаза, ведущая к ключевой позе: от 10% до 90% амплитуды
        planned = kp['duration_s']
        if down_dur:
            lo, hi = q['move_min_share'] * planned * 0.8, q['move_max_share'] * planned
            okd = all(lo <= d <= hi for d in down_dur)
            add(f'темп: «{kp["label_ru"].lower()}» не быстрее плана', okd, soft_phase=kp['name'], target=planned,
                measured=[round(float(d), 2) for d in down_dur], detail=f'допустимо {lo:.1f}–{hi:.1f} с (10–90% амплитуды)')
        else:
            add('темп: ключевая фаза найдена', False, soft_phase=kp['name'], detail='сустав не дошел до 90% амплитуды')
    else:
        add('сигнал основного сустава', False, detail=f'{pj}: мало измерений')

    # 6. ограничения из JSON (например, корпус не заваливается)
    for c in ex.get('constraints', []):
        t, v = _series(frames, c['metric'], q['min_landmark_visibility'])
        if not len(v):
            add(f'ограничение {c["metric"]}', False, detail='нет измерений')
            continue
        lo, hi = c.get('min', -999), c.get('max', 999)
        ct = _ctol(c['metric'], tol)
        out = float(np.mean((v < lo - ct) | (v > hi + ct)))
        add(f'ограничение {c["metric"]} в [{lo}; {hi}]', out <= 0.03, detail=f'{c.get("why_ru", "")}; вне диапазона {out:.0%} кадров, '
            f'диапазон измерений {v.min():.0f}–{v.max():.0f}')
    return _finish(path, ex, checks, timeline, fps, n)


def _finish(path, ex, checks, timeline, fps, n):
    failed = [c for c in checks if not c['passed']]
    bad_phases = sorted({c['phase'] for c in failed if c.get('phase') and c['phase'] != 'start'})
    # аномалии анатомии привязываем к фазам по времени
    for c in failed:
        for tt in c.get('times', []):
            for seg in timeline:
                if seg['t0'] <= tt <= seg['t1']:
                    ph = seg['phase']
                    moves = [p['name'] for p in ex['phases'] if p['type'] == 'move']
                    if ph not in moves:  # пауза = последний кадр предыдущего движения
                        idx = [p['name'] for p in ex['phases']].index(ph)
                        ph = ex['phases'][idx - 1]['name']
                    if ph not in bad_phases:
                        bad_phases.append(ph)
    if not bad_phases:  # темп и повторы указывают на фазу, только если углы и анатомия не назвали виновника
        bad_phases = sorted({c['soft_phase'] for c in failed if c.get('soft_phase')})
    global_fail = any(not c.get('phase') and not c.get('times') and not c.get('soft_phase') for c in failed) and not bad_phases
    return {'video': str(path), 'exercise': ex['id'], 'checked_at': now(), 'frames': n, 'fps': round(fps, 2),
            'passed': not failed, 'failed_count': len(failed), 'checks': checks,
            'bad_phases': sorted(bad_phases), 'global_fail': global_fail}


def to_markdown(rep, title, extra=None):
    lines = [f'# Автопроверка: {title}', '',
             f'**Итог: {"ПРОЙДЕНО" if rep["passed"] else "НЕ ПРОЙДЕНО"}** · проверок {len(rep["checks"])}, '
             f'не пройдено {rep["failed_count"]} · кадров {rep["frames"]} · {rep["checked_at"]}', '']
    if extra:
        lines += [f'- {k}: {v}' for k, v in extra.items()] + ['']
    lines += ['| Проверка | Цель | Измерено | Δ | Итог | Детали |', '|---|---|---|---|---|---|']
    for c in rep['checks']:
        mark = '❌' if not c['passed'] else ('ℹ️' if 'вне допуска' in c.get('detail', '') else '✅')
        lines.append(f'| {c["name"]} | {c.get("target", "")} | {c.get("measured", "")} | {c.get("delta", "")} | '
                     f'{mark} | {c.get("detail", "")} |')
    if rep.get('keyframes'):
        lines += ['', '## Ключевые кадры', '']
        for k in rep['keyframes']:
            bad = [c['name'] for c in k['checks'] if not c['passed']]
            lines.append(f'- {k["pose"]}: {"✅" if k["passed"] else "❌ " + ", ".join(bad)}')
    if not rep['passed']:
        lines += ['', f'Фазы к перегенерации: {", ".join(rep["bad_phases"]) or "все"}']
    lines += ['', 'Автопроверка не видит всё: лишние пальцы, «плывущее» лицо, мелкие артефакты. Статус approved ставит только человек после просмотра.']
    return '\n'.join(lines) + '\n'
