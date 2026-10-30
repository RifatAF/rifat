#!/usr/bin/env python3
"""exercise-video: обучающие ИИ-видео упражнений для BodyPassport.

  ev.py setup                         окружение: .venv, зависимости, модель позы
  ev.py validate [id ...]             проверить exercises/*.json
  ev.py run <id> [--confirm-cost]     сгенерировать, собрать, проверить (одна команда)
  ev.py import <id> <видео>           свое видео для режима footage (фон заменится)
  ev.py status [id]                   статусы из manifest.json
  ev.py approve <id> --version N --by ИМЯ    только человек
  ev.py reject  <id> --version N --by ИМЯ --reason ...
  ev.py reset-attempts <id> --by ИМЯ  снять лимит попыток (решение человека)
  ev.py reference --reset             пересоздать эталон библиотеки (все видео переснимать)
  ev.py publish [--dry-run]           approved → video/ и data/exercises.json
  ev.py selftest                      прогон на тестовом упражнении через mock, во временной папке

Коды выхода: 0 готово, 1 автопроверка не пройдена, 2 ошибка данных, 3 нужен ОК на цену/тестовый клип,
4 лимит попыток, 5 нет инструментов, 6 нет ключа, 7 ошибка провайдера, 8 ошибка ffmpeg, 9 ждем файл в inbox,
10 ключевой кадр не прошел, 11 эталон изменен, 12 нет источника для зеркала, 13 платный провайдер запрещен,
14 квота бесплатного сервиса исчерпана, 15 нужен человек.
"""
import argparse
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
SKILL = HERE.parent
VENV_PY = SKILL / '.venv' / 'bin' / 'python'


def _reexec_into_venv():
    """Без установленных зависимостей перезапускаемся в .venv скилла, если она есть."""
    if os.environ.get('EV_NO_REEXEC') or Path(sys.executable).resolve() == VENV_PY.resolve():
        return
    try:
        import cv2, numpy, mediapipe  # noqa: F401,E401
    except Exception:
        if VENV_PY.exists():
            os.execv(str(VENV_PY), [str(VENV_PY), *sys.argv])


if len(sys.argv) > 1 and sys.argv[1] != 'setup':
    _reexec_into_venv()
sys.path.insert(0, str(HERE))


def cmd_setup(a):
    if not VENV_PY.exists():
        subprocess.check_call([sys.executable, '-m', 'venv', str(SKILL / '.venv')])
    subprocess.check_call([str(VENV_PY), '-m', 'pip', 'install', '-q', '-r', str(SKILL / 'requirements.txt')])
    r = subprocess.run([str(VENV_PY), '-c', 'from evlib import pose, post; pose.ensure_model(); post.check_tools(); '
                        'import mediapipe; print("mediapipe", mediapipe.__version__)'], cwd=HERE, capture_output=True, text=True)
    print(r.stdout.strip() or r.stderr.strip()[-800:])
    if r.returncode:
        print('Если ошибка про libEGL: sudo apt-get install -y libegl1 libgles2')
        return 5
    print('Готово. Запуск: python3 .claude/skills/exercise-video/scripts/ev.py run <id>')
    return 0


def cmd_validate(a):
    from evlib import exercise, paths
    ids = a.ids or sorted(p.stem for p in paths.EXERCISES.glob('*.json') if not p.name.startswith('_'))
    bad = 0
    for i in ids:
        ex, errors, warns = exercise.validate(i)
        print(f'{"✅" if not errors else "❌"} {i}')
        for e in errors:
            print(f'   ошибка: {e}')
        for w in warns:
            print(f'   внимание: {w}')
        bad += bool(errors)
    return 2 if bad else 0


def cmd_run(a):
    from evlib import pipeline
    return pipeline.run(a.id, a.provider, a.confirm_cost, a.new_version)


def cmd_import(a):
    from evlib import footage, paths
    dst = footage.import_source(a.id, a.file)
    print(f'Исходник сохранен: {paths.rel(dst)}\nВ exercises/{a.id}.json → footage.file укажи: {paths.rel(dst)}')
    return 0


def cmd_status(a):
    from evlib import manifest
    m = manifest.read()
    items = {a.id: m['exercises'].get(a.id)} if a.id else m['exercises']
    if not items or not any(items.values()):
        print('manifest пуст')
        return 0
    for ex_id, e in items.items():
        if not e:
            print(f'{ex_id}: нет записей')
            continue
        print(f'{ex_id}: попыток {e["attempts"]}, потрачено ${e["cost_usd"]:.2f}, провайдер {e.get("provider")}')
        for name, v in sorted(e['videos'].items(), key=lambda kv: kv[1]['version']):
            qa = v.get('qa', {})
            print(f'   {name}: {v["status"]:<9} QA {"ok" if qa.get("passed") else "fail" if qa else "—"} '
                  f'{v.get("size_mb", "")} МБ  {v.get("file") or ""}  {qa.get("report", "")}')
    return 0


