"""Загрузка и проверка exercises/<id>.json. Зеркальные упражнения (mirror_of) собираются из источника с заменой сторон."""
import copy
import re

from . import paths
from .angles import METRICS, swap_side_key
from .util import load_json, Stop

SIDE_WORDS = re.compile(r'\b(лев|прав)\w*', re.IGNORECASE)


def banned_patterns():
    pats = []
    for line in (paths.TEMPLATES / 'banned_phrases.txt').read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if line and not line.startswith('#'):
            pats.append(re.compile(line, re.IGNORECASE))
    return pats


def find_banned(texts):
    pats = banned_patterns()
    return [(t, p.pattern) for t in texts for p in pats if p.search(t)]


def raw(ex_id):
    p = paths.EXERCISES / f'{ex_id}.json'
    if not p.exists():
        raise Stop(2, f'Нет файла упражнения: {paths.rel(p)}')
    return load_json(p)


def _swap_targets(t):
    return {swap_side_key(k): v for k, v in t.items()}


def mirrored(src, over):
    """Зеркальная версия: левое ↔ правое во всех метриках, сторонах и ракурсе. Тексты берутся из файла-зеркала."""
    ex = copy.deepcopy(src)
    flip = {'left': 'right', 'right': 'left'}
    ex['side'] = flip.get(src['side'], src['side'])
    ex['camera']['facing_side'] = flip.get(src['camera'].get('facing_side'), src['camera'].get('facing_side'))
    ex['start_pose']['targets'] = _swap_targets(src['start_pose']['targets'])
    for ph in ex['phases']:
        if 'targets' in ph:
            ph['targets'] = _swap_targets(ph['targets'])
    ex['primary_joint'] = swap_side_key(src['primary_joint'])
    for c in ex.get('constraints', []):
        c['metric'] = swap_side_key(c['metric'])
    for k, v in over.items():
        ex[k] = copy.deepcopy(v)
    ex['mirror_of'] = over['mirror_of']
    return ex


def load(ex_id):
    data = raw(ex_id)
    if data.get('mirror_of'):
        src = raw(data['mirror_of'])
        if src.get('mirror_of'):
            raise Stop(2, f'{ex_id}: источник {src["id"]} сам зеркальный')
        ex = mirrored(src, data)
        ex['_mirror_text_fields'] = [k for k in ('title_ru', 'cues_ru', 'mistakes_ru', 'start_pose') if k in data]
        return ex
    return data


def tempo_ru(ex):
    parts = []
    for ph in ex['phases']:
        d = f'{ph["duration_s"]:g}'
        parts.append(f'пауза {d}' if ph['type'] == 'hold' else f'{d} сек {ph["label_ru"].lower()}')
    return ', '.join(parts)


def caption_texts(ex):
    return [ex['title_ru'], *ex['cues_ru'], *ex['mistakes_ru'], *[p['label_ru'] for p in ex['phases']], ex.get('tempo_ru') or tempo_ru(ex)]


