/** @odoo-module **/

import { useEnvDebugContext } from "./debug_context";
import { Dropdown } from "@web/core/dropdown/dropdown";
import { DropdownItem } from "@web/core/dropdown/dropdown_item";
import { LegacyComponent } from "@web/legacy/legacy_component";

const { Component } = owl;

export class DebugMenuBasic extends LegacyComponent {
    setup() {
        const debugContext = useEnvDebugContext();
        // Needs to be bound to this for use in template
        this.getElements = async () => {
            this.elements = await debugContext.getItems(this.env);
        };
    }
}
DebugMenuBasic.components = {
    Dropdown,
    DropdownItem,
};
DebugMenuBasic.template = "web.DebugMenu";
