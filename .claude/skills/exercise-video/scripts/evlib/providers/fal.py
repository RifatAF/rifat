"""fal.ai через REST-очередь: queue.fal.run/{model}, заголовок Authorization: Key $FAL_KEY.
Модели и цены в config.json → providers.fal. Картинки уходят как data URI."""
import base64
import json
import mimetypes
import time
import urllib.error
import urllib.request

from .base import Base
from ..util import Stop, log

QUEUE = 'https://queue.fal.run/'


class Provider(Base):
    name = 'fal'
    supports_seed = False  # Kling 2.6 seed не принимает; картинки (nano-banana) принимают
    supports_end_frame = True

    def check(self):
        self.api_key()

    def _req(self, method, url, body=None):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(url, data=data, method=method, headers={
            'Authorization': f'Key {self.api_key()}', 'Content-Type': 'application/json'})
        for attempt in range(4):
            try:
                with urllib.request.urlopen(req, timeout=120) as r:
                    return json.loads(r.read() or b'{}')
            except urllib.error.HTTPError as e:
                msg = e.read().decode(errors='replace')[:500]
                if e.code in (429, 502, 503, 504) and attempt < 3:
                    time.sleep(2 ** (attempt + 1))
                    continue
                raise Stop(7, f'fal {method} {url}: HTTP {e.code} {msg}')
            except urllib.error.URLError as e:
                if attempt < 3:
                    time.sleep(2 ** (attempt + 1))
                    continue
                raise Stop(7, f'fal {url}: сеть недоступна ({e.reason})')

    def _run(self, model, body, timeout_s=900):
        sub = self._req('POST', QUEUE + model, body)
        status_url, response_url = sub['status_url'], sub['response_url']
        t0 = time.time()
        while True:
            st = self._req('GET', status_url)
            s = st.get('status')
            if s == 'COMPLETED':
                if st.get('error'):
                    raise Stop(7, f'fal {model}: {st.get("error_type")} {st["error"]}')
                return self._req('GET', response_url)
            if time.time() - t0 > timeout_s:
                raise Stop(7, f'fal {model}: нет результата за {timeout_s} с (request_id {sub.get("request_id")})')
            time.sleep(5)

    @staticmethod
    def _data_uri(path):
        mime = mimetypes.guess_type(str(path))[0] or 'image/png'
        return f'data:{mime};base64,' + base64.b64encode(open(path, 'rb').read()).decode()

    @staticmethod
    def _download(url, out_path):
        with urllib.request.urlopen(url, timeout=300) as r, open(out_path, 'wb') as f:
            f.write(r.read())

    def generate_image(self, prompt, seed, out_path, pose_hint=None, view=None):
        res = self._run(self.pcfg['image_model'], {'prompt': prompt, 'seed': seed, 'num_images': 1,
                                                   'aspect_ratio': '9:16', 'output_format': 'png'})
        self._download(res['images'][0]['url'], out_path)
        return {'model': self.pcfg['image_model'], 'seed': seed}

    def edit_image(self, ref_path, prompt, seed, out_path, pose_hint=None, view=None):
        res = self._run(self.pcfg['edit_model'], {'prompt': prompt, 'image_urls': [self._data_uri(ref_path)], 'seed': seed,
                                                  'num_images': 1, 'aspect_ratio': '9:16', 'output_format': 'png'})
        self._download(res['images'][0]['url'], out_path)
        return {'model': self.pcfg['edit_model'], 'seed': seed}

    def image_to_video(self, start_path, end_path, prompt, negative, seed, duration_s, out_path,
                       pose_from=None, pose_to=None, view=None):
        body = {'prompt': prompt, 'start_image_url': self._data_uri(start_path), 'duration': str(int(duration_s)),
                'negative_prompt': negative, 'generate_audio': False}
        if end_path:
            body['end_image_url'] = self._data_uri(end_path)
        log(f'  fal: {self.pcfg["video_model"]}, {duration_s} с, ждем результат (обычно 1–5 мин)')
        res = self._run(self.pcfg['video_model'], body)
        self._download(res['video']['url'], out_path)
        return {'model': self.pcfg['video_model'], 'seed': None}
