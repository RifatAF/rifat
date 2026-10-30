"""Интерфейс провайдера. Ключи API только из переменных окружения, никогда из файлов скилла."""
import os

from ..util import Stop


class Base:
    name = 'base'
    supports_seed = False      # фиксированный seed для видео
    supports_end_frame = False  # клип между двумя ключевыми кадрами

    def __init__(self, pcfg, cfg):
        self.pcfg, self.cfg = pcfg, cfg
        self.prices = pcfg.get('prices_usd', {})

    def api_key(self):
        env = self.pcfg.get('api_key_env')
        key = os.environ.get(env or '')
        if not key:
            raise Stop(6, f'Нет ключа провайдера {self.name}: задай переменную окружения {env}. В файлы ключ не записывать.')
        return key

    @property
    def paid(self):
        return any(float(v) > 0 for v in self.prices.values())

    def check(self):
        """Готов ли провайдер (ключ есть). Бросает Stop."""

    def price(self, kind, seconds=0):
        if kind == 'video':
            return float(self.prices.get('video_per_second', 0)) * seconds
        return float(self.prices.get(kind, 0))

    # pose_hint: целевые углы позы. Реальные модели его игнорируют, mock рисует по нему манекен.
    def generate_image(self, prompt, seed, out_path, pose_hint=None, view=None):
        raise NotImplementedError

    def edit_image(self, ref_path, prompt, seed, out_path, pose_hint=None, view=None):
        raise NotImplementedError

    def image_to_video(self, start_path, end_path, prompt, negative, seed, duration_s, out_path,
                       pose_from=None, pose_to=None, view=None):
        raise NotImplementedError
