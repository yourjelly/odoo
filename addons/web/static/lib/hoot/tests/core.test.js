/** @odoo-module **/

import { makeTestRunner } from "../core/runner";
import { Suite } from "../core/suite";
import { Test } from "../core/test";
import { suite, test } from "../setup";

suite("HOOT", "Core", "Runner", () => {
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

    test("can register sub-suites", (assert) => {
        const runner = makeTestRunner();
        runner.suite("a", "b", "c", () => {});

        assert.deepEqual(
            runner.suites.map((s) => s.name),
            ["c", "b", "a"]
        );
    });

    test("can register standalone tests", (assert) => {
        const runner = makeTestRunner();
        runner.test("a test", () => {});
        runner.test("another test", () => {});

        assert.equal(runner.suites.length, 0);
        assert.equal(runner.tests.length, 2);
        for (const test of runner.tests) {
            assert.match(test, Test);
        }
    });

    test("can register tests in suites", (assert) => {
        const runner = makeTestRunner();
        runner.suite("suite", () => {
            runner.test("child", () => {});
        });
        runner.test("standalone", () => {});

        assert.equal(runner.suites.length, 1);
        assert.equal(runner.tests.length, 2);

        assert.equal(runner.suites[0].jobs.length, 1);
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

    test("can run tests", async (assert) => {
        const runner = makeTestRunner();

        runner.suite("suite", () => {
            runner.beforeSuite((suite) => assert.step("beforeSuite:" + suite.name));
            runner.beforeTest((test) => assert.step("beforeTest:" + test.name));
            runner.afterTest((test) => assert.step("afterTest:" + test.name));
            runner.afterSuite((suite) => assert.step("afterSuite:" + suite.name));

            runner.test("suite test", ({ ok }) => {
                assert.step("> suite test");

                ok(true);
            });
        });

        runner.test("standalone test", ({ ok }) => {
            assert.step("> standalone test");

            ok(true);
        });

        assert.throws(() => runner.beforeSuite(() => assert.step("beforeSuite:null")));
        assert.throws(() => runner.afterSuite(() => assert.step("afterSuite:null")));

        runner.beforeAll(() => assert.step("beforeAll"));
        runner.beforeAnySuite((suite) => assert.step("beforeAnySuite:" + suite.name));
        runner.beforeAnyTest((test) => assert.step("beforeAnyTest:" + test.name));
        runner.afterAnyTest((test) => assert.step("afterAnyTest:" + test.name));
        runner.afterAnySuite((suite) => assert.step("afterAnySuite:" + suite.name));
        runner.afterAll(() => assert.step("afterAll"));

        assert.verifySteps([]);

        await runner.start();

        assert.verifySteps([
            // Before all
            "beforeAll",
            // First suite
            "beforeAnySuite:suite",
            "beforeSuite:suite",
            // First test
            "beforeAnyTest:suite test",
            "beforeTest:suite test",
            "> suite test",
            "afterAnyTest:suite test",
            "afterTest:suite test",
            // End of first suite
            "afterAnySuite:suite",
            "afterSuite:suite",
            // Second suite
            "beforeAnyTest:standalone test",
            "beforeTest:standalone test",
            "> standalone test",
            "afterAnyTest:standalone test",
            "afterTest:standalone test",
            // After all
            "afterAll",
        ]);
    });

    test("can be stopped", async (assert) => {
        const runner = makeTestRunner();

        runner.test("a", ({ ok }) => {
            assert.step("a");

            ok(true);
        });
        runner.test("b", async ({ ok }) => {
            assert.step("b");

            await runner.stop();

            ok(true);
        });
        runner.test("c", ({ ok }) => {
            assert.step("c");

            ok(true);
        });

        await runner.start();

        assert.verifySteps(["a", "b"]);
    });

    test("can refuse standalone tests", async (assert) => {
        const runner = makeTestRunner({ nostandalone: true });

        assert.throws(() =>
            runner.test("standalone test", ({ ok }) => {
                ok(true);
            })
        );
    });
});

suite("HOOT", "Core", "Suite", () => {
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

suite("HOOT", "Core", "Test", () => {
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
