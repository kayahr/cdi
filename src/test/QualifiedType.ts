/*
 * Copyright (C) 2025 Klaus Reimer <k@ailis.de>
 * See LICENSE.md for licensing information
 */

import "@kayahr/vitest-matchers";

import { beforeEach, describe, expect, it } from "vitest";

import { Context } from "../main/Context.js";
import { qualify } from "../main/QualifiedType.js";

describe("TypedQualifier", () => {
    let context: Context;
    beforeEach(() => {
        context = Context.getRoot().createChildContext();
        context.activate();
    });
    it("can be used to inject different implementations of same base type", () => {
        abstract class Base {
            public base(): void {};
            public abstract test(): number;
        }
        class Implementation1 extends Base {
            public test(): number {
                return 1;
            }
        }
        class Implementation2 extends Base {
            public test(): number {
                return 2;
            }
        }
        const impl2 = Symbol("impl-2");
        context.setClass(Implementation1, { name: "impl-1" });
        context.setClass(Implementation2, { name: impl2 });

        class Test {
            public constructor(
                public readonly impl1: Base,
                public readonly impl2: Base
            ) {}
        }
        context.setClass(Test, { inject: [ qualify(Base, "impl-1"), qualify(Base, impl2) ] });
        const test = context.getSync(Test);
        expect(test.impl1.test()).toBe(1);
        expect(test.impl2.test()).toBe(2);
    });
});
