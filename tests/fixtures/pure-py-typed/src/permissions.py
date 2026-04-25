from .types import User

def can_admin(user: User) -> bool:
    return user.role == 'admin'