def _human_gate(a, action):
    """approved/rejected ставит только человек: нужен терминал или дословная фраза человека из чата (--human-said)."""
    from evlib.util import Stop
    if sys.stdin.isatty():
        ans = input(f'{action} {a.id}_v{a.version}? Введи id видео для подтверждения: ').strip()
        if ans != f'{a.id}_v{a.version}':
            raise Stop(15, 'Не подтверждено')
        return 'terminal'
    if not a.human_said:
        raise Stop(15, f'{action} ставит только человек. Запусти в своем терминале или передай его дословные слова: --human-said "..."')
    return f'chat: {a.human_said}'


def _set(a, status):
    from evlib import manifest
    from evlib.util import Stop
    how = _human_gate(a, 'Одобрить' if status == 'approved' else 'Отклонить')
    with manifest.locked() as m:
        e = m['exercises'].get(a.id)
        name = f'{a.id}_v{a.version}'
        v = e and e['videos'].get(name)
        if not v:
            raise Stop(2, f'Нет видео {name}')
        if status == 'approved' and v['status'] != 'qa_passed':
            raise Stop(15, f'{name}: статус {v["status"]}. Одобрить можно только после автопроверки (qa_passed).')
        manifest.set_status(v, status, a.by, f'{a.reason or ""} [{how}]'.strip())
    print(f'{name}: {status}')
    return 0


def cmd_approve(a):
    return _set(a, 'approved')


def cmd_reject(a):
    if not a.reason:
        print('Укажи --reason: что не так (это пойдет в следующую попытку)')
        return 2
    return _set(a, 'rejected')


def cmd_reset_attempts(a):
    from evlib import manifest
    from evlib.util import now
    a.version = 'attempts'
    _human_gate(a, 'Снять лимит попыток для')
    with manifest.locked() as m:
        e = manifest.ex_entry(m, a.id)
        e['log'].append({'at': now(), 'event': 'attempts_reset', 'by': a.by, 'was': e['attempts']})
        e['attempts'] = 0
    print(f'{a.id}: попытки обнулены')
    return 0


def cmd_reference(a):
    from evlib import paths, util
    if not a.reset:
        for d in sorted(paths.LIBRARY.glob('*/reference.json')):
            meta = util.load_json(d)
            print(f'{d.parent.name}: {paths.rel(d.parent / "reference.png")} от {meta["created"]}, sha256 {meta["sha256"][:12]}')
        return 0
    cfg = util.load_json(paths.CONFIG)
    d = paths.LIBRARY / (a.provider or cfg['provider'])
    if d.exists():
        backup = d.with_name(d.name + '_old_' + util.now().replace(':', ''))
        d.rename(backup)
        print(f'Старый эталон сохранен в {paths.rel(backup)}. Новый создастся при следующем run.')
    return 0


def cmd_publish(a):
    from evlib import manifest, exercise, paths, util
    from evlib.util import Stop
    if not paths.PUBLISH_DIR:
        raise Stop(2, 'Скилл лежит не в .claude/skills репозитория: некуда публиковать')
    m = manifest.read()
    app = util.load_json(paths.APP_EXERCISES)
    by_id = {e['id']: e for e in app['exercises']}
    cards = util.load_json(paths.TEMPLATES / 'cards.json')
    changes = []
    for ex_id, e in m['exercises'].items():
        try:
            ex = exercise.load(ex_id)
        except Stop:
            continue
        if ex.get('test_only') or not ex.get('app_id'):
            continue
        target = by_id.get(ex['app_id'])
        if not target:
            print(f'⚠ {ex_id}: app_id {ex["app_id"]} нет в data/exercises.json')
            continue
        approved = [v for v in e['videos'].values() if v['status'] == 'approved']
        media = target.setdefault('media', {})
        if not approved:
            if media.get('video', '').startswith('video/') and not any(v['status'] == 'approved' for v in e['videos'].values()):
                changes.append(('снять', ex_id, media.get('video')))
                if not a.dry_run:
                    for k in ('video', 'poster', 'aiGenerated', 'aiLabel'):
                        media.pop(k, None)
            continue
        v = max(approved, key=lambda x: x['version'])
        src = paths.STATE / v['file']
        if util.sha256_file(src) != v['sha256']:
            raise Stop(15, f'{src}: файл изменился после одобрения. Публикация остановлена.')
        name = Path(v['file']).name
        dst_v, dst_p = paths.PUBLISH_DIR / name, paths.PUBLISH_DIR / Path(v['preview']).name
        changes.append(('опубликовать', ex_id, f'video/{name}'))
        if a.dry_run:
            continue
        paths.PUBLISH_DIR.mkdir(exist_ok=True)
        shutil.copyfile(src, dst_v)
        shutil.copyfile(paths.STATE / v['preview'], dst_p)
        for old in paths.PUBLISH_DIR.glob(f'{ex_id}_v*'):
            if old.name not in (dst_v.name, dst_p.name):
                old.unlink()
        media.update({'video': f'video/{dst_v.name}', 'poster': f'video/{dst_p.name}', 'aiGenerated': True, 'aiLabel': cards['ai_label']})
    if not a.dry_run and changes:
        util.save_json(paths.APP_EXERCISES, app)
    for c in changes:
        print(f'{c[0]}: {c[1]} → {c[2]}')
    print('Нечего публиковать: нет approved' if not changes else ('(dry-run, ничего не изменено)' if a.dry_run else 'Готово'))
    return 0


