odoo.define('google_spreadsheet.spreadsheet_test', function (require) {
"use strict";

var ListView = require('web.ListView');
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
                    },
                    {
                        id: 2,
                        name: "spread sheet 2",
                        url: "www.google.com",
                        description: "Demo spread sheet"
                    }]
            },
        };
    }
},function () {
    QUnit.module('TreeView');
    QUnit.test('google spreadsheets form view test', function (assert) {
        var done = assert.async();
        assert.expect(2);
        var form_view = createAsyncView({
            View: ListView,
            model:'google_sheet',
            data:this.data,
            arch:'<tree string="Google Spreadsheets">'+
                    '<field name="name" string="Name"/>'+
                    '<field name="url"/>'+
                 '</tree>',
        }).then(function (form) {
            var re = /google\.com\/spreadsheets*/;
            var valid_url =  form.$el.find('.o_data_cell')[1].textContent;
            var invalid_url = form.$el.find('.o_data_cell')[3].textContent;
            assert.ok(re.test(valid_url),"Should display the correct spreadsheet url");
            assert.notOk(re.test(invalid_url), "Should not display the correct spreadsheet url");
            form.destroy();
            done();
        });
    });
});
});
