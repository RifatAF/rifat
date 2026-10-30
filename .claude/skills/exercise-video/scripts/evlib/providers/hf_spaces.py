"""Бесплатный провайдер: публичные Spaces на Hugging Face через gradio_client (ZeroGPU).
Ограничения: дневная квота GPU (без токена меньше, с бесплатным HF_TOKEN больше), очередь, Space может уснуть или
поменять API. Spaces и параметры задаются в config.json → providers.hf_spaces, поэтому замена Space не требует кода."""
import os
import re
import shutil
import tempfile

from .base import Base
from ..util import Stop, log

QUOTA = re.compile(r'(quota|exceeded|ZeroGPU|GPU duration|rate limit|too many requests)', re.IGNORECASE)


class Provider(Base):
    name = 'hf_spaces'
    supports_seed = True
    supports_end_frame = True

    def __init__(self, pcfg, cfg):
        super().__init__(pcfg, cfg)
        self._clients = {}

    def check(self):
        try:
            import gradio_client  # noqa: F401
        except ImportError:
            raise Stop(5, 'Нет gradio_client. Выполни: python3 scripts/ev.py setup')
        if not os.environ.get(self.pcfg.get('api_key_env', 'HF_TOKEN')):
            log('  HF_TOKEN не задан: работаю анонимно, дневная квота ZeroGPU меньше. Бесплатный токен: huggingface.co/settings/tokens')

    def _client(self, space):
        if space not in self._clients:
            from gradio_client import Client
            try:
                self._clients[space] = Client(space, token=os.environ.get(self.pcfg.get('api_key_env', 'HF_TOKEN')) or None,
                                              verbose=False, download_files=tempfile.mkdtemp(prefix='ev_hf_'))
            except Exception as e:
                raise Stop(7, f'Space {space} недоступен ({str(e)[:300]}). Замени Space в config.json → providers.hf_spaces.')
        return self._clients[space]

    def _call(self, task, inputs, out_path):
        """task: секция config (image|edit|video). inputs: логические имена → значения; map в config переводит их в параметры Space."""
        from gradio_client import handle_file
        t = self.pcfg[task]
        kwargs = dict(t.get('fixed', {}))
        for logical, param in t['map'].items():
            if logical in inputs and inputs[logical] is not None:
                val = inputs[logical]
                kwargs[param] = handle_file(str(val)) if logical in ('image', 'start_image', 'end_image') else val
        try:
            res = self._client(t['space']).predict(api_name=t['api_name'], **kwargs)
        except Exception as e:
            msg = str(e)
            if QUOTA.search(msg):
                raise Stop(14, f'Квота бесплатного Space исчерпана ({t["space"]}): {msg[:300]}\n'
                               f'  Подожди сброса квоты (обычно сутки) или задай бесплатный HF_TOKEN. Деньги не тратятся.')
            raise Stop(7, f'Space {t["space"]} ответил ошибкой: {msg[:500]}')
        first = res[0] if isinstance(res, (list, tuple)) else res
        if isinstance(first, dict):
            first = first.get('video') or first.get('path') or first.get('url')
        if not first or not os.path.exists(str(first)):
            raise Stop(7, f'Space {t["space"]} не вернул файл: {str(res)[:300]}')
        shutil.copyfile(first, out_path)
        seed = res[1] if isinstance(res, (list, tuple)) and len(res) > 1 else inputs.get('seed')
        return {'model': f'{t["space"]}{t["api_name"]}', 'seed': seed}

    def generate_image(self, prompt, seed, out_path, pose_hint=None, view=None):
        return self._call('image', {'prompt': prompt, 'seed': seed}, out_path)

    def edit_image(self, ref_path, prompt, seed, out_path, pose_hint=None, view=None):
        return self._call('edit', {'image': ref_path, 'prompt': prompt, 'seed': seed}, out_path)

    def image_to_video(self, start_path, end_path, prompt, negative, seed, duration_s, out_path,
                       pose_from=None, pose_to=None, view=None):
        log(f'  Space {self.pcfg["video"]["space"]}: очередь и генерация обычно 1–4 мин')
        return self._call('video', {'start_image': start_path, 'end_image': end_path, 'prompt': prompt,
                                    'negative': negative, 'seed': seed, 'duration': duration_s}, out_path)
