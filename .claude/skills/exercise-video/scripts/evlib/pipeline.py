"""Конвейер одного упражнения. Повторный запуск идемпотентен: готовые кадры и клипы берутся из кэша,
перегенерируется только то, что помечено плохим по итогам автопроверки; qa_passed и approved не трогаются."""
import shutil
import time
from pathlib import Path

from . import exercise, manifest, paths, post, qa
from .providers import get as get_provider
from .util import Stop, load_json, save_json, key_of, sha256_file, now, log

VIEW = {
    # человек лицом к левому краю кадра повернут к камере ЛЕВЫМ боком (и наоборот); проверено MediaPipe
    ('side', 'left'): "Strict side profile view: the person's LEFT side faces the camera, the person faces the LEFT edge of the frame.",
    ('side', 'right'): "Strict side profile view: the person's RIGHT side faces the camera, the person faces the RIGHT edge of the frame.",
    ('front', None): "Front view: the person faces the camera; the person's left arm and leg appear on the RIGHT side of the image.",
    ('back', None): "Back view: the person's back faces the camera; the person's left arm and leg appear on the LEFT side of the image.",
}
SIDE_EN = {'left': 'LEFT', 'right': 'RIGHT'}


def view_clause(ex):
    cam = ex['camera']
    return VIEW.get((cam['view'], cam.get('facing_side') if cam['view'] == 'side' else None), '')


def side_clause(ex):
    if ex['side'] in SIDE_EN:
        s = SIDE_EN[ex['side']]
        return f"Only the person's {s} side works (the {s} leg or arm as described); the other side stays still. Do not mirror."
    return 'Both sides move symmetrically.'


def tpl(name, **kw):
    return (paths.TEMPLATES / name).read_text(encoding='utf-8').strip().format(**kw)


def style(cfg):
    return cfg['library_style']


class Ctx:
    def __init__(self, ex, cfg, provider_name):
        self.ex, self.cfg = ex, cfg
        self.prov = get_provider(provider_name, cfg)
        self.dir = paths.WORK / ex['id'] / provider_name
        self.dir.mkdir(parents=True, exist_ok=True)
        self.state_path = self.dir / 'state.json'
        self.state = load_json(self.state_path) if self.state_path.exists() else {'artifacts': {}, 'ledger': []}
        self.spent = 0.0

    def save(self):
        save_json(self.state_path, self.state)

    def quota(self, kind):
        """Дневной предохранитель квоты бесплатного сервиса. Бросает Stop до вызова, а не после."""
        lim = self.cfg['providers'].get(self.prov.name, {}).get('daily_limits', {}).get(kind)
        if lim is None:
            return
        used = _usage().get(self.prov.name, {}).get(time.strftime('%Y-%m-%d'), {}).get(kind, 0)
        if used >= lim:
            raise Stop(14, f'Дневной лимит {self.prov.name} для «{kind}» исчерпан ({used}/{lim}). Продолжу завтра: '
                           f'команда та же, готовое возьмется из кэша. Лимит: config.json → providers.{self.prov.name}.daily_limits')

    def charge(self, what, usd, kind=None):
        if kind:
            u = _usage()
            day = u.setdefault(self.prov.name, {}).setdefault(time.strftime('%Y-%m-%d'), {})
            day[kind] = day.get(kind, 0) + 1
            save_json(paths.WORK / 'usage.json', u)
        self.spent += usd
        self.state['ledger'].append({'at': now(), 'what': what, 'usd': round(usd, 4)})
        with manifest.locked() as m:
            e = manifest.ex_entry(m, self.ex['id'])
            e['cost_usd'] = round(e['cost_usd'] + usd, 4)
        self.save()

    def artifact(self, name, key):
        a = self.state['artifacts'].get(name)
        if a and a['key'] == key and not a.get('bad') and Path(a['file']).exists():
            return a
        return None


def _usage():
    f = paths.WORK / 'usage.json'
    return load_json(f) if f.exists() else {}


