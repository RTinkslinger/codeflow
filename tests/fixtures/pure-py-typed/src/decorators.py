from typing import Callable, Any
import functools

def retry(times: int) -> Callable[..., Any]:
    def decorator(fn: Callable[..., Any]) -> Callable[..., Any]:
        @functools.wraps(fn)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            for _ in range(times):
                try:
                    return fn(*args, **kwargs)
                except Exception:
                    pass
            return fn(*args, **kwargs)
        return wrapper
    return decorator
