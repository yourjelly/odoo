odoo.define('web.concurrency_tests', function (require) {
"use strict";

var concurrency = require('web.concurrency');
var testUtils = require('web.test_utils');

var makeTestPromise = testUtils.makeTestPromise;
var makeTestPromiseWithAssert = testUtils.makeTestPromiseWithAssert;

QUnit.module('core', {}, function () {

    QUnit.module('concurrency');

    QUnit.test('mutex: simple scheduling', async function (assert) {
        assert.expect(5);
        var done = assert.async();
        var mutex = new concurrency.Mutex();

        var prom1 = makeTestPromiseWithAssert(assert, 'prom1');
        var prom2 = makeTestPromiseWithAssert(assert, 'prom2');

        mutex.exec(function () { return prom1; });
        mutex.exec(function () { return prom2; });

        assert.verifySteps([]);

        await prom1.resolve();

        assert.verifySteps(['ok prom1']);

        await prom2.resolve();

        assert.verifySteps(['ok prom1', 'ok prom2']);

        done();
    });

    QUnit.test('mutex: simpleScheduling2', async function (assert) {
        assert.expect(5);
        var done = assert.async();
        var mutex = new concurrency.Mutex();

        var prom1 = makeTestPromiseWithAssert(assert, 'prom1');
        var prom2 = makeTestPromiseWithAssert(assert, 'prom2');

        mutex.exec(function () { return prom1; });
        mutex.exec(function () { return prom2; });

        assert.verifySteps([]);

        await prom2.resolve();

        assert.verifySteps(['ok prom2']);

        await prom1.resolve();

        assert.verifySteps(['ok prom2', 'ok prom1']);

        done();
    });

    QUnit.test('mutex: reject', async function (assert) {
        assert.expect(7);
        var done = assert.async();

        var mutex = new concurrency.Mutex();

        var prom1 = makeTestPromiseWithAssert(assert, 'prom1');
        var prom2 = makeTestPromiseWithAssert(assert, 'prom2');
        var prom3 = makeTestPromiseWithAssert(assert, 'prom3');

        mutex.exec(function () { return prom1; });
        mutex.exec(function () { return prom2; });
        mutex.exec(function () { return prom3; });

        assert.verifySteps([]);

        await prom1.resolve();

        assert.verifySteps(['ok prom1']);

        try {
            await prom2.reject();
        } catch {
            assert.verifySteps(['ok prom1', 'ko prom2']);
        }

        await prom3.resolve();

        assert.verifySteps(['ok prom1', 'ko prom2', 'ok prom3']);
        done();
    });

    QUnit.skip('mutex: getUnlockedDef checks', function (assert) {
        assert.expect(5);

        var m = new concurrency.Mutex();

        var def1 = $.Deferred();
        var def2 = $.Deferred();

        assert.strictEqual(m.getUnlockedDef().state(), "resolved");

        m.exec(function() { return def1; });

        var unlockedDef = m.getUnlockedDef();

        assert.strictEqual(unlockedDef.state(), "pending");

        m.exec(function() { return def2; });

        assert.strictEqual(unlockedDef.state(), "pending");

        def1.resolve();

        assert.strictEqual(unlockedDef.state(), "pending");

        def2.resolve();

        assert.strictEqual(unlockedDef.state(), "resolved");
    });

    QUnit.test('DropPrevious: basic usecase', async function (assert) {
        assert.expect(4);
        var done = assert.async();

        var dp = new concurrency.DropPrevious();

        var prom1 = makeTestPromise(assert, 'prom1');
        var prom2 = makeTestPromise(assert, 'prom2');

        var dp1 = dp.add(prom1).then(() => assert.step('should not go here'))
                               .catch(()=> assert.step("rejected dp1"));
        var dp2 = dp.add(prom2).then(() => assert.step("ok dp2"));

        await dp1;
        assert.verifySteps(['rejected dp1']);

        await prom2.resolve();

        assert.verifySteps(['rejected dp1','ok dp2']);
        done();
    });


    QUnit.test('DropPrevious: resolve first before last', async function (assert) {
        assert.expect(4);
        var done = assert.async();

        var dp = new concurrency.DropPrevious();

        var prom1 = makeTestPromise(assert, 'prom1');
        var prom2 = makeTestPromise(assert, 'prom2');

        var dp1 = dp.add(prom1).then(() => assert.step('should not go here'))
                               .catch(()=> assert.step("rejected dp1"));
        var dp2 = dp.add(prom2).then(() => assert.step("ok dp2"));

        await dp1;
        assert.verifySteps(['rejected dp1']);

        await prom1.resolve();
        await prom2.resolve();

        assert.verifySteps(['rejected dp1','ok dp2']);
        done();
    });

    QUnit.test('DropMisordered: resolve all correctly ordered, sync', async function (assert) {
        assert.expect(1);
        var done = assert.async();

        var dm = new concurrency.DropMisordered(),
            flag = false;

        var d1 = makeTestPromise(),
            d2 = makeTestPromise();

        var r1 = dm.add(d1),
            r2 = dm.add(d2);

        Promise.all([r1, r2]).then(function () {
            flag = true;
        });

        await d1.resolve();
        await d2.resolve();

        assert.ok(flag);
        done();
    });

    QUnit.test("DropMisordered: don't resolve mis-ordered, sync", async function (assert) {
        assert.expect(4);
        var done = assert.async();

        var dm = new concurrency.DropMisordered(),
            done1 = false,
            done2 = false,
            fail1 = false,
            fail2 = false;

        var d1 = makeTestPromise(),
            d2 = makeTestPromise();

        dm.add(d1).then(function () { done1 = true; })
                    .catch(function () { fail1 = true; });
        dm.add(d2).then(function () { done2 = true; })
                    .catch(function () { fail2 = true; });

        await d2.resolve();
        await d1.resolve();

        // d1 is in limbo
        assert.ok(!done1);
        assert.ok(!fail1);

        // d2 is fulfilled
        assert.ok(done2);
        assert.ok(!fail2);
        done();
    });

    QUnit.test('DropMisordered: fail mis-ordered flag, sync', async function (assert) {
        assert.expect(4);
        var done = assert.async();

        var dm = new concurrency.DropMisordered(true/* failMisordered */),
            done1 = false,
            done2 = false,
            fail1 = false,
            fail2 = false;

        var d1 = makeTestPromise(),
            d2 = makeTestPromise();

        dm.add(d1).then(function () { done1 = true; })
                    .catch(function () { fail1 = true; });
        dm.add(d2).then(function () { done2 = true; })
                    .catch(function () { fail2 = true; });

        await d2.resolve();
        await d1.resolve();

        // d1 is in limbo
        assert.ok(!done1);
        assert.ok(fail1);

        // d2 is resolved
        assert.ok(done2);
        assert.ok(!fail2);
        done();
    });

    QUnit.test('DropMisordered: resolve all correctly ordered, async', function (assert) {
        var done = assert.async();
        assert.expect(1);

        var dm = new concurrency.DropMisordered();

        var d1 = makeTestPromise(),
            d2 = makeTestPromise();

        var r1 = dm.add(d1),
            r2 = dm.add(d2);

        setTimeout(function () { d1.resolve(); }, 10);
        setTimeout(function () { d2.resolve(); }, 20);

        Promise.all([r1, r2]).then(function () {
            assert.ok(true);
            done();
        });
    });

    QUnit.test("DropMisordered: don't resolve mis-ordered, async", function (assert) {
        var done = assert.async();
        assert.expect(4);

        var dm = new concurrency.DropMisordered(),
            done1 = false, done2 = false,
            fail1 = false, fail2 = false;

        var d1 = makeTestPromise(),
            d2 = makeTestPromise();

        dm.add(d1).then(function () { done1 = true; })
                    .catch(function () { fail1 = true; });
        dm.add(d2).then(function () { done2 = true; })
                    .catch(function () { fail2 = true; });

        setTimeout(function () { d1.resolve(); }, 20);
        setTimeout(function () { d2.resolve(); }, 10);

        setTimeout(function () {
            // d1 is in limbo
            assert.ok(!done1);
            assert.ok(!fail1);

            // d2 is resolved
            assert.ok(done2);
            assert.ok(!fail2);
            done();
        }, 30);
    });

    QUnit.test('DropMisordered: fail mis-ordered flag, async', function (assert) {
        var done = assert.async();
        assert.expect(4);

        var dm = new concurrency.DropMisordered(true),
            done1 = false, done2 = false,
            fail1 = false, fail2 = false;

        var d1 = makeTestPromise(),
            d2 = makeTestPromise();

        dm.add(d1).then(function () { done1 = true; })
                    .catch(function () { fail1 = true; });
        dm.add(d2).then(function () { done2 = true; })
                    .catch(function () { fail2 = true; });

        setTimeout(function () { d1.resolve(); }, 20);
        setTimeout(function () { d2.resolve(); }, 10);

        setTimeout(function () {
            // d1 is failed
            assert.ok(!done1);
            assert.ok(fail1);

            // d2 is resolved
            assert.ok(done2);
            assert.ok(!fail2);
            done();
        }, 30);
    });

    QUnit.test('MutexedDropPrevious: simple', async function (assert) {
        assert.expect(5);
        var done = assert.async();

        var m = new concurrency.MutexedDropPrevious();
        var d1 = makeTestPromise();

        d1.then(function() {
            assert.step("d1 resolved");
        });
        var p1 = m.exec(function () { return d1; }).then(function (result) {
            assert.step("p1 done");
            assert.strictEqual(result, 'd1');
        });

        assert.verifySteps([]);
        await d1.resolve('d1');
        assert.verifySteps(["d1 resolved","p1 done"]);
        done();
    });

    QUnit.test('MutexedDropPrevious: d2 arrives after d1 resolution', async function (assert) {
        assert.expect(8);
        var done = assert.async();

        var m = new concurrency.MutexedDropPrevious();
        var d1 = makeTestPromiseWithAssert(assert, 'd1');

        m.exec(function () { return d1; }).then(function (result) {
            assert.step("p1 resolved");
        });

        assert.verifySteps([]);
        await d1.resolve('d1');
        assert.verifySteps(['ok d1','p1 resolved'])

        var d2 = makeTestPromiseWithAssert(assert, 'd2');
        m.exec(function () { return d2; }).then(function (result) {
            assert.step("p2 resolved");
        });

        assert.verifySteps(['ok d1','p1 resolved'])
        await d2.resolve('d2');
        assert.verifySteps(['ok d1','p1 resolved','ok d2','p2 resolved'])
        done();
    });

    QUnit.test('MutexedDropPrevious: p1 does not return a deferred', async function (assert) {
        assert.expect(7);
        var done = assert.async();

        var m = new concurrency.MutexedDropPrevious();

        var p1 = m.exec(function () { return 42; }).then(function (result) {
            assert.step("p1 resolved");
        });

        assert.verifySteps([]);
        await p1;
        assert.verifySteps(['p1 resolved'])

        var d2 = makeTestPromiseWithAssert(assert, 'd2');
        m.exec(function () { return d2; }).then(function (result) {
            assert.step("p2 resolved");
        });

        assert.verifySteps(['p1 resolved'])
        await d2.resolve('d2');
        assert.verifySteps(['p1 resolved','ok d2','p2 resolved'])
        done();
    });

    QUnit.test('MutexedDropPrevious: p2 arrives before p1 resolution', async function (assert) {
        assert.expect(8);
        var done = assert.async();

        var m = new concurrency.MutexedDropPrevious();
        var d1 = makeTestPromiseWithAssert(assert, 'd1');

        m.exec(function () { return d1; }).catch(function (result) {
            assert.step("p1 rejected");
        });
        assert.verifySteps([]);

        var d2 = makeTestPromiseWithAssert(assert, 'd2');
        m.exec(function () { return d2; }).then(function (result) {
            assert.step("p2 resolved");
        });

        assert.verifySteps([]);
        await d1.resolve('d1');
        assert.verifySteps(['p1 rejected','ok d1'])

        await d2.resolve('d2');
        assert.verifySteps(['p1 rejected','ok d1','ok d2','p2 resolved'])
        done();
    });

    QUnit.test('MutexedDropPrevious: 3 arrives before 2 initialization', async function (assert) {
        assert.expect(10);
        var done = assert.async();
        var m = new concurrency.MutexedDropPrevious();

        var d1 = makeTestPromiseWithAssert(assert, 'd1');
        var d3 = makeTestPromiseWithAssert(assert, 'd3');

        var p1 = m.exec(function () { return d1; }).catch(function() {
            assert.step('p1 rejected');
        });

        var p2 = m.exec(function () {
            assert.ok(false, "should not execute this function");
        }).catch(function() {
            assert.step('p2 rejected');
        });

        var p3 = m.exec(function () { return d3; }).then(function (result) {
            assert.strictEqual(result, 'd3');
            assert.step('p3 resolved');
        });

        assert.verifySteps([]);

        // wait for next microtask tick (all settled promises callbacks have been called)
        await Promise.resolve();

        assert.verifySteps(['p1 rejected', 'p2 rejected']);

        await d1.resolve('d1');

        assert.verifySteps(['p1 rejected', 'p2 rejected', 'ok d1']);

        await d3.resolve('d3');
        assert.verifySteps(['p1 rejected', 'p2 rejected', 'ok d1', 'ok d3','p3 resolved']);

        done();
    });

    QUnit.test('MutexedDropPrevious: 3 arrives after 2 initialization', async function (assert) {

        assert.expect(14);
        var done = assert.async();
        var m = new concurrency.MutexedDropPrevious();

        var d1 = makeTestPromiseWithAssert(assert, 'd1');
        var d2 = makeTestPromiseWithAssert(assert, 'd2');
        var d3 = makeTestPromiseWithAssert(assert, 'd3');

        var p1 = m.exec(function () { return d1; }).catch(function() {
            assert.step('p1 rejected');
        });

        var p2 = m.exec(function () {
            assert.step('execute d2');
            return d2;
        }).then(function(){
            assert.step('p2 resolved');
        }).catch(function() {
            assert.step('p2 rejected');
        });

        assert.verifySteps([]);

        // wait for next microtask tick (all settled promises callbacks have been called)
        await Promise.resolve();
        assert.verifySteps(['p1 rejected']);

        await d1.resolve('d1');
        assert.verifySteps(['p1 rejected', 'ok d1', 'execute d2']);

        var p3 = m.exec(function () {
            assert.step('execute d3');
            return d3;
        }).then(function (result) {
            assert.step('p3 resolved');
        });
        await Promise.resolve()
        assert.verifySteps(['p1 rejected', 'ok d1', 'execute d2', 'p2 rejected']);

        await d2.resolve();
        assert.verifySteps(['p1 rejected', 'ok d1', 'execute d2', 'p2 rejected','ok d2', 'execute d3']);

        await d3.resolve();
        assert.verifySteps(['p1 rejected', 'ok d1', 'execute d2', 'p2 rejected','ok d2','execute d3', 'ok d3', 'p3 resolved']);

        done();
     });

    QUnit.test('MutexedDropPrevious: 2 in then of 1 with 3', async function (assert) {
        assert.expect(9);
        var done = assert.async();

        var m = new concurrency.MutexedDropPrevious();

        var d1 = makeTestPromiseWithAssert(assert, 'd1');
        var d2 = makeTestPromiseWithAssert(assert, 'd2');
        var d3 = makeTestPromiseWithAssert(assert, 'd3');
        var p3;

        var p1 = m.exec(function () { return d1; })
            .catch(function () {
                assert.step('p1 rejected');
                p3 = m.exec(function () {
                    return d3;
                }).then(function (result) {
                    assert.step('p3 resolved');
                });
                return p3;
            });

        await Promise.resolve();
        assert.verifySteps([]);

        var p2 = m.exec(function () {
            assert.ok(false, 'should not execute this function');
            return d2;
        }).catch(function () {
            assert.step('p2 rejected');
        });

        await Promise.resolve();
        assert.verifySteps(['p1 rejected', 'p2 rejected']);

        await d1.resolve('d1');
        assert.verifySteps(['p1 rejected', 'p2 rejected', 'ok d1']);

        await d3.resolve('d3');
        assert.verifySteps(['p1 rejected', 'p2 rejected', 'ok d1', 'ok d3', 'p3 resolved']);

        done();
    });

});

});