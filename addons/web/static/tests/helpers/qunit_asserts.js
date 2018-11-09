odoo.define('web.qunit_asserts', function (require) {
    "use strict"

    var Widget = require('web.Widget');

    assert.containsOnce(widget, selector, [msg]) // priority...
    assert.containsOnce($el, selector, [msg])
    assert.containsOnce(el, selector, [msg])
    assert.containsOnce(selector, [msg])


    /**
     * [containsOnce description]
     * @param {[type]} widget [description]
     * @param {[type]} selector [description]
     * @param {[type]} msg [description]
     * @returns {[type]} [description]
     */
    assert.containsOnce = function (w, s, m) {
        var widget = w instanceof Widget ? w : null;
        var selector = (!w && typeof w == 'string') ? w : null;
    }




    // assert.containsN(widget, selector, n, [msg]) // priority...
    // assert.containsN($el, selector, n, [msg])
    // assert.containsN(el, selector, n, [msg])
    // assert.containsN(selector, n, [msg])

});
