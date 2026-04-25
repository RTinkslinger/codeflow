from typing import Callable
from .queue import Queue

class Scheduler:
    def __init__(self) -> None:
        self._queue: Queue[Callable[[], None]] = Queue()

    def schedule(self, task: Callable[[], None]) -> None:
        self._queue.push(task)

    def run(self) -> None:
        while (task := self._queue.pop()) is not None:
            task()
