odoo.define('crm.crm_kanban_tests', function (require) {
"use strict";

var KanbanView = require('web.KanbanView');
var testUtils = require('web.test_utils');
var view_registry = require('web.view_registry');


var createView = testUtils.createView;

QUnit.module('crm', {
    beforeEach: function () {
        this.data = {
            'ir.attachment': {
                fields: {
                    name: {
                        string: "Name",
                        type: "char"
                    },
                },
                records: [{
                        id: 1,
                        name: "1.png"
                    },
                    {
                        id: 2,
                        name: "2.png"
                    },
                ]
            },
            'crm.lead': {
                fields: {
                    name: {
                        string: "Task Title",
                        type: "char"
                    },
                    sequence: {
                        string: "sequence",
                        type: "integer"
                    },
                    displayed_image_id: {
                        string: "cover",
                        type: "many2one",
                        relation: "ir.attachment"
                    },
                    kanban_state: {
                        string: "State",
                        type: "selection",
                        selection: [
                            ["normal", "Kam Chalu"],
                            ["done", "Kam Popa"],
                            ["blocked", "Locha Padiya"]
                        ]
                    },
                    product_id: {
                        string: "something_id",
                        type: "many2one",
                        relation: "product"
                    },
                    planned_revenue: {
                        string: "Planned revenue",
                        type: "float",
                    },
                },
                records: [
                    {id: 1, name: "task1 fix", sequence: 1, kanban_state: "blocked", product_id: 3, planned_revenue: 100},
                    {id: 2, name: "task2 issue", sequence: 2, kanban_state: "done", product_id: 3, planned_revenue: 200},
                    {id: 3, name: "task3 improvement", sequence: 2, kanban_state: "done", product_id: 5, planned_revenue: 300},
                    {id: 4, name: "task4 clone", sequence: 2, kanban_state: "normal", product_id: 5, planned_revenue: 400}
                ]
            },
            product: {
                fields: {
                    id: {string: "ID", type: "integer"},
                    name: {string: "Display Name", type: "char"},
                },
                records: [
                    {id: 3, name: "chagan"},
                    {id: 5, name: "magan"},
                ]
            },
        };
    }
});

QUnit.test('Crm Kanban Progress Bar Test', function (assert) {
    assert.expect(2);
    var kanban = createView({
        View: view_registry.get('crm_kanban'),
        model: 'crm.lead',
        data: this.data,
        arch: '<kanban on_create="quick_create">' +
                    '<field name="product_id"/>' +
                    '<templates><t t-name="kanban-box">' +
                        '<div><field name="name"/><br/>' +
                        '<field name="kanban_state" widget="state_selection"/>' +
                        '</div>' +
                    '</t></templates>' +
                '</kanban>',
        groupBy: ['product_id'],
    });
    kanban.appendTo('body');
    // assert.strictEqual(kanban.$('.o_kanban_counter').length,this.data.product.records.length, "Kanban counter should be created.");
    // var record_length = kanban.$('.o_kanban_group')[0];
    // assert.strictEqual(parseInt(kanban.$('.o_kanban_counter_side')[0].innerText), kanban.$('.o_kanban_group')[0].childNodes.length - 4, "Kanban counter should be display correct no of records");
    // kanban.destroy();
});

});
