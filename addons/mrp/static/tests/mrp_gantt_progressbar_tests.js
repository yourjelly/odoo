odoo.define('mrp_gantt_progressbar.tests', function (require) {
"use strict";

var MrpGanttView = require('mrp.mrp_gantt_progressbar');
var testUtils = require("web.test_utils");

var initialDate = new Date(2019, 4, 1, 2, 30, 0);
initialDate = new Date(initialDate.getTime() - initialDate.getTimezoneOffset() * 60 * 1000);

var createView = testUtils.createView;

QUnit.module('mrp', {
    beforeEach: function () {
        this.data = {
            partner: {
                fields: {
                    id: {string: 'ID', type: 'integer'},
                    name: {string: 'Name', type: 'char'},
                    state: {
                        string: "State",
                        type: "selection",
                        selection: [['ready', 'Ready'], ['done', 'Done'], ['cancel', 'Cancel']],
                    },
                    color: {string: 'Color', type: 'integer'},
                    project_id: {string: 'Project', type: 'many2one', relation: 'projects'},
                    duration: {string: "Duration", type: "float"},
                    date_planned_start: {string: 'Start Date', type: 'datetime'},
                    date_planned_finished: {string: 'Stop Date', type: 'datetime'},
                },
                records: [
                    {id: 1, name: 'Task 1', state: 'ready', project_id: 1, duration: 10, color: 2, date_planned_start: '2019-05-01 09:00:00', date_planned_finished: '2019-05-01 12:00:00'},
                    {id: 2, name: 'Task 2', state: 'cancel', project_id: 2, duration: 50, color: 2, date_planned_start: '2019-05-02 10:00:00', date_planned_finished: '2019-05-02 11:00:00'},
                    {id: 3, name: 'Task 3', state: 'done', project_id: 1, duration: 60, color: 4, date_planned_start: '2019-05-03 10:00:00', date_planned_finished: '2019-05-03 13:00:00'},
                    {id: 4, name: 'Task 4', state: 'ready', project_id: 3, duration: 60, color: 2, date_planned_start: '2019-05-02 10:00:00', date_planned_finished: '2019-05-02 13:00:00'},
                    {id: 5, name: 'Task 5', state: 'ready', project_id: 3, duration: 60, color: 4, date_planned_start: '2019-05-04 11:00:00', date_planned_finished: '2019-05-04 14:00:00'},
                ],
                onchanges: {},
            },
            projects: {
                fields: {
                    id: {string: 'ID', type: 'integer'},
                    name: {string: 'Name', type: 'char'},
                },
                records: [
                    {id: 1, name: 'Project 1'},
                    {id: 2, name: 'Project 2'},
                    {id: 3, name: 'Project 3'},
                ],
            },
        };
    },
}, function () {

    QUnit.test("mrp_gantt_progressbar: basic rendering", async function (assert) {
        assert.expect(4);

        var gantt = await createView({
            View: MrpGanttView,
            model: 'partner',
            data: this.data,
            viewOptions: {
                initialDate: initialDate,
            },
            groupBy: ['project_id'],
            debug: 1,
            arch:
                '<gantt date_stop="date_planned_finished" date_start="date_planned_start" color="color" string="Tasks" create="0" js_class="mrp_gantt_progressbar">' +
                    '<field name="duration"/>' +
                    '<field name="state"/>' +
                '</gantt>',
            });

            assert.strictEqual(gantt.$('.o_gantt_row_title').length, 2,
                "There should be 2 Project");
            assert.strictEqual(gantt.$('.o_gantt_row_title').text().replace(/\s+/g, ' ').trim(), "Project 1 Project 3",
                "There should be Project 1 Project 3");
            assert.strictEqual(gantt.$('.o_gantt_pill span').length, 3,
                "There should be 2 tasks");
            assert.strictEqual(gantt.$('.o_gantt_pill span').text(), "Task 1Task 4Task 5",
                "There should be Task 1Task 4Task5");

            gantt.destroy();
    });
});
});
