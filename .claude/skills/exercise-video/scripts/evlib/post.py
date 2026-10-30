"""Постобработка ffmpeg: обрезка неподвижных краев клипа, подгонка темпа, паузы, повторы, замедление ключевой фазы,
вступление и концовка, русские титры (ASS), кодирование 1080x1920, 30 fps, H.264, не больше max_mb."""
import json
import shutil
import subprocess
from pathlib import Path

from . import paths
from .util import Stop, load_json, plural, log

INTER = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '14', '-pix_fmt', 'yuv420p', '-an']


def ff(args, what):
    cmd = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', *map(str, args)]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        raise Stop(8, f'ffmpeg ({what}) упал:\n{r.stderr[-1500:]}')


def probe(path):
    r = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
                        'stream=width,height,r_frame_rate,codec_name,pix_fmt,nb_frames:format=duration,size',
                        '-of', 'json', str(path)], capture_output=True, text=True)
    if r.returncode:
        raise Stop(8, f'ffprobe не читает {path}: {r.stderr[-300:]}')
    j = json.loads(r.stdout)
    s, f = j['streams'][0], j['format']
    num, den = map(int, s['r_frame_rate'].split('/'))
    return {'width': s['width'], 'height': s['height'], 'fps': num / den, 'codec': s['codec_name'], 'pix_fmt': s.get('pix_fmt'),
            'duration': float(f['duration']), 'size_bytes': int(f['size'])}


def motion_bounds(path, thr=1.2):
    """Начало и конец движения в клипе по разнице соседних кадров (сек). Модели часто стоят на месте в начале и в конце."""
    import cv2
    import numpy as np
    cap = cv2.VideoCapture(str(path))
    fps = cap.get(cv2.CAP_PROP_FPS) or 24
    prev, diffs = None, []
    while True:
        ok, img = cap.read()
        if not ok:
            break
        g = cv2.GaussianBlur(cv2.cvtColor(cv2.resize(img, (180, 320)), cv2.COLOR_BGR2GRAY), (5, 5), 0).astype(np.float32)
        if prev is not None:
            diffs.append(float(np.mean(np.abs(g - prev))))
        prev = g
    cap.release()
    if not diffs:
        return 0.0, 0.0, 0.0
    total = (len(diffs) + 1) / fps
    moving = [i for i, d in enumerate(diffs) if d > thr]
    if not moving:
        return 0.0, total, total
    return moving[0] / fps, (moving[-1] + 2) / fps, total


def fit_clip(src, dst, target_s, cfg, mirror=False):
    """Обрезает неподвижные края и растягивает или сжимает движение ровно до target_s секунд."""
    v = cfg['video']
    t0, t1, total = motion_bounds(src)
    if t1 - t0 < 0.3:
        t0, t1 = 0.0, total
    factor = target_s / (t1 - t0)
    vf = (f'trim=start={t0:.3f}:end={t1:.3f},setpts=(PTS-STARTPTS)*{factor:.5f},'
          f'scale={v["width"]}:{v["height"]}:force_original_aspect_ratio=increase,crop={v["width"]}:{v["height"]},'
          f'{"hflip," if mirror else ""}fps={v["fps"]},setsar=1,format=yuv420p')
    ff(['-i', src, '-vf', vf, '-t', f'{target_s:.3f}', *INTER, dst], 'подгонка клипа')
    return {'trim': [round(t0, 2), round(t1, 2)], 'source_s': round(total, 2), 'speed_factor': round(1 / factor, 3)}


def still(src_video, dst, seconds, cfg, at='end'):
    """Пауза: последний (или первый) кадр держится seconds секунд."""
    v = cfg['video']
    sel = ['-sseof', '-0.05'] if at == 'end' else []
    tmp = Path(dst).with_suffix('.png')
    ff([*sel, '-i', src_video, '-frames:v', '1', '-update', '1', tmp], 'кадр для паузы')
    ff(['-loop', '1', '-framerate', v['fps'], '-i', tmp, '-t', f'{seconds:.3f}', '-vf', f'fps={v["fps"]},setsar=1,format=yuv420p', *INTER, dst], 'пауза')
    tmp.unlink(missing_ok=True)


def concat(parts, dst):
    lst = Path(dst).with_suffix('.txt')
    lst.write_text(''.join(f"file '{Path(p).resolve()}'\n" for p in parts))
    ff(['-f', 'concat', '-safe', '0', '-i', lst, *INTER, dst], 'склейка')
    lst.unlink(missing_ok=True)


