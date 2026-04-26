from .config import Config

class Database:
    def __init__(self, config: Config) -> None:
        self._config = config

    def query(self, sql: str) -> list:
        return []
