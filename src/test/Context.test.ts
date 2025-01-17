/*
 * Copyright (C) 2025 Klaus Reimer <k@ailis.de>
 * See LICENSE.md for licensing information
 */

import "@kayahr/vitest-matchers";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { Context } from "../main/Context.js";
import { InjectionError } from "../main/InjectionError.js";
import { qualify } from "../main/QualifiedType.js";
import { Scope } from "../main/Scope.js";

class DepA { public a = 1; };
class DepB { public b = 2; };

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
            public constructor(public readonly context: Context) {}
        }
        context1.setClass(Test, { inject: [ Context ] });
        const test = context2.getSync(Test);
        expect(test.context).toBe(context1);
    });
    it("owning context can be injected into a factory method", () => {
        const context1 = context.createChildContext();
        const context2 = context1.createChildContext();
        class Test {
            public constructor(public readonly context: Context) {}
            public static create(context: Context) {
                return new Test(context);
            }
        }
        context1.setFactory(Test, Test.create, { inject: [ Context ] });
        const test = context2.getSync(Test);
        expect(test.context).toBe(context1);
    });
    describe("activate", () => {
        it("activates the context", () => {
            const context1 = context.createChildContext();
            const context2 = context.createChildContext();
            context1.activate();
            expect(Context.getActive()).toBe(context1);
            context2.activate();
            expect(Context.getActive()).toBe(context2);
        });
        it("returns the previous context", () => {
            const context1 = context.createChildContext();
            const context2 = context.createChildContext();
            expect(context1.activate()).toBe(context);
            expect(context2.activate()).toBe(context1);
            expect(context.activate()).toBe(context2);
        });
    });
    describe("getRoot", () => {
        it("returns the root context", () => {
            const root = Context.getRoot();
            expect(root.getParent()).toBe(null);
        });
    });
    describe("isActive", () => {
        it("checks if context is active", () => {
            const level1 = context.createChildContext();
            const level2 = context.createChildContext();
            expect(level1.isActive()).toBe(false);
            expect(level2.isActive()).toBe(false);
            level1.activate();
            expect(level1.isActive()).toBe(true);
            expect(level2.isActive()).toBe(false);
            level2.activate();
            expect(level1.isActive()).toBe(false);
            expect(level2.isActive()).toBe(true);
        });
    });
    describe("injectClass", () => {
        it("can inject a singleton class with no dependencies", () => {
            class Test {
                public value = 53;
            }
            context.setClass(Test);
            const test = context.getSync(Test);
            expect(context.getSync(Test)).toBe(test);
            expect(test.value).toBe(53);
        });
        it("can inject a singleton class with type dependencies", () => {
            class Test {
                public constructor(public a: DepA, public b: DepB) {}
            }
            context.setClass(DepA);
            context.setClass(DepB);
            context.setClass(Test, { inject: [ DepA, DepB ] });
            const test = context.getSync(Test);
            expect(context.getSync(Test)).toBe(test);
            expect(test.a).toBeInstanceOf(DepA);
            expect(test.b).toBeInstanceOf(DepB);
        });
        it("can inject a singleton class with named dependencies", () => {
            class Test {
                public constructor(public a: DepA, public b: DepB) {}
            }
            const depBAlias = Symbol("dep-b-alias");
            context.setClass(DepA, { name: "dep-a" });
            context.setClass(DepB, { name: [ "dep-b", depBAlias ] });
            context.setClass(Test, { inject: [ "dep-a", depBAlias ] });
            const test = context.getSync(Test);
            expect(context.getSync(Test)).toBe(test);
            expect(test.a).toBeInstanceOf(DepA);
            expect(test.b).toBeInstanceOf(DepB);
        });
        it("can inject a singleton class with mixed (type and named) dependencies", () => {
            class Test {
                public constructor(public a: DepA, public b: DepB) {}
            }
            context.setClass(DepA, { name: "dep-a" });
            context.setClass(DepB);
            context.setClass(Test, { inject: [ "dep-a", DepB ] });
            const test = context.getSync(Test);
            expect(context.getSync(Test)).toBe(test);
            expect(test.a).toBeInstanceOf(DepA);
            expect(test.b).toBeInstanceOf(DepB);
        });
        it("can inject a prototype-scoped class", () => {
            class Test { public value = 23; }
            context.setClass(Test, { scope: Scope.PROTOTYPE });
            const test = context.getSync(Test);
            expect(test.value).toBe(23);
            const test2 = context.getSync(Test);
            expect(test2).not.toBe(test);
            expect(test.value).toBe(23);
        });
        it("can inject a class which depends on asynchronous dependency", async () => {
            class AsyncDep {
                private constructor(public readonly value: number) {}
                public static async create(): Promise<AsyncDep> {
                    return Promise.resolve(new AsyncDep(23));
                }
            }
            class Test {
                public constructor(private readonly asyncDep: AsyncDep) {}
                public getValue(): number {
                    return this.asyncDep.value;
                }
            }
            context.setFactory(AsyncDep, AsyncDep.create);
            context.setClass(Test, { inject: [ AsyncDep ] });
            const testPromise = context.get(Test);
            expect(testPromise).toBeInstanceOf(Promise);
            const test = await testPromise;
            expect(test.getValue()).toBe(23);
            // After promise resolve dependency can be resolved synchronously
            const test2 = context.getSync(Test);
            expect(test2).toBe(test);
        });
        it("can inject a synchronous class dependency with pass-through parameters", () => {
            class Component {
                public constructor(
                    public readonly param1: string,
                    public readonly service: DepA,
                    public readonly param3: string
                ) {}
            }
            context.setClass(DepA);
            context.setClass(Component, { inject: [ null, DepA, null ], scope: Scope.PROTOTYPE });
            const component = context.getSync(Component, [ "foo", 2 ]);
            expect(component.service).toBe(context.getSync(DepA));
            expect(component.param1).toBe("foo");
            expect(component.param3).toBe(2);
        });
        it("requires compatible inject array when class has dependencies", () => {
            class Test {
                public constructor(public a: DepA, public b: DepB) {}
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
            expect(context.getSync(Test)).toBe(test);
            expect(test.value).toBe(53);
        });
        it("can inject a factory method singleton with a private construct and no dependencies", () => {
            class Test {
                private static readonly value = 53;
                private constructor(public value: number) {}
                public static create(): Test {
                    return new Test(this.value);
                }
            }
            context.setFactory(Test, Test.create);
            const test = context.getSync(Test);
            expect(context.getSync(Test)).toBe(test);
            expect(test.value).toBe(53);
        });
        it("can inject a factory function singleton with type dependencies", () => {
            class Test {
                public constructor(public a: DepA, public b: DepB) {}
            }
            function factory(a: DepA, b: DepB): Test {
                return new Test(a, b);
            }
            context.setClass(DepA);
            context.setClass(DepB);
            context.setFactory(Test, factory, { inject: [ DepA, DepB ] });
            const test = context.getSync(Test);
            expect(context.getSync(Test)).toBe(test);
            expect(test.a).toBeInstanceOf(DepA);
            expect(test.b).toBeInstanceOf(DepB);
        });
        it("can inject a factory method singleton with private constructor and type dependencies", () => {
            class Test {
                private static readonly value = 53;
                private constructor(public a: DepA, public b: DepB, public c: number) {}
                public static create(a: DepA, b: DepB): Test {
                    return new Test(a, b, this.value);
                }
            }
            context.setClass(DepA);
            context.setClass(DepB);
            context.setFactory(Test, Test.create, { inject: [ DepA, DepB ] });
            const test = context.getSync(Test);
            expect(context.getSync(Test)).toBe(test);
            expect(test.a).toBeInstanceOf(DepA);
            expect(test.b).toBeInstanceOf(DepB);
            expect(test.c).toBe(53);
        });
        it("can inject a factory function singleton with named dependencies", () => {
            class Test {
                public constructor(public a: DepA, public b: DepB) {}
            }
            function factory(a: DepA, b: DepB): Test {
                return new Test(a, b);
            }
            context.setClass(DepA, { name: "dep-a" });
            context.setClass(DepB, { name: [ "dep-b", "dep-b-alias" ] });
            context.setFactory(Test, factory, { inject: [ "dep-a", "dep-b-alias" ] });
            const test = context.getSync(Test);
            expect(context.getSync(Test)).toBe(test);
            expect(test.a).toBeInstanceOf(DepA);
            expect(test.b).toBeInstanceOf(DepB);
        });
        it("can inject a factory method singleton with private constructor and named dependencies", () => {
            class Test {
                private static readonly value = 53;
                private constructor(public a: DepA, public b: DepB, public c: number) {}
                public static create(a: DepA, b: DepB): Test {
                    return new Test(a, b, this.value);
                }
            }
            const depB = Symbol("dep-b");
            context.setClass(DepA, { name: [ "dep-a", "dep-a-alias" ] });
            context.setClass(DepB, { name: depB });
            context.setFactory(Test, Test.create, { inject: [ "dep-a-alias", depB ] });
            const test = context.getSync(Test);
            expect(context.getSync(Test)).toBe(test);
            expect(test.a).toBeInstanceOf(DepA);
            expect(test.b).toBeInstanceOf(DepB);
            expect(test.c).toBe(53);
        });
        it("can inject a factory function singleton with mixed (type and named) dependencies", () => {
            class Test {
                public constructor(public a: DepA, public b: DepB) {}
            }
            function factory(a: DepA, b: DepB): Test {
                return new Test(a, b);
            }
            context.setClass(DepA);
            context.setClass(DepB, { name: "dep-b" });
            context.setFactory(Test, factory, { inject: [ DepA, "dep-b" ] });
            const test = context.getSync(Test);
            expect(context.getSync(Test)).toBe(test);
            expect(test.a).toBeInstanceOf(DepA);
            expect(test.b).toBeInstanceOf(DepB);
        });
        it("can inject a factory method singleton with private constructor and mixed (type and named) dependencies", () => {
            class Test {
                private static readonly value = 53;
                private constructor(public a: DepA, public b: DepB, public c: number) {}
                public static create(a: DepA, b: DepB): Test {
                    return new Test(a, b, this.value);
                }
            }
            context.setClass(DepA, { name: "dep-a" });
            context.setClass(DepB);
            context.setFactory(Test, Test.create, { inject: [ "dep-a", DepB ] });
            const test = context.getSync(Test);
            expect(context.getSync(Test)).toBe(test);
            expect(test.a).toBeInstanceOf(DepA);
            expect(test.b).toBeInstanceOf(DepB);
            expect(test.c).toBe(53);
        });
        it("can inject a prototype-scoped factory function", () => {
            class Test {
                public constructor(public value: number) {}
            }
            function create(): Test {
                return new Test(23);
            }
            context.setFactory(Test, create, { scope: Scope.PROTOTYPE });
            const test = context.getSync(Test);
            expect(test.value).toBe(23);
            const test2 = context.getSync(Test);
            expect(test2).not.toBe(test);
            expect(test.value).toBe(23);
        });
        it("can inject a prototype-scoped factory method", () => {
            class Test {
                private static readonly value = 23;
                private constructor(public value: number) {}
                public static create(): Test {
                    return new Test(this.value);
                }
            }
            context.setFactory(Test, Test.create, { scope: Scope.PROTOTYPE });
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
                public static async create(): Promise<Test> {
                    return Promise.resolve(new Test(this.value));
                }
            }
            context.setFactory(Test, Test.create, { scope: Scope.PROTOTYPE });
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
                public static async create(): Promise<Test> {
                    return Promise.resolve(new Test(this.value));
                }
            }
            context.setFactory(Test, Test.create);
            const testPromise = context.get(Test);
            expect(testPromise).toBeInstanceOf(Promise);
            const test = await testPromise;
            expect(test.value).toBe(23);
            // Fetch after promise resolve is synchronously resolvable
            const test2 = context.getSync(Test);
            expect(test2).toBe(test);
            expect(test.value).toBe(23);
        });
        it("can inject a prototype-scoped async factory function", async () => {
            class Test {
                public constructor(public value: number) {}
            }
            async function create(): Promise<Test> {
                return Promise.resolve(new Test(53));
            }
            context.setFactory(Test, create, { scope: Scope.PROTOTYPE });
            const testPromise = context.get(Test);
            expect(testPromise).toBeInstanceOf(Promise);
            const test = await testPromise;
            expect(test.value).toBe(53);
            const test2Promise = context.get(Test);
            expect(test2Promise).not.toBe(testPromise);
            expect(test2Promise).toBeInstanceOf(Promise);
            const test2 = await test2Promise;
            expect(test2).not.toBe(test);
            expect(test.value).toBe(53);
        });
        it("can inject an async factory function singleton", async () => {
            class Test {
                public constructor(public value: number) {}
            }
            async function create(): Promise<Test> {
                return Promise.resolve(new Test(53));
            }
            context.setFactory(Test, create);
            const testPromise = context.get(Test);
            expect(testPromise).toBeInstanceOf(Promise);
            const test = await testPromise;
            expect(test.value).toBe(53);
            // Fetch after promise resolve is synchronously resolvable
            const test2 = context.getSync(Test);
            expect(test2).toBe(test);
            expect(test.value).toBe(53);
        });
        it("can inject a synchronous class dependency with pass-through parameters", () => {
            class Component {
                private constructor(
                    public readonly param1: string,
                    public readonly service: DepA,
                    public readonly param3: string
                ) {}

                public static create(param1: string, service: DepA, param3: string): Component {
                    return new Component(param1, service, param3);
                }
            }
            context.setClass(DepA);
            context.setFactory(Component, Component.create, { inject: [ null, DepA, null ], scope: Scope.PROTOTYPE });
            const component = context.getSync(Component, [ "foo", 2 ]);
            expect(component.service).toBe(context.getSync(DepA));
            expect(component.param1).toBe("foo");
            expect(component.param3).toBe(2);
        });
        it("can inject a asynchronous class dependency with pass-through parameters", async () => {
            class Component {
                private constructor(
                    public readonly param1: string,
                    public readonly service: DepA,
                    public readonly param3: string
                ) {}

                public static create(param1: string, service: DepA, param3: string): Promise<Component> {
                    return Promise.resolve(new Component(param1, service, param3));
                }
            }
            context.setClass(DepA);
            context.setFactory(Component, Component.create, { inject: [ null, DepA, null ], scope: Scope.PROTOTYPE });
            const component = await context.getAsync(Component, [ "foo", 2 ]);
            expect(component.service).toBe(context.getSync(DepA));
            expect(component.param1).toBe("foo");
            expect(component.param3).toBe(2);
        });
        it("requires compatible inject array when factory function has dependencies", () => {
            class Test {}
            function create(a: DepA, b: DepB): Test {
                return new Test();
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
            expect(context.get("name")).toBe("foo");
        });
        it("injects a string with a single symbol", () => {
            const foo = Symbol("foo");
            context.setValue("foo", foo);
            expect(context.get(foo)).toBe("foo");
        });
        it("injects a string with a single name given as array", () => {
            context.setValue("foo", [ "name-1" ]);
            expect(context.get("name-1")).toBe("foo");
        });
        it("injects a string with multiple names given as array", () => {
            const name2 = Symbol("name-2");
            context.setValue("foo", [ "name-1", name2 ]);
            expect(context.get("name-1")).toBe("foo");
            expect(context.get(name2)).toBe("foo");
        });
        it("injects a class instance with name", () => {
            class Test {}
            const test = new Test();
            context.setValue(test, "test");
            expect(context.get(Test)).toBe(test);
            expect(context.get("test")).toBe(test);
        });
        it("injects a class instance without names (type only)", () => {
            class Test {}
            const test = new Test();
            context.setValue(test);
            expect(context.get(Test)).toBe(test);
        });
    });
    describe("injectFunction", () => {
        it("injects a function without parameters (makes no sense, but should work anyway)", () => {
            const spy = vi.fn();
            function callSpy() {
                spy();
            }
            context.setFunction(callSpy, []);
            const test = context.getSync(callSpy);
            expect(spy).not.toHaveBeenCalled();
            test();
            expect(spy).toHaveBeenCalledOnce();
            test();
            test();
            expect(spy).toHaveBeenCalledTimes(3);
        });
        it("injects a function with pass-through parameters only (makes no sense, but should work anyway)", () => {
            const spy = vi.fn();
            function callSpy(a: number, b: string) {
                spy(a, b);
            }
            context.setFunction(callSpy, [ null, null ]);
            const test = context.getSync(callSpy);
            test(1, "test");
            expect(spy).toHaveBeenCalledExactlyOnceWith(1, "test");
        });
        it("injects a function with injected parameters only", () => {
            const spy = vi.fn();
            function callSpy(a: number, b: string) {
                spy(a, b);
            }
            context.setValue(2, "a");
            context.setValue("foo", "b");
            context.setFunction(callSpy, [ "a", "b" ]);
            const test = context.getSync(callSpy);
            test(1, "test");
            expect(spy).toHaveBeenCalledExactlyOnceWith(2, "foo");
        });
        it("injects a function with injected and pass-through parameters", () => {
            const spy = vi.fn();
            function callSpy(a: number, b: string, c: number, d: string) {
                spy(a, b, c, d);
            }
            context.setValue(2, "a");
            context.setValue(3, "b");
            context.setFunction(callSpy, [ "a", null, "b", null ]);
            const test = context.getSync(callSpy);
            test("foo", "bar");
            expect(spy).toHaveBeenCalledExactlyOnceWith(2, "foo", 3, "bar");
        });
        it("injects the function as singleton", () => {
            function callSpy() {}
            context.setFunction(callSpy, []);
            const test = context.getSync(callSpy);
            expect(test).toBe(context.getSync(callSpy));
        });
        it("infers return type but cannot infer param types", () => {
            function createNumber(): number {
                return 2;
            }
            context.setFunction(createNumber, []);
            const test = context.getSync(createNumber);
            expect(test("ignored", "also ignored").toFixed(2)).toBe("2.00");
        });
        it("injects function with single string-named qualifier", () => {
            const spy = vi.fn();
            function callSpy() { spy(); }
            context.setFunction(callSpy, [], "single-name");
            const test = context.getSync<() => unknown>("single-name");
            test();
            expect(spy).toHaveBeenCalledOnce();
        });
        it("injects function with single symbol-named qualifier", () => {
            const spy = vi.fn();
            function callSpy() { spy(); }
            const name = Symbol("single-name");
            context.setFunction(callSpy, [], name);
            const test = context.getSync<() => unknown>(name);
            test();
            expect(spy).toHaveBeenCalledOnce();
        });
        it("injects function with multiple names", () => {
            const spy = vi.fn();
            function callSpy() { spy(); }
            const name2 = Symbol("name2");
            context.setFunction(callSpy, [], [ "name1", name2 ]);
            const test = context.getSync<() => unknown>("name1");
            test();
            expect(spy).toHaveBeenCalledOnce();
            expect(context.getSync(name2)).toBe(test);
        });
        it("injects function which can be injected into a class", () => {
            const divide = (dividend: number, divisor: number) => dividend / divisor;
            context.setValue(10, "divisor");
            context.setFunction(divide, [ null, "divisor" ]);
            class Test {
                public constructor(private readonly dividend: number, private readonly divide: (dividend: number) => number) {}
                public run(): number {
                    return this.divide(this.dividend);
                }
            }
            context.setValue(200, "dividend");
            context.setClass(Test, { inject: [ "dividend", divide ] });
            const test = context.getSync(Test);
            expect(test.run()).toBe(20);
        });
        it("injects function which can be injected into a factory", () => {
            const divide = (dividend: number, divisor: number) => dividend / divisor;
            context.setValue(10, "divisor");
            context.setFunction(divide, [ null, "divisor" ]);
            class Test {
                private constructor(private readonly dividend: number, private readonly divide: (dividend: number) => number) {}

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
            expect(test.run()).toBe(20);
        });
        it("can inject a function with asynchronous dependencies", async () => {
            context.setFactory(Number, () => Promise.resolve(10), { name: "factor" });
            const multiply = (a: number, b: number) => a * b;
            context.setFunction(multiply, [ null, "factor" ]);
            const testPromise = context.get(multiply);
            expect(testPromise).toBeInstanceOf(Promise);
            const test = await testPromise;
            expect(test(2)).toBe(20);
            expect(test(3)).toBe(30);
            // Next resolve returns sync function
            expect(context.get(multiply)).toBe(test);
        });
    });
    describe("get", () => {
        it("returns dependency from parent scope if not found in current scope", () => {
            context.setValue("root", "test");
            const childContext = context.createChildContext();
            childContext.activate();
            expect(childContext.get("test")).toBe("root");
        });
        it("throws error when typed dependency was not found", () => {
            class Test {}
            expect(() => context.get(Test)).toThrowWithMessage(InjectionError, "Dependency <Test> not found");
        });
        it("throws error when string-named dependency was not found", () => {
            expect(() => context.get("test")).toThrowWithMessage(InjectionError, "Dependency 'test' not found");
        });
        it("throws error when symbol-named dependency was not found", () => {
            expect(() => context.get(Symbol("test"))).toThrowWithMessage(InjectionError, "Dependency Symbol(test) not found");
        });
        it("throws error when qualified type was not found", () => {
            class Test {}
            expect(() => context.get(qualify(Test, "foo"))).toThrowWithMessage(InjectionError, "Dependency <Test:foo> not found");
            expect(() => context.get(qualify(Test, Symbol("foo")))).toThrowWithMessage(InjectionError, "Dependency <Test:Symbol(foo)> not found");
        });
        it("throws error when dependency needs pass-through parameters but none given", () => {
            class Test {
                public constructor(public a: string) {}
            }
            context.setClass(Test, { inject: [ null ], scope: Scope.PROTOTYPE });
            expect(() => context.get(Test)).toThrowWithMessage(InjectionError, "Pass-through parameter 1 not found for dependency <Test>");
        });
        it("throws error when dependency needs pass-through parameters but not enough given", () => {
            class Test {
                public constructor(public a: string, public b: string) {}
            }
            context.setClass(Test, { inject: [ null, null ], scope: Scope.PROTOTYPE });
            expect(() => context.get(Test, [ "test" ])).toThrowWithMessage(InjectionError, "Pass-through parameter 2 not found for dependency <Test>");
        });
    });
    describe("getAsync", () => {
        it("returns promise for async dependency", async () => {
            class Test {
                public static async create(): Promise<Test> {
                    return Promise.resolve(new Test());
                }
            }
            context.setFactory(Test, Test.create);
            const testPromise = context.getAsync(Test);
            expect(testPromise).toBeInstanceOf(Promise);
            const test = await testPromise;
            expect(test).toBeInstanceOf(Test);
        });
        it("returns promise for sync dependency", async () => {
            class Test {
            }
            context.setClass(Test);
            const testPromise = context.getAsync(Test);
            expect(testPromise).toBeInstanceOf(Promise);
            const test = await testPromise;
            expect(test).toBeInstanceOf(Test);
        });
        it("throws error when typed dependency was not found", async () => {
            class Test {}
            await expect(context.getAsync(Test)).rejects.toThrowWithMessage(InjectionError, "Dependency <Test> not found");
        });
        it("throws error when string-named dependency was not found", async () => {
            await expect(context.getAsync("test")).rejects.toThrowWithMessage(InjectionError, "Dependency 'test' not found");
        });
        it("throws error when symbol-named dependency was not found", async () => {
            await expect(context.getAsync(Symbol("test"))).rejects.toThrowWithMessage(InjectionError, "Dependency Symbol(test) not found");
        });
    });
    describe("getSync", () => {
        it("throws error when dependency is async", () => {
            class Test {
                public static async create(): Promise<Test> {
                    return Promise.resolve(new Test());
                }
            }
            context.setFactory(Test, Test.create);
            expect(() => context.getSync(Test)).toThrowWithMessage(InjectionError,  "Asynchronous dependency <Test> can not be resolved synchronously");
        });
        it("returns sync dependency", () => {
            class Test {
            }
            context.setClass(Test);
            const test = context.getSync(Test);
            expect(test).toBeInstanceOf(Test);
        });
        it("throws error when typed dependency was not found", () => {
            class Test {}
            expect(() => context.getSync(Test)).toThrowWithMessage(InjectionError, "Dependency <Test> not found");
        });
        it("throws error when string-named dependency was not found", () => {
            expect(() => context.getSync("test")).toThrowWithMessage(InjectionError, "Dependency 'test' not found");
        });
        it("throws error when symbol-named dependency was not found", () => {
            expect(() => context.getSync(Symbol("test"))).toThrowWithMessage(InjectionError, "Dependency Symbol(test) not found");
        });
    });
    describe("has", () => {
        it("returns false if context does not know the given qualifier", () => {
            class Test {}
            function test() {}
            expect(context.has(Test)).toBe(false);
            expect(context.has(test)).toBe(false);
            expect(context.has("test")).toBe(false);
            expect(context.has(qualify(Test, "test"))).toBe(false);
        });
        it("returns false if context and its parent does not know the given qualifier", () => {
            class Test {}
            function test() {}
            const childContext = context.createChildContext();
            expect(childContext.has(Test)).toBe(false);
            expect(childContext.has(test)).toBe(false);
            expect(childContext.has("test")).toBe(false);
            expect(childContext.has(qualify(Test, "test"))).toBe(false);
        });
        it("returns true if context knows the given qualifier", () => {
            class Test {}
            context.setClass(Test);
            context.setClass(Test, { name: "test" });
            function test() {}
            context.setFunction(test, []);
            context.setValue(53, "test");
            expect(context.has(Test)).toBe(true);
            expect(context.has(test)).toBe(true);
            expect(context.has("test")).toBe(true);
            expect(context.has(qualify(Test, "test"))).toBe(true);
        });
        it("returns true if parent context knows the given qualifier", () => {
            class Test {}
            context.setClass(Test);
            context.setClass(Test, { name: "test" });
            function test() {}
            context.setFunction(test, []);
            context.setValue(53, "test");
            const childContext = context.createChildContext();
            expect(childContext.has(Test)).toBe(true);
            expect(childContext.has(test)).toBe(true);
            expect(childContext.has("test")).toBe(true);
            expect(childContext.has(qualify(Test, "test"))).toBe(true);
        });
    });
    describe("remove", () => {
        it("removes a named dependency from the context", () => {
            context.setValue(1, "test");
            expect(context.has("test")).toBe(true);
            expect(context.remove("test")).toBe(true);
            expect(context.has("test")).toBe(false);
        });
        it("removes a typed dependency from the context", () => {
            class Test {}
            context.setClass(Test);
            expect(context.has(Test)).toBe(true);
            expect(context.remove(Test)).toBe(true);
            expect(context.has(Test)).toBe(false);
        });
        it("removes a qualified typed dependency from the context", () => {
            class Test {}
            context.setClass(Test, { name: "test" });
            expect(context.has(Test)).toBe(true);
            expect(context.has("test")).toBe(true);
            expect(context.has(qualify(Test, "test"))).toBe(true);
            expect(context.remove(qualify(Test, "test"))).toBe(true);
            expect(context.has(Test)).toBe(true);
            expect(context.has("test")).toBe(true);
            expect(context.has(qualify(Test, "test"))).toBe(false);
        });
        it("returns false if dependency was not found", () => {
            expect(context.remove("test")).toBe(false);
        });
        it("does not remove dependency in parent", () => {
            context.setValue(1, "test");
            const childContext = context.createChildContext();
            expect(childContext.remove("test")).toBe(false);
            expect(context.has("test")).toBe(true);
        });
    });
    describe("findContext", () => {
        it("returns context if it contains the qualifier", () => {
            class Test {}
            context.setClass(Test, { name: "test" });
            expect(context.findContext("test")).toBe(context);
            expect(context.findContext(Test)).toBe(context);
            expect(context.findContext(qualify(Test, "test"))).toBe(context);
        });
        it("returns parent context if not found in this context but in parent context", () => {
            class Test {}
            context.setClass(Test, { name: "test" });
            const childContext = context.createChildContext();
            expect(childContext.findContext("test")).toBe(context);
            expect(childContext.findContext(Test)).toBe(context);
            expect(childContext.findContext(qualify(Test, "test"))).toBe(context);
        });
        it("returns null if not found in this context and not in parent context", () => {
            const childContext = context.createChildContext();
            expect(childContext.findContext("test")).toBe(null);
            expect(context.findContext("test")).toBe(null);
        });
    });
});