def library_reference(ctx, cfg, prov, provider_name):
    """Один эталонный кадр человека, одежды, пола и фона для всей библиотеки. После создания зафиксирован хэшем."""
    d = paths.LIBRARY / provider_name
    img, lock = d / 'reference.png', d / 'reference.json'
    if lock.exists():
        meta = load_json(lock)
        if not img.exists() or sha256_file(img) != meta['sha256']:
            raise Stop(11, f'Эталонный кадр {paths.rel(img)} изменен или удален, а вся библиотека держится на нем. '
                           f'Верни файл или пересоздай осознанно: ev.py reference --reset (все видео придется переснять).')
        return img, meta
    d.mkdir(parents=True, exist_ok=True)
    st = style(cfg)
    prompt = tpl('prompt_reference.txt', view_clause=VIEW[('side', 'left')], **st)
    ctx.quota('image')
    log(f'Создаю эталонный кадр библиотеки ({provider_name})')
    meta = prov.generate_image(prompt, cfg['seed'], img, pose_hint={}, view={'view': 'side', 'facing_side': 'left'})
    ctx.charge('эталонный кадр библиотеки', prov.price('image'), 'image')
    chk = qa.check_image(img, {}, {'camera': {'view': 'side', 'facing_side': 'left'}}, cfg, 'reference')
    if not chk['passed']:
        img.rename(img.with_name(f'rejected_{int(time.time())}.png'))
        raise Stop(10, 'Эталонный кадр не прошел проверку (человек один, левый бок к камере): '
                       + '; '.join(f'{c["name"]}: {c.get("detail", "")}' for c in chk['checks'] if not c['passed']) + '. Запусти снова.')
    meta.update({'sha256': sha256_file(img), 'prompt': prompt, 'created': now(), 'style': st, 'qa': chk})
    save_json(lock, meta)
    log(f'Эталон библиотеки зафиксирован: {paths.rel(img)}. Покажи его человеку: на нем держится вся библиотека.')
    return img, meta


def estimate(ctx):
    ex, prov = ctx.ex, ctx.prov
    dur = ctx.cfg['providers'].get(prov.name, {}).get('video_duration_s', 5)
    n_kf, n_clips = len(exercise.poses(ex)), len(exercise.clip_plan(ex))
    per_attempt = n_kf * prov.price('edit') + n_clips * prov.price('video', dur)
    return {'keyframes': n_kf, 'clips': n_clips, 'clip_s': dur, 'per_attempt_usd': round(per_attempt, 3),
            'reference_usd': prov.price('image'), 'clip_usd': round(prov.price('video', dur), 3)}


def keyframes(ctx, ref_img, ref_meta, attempt):
    ex, cfg, prov = ctx.ex, ctx.cfg, ctx.prov
    out, results = {}, []
    kdir = ctx.dir / 'keyframes'
    kdir.mkdir(exist_ok=True)
    for i, (name, pose_en, targets) in enumerate(exercise.poses(ex)):
        prompt = tpl('prompt_keyframe.txt', view_clause=view_clause(ex), pose=pose_en)
        key = key_of(prov.name, ref_meta['sha256'], prompt, targets)
        art_name = f'kf_{name}'
        a = ctx.artifact(art_name, key)
        if not a:
            prev = ctx.state['artifacts'].get(art_name, {})
            seed = prev.get('seed', cfg['seed'] + 100 + i) + (1000 if prev.get('bad') else 0)
            f = kdir / f'{name}.png'
            ctx.quota('edit')
            log(f'Ключевой кадр «{name}» (seed {seed})')
            meta = prov.edit_image(ref_img, prompt, seed, f, pose_hint=targets, view=ex['camera'])
            ctx.charge(f'кадр {name}', prov.price('edit'), 'edit')
            a = {'key': key, 'file': str(f), 'seed': seed, 'meta': meta, 'created': now()}
            ctx.state['artifacts'][art_name] = a
            ctx.save()
        res = a.get('qa') if a.get('qa_key') == key else None
        if res is None:
            res = qa.check_image(a['file'], targets, ex, cfg, name)
            a['qa'], a['qa_key'] = res, key
        if not res['passed']:
            a['bad'] = True
        ctx.save()
        results.append(res)
        out[name] = a
    return out, results


