odoo.define('web.search_filters_menu_tests', function (require) {
"use strict";

var FiltersMenu = require('web.FiltersMenu');
var testUtils = require('web.test_utils');

function createFiltersMenu(filters, fields, params) {
    params = params || {};
    var target = params.debug ? document.body :  $('#qunit-fixture');
    var menu = new FiltersMenu(null, filters, fields);
    testUtils.mock.addMockEnvironment(menu, params);
    menu.appendTo(target);
    return menu;
}

QUnit.module('FiltersMenu', {
    beforeEach: function () {
        this.filters = [
            {
                isActive: false,
                description: 'some filter',
                domain: '',
                groupNumber: 1,
            },
        ];
        this.fields = {
            boolean_field: {string: "Boolean Field", type: "boolean", default: true, searchable: true},
            date_field: {string: "A date", type: "date", searchable: true},
            char_field: {string: "Char Field", type: "char", default: "foo", searchable: true, trim: true},
        };
    },
}, function () {

    QUnit.test('simple rendering with no filter', function (assert) {
        assert.expect(4);

        var filtersMenu = createFiltersMenu([], this.fields);
        testUtils.dom.click(filtersMenu.$('span.fa-filter'));
        assert.containsOnce(filtersMenu, '.dropdown-divider');
        assert.ok(!filtersMenu.$('.dropdown-divider').is(':visible'));
        assert.containsN(filtersMenu, '.dropdown-divider, .dropdown-item, .dropdown-item-text', 3,
            'should have 3 elements: a hidden divider, a add custom filter item, a apply button + add condition button');
        assert.containsOnce(filtersMenu, '.o_add_custom_filter.o_closed_menu');
        filtersMenu.destroy();
    });

    QUnit.test('simple rendering with a filter', function (assert) {
        assert.expect(2);

        var filtersMenu = createFiltersMenu(this.filters, this.fields);
        assert.containsN(filtersMenu, '.dropdown-divider, .dropdown-item, .dropdown-item-text', 5,
            'should have 4 elements: a hidden, separator, a filter, a separator, a add custom filter item, a apply button + add condition button');
        assert.containsOnce(filtersMenu, '.o_add_custom_filter.o_closed_menu');
        filtersMenu.destroy();
    });

    QUnit.test('click on add custom filter opens the submenu', function (assert) {
        assert.expect(3);

        var filtersMenu = createFiltersMenu([], this.fields);
        // open menu dropdown
        testUtils.dom.click(filtersMenu.$('span.fa-filter'));
        // open add custom filter submenu
        testUtils.dom.click(filtersMenu.$('.o_add_custom_filter'));
        assert.hasClass(filtersMenu.$('.o_add_custom_filter'), 'o_open_menu');
        assert.ok(filtersMenu.$('.o_add_filter_menu').is(':visible'));
        assert.containsN(filtersMenu, '.dropdown-divider, .dropdown-item, .dropdown-item-text', 4,
            'should have 3 elements: a hidden divider, a add custom filter item, a proposition, a apply button + add condition button');

        filtersMenu.destroy();
    });

    QUnit.test('removing last prop disable the apply button', function (assert) {
        assert.expect(2);

        var filtersMenu = createFiltersMenu([], this.fields);
        // open menu dropdown and custom filter submenu
        testUtils.dom.click(filtersMenu.$('span.fa-filter'));
        testUtils.dom.click(filtersMenu.$('.o_add_custom_filter'));

        // remove the current unique proposition
        testUtils.dom.click(filtersMenu.$('.o_searchview_extended_delete_prop'));

        assert.ok(filtersMenu.$('.o_apply_filter').attr('disabled'));

        assert.containsN(filtersMenu, '.dropdown-divider, .dropdown-item, .dropdown-item-text', 3,
            'should have 3 elements: a hidden separator, a add custom filter item, a apply button + add condition button');

        filtersMenu.destroy();
    });

    QUnit.test('readding a proposition reenable apply button', function (assert) {
        assert.expect(1);

        var filtersMenu = createFiltersMenu([], this.fields);
        // open menu dropdown and custom filter submenu, remove existing prop
        testUtils.dom.click(filtersMenu.$('span.fa-filter'));
        testUtils.dom.click(filtersMenu.$('.o_add_custom_filter'));
        testUtils.dom.click(filtersMenu.$('.o_searchview_extended_delete_prop'));
        // read a proposition
        testUtils.dom.click(filtersMenu.$('.o_add_condition'));
        assert.ok(!filtersMenu.$('.o_apply_filter').attr('disabled'));

        filtersMenu.destroy();
    });

    QUnit.test('adding a simple filter works', function (assert) {
        assert.expect(6);

        delete this.fields.date_field;
        var filtersMenu = createFiltersMenu([], this.fields, {
            debug: true,
            intercepts: {
                new_filters: function (ev) {
                    var filter = ev.data.filters[0];
                    assert.strictEqual(filter.type, 'filter');
                    assert.strictEqual(filter.description, 'Boolean Field is true');
                    assert.strictEqual(filter.domain, '[[\"boolean_field\",\"=\",True]]');
                    filtersMenu.update([{
                        isActive: true,
                        description: '?',
                        domain: '?',
                        groupNumber: 1,
                    }]);
                },
            },
        });
        // open menu dropdown and custom filter submenu, remove existing prop
        testUtils.dom.click(filtersMenu.$('span.fa-filter'));
        testUtils.dom.click(filtersMenu.$('.o_add_custom_filter'));
        // click on apply to activate filter
        testUtils.dom.click(filtersMenu.$('.o_apply_filter'));
        assert.hasClass(filtersMenu.$('.o_add_custom_filter'), 'o_closed_menu');
        assert.containsNone(filtersMenu, '.o_filter_condition');
        assert.containsOnce(filtersMenu, '.dropdown-divider:visible',
            'there should be a separator between filters and add custom filter menu');
        filtersMenu.destroy();
    });
});
});
