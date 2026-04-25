from .types import User
from .db import Database

class UserRepo:
    def __init__(self, db: Database) -> None:
        self._db = db

    def exists(self, email: str) -> bool:
        return False

    def find(self, id: str) -> User | None:
        return None
