"""Провайдер через входящую папку: конвейер пишет заявку (промт, стартовый и конечный кадры), а файл кладет
Claude, сгенерировав его коннектором (ElevenLabs, Adobe Firefly и т.п.), или человек вручную. Нет файла: остановка с кодом 9."""
import shutil
from pathlib import Path

from .base import Base
from ..util import Stop, save_json


class Provider(Base):
    name = 'inbox'
    supports_seed = False
    supports_end_frame = True

    def _take(self, out_path, request):
        out_path = Path(out_path)
        inbox = out_path.parent / 'inbox'
        inbox.mkdir(parents=True, exist_ok=True)
        want = inbox / out_path.name
        req = inbox / (out_path.stem + '.request.json')
        if want.exists() and want.stat().st_size > 0:
            shutil.copyfile(want, out_path)
            return {'model': request.get('model_used') or 'inbox', 'seed': None, 'source': str(want)}
        save_json(req, request)
        raise Stop(9, f'Ждем файл от коннектора: {want}\n  заявка: {req}\n'
                      f'  Сгенерируй по заявке, сохрани файл ровно по этому пути и запусти команду снова.')

    def generate_image(self, prompt, seed, out_path, pose_hint=None, view=None):
        return self._take(out_path, {'kind': 'image', 'prompt': prompt, 'aspect_ratio': '9:16', 'seed': seed})

    def edit_image(self, ref_path, prompt, seed, out_path, pose_hint=None, view=None):
        return self._take(out_path, {'kind': 'edit', 'prompt': prompt, 'reference_image': str(ref_path), 'aspect_ratio': '9:16'})

    def image_to_video(self, start_path, end_path, prompt, negative, seed, duration_s, out_path,
                       pose_from=None, pose_to=None, view=None):
        return self._take(out_path, {'kind': 'image_to_video', 'prompt': prompt, 'negative_prompt': negative,
                                     'start_image': str(start_path), 'end_image': str(end_path) if end_path else None,
                                     'duration_s': duration_s, 'aspect_ratio': '9:16', 'audio': False})
