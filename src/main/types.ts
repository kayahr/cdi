/*
 * Copyright (C) 2025 Klaus Reimer <k@ailis.de>
 * See LICENSE.md for licensing information
 */

/**
 * Class type which even works for classes with a private constructor. If you have a public constructor consider using {@link Constructor} instead.
 *
 * @template T - The class instance type.
 *
 * @internal
 */
export type Class<T = unknown> = Function & {
    /** The class prototype. */
    prototype: T;
};

/**
 * Public constructor type.
 *
 * @template T - The class instance type.
 * @template P - The constructor parameter types.
 *
 * @internal
 */
export type Constructor<T = unknown, P extends unknown[] = any[]> = (new (...args: P) => T) & Class<T>;

/**
 * Factory function type.
 *
 * @template T - The type of the created value (synchronous or asynchronous).
 * @template P - The factory function parameter types.
 *
 * @internal
 */
export type Factory<T = unknown, P extends unknown[] = unknown[]> = (...args: P) => T | Promise<T>;

/**
 * Type of a class decorator.
 *
 * @template T - The type of the decorated class.
 * @template P - The constructor parameter types.
 *
 * @internal
 */
export type ClassDecorator<T = unknown, P extends unknown[] = unknown[]> =
    (target: Constructor<T, P>, context: ClassDecoratorContext<Constructor<T, P>>) => void;

/**
 * Type of a static factory method decorator.
 *
 * @template T - The type of the created value (synchronous or asynchronous).
 * @template P - The factory function parameter types.
 *
 * @internal
 */
export type ClassMethodDecorator<T = unknown, P extends unknown[] = unknown[]> =
    (target: Factory<T, P>, context: ClassMethodDecoratorContext<Class<T>, Factory<T, P>>) => void;

/**
 * Returns the super class of the given class.
 *
 * @param type - The class for which to return the super class.
 * @return The super class of the given class. Null when class is the Object class which has no super class.
 */
export function getSuperClass(type: Class): Class | null {
    return (Object.getPrototypeOf(type.prototype ?? Object.prototype) as Class)?.constructor ?? null;
}
