from pkg_a import named_greeting, Greeter

def main() -> str:
    g = Greeter()
    return g.greet() + " / " + named_greeting()
