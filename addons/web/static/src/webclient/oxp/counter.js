/** @odoo-module **/

import { Component } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";

class MyCounter extends Component {
    static template = "web.MyCounter";
    setup() {}
}

registry.category("actions").add("myCounter", MyCounter);

const commandProviderRegistry = registry.category("command_provider");

commandProviderRegistry.add("counter", {
    provide: (env, options) => {
        return [
            {
                action() {
                    env.services.action.doAction("myCounter");
                },
                category: "app",
                name: _t("A Display Counter"),
            },
        ];
    },
});