def build_body(ex, fitted, build_dir, cfg):
    """fitted: phase_name → путь подогнанного клипа. Возвращает (reps.mp4, slow.mp4, timeline)."""
    build_dir = Path(build_dir)
    segs, timeline, t, prev = [], [], 0.0, None
    for ph in ex['phases']:
        if ph['type'] == 'move':
            prev = fitted[ph['name']]
            segs.append((ph, prev))
        else:
            hp = build_dir / f'hold_{ph["name"]}.mp4'
            still(prev, hp, ph['duration_s'], cfg)
            segs.append((ph, hp))
    parts = []
    for rep in range(1, ex['reps_in_video'] + 1):
        for ph, p in segs:
            parts.append(p)
            timeline.append({'rep': rep, 'phase': ph['name'], 'type': ph['type'], 't0': round(t, 3), 't1': round(t + ph['duration_s'], 3)})
            t += ph['duration_s']
    reps = build_dir / 'body_reps.mp4'
    concat(parts, reps)
    kp = next(p for p in ex['phases'] if p['name'] == ex['key_phase'])
    slow = build_dir / 'body_slow.mp4'
    f = cfg['video']['slow_factor']
    ff(['-i', fitted[kp['name']], '-vf', f'setpts={f}*PTS,fps={cfg["video"]["fps"]}', *INTER, slow], 'замедление')
    return reps, slow, timeline


def mirror_video(src, dst):
    ff(['-i', src, '-vf', 'hflip', *INTER, dst], 'зеркало')


def _ass_color(hex_rgb, alpha=0):
    h = hex_rgb.lstrip('#')
    return f'&H{alpha:02X}{h[4:6]}{h[2:4]}{h[0:2]}'.upper()


def _esc(s):
    return s.replace('\\', '').replace('{', '(').replace('}', ')')


def _wrap(s, n=30):
    words, lines, cur = s.split(), [], ''
    for w in words:
        if cur and len(cur) + 1 + len(w) > n:
            lines.append(cur)
            cur = w
        else:
            cur = f'{cur} {w}'.strip()
    lines.append(cur)
    return r'\N'.join(_esc(l) for l in lines)


def _ts(t):
    h, rem = divmod(max(0.0, t), 3600)
    m, s = divmod(rem, 60)
    return f'{int(h)}:{int(m):02d}:{s:05.2f}'


