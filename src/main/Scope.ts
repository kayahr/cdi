/*
 * Copyright (C) 2025 Klaus Reimer <k@ailis.de>
 * See LICENSE.md for licensing information.
 */

/**
 * The enum type of supported injection scopes.
 */
export type Scope = typeof Scope[keyof typeof Scope];

/**
 * The supported injection scopes.
 */
export const Scope = {
    /** A single instance of the dependency is created and then cached. So the same instance of the dependency is injected everywhere. */
    SINGLETON: 0,

    /** A new instance is created on every injection. */
    PROTOTYPE: 1
} as const;
