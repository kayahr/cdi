---
title: Function dependencies
---

# Function dependencies

Functions can be registered with the `context.setFunction()` method. This is not the same as registering a [factory function](factory-dependencies.md). A factory function creates some value and this value can be injected as a dependency. A function dependency instead stays a function but its arguments are automatically replaced with resolved dependencies.

Example:

```typescript
function closeDatabase(database: Database): void {
    database.close();
}
context.setFunction(closeDatabase, [ Database ]);

const closeFunc = context.getSync(closeDatabase);

// No parameter is needed because database is automatically injected
closeFunc();
```

In this example a function which takes a database instance as parameter is added to an injection context. When resolving this function dependency then a function is returned which automatically injects the database instance as function parameter so the returned function can be called without any parameters.


## Pass-through parameters

It is also possible to specify `null` anywhere in the parameter type list to indicate a pass-through parameter or multiple pass-through parameters. These function parameters are retained so they must be specified when calling the resolved function:

```typescript
function logMessage(logger: Logger, message: string): void {
    logger.log(message);
}
context.setFunction(logMessage, [ Logger, null ]);

const log = context.getSync(logMessage);
log("Hello World");
```

In this example only the first parameter is automatically injected with a dependency (Logger instance in this case). The second parameter (message string) becomes the first parameter in the resolved function.

Note that it is technically not possible to infer the correct function argument types. So the signature of the resolved `log` function is `log(...args: unknown[]): void`. But at least the return type of the function is correctly inferred from the function type passed to `getSync()`.

## Function names

The function can be qualified with one or more names to allow injecting it as a [named dependency](named-dependencies.md):

```typescript
function closeDatabase(database: Database): void {
    database.close();
}
context.setFunction(closeDatabase, [ Database ], "close-db");

const closeFunc = context.getSync("close-db");
```

Instead of specifying a single string the name can also be an array of strings to define multiple names.
