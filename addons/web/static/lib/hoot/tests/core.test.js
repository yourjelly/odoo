/** @odoo-module **/

import { makeTestRunner } from "../core/runner";
import { Suite } from "../core/suite";
import { Test } from "../core/test";
import { expect, suite, test } from "../hoot";

suite("@odoo/hoot", "Core", "Runner", () => {
    test("can register suites", () => {
        const runner = makeTestRunner();
        runner.suite("a suite", () => {});
        runner.suite("another suite", () => {});

        expect(runner.suites.length).toBe(2);
        expect(runner.tests.length).toBe(0);
        for (const suite of runner.suites) {
            expect(suite).toMatch(Suite);
        }
    });

    test("can register nested suites", () => {
        const runner = makeTestRunner();
        runner.suite("a", "b", "c", () => {});

        expect(runner.suites.map((s) => s.name)).toEqual(["c", "b", "a"]);
    });

    test("can register tests", () => {
        const runner = makeTestRunner();
        runner.suite("suite 1", () => {
            runner.test("test 1", () => {});
        });
        runner.suite("suite 2", () => {
            runner.test("test 2", () => {});
            runner.test("test 3", () => {});
        });

        expect(runner.suites.length).toBe(2);
        expect(runner.tests.length).toBe(3);
    });

    test("should not have duplicate suites", () => {
        const runner = makeTestRunner();
        runner.suite("parent", "child a", () => {});
        runner.suite("parent", "child b", () => {});

        expect(runner.suites.map((suite) => suite.name)).toEqual(["child a", "parent", "child b"]);
    });

    test("can refuse standalone tests", async () => {
        const runner = makeTestRunner();
        expect(() =>
            runner.test("standalone test", () => {
                expect(true).toBeTruthy();
            })
        ).toThrow();
    });

    test("can register test tags", async () => {
        const runner = makeTestRunner();

        runner.suite("suite", () => {
            let testFn = runner.test;
            for (let i = 1; i <= 10; i++) {
                testFn = testFn[`Tag ${i}`];
            }

            testFn.debug.only.skip["eleventh tag"]("tagged test", () => {});
        });

        expect(runner.tags.size).toBe(11);
        expect(runner.tests[0].tags.length).toBe(11);
    });
});

suite("@odoo/hoot", "Core", "Suite", () => {
    test("should have a hashed id", () => {
        expect(new Suite(null, "a suite", []).id).toMatch(/^\w{8}$/);
    });

    test("should describe its path in its name", () => {
        const a = new Suite(null, "a", []);
        const b = new Suite(a, "b", []);
        const c = new Suite(a, "c", []);
        const d = new Suite(b, "d", []);

        expect(a.parent).toBe(null);
        expect(b.parent).toBe(a);
        expect(c.parent).toBe(a);
        expect(d.parent.parent).toBe(a);

        expect(a.fullName).toBe("a");
        expect(b.fullName).toBe("a > b");
        expect(c.fullName).toBe("a > c");
        expect(d.fullName).toBe("a > b > d");
    });
});

suite("@odoo/hoot", "Core", "Test", () => {
    test("should have a hashed id", () => {
        expect(new Test(null, "a test", () => {}, []).id).toMatch(/^\w{8}$/);
    });

    test("should describe its path in its name", () => {
        const a = new Suite(null, "a", []);
        const b = new Suite(a, "b", []);
        const t1 = new Test(null, "t1", () => {}, []);
        const t2 = new Test(a, "t2", () => {}, []);
        const t3 = new Test(b, "t3", () => {}, []);

        expect(t1.fullName).toBe("t1");
        expect(t2.fullName).toBe("a > t2");
        expect(t3.fullName).toBe("a > b > t3");
    });
});
