# CDI - Context and Dependency Injection

[GitHub] | [NPM] | [API Doc]

Simple generic dependency injection library written in TypeScript (but also works with plain JavaScript).

Some features:

* Allows registering and injecting every kind of data, from simple strings to singleton services.
* Supports injecting functions with a mix of dependency parameters and pass-through parameters.
* Supports asynchronous dependency resolving.
* Supports constructor and factory method/function injection.
* Supports new proposed [ECMAScript decorators] but also works without decorators.
* Supports sub dependency injection contexts.
* Supports singleton and prototype injection scopes.
* Supports dependency qualifiers to allow dependency resolving by name for interfaces or primitive values or for selecting the correct dependency when multiple compatible dependencies exist.
* Very small footprint. Library has no dependencies and size of minimized code is around 3 KB.

There are some features which are intentionally not supported:

* No support for legacy (experimental) TypeScript decorators. Even though these decorators are currently more powerful then the new standard decorators, they have no future so new software should not use them.
* No support for property and setter method dependency injection. This kind of injection is a bad practice because it can create inconsistent object states.


## Usage

Install the library as a dependency in your project:

```sh
npm install @kayahr/cdi
```

When using decorators then a typical simple use case can look like this:

```typescript
import { Context, injectable } from "@kayahr/cdi";

@injectable
export class MathService {
    public add(a: number, b: number): number {
        return a + b;
    }
}

@injectable({ inject: [ MathService ] })
export class Component {
    public constructor(
        private readonly mathService: MathService
    ) {}

    public run(): void {
        console.log(this.mathService.add(1, 2));
    }
}

// Boot strap
const context = Context.getActive();
context.getSync(Component).run();
```

This registers a `MathService` singleton in the active dependency injection context and a `Component` class which depends on it. Then in the boot strap code it fetches the singleton instance of `Component` from the context and runs it.

Note that the types of dependencies must explicitly be specified in the `injectable` decorator (only if there are dependencies). This is because up to now the new ECMAScript decorators have no support for type reflection metadata or parameter decorators. As soon as this changes, the `inject` option will become optional.

You may wonder why `context.getSync()` is used instead of `context.get()`. This is because all dependencies can be asynchronous (more on that later), so `get` may return a Promise and the boot strap code would need to handle this. `getSync` on the other hand always returns a synchronous value and throws an error when an asynchronous dependency has been encountered. So when you know that all involved dependencies are synchronous then `getSync` is easier to use. There is also a `getAsync` method which always returns a promise, if you prefer this.


## Usage without decorators

Instead of using decorators you can also fetch the active dependency injection context and add the classes manually:

```typescript
import { Context } from "@kayahr/cdi";

const context = Context.getActive();

export class MathService {
    public add(a: number, b: number): number {
        return a + b;
    }
}
context.setClass(MathService);

export class Component {
    public constructor(
        private readonly mathService: MathService
    ) {}

    public run(): void {
        console.log(this.mathService.add(1, 2));
    }
}
context.setClass(Component, { inject: [ MathService ] });

// Boot strap
context.getSync(Component).run();
```

The `injectable` decorator internally uses the same methods which you can also use manually, like in this example, so the functionality is identical.

## See also

* [Documentation]
* [ECMAScript decorators]

[API Doc]: https://kayahr.github.io/cdi/
[Documentation]: https://kayahr.github.io/cdi/documents/Documentation.html
[GitHub]: https://github.com/kayahr/cdi
[NPM]: https://www.npmjs.com/package/@kayahr/cdi
[ECMAScript decorators]: https://github.com/tc39/proposal-decorators
