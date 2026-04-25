from .user import UserRepo
from .session import SessionStore
from .crypto import verify_password
from .errors import AuthError

class AuthService:
    def __init__(self, users: UserRepo, sessions: SessionStore) -> None:
        self._users = users
        self._sessions = sessions

    def login(self, email: str, password: str) -> str:
        user = self._users.find(email)
        if user is None:
            raise AuthError('User not found')
        return self._sessions.create(user.id).token