def clips(ctx, kf, confirm_cost):
    ex, cfg, prov = ctx.ex, ctx.cfg, ctx.prov
    dur = cfg['providers'].get(prov.name, {}).get('video_duration_s', 5)
    negative = (paths.TEMPLATES / 'negative.txt').read_text(encoding='utf-8').strip()
    cdir = ctx.dir / 'clips'
    cdir.mkdir(exist_ok=True)
    out = {}
    for ph, frm, to in exercise.clip_plan(ex):
        prompt = tpl('prompt_clip.txt', motion=ph['motion_en'], side_clause=side_clause(ex), view_clause=view_clause(ex))
        end = kf[to]['file'] if prov.supports_end_frame else None
        key = key_of(prov.name, kf[frm]['key'], kf[to]['key'] if end else None, prompt, negative, dur)
        art_name = f'clip_{ph["name"]}'
        a = ctx.artifact(art_name, key)
        if not a:
            with manifest.locked() as m:
                e = manifest.ex_entry(m, ex['id'])
                ok = e['cost_ok'] or confirm_cost
                if confirm_cost:
                    e['cost_ok'] = True
            have = [n for n in out]
            if not ok and have:
                return out, 'gate'
            prev = ctx.state['artifacts'].get(art_name, {})
            seed = prev.get('seed', cfg['seed'] + 500) + (1000 if prev.get('bad') else 0)
            f = cdir / f'{ph["name"]}.mp4'
            ctx.quota('video')
            log(f'Клип фазы «{ph["name"]}»: {frm} → {to}, {dur} с')
            meta = prov.image_to_video(kf[frm]['file'], end, prompt, negative, seed if prov.supports_seed else None, dur, f,
                                       pose_from=kf[frm].get('targets_hint') or _targets(ex, frm), pose_to=_targets(ex, to), view=ex['camera'])
            ctx.charge(f'клип {ph["name"]}', prov.price('video', dur), 'video')
            a = {'key': key, 'file': str(f), 'seed': seed if prov.supports_seed else None, 'meta': meta, 'prompt': prompt, 'created': now()}
            ctx.state['artifacts'][art_name] = a
            ctx.save()
            if not ok:
                out[ph['name']] = a
                return out, 'gate'
        out[ph['name']] = a
    return out, 'done'


def _targets(ex, pose_name):
    if pose_name == 'start':
        return ex['start_pose']['targets']
    return next(p['targets'] for p in ex['phases'] if p['name'] == pose_name)


def next_version(entry):
    return max([v['version'] for v in entry['videos'].values()] or [0]) + 1


def tech_checks(meta, cfg):
    v = cfg['video']
    return [
        {'name': f'разрешение {v["width"]}x{v["height"]}', 'passed': (meta['width'], meta['height']) == (v['width'], v['height']),
         'measured': f'{meta["width"]}x{meta["height"]}'},
        {'name': f'{v["fps"]} fps', 'passed': abs(meta['fps'] - v['fps']) < 0.01, 'measured': round(meta['fps'], 2)},
        {'name': 'H.264, yuv420p', 'passed': meta['codec'] == 'h264' and meta['pix_fmt'] == 'yuv420p', 'measured': f'{meta["codec"]}, {meta["pix_fmt"]}'},
        {'name': f'размер до {v["max_mb"]} МБ', 'passed': meta['size_bytes'] <= v['max_mb'] * 1024 * 1024,
         'measured': f'{meta["size_bytes"] / 1048576:.2f} МБ'},
    ]


def finish_build(ctx_like, ex, cfg, reps, slow, timeline, build_dir, provider_name, extra_report=None, source=None):
    """Автопроверка тела ролика, сборка финального файла, отчет, запись в manifest. Возвращает (video, report)."""
    log('Автопроверка позы MediaPipe по каждому кадру')
    rep = qa.check_video(reps, ex, timeline, cfg)
    reps_s, slow_s = post.probe(reps)['duration'], post.probe(slow)['duration']
    ass, texts = post.captions(ex, timeline, reps_s, slow_s, cfg)
    banned = exercise.find_banned(texts)
    if banned:
        raise Stop(2, 'В титрах медицинские обещания: ' + '; '.join(f'«{t}»' for t, _ in banned))
    with manifest.locked() as m:
        entry = manifest.ex_entry(m, ex['id'])
        ver = next_version(entry)
        name = f'{ex["id"]}_v{ver}'
        entry['videos'][name] = {'version': ver, 'status': 'draft', 'file': None, 'created': now(), 'provider': provider_name}
    paths.OUT.mkdir(parents=True, exist_ok=True)
    mp4, jpg = paths.OUT / f'{name}.mp4', paths.OUT / f'{name}.jpg'
    total = cfg['video']['intro_s'] + reps_s + slow_s + cfg['video']['outro_s']
    log(f'Сборка {paths.rel(mp4)}')
    meta = post.assemble(reps, slow, ass, mp4, build_dir, cfg, total)
    key_seg = next(s for s in timeline if s['phase'] == ex['key_phase'])
    post.poster(mp4, jpg, cfg['video']['intro_s'] + key_seg['t1'] - 0.1)
    for c in tech_checks(meta, cfg):
        rep['checks'].append(c)
    rep['failed_count'] = sum(1 for c in rep['checks'] if not c['passed'])
    rep['passed'] = rep['failed_count'] == 0
    if extra_report:
        rep.update(extra_report)
    paths.REPORTS.mkdir(parents=True, exist_ok=True)
    rj, rm = paths.REPORTS / f'{name}.qa.json', paths.REPORTS / f'{name}.qa.md'
    info = {'файл': paths.rel(mp4), 'провайдер': provider_name, 'длительность': f'{meta["duration"]:.1f} с',
            'размер': f'{meta["size_bytes"] / 1048576:.2f} МБ', 'темп': ex['tempo_ru'], 'повторов в ролике': ex['reps_in_video']}
    if source:
        info['зеркало'] = source
    save_json(rj, rep)
    rm.write_text(qa.to_markdown(rep, name, info), encoding='utf-8')
    with manifest.locked() as m:
        entry = manifest.ex_entry(m, ex['id'])
        entry['provider'] = provider_name
        v = entry['videos'][name]
        v.update({'file': paths.rel(mp4), 'preview': paths.rel(jpg), 'sha256': sha256_file(mp4),
                  'qa': {'passed': rep['passed'], 'failed': rep['failed_count'], 'report': paths.rel(rm)},
                  'build': paths.rel(build_dir), 'timeline': timeline, 'duration_s': round(meta['duration'], 2),
                  'size_mb': round(meta['size_bytes'] / 1048576, 2), **({'mirror_of': source} if source else {})})
        manifest.set_status(v, 'draft', 'ev.py', 'собрано')
        if rep['passed']:
            manifest.set_status(v, 'qa_passed', 'autoqa', 'все проверки пройдены')
        else:
            entry['attempts'] += 1
            entry['log'].append({'at': now(), 'event': 'qa_failed', 'video': name, 'failed': rep['failed_count']})
    return name, rep, rm


