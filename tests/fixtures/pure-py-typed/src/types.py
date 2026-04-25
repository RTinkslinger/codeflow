from dataclasses import dataclass
from typing import Literal

@dataclass
class User:
    id: str
    email: str
    role: Literal['admin', 'user']

@dataclass
class Session:
    token: str
    user_id: str
