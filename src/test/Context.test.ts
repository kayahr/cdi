/*
 * Copyright (C) 2025 Klaus Reimer <k@ailis.de>
 * See LICENSE.md for licensing information
 */


import { beforeEach, describe, it } from "node:test";
import { assertEquals, assertInstanceOf, assertNotSame, assertSame, assertThrowWithMessage } from "@kayahr/assert";
import { Context } from "../main/Context.ts";
import { InjectionError } from "../main/InjectionError.ts";
import { qualify } from "../main/QualifiedType.ts";
import { Scope } from "../main/Scope.ts";

class DepA { public a = 1; };
class DepB { public b = 2; };

const divide = (dividend: number, divisor: number) => dividend / divisor;
const multiply = (a: number, b: number) => a * b;

describe("Context", () => {
    let context: Context;
    beforeEach(() => {
        context = Context.getRoot().createChildContext();
        context.activate();
    });
    it("owning context can be injected into a class", () => {
        const context1 = context.createChildContext();
        const context2 = context1.createChildContext();
        class Test {
            public readonly context: Context;
            public constructor(context: Context) {
                this.context = context;
            }
        }
        context1.setClass(Test, { inject: [ Context ] });
        const test = context2.getSync(Test);
        assertSame(test.context, context1);
    });
    it("owning context can be injected into a factory method", () => {
        const context1 = context.createChildContext();
        const context2 = context1.createChildContext();
        class Test {
            public readonly context: Context;
            public constructor(context: Context) {
                this.context = context;
            }
            public static create(context: Context) {
                return new Test(context);
            }
        }
        context1.setFactory(Test, Test.create, { inject: [ Context ] });
        const test = context2.getSync(Test);
        assertSame(test.context, context1);
    });
    describe("activate", () => {
        it("activates the context", () => {
            const context1 = context.createChildContext();
            const context2 = context.createChildContext();
            context1.activate();
            assertSame(Context.getActive(), context1);
            context2.activate();
            assertSame(Context.getActive(), context2);
        });
        it("returns the previous context", () => {
            const context1 = context.createChildContext();
            const context2 = context.createChildContext();
            assertSame(context1.activate(), context);
            assertSame(context2.activate(), context1);
            assertSame(context.activate(), context2);
        });
    });
    describe("getRoot", () => {
        it("returns the root context", () => {
            const root = Context.getRoot();
            assertSame(root.getParent(), null);
        });
    });
    describe("isActive", () => {
        it("checks if context is active", () => {
            const level1 = context.createChildContext();
            const level2 = context.createChildContext();
            assertSame(level1.isActive(), false);
            assertSame(level2.isActive(), false);
            level1.activate();
            assertSame(level1.isActive(), true);
            assertSame(level2.isActive(), false);
            level2.activate();
            assertSame(level1.isActive(), false);
            assertSame(level2.isActive(), true);
        });
    });
    describe("injectClass", () => {
        it("can inject a singleton class with no dependencies", () => {
            class Test {
                public value = 53;
            }
            context.setClass(Test);
            const test = context.getSync(Test);
            assertSame(context.getSync(Test), test);
            assertSame(test.value, 53);
        });
        it("can inject a singleton class with type dependencies", () => {
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
            context.setClass(Test, { inject: [ DepA, DepB ] });
            const test = context.getSync(Test);
            assertSame(context.getSync(Test), test);
            assertInstanceOf(test.a, DepA);
            assertInstanceOf(test.b, DepB);
        });
        it("can inject a singleton class with named dependencies", () => {
            class Test {
                public a: DepA;
                public b: DepB;
                public constructor(a: DepA, b: DepB) {
                    this.a = a;
                    this.b = b;
                }
            }
            const depBAlias = Symbol("dep-b-alias");
            context.setClass(DepA, { name: "dep-a" });
            context.setClass(DepB, { name: [ "dep-b", depBAlias ] });
            context.setClass(Test, { inject: [ "dep-a", depBAlias ] });
            const test = context.getSync(Test);
            assertSame(context.getSync(Test), test);
            assertInstanceOf(test.a, DepA);
            assertInstanceOf(test.b, DepB);
        });
        it("can inject a singleton class with mixed (type and named) dependencies", () => {
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
            context.setClass(Test, { inject: [ "dep-a", DepB ] });
            const test = context.getSync(Test);
            assertSame(context.getSync(Test), test);
            assertInstanceOf(test.a, DepA);
            assertInstanceOf(test.b, DepB);
        });
        it("can inject a prototype-scoped class", () => {
            class Test { public value = 23; }
            context.setClass(Test, { scope: Scope.PROTOTYPE });
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
                public static async create(): Promise<AsyncDep> {
                    return Promise.resolve(new AsyncDep(23));
                }
            }
            class Test {
                private readonly asyncDep: AsyncDep;
                public constructor(asyncDep: AsyncDep) {
                    this.asyncDep = asyncDep;
                }
                public getValue(): number {
                    return this.asyncDep.value;
                }
            }
            context.setFactory(AsyncDep, AsyncDep.create);
            context.setClass(Test, { inject: [ AsyncDep ] });
            const testPromise = context.get(Test);
            assertInstanceOf(testPromise, Promise);
            const test = await testPromise;
            assertSame(test.getValue(), 23);
            // After promise resolve dependency can be resolved synchronously
            const test2 = context.getSync(Test);
            assertSame(test2, test);
        });
        it("can inject a synchronous class dependency with pass-through parameters", () => {
            class Component {
                public readonly param1: string;
                public readonly service: DepA;
                public readonly param3: string;
                public constructor(param1: string, service: DepA, param3: string) {
                    this.param1 = param1;
                    this.service = service;
                    this.param3 = param3;
                }
            }
            context.setClass(DepA);
            context.setClass(Component, { inject: [ null, DepA, null ], scope: Scope.PROTOTYPE });
            const component = context.getSync(Component, [ "foo", 2 ]);
            assertSame(component.service, context.getSync(DepA));
            assertSame(component.param1, "foo");
            assertSame(component.param3, 2);
        });
        it("requires compatible inject array when class has dependencies", () => {
            class Test {
                public a: DepA;
                public b: DepB;
                public constructor(a: DepA, b: DepB) {
                    this.a = a;
                    this.b = b;
                }
            }
            // @ts-expect-error Must not compile because inject array is empty
            context.setClass(Test, { inject: [] });
            // @ts-expect-error Must not compile because DepB is missing
            context.setClass(Test, { inject: [ DepA ] });
            // @ts-expect-error Must not compile because dependencies are in wrong order
            context.setClass(Test, { inject: [ DepB, DepA ] });
            // @ts-expect-error Must not compile because too many dependencies are specified
            context.setClass(Test, { inject: [ DepA, DepB, DepB ] });
            // @ts-expect-error Must not compile because null is not allowed in singleton-scoped dependency
            context.setClass(Test, { inject: [ null, DepB ] });
            // @ts-expect-error Must not compile because inject option is missing
            context.setClass(Test, {});
            // @ts-expect-error Must not compile because inject options are required
            context.setClass(Test);
        });
    });
    describe("injectFactory", () => {
        it("can inject a factory function singleton with no dependencies", () => {
            class Test {
                public value = 53;
            }
            function factory(): Test {
                return new Test();
            }
            context.setFactory(Test, factory);
            const test = context.getSync(Test);
            assertSame(context.getSync(Test), test);
            assertSame(test.value, 53);
        });
        it("can inject a factory method singleton with a private construct and no dependencies", () => {
            class Test {
                private static readonly value = 53;
                public value: number;
                private constructor(value: number) {
                    this.value = value;
                }
                public static create(): Test {
                    return new Test(this.value);
                }
            }
            context.setFactory(Test, Test.create);
            const test = context.getSync(Test);
            assertSame(context.getSync(Test), test);
            assertSame(test.value, 53);
        });
        it("can inject a factory function singleton with type dependencies", () => {
            class Test {
                public a: DepA;
                public b: DepB;
                public constructor(a: DepA, b: DepB) {
                    this.a = a;
                    this.b = b;
                }
            }
            function factory(a: DepA, b: DepB): Test {
                return new Test(a, b);
            }
            context.setClass(DepA);
            context.setClass(DepB);
            context.setFactory(Test, factory, { inject: [ DepA, DepB ] });
            const test = context.getSync(Test);
            assertSame(context.getSync(Test), test);
            assertInstanceOf(test.a, DepA);
            assertInstanceOf(test.b, DepB);
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
                public static create(a: DepA, b: DepB): Test {
                    return new Test(a, b, this.value);
                }
            }
            context.setClass(DepA);
            context.setClass(DepB);
            context.setFactory(Test, Test.create, { inject: [ DepA, DepB ] });
            const test = context.getSync(Test);
            assertSame(context.getSync(Test), test);
            assertInstanceOf(test.a, DepA);
            assertInstanceOf(test.b, DepB);
            assertSame(test.c, 53);
        });
        it("can inject a factory function singleton with named dependencies", () => {
            class Test {
                public a: DepA;
                public b: DepB;
                public constructor(a: DepA, b: DepB) {
                    this.a = a;
                    this.b = b;
                }
            }
            function factory(a: DepA, b: DepB): Test {
                return new Test(a, b);
            }
            context.setClass(DepA, { name: "dep-a" });
            context.setClass(DepB, { name: [ "dep-b", "dep-b-alias" ] });
            context.setFactory(Test, factory, { inject: [ "dep-a", "dep-b-alias" ] });
            const test = context.getSync(Test);
            assertSame(context.getSync(Test), test);
            assertInstanceOf(test.a, DepA);
            assertInstanceOf(test.b, DepB);
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
                public static create(a: DepA, b: DepB): Test {
                    return new Test(a, b, this.value);
                }
            }
            const depB = Symbol("dep-b");
            context.setClass(DepA, { name: [ "dep-a", "dep-a-alias" ] });
            context.setClass(DepB, { name: depB });
            context.setFactory(Test, Test.create, { inject: [ "dep-a-alias", depB ] });
            const test = context.getSync(Test);
            assertSame(context.getSync(Test), test);
            assertInstanceOf(test.a, DepA);
            assertInstanceOf(test.b, DepB);
            assertSame(test.c, 53);
        });
        it("can inject a factory function singleton with mixed (type and named) dependencies", () => {
            class Test {
                public a: DepA;
                public b: DepB;
                public constructor(a: DepA, b: DepB) {
                    this.a = a;
                    this.b = b;
                }
            }
            function factory(a: DepA, b: DepB): Test {
                return new Test(a, b);
            }
            context.setClass(DepA);
            context.setClass(DepB, { name: "dep-b" });
            context.setFactory(Test, factory, { inject: [ DepA, "dep-b" ] });
            const test = context.getSync(Test);
            assertSame(context.getSync(Test), test);
            assertInstanceOf(test.a, DepA);
            assertInstanceOf(test.b, DepB);
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
                public static create(a: DepA, b: DepB): Test {
                    return new Test(a, b, this.value);
                }
            }
            context.setClass(DepA, { name: "dep-a" });
            context.setClass(DepB);
            context.setFactory(Test, Test.create, { inject: [ "dep-a", DepB ] });
            const test = context.getSync(Test);
            assertSame(context.getSync(Test), test);
            assertInstanceOf(test.a, DepA);
            assertInstanceOf(test.b, DepB);
            assertSame(test.c, 53);
        });
        it("can inject a prototype-scoped factory function", () => {
            class Test {
                public value: number;
                public constructor(value: number) {
                    this.value = value;
                }
            }
            function create(): Test {
                return new Test(23);
            }
            context.setFactory(Test, create, { scope: Scope.PROTOTYPE });
            const test = context.getSync(Test);
            assertSame(test.value, 23);
            const test2 = context.getSync(Test);
            assertNotSame(test2, test);
            assertSame(test.value, 23);
        });
        it("can inject a prototype-scoped factory method", () => {
            class Test {
                private static readonly value = 23;
                public value: number;
                private constructor(value: number) {
                    this.value = value;
                }
                public static create(): Test {
                    return new Test(this.value);
                }
            }
            context.setFactory(Test, Test.create, { scope: Scope.PROTOTYPE });
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
                public static async create(): Promise<Test> {
                    return Promise.resolve(new Test(this.value));
                }
            }
            context.setFactory(Test, Test.create, { scope: Scope.PROTOTYPE });
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
                public static async create(): Promise<Test> {
                    return Promise.resolve(new Test(this.value));
                }
            }
            context.setFactory(Test, Test.create);
            const testPromise = context.get(Test);
            assertInstanceOf(testPromise, Promise);
            const test = await testPromise;
            assertSame(test.value, 23);
            // Fetch after promise resolve is synchronously resolvable
            const test2 = context.getSync(Test);
            assertSame(test2, test);
            assertSame(test.value, 23);
        });
        it("can inject a prototype-scoped async factory function", async () => {
            class Test {
                public value: number;
                public constructor(value: number) {
                    this.value = value;
                }
            }
            async function create(): Promise<Test> {
                return Promise.resolve(new Test(53));
            }
            context.setFactory(Test, create, { scope: Scope.PROTOTYPE });
            const testPromise = context.get(Test);
            assertInstanceOf(testPromise, Promise);
            const test = await testPromise;
            assertSame(test.value, 53);
            const test2Promise = context.get(Test);
            assertNotSame(test2Promise, testPromise);
            assertInstanceOf(test2Promise, Promise);
            const test2 = await test2Promise;
            assertNotSame(test2, test);
            assertSame(test.value, 53);
        });
        it("can inject an async factory function singleton", async () => {
            class Test {
                public value: number;
                public constructor(value: number) {
                    this.value = value;
                }
            }
            async function create(): Promise<Test> {
                return Promise.resolve(new Test(53));
            }
            context.setFactory(Test, create);
            const testPromise = context.get(Test);
            assertInstanceOf(testPromise, Promise);
            const test = await testPromise;
            assertSame(test.value, 53);
            // Fetch after promise resolve is synchronously resolvable
            const test2 = context.getSync(Test);
            assertSame(test2, test);
            assertSame(test.value, 53);
        });
        it("can inject a synchronous class dependency with pass-through parameters", () => {
            class Component {
                public readonly param1: string;
                public readonly service: DepA;
                public readonly param3: string;
                private constructor(param1: string, service: DepA, param3: string) {
                    this.param1 = param1;
                    this.service = service;
                    this.param3 = param3;
                }

                public static create(param1: string, service: DepA, param3: string): Component {
                    return new Component(param1, service, param3);
                }
            }
            context.setClass(DepA);
            context.setFactory(Component, Component.create, { inject: [ null, DepA, null ], scope: Scope.PROTOTYPE });
            const component = context.getSync(Component, [ "foo", 2 ]);
            assertSame(component.service, context.getSync(DepA));
            assertSame(component.param1, "foo");
            assertSame(component.param3, 2);
        });
        it("can inject a asynchronous class dependency with pass-through parameters", async () => {
            class Component {
                public readonly param1: string;
                public readonly service: DepA;
                public readonly param3: string;
                private constructor(param1: string, service: DepA, param3: string) {
                    this.param1 = param1;
                    this.service = service;
                    this.param3 = param3;
                }

                public static create(param1: string, service: DepA, param3: string): Promise<Component> {
                    return Promise.resolve(new Component(param1, service, param3));
                }
            }
            context.setClass(DepA);
            context.setFactory(Component, Component.create, { inject: [ null, DepA, null ], scope: Scope.PROTOTYPE });
            const component = await context.getAsync(Component, [ "foo", 2 ]);
            assertSame(component.service, context.getSync(DepA));
            assertSame(component.param1, "foo");
            assertSame(component.param3, 2);
        });
        it("requires compatible inject array when factory function has dependencies", () => {
            class Test {
                public readonly a: DepA;
                public readonly b: DepB;
                constructor(a: DepA, b: DepB) {
                    this.a = a;
                    this.b = b;
                }
            }
            function create(a: DepA, b: DepB): Test {
                return new Test(a, b);
            }
            // @ts-expect-error Must not compile because inject array is empty
            context.setFactory(Test, create, { inject: [] });
            // @ts-expect-error Must not compile because DepB is missing
            context.setFactory(Test, create, { inject: [ DepA ] });
            // @ts-expect-error Must not compile because dependencies are in wrong order
            context.setFactory(Test, create, { inject: [ DepB, DepA ] });
            // @ts-expect-error Must not compile because null inject is not allowed
            context.setFactory(Test, create, { inject: [ DepA, null ] });
            // @ts-expect-error Must not compile because null inject is not allowed
            context.setFactory(Test, create, { inject: [ DepA, null ] });
            // @ts-expect-error Must not compile because too many dependencies are specified
            context.setFactory(Test, create, { inject: [ DepA, DepB, DepB ] });
            // @ts-expect-error Must not compile because null is not allowed in singleton-scoped dependency
            context.setFactory(Test, create, { inject: [ null, DepB ] });
            // @ts-expect-error Must not compile because inject option is missing
            context.setFactory(Test, create, {});
            // @ts-expect-error Must not compile because inject options are required
            context.setFactory(Test, create);
        });
    });
    describe("injectValue", () => {
        it("injects a string with a single name", () => {
            context.setValue("foo", "name");
            assertSame(context.get("name"), "foo");
        });
        it("injects a string with a single symbol", () => {
            const foo = Symbol("foo");
            context.setValue("foo", foo);
            assertSame(context.get(foo), "foo");
        });
        it("injects a string with a single name given as array", () => {
            context.setValue("foo", [ "name-1" ]);
            assertSame(context.get("name-1"), "foo");
        });
        it("injects a string with multiple names given as array", () => {
            const name2 = Symbol("name-2");
            context.setValue("foo", [ "name-1", name2 ]);
            assertSame(context.get("name-1"), "foo");
            assertSame(context.get(name2), "foo");
        });
        it("injects a class instance with name", () => {
            class Test {
                public a = 1;
            }
            const test = new Test();
            context.setValue(test, "test");
            assertSame(context.get(Test), test);
            assertSame(context.get("test"), test);
        });
        it("injects a class instance without names (type only)", () => {
            class Test {
                public a = 1;
            }
            const test = new Test();
            context.setValue(test);
            assertSame(context.get(Test), test);
        });
    });
    describe("injectFunction", () => {
        it("injects a function without parameters (makes no sense, but should work anyway)", ctx => {
            const spy = ctx.mock.fn();
            function callSpy() {
                spy();
            }
            context.setFunction(callSpy, []);
            const test = context.getSync(callSpy);
            assertSame(spy.mock.callCount(), 0);
            test();
            assertSame(spy.mock.callCount(), 1);
            test();
            test();
            assertSame(spy.mock.callCount(), 3);
        });
        it("injects a function with pass-through parameters only (makes no sense, but should work anyway)", ctx => {
            const spy = ctx.mock.fn();
            function callSpy(a: number, b: string) {
                spy(a, b);
            }
            context.setFunction(callSpy, [ null, null ]);
            const test = context.getSync(callSpy);
            test(1, "test");
            assertSame(spy.mock.callCount(), 1);
            assertEquals(spy.mock.calls[0].arguments, [ 1, "test" ]);
        });
        it("injects a function with injected parameters only", ctx => {
            const spy = ctx.mock.fn();
            function callSpy(a: number, b: string) {
                spy(a, b);
            }
            context.setValue(2, "a");
            context.setValue("foo", "b");
            context.setFunction(callSpy, [ "a", "b" ]);
            const test = context.getSync(callSpy);
            test(1, "test");
            assertSame(spy.mock.callCount(), 1);
            assertEquals(spy.mock.calls[0].arguments, [ 2, "foo" ]);
        });
        it("injects a function with injected and pass-through parameters", ctx => {
            const spy = ctx.mock.fn();
            function callSpy(a: number, b: string, c: number, d: string) {
                spy(a, b, c, d);
            }
            context.setValue(2, "a");
            context.setValue(3, "b");
            context.setFunction(callSpy, [ "a", null, "b", null ]);
            const test = context.getSync(callSpy);
            test("foo", "bar");
            assertSame(spy.mock.callCount(), 1);
            assertEquals(spy.mock.calls[0].arguments, [ 2, "foo", 3, "bar" ]);
        });
        it("injects the function as singleton", () => {
            function callSpy() {}
            context.setFunction(callSpy, []);
            const test = context.getSync(callSpy);
            assertSame(test, context.getSync(callSpy));
        });
        it("infers return type but cannot infer param types", () => {
            function createNumber(): number {
                return 2;
            }
            context.setFunction(createNumber, []);
            const test = context.getSync(createNumber);
            assertSame(test("ignored", "also ignored").toFixed(2), "2.00");
        });
        it("injects function with single string-named qualifier", ctx => {
            const spy = ctx.mock.fn();
            function callSpy() { spy(); }
            context.setFunction(callSpy, [], "single-name");
            const test = context.getSync<() => unknown>("single-name");
            test();
            assertSame(spy.mock.callCount(), 1);
        });
        it("injects function with single symbol-named qualifier", ctx => {
            const spy = ctx.mock.fn();
            function callSpy() { spy(); }
            const name = Symbol("single-name");
            context.setFunction(callSpy, [], name);
            const test = context.getSync<() => unknown>(name);
            test();
            assertSame(spy.mock.callCount(), 1);
        });
        it("injects function with multiple names", ctx => {
            const spy = ctx.mock.fn();
            function callSpy() { spy(); }
            const name2 = Symbol("name2");
            context.setFunction(callSpy, [], [ "name1", name2 ]);
            const test = context.getSync<() => unknown>("name1");
            test();
            assertSame(spy.mock.callCount(), 1);
            assertSame(context.getSync(name2), test);
        });
        it("injects function which can be injected into a class", () => {
            const divide = (dividend: number, divisor: number) => dividend / divisor;
            context.setValue(10, "divisor");
            context.setFunction(divide, [ null, "divisor" ]);
            class Test {
                private readonly dividend: number;
                private readonly divide: (dividend: number) => number;
                public constructor(dividend: number, divide: (dividend: number) => number) {
                    this.dividend = dividend;
                    this.divide = divide;
                }
                public run(): number {
                    return this.divide(this.dividend);
                }
            }
            context.setValue(200, "dividend");
            context.setClass(Test, { inject: [ "dividend", divide ] });
            const test = context.getSync(Test);
            assertSame(test.run(), 20);
        });
        it("injects function which can be injected into a factory", () => {
            context.setValue(10, "divisor");
            context.setFunction(divide, [ null, "divisor" ]);
            class Test {
                private readonly dividend: number;
                private readonly divide: (dividend: number) => number;
                private constructor(dividend: number, divide: (dividend: number) => number) {
                    this.dividend = dividend;
                    this.divide = divide;
                }

                public static create(dividend: number, divide: (dividend: number) => number) {
                    return new Test(dividend, divide);
                }

                public run(): number {
                    return this.divide(this.dividend);
                }
            }
            context.setValue(200, "dividend");
            context.setFactory(Test, Test.create, { inject: [ "dividend", divide ] });
            const test = context.getSync(Test);
            assertSame(test.run(), 20);
        });
        it("can inject a function with asynchronous dependencies", async () => {
            context.setFactory(Number, async () => 10, { name: "factor" });
            context.setFunction(multiply, [ null, "factor" ]);
            const testPromise = context.get(multiply);
            assertInstanceOf(testPromise, Promise);
            const test = await testPromise;
            assertSame(test(2), 20);
            assertSame(test(3), 30);
            // Next resolve returns sync function
            assertSame(context.get(multiply), test);
        });
    });
    describe("get", () => {
        it("returns dependency from parent scope if not found in current scope", () => {
            context.setValue("root", "test");
            const childContext = context.createChildContext();
            childContext.activate();
            assertSame(childContext.get("test"), "root");
        });
        it("throws error when typed dependency was not found", () => {
            class Test {
                public a = 1;
            }
            assertThrowWithMessage(() => context.get(Test), InjectionError, "Dependency <Test> not found");
        });
        it("throws error when string-named dependency was not found", () => {
            assertThrowWithMessage(() => context.get("test"), InjectionError, "Dependency 'test' not found");
        });
        it("throws error when symbol-named dependency was not found", () => {
            assertThrowWithMessage(() => context.get(Symbol("test")), InjectionError, "Dependency Symbol(test) not found");
        });
        it("throws error when qualified type was not found", () => {
            class Test {
                public a = 1;
            }
            assertThrowWithMessage(() => context.get(qualify(Test, "foo")), InjectionError, "Dependency <Test:foo> not found");
            assertThrowWithMessage(() => context.get(qualify(Test, Symbol("foo"))), InjectionError, "Dependency <Test:Symbol(foo)> not found");
        });
        it("throws error when dependency needs pass-through parameters but none given", () => {
            class Test {
                public a: string;
                public constructor(a: string) {
                    this.a = a;
                }
            }
            context.setClass(Test, { inject: [ null ], scope: Scope.PROTOTYPE });
            assertThrowWithMessage(() => context.get(Test), InjectionError, "Pass-through parameter 1 not found for dependency <Test>");
        });
        it("throws error when dependency needs pass-through parameters but not enough given", () => {
            class Test {
                public a: string;
                public b: string;
                public constructor(a: string, b: string) {
                    this.a = a;
                    this.b = b;
                }
            }
            context.setClass(Test, { inject: [ null, null ], scope: Scope.PROTOTYPE });
            assertThrowWithMessage(() => context.get(Test, [ "test" ]), InjectionError, "Pass-through parameter 2 not found for dependency <Test>");
        });
    });
    describe("getAsync", () => {
        it("returns promise for async dependency", async () => {
            class Test {
                public a = 1;
                public static async create(): Promise<Test> {
                    return Promise.resolve(new Test());
                }
            }
            context.setFactory(Test, Test.create);
            const testPromise = context.getAsync(Test);
            assertInstanceOf(testPromise, Promise);
            const test = await testPromise;
            assertInstanceOf(test, Test);
        });
        it("returns promise for sync dependency", async () => {
            class Test {
                public a = 1;
            }
            context.setClass(Test);
            const testPromise = context.getAsync(Test);
            assertInstanceOf(testPromise, Promise);
            const test = await testPromise;
            assertInstanceOf(test, Test);
        });
        it("throws error when typed dependency was not found", async () => {
            class Test {
                public a = 1;
            }
            await assertThrowWithMessage(() => context.getAsync(Test), InjectionError, "Dependency <Test> not found");
        });
        it("throws error when string-named dependency was not found", async () => {
            await assertThrowWithMessage(() => context.getAsync("test"), InjectionError, "Dependency 'test' not found");
        });
        it("throws error when symbol-named dependency was not found", async () => {
            await assertThrowWithMessage(() => context.getAsync(Symbol("test")), InjectionError, "Dependency Symbol(test) not found");
        });
    });
    describe("getSync", () => {
        it("throws error when dependency is async", () => {
            class Test {
                public a = 1;
                public static async create(): Promise<Test> {
                    return Promise.resolve(new Test());
                }
            }
            context.setFactory(Test, Test.create);
            assertThrowWithMessage(() => context.getSync(Test), InjectionError,  "Asynchronous dependency <Test> can not be resolved synchronously");
        });
        it("returns sync dependency", () => {
            class Test {
                public a = 1;
            }
            context.setClass(Test);
            const test = context.getSync(Test);
            assertInstanceOf(test, Test);
        });
        it("throws error when typed dependency was not found", () => {
            class Test {
                public a = 1;
            }
            assertThrowWithMessage(() => context.getSync(Test), InjectionError, "Dependency <Test> not found");
        });
        it("throws error when string-named dependency was not found", () => {
            assertThrowWithMessage(() => context.getSync("test"), InjectionError, "Dependency 'test' not found");
        });
        it("throws error when symbol-named dependency was not found", () => {
            assertThrowWithMessage(() => context.getSync(Symbol("test")), InjectionError, "Dependency Symbol(test) not found");
        });
    });
    describe("has", () => {
        it("returns false if context does not know the given qualifier", () => {
            class Test {
                public a = 1;
            }
            function test() {
                return Test;
            }
            assertSame(context.has(Test), false);
            assertSame(context.has(test), false);
            assertSame(context.has("test"), false);
            assertSame(context.has(qualify(Test, "test")), false);
        });
        it("returns false if context and its parent does not know the given qualifier", () => {
            class Test {
                public a = 1;
            }
            function test() {
                return Test;
            }
            const childContext = context.createChildContext();
            assertSame(childContext.has(Test), false);
            assertSame(childContext.has(test), false);
            assertSame(childContext.has("test"), false);
            assertSame(childContext.has(qualify(Test, "test")), false);
        });
        it("returns true if context knows the given qualifier", () => {
            class Test {
                public a = 1;
            }
            context.setClass(Test);
            context.setClass(Test, { name: "test" });
            function test() {
                return Test
            }
            context.setFunction(test, []);
            context.setValue(53, "test");
            assertSame(context.has(Test), true);
            assertSame(context.has(test), true);
            assertSame(context.has("test"), true);
            assertSame(context.has(qualify(Test, "test")), true);
        });
        it("returns true if parent context knows the given qualifier", () => {
            class Test {
                public a = 1;
            }
            context.setClass(Test);
            context.setClass(Test, { name: "test" });
            function test() {
                return Test;
            }
            context.setFunction(test, []);
            context.setValue(53, "test");
            const childContext = context.createChildContext();
            assertSame(childContext.has(Test), true);
            assertSame(childContext.has(test), true);
            assertSame(childContext.has("test"), true);
            assertSame(childContext.has(qualify(Test, "test")), true);
        });
    });
    describe("remove", () => {
        it("removes a named dependency from the context", () => {
            context.setValue(1, "test");
            assertSame(context.has("test"), true);
            assertSame(context.remove("test"), true);
            assertSame(context.has("test"), false);
        });
        it("removes a typed dependency from the context", () => {
            class Test {
                public a = 1;
            }
            context.setClass(Test);
            assertSame(context.has(Test), true);
            assertSame(context.remove(Test), true);
            assertSame(context.has(Test), false);
        });
        it("removes a qualified typed dependency from the context", () => {
            class Test {
                public a = 1;
            }
            context.setClass(Test, { name: "test" });
            assertSame(context.has(Test), true);
            assertSame(context.has("test"), true);
            assertSame(context.has(qualify(Test, "test")), true);
            assertSame(context.remove(qualify(Test, "test")), true);
            assertSame(context.has(Test), true);
            assertSame(context.has("test"), true);
            assertSame(context.has(qualify(Test, "test")), false);
        });
        it("returns false if dependency was not found", () => {
            assertSame(context.remove("test"), false);
        });
        it("does not remove dependency in parent", () => {
            context.setValue(1, "test");
            const childContext = context.createChildContext();
            assertSame(childContext.remove("test"), false);
            assertSame(context.has("test"), true);
        });
    });
    describe("findContext", () => {
        it("returns context if it contains the qualifier", () => {
            class Test {
                public a = 1;
            }
            context.setClass(Test, { name: "test" });
            assertSame(context.findContext("test"), context);
            assertSame(context.findContext(Test), context);
            assertSame(context.findContext(qualify(Test, "test")), context);
        });
        it("returns parent context if not found in this context but in parent context", () => {
            class Test {
                public a = 1;
            }
            context.setClass(Test, { name: "test" });
            const childContext = context.createChildContext();
            assertSame(childContext.findContext("test"), context);
            assertSame(childContext.findContext(Test), context);
            assertSame(childContext.findContext(qualify(Test, "test")), context);
        });
        it("returns null if not found in this context and not in parent context", () => {
            const childContext = context.createChildContext();
            assertSame(childContext.findContext("test"), null);
            assertSame(context.findContext("test"), null);
        });
    });
});
