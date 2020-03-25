odoo.define('web.domain_selector_tests', function (require) {
    "use strict";

    const DomainSelector = require("web.DomainSelector");
    const testUtils = require("web.test_utils");

    const { createComponent } = testUtils;

    QUnit.module('components', {}, function () {

        QUnit.module('DomainSelector', {
            beforeEach() {
                this.data = {
                    partner: {
                        fields: {
                            foo: { string: "Foo", type: 'char', searchable: true },
                            bar: { string: "Bar", type: 'boolean', searchable: true },
                            nice_datetime: { string: "Datetime", type: 'datetime', searchable: true },
                            product_id: { string: "Product", type: 'many2one', relation: 'product', searchable: true },
                        },
                        records: [
                            { id: 1, foo: 'yop', bar: true, product_id: 37 },
                            { id: 2, foo: 'blip', bar: true, product_id: false },
                            { id: 4, foo: 'abc', bar: false, product_id: 41 }
                        ],
                        onchanges: {},
                    },
                    product: {
                        fields: {
                            name: { string: "Product Name", type: 'char', searchable: true }
                        },
                        records: [
                            { id: 37, display_name: "xphone" },
                            { id: 41, display_name: "xpad"  },
                        ],
                    },
                };
            },
        }, function () {

            QUnit.test("creating a domain from scratch", async function (assert) {
                assert.expect(13);

                const domainSelector = await createComponent(DomainSelector, {
                    data: this.data,
                    props: {
                        model: 'partner',
                        domain: '[]',
                        forceCodeEditor: true,
                        readonly: false,
                    },
                });

                // As we gave an empty domain, there should be a visible button to add
                // the first domain part
                assert.containsOnce(domainSelector, '.o_domain_add_filter');

                // Clicking on the button should add a visible field selector in the
                // widget so that the user can change the field chain
                await testUtils.dom.click(domainSelector.el.querySelector('.o_domain_add_filter'));
                assert.containsOnce(domainSelector, '.o_field_selector');
                const fieldSelector = domainSelector.el.querySelector('.o_field_selector');

                await testUtils.dom.click(fieldSelector);
                assert.strictEqual(fieldSelector, '.o_field_selector_popover');

                // The field selector popover should contain the list of "partner"
                // fields. "Bar" should be among them.
                const listItems = [...fieldSelector.querySelectorAll('.o_field_selector_popover li')];
                const barItem = listItems.find(li => /Bar/.test(li.innerHTML));
                assert.ok(barItem, "field selector popover should contain the 'Bar' field");

                // Clicking the "Bar" field should change the internal domain and this
                // should be displayed in the debug input
                await testUtils.dom.click(barItem);
                assert.strictEqual(
                    domainSelector.el.querySelector('.o_domain_debug_input').value,
                    '[["bar","=",True]]',
                    "the domain input should contain a domain with 'bar'"
                );

                // There should be a "+" button to add a domain part; clicking on it
                // should add the default "['id', '=', 1]" domain
                assert.containsOnce(domainSelector, '.fa-plus-circle');
                await testUtils.dom.click(domainSelector.el.querySelector('.fa-plus-circle'));
                assert.strictEqual(
                    domainSelector.el.querySelector('.o_domain_debug_input').value,
                    '["&",["bar","=",True],["id","=",1]]',
                    "the domain input should contain a domain with 'bar' and 'id'");

                // There should be two "..." buttons to add a domain group; clicking on
                // the first one, should add this group with defaults "['id', '=', 1]"
                // domains and the "|" operator
                assert.containsN(domainSelector, 'fa-ellipsis-h', 2);
                await testUtils.dom.click(domainSelector.el.querySelector('.fa-ellipsis-h'));
                assert.strictEqual(
                    domainSelector.el.querySelector('.o_domain_debug_input').value,
                    '["&","&",["bar","=",True],"|",["id","=",1],["id","=",1],["id","=",1]]',
                    "the domain input should contain a domain with 'bar', 'id' and a subgroup"
                );

                // Changing the domain input to update the subgroup to use the "foo"
                // field instead of "id" should rerender the widget and adapt the
                // widget suggestions
                await testUtils.fields.editSelect(domainSelector.el.querySelector('.o_domain_debug_input'),
                    '["&","&",["bar","=",True],"|",["foo","=","hello"],["id","=",1],["id","=",1]]');
                assert.strictEqual(domainSelector.el.querySelector('.o_field_selector input.o_field_selector_debug').value, "foo",
                    "the second field selector should now contain the 'foo' value");
                assert.ok(/contains/.test(domainSelector.el.querySelector('.o_domain_leaf_operator_select').innerHTML),
                    "the second operator selector should now contain the 'contains' operator");

                // There should be five "-" buttons to remove domain part; clicking on
                // the two last ones, should leave a domain with only the "bar" and
                // "foo" fields, with the initial "&" operator
                const minus = domainSelector.el.querySelectorAll('.o_domain_delete_node_button');
                assert.strictEqual(minus.length, 5, "there should be five 'x' buttons");
                await testUtils.dom.click(minus[minus.length - 1]);

                const deleteButtons = domainSelector.el.querySelectorAll('.o_domain_delete_node_button');
                await testUtils.dom.click(deleteButtons[deleteButtons.length - 1]);
                assert.strictEqual(
                    domainSelector.el.querySelector('.o_domain_debug_input').value,
                    '["&", ["bar", "=", True], ["foo", "=", "hello"]]',
                    "the domain input should contain a domain with 'bar' and 'foo'"
                );
                domainSelector.destroy();
            });

            QUnit.test("building a domain with a datetime", async function (assert) {
                assert.expect(2);

                const domainSelector = await createComponent(DomainSelector, {
                    data: this.data,
                    props: {
                        model: 'partner',
                        domain: '[["nice_datetime", "=", "2017-03-27 15:42:00"]]',
                        readonly: false,
                    },
                });

                // Check that there is a datepicker to choose the date
                assert.containsOnce(domainSelector, 'o_datepicker');

                const datepicker = domainSelector.el.querySelector('.o_datepicker');
                const val = datepicker.querySelector('input').value;
                await testUtils.dom.openDatepicker(datepicker);
                await testUtils.dom.click(document.querySelector('.bootstrap-datetimepicker-widget :not(.today)[data-action="selectDay"]'));
                assert.notEqual(domainSelector.el.querySelector('.o_datepicker input').value, val,
                    "datepicker value should have changed");
                await testUtils.dom.click(document.querySelector('.bootstrap-datetimepicker-widget a[data-action=close]'));

                domainSelector.destroy();
            });

            QUnit.test("building a domain with a m2o without following the relation", async function (assert) {
                assert.expect(1);

                const domainSelector = await createComponent(DomainSelector, {
                    data: this.data,
                    props: {
                        model: 'partner',
                        domain: '[["product_id", "ilike", 1]]',
                        readonly: false,
                        forceCodeEditor: true,
                    },
                });

                await testUtils.fields.editAndTrigger(domainSelector.el.querySelector('.o_domain_leaf_value_input'),
                    'pad', ['input', 'change']);
                assert.strictEqual(domainSelector.el.querySelector('.o_domain_debug_input').value,
                    '[["product_id", "ilike", "pad"]',
                    "string should have been allowed as m2o value");

                domainSelector.destroy();
            });

            QUnit.test("editing a domain with `parent` key", async function (assert) {
                assert.expect(1);

                const domainSelector = await createComponent(DomainSelector, {
                    data: this.data,
                    props: {
                        model: 'product',
                        domain: '[["name", "=", parent.foo]]',
                        readonly: false,
                        forceCodeEditor: true,
                    },
                });

                assert.strictEqual(domainSelector.el.innerText.trim(), "This domain is not supported",
                    "an error message should be displayed because of the `parent` key");

                domainSelector.destroy();
            });

            QUnit.test("creating a domain with a default option", async function (assert) {
                assert.expect(1);

                const domainSelector = await createComponent(DomainSelector, {
                    data: this.data,
                    props: {
                        model: 'partner',
                        domain: '[]',
                        readonly: false,
                        forceCodeEditor: true,
                        default: '[["foo", "=", "kikou"]]',
                    },
                });

                // Clicking on the button should add a visible field selector in the
                // widget so that the user can change the field chain
                await testUtils.dom.click(domainSelector.el.querySelector('.o_domain_add_filter'));

                assert.strictEqual(
                    domainSelector.el.querySelector('.o_domain_debug_input').value,
                    '[["foo", "=", "kikou"]]',
                    "the domain input should contain the default domain");

                domainSelector.destroy();
            });
        });
    });
});
