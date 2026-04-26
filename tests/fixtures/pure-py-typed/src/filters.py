from typing import TypeVar, Callable, Iterable

T = TypeVar('T')

def where(items: Iterable[T], predicate: Callable[[T], bool]) -> list[T]:
    return [x for x in items if predicate(x)]
