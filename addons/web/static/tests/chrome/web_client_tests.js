odoo.define('web.web_client_tests', function (require) {
"use strict";

const testUtils = require('web.test_utils');

const { createWebClient } = testUtils;

QUnit.module('WebClient Community', {
    beforeEach: function () {
        this.data = {
            partner: {
                fields: {},
                records: [
                    {id: 1, display_name: "First partner"},
                    {id: 2, display_name: "Second partner"},
                ],
                do_something() {}
            },
            product: {
                fields: {},
                records: [
                    {id: 4, display_name: 'Chair'},
                    {id: 6, display_name: 'Table'},
                ],
            },
            task: {
                fields: {},
                records: [],
            },
        };

        this.actions = [{
            id: 10,
            name: 'Partners',
            res_model: 'partner',
            type: 'ir.actions.act_window',
            views: [[false, 'list'], [false, 'form']],
        }, {
            id: 11,
            name: 'Create a Partner',
            res_model: 'partner',
            type: 'ir.actions.act_window',
            views: [[false, 'form']],
        }, {
            id: 12,
            name: 'Create a Partner (Dialog)',
            res_model: 'partner',
            type: 'ir.actions.act_window',
            views: [[false, 'form']],
            target: 'new',
        }, {
            id: 20,
            name: 'Products',
            res_model: 'product',
            type: 'ir.actions.act_window',
            views: [[false, 'list']],
        }, {
            id: 30,
            name: 'Tasks',
            res_model: 'task',
            type: 'ir.actions.act_window',
            views: [[false, 'kanban']],
        }];

        this.archs = {
            // list views
            'partner,false,list': '<tree><field name="id"/><field name="display_name"/></tree>',
            'product,false,list': '<tree><field name="id"/><field name="display_name"/></tree>',

            // kanban views
            'task,false,kanban': `
                <kanban>
                    <templates>
                        <t t-name="kanban-box">
                            <field name="display_name"/>
                        </t>
                    </templates>
                </kanban>`,

            // form views
            'partner,false,form': `
                <form>
                    <header><button name="do_something" string="Call button" type="object"/></header>
                    <sheet><field name="display_name"/></sheet>
                </form>`,

            // search views
            'partner,false,search': '<search/>',
            'product,false,search': '<search/>',
            'task,false,search': '<search/>',
        };

        this.menus = {
            all_menu_ids: [1, 2, 3, 4, 5, 6],
            children: [{
                id: 1,
                action: 'ir.actions.act_window,10',
                name: "Partners",
                xmlid: 'la_woman1',
                web_icon_data: 'bloop',
                web_icon: 'bloop,bloop,bloop',
                children: [{
                    id: 2,
                    action: 'ir.actions.act_window,10',
                    name: "All Partners",
                    children: [],
                    web_icon: false,
                    xmlid: 'la_woman11',
                    parent_id: [1, 'Partners'],
                }, {
                    id: 3,
                    action: 'ir.actions.act_window,11',
                    name: "New partner",
                    children: [],
                    web_icon: false,
                    xmlid: 'la_woman12',
                    parent_id: [1, 'Partners']
                }, {
                    id: 6,
                    action: 'ir.actions.act_window,12',
                    name: "New partner (Dialog)",
                    children: [],
                    web_icon: false,
                    xmlid: 'la_woman13',
                    parent_id: [1, 'Partners']
                }],
            }, {
                id: 4,
                action: 'ir.actions.act_window,20',
                name: "Products",
                children: [],
                xmlid: 'la_woman2',
                web_icon_data: 'bloop',
                web_icon: 'bloop,bloop,bloop',
            }, {
                id: 5,
                action: 'ir.actions.act_window,30',
                name: "Tasks",
                children: [],
                xmlid: 'la_woman3',
                web_icon_data: 'bloop',
                web_icon: 'bloop,bloop,bloop',
            }],
        };
    },
}, function () {
    QUnit.test('initial rendering (should open first menu)', async function (assert) {
        assert.expect(10);

        const webClient = await createWebClient({
            data: this.data,
            actions: this.actions,
            archs: this.archs,
            menus: this.menus,
        });

        assert.containsOnce(webClient, 'header .o_main_navbar');
        assert.containsOnce(webClient, 'header .o_main_navbar .o_menu_brand');
        assert.containsOnce(webClient, 'header .o_main_navbar .o_menu_sections');
        assert.containsOnce(webClient, 'header .o_main_navbar .o_menu_systray');
        assert.containsOnce(webClient, '.o_action_manager');

        assert.strictEqual(webClient.el.querySelector('.o_menu_brand').innerText, 'Partners');
        assert.containsN(webClient, 'header .o_main_navbar .o_menu_sections li a', 3);
        assert.containsN(webClient, '.o_menu_sections li', 3);

        assert.strictEqual(webClient.el.querySelector('.breadcrumb').innerText, 'Partners');
        assert.containsOnce(webClient, '.o_list_view');

        webClient.destroy();
    });

    QUnit.test('initial rendering (should open custom action on user)', async function (assert) {
        assert.expect(10);

        const webClient = await createWebClient({
            data: this.data,
            actions: this.actions,
            archs: this.archs,
            menus: this.menus,
            session: {
                home_action_id: 30,
            }
        });

        assert.containsOnce(webClient, 'header .o_main_navbar');
        assert.containsOnce(webClient, 'header .o_main_navbar .o_menu_brand');
        assert.containsOnce(webClient, 'header .o_main_navbar .o_menu_sections');
        assert.containsOnce(webClient, 'header .o_main_navbar .o_menu_systray');
        assert.containsOnce(webClient, '.o_action_manager');

        assert.strictEqual(webClient.el.querySelector('.o_menu_brand').innerText, 'Tasks');
        assert.containsNone(webClient, 'header .o_main_navbar .o_menu_sections li a');
        assert.containsNone(webClient, '.o_menu_sections li');

        assert.strictEqual(webClient.el.querySelector('.breadcrumb').innerText, 'Tasks');
        assert.containsOnce(webClient, '.o_kanban_view');

        webClient.destroy();
    });

    QUnit.test('can click on a menuitem', async function (assert) {
        assert.expect(6);

        const webClient = await createWebClient({
            data: this.data,
            actions: this.actions,
            archs: this.archs,
            menus: this.menus,
        });

        assert.containsOnce(webClient, '.o_list_view');
        assert.strictEqual(webClient.el.querySelector('.o_menu_brand').innerText, 'Partners');
        assert.strictEqual(webClient.el.querySelector('.breadcrumb').innerText, 'Partners');
        await testUtils.dom.click(webClient.el.querySelector('a[data-menu-id="3"]'));
        await testUtils.owlCompatibilityExtraNextTick();
        assert.containsOnce(webClient, '.o_form_view');
        assert.strictEqual(webClient.el.querySelector('.o_menu_brand').innerText, 'Partners');
        assert.strictEqual(webClient.el.querySelector('.breadcrumb').innerText, 'New');

        webClient.destroy();
    });

    QUnit.test('can switch app', async function (assert) {
        assert.expect(6);

        const webClient = await createWebClient({
            data: this.data,
            actions: this.actions,
            archs: this.archs,
            menus: this.menus,
        });

        assert.containsOnce(webClient, '.o_list_view');
        assert.strictEqual(webClient.el.querySelector('.o_menu_brand').innerText, 'Partners');
        assert.strictEqual(webClient.el.querySelector('.breadcrumb').innerText, 'Partners');

        await testUtils.dom.click(webClient.el.querySelector('.o_menu_apps li a'));
        await testUtils.dom.click(webClient.el.querySelector('.o_menu_apps a[data-menu-id="5"]'));
        await testUtils.owlCompatibilityExtraNextTick();
        assert.containsOnce(webClient, '.o_kanban_view');
        assert.strictEqual(webClient.el.querySelector('.o_menu_brand').innerText, 'Tasks');
        assert.strictEqual(webClient.el.querySelector('.breadcrumb').innerText, 'Tasks');

        webClient.destroy();
    });
});
});
