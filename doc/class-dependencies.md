---
title: Class dependencies
---

# Class dependencies

Synchronously instantiated classes with a public constructor can be registered with the `context.setClass()` method or the `injectable` decorator. If the class is instantiated asynchronously or has a private constructor then you have to use a [factory method](./factory-dependencies.md) instead.

If the constructor has no parameters then no options are needed:

```typescript
// With decorator
@injectable
class Service {}

// Without decorator
class Service {}
context.setClass(Service);
```

## Option `inject`

If constructor has parameters then the parameter types must be specified with the `inject` option:

```typescript
// With decorator
@injectable({ inject: [ Service ] })
class Component {
    public constructor(service: Service) {};
}

// Without decorator
class Service {
    public constructor(service: Service) {};
}
context.setClass(Service, { inject: [ Service ] });
```

TypeScript validates that the constructor parameter type matches the type used in the `inject` array. Alternatively you can also inject dependencies [by name](./named-dependencies.md) or as a [qualified type](./qualified-types.md).

## Option `scope`

Classes can be created as singletons or prototype-scoped instances. Default scope is `SINGLETON` which means that only one instance is created and then cached in the context. Scope `PROTOTYPE` means that a new instance is created for every injection.

The scope can be defined like this:

```typescript
import { injectable, Scope } from "@kayahr/cdi";

// With decorator
@injectable({ scope: Scope.PROTOTYPE })
class Component {}

// Without decorator
class Component {}
context.setClass(Component, { scope: Scope.PROTOTYPE });
```

## Option `name`

The class can be qualified with one or more names to allow injecting it as a [named dependency](named-dependencies.md) or as a [qualified type](qualified-types.md):

```typescript
// With decorator
@injectable({ name: "some-name" })
class Component {}

// Without decorator
class Component {}
context.setClass(Component, { name: "some-name" });
```

Instead of specifying a single string the name can also be an array of strings to define multiple names.
