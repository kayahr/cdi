---
title: Context
---

# Context

The `Context` class is the heart of the CDI library. This is where dependencies are registered and resolved. Contexts are hierarchical, starting with a fixed root context. If you don't care about child contexts then simply work with the currently active context, which will be the root context if no child contexts are created.

You can get the active context like this:

```typescript
import { Context } from "@kayahr/cdi";

const context = Context.getActive();
```

With `Context.getRoot()` you can also access the root context, no matter what context is currently active.

## Registering dependencies

Dependencies can be registered with the `setClass`, `setFactory`, `setValue` and `setFunction` methods and are registered by type and optionally by one or more names, which can be strings or symbols. Here are a few examples:

```typescript
context.setClass(UserService);
context.setClass(Logger, { name: "console-logger" });
context.setFactory(UserDAO, UserDAO.create, { inject: [ DBService ] });
context.setValue(123, "just-a-number");
context.setFunction(func, [ null, Logger ]);
```

Classes and factory methods can also be registered with the `injectable` decorator. Functions, factory functions and values can not.

For more detailed information see the corresponding documentation:

* [Class dependencies](./class-dependencies.md)
* [Factory dependencies](./factory-dependencies.md)
* [Value dependencies](./value-dependencies.md)
* [Function dependencies](./function-dependencies.md)

Super-types of registered dependencies are also registered, so when registering a class `ConsoleLogger` which extends a `Logger` base class then the class is registered for the types `ConsoleLogger`, `Logger` and `Object`.


## Resolving dependencies

At least once in an application you have to manually resolve a dependency (some root component, for example) to run the application. For this you have to choose between three different methods: `get`, `getSync` and `getAsync`. The  difference between them is how they handle the synchronous and asynchronous dependencies:

* `get` returns either a synchronous value if all involved dependencies are synchronous, or a promise if at least one dependency had to be resolved asynchronously.
* `getAsync` always returns a promise, even if all dependencies are synchronous.
* `getSync` always returns a synchronous value and throws an exception if it encounters an asynchronous dependency.

Examples:

```typescript
const userService = context.getSync(UserService):

const userDAO = await context.getAsync(UserDAO);

let dbService = context.get(DBService);
if (dbService instanceof Promise) {
    dbService = await dbService;
}
```

If you just want to check if a context (or one of its parents) has a matching dependency for a given qualifier then you can use the `has` method:

```typescript
if (context.has(DBService)) {
    // ...
}
```

Dependencies can be removed from a context with `remove`. This only affects the exact context, removal does not bubble up the parent hierarchy. It also only removes the exact qualifier. So when a class was registered by type and by name then removing just the type retains the named dependency and also the qualified type dependency. So if for some reason you must completely remove a named class then you need at least three remove calls (more if class was registered with multiple names):

```typescript
context.set(Component, { name: "foo" });
context.remove(Component);
context.remove("foo");
context.remove(qualify(Component, "foo"));
```

## Child contexts

Child contexts can be created with the `createChildContext` method. This only creates the context, it does not yet become the active context. To activate it, you have to use the `activate` method. This makes the context the current active context so all code which uses `Context.getActive()` (which includes usage of the `injectable` decorator) and is called after activating this new context will use this context.

Example:

```typescript
const rootContext = Context.getRoot();
const context1 = rootContext.createChildContext();
context1.setValue(10000, "timeout");
const context2 = rootContext.createChildContext();
context1.setValue(20000, "timeout");

context1.activate();
console.log(Context.getActive().get("timeout")); // Outputs 10000

context2.activate();
console.log(Context.getActive().get("timeout")); // Outputs 20000
```

Dependencies are first looked up in the context itself and if not found then it is recursively searched in the parent contexts, until the root context is reached:

```typescript
const root = Context.getRoot();
root.set("foo-in-root", "foo");
root.set("bar-in-root", "bar");
const child = root.createChildContext();
child.set("bar-in-child", "bar");

console.log(child.get("bar")); // Outputs 'bar-in-child'
console.log(child.get("foo")); // Outputs 'foo-in-root'
console.log(root.get("bar")); // Outputs 'bar-in-root'
console.log(root.get("foo")); // Outputs 'foo-in-root'
console.log(child.get("nope")); // Error, not found in any context
```
