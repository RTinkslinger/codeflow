from dataclasses import dataclass
from .logger import log

@dataclass
class Config:
    port: int
    db_url: str

def load_config() -> Config:
    log('info', 'loading config')
    return Config(port=3000, db_url='postgres://localhost/app')
