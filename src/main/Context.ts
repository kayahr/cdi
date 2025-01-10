/*
 * Copyright (C) 2025 Klaus Reimer <k@ailis.de>
 * See LICENSE.md for licensing information.
 */

import { Injectable } from "../main/Injectable.js";
import { InjectionError } from "../main/InjectionError.js";
import { type Class, type Constructor, type Factory, getSuperClass } from "../main/types.js";
import { qualify } from "./QualifiedType.js";
import { type NullableQualifiers, Qualifier, Qualifiers } from "./Qualifier.js";
import { Scope } from "./Scope.js";

/**
 * Options for creating an injectable class or factory.
 */
export interface InjectOptions<T extends unknown[] = unknown[]> {
    /** The injection scope. Defaults to {@link Scope.SINGLETON}. */
    scope?: Scope;

    /** Optional qualifier name (or names) of this injectable. This allows injecting it via name in addition to its type. */
    name?: string | symbol | Array<string | symbol>;

    /** The parameter types. Optional when injectable has no parameters. Otherwise it must match the constructor/factory signature. */
    inject?: Qualifiers<T>;
}

/**
 * Dependency injection context.
 */
export class Context {
    /** The root dependency injection context. */
    static readonly #root = new Context(null);

    /** The currently active dependency injection context. */
    static #active = this.#root;

    /** The parent dependency injection context. Null if this is the root context. */
    readonly #parent: Context | null;

    /** The injectables registered within this context. */
    readonly #injectables = new Map<Qualifier, Injectable>();

    /**
     * Creates a new dependency injection context with the given parent. The context is not activated, you have to do this yourself
     * with {@link activate()} if needed.
     *
     * @param parent - The parent dependency injection context. Null (default) if this is a root context.
     */
    private constructor(parent: Context | null) {
        this.#parent = parent;
        this.setValue(this);
    }

    /**
     * @returns The currently active dependency injection context.
     */
    public static getActive(): Context {
        return this.#active;
    }

    /**
     * @returns The root dependency injection context.
     */
    public static getRoot(): Context {
        return this.#root;
    }

    /**
     * Creates a new child dependency injection context. The context is not activated, you have to do this yourself with {@link activate()} if needed.
     *
     * @returns The created child dependency injection context.
     */
    public createChildContext(): Context {
        return new Context(this);
    }

    /**
     * @returns The parent context or null if this is a root context.
     */
    public getParent(): Context | null {
        return this.#parent;
    }

    /**
     * Activates this dependency injection context so all code which retrieves the context via {@link getActive()} work with this context.
     *
     * @returns The previously active context.
     */
    public activate(): Context {
        const previous = Context.#active;
        Context.#active = this;
        return previous;
    }

    /**
     * Checks if this dependency injection context is currently active.
     *
     * @returns True if this dependency injection context is active, false if not.
     */
    public isActive(): boolean {
        return Context.#active === this;
    }

