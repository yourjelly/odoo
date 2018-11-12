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
    QUnit.assert.containsN = function (selector, n, w, message) {
        var widget, $el, el;

        if (w instanceof Widget) { // selector, n, widget
            widget = w;
        } else if (typeof w === 'string') { // selector n, msg
            message = w;
        } else if (typeof w === Array) { // selector n, $el
            $el = w;
        } else if (w !== undefined) { // selector n, el
            el = w;
        } else { // selector n
            el = document;
        }

        var matches;
        if (widget) {
            matches = widget.$(selector);
        } else if ($el) {
            matches = $el.find(selector);
        } else if (el) {
            // TODO: use jQuery? (see hasClass)
            matches = el.querySelectorAll(selector);
        }
        message = message || `selector ${selector} should have exactly ${n} match(es)`;
        QUnit.assert.strictEqual(matches.length, n, message);
    };
    QUnit.assert.containsOnce = function (selector, w, message) {
        QUnit.assert.containsN(selector, 1, w, message);
    };

    QUnit.assert.containsNone = function (selector, w, message) {
        QUnit.assert.containsN(selector, 0, w, message);
    };

    /**
     * assert.hasClass(selector, classNames, widget, [msg]) // priority
     * assert.hasClass(selector, classNames, $el, [msg])
     * assert.hasClass(selector, classNames, el, [msg])
     * assert.hasClass(selector, classNames, [msg])
     */
    QUnit.assert.hasClass = function (selector, className, w, msg) {
        var widget, $el;
        if (w instanceof Widget) { // selector, className, widget
            widget = w;
        } else if (typeof w === 'string') { // selector className, msg
            $el = $('body');
            msg = w;
        } else if (typeof w === Array) { // selector className, $el
            $el = w;
        } else if (w !== undefined) { // selector className, el
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

        if (matches.length != 1) {
            QUnit.assert.ok(false, `${selector} matches ${matches.length} elements instead of 1`);
        } else {
            msg = msg || `${selector} should have className ${className}`;
            QUnit.assert.ok(matches[0].classList.contains(className), msg);
        }
    }
});
