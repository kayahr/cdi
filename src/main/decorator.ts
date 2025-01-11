/*
 * Copyright (C) 2025 Klaus Reimer <k@ailis.de>
 * See LICENSE.md for licensing information
 */

import type { Class, ClassDecorator, ClassMethodDecorator, Constructor, Factory } from "../main/types.js";
import { Context, type InjectableOptions } from "./Context.js";
import type { NullableQualifiers, Qualifiers } from "./Qualifier.js";
import type { Scope } from "./Scope.js";

/**
 * Target type for the {@link injectable} decorator.
 *
 * @internal
 */
export type InjectableTarget<T = unknown, A extends unknown[] = unknown[]> = Class<T> | Factory<T, A>;

/**
 * Decorator type of {@link injectable}.
 *
 * @internal
 */
export type InjectableDecorator<T = unknown, A extends unknown[] = unknown[]> = ClassDecorator<T, A> & ClassMethodDecorator<T, A>;

/**
 * Decorator context type for {@link injectable}.
 *
 * @internal
 */
export type InjectableDecoratorContext<T = unknown, A extends unknown[] = unknown[]> = ClassMethodDecoratorContext<Class<T>, Factory<T, A>>
    | ClassDecoratorContext<Constructor<T, A>>;

function injectableWithoutOptions<T>(target: InjectableTarget<T, []>, context: InjectableDecoratorContext<T, []>): void {
    if (context.kind === "class") {
        context.addInitializer(function () {
            Context.getActive().setClass(this);
        });
    } else {
        context.addInitializer(function () {
            Context.getActive().setFactory(this, target as Factory);
        });
    }
}

function injectableWithOptions<T, P extends unknown[], Q extends Qualifiers<P>>(options: InjectableOptions<Q> & { inject: Q }): InjectableDecorator<T, P> {
    return (target: InjectableTarget<T, P>, context: InjectableDecoratorContext<T, P>) => {
        if (context.kind === "class") {
            context.addInitializer(function () {
                Context.getActive().setClass(this, options);
            });
        } else {
            context.addInitializer(function () {
                Context.getActive().setFactory(this, target as Factory, options);
            });
        };
    };
}

/**
 * Decorator for a class or static factory which has no parameters. Inject options are optional in this case because no dependency qualifiers
 * needs to be specified.
 *
 * @param options - Optional inject options.
 * @returns The decorator.
 *
 * @template T - The class/method type
 */
export function injectable<T>(options?: InjectableOptions): InjectableDecorator<T, []>;

/**
 * Decorator for a class or static factory with parameters. Inject options are not optional because dependency qualifiers must be specified so the injector
 * knows what has to be injected.
 *
 * @param options - The inject options with a mandatory `inject` property.
 * @returns the decorator
 *
 * @template T - The type of the decorated class or static method
 * @template P - The constructor/method parameter types
 */
export function injectable<T, P extends unknown[], Q extends Qualifiers<P>>(options: InjectableOptions<Q> & { inject: Q }):  InjectableDecorator<T, P>;

/**
 * Decorator for a class or static factory with parameters. Inject options are not optional because dependency qualifiers must be specified so the injector
 * knows what has to be injected.
 *
 * @param options - The inject options with a mandatory `inject` property.
 * @returns the decorator
 *
 * @template T - The type of the decorated class or static method
 * @template P - The constructor/method parameter types
 */
export function injectable<T, P extends unknown[], Q extends NullableQualifiers<P>>(options: InjectableOptions<Q>
    & { inject: Q, scope: Scope.PROTOTYPE }): InjectableDecorator<T, P>;

/**
 * Short-form of the decorator without any inject options. Can only be used on classes or static factories without parameters.
 *
 * @param target  - The class or static method
 * @param context - The decorator context.
 *
 * @template T - The type of the decorated class or static method
 */
export function injectable<T>(target: Constructor<T, []> | Factory<T, []>, context: InjectableDecoratorContext<T, []>): void;

export function injectable(...args: unknown[]): InjectableDecorator | void {
    if (args[0] instanceof Function) {
        return injectableWithoutOptions(...args as Parameters<typeof injectableWithoutOptions>);
    } else {
        return injectableWithOptions(...args as Parameters<typeof injectableWithOptions>);
    }
}
