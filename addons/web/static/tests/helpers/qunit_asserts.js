odoo.define('web.qunit_asserts', function (require) {
    "use strict";

    var Widget = require('web.Widget');

    /**
     *
     * assert.containsOnce(selector, n, widget, [msg]) // priority...
     * assert.containsOnce(selector, n, $el, [msg])
     * assert.containsOnce(selector, n, el, [msg])
     * assert.containsOnce(selector, n, [msg])
     */
    QUnit.assert.containsN = function (selector, n, w, msg) {
        var widget, $el;
        if (typeof n !== 'number') {
            throw Error("containsN assert should be called with a number as second argument");
        }
        if (w instanceof Widget) { // selector,, n, widget
            widget = w;
        } else if (typeof w === 'string') { // selector, n, msg
            $el = $('body');
            msg = w;
        } else if (typeof w === Array) { // selector, n, $el
            $el = w;
        } else if (w !== undefined) { // selector, n, el
            $el = $(w);
        } else { // selector n
            $el = $('body');
        }
        var matches;
        if (widget) {
            matches = widget.$(selector);
        } else {
            matches = $el.find(selector);
        }

        msg = msg || `selector ${selector} should have exactly ${n} match(es)`;
        QUnit.assert.strictEqual(matches.length, n, msg);
    };
    QUnit.assert.containsOnce = function (selector, w, msg) {
        QUnit.assert.containsN(selector, 1, w, msg);
    };

    QUnit.assert.containsNone = function (selector, w, msg) {
        QUnit.assert.containsN(selector, 0, w, msg);
    };

    /**
     * assert.hasClass(selector, className, widget, [msg]) // priority
     * assert.hasClass(selector, className, $el, [msg])
     * assert.hasClass(selector, className, el, [msg])
     * assert.hasClass(selector, className, [msg])
     */
    QUnit.assert.hasClass = function (selector, className, w, msg) {
        _checkClass(selector, className, true, w, msg);

    };
    /**
     * assert.hasClass(selector, className, widget, [msg]) // priority
     * assert.hasClass(selector, className, $el, [msg])
     * assert.hasClass(selector, className, el, [msg])
     * assert.hasClass(selector, className, [msg])
     */
    QUnit.assert.hasNotClass = function (selector, className, w, msg) {
        _checkClass(selector, className, false, w, msg);
    };

    function _checkClass (selector, className, shouldHaveClass, w, msg) {
        var widget, $el;
        if (w instanceof Widget) { // selector, className, widget
            widget = w;
        } else if (typeof w === 'string') { // selector, className, msg
            $el = $('body');
            msg = w;
        } else if (typeof w === Array) { // selector, className, $el
            $el = w;
        } else if (w !== undefined) { // selector, className, el
            $el = $(w);
        } else { // selector, className
            $el = $('body');
        }

        var matches;
        if (widget) {
            matches = widget.$(selector);
        } else {
            matches = $el.find(selector);
        }

        if (matches.length != 1) {
            QUnit.assert.ok(false, `${selector} matches ${matches.length} elements instead of 1`);
        } else {
            msg = msg || `${selector} should ${shouldHaveClass ? '' : 'not'} have className ${className}`;
            var hasClass = matches[0].classList.contains(className);
            var condition = shouldHaveClass ? hasClass : !hasClass;
            QUnit.assert.ok(condition, msg);
        }
    };
});
