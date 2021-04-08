/** @odoo-module **/

import testUtils from "web.test_utils";

import { Registry } from "@web/core/registry";
import { DebugManager } from "@web/debug/debug_manager";
import { debugService } from "@web/debug/debug_service";
import { hotkeyService } from "@web/hotkey/hotkey_service";
import { ormService } from "@web/services/orm_service";
import { uiService } from "@web/services/ui_service";
import { click, getFixture, makeTestEnv } from "@web/../tests/helpers/index";

const { mount } = owl;
const createDebugManager = testUtils.createDebugManager;

let target;
let testConfig;
QUnit.module("Mail DebugManager", (hooks) => {
    hooks.beforeEach(async () => {
        target = getFixture();
        const serviceRegistry = new Registry();
        serviceRegistry.add("hotkey", hotkeyService);
        serviceRegistry.add("ui", uiService);
        serviceRegistry.add("orm", ormService);
        serviceRegistry.add("debug", debugService);
        const mockRPC = async (route, args) => {
            if (args.method === "check_access_rights") {
                return Promise.resolve(true);
            }
        };
        testConfig = { serviceRegistry, mockRPC };
    });
    QUnit.skip("Manage Messages", async function (assert) {
        assert.expect(3);

        var debugManager = await createDebugManager({
            intercepts: {
                do_action: function (event) {
                    assert.deepEqual(event.data.action, {
                        context: {
                            default_res_model: "testModel",
                            default_res_id: 5,
                        },
                        res_model: 'mail.message',
                        name: "Manage Messages",
                        views: [[false, 'list'], [false, 'form']],
                        type: 'ir.actions.act_window',
                        domain: [['res_id', '=', 5], ['model', '=', 'testModel']],
                    });
                },
            },
        });

        await debugManager.appendTo($('#qunit-fixture'));

        // Simulate update debug manager from web client
        var action = {
            views: [{
                displayName: "Form",
                fieldsView: {
                    view_id: 1,
                },
                type: "form",
            }],
        };
        var view = {
            viewType: "form",
            getSelectedIds: function () {
                return [5];
            },
            modelName: 'testModel',
        };
        await testUtils.nextTick();
        await debugManager.update('action', action, view);

        var $messageMenu = debugManager.$('a[data-action=getMailMessages]');
        assert.strictEqual($messageMenu.length, 1, "should have Manage Message menu item");
        assert.strictEqual($messageMenu.text().trim(), "Manage Messages",
            "should have correct menu item text");

        await testUtils.dom.click(debugManager.$('> a')); // open dropdown
        await testUtils.dom.click($messageMenu);

        debugManager.destroy();
    });
});
