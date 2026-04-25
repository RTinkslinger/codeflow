import random
import string
from .types import Session
from .cache import Cache
from .constants import SESSION_TTL_S

class SessionStore:
    def __init__(self, cache: Cache) -> None:
        self._cache = cache

    def create(self, user_id: str) -> Session:
        token = ''.join(random.choices(string.ascii_lowercase, k=32))
        return Session(token=token, user_id=user_id)
