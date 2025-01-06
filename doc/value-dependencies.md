---
title: Value dependencies
---

# Value dependencies

Static values can be registered with `context.setValue()`:

```typescript
context.setValue(new Service());

@injectable({ inject: [ Service ] })
class Component {
    public constructor(service: Service) {}
}
```

Any kind of value can be registered but usually you want to inject it as a [named dependency](named-dependencies.md) when the value has no unique type:

```typescript
context.setValue(12345, "secret-code");

@injectable({ inject: [ "secret-code" ] })
class Luggage {
    public constructor(combination: number) {}
}
```

## Asynchronous values

Asynchronous values can be registered as a promise but can only be injected by name:

```typescript
context.setValue(Promise.resolve({ verbose: true }), "config");

@injectable({ inject: [ "config" ] })
class Component{
    public constructor(config: Config) {
        if (config.verbose) {
            console.log("Component created");
        }
    }
}
```

If you want to inject an asynchronous value by type then you have to register a [factory function](factory-dependencies.md) instead.