    /**
     * Registers the given injectable in this dependency injection context with all possible qualifiers (type only, name only, qualified type).
     *
     * @param injectable - The injectable to register.
     */
    #setInjectable(injectable: Injectable): this {
        let type: Class | null = injectable.getType();
        do {
            this.#injectables.set(type, injectable);
            for (const name of injectable.getNames()) {
                this.#injectables.set(name, injectable);
                this.#injectables.set(qualify(type, name), injectable);
            }
        } while ((type = getSuperClass(type)) != null);
        return this;
    }

    /**
     * Constructs (if needed) and returns the dependency with the given qualifier. This context is activated during construction and the previously active
     * context is re-activated after construction.
     *
     * @param qualifier - The dependency qualifier. Either a type or a name.
     * @returns The constructed dependency. Can be a promise if dependency construction is async.
     * @throws {@link InjectionError} when dependency was not found.
     */
    #get<T>(qualifier: Qualifier<T>): T | Promise<T> {
        const previous = this.activate();
        try {
            const injectable = this.#injectables.get(qualifier) as Injectable<T> | null;
            let value = injectable == null ? null : injectable.get();
            if (value == null && this.#parent != null) {
                value = this.#parent.#get(qualifier);
            }
            if (value == null) {
                throw new InjectionError(`Dependency ${Qualifier.toString(qualifier)} not found`);
            }
            return value;
        } finally {
            previous.activate();
        }
    }

    public setClass<T>(type: Constructor<T, []>, options?: InjectOptions<[]>): this;
    public setClass<T, A extends unknown[]>(type: Constructor<T, A>, options: InjectOptions<A> & { inject: Qualifiers<A> }): this;

    /**
     * Registers the given injectable class in this dependency injection context.
     *
     * @param type    - The class to register. Must be constructable (constructor must be public).
     * @param options - Options for the injectable. Optional if class constructor has no parameters.
     */
    public setClass<T, P extends unknown[]>(type: Constructor<T, P>, { inject, scope, name }: InjectOptions<P> = {}): this {
        return this.#setInjectable(new Injectable(type, (...args: P) => new type(...args), inject, name, scope));
    }

    public setFactory<T>(type: Class<T>, factory: Factory<T, []>, options?: InjectOptions<[]>): this;
    public setFactory<T, P extends unknown[]>(type: Class<T>, factory: Factory<T, P>, options: InjectOptions<P> & { inject: Qualifiers<P> }): this;

    /**
     * Registers the given injectable factory in this dependency injection context.
     *
     * @param type    - The type of the value generated by the factory.
     * @param factory - The factory function which creates the value (synchronous or asynchronous).
     * @param options - Options for the injectable. Optional if factory has no parameters.
     */
    public setFactory<T, P extends unknown[]>(type: Class<T>, factory: Factory<T, P>, { inject, scope, name }: InjectOptions<P> = {}): this {
        return this.#setInjectable(new Injectable(type, factory.bind(type), inject, name, scope));
    }

    /**
     * Registers the given injectable value in this dependency injection context.
     *
     * @param value - The value to inject.
     * @param name - Optional name (or names) under which to inject the value. If not set then value is only injected via its type.
     */
    public setValue<T extends Object>(value: T, name?: string | symbol | Array<string | symbol>): this {
        return this.#setInjectable(new Injectable(value.constructor as Constructor<T>, () => value, [], name));
    }

    /**
     * Registers the given injectable function in this dependency injection context. Using `null` in the inject array defines placeholders for pass-through
     * function parameter. So when injecting a function with inject arguments `[ null, Service, null ]` the resolved function expects two parameters which are
     * filled into the placeholders while `Service` is injected automatically.
     *
     * @param func   - The value to inject.
     * @param inject - The parameter types. Must match the function signature but allows specifying `null` as type for marking pass-through parameters.
     * @param name   - Optional name (or names) under which to inject the function. If not set then function is only injected via its type.
     */
    public setFunction<P extends unknown[]>(func: (...params: P) => unknown, inject: NullableQualifiers<P>,
            name?: string | symbol | Array<string | symbol>): this {
        function createParams(injectParams: unknown[], callParams: unknown[]): unknown[] {
            let injectParamIndex = 0;
            let callParamIndex = 0;
            return inject.map(qualifier => qualifier == null ? callParams[callParamIndex++] : injectParams[injectParamIndex++]);
        }
        return this.#setInjectable(new Injectable(func, (...injectParams: P) => (...callParams: P) =>
            func(...createParams(injectParams, callParams) as P), inject.filter(qualifier => qualifier != null), name));
    }

    /**
     * Checks if this context (or its parents) have an injectable matching the given qualifier.
     *
     * @param qualifier - The dependency injection qualifier to look for.
     * @returns True if context or its parents have a matching injectable, false if not.
     */
    public has(qualifier: Qualifier): boolean {
        return this.#injectables.has(qualifier) || (this.#parent?.has(qualifier) === true);
    }

    /**
     * Removes the injectable with the given qualifier from this dependency injection context. It is only removed from this context, the removal does not
     * bubble up the parent hierarchy.
     *
     * @param qualifier - The qualifier to remove.
     * @returns True if an injectable was found and removed, false if not.
     */
    public remove(qualifier: Qualifier): boolean {
        return this.#injectables.delete(qualifier);
    }

    /**
     * Returns the context containing the dependency matching the given qualifier. Starts searching with this context and then bubbles up to the parent
     * context if not found in this one.
     *
     * @param qualifier - The qualifier to check.
     * @returns The context containing the dependency matching the given qualifier. Null if not found anywhere.
     */
    public findContext(qualifier: Qualifier): Context | null {
        return this.#injectables.has(qualifier) ? this : (this.#parent?.findContext(qualifier) ?? null);
    }

    public get<T, P extends unknown[]>(fn: (...params: P) => T): Promise<(...params: unknown[]) => T> | ((...params: unknown[]) => T);
    public get<T>(qualifier: Qualifier<T>): T | Promise<T>;

    /**
     * Returns the dependency matching the given qualifier in this dependency injection context. An exception is thrown when no dependency was found. This
     * method returns either a synchronous value if all involved dependencies are synchronous, or a promise if at least one of the involved dependencies is
     * asynchronous. If you already know that the result can only be synchronous or asynchronous then you can use {@link getSync} and {@link getAsync} instead.
     *
     * @param qualifier - The dependency injection qualifier (type or name).
     * @returns The found dependency (Synchronous if possible, asynchronous otherwise).
     * @throws {@link InjectionError} when dependency was not found.
     */
    public get<T>(qualifier: Qualifier<T>): T | Promise<T> {
        return this.#get(qualifier);
    }

    public getAsync<T, P extends unknown[]>(fn: (...params: P) => T): Promise<(...params: unknown[]) => T>;
    public getAsync<T>(qualifier: Qualifier<T>): Promise<T>;

    /**
     * Alias for {@link get} which always returns a promise, even when all involved dependencies are synchronous.
     *
     * @param qualifier - The dependency injection qualifier (type or name).
     * @returns The found dependency.
     * @throws {@link InjectionError} when dependency was not found.
     */
    public async getAsync<T>(qualifier: Qualifier<T>): Promise<T> {
        return this.get(qualifier);
    }

    public getSync<T, P extends unknown[]>(fn: (...params: P) => T): (...params: unknown[]) => T;
    public getSync<T>(qualifier: Qualifier<T>): T;

    /**
     * Alias for {@link get} which always returns a synchronous value or throws an exception if an asynchronous dependency is involved.
     *
     * @param qualifier - The dependency injection qualifier (type or name).
     * @returns The found dependency.
     * @throws {@link InjectionError} when dependency was not found or is asynchronous.
     */
    public getSync<T>(qualifier: Qualifier<T>): T {
        const dependency = this.get(qualifier);
        if (dependency instanceof Promise) {
            throw new InjectionError(`Asynchronous dependency ${Qualifier.toString(qualifier)} can not be resolved synchronously`);
        }
        return dependency;
    }
}
