from .auth import AuthService
from .router import Router
from .events import EventBus

class App:
    def __init__(self, auth: AuthService, router: Router, events: EventBus) -> None:
        self._auth = auth
        self._router = router
        self._events = events
