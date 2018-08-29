odoo.define('web.search_time_range_menu_tests', function (require) {
"use strict";

var TimeRangeMenu = require('web.TimeRangeMenu');
var testUtils = require('web.test_utils');

function createTimeRangeMenu (fields, configuration, params) {
    params = params || {};
    var target = params.debug ? document.body :  $('#qunit-fixture');
    var menu = new TimeRangeMenu(null, fields, configuration);
    testUtils.addMockEnvironment(menu, params);
    menu.appendTo(target);
    return menu;
}

QUnit.module('TimeRangeMenu', {
    beforeEach: function () {
        this.fields = {
            fieldname: {sortable: true, string: 'Super Date', type: 'date', isDate: true}
        };
    },
}, function () {

    QUnit.test('simple rendering', function (assert) {
        assert.expect(4);

        var timeRangeMenu = createTimeRangeMenu(this.fields);
        timeRangeMenu.$('button:first').click();
        assert.strictEqual(timeRangeMenu.$('.dropdown-menu.o_time_range_menu.show').length, 1,
            'time range menu dropdown should be visible');
        assert.strictEqual(timeRangeMenu.$('.o_date_field_selector').val(), 'fieldname',
            'a date field should be present');
        assert.strictEqual(timeRangeMenu.$('.o_time_range_selector').val(), 'today',
            'a date range should be selected by default');
        assert.strictEqual(timeRangeMenu.$('.o_comparison_checkbox').prop('checked'), false,
            '"Compare to" should be present but not checked by default');

        timeRangeMenu.destroy();
    });

    QUnit.test('simple rendering with Compare to', function (assert) {
        assert.expect(0);

        var timeRangeMenu = createTimeRangeMenu(this.fields);

        timeRangeMenu.destroy();
    });
});
});
