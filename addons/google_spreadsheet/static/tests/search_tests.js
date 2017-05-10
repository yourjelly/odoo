odoo.define('google_spreadsheet.spreadsheet_test', function (require) {
"use strict";

var FormView = require('web.ListView');
var testUtils = require('web.test_utils');

var createAsyncView = testUtils.createAsyncView;

QUnit.module('google_spreadsheet', {
    beforeEach: function () {
        this.data = {
            google_sheet: {
                fields: {
                    name: {string: "name", type: "char"},
                    url: {string: "url" , type:"char"},
                    description: {string: "description" , type:"text"}
                },
                records: [{
                        id: 1, 
                        name: "spread sheet 1", 
                        url: "https://docs.google.com/spreadsheets/d/1WwC02z1JgngU8J6M08kZQkMZ3DI_XR7SwF5QSfjxFsE/edit#gid=0", 
                        description: "Demo spread sheet"
                    }]
            },
        };
    }
},function () {
    QUnit.module('TreeView');

    QUnit.test('google spreadsheets form view test', function (assert) {
        var done = assert.async();
        assert.expect(1);

        createAsyncView({
            View:FormView,
            model:'google_sheet',
            data:this.data,
            arch:'<tree string="Google Spreadsheets">'+
                    '<field name="name" string="Name"/>'+
                    '<field name="url"/>'+
                 '</tree>',
        }).then(function (form) {
            assert.strictEqual(form.$('.o_data_row').length, 1,"should contain one url");
            form.destroy();
            done();
        });
    });
});
});
