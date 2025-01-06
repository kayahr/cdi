/*
 * Copyright (C) 2024 Klaus Reimer <k@ailis.de>
 * See LICENSE.md for licensing information
 */

import { describe, expect, it } from "vitest";

import { Context, type InjectOptions } from "../main/Context.js";
import { injectable, type InjectableDecorator, type InjectableDecoratorContext, type InjectableTarget } from "../main/decorator.js";
import * as exports from "../main/index.js";
import { InjectionError } from "../main/InjectionError.js";
import { QualifiedType, qualify } from "../main/QualifiedType.js";
import {  type NullableQualifier, type NullableQualifiers, type Qualifier, type Qualifiers } from "../main/Qualifier.js";
import { Scope } from "../main/Scope.js";
import { type Class, type ClassDecorator, type ClassMethodDecorator, type Constructor, type Factory } from "../main/types.js";

describe("index", () => {
    it("exports relevant types and functions and nothing more", () => {
        // Check functions, classes and enums
        expect({ ...exports }).toEqual({
            Context,
            InjectionError,
            Scope,
            injectable,
            qualify,
            QualifiedType
        });

        // Interfaces and types can only be checked by TypeScript
        ((): InjectOptions => (({} as exports.InjectOptions)))();
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
