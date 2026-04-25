from .types import User

class Mailer:
    def send(self, to: User, subject: str, body: str) -> None:
        pass
