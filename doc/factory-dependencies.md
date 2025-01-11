---
title: Factory dependencies
---

# Factory dependencies

Factory functions can be registered with the `context.setFactory()` method:

```typescript
class Foo {}
function createFoo(): Foo {
    return new Foo();
}
context.setFactory(Foo, createFoo);
```

Factory methods can be registered the same way and also with the `injectable` decorator. Classes instantiated with a factory method can even have a private constructor:

```typescript
// With decorator
class Service {
    private constructor() {}
    @injectable
    public static create(): Service {
        return new Service();
    }
}

// Without decorator
class Service {
    private constructor() {}
    public static create(): Service {
        return new Service();
    }
}
context.setFactory(Service, Service.create);
```


## Option `inject`

If factory method or function has parameters then the parameter types must be specified with the `inject` option:

```typescript
// With decorator
class Component {
    private constructor(service: Service) {}
    @injectable({ inject: [ Service ] })
    public static create(service: Service): Component {
        return new Component(service);
    }
}

// Without decorator
class Component {
    private constructor(service: Service) {}
    public static create(service: Service): Component {
        return new Component(service);
    }
}
context.setFactory(Service, { inject: [ Service ] });
```

TypeScript validates that the constructor parameter type matches the type used in the `inject` array. Alternatively to concrete types you can also inject dependencies [by name](./named-dependencies.md) or as a [qualified type](./qualified-types.md).


## Option `name`

The factory can be qualified with one or more names to allow injecting its created value as a [named dependency](named-dependencies.md) or as a [qualified type](qualified-types.md):

```typescript
// With decorator
class Component {
    @injectable({ name: "some-name" })
    public static create(): Component {
        return new Component();
    }
}

// Without decorator
class Component {}
function createComponent(): Component {
    return new Component();
}
context.setFactory(Component, createComponent, { name: "some-name" });
```

Instead of specifying a single string the name can also be an array of strings to define multiple names.


## Option `scope`

Factories can create singletons or prototype-scoped instances. Default scope is `SINGLETON` which means that only one instance is created and then cached in the context. Scope `PROTOTYPE` means that a new instance is created for every injection.

The scope can be defined like this:

```typescript
import { injectable, Scope } from "@kayahr/cdi";

// With decorator
class Component {
    @injectable({ scope: Scope.PROTOTYPE })
    public static create(): Component {
        return new Component();
    }
}

// Without decorator
class Component {
    public static create(): Component {
        return new Component();
    }
}
context.setFactory(Component, Component.create, { scope: Scope.PROTOTYPE });
```


## Asynchronous dependencies

Factory functions and methods can also return a promise to create an asynchronous dependency:

```typescript
class UserDAO {
    private constructor(private db: Database) {}

    @injectable({ inject: [ DBService ] })
    public static async create(dbService: DBService): Promise<UserDAO> {
        return new UserDAO(await dbService.connect());
    }
}
```

If a dependency depends on an asynchronous dependency then it automatically also becomes asynchronous:

```typescript
@injectable({ inject: [ UserDAO ] })
class Component {
    public constructor(userDao: UserDAO) {}
}
```

`context.get(Component)` would now return a Promise on first call because the instance creation must wait until UserDAO has been created. On subsequent calls it may return the component synchronously when construction has already finished and Component and UserDAO are both singletons.

## Pass-through parameters

Prototype-scoped dependencies allow specifying pass-through parameters which are not injected automatically and must be passed through manually when getting the dependency directly from the injection context. These pass-through parameters are marked with `null` placeholders in the `inject` array. There can be any number of these placeholders at any location.

In this example the first injected parameter of the `Component` class is passed-through manually while the second one (`Service`) is automatically injected.

```typescript
// With decorator
class Component {
    @injectable({ inject: [ null, Service, null ] scope: Scope.PROTOTYPE })
    public static create(name: string, service: Service, id: number) {
        return new Component();
    }
}

// Without decorator
class Component {
    public static create(name: string, service: Service, id: number) {
        return new Component();
    }
}
context.setFactory(Component, Component.create, { inject: [ null, Service, null ], scope: Scope.PROTOTYPE });
```

This dependency can be created directly from the injection context like this:

```typescript
const component = context.getSync(Component, [ "test", 32 ]);
```

`"test"` is passed through as first constructor argument and `32` is the third constructor argument.

Note that it's not possible to handle these manually passed-through parameters in a type-safe way, so same problematic as with named dependencies. It's also not possible to validate at compile-time if enough parameters were specified. An exception is thrown at runtime when a pass-through parameter is missing.