def ass_head(cfg):
    """Шапка ASS: стили титров в цветах бренда."""
    v = cfg['video']
    fg, bg, acc = v['brand_fg'], v['brand_bg'], v['accent']
    font = v['font']
    return f"""[Script Info]
ScriptType: v4.00+
PlayResX: {v['width']}
PlayResY: {v['height']}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Title,{font},76,{_ass_color('#FFFFFF')},{_ass_color('#FFFFFF')},{_ass_color(fg)},{_ass_color(fg, 0x60)},1,0,0,0,100,100,0,0,3,18,0,5,80,80,0,204
Style: Info,{font},46,{_ass_color('#FFFFFF')},{_ass_color('#FFFFFF')},{_ass_color(fg)},{_ass_color(fg, 0x60)},0,0,0,0,100,100,0,0,3,14,0,5,80,80,0,204
Style: Cue,{font},54,{_ass_color('#FFFFFF')},{_ass_color('#FFFFFF')},{_ass_color(fg, 0x30)},{_ass_color(fg, 0x30)},1,0,0,0,100,100,0,0,3,20,0,2,70,70,170,204
Style: Phase,{font},48,{_ass_color(fg)},{_ass_color(fg)},{_ass_color(acc)},{_ass_color(acc)},1,0,0,0,100,100,0,0,3,14,0,8,70,70,150,204
Style: Rep,{font},38,{_ass_color('#FFFFFF')},{_ass_color('#FFFFFF')},{_ass_color(fg, 0x50)},{_ass_color(fg, 0x50)},0,0,0,0,100,100,0,0,3,10,0,9,60,60,60,204
Style: AI,{font},36,{_ass_color('#FFFFFF')},{_ass_color('#FFFFFF')},{_ass_color('#000000', 0x70)},{_ass_color('#000000', 0x70)},0,0,0,0,100,100,0,0,3,10,0,7,60,60,60,204
Style: Outro,{font},58,{_ass_color(fg)},{_ass_color(fg)},{_ass_color(bg)},{_ass_color(bg)},1,0,0,0,100,100,0,0,1,0,0,5,80,80,0,204

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""


def captions(ex, timeline, reps_s, slow_s, cfg):
    """Текст титров и ASS-файл. Возвращает (ass_text, все строки титров для проверки на запрещенные фразы)."""
    v, cards = cfg['video'], load_json(paths.TEMPLATES / 'cards.json')
    intro, outro = v['intro_s'], v['outro_s']
    total = intro + reps_s + slow_s + outro
    head = ass_head(cfg)
    ev, texts = [], []

    def add(t0, t1, style, text, raw=None):
        texts.append(raw if raw is not None else text)
        ev.append(f'Dialogue: 0,{_ts(t0)},{_ts(t1)},{style},,0,0,0,,{text}')

    add(0, total, 'AI', _esc(cards['ai_label']), cards['ai_label'])
    reps = ex['reps_in_video']
    reps_line = cards['intro_reps'].format(reps=reps, reps_word=plural(reps, 'повтор', 'повтора', 'повторов'))
    tempo_line = cards['intro_tempo'].format(tempo=ex['tempo_ru'])
    add(0, intro, 'Title', r'{\pos(540,820)}' + _wrap(ex['title_ru'], 22), ex['title_ru'])
    add(0, intro, 'Info', r'{\pos(540,1060)}' + _wrap(f'{ex["zone"].capitalize()} · {reps_line}', 34), f'{ex["zone"]} · {reps_line}')
    add(0, intro, 'Info', r'{\pos(540,1180)}' + _wrap(tempo_line, 34), tempo_line)

    phases = {p['name']: p for p in ex['phases']}
    for seg in timeline:
        a, b = intro + seg['t0'], intro + seg['t1']
        ph = phases[seg['phase']]
        label = f'{ph["label_ru"]} · {ph["duration_s"]:g} с'
        add(a, b, 'Phase', _esc(label), label)
    for rep in range(1, reps + 1):
        segs = [s for s in timeline if s['rep'] == rep]
        a, b = intro + segs[0]['t0'], intro + segs[-1]['t1']
        rc = cards['rep_counter'].format(i=rep, n=reps)
        add(a, b, 'Rep', _esc(rc), rc)
        cue = ex['cues_ru'][(rep - 1) % len(ex['cues_ru'])]
        add(a, b, 'Cue', _wrap(cue), cue)
    s0 = intro + reps_s
    kp = phases[ex['key_phase']]
    st = cards['slow_title'].format(label=kp['label_ru'].lower())
    add(s0, s0 + slow_s, 'Phase', _esc(st), st)
    half = slow_s / 2
    for i, m in enumerate(ex['mistakes_ru']):
        line = cards['mistake_prefix'] + m
        add(s0 + i * half, s0 + (i + 1) * half, 'Cue', _wrap(line), line)
    o0 = s0 + slow_s
    for i, line in enumerate(cards['outro_lines']):
        add(o0, total, 'Outro', r'{\pos(540,%d)}' % (800 + i * 110) + _esc(line), line)
    add(o0, total, 'Outro', r'{\pos(540,1300)\fs44}' + _esc(cards['brand']), cards['brand'])
    return head + '\n'.join(ev) + '\n', texts


def assemble(parts, ass_text, out_mp4, build_dir, cfg, total_s):
    """Вступление (размытый первый кадр) + части ролика + концовка (фон бренда), титры, финальное кодирование ≤ max_mb."""
    v = cfg['video']
    build_dir = Path(build_dir)
    intro = build_dir / 'intro.mp4'
    first = build_dir / 'first.png'
    ff(['-i', parts[0], '-frames:v', '1', first], 'кадр вступления')
    ff(['-loop', '1', '-framerate', v['fps'], '-i', first, '-t', v['intro_s'],
        '-vf', f'boxblur=24:2,eq=brightness=-0.18,fps={v["fps"]},setsar=1,format=yuv420p', *INTER, intro], 'вступление')
    outro = build_dir / 'outro.mp4'
    ff(['-f', 'lavfi', '-i', f'color=c={v["brand_bg"].replace("#", "0x")}:s={v["width"]}x{v["height"]}:r={v["fps"]}',
        '-t', v['outro_s'], '-vf', 'setsar=1,format=yuv420p', *INTER, outro], 'концовка')
    joined = build_dir / 'joined.mp4'
    concat([intro, *parts, outro], joined)
    ass = build_dir / 'captions.ass'
    ass.write_text(ass_text, encoding='utf-8')
    limit = v['max_mb'] * 1024 * 1024
    cap_kbps = int(limit * 8 * 0.92 / total_s / 1000)
    sub = f"subtitles=filename='{ass}':fontsdir='{paths.FONTS}'"
    for crf, kbps in ((22, cap_kbps), (26, int(cap_kbps * 0.8)), (30, int(cap_kbps * 0.6))):
        ff(['-i', joined, '-vf', f'{sub},fps={v["fps"]},format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high',
            '-level', '4.1', '-crf', crf, '-maxrate', f'{kbps}k', '-bufsize', f'{kbps * 2}k', '-r', v['fps'],
            '-movflags', '+faststart', '-an', out_mp4], 'финальное кодирование')
        if Path(out_mp4).stat().st_size <= limit:
            break
        log(f'  файл больше {v["max_mb"]} МБ, перекодирую сильнее')
    return probe(out_mp4)


def poster(mp4, jpg, at_s):
    ff(['-ss', f'{at_s:.2f}', '-i', mp4, '-frames:v', '1', '-q:v', '3', jpg], 'превью')


def check_tools():
    missing = [t for t in ('ffmpeg', 'ffprobe') if not shutil.which(t)]
    if missing:
        raise Stop(5, f'Не установлены: {", ".join(missing)}')
    r = subprocess.run(['ffmpeg', '-hide_banner', '-filters'], capture_output=True, text=True)
    if ' subtitles ' not in r.stdout:
        raise Stop(5, 'ffmpeg собран без libass (фильтр subtitles): титры не наложить')
