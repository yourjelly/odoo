odoo.define('web.widget_tests', function (require) {
"use strict";

var concurrency = require('web.concurrency');
var core = require('web.core');
var QWeb = require('web.QWeb');
var Widget = require('web.Widget');

QUnit.module('core', {}, function () {

    QUnit.module('Widget');

    QUnit.test('proxy (String)', function (assert) {
        assert.expect(1);

        var W = Widget.extend({
            exec: function () {
                this.executed = true;
            }
        });
        var w = new W();
        var fn = w.proxy('exec');
        fn();
        assert.ok(w.executed, 'should execute the named method in the right context');
    });

    QUnit.test('proxy (String)(*args)', function (assert) {
        assert.expect(2);

        var W = Widget.extend({
            exec: function (arg) {
                this.executed = arg;
            }
        });
        var w = new W();
        var fn = w.proxy('exec');
        fn(42);
        assert.ok(w.executed, "should execute the named method in the right context");
        assert.strictEqual(w.executed, 42, "should be passed the proxy's arguments");
    });

    QUnit.test('proxy (String), include', function (assert) {
        assert.expect(1);

        // the proxy function should handle methods being changed on the class
        // and should always proxy "by name", to the most recent one
        var W = Widget.extend({
            exec: function () {
                this.executed = 1;
            }
        });
        var w = new W();
        var fn = w.proxy('exec');
        W.include({
            exec: function () { this.executed = 2; }
        });

        fn();
        assert.strictEqual(w.executed, 2, "should be lazily resolved");
    });

    QUnit.test('proxy (Function)', function (assert) {
        assert.expect(1);

        var w = new (Widget.extend({ }))();

        var fn = w.proxy(function () { this.executed = true; });
        fn();
        assert.ok(w.executed, "should set the function's context (like Function#bind)");
    });

    QUnit.test('proxy (Function)(*args)', function (assert) {
        assert.expect(1);

        var w = new (Widget.extend({ }))();

        var fn = w.proxy(function (arg) { this.executed = arg; });
        fn(42);
        assert.strictEqual(w.executed, 42, "should be passed the proxy's arguments");
    });



    QUnit.test('renderElement, no template, default', function (assert) {
        assert.expect(7);

        var widget = new (Widget.extend({ }))();

        assert.strictEqual(widget.$el, undefined, "should not have a root element");

        widget.renderElement();

        assert.ok(widget.$el, "should have generated a root element");
        assert.strictEqual(widget.$el, widget.$el, "should provide $el alias");
        assert.ok(widget.$el.is(widget.el), "should provide raw DOM alias");

        assert.strictEqual(widget.el.nodeName, 'DIV', "should have generated the default element");
        assert.strictEqual(widget.el.attributes.length, 0, "should not have generated any attribute");
        assert.ok(_.isEmpty(widget.$el.html(), "should not have generated any content"));
    });

    QUnit.test('no template, custom tag', function (assert) {
        assert.expect(1);


        var widget = new (Widget.extend({
            tagName: 'ul'
        }))();
        widget.renderElement();

        assert.strictEqual(widget.el.nodeName, 'UL', "should have generated the custom element tag");
    });

    QUnit.test('no template, @id', function (assert) {
        assert.expect(3);

        var widget = new (Widget.extend({
            id: 'foo'
        }))();
        widget.renderElement();

        assert.strictEqual(widget.el.attributes.length, 1, "should have one attribute");
        assert.strictEqual(widget.$el.attr('id'), 'foo', "should have generated the id attribute");
        assert.strictEqual(widget.el.id, 'foo', "should also be available via property");
    });

    QUnit.test('no template, @className', function (assert) {
        assert.expect(2);

        var widget = new (Widget.extend({
            className: 'oe_some_class'
        }))();
        widget.renderElement();

        assert.strictEqual(widget.el.className, 'oe_some_class', "should have the right property");
        assert.strictEqual(widget.$el.attr('class'), 'oe_some_class', "should have the right attribute");
    });

    QUnit.test('no template, bunch of attributes', function (assert) {
        assert.expect(9);

        var widget = new (Widget.extend({
            attributes: {
                'id': 'some_id',
                'class': 'some_class',
                'data-foo': 'data attribute',
                'clark': 'gable',
                'spoiler': // don't read the next line if you care about Harry Potter...
                        'snape kills dumbledore'
            }
        }))();
        widget.renderElement();

        assert.strictEqual(widget.el.attributes.length, 5, "should have all the specified attributes");

        assert.strictEqual(widget.el.id, 'some_id');
        assert.strictEqual(widget.$el.attr('id'), 'some_id');

        assert.strictEqual(widget.el.className, 'some_class');
        assert.strictEqual(widget.$el.attr('class'), 'some_class');

        assert.strictEqual(widget.$el.attr('data-foo'), 'data attribute');
        assert.strictEqual(widget.$el.data('foo'), 'data attribute');

        assert.strictEqual(widget.$el.attr('clark'), 'gable');
        assert.strictEqual(widget.$el.attr('spoiler'), 'snape kills dumbledore');
    });

    QUnit.test('template', function (assert) {
        assert.expect(3);

        core.qweb.add_template(
            '<no>' +
                '<t t-name="test.widget.template">' +
                    '<ol>' +
                        '<li t-foreach="5" t-as="counter" ' +
                            't-attf-class="class-#{counter}">' +
                            '<input/>' +
                            '<t t-esc="counter"/>' +
                        '</li>' +
                    '</ol>' +
                '</t>' +
            '</no>'
        );

        var widget = new (Widget.extend({
            template: 'test.widget.template'
        }))();
        widget.renderElement();

        assert.strictEqual(widget.el.nodeName, 'OL');
        assert.strictEqual(widget.$el.children().length, 5);
        assert.strictEqual(widget.el.textContent, '01234');
    });

    QUnit.test('repeated', function (assert) {
        assert.expect(4);
        var $fix = $( "#qunit-fixture");

        core.qweb.add_template(
            '<no>' +
                '<t t-name="test.widget.template">' +
                    '<p><t t-esc="widget.value"/></p>' +
                '</t>' +
            '</no>'
        );
        var widget = new (Widget.extend({
            template: 'test.widget.template'
        }))();
        widget.value = 42;

        return widget.appendTo($fix)
            .done(function () {
                assert.strictEqual($fix.find('p').text(), '42', "DOM fixture should contain initial value");
                assert.strictEqual(widget.$el.text(), '42', "should set initial value");
                widget.value = 36;
                widget.renderElement();
                assert.strictEqual($fix.find('p').text(), '36', "DOM fixture should use new value");
                assert.strictEqual(widget.$el.text(), '36', "should set new value");
            });
    });


    QUnit.module('Widgets, with QWeb', {
        beforeEach: function() {
            this.oldQWeb = core.qweb;
            core.qweb = new QWeb();
            core.qweb.add_template(
                '<no>' +
                    '<t t-name="test.widget.template">' +
                        '<ol>' +
                            '<li t-foreach="5" t-as="counter" ' +
                                't-attf-class="class-#{counter}">' +
                                '<input/>' +
                                '<t t-esc="counter"/>' +
                            '</li>' +
                        '</ol>' +
                    '</t>' +
                '</no>'
            );
        },
        afterEach: function() {
            core.qweb = this.oldQWeb;
        },
    });

    QUnit.test('basic-alias', function (assert) {
        assert.expect(1);


        var widget = new (Widget.extend({
            template: 'test.widget.template'
        }))();
        widget.renderElement();

        assert.ok(widget.$('li:eq(3)').is(widget.$el.find('li:eq(3)')),
            "should do the same thing as calling find on the widget root");
    });


    QUnit.test('delegate', function (assert) {
        assert.expect(5);

        var a = [];
        var widget = new (Widget.extend({
            template: 'test.widget.template',
            events: {
                'click': function () {
                    a[0] = true;
                    assert.strictEqual(this, widget, "should trigger events in widget");
                },
                'click li.class-3': 'class3',
                'change input': function () { a[2] = true; }
            },
            class3: function () { a[1] = true; }
        }))();
        widget.renderElement();

        widget.$el.click();
        widget.$('li:eq(3)').click();
        widget.$('input:last').val('foo').change();

        for(var i=0; i<3; ++i) {
            assert.ok(a[i], "should pass test " + i);
        }
    });

    QUnit.test('undelegate', function (assert) {
        assert.expect(4);

        var clicked = false;
        var newclicked = false;

        var widget = new (Widget.extend({
            template: 'test.widget.template',
            events: { 'click li': function () { clicked = true; } }
        }))();

        widget.renderElement();
        widget.$el.on('click', 'li', function () { newclicked = true; });

        widget.$('li').click();
        assert.ok(clicked, "should trigger bound events");
        assert.ok(newclicked, "should trigger bound events");

        clicked = newclicked = false;
        widget._undelegateEvents();
        widget.$('li').click();
        assert.ok(!clicked, "undelegate should unbind events delegated");
        assert.ok(newclicked, "undelegate should only unbind events it created");
    });

    QUnit.module('Widget, and async stuff');

    QUnit.test("alive(alive)", function (assert) {
        assert.expect(1);

        var widget = new (Widget.extend({}));

        return concurrency.asyncWhen(widget.start())
            .then(function () { return widget.alive(concurrency.asyncWhen()); })
            .then(function () { assert.ok(true); });
    });

    QUnit.test("alive(dead)", function (assert) {
        assert.expect(1);
        var widget = new (Widget.extend({}));

        return $.Deferred(function (d) {
            concurrency.asyncWhen(widget.start())
            .then(function () {
                // destroy widget
                widget.destroy();
                var promise = concurrency.asyncWhen();
                // leave time for alive() to do its stuff
                promise.then(function () {
                    return concurrency.asyncWhen();
                }).then(function () {
                    assert.ok(true);
                    d.resolve();
                });
                // ensure that widget.alive() refuses to resolve or reject
                return widget.alive(promise);
            }).always(function () {
                d.reject();
                assert.ok(false, "alive() should not terminate by default");
            });
        });
    });

    QUnit.test("alive(alive, true)", function (assert) {
        assert.expect(1);
        var widget = new (Widget.extend({}));
        return concurrency.asyncWhen(widget.start())
        .then(function () { return widget.alive(concurrency.asyncWhen(), true) })
        .then(function () { assert.ok(true); });
    });

    QUnit.test("alive(dead, true)", function (assert) {
        assert.expect(1);
        var done = assert.async();

        var widget = new (Widget.extend({}));

        concurrency.asyncWhen(widget.start())
        .then(function () {
            // destroy widget
            widget.destroy();
            return widget.alive(concurrency.asyncWhen(), true);
        }).then(function () {
            assert.ok(false, "alive(p, true) should fail its promise");
            done();
        }, function () {
            assert.ok(true, "alive(p, true) should fail its promise");
            done();
        });
    });

    QUnit.test("calling _rpc on destroyed widgets", function (assert) {
        assert.expect(1);

        var widget = new Widget();
        widget.destroy();
        widget._rpc({route: '/a/route'}).always(function () {
            throw Error("Calling _rpc on a destroyed widget should return a " +
                "deferred that is never resolved nor rejected");
        });
        assert.ok(true,
            "there should be no crash when calling _rpc on a destroyed widget");
    });

    QUnit.module('Widget lifecycle');

    function makeWidget(assert, props, parent) {
        var TestWidget = Widget.extend({
            init: function () {
                assert.step('init');
                this._super.apply(this, arguments);
            },
            willStart: function () {
                assert.step('willStart');
                return this._super.apply(this, arguments);
            },
            start: function () {
                assert.step('start');
                return this._super.apply(this, arguments);
            },
            mounted: function () {
                assert.step('mounted');
            },
            willUnmount: function () {
                assert.step('willUnmount');
            },
            destroy: function () {
                this._super.apply(this, arguments);
                assert.step('destroy');
            },
        }, props);
        return new TestWidget(parent);
    }

    QUnit.test("mounted and willUnmount hooks are called when put in DOM", function (assert) {
        assert.expect(9);

        var widget = makeWidget(assert);
        assert.verifySteps(['init']);

        var $fix = $( "#qunit-fixture");
        widget.appendTo($fix);
        assert.verifySteps(['init', 'willStart', 'start', 'mounted']);
        widget.destroy();
        assert.verifySteps(['init', 'willStart', 'start', 'mounted', 'willUnmount', 'destroy']);
    });

    QUnit.test("mounted and willUnmount hooks are not called when not put in DOM", function (assert) {
        assert.expect(7);

        var widget = makeWidget(assert);

        assert.verifySteps(['init']);

        var $fix = $( "<div>");
        widget.appendTo($fix);
        assert.verifySteps(['init', 'willStart', 'start']);
        widget.destroy();
        assert.verifySteps(['init', 'willStart', 'start', 'destroy']);
    });

    QUnit.test("widgets can be detached and reappended (if not in dom)", function (assert) {
        assert.expect(8);
        var widget = makeWidget(assert);

        assert.verifySteps(['init']);

        var $fix = $( "<div>");
        widget.appendTo($fix);
        assert.verifySteps(['init', 'willStart', 'start']);
        widget.detach();
        assert.verifySteps(['init', 'willStart', 'start']);
        widget.appendTo($('<div>'));
        assert.verifySteps(['init', 'willStart', 'start']);
        widget.destroy();
    });

    QUnit.test("widgets can be detached and reappended (in dom)", function (assert) {
        assert.expect(10);
        var widget = makeWidget(assert);

        assert.verifySteps(['init']);

        var $fix = $( "#qunit-fixture");
        widget.appendTo($fix);
        assert.verifySteps(['init', 'willStart', 'start', 'mounted']);
        widget.detach();
        assert.verifySteps(['init', 'willStart', 'start', 'mounted', 'willUnmount']);
        widget.appendTo($('<div>'));
        assert.verifySteps(['init', 'willStart', 'start', 'mounted', 'willUnmount']);
        widget.destroy();
    });

    QUnit.test("widgets can be destroyed before being started", function (assert) {
        assert.expect(4);
        var widget = makeWidget(assert);

        assert.verifySteps(['init']);
        widget.destroy();

        assert.verifySteps(['init', 'destroy']);
    });

    QUnit.test("widgets can be destroyed after willStart, but before being started", function (assert) {
        assert.expect(6);
        var def = $.Deferred();
        var widget = makeWidget(assert, {
            willStart: function () {
                assert.step('willStart');
                return def;
            },
        });

        var $fix = $( "#qunit-fixture");
        widget.appendTo($fix);

        assert.verifySteps(['init', 'willStart']);
        widget.destroy();

        assert.verifySteps(['init', 'willStart', 'destroy']);

        def.resolve();

        assert.verifySteps(['init', 'willStart', 'destroy']);
    });

    QUnit.test("widgets can be reappendedTo without being detached", function (assert) {
        assert.expect(8);

        var $fix = $( "#qunit-fixture");
        var $div1 = $('<div>');
        var $div2 = $('<div>');
        $fix.append($div1).append($div2);

        var widget = makeWidget(assert);
        widget.appendTo($div1);
        assert.verifySteps(['init', 'willStart', 'start', 'mounted']);
        widget.appendTo($div2);
        assert.verifySteps(['init', 'willStart', 'start', 'mounted']);
        widget.destroy();
    });

    QUnit.test("widgets can be reappendedTo after being detached", function (assert) {
        assert.expect(11);

        var $fix = $( "#qunit-fixture");
        var $div1 = $('<div>');
        var $div2 = $('<div>');
        $fix.append($div1).append($div2);

        var widget = makeWidget(assert);
        widget.appendTo($div1);
        assert.verifySteps(['init', 'willStart', 'start', 'mounted']);
        widget.detach();
        assert.verifySteps(['init', 'willStart', 'start', 'mounted', 'willUnmount']);
        widget.appendTo($div2);
        assert.verifySteps(['init', 'willStart', 'start', 'mounted', 'willUnmount', 'mounted']);
        widget.destroy();
    });

    QUnit.test("widgets can be detached twice in a row", function (assert) {
        assert.expect(7);

        var $fix = $( "#qunit-fixture");

        var widget = makeWidget(assert);
        widget.appendTo($fix);
        widget.detach();
        widget.detach();
        assert.verifySteps(['init', 'willStart', 'start', 'mounted', 'willUnmount']);
        widget.destroy();
    });

    QUnit.test("subwidget hooks are properly called", function (assert) {
        assert.expect(10);

        var $fix = $( "#qunit-fixture");

        var ParentWidget = Widget.extend({
            start: function () {
                var widget = makeWidget(assert, {
                    willUnmount: function () {
                        assert.ok(document.contains(this.el), 'node should still be in dom');
                        assert.step('willUnmount');
                    },
                }, parent);
                assert.verifySteps(['init']);
                return widget.appendTo(this.$el);
            },
        });
        var parent = new ParentWidget();
        parent.appendTo($fix);
        assert.verifySteps(['init', 'willStart', 'start', 'mounted']);
        parent.destroy();
        assert.verifySteps(['init', 'willStart', 'start', 'mounted', 'willUnmount', 'destroy']);
    });

});

});