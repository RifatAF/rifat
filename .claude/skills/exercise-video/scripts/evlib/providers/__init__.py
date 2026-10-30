"""Реестр провайдеров. Новый провайдер: файл <name>.py с классом Provider(Base) и строка в REGISTRY."""
import importlib

REGISTRY = {'mock': 'mock', 'hf_spaces': 'hf_spaces', 'inbox': 'inbox', 'fal': 'fal'}


def get(name, cfg):
    if name not in REGISTRY:
        raise ValueError(f'неизвестный провайдер {name}; есть: {", ".join(REGISTRY)}')
    mod = importlib.import_module(f'{__name__}.{REGISTRY[name]}')
    return mod.Provider(cfg.get('providers', {}).get(name, {}), cfg)
