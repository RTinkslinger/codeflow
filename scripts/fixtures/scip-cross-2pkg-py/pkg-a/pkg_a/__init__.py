def named_greeting() -> str:
    return "hello from pkg-a"

class Greeter:
    def greet(self) -> str:
        return named_greeting()
