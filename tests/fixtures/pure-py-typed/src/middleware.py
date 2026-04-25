from typing import Callable
from .logger import log

def request_logger(request: object, response: object, next_fn: Callable[[], None]) -> None:
    log('info', 'request received')
    next_fn()
