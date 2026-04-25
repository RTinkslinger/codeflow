from typing import Callable, Any

class Signal:
    def __init__(self) -> None:
        self._receivers: list[Callable[..., Any]] = []

    def connect(self, receiver: Callable[..., Any]) -> None:
        self._receivers.append(receiver)

    def send(self, *args: Any, **kwargs: Any) -> None:
        for r in self._receivers:
            r(*args, **kwargs)
