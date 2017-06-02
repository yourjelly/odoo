odoo.define('web.domain_test_field', function (require) {
"use strict";

var BasicModel = require('web.BasicModel');
var testUtils = require('web.test_utils');
var FormView = require('web.FormView');
var core = require('web.core');

var _t = core._t;
var createView = testUtils.createView;

QUnit.module('Views', {
	beforeEach: function () {
        this.data = {
            pos_order: {
                fields: {
                    statement_line_id:{string: "Payments",type:'many2one',relation:'statement_line'},
                    statement_ids : {string: "Statement",type:'many2many',relation:'statement'},
                    //statement_ids : {string: "Statement",type:'String'},
                },
                records: [
                  	{statement_line_id:9,statement_ids:[10]}
                ],
            },
            statement_line: {
            	fields: {
            		journal_id : {string: "Journals", type:'int'},
            	},
            	records: [
            		{id : 9 ,journal_id : 10},
            	],
            },
            statement:{
            	fields: {
            		journal_id : {string: "Journals", type:'int'},
            	},
            	records: [
            		{id: 10 ,journal_id : 10},
            		{id: 11 ,journal_id : 11},
            		{id: 12 ,journal_id : 12},
            	],
            },
        };
        this.data.pos_order.fields.statement_ids.relatedFields =
            $.extend(true, {}, this.data.statement.fields);
    }
},function(){
	QUnit.module('ABCDEFGH');

    QUnit.test('one two many domain test', function (assert) {
    	assert.expect(0);

    	var form = createView({
            View: FormView,
            model: 'pos_order',
            data: this.data,
            arch: '<form string="POS Orders">' +
                    '<sheet>' +
                       '<field name="statement_line_id" />' +
                       '<field name="statement_ids"/>'+
                    '</sheet>' +
                '</form>',
        });

        console.log(form);
        $("#qunit-fixture").css({'position':'static'});
    });
});

});