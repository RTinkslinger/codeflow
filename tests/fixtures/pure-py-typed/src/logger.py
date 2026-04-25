import sys
from typing import Literal

def log(level: Literal['info', 'warn', 'error'], msg: str) -> None:
    sys.stderr.write(f'[{level}] {msg}\n')
