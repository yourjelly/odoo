/** @odoo-module **/
import { registry } from "@web/core/registry";
import { SnippetOption } from "@web_editor/components/snippets_menu/snippets_options";

export class AlertOption extends SnippetOption {
    static template = "website.s_alert_options";
}

registry.category("snippets_options").add("s_alert", {
    template: "website.s_alert_options",
    selector: ".s_alert",
});
