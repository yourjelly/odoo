odoo.define('web.control_panel_tests', function (require) {
"use strict";

var ControlPanelView = require('web.ControlPanelView');
var testUtils = require('web.test_utils');

var createView = testUtils.createView;

QUnit.module('Views', {
    beforeEach: function () {
        this.data = {
            partner: {
                fields: {
                    display_name: { string: "Displayed name", type: 'char' },
                    foo: { string: "Foo", type: 'char', default: "My little Foo Value" },
                },
                records: [],
                onchanges: {},
            },
        };
    }
}, function () {
    QUnit.module('ControlPanelView');

    QUnit.test('basic rendering of controls', function (assert) {
        assert.expect(4);

        var controlPanel = createView({
            View: ControlPanelView,
            model: 'partner',
            data: this.data,
            arch: '<controlpanel>' +
                    '<controls>' +
                        '<button name="some_action_ref" type="action" string="Do it" class="b"/>' +
                    '</controls>' +
                '</controlpanel>',
            intercepts: {
                execute_action: function (ev) {
                    assert.deepEqual(ev.data, {
                        action_data: {
                            class: 'b',
                            name: 'some_action_ref',
                            string: 'Do it',
                            type: 'action',
                        },
                        env: {
                            context: {},
                            model: 'partner',
                        },
                    }, "should trigger execute_action with correct params");
                },
            },
        });

        assert.containsOnce(controlPanel, '.o_cp_custom_buttons',
            "should have rendered a custom button area");
        assert.containsOnce(controlPanel, '.o_cp_custom_buttons button',
            "should have rendered one custom button");
        assert.strictEqual(controlPanel.$('.o_cp_custom_buttons button.b').text(), 'Do it',
            "should have correctly rendered the custom button");

        testUtils.dom.click(controlPanel.$('.o_cp_custom_buttons button'));

        controlPanel.destroy();
    });

    // QUnit.module('search arch parsing');

    // QUnit.test('empty arch', function (assert) {
    //     assert.expect(2);

    //     var viewInfo = {arch: "<search> </search>"};

    //     var searchView = new SearchView(viewInfo, {context: {}});
    //     assert.deepEqual(searchView.loadParams.filters, []);
    //     assert.deepEqual(searchView.loadParams.groups, []);
    // });

    // QUnit.test('parse one field tag', function (assert) {
    //     assert.expect(2);
    //     var arch = "<search>" +
    //                     "<field name=\"user_id\"/>" +
    //                 "</search>";
    //     var viewInfo = {arch:  arch};

    //     var searchView = new SearchView(viewInfo, {context: {}});
    //     assert.deepEqual(
    //         searchView.loadParams.filters.map(function (filter) {
    //             return _.omit(filter, 'id', 'groupId');
    //         }),
    //         [{attrs: {name: "user_id"}, type: "field"}]
    //     );
    //     assert.deepEqual(
    //         searchView.loadParams.groups.map(function (group) {
    //             return _.omit(group, 'id');
    //         }),
    //         [{}]
    //     );
    // });

    // QUnit.test('parse one separator tag', function (assert) {
    //     assert.expect(2);
    //     var arch = "<search>" +
    //                     "<separator/>" +
    //                 "</search>";
    //     var viewInfo = {arch:  arch};

    //     var searchView = new SearchView(viewInfo, {context: {}});
    //     assert.deepEqual(searchView.loadParams.filters, []);
    //     assert.deepEqual(searchView.loadParams.groups, []);
    // });

    // QUnit.test('parse one separator tag and one field tag', function (assert) {
    //     assert.expect(2);
    //     var arch = "<search>" +
    //                     "<separator/>" +
    //                     "<field name=\"user_id\"/>" +
    //                 "</search>";
    //     var viewInfo = {arch:  arch};

    //     var searchView = new SearchView(viewInfo, {context: {}});
    //     assert.deepEqual(
    //         searchView.loadParams.filters.map(function (filter) {
    //             return _.omit(filter, 'id', 'groupId');
    //         }),
    //         [{attrs: {name: "user_id"}, type: "field"}]
    //     );
    //     assert.deepEqual(
    //         searchView.loadParams.groups.map(function (group) {
    //             return _.omit(group, 'id');
    //         }),
    //         [{}]
    //     );
    // });
    // QUnit.test('parse one filter tag', function (assert) {
    //     assert.expect(2);
    //     var arch = "<search>" +
    //                     "<filter name=\"filter\" string=\"Hello\" " +
    //                     "domain=\"[]\"/>" +
    //                 "</search>";
    //     var viewInfo = {arch:  arch};

    //     var searchView = new SearchView(viewInfo, {context: {}});
    //     assert.deepEqual(
    //         searchView.loadParams.filters.map(function (filter) {
    //             return _.omit(filter, 'id', 'groupId');
    //         }),
    //         [{attrs: {domain: "[]", name: "filter", string: "Hello"}, type: "filter"}]
    //     );
    //     assert.deepEqual(
    //         searchView.loadParams.groups.map(function (group) {
    //             return _.omit(group, 'id');
    //         }),
    //         [{}]
    //     );
    // });
    // QUnit.test('parse one groupBy tag', function (assert) {
    //     assert.expect(2);
    //     var arch = "<search>" +
    //                     "<groupBy name=\"groupby\" string=\"Hi\" " +
    //                     "context=\"{\'group_by\': \'date_field:day\'}\"/>" +
    //                 "</search>";
    //     var viewInfo = {arch:  arch};

    //     var searchView = new SearchView(viewInfo, {context: {}});
    //     assert.deepEqual(
    //         searchView.loadParams.filters.map(function (filter) {
    //             return _.omit(filter, 'id', 'groupId');
    //         }),
    //         [{
    //             attrs: {
    //                 context: "{'group_by': 'date_field:day'}",
    //                 defaultInterval: "day",
    //                 fieldName: "date_field",
    //                 name: "groupby",
    //                 string: "Hi"
    //             },
    //             type: "groupBy"
    //         }]
    //     );
    //     assert.deepEqual(
    //         searchView.loadParams.groups.map(function (group) {
    //             return _.omit(group, 'id');
    //         }),
    //         [{}]
    //     );
    // });
    // QUnit.test('parse two filter tags', function (assert) {
    //     assert.expect(2);
    //     var arch = "<search>" +
    //                     "<filter name=\"filter_1\" string=\"Hello One\" " +
    //                     "domain=\"[]\"/>" +
    //                     "<filter name=\"filter_2\" string=\"Hello Two\" " +
    //                     "domain=\"[(\'user_id\', \'=\', 3)]\"/>" +
    //                 "</search>";
    //     var viewInfo = {arch:  arch};

    //     var searchView = new SearchView(viewInfo, {context: {}});
    //     assert.deepEqual(
    //         searchView.loadParams.filters.map(function (filter) {
    //             return _.omit(filter, 'id', 'groupId');
    //         }),
    //         [{attrs: {domain: "[]", name: "filter_1", string: "Hello One"}, type: "filter"},
    //             {attrs: {domain: "[('user_id', '=', 3)]", name: "filter_2", string: "Hello Two"}, type: "filter"}]
    //     );
    //     assert.deepEqual(
    //         searchView.loadParams.groups.map(function (group) {
    //             return _.omit(group, 'id');
    //         }),
    //         [{}]
    //     );
    // });
    // QUnit.test('parse two filter tags separated by a separator', function (assert) {
    //     assert.expect(2);
    //     var arch = "<search>" +
    //                     "<filter name=\"filter_1\" string=\"Hello One\" " +
    //                     "domain=\"[]\"/>" +
    //                     "<separator/>" +
    //                     "<filter name=\"filter_2\" string=\"Hello Two\" " +
    //                     "domain=\"[(\'user_id\', \'=\', 3)]\"/>" +
    //                 "</search>";
    //     var viewInfo = {arch:  arch};

    //     var searchView = new SearchView(viewInfo, {context: {}});
    //     assert.deepEqual(
    //         searchView.loadParams.filters.map(function (filter) {
    //             return _.omit(filter, 'id', 'groupId');
    //         }),
    //         [{attrs: {domain: "[]", name: "filter_1", string: "Hello One"}, type: "filter"},
    //             {attrs: {domain: "[('user_id', '=', 3)]", name: "filter_2", string: "Hello Two"}, type: "filter"}]
    //     );
    //     assert.deepEqual(
    //         searchView.loadParams.groups.map(function (group) {
    //             return _.omit(group, 'id');
    //         }),
    //         [{}, {}]
    //     );
    // });
    // QUnit.test('parse one filter tag and one field', function (assert) {
    //     assert.expect(4);
    //     var arch = "<search>" +
    //                     "<filter name=\"filter\" string=\"Hello\" domain=\"[]\"/>" +
    //                     "<field name=\"user_id\"/>" +
    //                 "</search>";
    //     var viewInfo = {arch:  arch};

    //     var searchView = new SearchView(viewInfo, {context: {}});
    //     assert.deepEqual(
    //         searchView.loadParams.filters.map(function (filter) {
    //             return _.omit(filter, 'id', 'groupId');
    //         }),
    //         [{attrs: {domain: "[]", name: "filter", string: "Hello"}, type: "filter"},
    //             {attrs: {name: "user_id"}, type: "field"}]
    //     );
    //     assert.deepEqual(
    //         searchView.loadParams.groups.map(function (group) {
    //             return _.omit(group, 'id');
    //         }),
    //         [{}, {}]
    //     );
    //     assert.strictEqual(searchView.loadParams.filters[0].groupId, searchView.loadParams.groups[0].id);
    //     assert.strictEqual(searchView.loadParams.filters[1].groupId, searchView.loadParams.groups[1].id);
    // });
    // change structure and modify test

    // QUnit.test('parse two field tags', function (assert) {
    //     assert.expect(2);
    //     var arch = "<search>" +
    //                     "<field name=\"field_1\"/>" +
    //                     "<field name=\"field_2\"/>" +
    //                 "</search>";
    //     var viewInfo = {arch:  arch};

    //     var searchView = new SearchView(viewInfo, {context: {}});
    //     assert.deepEqual(
    //         searchView.loadParams.filters.map(function (filter) {
    //             return _.omit(filter, 'id', 'groupId');
    //         }),
    //         [{attrs: {domain: "[]", name: "filter_1", string: "Hello One"}, type: "filter"},
    //             {attrs: {domain: "[('user_id', '=', 3)]", name: "filter_2", string: "Hello Two"}, type: "filter"}]
    //     );
    //     assert.deepEqual(
    //         searchView.loadParams.groups.map(function (group) {
    //             return _.omit(group, 'id');
    //         }),
    //         [{}]
    //     );
    // });
});

});
