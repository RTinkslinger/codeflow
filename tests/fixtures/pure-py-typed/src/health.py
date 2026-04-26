from .db import Database

def check_health(db: Database) -> dict:
    return {'status': 'ok', 'db': True}
