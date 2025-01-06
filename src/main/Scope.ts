/*
 * Copyright (C) 2025 Klaus Reimer <k@ailis.de>
 * See LICENSE.md for licensing information.
 */

/**
 * The supported injection scopes.
 */
export enum Scope {
    /** A single instance of the dependency is created and then cached. So the same instance of the dependency is injected everywhere. */
    SINGLETON,

    /** A new instance is created on every injection. */
    PROTOTYPE
}
