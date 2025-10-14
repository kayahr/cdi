/*
 * Copyright (C) 2025 Klaus Reimer <k@ailis.de>
 * See LICENSE.md for licensing information.
 */

import type { Class } from "./types.ts";

/** Map with cached qualified types. */
const qualifiedTypes = new Map<Class, Map<string | symbol, QualifiedType>>();

/**
 * A qualified type. Allows injecting multiple implementations of the same base type under different names so consumers can decide which implementation to
 * inject by simply changing the qualifier name.
 *
 * @template T - The type to qualify with a name.
 */
export class QualifiedType<T extends Class = Class> {
    /** The type to qualify. */
    public readonly type: T;

    /** The name/symbol to qualify the type with. */
    public readonly name: string | symbol;

    /**
     * Creates a new qualified type.
     *
     * @param type - The type to qualify.
     * @param name - The name/symbol to qualify the type with.
     */
    private constructor(type: T, name: string | symbol) {
        this.type = type;
        this.name = name;
    }

    /**
     * Returns the qualifier type for the given type and name. It is guaranteed to always return the same instance for the same combination of type and name.
     *
     * @param type - The type to qualify.
     * @param name - The name/symbol to qualify the type with.
     *
     * @template T - The type to qualify with a name.
     */
    public static for<T extends Class>(type: T, name: string | symbol): QualifiedType<T> {
        let types = qualifiedTypes.get(type);
        if (types == null) {
            types = new Map<string | symbol, QualifiedType>();
            qualifiedTypes.set(type, types);
        }
        let qualifiedType = types.get(name);
        if (qualifiedType == null) {
            qualifiedType = new QualifiedType(type, name);
            types.set(name, qualifiedType);
        }
        return qualifiedType as QualifiedType<T>;
    }

    /**
     * @internal
     */
    public toString(): string {
        return `<${this.type.name}:${this.name.toString()}>`;
    }
}

/**
 * Returns the qualified type for the given type and name. It is guaranteed to always return the same instance for the same combination of type and name.
 *
 * This function is just a short-alias for {@link QualifiedType.for}.
 *
 * @param type - The type to qualify.
 * @param name - The name/symbol to qualify the type with.
 *
 * @template T - The type to qualify with a name.
 */
export function qualify<T extends Class>(type: T, name: string | symbol): QualifiedType<T> {
    return QualifiedType.for(type, name);
}
