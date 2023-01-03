/** @odoo-module **/

import { Dropdown } from "@web/core/dropdown/dropdown";
import { SearchDropdownItem } from "@web/search/search_dropdown_item/search_dropdown_item";
import { useService } from "@web/core/utils/hooks";
import { registry } from "@web/core/registry";

const { Component } = owl;

export class HSCodeWidget extends Component {
    setup() {
        this.orm = useService('orm');
        console.log(" HERE HERE HERE HERE ")
        console.log(this.props.record)
    }
}

HSCodeWidget.template = "product_hs_code.HSCodeMenu"
// HSCodeWidget.components = {}

HSCodeWidget.components = { Dropdown, SearchDropdownItem };
registry.category("fields").add("hscode", HSCodeWidget);
