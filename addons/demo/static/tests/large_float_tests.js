odoo.define('demo.large_float_tests', function (require) {
"use strict";

var FormView = require('web.FormView');
var testUtils = require('web.test_utils');

// In this file, we add an example of a unit test.  This illustrates how we can
// add demo data to each tests, and create a form view with our large_float
// widget, and make sure it behaves like we expect.
//
// To run these tests, one can visit the following url:
//          http://localhost:8069/web/tests?module=LargeFloat
// (replace the localhost:8069 with the actual url of the server)
//
// For more example of tests, the file basic_fields_tests.js (in addon web)
// contains a large variety of testcases.

QUnit.module('LargeFloat', {
    beforeEach: function () {
        // we add here test data, which is available for each test cases in this
        // test module
        this.data = {
            partner: {
                fields: {qux: {string: "Qux", type: "float"}},
                records: [{id: 1, qux: 0.44444}]
            },
        };
    }
}, function () {

    QUnit.test('properly parse a float value with a k', function (assert) {
        assert.expect(1);

        // the createView helper create a view, which is connected to a fake
        // in memory server (see MockServer in mock_server.js). This fake
        // server is given the this.data as source of data, and will properly
        // answer to each rpc initiated by the form view.
        //
        // This allows tests to mimick the exact environment, without actually
        // hitting the database.
        var form = testUtils.createView({
            View: FormView,
            model: 'partner',
            data: this.data,
            arch:'<form string="Partners">' +
                    '<sheet>' +
                    '<field name="qux" widget="large_float"/>' +
                    '</sheet>' +
                '</form>',
            res_id: 1,
            viewOptions: {mode: 'edit'},
        });

        // enter 3.5k in the input for the large_float widget
        form.$('input[name="qux"]').val('3.5k').trigger('input');

        // save the form view (which put it in readonly mode)
        form.$buttons.find('.o_form_button_save').click();

        // we check here that the widget actually saved the 3500 value
        assert.strictEqual(form.$('span[name="qux"]').text(), '3500.00',
            "the value with the k was properly parsed");

        // do not forget to destroy everything that was created in this test.
        form.destroy();
    });
});

});
