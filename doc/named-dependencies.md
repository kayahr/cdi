---
title: Named Dependencies
---

# Named Dependencies

In addition to injecting dependencies by type you can also inject them via a dependency name, which can be a string or a symbol. Injecting dependencies via name is not type-safe but necessary if you want to inject an interface for example, because interfaces are no real runtime types.


```typescript
interface Adder {
    add(a: number, b: number): number;
}

@injectable({ name: "adder" })
class MathService implements Adder {
    public add(a: number, b: number): number {
        return a + b:
    }
}

@injectable({ inject: [ "adder" ] });
class Component {
    public constructor(adder: Adder) {}
}
```
