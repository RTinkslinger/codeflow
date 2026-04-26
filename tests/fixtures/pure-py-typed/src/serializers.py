from typing import Any
import json

def serialize(obj: Any) -> str:
    return json.dumps(obj)

def deserialize(s: str) -> Any:
    return json.loads(s)
