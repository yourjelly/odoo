import { registry } from "@web/core/registry";
import { ElementToolboxContainer } from "../../components/ElementToolboxContainer";
import { Component } from "@odoo/owl";
import { LayoutOption } from "../../components/options/LayoutOption";

class SectionToolbox extends Component {
    static template = "mysterious_egg.SectionToolbox";
    static components = {
        ElementToolboxContainer,
        LayoutOption,
    };
}

registry.category("sidebar-element-toolbox").add("SectionToolbox", {
    ToolboxComponent: SectionToolbox,
    selector: "section",
});
