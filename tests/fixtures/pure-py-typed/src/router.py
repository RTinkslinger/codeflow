from typing import Callable

class Router:
    def __init__(self) -> None:
        self._routes: dict[str, Callable[[str], None]] = {}

    def get(self, path: str, handler: Callable[[str], None]) -> None:
        self._routes[path] = handler
