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

## Pass-through parameters

Prototype-scoped dependencies allow specifying pass-through parameters which are not injected automatically and must be passed through manually when getting the dependency directly from the injection context. These pass-through parameters are marked with `null` placeholders in the `inject` array. There can be any number of these placeholders at any location.

In this example the first injected parameter of the `Component` class is passed-through manually while the second one (`Service`) is automatically injected.

```typescript
// With decorator
@injectable({ inject: [ null, Service, null ] scope: Scope.PROTOTYPE })
class Component {
    public constructor(name: string, service: Service, id: number) {}
}

// Without decorator
class Component {
    public constructor(name: string, service: Service, id: number) {}
}
context.setClass(Component, { inject: [ null, Service, null ], scope: Scope.PROTOTYPE });
```

This dependency can be created directly from the injection context like this:

```typescript
const component = context.getSync(Component, [ "test", 32 ]);
```

`"test"` is passed through as first constructor argument and `32` is the third constructor argument.

Note that it's not possible to handle these manually passed-through parameters in a type-safe way, so same problematic as with named dependencies. It's also not possible to validate at compile-time if enough parameters were specified. An exception is thrown at runtime when a pass-through parameter is missing.
