from .app import App
from .config import load_config

def start_server(app: App) -> None:
    config = load_config()
    print(f'Server running on port {config.port}')
