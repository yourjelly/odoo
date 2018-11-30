odoo.define('web.registry_tests', function (require) {
"use strict";

var Registry = require('web.Registry');

QUnit.module('core', {}, function () {

    QUnit.module('Registry');

    QUnit.test('key set', function (assert) {
        assert.expect(1);

        var registry = new Registry();
        var foo = {};

        registry
            .add('foo', foo);

        assert.strictEqual(registry.get('foo'), foo);
    });


    QUnit.test('multiget', function (assert) {
        assert.expect(1);

        var foo = {};
        var bar = {};
        var registry = new Registry({
            foo: foo,
            bar: bar,
        });
        assert.strictEqual(
            registry.getAny(['qux', 'grault', 'bar', 'foo']),
            bar,
            "Registry getAny should find first defined key");
    });

});

});

