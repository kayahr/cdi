/*
 * Copyright (C) 2025 Klaus Reimer <k@ailis.de>
 * See LICENSE.md for licensing information
 */

import { beforeEach, describe, it } from "node:test";

import { Context } from "../main/Context.js";
import { injectable } from "../main/decorator.js";
import { Scope } from "../main/Scope.js";
import { assertDefined, assertInstanceOf, assertNotSame, assertSame } from "@kayahr/assert";

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
        assertSame(context.getSync(Test), test);
        assertSame(test.value, 53);
    });
    it("can inject a singleton class with type dependencies", () => {
        @injectable({ inject: [ DepA, DepB ] })
        class Test {
            public a: DepA;
            public b: DepB;
            public constructor(a: DepA, b: DepB) {
                this.a = a;
                this.b = b;
            }
        }
        context.setClass(DepA);
        context.setClass(DepB);
        const test = context.getSync(Test);
        assertSame(context.getSync(Test), test);
        assertInstanceOf(test.a, DepA);
        assertInstanceOf(test.b, DepB);
    });
    it("can inject a singleton class with named dependencies", () => {
        const depA = Symbol("dep-a");
        @injectable({ inject: [ depA, "dep-b-alias" ] })
        class Test {
            public a: DepA;
            public b: DepB;
            public constructor(a: DepA, b: DepB) {
                this.a = a;
                this.b = b;
            }
        }
        context.setClass(DepA, { name: depA });
        context.setClass(DepB, { name: [ "dep-b", "dep-b-alias" ] });
        const test = context.getSync(Test);
        assertSame(context.getSync(Test), test);
        assertInstanceOf(test.a, DepA);
        assertInstanceOf(test.b, DepB);
    });
    it("can inject a value via symbol", () => {
        const sym = Symbol("dep-a");
        @injectable({ inject: [ sym ] })
        class Test {
            public a: string;
            public constructor(a: string) {
                this.a = a;
            }
        }
        context.setValue("foobar", sym);
        const test = context.getSync(Test);
        assertSame(context.getSync(Test), test);
        assertSame(test.a, "foobar");
    });
    it("can inject a singleton class with mixed (type and named) dependencies", () => {
        @injectable({ inject: [ "dep-a", DepB ] })
        class Test {
            public a: DepA;
            public b: DepB;
            public constructor(a: DepA, b: DepB) {
                this.a = a;
                this.b = b;
            }
        }
        context.setClass(DepA, { name: "dep-a" });
        context.setClass(DepB);
        const test = context.getSync(Test);
        assertSame(context.getSync(Test), test);
        assertInstanceOf(test.a, DepA);
        assertInstanceOf(test.b, DepB);
    });
    it("can inject a prototype-scoped class", () => {
        @injectable({ scope: Scope.PROTOTYPE })
        class Test { public value = 23; }
        const test = context.getSync(Test);
        assertSame(test.value, 23);
        const test2 = context.getSync(Test);
        assertNotSame(test2, test);
        assertSame(test.value, 23);
    });
    it("can inject a class which depends on asynchronous dependency", async () => {
        class AsyncDep {
            public readonly value: number;
            private constructor(value: number) {
                this.value = value;
            }

            @injectable
            public static async create(): Promise<AsyncDep> {
                return Promise.resolve(new AsyncDep(23));
            }
        }

        @injectable({ inject: [ AsyncDep ] })
        class Test {
            private readonly asyncDep: AsyncDep;
            public constructor(asyncDep: AsyncDep) {
                this.asyncDep = asyncDep;
            }
            public getValue(): number {
                return this.asyncDep.value;
            }
        }
        const testPromise = context.get(Test);
        assertInstanceOf(testPromise, Promise);
        const test = await testPromise;
        assertSame(test.getValue(), 23);
        // After promise resolve dependency can be resolved synchronously
        const test2 = context.getSync(Test);
        assertSame(test2, test);
    });
    it("requires compatible inject array when class has dependencies", () => {
        // @ts-expect-error Must not compile because inject array is empty
        @injectable({ inject: [] })
        class Test1 {
            public a: DepA;
            public b: DepB;
            public constructor(a: DepA, b: DepB) {
                this.a = a;
                this.b = b;
            }
        }
        // @ts-expect-error Must not compile because DepB is missing
        @injectable({ inject: [ DepA ] })
        class Test2 {
            public a: DepA;
            public b: DepB;
            public constructor(a: DepA, b: DepB) {
                this.a = a;
                this.b = b;
            }
        }
        // @ts-expect-error Must not compile because dependencies are in wrong order
        @injectable({ inject: [ DepB, DepA ] })
        class Test3 {
            public a: DepA;
            public b: DepB;
            public constructor(a: DepA, b: DepB) {
                this.a = a;
                this.b = b;
            }
        }
        // @ts-expect-error Must not compile because too many dependencies are specified
        @injectable({ inject: [ DepA, DepB, DepB ] })
        class Test4 {
            public a: DepA;
            public b: DepB;
            public constructor(a: DepA, b: DepB) {
                this.a = a;
                this.b = b;
            }
        }
        // @ts-expect-error Must not compile because inject option is missing
        @injectable({})
        class Test5 {
            public a: DepA;
            public b: DepB;
            public constructor(a: DepA, b: DepB) {
                this.a = a;
                this.b = b;
            }
        }
        // @ts-expect-error Must not compile because injectable options are required
        @injectable()
        class Test6 {
            public a: DepA;
            public b: DepB;
            public constructor(a: DepA, b: DepB) {
                this.a = a;
                this.b = b;
            }
        }
        // @ts-expect-error Must not compile because decorator arguments are required
        @injectable
        class Test7 {
            public a: DepA;
            public b: DepB;
            public constructor(a: DepA, b: DepB) {
                this.a = a;
                this.b = b;
            }
        }
        // @ts-expect-error Must not compile because null inject is not allowed in singleton scope
        @injectable({ inject: [ DepA, null ] })
        class Test8 {
            public a: DepA;
            public b: DepB;
            public constructor(a: DepA, b: DepB) {
                this.a = a;
                this.b = b;
            }
        }

        // Dummy line to silence "defined but not used" warnings
        assertDefined([ Test1, Test2, Test3, Test4, Test5, Test6, Test7, Test8 ], );
    });
    it("can inject a factory method singleton with a private construct and no dependencies", () => {
        class Test {
            private static readonly value = 53;
            public value: number;
            private constructor(value: number) {
                this.value = value;
            }

            @injectable
            public static create(): Test {
                return new Test(this.value);
            }
        }
        const test = context.getSync(Test);
        assertSame(context.getSync(Test), test);
        assertSame(test.value, 53);
    });
    it("can inject a factory method singleton with private constructor and type dependencies", () => {
        class Test {
            private static readonly value = 53;
            public a: DepA;
            public b: DepB;
            public c: number;
            private constructor(a: DepA, b: DepB, c: number) {
                this.a = a;
                this.b = b;
                this.c = c;
            }

            @injectable({ inject: [ DepA, DepB ] })
            public static create(a: DepA, b: DepB): Test {
                return new Test(a, b, this.value);
            }
        }
        context.setClass(DepA);
        context.setClass(DepB);
        const test = context.getSync(Test);
        assertSame(context.getSync(Test), test);
        assertInstanceOf(test.a, DepA);
        assertInstanceOf(test.b, DepB);
        assertSame(test.c, 53);
    });
    it("can inject a factory method singleton with private constructor and named dependencies", () => {
        class Test {
            private static readonly value = 53;
            public a: DepA;
            public b: DepB;
            public c: number;
            private constructor(a: DepA, b: DepB, c: number) {
                this.a = a;
                this.b = b;
                this.c = c;
            }

            @injectable({ inject: [ "dep-a-alias", "dep-b" ] })
            public static create(a: DepA, b: DepB): Test {
                return new Test(a, b, this.value);
            }
        }
        context.setClass(DepA, { name: [ "dep-a", "dep-a-alias" ] });
        context.setClass(DepB, { name: "dep-b" });
        const test = context.getSync(Test);
        assertSame(context.getSync(Test), test);
        assertInstanceOf(test.a, DepA);
        assertInstanceOf(test.b, DepB);
        assertSame(test.c, 53);
    });
    it("can inject a factory method singleton with private constructor and mixed (type and named) dependencies", () => {
        class Test {
            private static readonly value = 53;
            public a: DepA;
            public b: DepB;
            public c: number;
            private constructor(a: DepA, b: DepB, c: number) {
                this.a = a;
                this.b = b;
                this.c = c;
            }

            @injectable({ inject: [ "dep-a", DepB ] })
            public static create(a: DepA, b: DepB): Test {
                return new Test(a, b, this.value);
            }
        }
        context.setClass(DepA, { name: "dep-a" });
        context.setClass(DepB);
        const test = context.getSync(Test);
        assertSame(context.getSync(Test), test);
        assertInstanceOf(test.a, DepA);
        assertInstanceOf(test.b, DepB);
        assertSame(test.c, 53);
    });
    it("can inject a prototype-scoped factory method", () => {
        class Test {
            private static readonly value = 23;
            public value: number;
            private constructor(value: number) {
                this.value = value;
            }

            @injectable({ scope: Scope.PROTOTYPE })
            public static create(): Test {
                return new Test(this.value);
            }
        }
        const test = context.getSync(Test);
        assertSame(test.value, 23);
        const test2 = context.getSync(Test);
        assertNotSame(test2, test);
        assertSame(test.value, 23);
    });
    it("can inject a prototype-scoped async factory method", async () => {
        class Test {
            private static readonly value = 23;
            public value: number;
            private constructor(value: number) {
                this.value = value;
            }

            @injectable({ scope: Scope.PROTOTYPE })
            public static async create(): Promise<Test> {
                return Promise.resolve(new Test(this.value));
            }
        }
        const testPromise = context.get(Test);
        assertInstanceOf(testPromise, Promise);
        const test = await testPromise;
        assertSame(test.value, 23);
        const test2Promise = context.get(Test);
        assertNotSame(test2Promise, testPromise);
        assertInstanceOf(test2Promise, Promise);
        const test2 = await test2Promise;
        assertNotSame(test2, test);
        assertSame(test.value, 23);
    });
    it("can inject an async factory method singleton", async () => {
        class Test {
            private static readonly value = 23;
            public value: number;
            private constructor(value: number) {
                this.value = value;
            }

            @injectable
            public static async create(): Promise<Test> {
                return Promise.resolve(new Test(this.value));
            }
        }
        const testPromise = context.get(Test);
        assertInstanceOf(testPromise, Promise);
        const test = await testPromise;
        assertSame(test.value, 23);
        // Fetch after promise resolve is synchronously resolvable
        const test2 = context.getSync(Test);
        assertSame(test2, test);
        assertSame(test.value, 23);
    });
    it("requires compatible inject array when factory function has dependencies", () => {
        class Test1 {
            public readonly a: DepA;
            public readonly b: DepB;

            public constructor(a: DepA, b: DepB) {
                this.a = a;
                this.b = b;
            }

            // @ts-expect-error Must not compile because inject array is empty
            @injectable({ inject: [] })
            public static create(a: DepA, b: DepB): Test1 {
                return new Test1(a, b);
            }
        }
        class Test2 {
            public readonly a: DepA;
            public readonly b: DepB;

            public constructor(a: DepA, b: DepB) {
                this.a = a;
                this.b = b;
            }

            // @ts-expect-error Must not compile because DepB is missing
            @injectable({ inject: [ DepA ] })
            public static create(a: DepA, b: DepB): Test2 {
                return new Test2(a, b);
            }
        }
        class Test3 {
            public readonly a: DepA;
            public readonly b: DepB;

            public constructor(a: DepA, b: DepB) {
                this.a = a;
                this.b = b;
            }

            // @ts-expect-error Must not compile because dependencies are in wrong order
            @injectable({ inject: [ DepB, DepA ] })
            public static create(a: DepA, b: DepB): Test3 {
                return new Test3(a, b);
            }
        }
        class Test4 {
            public readonly a: DepA;
            public readonly b: DepB;

            public constructor(a: DepA, b: DepB) {
                this.a = a;
                this.b = b;
            }

            // @ts-expect-error Must not compile because too many dependencies are specified
            @injectable({ inject: [ DepA, DepB, DepB ] })
            public static create(a: DepA, b: DepB): Test4 {
                return new Test4(a, b);
            }
        }
        class Test5 {
            public readonly a: DepA;
            public readonly b: DepB;

            public constructor(a: DepA, b: DepB) {
                this.a = a;
                this.b = b;
            }

            // @ts-expect-error Must not compile because inject option is missing
            @injectable({ inject: [] })
            public static create(a: DepA, b: DepB): Test5 {
                return new Test5(a, b);
            }
        }
        class Test6 {
            public readonly a: DepA;
            public readonly b: DepB;

            public constructor(a: DepA, b: DepB) {
                this.a = a;
                this.b = b;
            }

            // @ts-expect-error Must not compile because inject option is missing
            @injectable({})
            public static create(a: DepA, b: DepB): Test6 {
                return new Test6(a, b);
            }
        }
        class Test7 {
            public readonly a: DepA;
            public readonly b: DepB;

            public constructor(a: DepA, b: DepB) {
                this.a = a;
                this.b = b;
            }

            // @ts-expect-error Must not compile because decorator arguments are missing
            @injectable
            public static create(a: DepA, b: DepB): Test7 {
                return new Test7(a, b);
            }
        }
        class Test8 {
            public readonly a: DepA;
            public readonly b: DepB;

            public constructor(a: DepA, b: DepB) {
                this.a = a;
                this.b = b;
            }

            // @ts-expect-error Must not compile because null inject is not allowed in singleton scope
            @injectable({ inject: [ null, DepB ] })
            public static create(a: DepA, b: DepB): Test8 {
                return new Test8(a, b);
            }
        }

        // Dummy line to silence "defined but not used" warnings
        assertDefined([ Test1, Test2, Test3, Test4, Test5, Test6, Test7, Test8 ], );
    });

    it("supports pass-through parameters for synchronous prototype-scoped class", () => {
        @injectable
        class Service {
            public a = 1;
        }

        @injectable({ inject: [ null, Service, null ], scope: Scope.PROTOTYPE })
        class Component {
            public readonly param1: string;
            public readonly service: Service;
            public readonly param3: string;
            public constructor(param1: string, service: Service, param3: string) {
                this.param1 = param1;
                this.service = service;
                this.param3 = param3;
            }
        }

        const component = context.getSync(Component, [ "foo", 2 ]);
        assertSame(component.service, context.getSync(Service));
        assertSame(component.param1, "foo");
        assertSame(component.param3, 2);
    });

    it("supports pass-through parameters for asynchronous prototype-scoped class", async () => {
        class Service {
            public a = 1;

            @injectable
            public static create(): Promise<Service> {
                return Promise.resolve(new Service());
            }
        }

        class Component {
            public readonly param1: string;
            public readonly service: Service;
            public readonly param3: string;
            private constructor(param1: string, service: Service, param3: string) {
                this.param1 = param1;
                this.service = service;
                this.param3 = param3;
            }

            @injectable({ inject: [ null, Service, null ], scope: Scope.PROTOTYPE })
            public static create(param1: string, service: Service, param3: string): Promise<Component> {
                return Promise.resolve(new Component(param1, service, param3));
            }
        }

        const component = await context.getAsync(Component, [ "foo", 2 ]);
        assertSame(component.service, context.getSync(Service));
        assertSame(component.param1, "foo");
        assertSame(component.param3, 2);
    });
});
