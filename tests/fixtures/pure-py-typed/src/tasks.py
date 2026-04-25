from typing import Callable, Any

class Task:
    def __init__(self, fn: Callable[..., Any], name: str) -> None:
        self.fn = fn
        self.name = name

    def run(self, *args: Any) -> Any:
        return self.fn(*args)