def cmd_selftest(a):
    """Сквозной прогон без денег и без боевого manifest: дефектный клип должен провалить QA, чистый пройти."""
    tmp = Path(tempfile.mkdtemp(prefix='ev_selftest_'))
    env = dict(os.environ, EV_STATE_DIR=str(tmp), EV_NO_REEXEC='1')
    me = [sys.executable, str(Path(__file__).resolve())]

    def run(*args, defect=''):
        e = dict(env, EV_MOCK_DEFECT=defect)
        r = subprocess.run([*me, *args], env=e, capture_output=True, text=True)
        return r.returncode, r.stdout + r.stderr

    steps = []
    code, out = run('validate', 'test_squat')
    steps.append(('валидация тестового упражнения', code == 0, out))
    code, out = run('run', 'test_squat', '--provider', 'mock')
    steps.append(('ценовой шлюз: стоп после тестового клипа (код 3)', code == 3, out))
    code, out = run('run', 'test_squat', '--provider', 'mock', '--confirm-cost', defect='loop')
    steps.append(('дефект «зацикленное движение» ловится (код 1)', code == 1, out))
    code, out = run('run', 'test_squat', '--provider', 'mock', '--confirm-cost')
    steps.append(('перегенерация плохих клипов и qa_passed (код 0)', code == 0, out))
    code, out = run('run', 'test_squat', '--provider', 'mock')
    steps.append(('идемпотентность: qa_passed не перегенерируется', code == 0 and 'Ничего не генерирую' in out, out))
    code, out = run('approve', 'test_squat', '--version', '2', '--by', 'selftest')
    steps.append(('approve без человека запрещен (код 15)', code == 15, out))
    code, out = run('run', 'test_squat', '--provider', 'fal', '--new-version')
    steps.append(('платный провайдер запрещен (код 13)', code == 13, out))
    ok = all(s[1] for s in steps)
    for name, passed, out in steps:
        print(f'{"✅" if passed else "❌"} {name}')
        if not passed or a.verbose:
            print('   ' + out.strip().replace('\n', '\n   ')[-3000:])
    print(f'\nПапка прогона: {tmp}' + ('' if a.keep or not ok else ''))
    if ok and not a.keep:
        shutil.rmtree(tmp, ignore_errors=True)
    return 0 if ok else 1


def main():
    p = argparse.ArgumentParser(prog='ev.py', description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = p.add_subparsers(dest='cmd', required=True)
    sp.add_parser('setup').set_defaults(f=cmd_setup)
    s = sp.add_parser('validate'); s.add_argument('ids', nargs='*'); s.set_defaults(f=cmd_validate)
    s = sp.add_parser('run'); s.add_argument('id'); s.add_argument('--provider'); s.add_argument('--confirm-cost', action='store_true')
    s.add_argument('--new-version', action='store_true'); s.set_defaults(f=cmd_run)
    s = sp.add_parser('import'); s.add_argument('id'); s.add_argument('file'); s.set_defaults(f=cmd_import)
    s = sp.add_parser('status'); s.add_argument('id', nargs='?'); s.set_defaults(f=cmd_status)
    for name, f in (('approve', cmd_approve), ('reject', cmd_reject)):
        s = sp.add_parser(name); s.add_argument('id'); s.add_argument('--version', type=int, required=True)
        s.add_argument('--by', required=True); s.add_argument('--reason'); s.add_argument('--human-said'); s.set_defaults(f=f)
    s = sp.add_parser('reset-attempts'); s.add_argument('id'); s.add_argument('--by', required=True); s.add_argument('--human-said')
    s.add_argument('--reason'); s.set_defaults(f=cmd_reset_attempts)
    s = sp.add_parser('reference'); s.add_argument('--reset', action='store_true'); s.add_argument('--provider'); s.set_defaults(f=cmd_reference)
    s = sp.add_parser('publish'); s.add_argument('--dry-run', action='store_true'); s.set_defaults(f=cmd_publish)
    s = sp.add_parser('selftest'); s.add_argument('--keep', action='store_true'); s.add_argument('-v', '--verbose', action='store_true')
    s.set_defaults(f=cmd_selftest)
    a = p.parse_args()
    from evlib.util import Stop
    try:
        sys.exit(a.f(a) or 0)
    except Stop as e:
        print(f'СТОП: {e}', file=sys.stderr)
        sys.exit(e.code)


if __name__ == '__main__':
    main()
