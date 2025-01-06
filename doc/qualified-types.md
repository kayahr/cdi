---
title: Qualified types
---

# Qualified types

It is also possible to qualify a concrete type with a name to be able to register multiple implementations of some base class and let consumers choose which one they want.

Example:

```typescript
import { injectable, qualify } from "@kayahr/cdi";

abstract class Logger {
    public abstract log(message: string): void;
}

@injectable({ name: "null-logger" })
class NullLogger extends Logger {
    public log(message: string): void {}
}

@injectable({ name: "console-logger" })
class ConsoleLogger extends Logger {
    public log(message: string): void {
        console.log(message);
    }
}

@injectable({ inject: [ qualify(Logger, "console-logger") ]})
class ComponentA {
    public constructor(logger: Logger) {
        logger.log("Start");
    }
}

@injectable({ inject: [ qualify(Logger, "null-logger") ]})
class ComponentB {
    public constructor(logger: Logger) {
        logger.log("Start");
    }
}
```

In this example two `Logger` singletons are registered under different names but under the same base type. `ComponentA` and `ComponentB` both depend on an instance of `Logger` but because they use a qualified type as dependency `ComponentA` gets the instance of `ConsoleLogger` while `ComponentB` get the instance of `NullLogger`.

The advantage of using qualified types instead of just [named dependencies](./named-dependencies.md) is that TypeScript can check that the actually injected type is the type specified in the constructor signature.
