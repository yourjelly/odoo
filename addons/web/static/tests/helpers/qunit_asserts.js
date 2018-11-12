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
        if (typeof n !== 'number') {
            throw Error("containsN assert should be called with a number as second argument");
        }
        var args = _processArguments(selector, w, msg);
        var matches = args.matches;
        msg = args.msg || `selector ${selector} should have exactly ${n} match(es)`;
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
    QUnit.assert.doesNotHaveClass = function (selector, className, w, msg) {
        _checkClass(selector, className, false, w, msg);
    };

    /**
     * assert.hasClass(selector, attr, value, widget, [msg]) // priority
     * assert.hasClass(selector, attr, value, $el, [msg])
     * assert.hasClass(selector, attr, value, el, [msg])
     * assert.hasClass(selector, attr, value, [msg])
     */
    QUnit.assert.hasAttrValue = function (selector, attr, value, w, msg) {
        var args = _processArguments(selector, w, msg);
        var matches = args.matches;

        if (matches.length != 1) {
            QUnit.assert.ok(false, `${selector} matches ${matches.length} elements instead of 1`);
        } else {
            msg = args.msg || `attribute '${attr}' for ${selector} should be '${value}'`;
            QUnit.assert.strictEqual(matches[0].getAttribute(attr), value, msg);
        }
    };

    QUnit.assert.isVisible = function(selector, w, msg) {
        _checkVisible(selector, true, w, msg);
    };
    QUnit.assert.isInvisible = function(selector, w, msg) {
        _checkVisible(selector, false, w, msg);
    };

    function _checkVisible (selector, shouldBeVisible, w, msg) {
        var args = _processArguments(selector, w, msg);
        var matches = args.matches;
        msg = args.msg;
        if (matches.length != 1) {
            QUnit.assert.ok(false, `${selector} matches ${matches.length} elements instead of 1`);
        } else {
            msg = msg || `${selector} should ${shouldBeVisible ? '' : 'not'} be visible`;
            var isVisible = matches.is(':visible');
            var condition = shouldBeVisible ? isVisible : !isVisible;
            QUnit.assert.ok(condition, msg);
        }
    }
    function _checkClass (selector, className, shouldHaveClass, w, msg) {
        var args = _processArguments(selector, w, msg);
        var matches = args.matches;

        if (matches.length != 1) {
            QUnit.assert.ok(false, `${selector} matches ${matches.length} elements instead of 1`);
        } else {
            msg = args.msg || `${selector} should ${shouldHaveClass ? '' : 'not'} have className ${className}`;
            var hasClass = matches[0].classList.contains(className);
            var condition = shouldHaveClass ? hasClass : !hasClass;
            QUnit.assert.ok(condition, msg);
        }
    }
    function _processArguments (selector, w, msg) {
        var matches, widget, $el;
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
        if (widget) {
            matches = widget.$(selector);
        } else {
            matches = $el.find(selector);
        }
        return {matches: matches, msg: msg};
    }
});