def run(ex_id, provider_name=None, confirm_cost=False, new_version=False):
    cfg = load_json(paths.CONFIG)
    provider_name = provider_name or cfg['provider']
    post.check_tools()
    ex, warns = exercise.require_valid(ex_id)
    for w in warns:
        log(f'Предупреждение: {w}')

    m = manifest.read()
    entry = m['exercises'].get(ex_id) or {'attempts': 0, 'cost_usd': 0.0, 'videos': {}}
    last = manifest.latest(entry)
    if last and last['status'] in ('qa_passed', 'approved') and not new_version:
        log(f'{ex_id}: уже {last["status"]} ({last["file"]}). Ничего не генерирую. Новая версия: --new-version')
        return 0
    if entry['attempts'] >= cfg['max_attempts_per_exercise']:
        raise Stop(4, f'{ex_id}: исчерпан лимит попыток ({entry["attempts"]}/{cfg["max_attempts_per_exercise"]}). '
                      f'Нужно решение человека: поправить JSON или промты, затем ev.py reset-attempts {ex_id}.')
    if ex.get('mirror_of'):
        return run_mirror(ex, cfg)

    ctx = Ctx(ex, cfg, provider_name)
    if ctx.prov.paid and not cfg.get('allow_paid'):
        raise Stop(13, f'Провайдер {provider_name} платный, а config.json → allow_paid = false. Бесплатные: hf_spaces, inbox, mock.')
    ctx.prov.check()
    est = estimate(ctx)
    if entry['cost_usd'] + est['per_attempt_usd'] > cfg['budget_usd_per_exercise']:
        raise Stop(3, f'{ex_id}: потрачено ${entry["cost_usd"]:.2f}, попытка стоит до ${est["per_attempt_usd"]:.2f}, '
                      f'бюджет ${cfg["budget_usd_per_exercise"]:.2f}. Нужно решение человека (config.json → budget_usd_per_exercise).')
    attempt = entry['attempts'] + 1
    log(f'{ex_id}: попытка {attempt}/{cfg["max_attempts_per_exercise"]}, провайдер {provider_name}, '
        f'оценка до ${est["per_attempt_usd"]:.2f} ({est["keyframes"]} кадра, {est["clips"]} клипа по {est["clip_s"]} с)')

    ref_img, ref_meta = library_reference(ctx, cfg, ctx.prov, provider_name)

    kf, kf_results = keyframes(ctx, ref_img, ref_meta, attempt)
    if not all(r['passed'] for r in kf_results):
        with manifest.locked() as mm:
            e = manifest.ex_entry(mm, ex_id)
            e['attempts'] += 1
            e['provider'] = provider_name
            e['log'].append({'at': now(), 'event': 'keyframe_failed', 'poses': [r['pose'] for r in kf_results if not r['passed']]})
        paths.REPORTS.mkdir(parents=True, exist_ok=True)
        rp = paths.REPORTS / f'{ex_id}_keyframes.qa.json'
        save_json(rp, kf_results)
        bad = '; '.join(f'{r["pose"]}: ' + ', '.join(f'{c["name"]} {c.get("measured")}≠{c.get("target")}' for c in r['checks'] if not c['passed'])
                        for r in kf_results if not r['passed'])
        raise Stop(10, f'Ключевые кадры не прошли проверку позы (видео не генерировалось, деньги на клипы не потрачены): {bad}\n'
                       f'  Отчет: {paths.rel(rp)}. Следующий запуск перегенерирует только эти кадры.')

    cl, state = clips(ctx, kf, confirm_cost)
    if state == 'gate':
        first = next(iter(cl.values()))
        with manifest.locked() as mm:
            e = manifest.ex_entry(mm, ex_id)
            spent, provider_total = e['cost_usd'], est['clip_usd'] * (est['clips'] - len(cl))
            e['provider'] = provider_name
        raise Stop(3, f'Тестовый клип готов: {first["file"]}\n'
                      f'  Потрачено на упражнение: ${spent:.2f}. Осталось сгенерировать {est["clips"] - len(cl)} клип(а): ~${provider_total:.2f}.\n'
                      f'  Покажи клип и цену человеку. После ОК: ev.py run {ex_id} --confirm-cost')

    with manifest.locked() as mm:
        ver = next_version(manifest.ex_entry(mm, ex_id))
    build = ctx.dir / 'builds' / f'v{ver}'
    if build.exists():
        shutil.rmtree(build)
    build.mkdir(parents=True)
    fitted, fit_info = {}, {}
    for ph in ex['phases']:
        if ph['type'] == 'move':
            f = build / f'fit_{ph["name"]}.mp4'
            fit_info[ph['name']] = post.fit_clip(cl[ph['name']]['file'], f, ph['duration_s'], cfg)
            fitted[ph['name']] = f
    reps, slow, timeline = post.build_body(ex, fitted, build, cfg)
    extra = {'keyframes': kf_results, 'clips': fit_info}
    name, rep, rm = finish_build(ctx, ex, cfg, reps, slow, timeline, build, provider_name, extra)
    if not rep['passed']:
        bad = rep['bad_phases'] or ([p for p in cl] if rep['global_fail'] else [])
        for b in bad:
            if f'clip_{b}' in ctx.state['artifacts']:
                ctx.state['artifacts'][f'clip_{b}']['bad'] = True
        ctx.save()
        log(f'\nНЕ ПРОЙДЕНО: {name}, отчет {paths.rel(rm)}. К перегенерации: {", ".join(bad) or "нет (правь JSON или промты)"}')
        return 1
    log(f'\nqa_passed: {name}\n  видео: {paths.rel(paths.OUT / (name + ".mp4"))}\n  отчет: {paths.rel(rm)}\n'
        f'  Потрачено на этот запуск: ${ctx.spent:.2f}. Дальше человек смотрит ролик и ставит approved или rejected.')
    return 0


