from .tasks import Task
from typing import Callable, Any

def command(name: str) -> Callable[..., Any]:
    def decorator(fn: Callable[..., Any]) -> Task:
        return Task(fn, name)
    return decorator
