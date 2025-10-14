/*
 * Copyright (C) 2025 Klaus Reimer <k@ailis.de>
 * See LICENSE.md for licensing information
 */

import type { QualifiedType } from "./QualifiedType.ts";
import type { Class } from "./types.ts";

/**
 * Type of a dependency qualifier. Either a class or a name/symbol.
 *
 * @param T - The class type.
 */
export type Qualifier<T = unknown> = Class<T> | QualifiedType<Class<T>> | string | symbol;

/**
 * Maps constructor/factory parameter types to qualifiers.
 *
 * @param T - The constructor/factory parameter types to map.
 */
export type Qualifiers<T extends unknown[] = unknown[]> = NoInfer<{ [ K in keyof T ]: Qualifier<T[K]> }>;

/**
 * Type of a nullable dependency qualifier. Either a class, a name or null. Used for function injecting where `null` defines a pass-through parameter.
 *
 * @param T - The class type.
 */
export type NullableQualifier<T = unknown> = Qualifier<T> | null;

/**
 * Maps function parameter types to nullable qualifiers. Used for function injecting where `null` defines a pass-through parameter.
 *
 * @param T - The function parameter types to map.
 */
export type NullableQualifiers<T extends unknown[] = unknown[]> = NoInfer<{ [ K in keyof T ]: NullableQualifier<T[K]> }>;

/**
 * @internal
 */
export const Qualifier = {
    /**
     * @returns A string representation of the qualifier.
     */
    toString(qualifier: Qualifier): string {
        if (qualifier instanceof Function) {
            return `<${qualifier.name}>`;
        } else  if (typeof qualifier === "string") {
            return `'${qualifier}'`;
        } else {
            return qualifier.toString();
        }
    }
} as const;
