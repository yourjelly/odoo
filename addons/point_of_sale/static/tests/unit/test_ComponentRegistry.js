odoo.define('point_of_sale.tests.ComponentRegistry', function(require) {
    'use strict';

    const Registries = require('point_of_sale.Registries');

    QUnit.module('unit tests for ComponentRegistry', {
        before() {},
    });

    QUnit.test('basic extend', async function(assert) {
        assert.expect(5);

        class A {
            constructor() {
                assert.step('A');
            }
        }
        Registries.PosComponentRegistry.add(A);

        let A1 = x =>
            class extends x {
                constructor() {
                    super();
                    assert.step('A1');
                }
            };
        Registries.PosComponentRegistry.extend(A, A1);

        Registries.PosComponentRegistry.freeze();

        const RegA = Registries.PosComponentRegistry.get(A);
        let a = new RegA();
        assert.verifySteps(['A', 'A1']);
        assert.ok(a instanceof RegA);
        assert.ok(RegA.name === 'A');
    });

    QUnit.test('addByExtending', async function(assert) {
        assert.expect(8);

        class A {
            constructor() {
                assert.step('A');
            }
        }
        Registries.PosComponentRegistry.add(A);

        let B = x =>
            class extends x {
                constructor() {
                    super();
                    assert.step('B');
                }
            };
        Registries.PosComponentRegistry.addByExtending(B, A);

        let A1 = x =>
            class extends x {
                constructor() {
                    super();
                    assert.step('A1');
                }
            };
        Registries.PosComponentRegistry.extend(A, A1);

        let A2 = x =>
            class extends x {
                constructor() {
                    super();
                    assert.step('A2');
                }
            };
        Registries.PosComponentRegistry.extend(A, A2);

        Registries.PosComponentRegistry.freeze();

        const RegA = Registries.PosComponentRegistry.get(A);
        const RegB = Registries.PosComponentRegistry.get(B);
        let b = new RegB();
        assert.verifySteps(['A', 'A1', 'A2', 'B']);
        assert.ok(b instanceof RegA);
        assert.ok(b instanceof RegB);
        assert.ok(RegB.name === 'B');
    });

    QUnit.test('extend the one that is added by extending', async function(assert) {
        assert.expect(6);

        class A {
            constructor() {
                assert.step('A');
            }
        }
        Registries.PosComponentRegistry.add(A);

        let B = x =>
            class extends x {
                constructor() {
                    super();
                    assert.step('B');
                }
            };
        Registries.PosComponentRegistry.addByExtending(B, A);

        let B1 = x =>
            class extends x {
                constructor() {
                    super();
                    assert.step('B1');
                }
            };
        Registries.PosComponentRegistry.extend(B, B1);

        let B2 = x =>
            class extends x {
                constructor() {
                    super();
                    assert.step('B2');
                }
            };
        Registries.PosComponentRegistry.extend(B, B2);

        let A1 = x =>
            class extends x {
                constructor() {
                    super();
                    assert.step('A1');
                }
            };
        Registries.PosComponentRegistry.extend(A, A1);

        Registries.PosComponentRegistry.freeze();

        const RegB = Registries.PosComponentRegistry.get(B);
        new RegB();
        assert.verifySteps(['A', 'A1', 'B', 'B1', 'B2']);
    });

    QUnit.test('addByExtending based on added by extending', async function(assert) {
        assert.expect(10);

        class A {
            constructor() {
                assert.step('A');
            }
        }
        Registries.PosComponentRegistry.add(A);

        let B = x =>
            class extends x {
                constructor() {
                    super();
                    assert.step('B');
                }
            };
        Registries.PosComponentRegistry.addByExtending(B, A);

        let A1 = x =>
            class extends x {
                constructor() {
                    super();
                    assert.step('A1');
                }
            };
        Registries.PosComponentRegistry.extend(A, A1);

        let C = x =>
            class extends x {
                constructor() {
                    super();
                    assert.step('C');
                }
            };
        Registries.PosComponentRegistry.addByExtending(C, B);

        let B7 = x =>
            class extends x {
                constructor() {
                    super();
                    assert.step('B7');
                }
            };
        Registries.PosComponentRegistry.extend(B, B7);

        Registries.PosComponentRegistry.freeze();

        const RegA = Registries.PosComponentRegistry.get(A);
        const RegB = Registries.PosComponentRegistry.get(B);
        const RegC = Registries.PosComponentRegistry.get(C);
        let c = new RegC();
        assert.verifySteps(['A', 'A1', 'B', 'B7', 'C']);
        assert.ok(c instanceof RegA);
        assert.ok(c instanceof RegB);
        assert.ok(c instanceof RegC);
        assert.ok(RegC.name === 'C');
    });

    QUnit.test('deeper inheritance', async function(assert) {
        assert.expect(9);

        class A {
            constructor() {
                assert.step('A');
            }
        }
        Registries.PosComponentRegistry.add(A);

        let B = x =>
            class extends x {
                constructor() {
                    super();
                    assert.step('B');
                }
            };
        Registries.PosComponentRegistry.addByExtending(B, A);

        let A1 = x =>
            class extends x {
                constructor() {
                    super();
                    assert.step('A1');
                }
            };
        Registries.PosComponentRegistry.extend(A, A1);

        let C = x =>
            class extends x {
                constructor() {
                    super();
                    assert.step('C');
                }
            };
        Registries.PosComponentRegistry.addByExtending(C, B);

        let B2 = x =>
            class extends x {
                constructor() {
                    super();
                    assert.step('B2');
                }
            };
        Registries.PosComponentRegistry.extend(B, B2);

        let B3 = x =>
            class extends x {
                constructor() {
                    super();
                    assert.step('B3');
                }
            };
        Registries.PosComponentRegistry.extend(B, B3);

        let A9 = x =>
            class extends x {
                constructor() {
                    super();
                    assert.step('A9');
                }
            };
        Registries.PosComponentRegistry.extend(A, A9);

        let E = x =>
            class extends x {
                constructor() {
                    super();
                    assert.step('E');
                }
            };
        Registries.PosComponentRegistry.addByExtending(E, C);

        Registries.PosComponentRegistry.freeze();

        // |A| => A9 -> A1 -> A
        // |B| => B3 -> B2 -> B -> |A|
        // |C| => C -> |B|
        // |E| => E -> |C|

        new (Registries.PosComponentRegistry.get(E))();
        assert.verifySteps(['A', 'A1', 'A9', 'B', 'B2', 'B3', 'C', 'E']);
    });

    QUnit.test('mixins?', async function(assert) {
        assert.expect(12);

        class A {
            constructor() {
                assert.step('A');
            }
        }
        Registries.PosComponentRegistry.add(A);

        let Mixin = x =>
            class extends x {
                constructor() {
                    super();
                    assert.step('Mixin');
                }
                mixinMethod() {
                    return 'mixinMethod';
                }
                get mixinGetter() {
                    return 'mixinGetter';
                }
            };

        // use the mixin when declaring B.
        let B = x =>
            class extends Mixin(x) {
                constructor() {
                    super();
                    assert.step('B');
                }
            };
        Registries.PosComponentRegistry.addByExtending(B, A);

        let A1 = x =>
            class extends x {
                constructor() {
                    super();
                    assert.step('A1');
                }
            };
        Registries.PosComponentRegistry.extend(A, A1);

        Registries.PosComponentRegistry.freeze();

        B = Registries.PosComponentRegistry.get(B);
        const b = new B();
        assert.verifySteps(['A', 'A1', 'Mixin', 'B']);
        // instance of B should have the mixin properties
        assert.strictEqual(b.mixinMethod(), 'mixinMethod');
        assert.strictEqual(b.mixinGetter, 'mixinGetter');

        // instance of A should not have the mixin properties
        A = Registries.PosComponentRegistry.get(A);
        const a = new A();
        assert.verifySteps(['A', 'A1']);
        assert.notOk(a.mixinMethod);
        assert.notOk(a.mixinGetter);
    });

    QUnit.test('extending methods', async function(assert) {
        assert.expect(16);

        class A {
            foo() {
                assert.step('A foo');
            }
        }
        Registries.PosComponentRegistry.add(A);

        let B = x =>
            class extends x {
                bar() {
                    assert.step('B bar');
                }
            };
        Registries.PosComponentRegistry.addByExtending(B, A);

        let A1 = x =>
            class extends x {
                bar() {
                    assert.step('A1 bar');
                    // should only be for A.
                }
            };
        Registries.PosComponentRegistry.extend(A, A1);

        let B1 = x =>
            class extends x {
                foo() {
                    super.foo();
                    assert.step('B1 foo');
                }
            };
        Registries.PosComponentRegistry.extend(B, B1);

        let C = x =>
            class extends x {
                foo() {
                    super.foo();
                    assert.step('C foo');
                }
                bar() {
                    super.bar();
                    assert.step('C bar');
                }
            };
        Registries.PosComponentRegistry.addByExtending(C, B);

        Registries.PosComponentRegistry.freeze();

        A = Registries.PosComponentRegistry.get(A);
        B = Registries.PosComponentRegistry.get(B);
        C = Registries.PosComponentRegistry.get(C);
        const a = new A();
        const b = new B();
        const c = new C();

        a.foo();
        assert.verifySteps(['A foo']);
        b.foo();
        assert.verifySteps(['A foo', 'B1 foo']);
        c.foo();
        assert.verifySteps(['A foo', 'B1 foo', 'C foo']);

        a.bar();
        assert.verifySteps(['A1 bar']);
        b.bar();
        assert.verifySteps(['B bar']);
        c.bar();
        assert.verifySteps(['B bar', 'C bar']);
    });
});
