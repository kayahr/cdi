/*
 * Copyright (C) 2025 Klaus Reimer <k@ailis.de>
 * See LICENSE.md for licensing information
 */

import { beforeEach, describe, expect, it } from "vitest";

import { Context } from "../main/Context.js";
import { injectable } from "../main/decorator.js";
import { Scope } from "../main/Scope.js";

class DepA { public a = 1; };
class DepB { public b = 2; };

describe("decorator", () => {
    let context: Context;
    beforeEach(() => {
        context = Context.getRoot().createChildContext();
        context.activate();
    });
    it("can inject a singleton class with no dependencies", () => {
        @injectable
        class Test {
            public value = 53;
        }
        const test = context.getSync(Test);
        expect(context.getSync(Test)).toBe(test);
        expect(test.value).toBe(53);
    });
    it("can inject a singleton class with type dependencies", () => {
        @injectable({ inject: [ DepA, DepB ] })
        class Test {
            public constructor(public a: DepA, public b: DepB) {}
        }
        context.setClass(DepA);
        context.setClass(DepB);
        const test = context.getSync(Test);
        expect(context.getSync(Test)).toBe(test);
        expect(test.a).toBeInstanceOf(DepA);
        expect(test.b).toBeInstanceOf(DepB);
    });
    it("can inject a singleton class with named dependencies", () => {
        @injectable({ inject: [ "dep-a", "dep-b-alias" ] })
        class Test {
            public constructor(public a: DepA, public b: DepB) {}
        }
        context.setClass(DepA, { name: "dep-a" });
        context.setClass(DepB, { name: [ "dep-b", "dep-b-alias" ] });
        const test = context.getSync(Test);
        expect(context.getSync(Test)).toBe(test);
        expect(test.a).toBeInstanceOf(DepA);
        expect(test.b).toBeInstanceOf(DepB);
    });
    it("can inject a singleton class with mixed (type and named) dependencies", () => {
        @injectable({ inject: [ "dep-a", DepB ] })
        class Test {
            public constructor(public a: DepA, public b: DepB) {}
        }
        context.setClass(DepA, { name: "dep-a" });
        context.setClass(DepB);
        const test = context.getSync(Test);
        expect(context.getSync(Test)).toBe(test);
        expect(test.a).toBeInstanceOf(DepA);
        expect(test.b).toBeInstanceOf(DepB);
    });
    it("can inject a prototype-scoped class", () => {
        @injectable({ scope: Scope.PROTOTYPE })
        class Test { public value = 23; }
        const test = context.getSync(Test);
        expect(test.value).toBe(23);
        const test2 = context.getSync(Test);
        expect(test2).not.toBe(test);
        expect(test.value).toBe(23);
    });
    it("can inject a class which depends on asynchronous dependency", async () => {
        class AsyncDep {
            private constructor(public readonly value: number) {}

            @injectable
            public static async create(): Promise<AsyncDep> {
                return Promise.resolve(new AsyncDep(23));
            }
        }

        @injectable({ inject: [ AsyncDep ] })
        class Test {
            public constructor(private readonly asyncDep: AsyncDep) {}
            public getValue(): number {
                return this.asyncDep.value;
            }
        }
        const testPromise = context.get(Test);
        expect(testPromise).toBeInstanceOf(Promise);
        const test = await testPromise;
        expect(test.getValue()).toBe(23);
        // After promise resolve dependency can be resolved synchronously
        const test2 = context.getSync(Test);
        expect(test2).toBe(test);
    });
    it("requires compatible inject array when class has dependencies", () => {
        // @ts-expect-error Must not compile because inject array is empty
        @injectable({ inject: [] })
        class Test1 {
            public constructor(public a: DepA, public b: DepB) {}
        }
        // @ts-expect-error Must not compile because DepB is missing
        @injectable({ inject: [ DepA ] })
        class Test2 {
            public constructor(public a: DepA, public b: DepB) {}
        }
        // @ts-expect-error Must not compile because dependencies are in wrong order
        @injectable({ inject: [ DepB, DepA ] })
        class Test3 {
            public constructor(public a: DepA, public b: DepB) {}
        }
        // @ts-expect-error Must not compile because too many dependencies are specified
        @injectable({ inject: [ DepA, DepB, DepB ] })
        class Test4 {
            public constructor(public a: DepA, public b: DepB) {}
        }
        // @ts-expect-error Must not compile because inject option is missing
        @injectable({})
        class Test5 {
            public constructor(public a: DepA, public b: DepB) {}
        }
        // @ts-expect-error Must not compile because inject options are required
        @injectable()
        class Test6 {
            public constructor(public a: DepA, public b: DepB) {}
        }
        // @ts-expect-error Must not compile because decorator arguments are required
        @injectable
        class Test7 {
            public constructor(public a: DepA, public b: DepB) {}
        }
        // @ts-expect-error Must not compile because null inject is not allowed
        @injectable({ inject: [ DepA, null ] })
        class Test8 {
            public constructor(public a: DepA, public b: DepB) {}
        }

        // Dummy line to silence "defined but not used" warnings
        expect([ Test1, Test2, Test3, Test4, Test5, Test6, Test7, Test8 ]).toBeDefined();
    });
    it("can inject a factory method singleton with a private construct and no dependencies", () => {
        class Test {
            private static readonly value = 53;
            private constructor(public value: number) {}

            @injectable
            public static create(): Test {
                return new Test(this.value);
            }
        }
        const test = context.getSync(Test);
        expect(context.getSync(Test)).toBe(test);
        expect(test.value).toBe(53);
    });
    it("can inject a factory method singleton with private constructor and type dependencies", () => {
        class Test {
            private static readonly value = 53;
            private constructor(public a: DepA, public b: DepB, public c: number) {}

            @injectable({ inject: [ DepA, DepB ] })
            public static create(a: DepA, b: DepB): Test {
                return new Test(a, b, this.value);
            }
        }
        context.setClass(DepA);
        context.setClass(DepB);
        const test = context.getSync(Test);
        expect(context.getSync(Test)).toBe(test);
        expect(test.a).toBeInstanceOf(DepA);
        expect(test.b).toBeInstanceOf(DepB);
        expect(test.c).toBe(53);
    });
    it("can inject a factory method singleton with private constructor and named dependencies", () => {
        class Test {
            private static readonly value = 53;
            private constructor(public a: DepA, public b: DepB, public c: number) {}

            @injectable({ inject: [ "dep-a-alias", "dep-b" ] })
            public static create(a: DepA, b: DepB): Test {
                return new Test(a, b, this.value);
            }
        }
        context.setClass(DepA, { name: [ "dep-a", "dep-a-alias" ] });
        context.setClass(DepB, { name: "dep-b" });
        const test = context.getSync(Test);
        expect(context.getSync(Test)).toBe(test);
        expect(test.a).toBeInstanceOf(DepA);
        expect(test.b).toBeInstanceOf(DepB);
        expect(test.c).toBe(53);
    });
    it("can inject a factory method singleton with private constructor and mixed (type and named) dependencies", () => {
        class Test {
            private static readonly value = 53;
            private constructor(public a: DepA, public b: DepB, public c: number) {}

            @injectable({ inject: [ "dep-a", DepB ] })
            public static create(a: DepA, b: DepB): Test {
                return new Test(a, b, this.value);
            }
        }
        context.setClass(DepA, { name: "dep-a" });
        context.setClass(DepB);
        const test = context.getSync(Test);
        expect(context.getSync(Test)).toBe(test);
        expect(test.a).toBeInstanceOf(DepA);
        expect(test.b).toBeInstanceOf(DepB);
        expect(test.c).toBe(53);
    });
    it("can inject a prototype-scoped factory method", () => {
        class Test {
            private static readonly value = 23;
            private constructor(public value: number) {}

            @injectable({ scope: Scope.PROTOTYPE })
            public static create(): Test {
                return new Test(this.value);
            }
        }
        const test = context.getSync(Test);
        expect(test.value).toBe(23);
        const test2 = context.getSync(Test);
        expect(test2).not.toBe(test);
        expect(test.value).toBe(23);
    });
    it("can inject a prototype-scoped async factory method", async () => {
        class Test {
            private static readonly value = 23;
            private constructor(public value: number) {}

            @injectable({ scope: Scope.PROTOTYPE })
            public static async create(): Promise<Test> {
                return Promise.resolve(new Test(this.value));
            }
        }
        const testPromise = context.get(Test);
        expect(testPromise).toBeInstanceOf(Promise);
        const test = await testPromise;
        expect(test.value).toBe(23);
        const test2Promise = context.get(Test);
        expect(test2Promise).not.toBe(testPromise);
        expect(test2Promise).toBeInstanceOf(Promise);
        const test2 = await test2Promise;
        expect(test2).not.toBe(test);
        expect(test.value).toBe(23);
    });
    it("can inject an async factory method singleton", async () => {
        class Test {
            private static readonly value = 23;
            private constructor(public value: number) {}

            @injectable
            public static async create(): Promise<Test> {
                return Promise.resolve(new Test(this.value));
            }
        }
        const testPromise = context.get(Test);
        expect(testPromise).toBeInstanceOf(Promise);
        const test = await testPromise;
        expect(test.value).toBe(23);
        // Fetch after promise resolve is synchronously resolvable
        const test2 = context.getSync(Test);
        expect(test2).toBe(test);
        expect(test.value).toBe(23);
    });
    it("requires compatible inject array when factory function has dependencies", () => {
        class Test1 {
            // @ts-expect-error Must not compile because inject array is empty
            @injectable({ inject: [] })
            public static create(a: DepA, b: DepB): Test1 {
                return new Test1();
            }
        }
        class Test2 {
            // @ts-expect-error Must not compile because DepB is missing
            @injectable({ inject: [ DepA ] })
            public static create(a: DepA, b: DepB): Test2 {
                return new Test2();
            }
        }
        class Test3 {
            // @ts-expect-error Must not compile because dependencies are in wrong order
            @injectable({ inject: [ DepB, DepA ] })
            public static create(a: DepA, b: DepB): Test3 {
                return new Test3();
            }
        }
        class Test4 {
            // @ts-expect-error Must not compile because too many dependencies are specified
            @injectable({ inject: [ DepA, DepB, DepB ] })
            public static create(a: DepA, b: DepB): Test4 {
                return new Test4();
            }
        }
        class Test5 {
            // @ts-expect-error Must not compile because inject option is missing
            @injectable({ inject: [] })
            public static create(a: DepA, b: DepB): Test5 {
                return new Test5();
            }
        }
        class Test6 {
            // @ts-expect-error Must not compile because inject option is missing
            @injectable({})
            public static create(a: DepA, b: DepB): Test6 {
                return new Test6();
            }
        }
        class Test7 {
            // @ts-expect-error Must not compile because decorator arguments are missing
            @injectable
            public static create(a: DepA, b: DepB): Test7 {
                return new Test7();
            }
        }
        class Test8 {
            // @ts-expect-error Must not compile because null inject is not allowed
            @injectable({ inject: [ null, DepB ] })
            public static create(a: DepA, b: DepB): Test7 {
                return new Test7();
            }
        }

        // Dummy line to silence "defined but not used" warnings
        expect([ Test1, Test2, Test3, Test4, Test5, Test6, Test7, Test8 ]).toBeDefined();
    });
});
