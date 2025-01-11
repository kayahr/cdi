/*
 * Copyright (C) 2025 Klaus Reimer <k@ailis.de>
 * See LICENSE.md for licensing information.
 */

import { Context } from "./Context.js";
import { InjectionError } from "./InjectionError.js";
import { NullableQualifier, Qualifier } from "./Qualifier.js";
import { Scope } from "./Scope.js";
import { Class, Constructor, type Factory } from "./types.js";

/**
 * A resolvable and injectable dependency.
 */
export class Injectable<T = unknown> {
    readonly #type: Class<T>;
    readonly #factory: Factory<T>;
    readonly #params: NullableQualifier[];
    readonly #names: ReadonlyArray<string | symbol>;
    readonly #scope: Scope;

    /** Cached instance of the dependency. */
    #instance: T | Promise<T> | null = null;

    /**
     * Creates a new injectable.
     *
     * @param type    - The type into which this injectable is resolved.
     * @param factory - The factory function to create the actual dependency (synchronous or asynchronous).
     * @param params  - The parameters of the constructor or static factory method to resolve and pass to the
     *                  factory function when creating the dependency.
     * @param name    - Optional qualifier name (or names) this injectable matches.
     * @param scope   - The injection scope.
     */
    public constructor(
        type: Class<T> | Constructor<T>,
        factory: (...args: any[]) => T | Promise<T>,
        params: NullableQualifier[] = [],
        name: string | symbol | Array<string | symbol> = [],
        scope = Scope.SINGLETON
    ) {
        this.#type = type;
        this.#factory = factory;
        this.#params = params;
        this.#names = name instanceof Array ? name.slice() : [ name ];
        this.#scope = scope;
    }

    /**
     * @returns The registered names of this injectable.
     */
    public getNames(): ReadonlyArray<string | symbol> {
        return this.#names;
    }

    /**
     * @returns The instance type.
     */
    public getType(): Class<T> {
        return this.#type;
    }

    /**
     * Creates and returns a new dependency instance.
     *
     * @param qualifier - The requested qualifier. Used in error messages.
     * @param params    - Optional list of manual pass-through parameters.
     * @returns The created instance. Can be a promise when dependency is asynchronous.
     */
    #createNewInstance(qualifier: Qualifier, params?: unknown[]): Promise<T> | T {
        const context = Context.getActive();
        let paramIndex = 0;
        const numParams = params?.length ?? 0;
        const values = this.#params.map(param => {
            if (param == null) {
                if (paramIndex >= numParams) {
                    throw new InjectionError(`Pass-through parameter ${paramIndex + 1} not found for dependency ${Qualifier.toString(qualifier)}`);
                }
                return params?.[paramIndex++];
            } else {
                return context.get(param);
            }
        });
        if (values.some(value => value instanceof Promise)) {
            return (async (): Promise<T> => this.#factory(...await Promise.all(values)))();
        } else {
            return this.#factory(...values);
        }
    }

    /**
     * Returns a singleton instance of the injectable. The created instance is cached so the same instance is returned on each call.
     *
     * @param qualifier - The requested qualifier. Used in error messages
     * @returns The created instance or a promise when asynchronous creation is in progress.
     */
    #getSingletonInstance(qualifier: Qualifier): Promise<T> | T {
        if (this.#instance == null) {
            this.#instance = this.#createNewInstance(qualifier);

            // Replace asynchronous instance with synchronous instance when resolved
            if (this.#instance instanceof Promise) {
                void this.#instance.then(instance => {
                    this.#instance = instance;
                });
            }
        }
        return this.#instance;
    }

    /**
     * Returns the instance of the injectable. Depending on the configured scope this can be a singleton instance or a new instance on every call.
     *
     * @param qualifier - The requested qualifier. Used in error messages
     * @param params    - Optional list of manual pass-through parameters fo prototype scoped injectables. Not used for singletons, they don't
     *                    support pass-through parameters.
     * @returns The instance or a promise when asynchronous creation is in progress.
     */
    public get(qualifier: Qualifier, params?: unknown[]): Promise<T> | T {
        if (this.#scope === Scope.PROTOTYPE) {
            return this.#createNewInstance(qualifier, params);
        } else {
            return this.#getSingletonInstance(qualifier);
        }
    }
}