def run_mirror(ex, cfg):
    """Правая версия из левой (или наоборот) зеркалированием: без генерации и без затрат, с новой автопроверкой."""
    m = manifest.read()
    src_entry = m['exercises'].get(ex['mirror_of'])
    src = manifest.latest(src_entry) if src_entry else None
    if not src or src['status'] not in ('qa_passed', 'approved'):
        raise Stop(12, f'{ex["id"]}: зеркалю {ex["mirror_of"]}, но у него нет видео со статусом qa_passed или approved')
    sb = paths.STATE / src['build']
    build = paths.WORK / ex['id'] / 'mirror' / f'from_v{src["version"]}'
    if build.exists():
        shutil.rmtree(build)
    build.mkdir(parents=True)
    reps, slow = build / 'body_reps.mp4', build / 'body_slow.mp4'
    post.mirror_video(sb / 'body_reps.mp4', reps)
    post.mirror_video(sb / 'body_slow.mp4', slow)
    name, rep, rm = finish_build(None, ex, cfg, reps, slow, src['timeline'], build, 'mirror', source=f'{ex["mirror_of"]}_v{src["version"]}')
    log(f'{"qa_passed" if rep["passed"] else "НЕ ПРОЙДЕНО"}: {name}, отчет {paths.rel(rm)}')
    return 0 if rep['passed'] else 1
