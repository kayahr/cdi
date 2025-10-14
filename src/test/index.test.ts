/*
 * Copyright (C) 2024 Klaus Reimer <k@ailis.de>
 * See LICENSE.md for licensing information
 */

import { describe, it } from "node:test";

import { Context, type InjectableOptions } from "../main/Context.ts";
import { type InjectableDecorator, type InjectableDecoratorContext, type InjectableTarget, injectable } from "../main/decorator.ts";
import * as exports from "../main/index.ts";
import { InjectionError } from "../main/InjectionError.ts";
import { QualifiedType, qualify } from "../main/QualifiedType.ts";
import type { NullableQualifier, NullableQualifiers, Qualifier, Qualifiers } from "../main/Qualifier.ts";
import { Scope } from "../main/Scope.ts";
import type { Class, ClassDecorator, ClassMethodDecorator, Constructor, Factory } from "../main/types.ts";
import { assertEquals } from "@kayahr/assert";

describe("index", () => {
    it("exports relevant types and functions and nothing more", () => {
        // Check functions, classes and enums
        assertEquals({ ...exports }, {
            Context,
            InjectionError,
            Scope,
            injectable,
            qualify,
            QualifiedType
        });

        // Interfaces and types can only be checked by TypeScript
        ((): InjectableOptions => (({} as exports.InjectableOptions)))();
        ((): Class => (({} as exports.Class)))();
        ((): Constructor => (({} as exports.Constructor)))();
        ((): Factory => (({} as exports.Factory)))();
        ((): Qualifier => (({} as exports.Qualifier)))();
        ((): Qualifiers => (({} as exports.Qualifiers)))();
        ((): NullableQualifier => (({} as exports.NullableQualifier)))();
        ((): NullableQualifiers => (({} as exports.NullableQualifiers)))();
        ((): ClassDecorator => (({} as exports.ClassDecorator)))();
        ((): ClassMethodDecorator => (({} as exports.ClassMethodDecorator)))();
        ((): InjectableDecorator => (({} as exports.InjectableDecorator)))();
        ((): InjectableDecoratorContext => (({} as exports.InjectableDecoratorContext)))();
        ((): InjectableTarget => (({} as exports.InjectableTarget)))();
    });
});