def validate(ex_id):
    """Возвращает (exercise, errors, warnings). Ошибки блокируют запуск, предупреждения нет."""
    errors, warns = [], []
    data = raw(ex_id)
    try:
        import jsonschema
        jsonschema.validate(data, load_json(paths.EXERCISES / '_schema.json'))
    except ImportError:
        warns.append('jsonschema не установлен: проверка по схеме пропущена')
    except Exception as e:  # jsonschema.ValidationError
        errors.append(f'схема: {getattr(e, "message", e)} (путь: {"/".join(map(str, getattr(e, "path", [])))})')
        return data, errors, warns
    if data['id'] != ex_id:
        errors.append(f'id в файле ({data["id"]}) не совпадает с именем файла ({ex_id})')
    ex = load(ex_id)

    names = [p['name'] for p in ex['phases']]
    if len(set(names)) != len(names):
        errors.append('имена фаз повторяются')
    if ex['key_phase'] not in names:
        errors.append(f'key_phase "{ex["key_phase"]}" нет среди фаз {names}')
    if ex['phases'][0]['type'] != 'move':
        errors.append('первая фаза должна быть движением (move): клип стартует от стартового кадра')
    for i, ph in enumerate(ex['phases']):
        if ph['type'] == 'move':
            for f in ('motion_en', 'targets'):
                if f not in ph:
                    errors.append(f'фаза {ph["name"]}: нет поля {f}')
            if not ph.get('returns_to_start') and 'end_pose_en' not in ph:
                errors.append(f'фаза {ph["name"]}: нужен end_pose_en или returns_to_start')
            if ph.get('returns_to_start') and ph.get('targets') and ph['targets'] != ex['start_pose']['targets']:
                warns.append(f'фаза {ph["name"]}: returns_to_start, но targets отличаются от стартовых')
        elif i > 0 and ex['phases'][i - 1]['type'] == 'hold':
            errors.append(f'фаза {ph["name"]}: две паузы подряд')
    last = ex['phases'][-1]
    if not (last['type'] == 'move' and last.get('returns_to_start')):
        errors.append('последняя фаза должна возвращать в стартовую позу (returns_to_start): иначе повторы не склеятся')

    all_metrics = set(ex['start_pose']['targets']) | {k for p in ex['phases'] for k in p.get('targets', {})} | {c['metric'] for c in ex.get('constraints', [])} | {ex['primary_joint']}
    for m in sorted(all_metrics):
        if m not in METRICS:
            errors.append(f'неизвестная метрика {m}; доступны: {", ".join(sorted(METRICS))}')
    if ex['primary_joint'] not in ex['start_pose']['targets']:
        errors.append('primary_joint должен быть в start_pose.targets')
    kp = next((p for p in ex['phases'] if p['name'] == ex['key_phase']), None)
    if kp and ex['primary_joint'] not in kp.get('targets', {}):
        errors.append('primary_joint должен быть в targets ключевой фазы')
    elif kp and abs(kp['targets'][ex['primary_joint']] - ex['start_pose']['targets'][ex['primary_joint']]) < 15:
        errors.append('амплитуда primary_joint в ключевой фазе меньше 15°: повторы не посчитать')

    cam = ex['camera']
    if cam['view'] == 'side' and cam.get('facing_side') not in ('left', 'right'):
        errors.append('для бокового ракурса укажи camera.facing_side: left или right (сторона тела к камере)')
    if cam['view'] == 'side':
        far = 'right' if cam.get('facing_side') == 'left' else 'left'
        for m in all_metrics:
            if m.endswith('_' + far):
                warns.append(f'метрика {m} на дальней от камеры стороне: MediaPipe мерит ее неточно')
    if ex['side'] in ('left', 'right'):
        if not SIDE_WORDS.search(ex['title_ru']):
            warns.append('одностороннее упражнение: укажи сторону в названии, например «(левая сторона)»')

    if ex.get('tempo_ru') and ex['tempo_ru'] != tempo_ru(ex):
        warns.append(f'tempo_ru «{ex["tempo_ru"]}» не совпадает с фазами: «{tempo_ru(ex)}». В титры пойдет вариант из фаз.')
    for t, pat in find_banned(caption_texts(ex)):
        errors.append(f'медицинское обещание в тексте «{t}» (правило {pat}). Только техника.')
    for t in caption_texts(ex):
        if len(t) > 64:
            errors.append(f'слишком длинный титр (>64 знаков): «{t}»')

    if ex.get('mirror_of'):
        src = raw(ex['mirror_of'])
        own = set(ex['_mirror_text_fields'])
        for field in ('title_ru', 'cues_ru', 'mistakes_ru'):
            vals = src[field] if isinstance(src[field], list) else [src[field]]
            if field not in own and any(SIDE_WORDS.search(v) for v in vals):
                errors.append(f'зеркало: в {field} источника есть слова «левый/правый», задай свой {field} в {ex_id}.json')
    ex['tempo_ru'] = tempo_ru(ex)
    return ex, errors, warns


def require_valid(ex_id):
    ex, errors, warns = validate(ex_id)
    if errors:
        raise Stop(2, f'{ex_id}: данных не хватает или они противоречивы:\n  - ' + '\n  - '.join(errors))
    return ex, warns


def poses(ex):
    """Ключевые позы: start + конец каждой move-фазы (кроме возврата в старт)."""
    out = [('start', ex['start_pose']['prompt_en'], ex['start_pose']['targets'])]
    for ph in ex['phases']:
        if ph['type'] == 'move' and not ph.get('returns_to_start'):
            out.append((ph['name'], ph['end_pose_en'], ph['targets']))
    return out


def clip_plan(ex):
    """Клипы: по одному на move-фазу. Возвращает [(phase, from_pose, to_pose)]."""
    plan, cur = [], 'start'
    for ph in ex['phases']:
        if ph['type'] == 'move':
            to = 'start' if ph.get('returns_to_start') else ph['name']
            plan.append((ph, cur, to))
            cur = to
    return plan
