/** @odoo-module **/

import { makeTestRunner } from "../core/runner";
import { Suite } from "../core/suite";
import { Test } from "../core/test";
import { suite, test } from "../setup";

suite("@odoo/hoot", "Core", "Runner", () => {
    test("can register suites", (assert) => {
        const runner = makeTestRunner();
        runner.suite("a suite", () => {});
        runner.suite("another suite", () => {});

        assert.equal(runner.suites.length, 2);
        assert.equal(runner.tests.length, 0);
        for (const suite of runner.suites) {
            assert.match(suite, Suite);
        }
    });

    test("can register nested suites", (assert) => {
        const runner = makeTestRunner();
        runner.suite("a", "b", "c", () => {});

        assert.deepEqual(
            runner.suites.map((s) => s.name),
            ["c", "b", "a"]
        );
    });

    test("can register tests", (assert) => {
        const runner = makeTestRunner();
        runner.suite("suite 1", () => {
            runner.test("test 1", () => {});
        });
        runner.suite("suite 2", () => {
            runner.test("test 2", () => {});
            runner.test("test 3", () => {});
        });

        assert.equal(runner.suites.length, 2);
        assert.equal(runner.tests.length, 3);
    });

    test("should not have duplicate suites", (assert) => {
        const runner = makeTestRunner();
        runner.suite("parent", "child a", () => {});
        runner.suite("parent", "child b", () => {});

        assert.deepEqual(
            runner.suites.map((suite) => suite.name),
            ["child a", "parent", "child b"]
        );
    });

    test("can refuse standalone tests", async (assert) => {
        assert.throws(() =>
            runner.test("standalone test", ({ ok }) => {
                ok(true);
            })
        );
    });

    test("can register test tags", async (assert) => {
        const runner = makeTestRunner();

        runner.suite("suite", () => {
            let testFn = runner.test;
            for (let i = 1; i <= 10; i++) {
                testFn = testFn[`Tag ${i}`];
            }

            testFn.debug.only.skip["eleventh tag"]("tagged test", () => {});
        });

        assert.equal(runner.tags.size, 11);
        assert.equal(runner.tests[0].tags.length, 11);
    });
});

suite("@odoo/hoot", "Core", "Suite", () => {
    test("should have a hashed id", (assert) => {
        assert.match(new Suite(null, "a suite", []).id, /^\w{8}$/);
    });

    test("should describe its path in its name", (assert) => {
        const a = new Suite(null, "a", []);
        const b = new Suite(a, "b", []);
        const c = new Suite(a, "c", []);
        const d = new Suite(b, "d", []);

        assert.equal(a.parent, null);
        assert.equal(b.parent, a);
        assert.equal(c.parent, a);
        assert.equal(d.parent.parent, a);

        assert.equal(a.fullName, "a");
        assert.equal(b.fullName, "a > b");
        assert.equal(c.fullName, "a > c");
        assert.equal(d.fullName, "a > b > d");
    });
});

suite("@odoo/hoot", "Core", "Test", () => {
    test("should have a hashed id", (assert) => {
        assert.match(new Test(null, "a test", () => {}, []).id, /^\w{8}$/);
    });

    test("should describe its path in its name", (assert) => {
        const a = new Suite(null, "a", []);
        const b = new Suite(a, "b", []);
        const t1 = new Test(null, "t1", () => {}, []);
        const t2 = new Test(a, "t2", () => {}, []);
        const t3 = new Test(b, "t3", () => {}, []);

        assert.equal(t1.fullName, "t1");
        assert.equal(t2.fullName, "a > t2");
        assert.equal(t3.fullName, "a > b > t3");
    });
});
