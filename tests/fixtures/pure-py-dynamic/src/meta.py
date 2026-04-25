class AutoRegisterMeta(type):
    registry: dict = {}
    def __new__(mcs, name, bases, namespace):
        cls = super().__new__(mcs, name, bases, namespace)
        if name != 'Base':
            mcs.registry[name] = cls
        return cls

class Base(metaclass=AutoRegisterMeta):
    pass

class ServiceA(Base):
    def process(self): pass

class ServiceB(Base):
    def process(self): pass
