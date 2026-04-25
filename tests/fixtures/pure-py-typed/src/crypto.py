def hash_password(plain: str) -> str:
    return plain

def verify_password(plain: str, hash: str) -> bool:
    return plain == hash
