odoo.define('web.qunit_asserts', function (require) {
    "use strict";

    var Widget = require('web.Widget');

    /**
     * assert.containsN(widget, selector, n, [msg])
     * assert.containsN($el, selector, n, [msg])
     * assert.containsN(el, selector, n, [msg])
     */
    QUnit.assert.containsN = function (w, selector, n, msg) {
        if (typeof n !== 'number') {
            throw Error("containsN assert should be called with a number as second argument");
        }
        var $el = w instanceof Widget ? w.$el :
                  w instanceof HTMLElement ? $(w) :
                  w;  // jquery element

        var $matches = $el.find(selector);
        if (!msg) {
            msg = `Selector '${selector}' should have exactly ${n} matches`;
            if ($el.selector) {
                msg += ` (inside '${$el.selector}')`;
            }
        }
        QUnit.assert.strictEqual($matches.length, n, msg);
    };

    /**
     * assert.containsOnce(widget, selector, [msg])
     * assert.containsOnce($el, selector, [msg])
     * assert.containsOnce(el, selector, [msg])
     */
    QUnit.assert.containsOnce = function (w, selector, msg) {
        QUnit.assert.containsN(w, selector, 1, msg);
    };

    /**
     * assert.containsNone(widget, selector, [msg])
     * assert.containsNone($el, selector, [msg])
     * assert.containsNone(el, selector, [msg])
     */
    QUnit.assert.containsNone = function (w, selector, msg) {
        QUnit.assert.containsN(w, selector, 0, msg);
    };

    /**
     * assert.hasClass(widget, className, [msg])
     * assert.hasClass($el, className, [msg])
     * assert.hasClass(el, className, [msg])
     */
    QUnit.assert.hasClass = function (w, className, msg) {
        _checkClass(w, className, true, msg);
    };

    /**
     * assert.hasClass(widget, className, [msg])
     * assert.hasClass($el, className, [msg])
     * assert.hasClass(el, className, [msg])
     */
    QUnit.assert.doesNotHaveClass = function (w, className, msg) {
        _checkClass(w, className, false, msg);
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
    function _checkClass (w, className, shouldHaveClass, msg) {
        var $el = w instanceof Widget ? w.$el :
                  w instanceof HTMLElement ? $(w) :
                  w;  // jquery element

        if ($el.length !== 1) {
            QUnit.assert.ok(false, `Assertion targets ${selector} matches ${$el.length} elements instead of 1`);

        }
        // var args = _processArguments(selector, w, msg);
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
