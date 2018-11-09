odoo.define('web.qunit_asserts', function (require) {
    "use strict";

    var Widget = require('web.Widget');

    /**
     *
     * assert.containsOnce(selector, widget, [msg]) // priority...
     * assert.containsOnce(selector, $el, [msg])
     * assert.containsOnce(selector, el, [msg])
     * assert.containsOnce(selector, [msg])
     */
    QUnit.assert.containsN = function (selector, n, w, message) {
        var widget, $el, el;

        if (w instanceof Widget) {
            widget = w;
        } else if (typeof w === 'string') {
            message = w;
        } else if (typeof w === Array) {
            $el = w;
        } else {
            el = w;
        }

        var matches;
        if (widget) {
            matches = widget.$(selector);
        } else if ($el) {
            matches = $el.find(selector);
        } else if (el) {
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



    // assert.containsN(widget, selector, n, [msg]) // priority...
    // assert.containsN($el, selector, n, [msg])
    // assert.containsN(el, selector, n, [msg])
    // assert.containsN(selector, n, [msg])

});
