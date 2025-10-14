/*
 * Copyright (C) 2025 Klaus Reimer <k@ailis.de>
 * See LICENSE.md for licensing information
 */

export type { NullableQualifier, NullableQualifiers, Qualifier, Qualifiers } from "./Qualifier.ts";
export type { Class, ClassDecorator, ClassMethodDecorator, Constructor, Factory } from "./types.ts";

export { Context, type InjectableOptions } from "./Context.ts";
export { injectable, type InjectableDecorator, type InjectableDecoratorContext, type InjectableTarget } from "./decorator.ts";
export { InjectionError } from "./InjectionError.ts";
export { QualifiedType, qualify } from "./QualifiedType.ts";
export { Scope } from "./Scope.ts";
